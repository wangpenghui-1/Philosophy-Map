import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeKnowledgeRecord } from "../scripts/automated-editor.mjs";
import { auditKnowledgeBase } from "../scripts/knowledge-review-audit.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("automated editor performs only deterministic normalization", () => {
  const normalized = normalizeKnowledgeRecord({
    reviewedBy: " 首轮迁移复核 ",
    aliases: [" A ", "A", "B"],
    sourceIds: ["src-a"],
    citations: [{ sourceId: "src-b", locator: " p. 1 ", claim: " claim " }],
  });
  assert.equal(normalized.reviewedBy, "automated-migration-review/v1");
  assert.deepEqual(normalized.aliases, ["A", "B"]);
  assert.deepEqual(normalized.sourceIds, ["src-a", "src-b"]);
  assert.equal(normalized.citations[0].locator, "p. 1");
});

test("knowledge review audit reports no deterministic blockers", async () => {
  const result = await auditKnowledgeBase({
    contentRoot: path.join(projectRoot, "content", "knowledge"),
    generatedRoot: path.join(projectRoot, "app", "_generated"),
  });
  assert.equal(result.summary.people, 30);
  assert.equal(result.summary.relations, 27);
  assert.equal(result.summary.sources, 31);
  assert.equal(result.summary.coverageCandidates, 210);
  assert.equal(result.summary.production.batchCount, 1);
  assert.equal(result.summary.production.taskCount, 30);
  assert.equal(result.summary.production.publicCandidates, 0);
  assert.deepEqual(result.findings.filter((item) => item.severity === "blocker"), []);
  assert.ok(result.findings.some((item) => item.code === "final-human-approval"));
});
