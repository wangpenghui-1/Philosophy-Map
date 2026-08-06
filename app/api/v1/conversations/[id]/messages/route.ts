import { createMessageSchema } from "@atlas/api-contracts";
import { GroundedConversationService, OpenAIResponsesGateway } from "@atlas/ai";
import { isDatabaseConfigured } from "@atlas/db";
import { knowledgeRepository } from "../../../../_lib/backend";
import { resolveAnonymousSession } from "../../../../_lib/anonymous-session";
import { appendConversationExchange } from "../../../../_lib/conversations";
import { validationProblem } from "../../../../_lib/http";

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = createMessageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { id } = await params;
  const anonymous = resolveAnonymousSession(request);
  const gateway = process.env.OPENAI_API_KEY && process.env.OPENAI_RESPONSE_MODEL
    ? new OpenAIResponsesGateway()
    : undefined;
  const service = new GroundedConversationService(knowledgeRepository, gateway);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (name: string, data: unknown) => controller.enqueue(encoder.encode(event(name, data)));
      try {
        send("ack", { conversationId: id, persistence: isDatabaseConfigured() ? "database" : "ephemeral" });
        const answer = await service.answer(parsed.data.content, parsed.data.locale, anonymous.hash.slice(0, 64));
        send("retrieval", {
          excerpts: answer.evidence.excerpts.map((excerpt) => ({
            entityId: excerpt.entityId,
            title: excerpt.title,
            score: excerpt.score,
          })),
        });
        for (const paragraph of answer.text.split(/\n\n+/)) {
          send("text.delta", { text: `${paragraph}\n\n` });
        }
        answer.citations.forEach((citation, index) => send("citation", { index: index + 1, ...citation }));
        const persisted = await appendConversationExchange({
          conversationId: id,
          anonymousSessionHash: anonymous.hash,
          userText: parsed.data.content,
          assistantText: answer.text,
          providerResponseId: answer.responseId,
          citations: answer.citations,
          provider: answer.provider,
          model: answer.model,
          usage: answer.usage,
          retrievalSnapshot: answer.evidence,
        });
        send("usage", { provider: answer.provider, model: answer.model, ...answer.usage });
        send("done", { abstained: answer.abstained, persisted });
      } catch (error) {
        send("error", {
          code: "grounded_answer_failed",
          message: error instanceof Error ? error.message : "回答生成失败。",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      ...(anonymous.setCookie ? { "set-cookie": anonymous.setCookie } : {}),
    },
  });
}
