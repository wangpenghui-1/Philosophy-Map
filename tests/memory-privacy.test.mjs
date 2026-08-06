import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import knowledgeRaw from "../app/_generated/knowledge.json" with { type: "json" };
import indexRaw from "../app/_generated/knowledge-index.json" with { type: "json" };
import { rejectsSensitiveMemory } from "../app/api/_lib/memories.ts";
import { GroundedConversationService } from "../packages/ai/src/index.ts";
import { createStaticKnowledgeRepository } from "../packages/knowledge/src/index.ts";

test("sensitive identity and health attributes are rejected from long-term memory", () => {
  assert.equal(rejectsSensitiveMemory({ label: "表达偏好", value: "先举例，再解释术语" }), false);
  assert.equal(rejectsSensitiveMemory({ label: "宗教身份", value: "任何值" }), true);
  assert.equal(rejectsSensitiveMemory({ label: "个人资料", value: "我的健康状况需要长期保存" }), true);
  assert.equal(rejectsSensitiveMemory({ label: "political affiliation", value: "private" }), true);
});

test("confirmed memories are delivered as personalization data, never evidence", async () => {
  let captured;
  const gateway = { async generate(request) { captured = request; return { text: "依据站内材料回答。[E1]", provider: "test", model: "memory-boundary" }; } };
  const repository = createStaticKnowledgeRepository(knowledgeRaw, indexRaw);
  const answer = await new GroundedConversationService(repository, gateway).answer("康德是什么人？", "zh-CN", "safe", undefined, ["preference · 表达方式: 先举日常例子"]);
  assert.equal(answer.model, "memory-boundary");
  assert.match(captured.input, /<personalization>/);
  assert.match(captured.instructions, /不能作为事实证据/);
  assert.match(captured.input, /先举日常例子/);
});

test("memory vectors are user-owned and cascade with account deletion", async () => {
  const migration = await readFile(new URL("../drizzle/0006_flimsy_ricochet.sql", import.meta.url), "utf8");
  assert.match(migration, /memory_embeddings_user_id_users_id_fk/);
  assert.match(migration, /ON DELETE cascade/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /memory_embeddings_owner_policy/);
});

test("privacy export includes derived user data but never credential hashes", async () => {
  const route = await readFile(new URL("../app/api/v1/me/export/route.ts", import.meta.url), "utf8");
  for (const name of ["consents", "memoryEmbeddings", "messageCitations", "modelRuns", "usage"]) assert.match(route, new RegExp(name));
  assert.doesNotMatch(route, /passwordHash|tokenHash/);
});
