import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { productionTaskSchema } from "../scripts/content-production-schema.mjs";
import {
  createBatchManifest,
  createProductionTask,
  slugifyCandidateName,
} from "../scripts/prepare-content-batch.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coverage = JSON.parse(await readFile(path.join(projectRoot, "content/knowledge/coverage/people.json"), "utf8"));
const batchOne = coverage.candidates.filter((candidate) => candidate.batch === 1);

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
