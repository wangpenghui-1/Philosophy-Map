import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { productionTaskSchema } from "../scripts/content-production-schema.mjs";
import {
  applyWorkerResult,
  applyWorkerResults,
  buildWorkerQueue,
  evaluatePromotionReadiness,
  retryFailedJobs,
  summarizeBatch,
} from "../scripts/content-batch-runner.mjs";
import { auditContentProduction } from "../scripts/content-production-audit.mjs";
import {
  createBatchManifest,
  createProductionTask,
  slugifyCandidateName,
} from "../scripts/prepare-content-batch.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coverage = JSON.parse(await readFile(path.join(projectRoot, "content/knowledge/coverage/people.json"), "utf8"));
const batchOne = coverage.releaseCandidates.filter((candidate) => candidate.batch === 1);

test("batch one spans the required world regions and eras", () => {
  const manifest = createBatchManifest(1, batchOne, coverage.batchRules);
  assert.equal(manifest.candidateCount, 30);
  assert.equal(Object.keys(manifest.coverage.regionCounts).length, 8);
  assert.equal(Object.keys(manifest.coverage.eraCounts).length, 6);
  assert.equal(manifest.coverage.maximumSingleRegionShare, 0.2);
  assert.equal(manifest.gates.automaticPublicationAllowed, false);
});

test("candidate scaffolds are private, source-gated, and deterministic", () => {
  const task = createProductionTask(batchOne[0]);
  assert.equal(task.candidateId, "candidate-001");
  assert.equal(task.proposedPersonId, "laozi");
  assert.equal(task.target.publicVisibility, false);
  assert.equal(task.target.editorialStatus, "candidate");
  assert.equal(task.workflow.status, "research-planned");
  assert.equal(task.workflow.jobs.length, 7);
  assert.equal(task.research.sourceLeads.length, 0);
  assert.equal(task.research.sourceRequirements.referenceDatasetMayStandAlone, false);
  assert.deepEqual(createProductionTask(batchOne[0]), task);
  assert.doesNotThrow(() => productionTaskSchema.parse(task));
});

test("romanized names produce stable repository-safe ids", () => {
  assert.equal(slugifyCandidateName("B. R. Ambedkar"), "b-r-ambedkar");
  assert.equal(slugifyCandidateName("Léopold Sédar Senghor"), "leopold-sedar-senghor");
  assert.equal(slugifyCandidateName("Vine Deloria Jr."), "vine-deloria-jr");
});

function workerResult(task, stage, payload) {
  return {
    schemaVersion: 1,
    resultId: `${task.candidateId}:${stage}:test`,
    batchId: task.batchId,
    candidateId: task.candidateId,
    stage,
    outcome: "passed",
    worker: "automated-content-worker/test",
    payload,
  };
}

function verifiedSource(status = "verified") {
  return {
    id: "source-1",
    title: "Test scholarly source",
    authors: ["Researcher"],
    sourceType: "scholarly-encyclopedia",
    publication: "Academic reference",
    year: 2024,
    identifiers: { url: "https://example.org/source", doi: null, isbn: null },
    verification: {
      status,
      method: status === "verified" ? "publisher-metadata" : null,
      checkedAt: status === "verified" ? "2026-07-18T00:00:00.000Z" : null,
      note: null,
    },
    relevance: "Supports the index entry and its claim locations.",
  };
}

test("initial tasks emit two independent research jobs without exposing candidates", () => {
  const tasks = batchOne.map(createProductionTask);
  const queue = buildWorkerQueue(tasks);
  const summary = summarizeBatch(tasks);
  assert.equal(queue.length, 60);
  assert.deepEqual(new Set(queue.map((packet) => packet.stage)), new Set(["identity-and-chronology", "source-discovery"]));
  assert.equal(summary.taskCount, 30);
  assert.equal(summary.publicCandidates, 0);
  assert.equal(summary.readyForPromotion, 0);
});

test("failed jobs retry only within their explicit budget", () => {
  const task = createProductionTask(batchOne[0]);
  const failed = applyWorkerResult(task, {
    schemaVersion: 1,
    resultId: "candidate-001:source-discovery:failed-1",
    batchId: task.batchId,
    candidateId: task.candidateId,
    stage: "source-discovery",
    outcome: "failed",
    worker: "automated-content-worker/test",
    error: { code: "network-timeout", message: "temporary failure", retryable: true },
  });
  assert.equal(failed.workflow.status, "blocked");
  assert.equal(failed.workflow.jobs.find((job) => job.id === "source-discovery").attempts, 1);
  const retried = retryFailedJobs(failed);
  assert.equal(retried.retried, 1);
  assert.equal(retried.task.workflow.jobs.find((job) => job.id === "source-discovery").status, "pending");
});

