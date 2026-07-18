import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  productionManifestSchema,
  productionTaskSchema,
  sourceLeadSchema,
  workerResultSchema,
} from "./content-production-schema.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");
const artifactRoot = path.join(projectRoot, "artifacts", "production");
const scholarlyTypes = new Set([
  "scholarly-book",
  "peer-reviewed-article",
  "scholarly-encyclopedia",
  "archival-source",
]);

const identityPayloadSchema = z.object({
  originalName: z.string().min(1).nullable(),
  aliases: z.array(z.string().min(1)),
  chronology: z.object({
    label: z.string().min(1),
    startYear: z.number().int(),
    endYear: z.number().int(),
    certainty: z.enum(["established", "approximate", "disputed"]),
    note: z.string().min(1).nullable(),
  }),
});

const sourceDiscoveryPayloadSchema = z.object({
  sourceLeads: z.array(sourceLeadSchema).min(1),
}).superRefine(({ sourceLeads }, context) => {
  if (sourceLeads.some((source) => source.verification.status !== "pending")) {
    context.addIssue({ code: "custom", path: ["sourceLeads"], message: "discovery may only create pending source leads" });
  }
});

const sourceVerificationPayloadSchema = z.object({
  sourceLeads: z.array(sourceLeadSchema).min(1),
});

const draftPayloadSchema = z.object({
  guidingQuestion: z.string().min(1),
  thesis: z.string().min(1),
  summary: z.string().min(80).max(180),
  proposedConcepts: z.array(z.string().min(1)).min(1),
  proposedWorks: z.array(z.string().min(1)),
  proposedPlaces: z.array(z.string().min(1)).min(1),
  claims: z.array(z.object({
    claimTaskId: z.string().min(1),
    claim: z.string().min(1),
  })).min(1),
});

const citationPayloadSchema = z.object({
  citations: z.array(z.object({
    claimTaskId: z.string().min(1),
    sourceLeadId: z.string().min(1),
    locator: z.string().min(1),
  })).min(1),
});

const completedReviewSchema = z.object({
  status: z.enum(["passed", "failed"]),
  notes: z.array(z.string().min(1)).min(1),
});

const reviewPayloadSchema = z.object({
  crossCulturalBias: completedReviewSchema,
  counterEvidence: completedReviewSchema,
  attributionAndUncertainty: completedReviewSchema,
});

const assemblyPayloadSchema = z.object({
  decision: z.literal("ready-for-promotion"),
  notes: z.array(z.string().min(1)).min(1),
});

const payloadSchemas = {
  "identity-and-chronology": identityPayloadSchema,
  "source-discovery": sourceDiscoveryPayloadSchema,
  "source-verification": sourceVerificationPayloadSchema,
  "index-draft": draftPayloadSchema,
  "citation-location": citationPayloadSchema,
  "bias-and-counterevidence": reviewPayloadSchema,
  "editorial-assembly": assemblyPayloadSchema,
};

const stageInstructions = {
  "identity-and-chronology": "核验姓名、别名、生卒或活动年代。明确 established、approximate 或 disputed，禁止用传说填补未知信息。",
  "source-discovery": "发现原典、可靠译本、同行评审研究、学术专著或专家百科。这里只登记待核验来源，不撰写哲学主张。",
  "source-verification": "逐项核验题名、作者、出版信息和URL/DOI/ISBN；参考数据集不能单独支撑哲学观点。",
  "index-draft": "依据已核验来源起草80–180字摘要、核心问题、论点、概念、作品和地点；不得创建未经证据支持的思想关系。",
  "citation-location": "为每项身份、年代、语境、论点、概念、作品和地点主张绑定已核验来源，并给出页码、章节、条目段落或稳定小节。",
  "bias-and-counterevidence": "检查跨文化分类偏差、反例、归属争议和不确定性；不能把相似术语默认视为同一概念。",
  "editorial-assembly": "确认所有自动门禁通过，只将任务标记为可形成candidate实体；不得改为published或进入公开生成物。",
};

