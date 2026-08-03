import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { auditContentProduction } from "./content-production-audit.mjs";

const entityDirectories = ["people", "concepts", "traditions", "works", "contexts", "places", "sources", "relations"];
const sourceQuality = {
  "primary-text": 5,
  "peer-reviewed-article": 5,
  "scholarly-book": 4,
  "archival-source": 4,
  "scholarly-encyclopedia": 3,
  "reference-dataset": 1,
};

async function readEntities(contentRoot) {
  const all = {};
  for (const directory of entityDirectories) {
    const absoluteDirectory = path.join(contentRoot, directory);
    const files = (await readdir(absoluteDirectory)).filter((file) => file.endsWith(".json")).sort();
    all[directory] = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(absoluteDirectory, file), "utf8"))));
  }
  return all;
}

function citationsOf(record) {
  const citations = [...(record.citations ?? [])];
  for (const section of record.sections ?? []) {
    for (const paragraph of section.paragraphs ?? []) citations.push(...(paragraph.citations ?? []));
  }
  for (const sense of record.senses ?? []) citations.push(...(sense.citations ?? []));
  return citations;
}

function finding(severity, code, message, records = []) {
  return { severity, code, message, count: records.length, samples: records.slice(0, 10).map((record) => record.id ?? record) };
}

