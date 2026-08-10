import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  const [generatedCoverage, historicalRelease, increment] = await Promise.all([
    JSON.parse(await readFile(path.join(projectRoot, "app", "_generated", "coverage-report.json"), "utf8")),
    JSON.parse(await readFile(path.join(projectRoot, "content", "knowledge", "coverage", "release-210.json"), "utf8")),
    JSON.parse(await readFile(path.join(projectRoot, "content", "knowledge", "coverage", "release-213-increment.json"), "utf8")),
  ]);
  const result = await auditKnowledgeBase({
    contentRoot: path.join(projectRoot, "content", "knowledge"),
    generatedRoot: path.join(projectRoot, "app", "_generated"),
  });
  assert.equal(result.summary.people, generatedCoverage.published.people);
  assert.equal(result.summary.relations, generatedCoverage.published.relations);
  assert.equal(result.summary.sources, generatedCoverage.published.sources);
  assert.equal(result.summary.coverageCandidates, 0);
  assert.equal(result.summary.releasedCandidates, historicalRelease.members.length + increment.members.length);
  assert.equal(result.summary.production.batchCount, 6);
  assert.equal(result.summary.production.taskCount, 180);
  assert.equal(result.summary.production.publicCandidates, 0);
  assert.deepEqual(result.findings.filter((item) => item.severity === "blocker"), []);
  assert.ok(result.findings.some((item) => item.code === "release-gate-passed"));
});