const batchIdFor = (batchNumber) => `batch-${String(batchNumber).padStart(2, "0")}`;
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

function verifiedSources(task) {
  return task.research.sourceLeads.filter((source) => source.verification.status === "verified");
}

function sourceHasIdentifier(source) {
  return Boolean(source.identifiers.url || source.identifiers.doi || source.identifiers.isbn);
}

function validateSourceGate(task) {
  const verified = verifiedSources(task);
  const independentScholarly = verified.filter((source) => scholarlyTypes.has(source.sourceType));
  const failures = [];
  if (verified.length < task.research.sourceRequirements.minimumVerifiedSources) failures.push("insufficient verified sources");
  if (independentScholarly.length < task.research.sourceRequirements.minimumIndependentScholarlySources) failures.push("insufficient independent scholarly sources");
  if (verified.some((source) => !sourceHasIdentifier(source))) failures.push("verified source lacks URL, DOI, or ISBN");
  if (verified.some((source) => !source.verification.method || !source.verification.checkedAt)) failures.push("verified source lacks verification provenance");
  if (verified.length > 0 && verified.every((source) => source.sourceType === "reference-dataset")) failures.push("reference datasets cannot stand alone");
  return failures;
}

function jobById(task, stage) {
  const job = task.workflow.jobs.find((item) => item.id === stage);
  if (!job) throw new Error(`${task.candidateId} is missing job ${stage}.`);
  return job;
}

export function runnableJobs(taskInput) {
  const task = productionTaskSchema.parse(taskInput);
  return task.workflow.jobs.filter((job) =>
    job.status === "pending"
    && job.dependsOn.every((dependency) => jobById(task, dependency).status === "passed"),
  );
}