test("worker result batches are transactional and duplicate delivery is idempotent", () => {
  const task = createProductionTask(batchOne[0]);
  const result = workerResult(task, "identity-and-chronology", {
    originalName: "老子",
    aliases: [],
    chronology: { label: "约公元前6至5世纪", startYear: -600, endYear: -400, certainty: "disputed", note: "年代有争议。" },
  });
  const once = applyWorkerResults([task], [result])[0];
  const twice = applyWorkerResult(once, result);
  assert.deepEqual(twice, once);
  assert.equal(twice.workflow.jobs.find((job) => job.id === "identity-and-chronology").attempts, 1);

  assert.throws(() => applyWorkerResults([task], [result, result]), /duplicate resultId/);
  assert.equal(task.workflow.jobs.find((job) => job.id === "identity-and-chronology").attempts, 0);
});

test("state machine requires verified sources, located claims, and all reviews", () => {
  let task = createProductionTask(batchOne[0]);
  task = applyWorkerResult(task, workerResult(task, "identity-and-chronology", {
    originalName: "老子",
    aliases: ["Lao Tzu"],
    chronology: { label: "约公元前6至5世纪", startYear: -600, endYear: -400, certainty: "disputed", note: "身份与年代存在争议。" },
  }));
  task = applyWorkerResult(task, workerResult(task, "source-discovery", { sourceLeads: [verifiedSource("pending")] }));
  assert.throws(() => applyWorkerResult(task, workerResult(task, "source-verification", {
    sourceLeads: [{ ...verifiedSource(), sourceType: "reference-dataset" }],
  })), /source gate failed/);
  task = applyWorkerResult(task, workerResult(task, "source-verification", { sourceLeads: [verifiedSource()] }));

  const claims = task.research.claimTasks.map((claim) => ({ claimTaskId: claim.id, claim: `Supported claim for ${claim.id}.` }));
  task = applyWorkerResult(task, workerResult(task, "index-draft", {
    guidingQuestion: "秩序是否可以不依赖强制而形成？",
    thesis: "测试论点仅用于验证生产门禁。",
    summary: "这是一个用于自动化测试的索引摘要。它以足够长度验证候选条目的字数限制、来源门禁、概念区分和引用定位要求，同时明确不构成可公开发布的哲学内容，也不会进入网站搜索索引或三维地球数据。",
    proposedConcepts: ["道"],
    proposedWorks: ["道德经"],
    proposedPlaces: ["周"],
    claims,
  }));
  task = applyWorkerResult(task, workerResult(task, "citation-location", {
    citations: task.research.claimTasks.map((claim) => ({ claimTaskId: claim.id, sourceLeadId: "source-1", locator: `section ${claim.id}` })),
  }));
  task = applyWorkerResult(task, workerResult(task, "bias-and-counterevidence", {
    crossCulturalBias: { status: "passed", notes: ["Uses tradition-specific terminology."] },
    counterEvidence: { status: "passed", notes: ["Chronology dispute remains explicit."] },
    attributionAndUncertainty: { status: "passed", notes: ["Attribution is marked disputed."] },
  }));
  assert.deepEqual(evaluatePromotionReadiness(task, { includeFinalJob: false }), []);
  task = applyWorkerResult(task, workerResult(task, "editorial-assembly", {
    decision: "ready-for-promotion",
    notes: ["All deterministic gates pass; human final approval remains required."],
  }));
  assert.equal(task.workflow.status, "ready-for-promotion");
  assert.deepEqual(evaluatePromotionReadiness(task), []);
  assert.equal(task.target.publicVisibility, false);
});

test("repository production audit validates all 180 release batch tasks", async () => {
  const audit = await auditContentProduction({ contentRoot: path.join(projectRoot, "content/knowledge") });
  assert.equal(audit.summary.batchCount, 6);
  assert.equal(audit.summary.taskCount, 180);
  assert.equal(audit.summary.runnableJobs, 360);
  assert.equal(audit.summary.publicCandidates, 0);
  assert.deepEqual(audit.findings.filter((item) => item.severity === "blocker"), []);
  assert.ok(audit.findings.some((item) => item.code === "production-progress"));
});
