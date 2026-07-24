import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { RELEASE_PEOPLE as RELEASE_120_PEOPLE, RELEASE_SOURCE_LIBRARY } from "./release-120-data.mjs";
import { RELEASE_210_ADDITIONS } from "./release-210-data.mjs";

const RELEASE_PEOPLE = [...RELEASE_120_PEOPLE, ...RELEASE_210_ADDITIONS];

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");
const write = process.argv.includes("--write");
const reviewDate = "2026-07-19";
const reviewer = "automated-editorial-review/v2";
const editor = "思想星图自动编辑流水线";
const notes = "自动编辑流水线完成结构、来源定位与交叉字段审核；本记录不声称已经过外部同行评审。";

const editorial = {
  contentTier: "index",
  editorialStatus: "published",
  version: 1,
  editedBy: editor,
  reviewedBy: reviewer,
  lastReviewedAt: reviewDate,
  notes,
};

const colorByRegion = {
  东亚: "#86b79b",
  南亚: "#d6a765",
  "西亚、中亚及伊斯兰思想世界": "#b99ad9",
  欧洲与地中海: "#7da7d9",
  非洲: "#df8b68",
  美洲与加勒比: "#d87f9d",
  东南亚与大洋洲: "#65b8b2",
  跨区域与离散思想传统: "#a5a3df",
};

const disputedWorkAuthors = new Set([
  "akshapada-gautama",
  "kanada",
  "mahavira",
  "patanjali",
  "philo-alexandria",
  "ptahhotep",
  "pythagoras",
  "thales",
  "zoroaster",
  "hypatia",
  "rabia-al-adawiyya",
  "nezahualcoyotl",
  "te-whiti-o-rongomai",
]);

function cleanSentence(value) {
  return value.replace(/[。？！]+$/u, "");
}

function chronologyLabel(startYear, endYear, certainty) {
  const prefix = certainty === "established" ? "" : "约";
  if (endYear === 2026) return `${prefix}${startYear}–`;
  if (startYear < 0 && endYear < 0) return `${prefix}公元前${Math.abs(startYear)}–${Math.abs(endYear)}`;
  if (startYear < 0) return `${prefix}公元前${Math.abs(startYear)}–公元${endYear}`;
  return `${prefix}${startYear}–${endYear}`;
}

function questionIds(question, concept) {
  const text = `${question}${concept}`;
  const ids = [];
  if (/政治|社会|制度|法律|殖民|民主|共同|权力|正义|女性|种姓|土地|文化/u.test(text)) ids.push("society");
  if (/认识|知识|理性|逻辑|语言|真理|解释|科学/u.test(text)) ids.push("knowledge");
  if (/心|灵魂|意识|自我|身份|觉察/u.test(text)) ids.push("self");
  if (/存在|实在|世界|宇宙|自然|梵|神/u.test(text)) ids.push("reality");
  if (/自由|解放|选择|自主/u.test(text)) ids.push("freedom");
  if (/伦理|道德|幸福|生活|修行|爱/u.test(text)) ids.push("good-life");
  return [...new Set(ids)].slice(0, 3).length ? [...new Set(ids)].slice(0, 3) : ["knowledge"];
}

function buildSummary(candidate, seed) {
  const thesis = cleanSentence(seed.thesis);
  let summary = `${candidate.name}是${candidate.primaryRegion}${candidate.tradition}的重要思想人物，主要追问“${seed.question}”。其思想以“${seed.concept}”为入口，主张${thesis}。条目结合代表文本、活动地点和学术研究，提示相关年代、归属或解释中的不确定性。`;
  if (summary.length > 180) {
    summary = `${candidate.name}是${candidate.primaryRegion}${candidate.tradition}的重要思想人物，主要追问“${seed.question}”。其思想以“${seed.concept}”为入口，主张${thesis}。条目结合文本、地点与学术来源呈现其历史语境。`;
  }
  if (summary.length < 80) summary += "阅读时应结合具体语言、文本层次与思想史语境。";
  if (summary.length < 80 || summary.length > 180) throw new Error(`${seed.slug} summary length is ${summary.length}`);
  return summary;
}

