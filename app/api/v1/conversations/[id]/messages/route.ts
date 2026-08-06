import { createMessageSchema } from "@atlas/api-contracts";
import { estimateModelCost, GroundedConversationService, OpenAIResponsesGateway } from "@atlas/ai";
import { isDatabaseConfigured } from "@atlas/db";
import { knowledgeRepository } from "../../../../_lib/backend";
import { resolveConversationIdentity } from "../../../../_lib/anonymous-session";
import { beginConversationRun, finishConversationRun } from "../../../../_lib/ai-runtime";
import { appendConversationExchange, conversationExists } from "../../../../_lib/conversations";
import { problemResponse, validationProblem } from "../../../../_lib/http";
import { loadConfirmedMemoryContext } from "../../../../_lib/memories";
import { rateLimit, requestNetworkKey } from "../../../../_lib/rate-limit";
import { isSameOrigin } from "../../../../_lib/session";

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const parsed = createMessageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { id } = await params;
  const identity = await resolveConversationIdentity(request);
  if (!await conversationExists(id, identity.owner)) return problemResponse(404, "未找到会话");
  const limit = await rateLimit("ai-message", `${identity.rateSubject}:${requestNetworkKey(request)}`, { limit: identity.principal.subject ? 60 : 12, windowSeconds: 3600 });
  if (!limit.allowed) return problemResponse(429, "AI 对话额度已用完", `请在 ${limit.retryAfter} 秒后重试。`);
  const gateway = process.env.OPENAI_API_KEY && process.env.OPENAI_RESPONSE_MODEL
    ? new OpenAIResponsesGateway()
    : undefined;
  const service = new GroundedConversationService(knowledgeRepository, gateway);
  const encoder = new TextEncoder();
  const runController = beginConversationRun(id);

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const send = (name: string, data: unknown) => streamController.enqueue(encoder.encode(event(name, data)));
      try {
        send("ack", { conversationId: id, persistence: isDatabaseConfigured() ? "database" : "ephemeral" });
        const startedAt = Date.now();
        const memories = identity.owner.userId ? await loadConfirmedMemoryContext(identity.owner.userId) : [];
        const answer = await service.answer(parsed.data.content, parsed.data.locale, identity.rateSubject.slice(0, 64), runController.signal, memories.map((memory) => `${memory.memoryType} · ${memory.label}: ${memory.value}`));
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
          userText: parsed.data.content,
          assistantText: answer.text,
          providerResponseId: answer.responseId,
          citations: answer.citations,
          provider: answer.provider,
          model: answer.model,
          usage: answer.usage,
          retrievalSnapshot: answer.evidence,
          latencyMs: Date.now() - startedAt,
          estimatedCostUsd: estimateModelCost(answer.usage),
        }, identity.owner);
        send("usage", { provider: answer.provider, model: answer.model, remaining: limit.remaining, ...answer.usage });
        send("done", { abstained: answer.abstained, persisted, conversationId: id, memoryCount: memories.length });
      } catch (error) {
        send("error", {
          code: runController.signal.aborted ? "cancelled" : "grounded_answer_failed",
          message: runController.signal.aborted ? "回答已取消。" : error instanceof Error ? error.message : "回答生成失败。",
        });
      } finally {
        finishConversationRun(id, runController);
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      ...(identity.setCookie ? { "set-cookie": identity.setCookie } : {}),
      "x-ratelimit-remaining": String(limit.remaining),
    },
  });
}