function assertUniquePayloadIds(items, label) {
  const ids = items.map((item) => item.id ?? item.claimTaskId);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate ids.`);
}

function applyPassedPayload(task, stage, payload) {
  if (stage === "identity-and-chronology") {
    task.identity.originalName = payload.originalName;
    task.identity.aliases = [...new Set(payload.aliases)];
    task.draft.chronology = payload.chronology;
  }
  if (stage === "source-discovery" || stage === "source-verification") {
    assertUniquePayloadIds(payload.sourceLeads, `${stage} source leads`);
    task.research.sourceLeads = payload.sourceLeads;
    if (stage === "source-verification") {
      const failures = validateSourceGate(task);
      if (failures.length) throw new Error(`${task.candidateId} source gate failed: ${failures.join("; ")}.`);
    }
  }
  if (stage === "index-draft") {
    const knownClaims = new Map(task.research.claimTasks.map((claim) => [claim.id, claim]));
    assertUniquePayloadIds(payload.claims, "draft claims");
    for (const draftClaim of payload.claims) {
      const claim = knownClaims.get(draftClaim.claimTaskId);
      if (!claim) throw new Error(`Unknown claim task ${draftClaim.claimTaskId}.`);
      claim.claim = draftClaim.claim;
    }
    if ([...knownClaims.values()].some((claim) => !claim.claim)) throw new Error("Index draft must address every claim task.");
    Object.assign(task.draft, {
      guidingQuestion: payload.guidingQuestion,
      thesis: payload.thesis,
      summary: payload.summary,
      proposedConcepts: [...new Set(payload.proposedConcepts)],
      proposedWorks: [...new Set(payload.proposedWorks)],
      proposedPlaces: [...new Set(payload.proposedPlaces)],
    });
  }
  if (stage === "citation-location") {
    const claims = new Map(task.research.claimTasks.map((claim) => [claim.id, claim]));
    const sources = new Map(verifiedSources(task).map((source) => [source.id, source]));
    assertUniquePayloadIds(payload.citations, "citation assignments");
    for (const citation of payload.citations) {
      const claim = claims.get(citation.claimTaskId);
      if (!claim) throw new Error(`Unknown claim task ${citation.claimTaskId}.`);
      if (!sources.has(citation.sourceLeadId)) throw new Error(`${citation.sourceLeadId} is not a verified source.`);
      claim.status = "supported";
      claim.sourceLeadId = citation.sourceLeadId;
      claim.locator = citation.locator;
    }
    if ([...claims.values()].some((claim) => claim.status !== "supported" || !claim.locator)) {
      throw new Error("Every claim task requires a verified source and locator.");
    }
  }
  if (stage === "bias-and-counterevidence") {
    for (const [key, value] of Object.entries(payload)) {
      task.review[key].status = value.status;
      task.review[key].notes = value.notes;
    }
    if (Object.values(task.review).some((check) => check.status !== "passed")) {
      throw new Error("Bias, counterevidence, and attribution reviews must all pass.");
    }
  }
}

export function evaluatePromotionReadiness(taskInput, { includeFinalJob = true } = {}) {
  const task = productionTaskSchema.parse(taskInput);
  const failures = [...validateSourceGate(task)];
  const jobs = includeFinalJob
    ? task.workflow.jobs
    : task.workflow.jobs.filter((job) => job.id !== "editorial-assembly");
  if (jobs.some((job) => job.status !== "passed")) failures.push("workflow jobs remain incomplete");
  if (!task.draft.chronology || !task.draft.guidingQuestion || !task.draft.thesis || !task.draft.summary) failures.push("index draft is incomplete");
  if (task.draft.proposedConcepts.length < 1 || task.draft.proposedPlaces.length < 1) failures.push("concept or place proposal is missing");
  if (task.research.claimTasks.some((claim) => claim.status !== "supported" || !claim.sourceLeadId || !claim.locator)) failures.push("claims lack located citations");
  if (Object.values(task.review).some((check) => check.status !== "passed")) failures.push("editorial review checks remain incomplete");
  if (task.target.publicVisibility !== false || task.target.editorialStatus !== "candidate") failures.push("candidate isolation policy changed");
  return [...new Set(failures)];
}

function workflowStatusAfter(stage) {
  if (stage === "identity-and-chronology" || stage === "source-discovery") return "researching";
  if (stage === "source-verification") return "drafting";
  if (stage === "index-draft" || stage === "citation-location") return "evidence-review";
  if (stage === "bias-and-counterevidence") return "editorial-review";
  return "ready-for-promotion";
}

export function applyWorkerResult(taskInput, resultInput) {
  const task = structuredClone(productionTaskSchema.parse(taskInput));
  const result = workerResultSchema.parse(resultInput);
  if (task.batchId !== result.batchId || task.candidateId !== result.candidateId) throw new Error("Worker result does not belong to this task.");
  const job = jobById(task, result.stage);
  if (job.status !== "pending") throw new Error(`${result.stage} is not pending.`);
  if (!runnableJobs(task).some((candidate) => candidate.id === result.stage)) throw new Error(`${result.stage} dependencies are incomplete.`);
  if (job.attempts >= job.maxAttempts) throw new Error(`${result.stage} has exhausted its retry budget.`);

  job.attempts += 1;
  if (result.outcome === "failed") {
    job.status = "failed";
    job.lastError = result.error;
    task.workflow.status = "blocked";
    task.workflow.revision += 1;
    return productionTaskSchema.parse(task);
  }

  const payload = payloadSchemas[result.stage].parse(result.payload ?? {});
  applyPassedPayload(task, result.stage, payload);
  if (result.stage === "editorial-assembly") {
    const failures = evaluatePromotionReadiness(task, { includeFinalJob: false });
    if (failures.length) throw new Error(`${task.candidateId} promotion gate failed: ${failures.join("; ")}.`);
  }
  job.status = "passed";
  job.lastError = null;
  task.workflow.status = workflowStatusAfter(result.stage);
  task.workflow.revision += 1;
  return productionTaskSchema.parse(task);
}

export function retryFailedJobs(taskInput) {
  const task = structuredClone(productionTaskSchema.parse(taskInput));
  let retried = 0;
  for (const job of task.workflow.jobs) {
    if (job.status !== "failed" || !job.lastError?.retryable || job.attempts >= job.maxAttempts) continue;
    job.status = "pending";
    job.lastError = null;
    retried += 1;
  }
  if (retried > 0) {
    task.workflow.status = "researching";
    task.workflow.revision += 1;
  }
  return { task: productionTaskSchema.parse(task), retried };
}

export function buildWorkerQueue(tasks, { limit = Number.POSITIVE_INFINITY } = {}) {
  const packets = [];
  for (const taskInput of tasks) {
    const task = productionTaskSchema.parse(taskInput);
    for (const job of runnableJobs(task)) {
      packets.push({
        schemaVersion: 1,
        batchId: task.batchId,
        candidateId: task.candidateId,
        proposedPersonId: task.proposedPersonId,
        stage: job.id,
        attempt: job.attempts + 1,
        instruction: stageInstructions[job.id],
        context: {
          identity: task.identity,
          coverage: task.coverage,
          target: task.target,
          discoveryQueries: task.research.discoveryQueries,
          sourceRequirements: task.research.sourceRequirements,
          sourceLeads: task.research.sourceLeads,
          claimTasks: task.research.claimTasks,
          draft: task.draft,
          review: task.review,
        },
        resultContract: {
          outcome: "passed|failed",
          worker: "必须明确自动工作者身份",
          payload: `必须满足 ${job.id} 阶段结构；不得返回published状态`,
          error: "失败时包含code、message、retryable",
        },
        guardrails: [
          "只使用可追溯来源，不把搜索摘要当作证据。",
          "不创建没有可定位引用的思想关系。",
          "不得把任务推进为published或进入公开索引。",
        ],
      });
    }
  }
  return packets
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId) || left.stage.localeCompare(right.stage))
    .slice(0, limit);
}

export function summarizeBatch(tasks) {
  const parsed = tasks.map((task) => productionTaskSchema.parse(task));
  const workflowStatuses = {};
  const jobStatuses = {};
  let runnable = 0;
  let exhausted = 0;
  for (const task of parsed) {
    workflowStatuses[task.workflow.status] = (workflowStatuses[task.workflow.status] ?? 0) + 1;
    runnable += runnableJobs(task).length;
    for (const job of task.workflow.jobs) {
      jobStatuses[job.status] = (jobStatuses[job.status] ?? 0) + 1;
      if (job.status === "failed" && job.attempts >= job.maxAttempts) exhausted += 1;
    }
  }
  return {
    taskCount: parsed.length,
    workflowStatuses,
    jobStatuses,
    runnableJobs: runnable,
    exhaustedJobs: exhausted,
    readyForPromotion: parsed.filter((task) => evaluatePromotionReadiness(task).length === 0).length,
    publicCandidates: parsed.filter((task) => task.target.publicVisibility).length,
  };
}

export async function readProductionBatch(batchNumber) {
  const batchId = batchIdFor(batchNumber);
  const batchRoot = path.join(contentRoot, "production", "batches", batchId);
  const manifest = productionManifestSchema.parse(JSON.parse(await readFile(path.join(batchRoot, "manifest.json"), "utf8")));
  const taskRoot = path.join(batchRoot, "tasks");
  const files = (await readdir(taskRoot)).filter((file) => file.endsWith(".json")).sort();
  const tasks = await Promise.all(files.map(async (file) => productionTaskSchema.parse(JSON.parse(await readFile(path.join(taskRoot, file), "utf8")))));
  if (tasks.length !== manifest.candidateCount) throw new Error(`${batchId} manifest/task count mismatch.`);
  if (tasks.some((task) => !manifest.candidateIds.includes(task.candidateId))) throw new Error(`${batchId} contains a task outside its manifest.`);
  return { batchId, batchRoot, manifest, tasks };
}

async function writeTask(batchRoot, task) {
  await writeFile(path.join(batchRoot, "tasks", `${task.candidateId}.json`), jsonText(task));
}

function markdownReport(batchId, summary) {
  return [
    `# ${batchId} 自动内容生产报告`,
    "",
    `- 候选任务：${summary.taskCount}`,
    `- 当前可执行工作：${summary.runnableJobs}`,
    `- 可进入candidate实体装配：${summary.readyForPromotion}`,
    `- 重试耗尽：${summary.exhaustedJobs}`,
    `- 公开候选泄漏：${summary.publicCandidates}`,
    "",
    "## 工作流状态",
    "",
    ...Object.entries(summary.workflowStatuses).map(([status, count]) => `- ${status}: ${count}`),
    "",
    "## 工作项状态",
    "",
    ...Object.entries(summary.jobStatuses).map(([status, count]) => `- ${status}: ${count}`),
    "",
    "自动流程只能准备candidate；不得发布、合并main或部署。",
    "",
  ].join("\n");
}