export async function auditKnowledgeBase({ contentRoot, generatedRoot }) {
  const all = await readEntities(contentRoot);
  const findings = [];
  const sources = new Map(all.sources.map((source) => [source.id, source]));
  const records = Object.values(all).flat();
  const published = records.filter((record) => record.editorialStatus === "published");
  const candidates = records.filter((record) => record.editorialStatus === "candidate");

  const ids = new Map();
  for (const record of records) {
    const owners = ids.get(record.id) ?? [];
    owners.push(record.entityType);
    ids.set(record.id, owners);
  }
  const duplicateIds = [...ids.entries()].filter(([, owners]) => owners.length > 1).map(([id]) => id);
  if (duplicateIds.length) findings.push(finding("blocker", "duplicate-id", "实体ID必须全局唯一。", duplicateIds));

  const missingReviewIdentity = published.filter((record) => !record.reviewedBy || !record.lastReviewedAt);
  if (missingReviewIdentity.length) findings.push(finding("blocker", "missing-review-metadata", "已发布实体缺少复核身份或日期。", missingReviewIdentity));
  const ambiguousReviewIdentity = published.filter((record) => record.reviewedBy && !/automated|human|scholar|editor|review/i.test(record.reviewedBy));
  if (ambiguousReviewIdentity.length) findings.push(finding("warning", "ambiguous-review-identity", "复核身份未明确区分自动或人工复核。", ambiguousReviewIdentity));

  const allCitations = records.flatMap((record) => citationsOf(record).map((citation) => ({ record, citation })));
  const invalidCitations = allCitations.filter(({ citation }) => !sources.has(citation.sourceId) || !citation.locator?.trim() || !citation.claim?.trim());
  if (invalidCitations.length) findings.push(finding("blocker", "invalid-citation", "引用必须指向有效来源并包含定位与主张。", invalidCitations.map(({ record }) => record)));
  const genericClaims = allCitations.filter(({ citation }) => /支持本条目|概述或关系说明|生平、思想概述/.test(citation.claim));
  if (genericClaims.length) findings.push(finding("warning", "generic-citation-claim", "部分引用主张过于通用，后续标准或深入条目应改为具体可核查主张。", genericClaims.map(({ record }) => record)));

  const authorlessSources = all.sources.filter((source) => source.authors.length === 0);
  if (authorlessSources.length) findings.push(finding("warning", "source-author-missing", "来源缺少作者或责任者元数据。", authorlessSources));
  const weakOnlyPeople = all.people.filter((person) => person.sourceIds.length > 0 && person.sourceIds.every((id) => (sourceQuality[sources.get(id)?.sourceType] ?? 0) <= 1));
  if (weakOnlyPeople.length) findings.push(finding("blocker", "weak-only-person-sources", "人物条目不能仅由参考数据集支撑。", weakOnlyPeople));

  const tierFailures = [];
  for (const person of published.filter((record) => record.entityType === "person")) {
    const textLength = person.sections.flatMap((section) => section.paragraphs).reduce((sum, paragraph) => sum + paragraph.text.length, 0);
    if (person.contentTier === "index" && (person.summary.length < 80 || person.summary.length > 180 || person.conceptIds.length < 1 || person.sourceIds.length < 1)) tierFailures.push(person);
    if (person.contentTier === "standard" && (textLength < 600 || textLength > 1500 || person.conceptIds.length < 3 || person.sourceIds.length < 2)) tierFailures.push(person);
    if (person.contentTier === "deep" && (textLength < 2500 || textLength > 6000 || person.sections.length < 4 || person.sourceIds.length < 4)) tierFailures.push(person);
  }
  if (tierFailures.length) findings.push(finding("blocker", "content-tier-failure", "已发布人物不满足其内容层级最低要求。", tierFailures));

  const mediaFailures = all.people.filter((person) => person.editorialStatus === "published" && (!person.media.credit || !person.media.rightsStatus || !person.media.authenticity || !person.media.presentationType || !person.media.depictionNote));
  if (mediaFailures.length) findings.push(finding("blocker", "media-governance-failure", "人物媒体缺少授权、真实性或呈现说明。", mediaFailures));
  const externalMediaFailures = all.people.filter((person) => person.editorialStatus === "published"
    && person.media.presentationType !== "placeholder"
    && person.media.rightsStatus !== "project-commissioned"
    && (!person.media.sourceUrl || !person.media.sourceFile || !person.media.license || !person.media.retrievedAt));
  if (externalMediaFailures.length) findings.push(finding("blocker", "external-media-provenance-failure", "外部人物形象缺少来源页面、文件名、许可或获取日期。", externalMediaFailures));
  const generatedMediaFailures = all.people.filter((person) => /AI辅助/u.test(person.media.credit ?? "")
    && (person.media.presentationType !== "stylized" || person.media.authenticity !== "interpretive" || !/不是历史照片/u.test(person.media.depictionNote)));
  if (generatedMediaFailures.length) findings.push(finding("blocker", "generated-media-label-failure", "AI辅助艺术形象必须明确标注为非历史照片和解释性呈现。", generatedMediaFailures));

  const relationFailures = all.relations.filter((relation) =>
    relation.citations.length === 0
    || (relation.relationType === "thematic-resonance" && relation.directed)
    || (relation.evidenceStatus === "disputed" && !relation.note),
  );
  if (relationFailures.length) findings.push(finding("blocker", "relation-evidence-failure", "思想关系不满足证据、方向性或争议说明规则。", relationFailures));

  const coverage = JSON.parse(await readFile(path.join(contentRoot, "coverage", "people.json"), "utf8"));
  const release = JSON.parse(await readFile(path.join(contentRoot, "coverage", "release-210.json"), "utf8"));
  const releasedPeople = new Map(all.people.map((person) => [person.id, person]));
  const releaseFailures = [];
  if (coverage.targetTotal !== 210 || coverage.publishedBaseline !== 210 || coverage.candidateCount !== 0 || coverage.candidates.length !== 0) releaseFailures.push("coverage-counts");
  if (Object.values(coverage.regionTargets).reduce((sum, count) => sum + count, 0) !== 210) releaseFailures.push("region-targets");
  if (Object.values(coverage.eraTargets).reduce((sum, count) => sum + count, 0) !== 210) releaseFailures.push("era-targets");
  if (release.baselinePeople !== 30 || release.addedPeople !== 180 || release.publicPeople !== 210 || release.members.length !== 180) releaseFailures.push("release-manifest");
  if (new Set(release.members.map((member) => member.personId)).size !== 180) releaseFailures.push("release-member-ids");
  if (release.members.some((member) => releasedPeople.get(member.personId)?.editorialStatus !== "published")) releaseFailures.push("release-member-status");
  if (all.people.length !== 210) releaseFailures.push("public-people");
  if (releaseFailures.length) findings.push(finding("blocker", "coverage-release-failure", "210人发布清单、覆盖统计或公开条目不一致。", releaseFailures));

  const knowledge = JSON.parse(await readFile(path.join(generatedRoot, "knowledge.json"), "utf8"));
  const publicRecords = Object.values(knowledge).flat();
  const leakedCandidates = publicRecords.filter((record) => record.editorialStatus !== "published");
  if (leakedCandidates.length) findings.push(finding("blocker", "candidate-leak", "非published内容进入公开生成物。", leakedCandidates));
  const lightweightFiles = ["atlas.json", "search-index.json"];
  const heavyweightIndexes = [];
  for (const file of lightweightFiles) {
    const raw = await readFile(path.join(generatedRoot, file), "utf8");
    if (/\"sections\"|\"paragraphs\"/.test(raw)) heavyweightIndexes.push(file);
  }
  if (heavyweightIndexes.length) findings.push(finding("blocker", "client-index-leak", "轻量客户端索引包含正文段落。", heavyweightIndexes));

  const production = await auditContentProduction({ contentRoot });
  findings.push(...production.findings);

  findings.push(finding("approval", "final-human-approval", `自动审核不会发布或部署；${published.length}个published记录及本次代码变更仍需最终人工批准。`, published));

  return {
    summary: {
      records: records.length,
      published: published.length,
      candidates: candidates.length,
      people: all.people.length,
      relations: all.relations.length,
      sources: all.sources.length,
      coverageCandidates: coverage.candidates.length,
      releasedCandidates: release.members.length,
      production: production.summary,
    },
    findings,
  };
}
