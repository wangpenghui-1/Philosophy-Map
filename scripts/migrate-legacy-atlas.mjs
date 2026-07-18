import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(projectRoot, "content", "knowledge");
const bundlePath = path.join(tmpdir(), `atlas-legacy-${process.pid}-${Date.now()}.mjs`);

await build({
  entryPoints: [path.join(projectRoot, "app", "_data", "atlas.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});

const atlas = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
const now = "2026-07-18";

const editorial = (tier = "index", status = "published") => ({
  contentTier: tier,
  editorialStatus: status,
  version: 1,
  editedBy: "思想星图编辑组",
  reviewedBy: status === "published" ? "首轮迁移复核" : undefined,
  lastReviewedAt: status === "published" ? now : undefined,
  notes: status === "published" ? "由公开演示版数据迁移；后续仍需逐条扩写与学术复核。" : undefined,
});

const citationRefs = (sourceIds) => sourceIds.map((sourceId) => {
  const source = atlas.sourceById.get(sourceId);
  return {
    sourceId,
    locator: source?.locator ?? "条目相关章节",
    claim: "支持本条目的生平、思想概述或关系说明。",
  };
});

const writeJson = async (directory, fileName, value) => {
  const targetDirectory = path.join(outputRoot, directory);
  await mkdir(targetDirectory, { recursive: true });
  await writeFile(path.join(targetDirectory, fileName), `${JSON.stringify(value, null, 2)}\n`);
};

const personRecords = atlas.thinkers.map((thinker) => {
  const summary = `${thinker.name}是${thinker.period}活跃于${thinker.region}的${thinker.tradition}思想人物，主要追问“${thinker.question}”。其核心主张可概括为：${thinker.thesis} 本站以${thinker.keywords.join("、")}为入口，连接其代表文本、思想关系与学术来源。`;
  return {
    id: thinker.id,
    slug: thinker.slug,
    entityType: "person",
    names: {
      display: thinker.name,
      english: thinker.englishName,
      original: thinker.originalName,
      aliases: [],
    },
    chronology: {
      label: thinker.period,
      startYear: thinker.startYear,
      endYear: thinker.endYear,
      certainty: thinker.uncertainty ? "approximate" : "established",
      note: thinker.uncertainty,
    },
    primaryRegion: thinker.region,
    secondaryRegions: [],
    traditionIds: [`tradition-${thinker.tradition}`],
    conceptIds: thinker.keywords.map((keyword) => `concept-${keyword}`),
    questionIds: thinker.questionIds,
    guidingQuestion: thinker.question,
    thesis: thinker.thesis,
    summary,
    workIds: thinker.workIds,
    placeLinks: thinker.anchors.map((anchor) => ({ placeId: anchor.id, role: "activity" })),
    sourceIds: thinker.sourceIds,
    citations: citationRefs(thinker.sourceIds),
    sections: [
      {
        id: "overview",
        heading: "思想概览",
        paragraphs: [
          { text: summary, citations: citationRefs(thinker.sourceIds) },
          { text: `核心问题：${thinker.question}`, citations: citationRefs(thinker.sourceIds) },
          { text: `核心主张：${thinker.thesis}`, citations: citationRefs(thinker.sourceIds) },
        ],
      },
    ],
    media: {
      fullSrc: thinker.media.fullSrc,
      thumbSrc: thinker.media.thumbSrc,
      alt: thinker.media.alt,
      objectPosition: thinker.media.objectPosition,
      depictionNote: thinker.media.depictionNote,
      presentationType: "stylized",
      authenticity: "interpretive",
      rightsStatus: "project-commissioned",
      credit: "思想星图艺术化人物形象",
    },
    uncertainty: thinker.uncertainty,
    color: thinker.color,
    mapVisible: true,
    ...editorial(),
  };
});

for (const record of personRecords) await writeJson("people", `${record.slug}.json`, record);

const sourceRecords = atlas.sources.map((source) => ({
  id: source.id,
  entityType: "source",
  title: source.title,
  authors: [],
  sourceType: source.kind,
  publication: source.publisher,
  url: source.url,
  defaultLocator: source.locator,
  language: "en",
  ...editorial("index"),
}));
for (const record of sourceRecords) await writeJson("sources", `${record.id}.json`, record);

const workRecords = atlas.works.map((work) => {
  const owner = atlas.thinkerById.get(work.thinkerId);
  return {
    id: work.id,
    slug: work.id,
    entityType: "work",
    title: work.title,
    originalTitle: work.originalTitle,
    authorRefs: [{ personId: work.thinkerId, role: "attributed-author", certainty: "supported" }],
    dateLabel: work.dateLabel,
    languages: [],
    summary: `${work.title}是${owner?.name ?? "相关思想人物"}的重要文本或文本传统。本索引保留原题、成书年代与人物关联，后续将补充版本史、核心概念和可靠译本。`,
    conceptIds: owner?.keywords.map((keyword) => `concept-${keyword}`) ?? [],
    traditionIds: owner ? [`tradition-${owner.tradition}`] : [],
    sourceIds: owner?.sourceIds ?? [],
    citations: citationRefs(owner?.sourceIds ?? []),
    ...editorial(),
  };
});
for (const record of workRecords) await writeJson("works", `${record.slug}.json`, record);

const places = new Map();
for (const thinker of atlas.thinkers) {
  for (const anchor of thinker.anchors) {
    if (!places.has(anchor.id)) {
      places.set(anchor.id, {
        id: anchor.id,
        slug: anchor.id,
        entityType: "place",
        historicalName: anchor.label,
        historicalRegion: anchor.historicalRegion,
        coordinates: { lat: anchor.lat, lon: anchor.lon },
        certainty: anchor.certainty,
        note: anchor.note,
        relatedPersonIds: [],
        ...editorial(),
      });
    }
    places.get(anchor.id).relatedPersonIds.push(thinker.id);
  }
}
for (const record of places.values()) await writeJson("places", `${record.slug}.json`, record);

const traditions = new Map();
for (const thinker of atlas.thinkers) {
  const id = `tradition-${thinker.tradition}`;
  if (!traditions.has(id)) {
    traditions.set(id, {
      id,
      slug: thinker.tradition,
      entityType: "tradition",
      name: thinker.tradition,
      originalNames: [],
      summary: `${thinker.tradition}是本知识库用于组织人物、文本与概念的一项思想传统索引。它不把传统理解为封闭或同质的体系，而用于呈现内部差异、历史传播与跨传统接触。`,
      periodLabel: "跨历史时期",
      regionLabels: [],
      parentIds: [],
      relatedTraditionIds: [],
      personIds: [],
      conceptIds: [],
      sourceIds: [],
      citations: [],
      ...editorial(),
    });
  }
  const tradition = traditions.get(id);
  tradition.personIds.push(thinker.id);
  tradition.regionLabels.push(thinker.region);
  tradition.conceptIds.push(...thinker.keywords.map((keyword) => `concept-${keyword}`));
  tradition.sourceIds.push(...thinker.sourceIds);
}
for (const record of traditions.values()) {
  record.regionLabels = [...new Set(record.regionLabels)];
  record.conceptIds = [...new Set(record.conceptIds)];
  record.sourceIds = [...new Set(record.sourceIds)];
  record.citations = citationRefs(record.sourceIds);
  await writeJson("traditions", `${record.slug}.json`, record);
}

const concepts = new Map();
for (const thinker of atlas.thinkers) {
  for (const keyword of thinker.keywords) {
    const id = `concept-${keyword}`;
    if (!concepts.has(id)) {
      concepts.set(id, {
        id,
        slug: keyword,
        entityType: "concept",
        name: keyword,
        originalTerms: [],
        summary: `“${keyword}”是思想星图中的概念索引，用于连接不同人物、文本和思想传统。相同译名不代表不同传统中的含义完全等同，阅读时应结合具体人物、语言和历史语境。`,
        senses: [],
        personIds: [],
        workIds: [],
        traditionIds: [],
        sourceIds: [],
        citations: [],
        ...editorial(),
      });
    }
    const concept = concepts.get(id);
    concept.personIds.push(thinker.id);
    concept.workIds.push(...thinker.workIds);
    concept.traditionIds.push(`tradition-${thinker.tradition}`);
    concept.sourceIds.push(...thinker.sourceIds);
    concept.senses.push({
      traditionId: `tradition-${thinker.tradition}`,
      label: keyword,
      explanation: `在${thinker.name}条目中，“${keyword}”是理解其核心问题与主张的入口；具体含义需结合相关文本和论证阅读。`,
      citations: citationRefs(thinker.sourceIds),
    });
  }
}
for (const record of concepts.values()) {
  record.personIds = [...new Set(record.personIds)];
  record.workIds = [...new Set(record.workIds)];
  record.traditionIds = [...new Set(record.traditionIds)];
  record.sourceIds = [...new Set(record.sourceIds)];
  record.citations = citationRefs(record.sourceIds);
  await writeJson("concepts", `${record.slug}.json`, record);
}

const relationRecords = atlas.relations.map((relation) => ({
  id: relation.id,
  entityType: "relation",
  from: { entityType: "person", id: relation.from },
  to: { entityType: "person", id: relation.to },
  directed: relation.directed,
  relationType: relation.type,
  evidenceStatus: relation.evidence,
  title: relation.title,
  explanation: relation.explanation,
  note: relation.note,
  citations: citationRefs(relation.sourceIds),
  atlasVisibility: true,
  ...editorial(),
}));
for (const record of relationRecords) await writeJson("relations", `${record.id}.json`, record);

const contexts = [
  {
    id: "context-plato-academy",
    slug: "plato-academy",
    entityType: "context",
    contextType: "institution",
    name: "柏拉图学园",
    chronologyLabel: "古典希腊时期",
    summary: "候选语境条目：用于连接柏拉图、亚里士多德及古典希腊教育实践，正式发布前需补充原典与现代研究。",
    personIds: ["plato", "aristotle"],
    placeIds: ["athens-plato"],
    sourceIds: ["src-plato", "src-aristotle"],
    citations: citationRefs(["src-plato", "src-aristotle"]),
    ...editorial("index", "candidate"),
  },
  {
    id: "context-arabic-translation",
    slug: "arabic-translation-movement",
    entityType: "context",
    contextType: "translation-network",
    name: "阿拉伯语翻译与注释网络",
    chronologyLabel: "约8–11世纪",
    summary: "候选语境条目：用于呈现希腊语、叙利亚语与阿拉伯语文本传播，以及阿维森纳等哲学家的主动重构。",
    personIds: ["aristotle", "avicenna"],
    placeIds: [],
    sourceIds: ["src-aristotle", "src-avicenna"],
    citations: citationRefs(["src-aristotle", "src-avicenna"]),
    ...editorial("index", "candidate"),
  },
];
for (const record of contexts) await writeJson("contexts", `${record.slug}.json`, record);

console.log(JSON.stringify({
  people: personRecords.length,
  works: workRecords.length,
  sources: sourceRecords.length,
  places: places.size,
  traditions: traditions.size,
  concepts: concepts.size,
  relations: relationRecords.length,
  contexts: contexts.length,
}, null, 2));