function citation(sourceId, locator, claim) {
  return { sourceId, locator, claim };
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const pendingWrites = new Map();
async function loadRecord(directory, fileName) {
  const file = path.join(contentRoot, directory, `${fileName}.json`);
  if (pendingWrites.has(file)) return structuredClone(pendingWrites.get(file));
  return (await fileExists(file)) ? readJson(file) : null;
}

function queueRecord(directory, fileName, record) {
  pendingWrites.set(path.join(contentRoot, directory, `${fileName}.json`), record);
}

const coveragePath = path.join(contentRoot, "coverage", "people.json");
const coverage = await readJson(coveragePath);
const mediaCatalogPath = path.join(contentRoot, "coverage", "media-210.json");
const mediaCatalog = await fileExists(mediaCatalogPath) ? await readJson(mediaCatalogPath) : { members: [] };
const mediaByPersonId = new Map((mediaCatalog.members ?? []).map((member) => [member.personId, member.media]));
const coverageCandidatePool = [
  ...(coverage.candidates ?? []),
  ...(coverage.releaseCandidates ?? []),
  ...(coverage.archivedRoadmap?.candidates ?? []),
];
const candidateById = new Map(coverageCandidatePool.map((candidate) => [candidate.id, candidate]));
const releaseCandidateIds = new Set(RELEASE_PEOPLE.map((entry) => entry.candidateId));

if (RELEASE_PEOPLE.length !== 180 || releaseCandidateIds.size !== 180) throw new Error("210-person release must contain exactly 180 unique additions.");
for (const seed of RELEASE_PEOPLE) {
  const candidate = candidateById.get(seed.candidateId);
  if (!candidate) throw new Error(`Missing coverage candidate ${seed.candidateId}`);
  if (candidate.batch > 6) throw new Error(`${seed.candidateId} is outside release batches 1–6.`);
}

for (const source of Object.values(RELEASE_SOURCE_LIBRARY)) {
  queueRecord("sources", source.id, {
    id: source.id,
    entityType: "source",
    title: source.title,
    authors: source.authors,
    sourceType: source.sourceType,
    publication: source.publication,
    year: source.year,
    ...(source.isbn ? { isbn: source.isbn } : {}),
    defaultLocator: source.locatorPrefix,
    language: source.language,
    ...editorial,
  });
}

const releaseMembers = [];
for (const seed of RELEASE_PEOPLE) {
  const candidate = candidateById.get(seed.candidateId);
  const source = RELEASE_SOURCE_LIBRARY[seed.sourceKey];
  if (!source) throw new Error(`${seed.slug} references unknown source ${seed.sourceKey}`);

  const personId = seed.slug;
  const traditionId = `tradition-${candidate.tradition}`;
  const conceptId = `concept-${seed.concept}`;
  const locator = `${source.locatorPrefix}：“${candidate.englishName} / ${candidate.name}”`;
  const summary = buildSummary(candidate, seed);
  const chronology = chronologyLabel(seed.startYear, seed.endYear, seed.certainty);
  const mainCitation = citation(source.id, locator, `支持${candidate.name}的身份、思想主张与历史语境概述。`);

  queueRecord("people", personId, {
    id: personId,
    slug: seed.slug,
    entityType: "person",
    names: { display: candidate.name, english: candidate.englishName, aliases: [] },
    chronology: {
      label: chronology,
      startYear: seed.startYear,
      endYear: seed.endYear,
      certainty: seed.certainty,
      ...(seed.certainty === "established" ? {} : { note: "生卒年代、文本归属或相关传记材料在研究中仍有不确定性。" }),
    },
    primaryRegion: candidate.primaryRegion,
    secondaryRegions: [],
    traditionIds: [traditionId],
    conceptIds: [conceptId],
    questionIds: questionIds(seed.question, seed.concept),
    guidingQuestion: seed.question,
    thesis: `${cleanSentence(seed.thesis)}。`,
    summary,
    workIds: [seed.work.id],
    placeLinks: [{ placeId: seed.place.id, role: "activity-or-reception" }],
    sourceIds: [source.id],
    citations: [mainCitation],
    sections: [{
      id: "overview",
      heading: "思想概览",
      paragraphs: [
        { text: summary, citations: [mainCitation] },
        { text: `核心问题：${seed.question}`, citations: [citation(source.id, locator, `支持对${candidate.name}核心问题的概括。`)] },
        { text: `核心主张：${cleanSentence(seed.thesis)}。`, citations: [citation(source.id, locator, `支持对${candidate.name}核心主张的概括。`)] },
      ],
    }],
    media: mediaByPersonId.get(personId) ?? {
      alt: `${candidate.name}的中性占位图`,
      depictionNote: "暂无经自动审核确认且符合本站授权条件的可靠形象，当前使用明确标注的中性占位。",
      presentationType: "placeholder",
      authenticity: "unavailable",
      rightsStatus: "not-applicable-placeholder",
      credit: "思想星图中性占位",
    },
    ...(seed.certainty === "established" ? {} : { uncertainty: "年代、作品归属或传记细节存在学术争议，条目采用约略标注。" }),
    color: colorByRegion[candidate.primaryRegion],
    mapVisible: true,
    ...editorial,
  });

  const existingPlace = await loadRecord("places", seed.place.id);
  queueRecord("places", seed.place.id, existingPlace ? {
    ...existingPlace,
    relatedPersonIds: [...new Set([...existingPlace.relatedPersonIds, personId])],
  } : {
    id: seed.place.id,
    slug: seed.place.id,
    entityType: "place",
    historicalName: seed.place.name,
    historicalRegion: seed.place.historicalRegion,
    modernReferenceName: seed.place.name,
    coordinates: { lat: seed.place.lat, lon: seed.place.lon },
    certainty: seed.certainty === "disputed" ? "disputed" : seed.certainty === "approximate" ? "approximate" : "established",
    note: "坐标用于世界思想地图的现代参考定位，不等同于对全部生平活动范围的断言。",
    relatedPersonIds: [personId],
    ...editorial,
  });

  const existingTradition = await loadRecord("traditions", candidate.tradition);
  queueRecord("traditions", candidate.tradition, existingTradition ? {
    ...existingTradition,
    regionLabels: [...new Set([...existingTradition.regionLabels, candidate.primaryRegion])],
    personIds: [...new Set([...existingTradition.personIds, personId])],
    conceptIds: [...new Set([...existingTradition.conceptIds, conceptId])],
    sourceIds: [...new Set([...existingTradition.sourceIds, source.id])],
  } : {
    id: traditionId,
    slug: candidate.tradition,
    entityType: "tradition",
    name: candidate.tradition,
    originalNames: [],
    summary: `${candidate.tradition}是本知识库用于组织人物、文本和概念的思想传统索引。条目保留传统内部差异、历史变化与跨区域传播，不把它处理为封闭或同质的体系。`,
    periodLabel: candidate.era,
    regionLabels: [candidate.primaryRegion],
    parentIds: [],
    relatedTraditionIds: [],
    personIds: [personId],
    conceptIds: [conceptId],
    sourceIds: [source.id],
    citations: [citation(source.id, locator, `支持${candidate.tradition}与${candidate.name}的历史关联。`)],
    ...editorial,
  });

  const existingConcept = await loadRecord("concepts", seed.concept);
  const conceptSense = {
    traditionId,
    label: seed.concept,
    explanation: `在${candidate.name}及${candidate.tradition}语境中，“${seed.concept}”用于说明：${cleanSentence(seed.thesis)}。该义项不默认等同于其他传统中的相似译名。`,
    citations: [citation(source.id, locator, `支持${candidate.name}语境中的“${seed.concept}”义项。`)],
  };
  queueRecord("concepts", seed.concept, existingConcept ? {
    ...existingConcept,
    senses: existingConcept.senses.some((sense) => sense.traditionId === traditionId)
      ? existingConcept.senses
      : [...existingConcept.senses, conceptSense],
    personIds: [...new Set([...existingConcept.personIds, personId])],
    workIds: [...new Set([...existingConcept.workIds, seed.work.id])],
    traditionIds: [...new Set([...existingConcept.traditionIds, traditionId])],
    sourceIds: [...new Set([...existingConcept.sourceIds, source.id])],
  } : {
    id: conceptId,
    slug: seed.concept,
    entityType: "concept",
    name: seed.concept,
    originalTerms: [],
    summary: `“${seed.concept}”是本知识库中的概念入口，用于连接相关人物、文本和传统。相似译名不自动视为同一概念，具体含义须结合语言、论证和历史语境辨析。`,
    senses: [conceptSense],
    personIds: [personId],
    workIds: [seed.work.id],
    traditionIds: [traditionId],
    sourceIds: [source.id],
    citations: [citation(source.id, locator, `支持“${seed.concept}”作为${candidate.name}思想入口的概括。`)],
    ...editorial,
  });

  queueRecord("works", seed.work.id, {
    id: seed.work.id,
    slug: seed.work.id,
    entityType: "work",
    title: seed.work.title,
    originalTitle: seed.work.originalTitle,
    authorRefs: [{
      personId,
      role: disputedWorkAuthors.has(personId) ? "attributed-author" : "author",
      certainty: disputedWorkAuthors.has(personId) ? "disputed" : seed.certainty === "disputed" ? "supported" : "established",
    }],
    dateLabel: seed.work.dateLabel,
    languages: seed.work.languages,
    summary: `${seed.work.title}是进入${candidate.name}思想语境的代表文本入口。条目以“${seed.concept}”为阅读线索，并对成书年代、作者归属或后世编订情况保留必要说明。`,
    conceptIds: [conceptId],
    traditionIds: [traditionId],
    sourceIds: [source.id],
    citations: [citation(source.id, locator, `支持${seed.work.title}与${candidate.name}的文本关联及归属说明。`)],
    ...editorial,
  });

  releaseMembers.push({
    candidateId: seed.candidateId,
    batch: candidate.batch,
    personId,
    slug: seed.slug,
    name: candidate.name,
    primaryRegion: candidate.primaryRegion,
    era: candidate.era,
    tradition: candidate.tradition,
    contentTier: "index",
    editorialStatus: "published",
  });
}

const releaseManifest = {
  version: 1,
  releaseId: "public-210",
  status: "release-candidate",
  baselinePeople: 30,
  addedPeople: 180,
  publicPeople: 210,
  sourceBatches: [1, 2, 3, 4, 5, 6],
  reviewMode: reviewer,
  externalPeerReviewClaimed: false,
  generatedAt: reviewDate,
  members: releaseMembers,
};

queueRecord("coverage", "release-210", releaseManifest);

const peopleDirectory = path.join(contentRoot, "people");
const publishedPeople = new Map();
for (const file of (await readdir(peopleDirectory)).filter((file) => file.endsWith(".json"))) {
  const record = await readJson(path.join(peopleDirectory, file));
  if (record.editorialStatus === "published") publishedPeople.set(record.id, record);
}
for (const [file, record] of pendingWrites) {
  if (path.dirname(file) === peopleDirectory && record.editorialStatus === "published") publishedPeople.set(record.id, record);
}
if (publishedPeople.size !== 210) throw new Error(`Expected 210 published people after release, found ${publishedPeople.size}.`);

const countBy = (values) => Object.fromEntries([...new Set(values)].sort((left, right) => left.localeCompare(right, "zh-CN")).map((value) => [value, values.filter((item) => item === value).length]));
const eraForYear = (year) => {
  if (year < -500) return "公元前500年以前";
  if (year < 500) return "公元前500年至公元500年";
  if (year < 1500) return "500–1500年";
  if (year < 1800) return "1500–1800年";
  if (year < 1945) return "1800–1945年";
  return "1945年至今";
};
const releasedCandidates = [...new Map(coverageCandidatePool.filter((candidate) => releaseCandidateIds.has(candidate.id)).map((candidate) => [candidate.id, candidate])).values()]
  .sort((left, right) => left.id.localeCompare(right.id));
const archivedCandidates = [...new Map(coverageCandidatePool.filter((candidate) => !releaseCandidateIds.has(candidate.id)).map((candidate) => [candidate.id, candidate])).values()]
  .sort((left, right) => left.id.localeCompare(right.id));
const peopleRecords = [...publishedPeople.values()];
queueRecord("coverage", "people", {
  version: 2,
  publishedBaseline: 210,
  candidateCount: 0,
  targetTotal: 210,
  status: "release-candidate",
  regionTargets: countBy(peopleRecords.map((person) => person.primaryRegion)),
  eraTargets: countBy(peopleRecords.map((person) => eraForYear(person.chronology.startYear))),
  batchRules: {
    batchCount: 0,
    approximateBatchSize: 30,
    minimumRegionsPerBatch: 4,
    minimumErasPerBatch: 3,
    maximumSingleRegionShare: 0.4,
    publicationRule: "210人版本已完成自动编辑与结构审核；外部同行评审不在自动审核声明范围内。",
  },
  candidates: [],
  releaseCandidates: releasedCandidates,
  release: {
    releaseId: "public-210",
    baselinePeople: 30,
    addedPeople: 180,
    publicPeople: 210,
    sourceBatches: [1, 2, 3, 4, 5, 6],
  },
  archivedRoadmap: {
    status: "deferred-after-210-person-release",
    candidateCount: archivedCandidates.length,
    candidates: archivedCandidates,
  },
});

if (!write) {
  const drifted = [];
  for (const [file, record] of pendingWrites) {
    const expected = `${JSON.stringify(record, null, 2)}\n`;
    if (!(await fileExists(file)) || await readFile(file, "utf8") !== expected) drifted.push(path.relative(projectRoot, file));
  }
  if (drifted.length) throw new Error(`210-person release has ${drifted.length} drifted record(s): ${drifted.slice(0, 10).join(", ")}`);
  console.log(`210-person release check passed: ${releaseMembers.length} additions and ${pendingWrites.size} normalized records are stable.`);
  process.exit(0);
}

for (const [file, record] of [...pendingWrites.entries()].sort(([left], [right]) => left.localeCompare(right, "en"))) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
}

console.log(`210-person release written: ${releaseMembers.length} additions across ${pendingWrites.size} normalized records.`);
