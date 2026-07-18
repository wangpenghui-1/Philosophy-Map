import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  coverageCandidateSchema,
  productionManifestSchema,
  productionStages,
  productionTaskSchema,
} from "./content-production-schema.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultContentRoot = path.join(projectRoot, "content", "knowledge");

const jobDependencies = {
  "identity-and-chronology": [],
  "source-discovery": [],
  "source-verification": ["source-discovery"],
  "index-draft": ["identity-and-chronology", "source-verification"],
  "citation-location": ["index-draft"],
  "bias-and-counterevidence": ["citation-location"],
  "editorial-assembly": ["bias-and-counterevidence"],
};

const batchIdFor = (batchNumber) => `batch-${String(batchNumber).padStart(2, "0")}`;
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function slugifyCandidateName(name) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Cannot derive a stable person id from ${name}.`);
  return slug;
}

function countsBy(items, key) {
  return Object.fromEntries(
    [...new Set(items.map((item) => item[key]))]
      .sort((left, right) => left.localeCompare(right, "zh-CN"))
      .map((value) => [value, items.filter((item) => item[key] === value).length]),
  );
}

export function validateBatchSelection(candidates, rules) {
  const regionCounts = countsBy(candidates, "primaryRegion");
  const eraCounts = countsBy(candidates, "era");
  const maximumSingleRegionShare = Math.max(...Object.values(regionCounts)) / candidates.length;
  const failures = [];
  if (candidates.length !== rules.approximateBatchSize) failures.push(`expected ${rules.approximateBatchSize} candidates, received ${candidates.length}`);
  if (Object.keys(regionCounts).length < rules.minimumRegionsPerBatch) failures.push("insufficient region diversity");
  if (Object.keys(eraCounts).length < rules.minimumErasPerBatch) failures.push("insufficient era diversity");
  if (maximumSingleRegionShare > rules.maximumSingleRegionShare) failures.push("single-region share exceeds the batch limit");
  if (failures.length) throw new Error(`Batch coverage validation failed: ${failures.join("; ")}.`);
  return { regionCounts, eraCounts, maximumSingleRegionShare };
}

function initialJobs() {
  return productionStages.map((id) => ({
    id,
    status: "pending",
    dependsOn: jobDependencies[id],
    attempts: 0,
    maxAttempts: 3,
    lastResultId: null,
    lastError: null,
  }));
}

function initialClaimTasks(candidate) {
  return [
    ["identity", "identity", `核验${candidate.name}的姓名形式、别名与身份归属。`],
    ["chronology", "chronology", `核验${candidate.name}的生卒或活动年代，并记录不确定性。`],
    ["context", "context", `说明${candidate.name}所处的历史语境与“${candidate.tradition}”的关系。`],
    ["core-thesis", "thesis", `用可核查来源概括${candidate.name}最具代表性的哲学主张。`],
    ["core-concept", "concept", `确定至少一个不能被跨传统相似术语直接替代的核心概念。`],
    ["representative-work", "work", `核验代表著作、文本归属或无可归属作品的原因。`],
    ["primary-place", "place", `核验主要活动地点及历史名称与现代参照。`],
  ].map(([id, claimType, prompt]) => ({
    id,
    claimType,
    prompt,
    status: "pending",
    claim: null,
    sourceLeadId: null,
    locator: null,
  }));
}

export function createProductionTask(candidateInput) {
  const candidate = coverageCandidateSchema.parse(candidateInput);
  const batchId = batchIdFor(candidate.batch);
  return productionTaskSchema.parse({
    schemaVersion: 1,
    workflowVersion: "index-candidate/v1",
    batchId,
    candidateId: candidate.id,
    proposedPersonId: slugifyCandidateName(candidate.englishName),
    identity: {
      displayName: candidate.name,
      englishName: candidate.englishName,
      originalName: null,
      aliases: [],
    },
    coverage: {
      primaryRegion: candidate.primaryRegion,
      era: candidate.era,
      tradition: candidate.tradition,
      selectionReason: candidate.selectionReason,
      gapTags: candidate.gapTags,
    },
    target: {
      contentTier: candidate.expectedTier,
      editorialStatus: "candidate",
      publicVisibility: false,
    },
    workflow: {
      status: "research-planned",
      revision: 1,
      jobs: initialJobs(),
    },
    research: {
      discoveryQueries: [
        `${candidate.englishName} philosophy scholarly encyclopedia`,
        `${candidate.englishName} primary texts bibliography`,
        `${candidate.englishName} peer reviewed philosophy`,
        `${candidate.name} 哲学 学术研究 原典`,
      ],
      sourceRequirements: {
        minimumVerifiedSources: 1,
        minimumIndependentScholarlySources: 1,
        primaryTextPreferred: true,
        referenceDatasetMayStandAlone: false,
      },
      sourceLeads: [],
      claimTasks: initialClaimTasks(candidate),
    },
    draft: {
      chronology: null,
      guidingQuestion: null,
      thesis: null,
      summary: null,
      proposedConcepts: [],
      proposedWorks: [],
      proposedPlaces: [],
    },
    review: {
      crossCulturalBias: {
        status: "pending",
        questions: [
          "条目是否使用该传统自身的概念语境，而非直接套用欧洲哲学分类？",
          "中文译名与原文术语是否明确区分同名异义？",
        ],
        notes: [],
      },
      counterEvidence: {
        status: "pending",
        questions: [
          "是否检索了对核心归属、年代或主张的反例和学术争议？",
          "摘要是否把有争议的解释误写成定论？",
        ],
        notes: [],
      },
      attributionAndUncertainty: {
        status: "pending",
        questions: [
          "年代、作品归属、地点和形象真实性是否分别记录确定性？",
          "是否避免把后世传说或生成形象描述为历史事实？",
        ],
        notes: [],
      },
    },
  });
}

export function createBatchManifest(batchNumber, candidates, coverageRules) {
  const batchId = batchIdFor(batchNumber);
  const coverage = validateBatchSelection(candidates, coverageRules);
  return productionManifestSchema.parse({
    schemaVersion: 1,
    workflowVersion: "index-candidate/v1",
    batchId,
    batchNumber,
    status: "prepared",
    candidateCount: 30,
    candidateIds: candidates.map((candidate) => candidate.id),
    coverage,
    gates: {
      minimumRegions: coverageRules.minimumRegionsPerBatch,
      minimumEras: coverageRules.minimumErasPerBatch,
      maximumSingleRegionShare: coverageRules.maximumSingleRegionShare,
      requireLocatorForEveryClaim: true,
      automaticPublicationAllowed: false,
    },
    generatedBy: "content-batch-preparer/v1",
  });
}

function assertTaskMatchesCandidate(task, candidate) {
  const expected = createProductionTask(candidate);
  const immutablePaths = [
    ["batchId"], ["candidateId"], ["proposedPersonId"], ["identity", "displayName"],
    ["identity", "englishName"], ["coverage", "primaryRegion"], ["coverage", "era"],
    ["coverage", "tradition"], ["coverage", "selectionReason"], ["target", "contentTier"],
  ];
  for (const keys of immutablePaths) {
    const actualValue = keys.reduce((value, key) => value[key], task);
    const expectedValue = keys.reduce((value, key) => value[key], expected);
    if (actualValue !== expectedValue) throw new Error(`${candidate.id} production metadata drifted at ${keys.join(".")}.`);
  }
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function prepareContentBatch({ batchNumber, contentRoot = defaultContentRoot, write = false }) {
  const coverageFile = path.join(contentRoot, "coverage", "people.json");
  const coveragePlan = JSON.parse(await readFile(coverageFile, "utf8"));
  const candidates = coveragePlan.candidates
    .filter((candidate) => candidate.batch === batchNumber)
    .map((candidate) => coverageCandidateSchema.parse(candidate));
  const batchId = batchIdFor(batchNumber);
  const batchRoot = path.join(contentRoot, "production", "batches", batchId);
  const tasksRoot = path.join(batchRoot, "tasks");
  const manifest = createBatchManifest(batchNumber, candidates, coveragePlan.batchRules);
  const changes = [];

  const existingManifest = await readJsonIfPresent(path.join(batchRoot, "manifest.json"));
  if (!existingManifest || jsonText(productionManifestSchema.parse(existingManifest)) !== jsonText(manifest)) {
    changes.push(path.join(batchRoot, "manifest.json"));
    if (write) {
      await mkdir(batchRoot, { recursive: true });
      await writeFile(path.join(batchRoot, "manifest.json"), jsonText(manifest));
    }
  }

  for (const candidate of candidates) {
    const file = path.join(tasksRoot, `${candidate.id}.json`);
    const existing = await readJsonIfPresent(file);
    if (existing) {
      const task = productionTaskSchema.parse(existing);
      assertTaskMatchesCandidate(task, candidate);
      if (jsonText(task) !== jsonText(existing)) {
        changes.push(file);
        if (write) await writeFile(file, jsonText(task));
      }
      continue;
    }
    changes.push(file);
    if (write) {
      await mkdir(tasksRoot, { recursive: true });
      await writeFile(file, jsonText(createProductionTask(candidate)));
    }
  }

  try {
    const expectedFiles = new Set(candidates.map((candidate) => `${candidate.id}.json`));
    const extraFiles = (await readdir(tasksRoot)).filter((file) => file.endsWith(".json") && !expectedFiles.has(file));
    if (extraFiles.length) throw new Error(`${batchId} contains unexpected task files: ${extraFiles.join(", ")}.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return { batchId, candidates, manifest, changes };
}

function parseBatchNumber(argv) {
  const index = argv.indexOf("--batch");
  const value = index >= 0 ? Number(argv[index + 1]) : 1;
  if (!Number.isInteger(value) || value < 1 || value > 7) throw new Error("--batch must be an integer from 1 to 7.");
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes("--write");
  const result = await prepareContentBatch({ batchNumber: parseBatchNumber(process.argv.slice(2)), write });
  if (result.changes.length) {
    console.log(`${write ? "Prepared" : "Required"} ${result.batchId}: ${result.changes.length} file(s) ${write ? "written" : "missing or stale"}.`);
    result.changes.slice(0, 12).forEach((file) => console.log(`- ${path.relative(projectRoot, file)}`));
    if (!write) process.exitCode = 1;
  } else {
    console.log(`${result.batchId} production scaffold is complete and stable.`);
  }
}
