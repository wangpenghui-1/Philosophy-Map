import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { productionManifestSchema, productionTaskSchema } from "./content-production-schema.mjs";
import { evaluatePromotionReadiness, runnableJobs, summarizeBatch } from "./content-batch-runner.mjs";

function finding(severity, code, message, records = []) {
  return {
    severity,
    code,
    message,
    count: records.length,
    samples: records.slice(0, 10).map((record) => record.candidateId ?? record.id ?? record),
  };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readBatch(contentRoot, directory) {
  const root = path.join(contentRoot, "production", "batches", directory);
  const manifest = productionManifestSchema.parse(await readJson(path.join(root, "manifest.json")));
  const taskRoot = path.join(root, "tasks");
  const files = (await readdir(taskRoot)).filter((file) => file.endsWith(".json")).sort();
  const tasks = await Promise.all(files.map(async (file) => productionTaskSchema.parse(await readJson(path.join(taskRoot, file)))));
  return { manifest, tasks };
}

export async function auditContentProduction({ contentRoot }) {
  const findings = [];
  const coverage = await readJson(path.join(contentRoot, "coverage", "people.json"));
  const candidatePool = [
    ...(coverage.candidates ?? []),
    ...(coverage.releaseCandidates ?? []),
    ...(coverage.archivedRoadmap?.candidates ?? []),
  ];
  const candidateById = new Map(candidatePool.map((candidate) => [candidate.id, candidate]));
  const releaseManifest = await readJson(path.join(contentRoot, "coverage", "release-210.json"));
  const releasedCandidateIds = new Set(releaseManifest.members.map((member) => member.candidateId));
  const people = await Promise.all(
    (await readdir(path.join(contentRoot, "people")))
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson(path.join(contentRoot, "people", file))),
  );
  const existingPersonIds = new Set(people.map((person) => person.id));
  const existingPersonSlugs = new Set(people.map((person) => person.slug));
  const batchesRoot = path.join(contentRoot, "production", "batches");
  let batchDirectories = [];
  try {
    batchDirectories = (await readdir(batchesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^batch-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (batchDirectories.length === 0) {
    findings.push(finding("blocker", "production-batch-missing", "至少需要一个经过验证的内容生产批次。"));
    return { summary: { batchCount: 0, taskCount: 0 }, findings };
  }

  const batches = await Promise.all(batchDirectories.map((directory) => readBatch(contentRoot, directory)));
  const tasks = batches.flatMap((batch) => batch.tasks);
  const taskIds = tasks.map((task) => task.candidateId);
  const duplicateTaskIds = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
  if (duplicateTaskIds.length) findings.push(finding("blocker", "production-task-duplicate", "候选生产任务ID必须跨批次唯一。", [...new Set(duplicateTaskIds)]));

  const manifestFailures = [];
  for (const { manifest, tasks: batchTasks } of batches) {
    const actualIds = batchTasks.map((task) => task.candidateId).sort();
    const expectedIds = [...manifest.candidateIds].sort();
    if (batchTasks.length !== manifest.candidateCount || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) manifestFailures.push(manifest.batchId);
  }
  if (manifestFailures.length) findings.push(finding("blocker", "production-manifest-mismatch", "批次清单与独立任务文件不一致。", manifestFailures));

  const coverageFailures = tasks.filter((task) => {
    const candidate = candidateById.get(task.candidateId);
    return !candidate
      || candidate.batch !== Number(task.batchId.slice(-2))
      || candidate.name !== task.identity.displayName
      || candidate.englishName !== task.identity.englishName
      || candidate.primaryRegion !== task.coverage.primaryRegion
      || candidate.era !== task.coverage.era
      || candidate.tradition !== task.coverage.tradition;
  });
  if (coverageFailures.length) findings.push(finding("blocker", "production-coverage-drift", "生产任务与其覆盖批次记录发生偏移。", coverageFailures));

  const publicLeaks = tasks.filter((task) => task.target.publicVisibility || task.target.editorialStatus !== "candidate");
  if (publicLeaks.length) findings.push(finding("blocker", "production-candidate-leak", "研究任务只能保持私有candidate状态。", publicLeaks));

  const personIdCollisions = tasks.filter((task) =>
    !releasedCandidateIds.has(task.candidateId)
    && (existingPersonIds.has(task.proposedPersonId) || existingPersonSlugs.has(task.proposedPersonId)),
  );
  const proposedIds = tasks.map((task) => task.proposedPersonId);
  const duplicateProposedIds = proposedIds.filter((id, index) => proposedIds.indexOf(id) !== index);
  if (personIdCollisions.length || duplicateProposedIds.length) {
    findings.push(finding("blocker", "production-person-id-collision", "候选人物ID不得与公开人物或同批候选冲突。", [
      ...personIdCollisions,
      ...[...new Set(duplicateProposedIds)],
    ]));
  }

  const workflowFailures = [];
  const exhausted = [];
  const invalidVerifiedSources = [];
  const prematureReady = [];
  for (const task of tasks) {
    for (const job of task.workflow.jobs) {
      if (job.attempts > job.maxAttempts) workflowFailures.push(task);
      if (job.status === "passed" && job.dependsOn.some((dependency) => task.workflow.jobs.find((candidate) => candidate.id === dependency)?.status !== "passed")) workflowFailures.push(task);
      if (job.status === "failed" && job.attempts >= job.maxAttempts) exhausted.push(task);
    }
    const sourceIds = task.research.sourceLeads.map((source) => source.id);
    if (new Set(sourceIds).size !== sourceIds.length) workflowFailures.push(task);
    for (const source of task.research.sourceLeads.filter((candidate) => candidate.verification.status === "verified")) {
      if (!source.verification.method || !source.verification.checkedAt || !(source.identifiers.url || source.identifiers.doi || source.identifiers.isbn)) invalidVerifiedSources.push(task);
    }
    if (task.workflow.status === "ready-for-promotion" && evaluatePromotionReadiness(task).length) prematureReady.push(task);
    runnableJobs(task);
  }
  if (workflowFailures.length) findings.push(finding("blocker", "production-workflow-invalid", "生产任务依赖、尝试次数或来源ID状态无效。", workflowFailures));
  if (invalidVerifiedSources.length) findings.push(finding("blocker", "production-source-verification-invalid", "已核验来源缺少核验方法、时间或稳定标识符。", invalidVerifiedSources));
  if (prematureReady.length) findings.push(finding("blocker", "production-premature-promotion", "未通过全部来源、引用和编辑门禁的任务不能进入装配。", prematureReady));
  if (exhausted.length) findings.push(finding("warning", "production-retry-exhausted", "部分工作项已耗尽自动重试预算，需要进入阻断报告。", exhausted));

  const stateSummary = summarizeBatch(tasks);
  findings.push(finding(
    "info",
    "production-progress",
    `${tasks.length}个候选任务中，${stateSummary.runnableJobs}个工作项可执行，${stateSummary.readyForPromotion}个已通过装配门禁。`,
    tasks,
  ));
  return {
    summary: {
      batchCount: batches.length,
      ...stateSummary,
    },
    findings,
  };
}
