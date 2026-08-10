import assert from "node:assert/strict";
import cases from "../tests/fixtures/ai-eval.zh-CN.json" with { type: "json" };
import knowledgeRaw from "../app/_generated/knowledge.json" with { type: "json" };
import indexRaw from "../app/_generated/knowledge-index.json" with { type: "json" };
import { GroundedConversationService, validateEvidenceMarkers } from "../packages/ai/src/index.ts";
import { createStaticKnowledgeRepository } from "../packages/knowledge/src/index.ts";

const repository = createStaticKnowledgeRepository(knowledgeRaw, indexRaw);
const service = new GroundedConversationService(repository);
const results = [];
for (const item of cases) {
  const answer = await service.answer(item.query);
  const passed = item.expect === "abstain"
    ? answer.abstained && answer.citations.length === 0
    : !answer.abstained && answer.citations.length > 0 && validateEvidenceMarkers(answer.text, answer.evidence);
  results.push({ id: item.id, expected: item.expect, abstained: answer.abstained, citations: answer.citations.length, passed });
}
const passed = results.filter((item) => item.passed).length;
console.log(JSON.stringify({ suite: "ai-eval.zh-CN", passed, total: results.length, results }, null, 2));
assert.equal(passed, results.length, "AI evaluation gate failed.");