async function writeArtifacts(batchId, tasks, queueLimit) {
  const summary = summarizeBatch(tasks);
  const queue = buildWorkerQueue(tasks, { limit: queueLimit });
  const root = path.join(artifactRoot, batchId);
  await mkdir(root, { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "queue.json"), jsonText({ schemaVersion: 1, batchId, jobCount: queue.length, jobs: queue })),
    writeFile(path.join(root, "latest.json"), jsonText({ schemaVersion: 1, batchId, summary })),
    writeFile(path.join(root, "latest.md"), markdownReport(batchId, summary)),
  ]);
  return { summary, queue };
}

function argumentValue(argv, key) {
  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const batchNumber = Number(argumentValue(argv, "--batch") ?? 1);
  if (!Number.isInteger(batchNumber) || batchNumber < 1 || batchNumber > 7) throw new Error("--batch must be an integer from 1 to 7.");
  const batch = await readProductionBatch(batchNumber);
  let tasks = batch.tasks;

  const resultFile = argumentValue(argv, "--apply");
  if (resultFile) {
    const raw = JSON.parse(await readFile(path.resolve(resultFile), "utf8"));
    const results = Array.isArray(raw) ? raw : raw.results;
    if (!Array.isArray(results)) throw new Error("Worker result file must be an array or contain a results array.");
    const byCandidate = new Map(tasks.map((task) => [task.candidateId, task]));
    for (const result of results) {
      const current = byCandidate.get(result.candidateId);
      if (!current) throw new Error(`Unknown candidate ${result.candidateId}.`);
      byCandidate.set(result.candidateId, applyWorkerResult(current, result));
    }
    tasks = [...byCandidate.values()].sort((left, right) => left.candidateId.localeCompare(right.candidateId));
    await Promise.all(tasks.map((task) => writeTask(batch.batchRoot, task)));
    console.log(`Applied ${results.length} worker result(s) to ${batch.batchId}.`);
  }

  if (argv.includes("--retry")) {
    let retried = 0;
    tasks = tasks.map((task) => {
      const result = retryFailedJobs(task);
      retried += result.retried;
      return result.task;
    });
    if (retried) await Promise.all(tasks.map((task) => writeTask(batch.batchRoot, task)));
    console.log(`Reset ${retried} retryable failed job(s).`);
  }

  const limit = Number(argumentValue(argv, "--limit") ?? Number.POSITIVE_INFINITY);
  const artifacts = await writeArtifacts(batch.batchId, tasks, Number.isFinite(limit) ? limit : Number.POSITIVE_INFINITY);
  console.log(`${batch.batchId}: ${artifacts.summary.taskCount} tasks, ${artifacts.summary.runnableJobs} runnable jobs, ${artifacts.summary.readyForPromotion} ready for promotion.`);
  console.log(`Queue contains ${artifacts.queue.length} job packet(s).`);
}
