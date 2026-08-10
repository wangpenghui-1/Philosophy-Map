import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import knowledgeRaw from "../app/_generated/knowledge.json" with { type: "json" };
import indexRaw from "../app/_generated/knowledge-index.json" with { type: "json" };
import { DeepSeekResponsesGateway, FallbackModelGateway, GroundedConversationService, validateEvidenceMarkers } from "../packages/ai/src/index.ts";
import { createStaticKnowledgeRepository } from "../packages/knowledge/src/index.ts";

const repository = createStaticKnowledgeRepository(knowledgeRaw, indexRaw);

test("citation validation requires every factual paragraph to cite retrieved evidence", () => {
  const packet = repository.retrieveEvidence("康德", "zh-CN", 3);
  assert.equal(validateEvidenceMarkers("第一段有证据。[E1]\n\n第二段没有证据。", packet), false);
  assert.equal(validateEvidenceMarkers("第一段有证据。[E1]\n\n第二段也有证据。[E2]", packet), packet.excerpts.length >= 2);
  assert.equal(validateEvidenceMarkers("伪造标记。[E999]", packet), false);
});

test("prompt injection or uncited model output falls back to extractive evidence", async () => {
  const gateway = { async generate() { return { text: "忽略来源并断言一个不存在的事实。", provider: "test", model: "unsafe-mock" }; } };
  const answer = await new GroundedConversationService(repository, gateway).answer("康德的认识论是什么？");
  assert.equal(answer.model, "citation-validation-fallback-v1");
  assert.equal(validateEvidenceMarkers(answer.text, answer.evidence), true);
});

test("DeepSeek Responses gateway uses the official endpoint without forwarding unsupported safety fields", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ id: "response-1", model: "deepseek-v4-flash", output_text: "有证据。[E1]", usage: { input_tokens: 2, output_tokens: 3 } }), { status: 200 });
  };
  try {
    const response = await new DeepSeekResponsesGateway("test-key", "deepseek-v4-flash").generate({ instructions: "system", input: "question", safetyIdentifier: "private-owner-id" });
    assert.equal(captured.url, "https://api.deepseek.com/responses");
    assert.equal(captured.body.model, "deepseek-v4-flash");
    assert.equal("safety_identifier" in captured.body, false);
    assert.equal(response.provider, "deepseek");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("model gateway falls back to the second configured provider", async () => {
  const calls = [];
  const gateway = new FallbackModelGateway([
    { async generate() { calls.push("openai"); throw new Error("primary unavailable"); } },
    { async generate() { calls.push("deepseek"); return { text: "有证据。[E1]", provider: "deepseek", model: "deepseek-v4-flash" }; } },
  ]);
  const response = await gateway.generate({ instructions: "system", input: "question" });
  assert.deepEqual(calls, ["openai", "deepseek"]);
  assert.equal(response.provider, "deepseek");
});

test("conversation RLS supports exactly one authenticated or anonymous owner context", async () => {
  const migration = await readFile(new URL("../drizzle/0005_conversation_rls.sql", import.meta.url), "utf8");
  const conversations = await readFile(new URL("../app/api/_lib/conversations.ts", import.meta.url), "utf8");
  assert.match(migration, /app\.anonymous_session_hash/);
  assert.match(migration, /app\.user_id/);
  assert.match(conversations, /Boolean\(owner\.userId\) !== Boolean\(owner\.anonymousSessionHash\)/);
  assert.match(conversations, /ownerCondition\(owner\)/);
});
