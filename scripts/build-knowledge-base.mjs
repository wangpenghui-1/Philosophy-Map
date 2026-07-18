import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { schemasByDirectory } from "./knowledge-schema.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");
const outputRoot = path.join(projectRoot, "app", "_generated");
const isPublished = (record) => record.editorialStatus === "published";

async function readDirectory(directory, schema) {
  const absoluteDirectory = path.join(contentRoot, directory);
  const files = (await readdir(absoluteDirectory)).filter((file) => file.endsWith(".json")).sort();
  const records = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(absoluteDirectory, file), "utf8"));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`${directory}/${file}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    }
    records.push(parsed.data);
  }
  return records;
}

const all = {};
for (const [directory, schema] of Object.entries(schemasByDirectory)) {
  all[directory] = await readDirectory(directory, schema);
}

const assertUnique = (label, values) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) throw new Error(`${label} contains duplicate values: ${[...new Set(duplicates)].join(", ")}`);
};

for (const [directory, records] of Object.entries(all)) {
  assertUnique(`${directory} ids`, records.map((record) => record.id));
  if (records.every((record) => "slug" in record)) assertUnique(`${directory} slugs`, records.map((record) => record.slug));
  for (const record of records) {
    if (isPublished(record) && (!record.reviewedBy || !record.lastReviewedAt)) {
      throw new Error(`${directory}/${record.id} is published without review metadata.`);
    }
  }
}

const byId = Object.fromEntries(Object.entries(all).map(([directory, records]) => [directory, new Map(records.map((record) => [record.id, record]))]));
const entityDirectory = {
  person: "people",
  concept: "concepts",
  tradition: "traditions",
  work: "works",
  context: "contexts",
  place: "places",
};

const requireRecord = (directory, id, owner) => {
  if (!byId[directory].has(id)) throw new Error(`${owner} references missing ${directory} record ${id}.`);
};

const validateCitations = (record) => {
  for (const citation of record.citations ?? []) requireRecord("sources", citation.sourceId, record.id);
};

const validateCitationList = (ownerId, citations) => {
  for (const citation of citations) requireRecord("sources", citation.sourceId, ownerId);
};

for (const person of all.people) {
  person.traditionIds.forEach((id) => requireRecord("traditions", id, person.id));
  person.conceptIds.forEach((id) => requireRecord("concepts", id, person.id));
  person.workIds.forEach((id) => requireRecord("works", id, person.id));
  person.placeLinks.forEach(({ placeId }) => requireRecord("places", placeId, person.id));
  person.sourceIds.forEach((id) => requireRecord("sources", id, person.id));
  validateCitations(person);
  person.sections.forEach((section) => section.paragraphs.forEach((paragraph) => validateCitationList(person.id, paragraph.citations)));

  if (isPublished(person)) {
    const textLength = person.sections.flatMap((section) => section.paragraphs).reduce((sum, paragraph) => sum + paragraph.text.length, 0);
    if (person.contentTier === "standard" && (textLength < 600 || person.sourceIds.length < 2 || person.conceptIds.length < 3)) {
      throw new Error(`${person.id} does not meet standard-tier requirements.`);
    }
    if (person.contentTier === "deep" && (textLength < 2500 || person.sourceIds.length < 4 || person.sections.length < 4)) {
      throw new Error(`${person.id} does not meet deep-tier requirements.`);
    }
    if (person.media.presentationType !== "placeholder") {
      if (!person.media.fullSrc || !person.media.thumbSrc) throw new Error(`${person.id} has incomplete media paths.`);
      await Promise.all([
        access(path.join(projectRoot, "public", person.media.fullSrc)),
        access(path.join(projectRoot, "public", person.media.thumbSrc)),
      ]);
    }
  }
}

for (const work of all.works) {
  work.authorRefs.forEach(({ personId }) => requireRecord("people", personId, work.id));
  work.conceptIds.forEach((id) => requireRecord("concepts", id, work.id));
  work.traditionIds.forEach((id) => requireRecord("traditions", id, work.id));
  work.sourceIds.forEach((id) => requireRecord("sources", id, work.id));
  validateCitations(work);
}

for (const concept of all.concepts) {
  concept.personIds.forEach((id) => requireRecord("people", id, concept.id));
  concept.workIds.forEach((id) => requireRecord("works", id, concept.id));
  concept.traditionIds.forEach((id) => requireRecord("traditions", id, concept.id));
  concept.sourceIds.forEach((id) => requireRecord("sources", id, concept.id));
  validateCitations(concept);
  concept.senses.forEach((sense) => {
    requireRecord("traditions", sense.traditionId, concept.id);
    validateCitationList(concept.id, sense.citations);
  });
}

for (const tradition of all.traditions) {
  tradition.parentIds.forEach((id) => requireRecord("traditions", id, tradition.id));
  tradition.relatedTraditionIds.forEach((id) => requireRecord("traditions", id, tradition.id));
  tradition.personIds.forEach((id) => requireRecord("people", id, tradition.id));
  tradition.conceptIds.forEach((id) => requireRecord("concepts", id, tradition.id));
  tradition.sourceIds.forEach((id) => requireRecord("sources", id, tradition.id));
  validateCitations(tradition);
}

for (const place of all.places) {
  place.relatedPersonIds.forEach((id) => requireRecord("people", id, place.id));
}

for (const context of all.contexts) {
  context.personIds.forEach((id) => requireRecord("people", id, context.id));
  context.placeIds.forEach((id) => requireRecord("places", id, context.id));
  context.sourceIds.forEach((id) => requireRecord("sources", id, context.id));
  validateCitations(context);
}

for (const relation of all.relations) {
  requireRecord(entityDirectory[relation.from.entityType], relation.from.id, relation.id);
  requireRecord(entityDirectory[relation.to.entityType], relation.to.id, relation.id);
  validateCitations(relation);
  if (relation.relationType === "thematic-resonance" && relation.directed) {
    throw new Error(`${relation.id}: thematic resonance must be non-directional.`);
  }
  if (relation.evidenceStatus === "disputed" && !relation.note) {
    throw new Error(`${relation.id}: disputed relations require a note.`);
  }
}

const published = Object.fromEntries(Object.entries(all).map(([directory, records]) => [directory, records.filter(isPublished)]));
const publishedIds = new Set(Object.values(published).flat().map((record) => record.id));
published.relations = published.relations.filter((relation) => publishedIds.has(relation.from.id) && publishedIds.has(relation.to.id));

const personById = new Map(published.people.map((person) => [person.id, person]));
const placeById = new Map(published.places.map((place) => [place.id, place]));
const traditionById = new Map(published.traditions.map((tradition) => [tradition.id, tradition]));
const conceptById = new Map(published.concepts.map((concept) => [concept.id, concept]));

const atlasSources = published.sources.map((source) => ({
  id: source.id,
  title: source.title,
  publisher: source.publication,
  url: source.url ?? (source.doi ? `https://doi.org/${source.doi}` : "#"),
  locator: source.defaultLocator ?? "请参见条目中的具体引用定位",
  kind: source.sourceType,
}));

const atlasWorks = published.works.map((work) => ({
  id: work.id,
  title: work.title,
  originalTitle: work.originalTitle,
  thinkerId: work.authorRefs[0].personId,
  dateLabel: work.dateLabel,
}));

const atlasThinkers = published.people.map((person) => ({
  id: person.id,
  slug: person.slug,
  name: person.names.display,
  englishName: person.names.english,
  originalName: person.names.original,
  period: person.chronology.label,
  startYear: person.chronology.startYear,
  endYear: person.chronology.endYear,
  region: person.primaryRegion,
  tradition: traditionById.get(person.traditionIds[0])?.name ?? person.traditionIds[0],
  traditionIds: person.traditionIds,
  conceptIds: person.conceptIds,
  contentTier: person.contentTier,
  questionIds: person.questionIds,
  question: person.guidingQuestion,
  thesis: person.thesis,
  keywords: person.conceptIds.map((id) => conceptById.get(id)?.name ?? id),
  workIds: person.workIds,
  anchors: person.placeLinks.map(({ placeId }) => placeById.get(placeId)).filter(Boolean).map((place) => ({
    id: place.id,
    label: place.historicalName,
    historicalRegion: place.historicalRegion,
    lat: place.coordinates.lat,
    lon: place.coordinates.lon,
    certainty: place.certainty,
    note: place.note,
  })),
  sourceIds: person.sourceIds,
  color: person.color,
  media: {
    fullSrc: person.media.fullSrc ?? "",
    thumbSrc: person.media.thumbSrc ?? "/globe.svg",
    alt: person.media.alt,
    objectPosition: person.media.objectPosition ?? "50% 50%",
    depictionNote: person.media.depictionNote,
  },
  uncertainty: person.uncertainty,
}));

const atlasRelations = published.relations
  .filter((relation) => relation.atlasVisibility && relation.from.entityType === "person" && relation.to.entityType === "person")
  .map((relation) => ({
    id: relation.id,
    from: relation.from.id,
    to: relation.to.id,
    directed: relation.directed,
    type: relation.relationType,
    evidence: relation.evidenceStatus,
    title: relation.title,
    explanation: relation.explanation,
    sourceIds: [...new Set(relation.citations.map((citation) => citation.sourceId))],
    note: relation.note,
  }));

const indexItems = [
  ...published.people.map((person) => ({
    id: person.id,
    slug: person.slug,
    entityType: "person",
    title: person.names.display,
    subtitle: `${person.names.english} · ${person.chronology.label}`,
    summary: person.summary,
    contentTier: person.contentTier,
    region: person.primaryRegion,
    period: person.chronology.label,
    startYear: person.chronology.startYear,
    traditionIds: person.traditionIds,
    searchText: [person.names.display, person.names.english, person.names.original, ...person.names.aliases, person.summary].filter(Boolean).join(" ").toLowerCase(),
    href: `/thinker/${person.slug}`,
  })),
  ...published.concepts.map((concept) => ({
    id: concept.id,
    slug: concept.slug,
    entityType: "concept",
    title: concept.name,
    subtitle: concept.originalTerms.join(" · ") || "概念索引",
    summary: concept.summary,
    contentTier: concept.contentTier,
    traditionIds: concept.traditionIds,
    searchText: [concept.name, ...concept.originalTerms, concept.summary].join(" ").toLowerCase(),
    href: `/concept/${encodeURIComponent(concept.slug)}`,
  })),
  ...published.traditions.map((tradition) => ({
    id: tradition.id,
    slug: tradition.slug,
    entityType: "tradition",
    title: tradition.name,
    subtitle: `${tradition.regionLabels.join(" · ")} · ${tradition.periodLabel}`,
    summary: tradition.summary,
    contentTier: tradition.contentTier,
    region: tradition.regionLabels.join("、"),
    period: tradition.periodLabel,
    traditionIds: [tradition.id],
    searchText: [tradition.name, ...tradition.originalNames, tradition.summary].join(" ").toLowerCase(),
    href: `/tradition/${encodeURIComponent(tradition.slug)}`,
  })),
  ...published.works.map((work) => ({
    id: work.id,
    slug: work.slug,
    entityType: "work",
    title: work.title,
    subtitle: [work.originalTitle, work.dateLabel].filter(Boolean).join(" · "),
    summary: work.summary,
    contentTier: work.contentTier,
    period: work.dateLabel,
    traditionIds: work.traditionIds,
    searchText: [work.title, work.originalTitle, work.summary, ...work.authorRefs.map(({ personId }) => personById.get(personId)?.names.display)].filter(Boolean).join(" ").toLowerCase(),
    href: `/work/${work.slug}`,
  })),
];

const regionCounts = Object.fromEntries([...new Set(published.people.map((person) => person.primaryRegion))].sort().map((region) => [region, published.people.filter((person) => person.primaryRegion === region).length]));
const tierCounts = Object.fromEntries(["index", "standard", "deep"].map((tier) => [tier, published.people.filter((person) => person.contentTier === tier).length]));
const coveragePlanPath = path.join(contentRoot, "coverage", "people.json");
let coveragePlan = null;
try { coveragePlan = JSON.parse(await readFile(coveragePlanPath, "utf8")); } catch { /* created in the next implementation step */ }

let scaleSimulation = null;
if (coveragePlan) {
  const candidates = coveragePlan.candidates ?? [];
  if (coveragePlan.publishedBaseline !== published.people.length) throw new Error("Coverage baseline does not match the published people count.");
  if (candidates.length !== coveragePlan.candidateCount || coveragePlan.publishedBaseline + candidates.length !== coveragePlan.targetTotal) {
    throw new Error("Coverage plan counts do not match its published baseline and target total.");
  }
  if (Object.values(coveragePlan.regionTargets).reduce((sum, value) => sum + value, 0) !== coveragePlan.targetTotal) throw new Error("Region targets must match the coverage target total.");
  if (Object.values(coveragePlan.eraTargets).reduce((sum, value) => sum + value, 0) !== coveragePlan.targetTotal) throw new Error("Era targets must match the coverage target total.");
  assertUnique("coverage candidate ids", candidates.map((candidate) => candidate.id));
  assertUnique("coverage candidate English names", candidates.map((candidate) => candidate.englishName));
  for (let batch = 1; batch <= coveragePlan.batchRules.batchCount; batch += 1) {
    const entries = candidates.filter((candidate) => candidate.batch === batch);
    const regionCounts = new Map();
    entries.forEach((candidate) => regionCounts.set(candidate.primaryRegion, (regionCounts.get(candidate.primaryRegion) ?? 0) + 1));
    if (entries.length !== 30) throw new Error(`Coverage batch ${batch} must contain 30 candidates.`);
    if (regionCounts.size < coveragePlan.batchRules.minimumRegionsPerBatch) throw new Error(`Coverage batch ${batch} has too few regions.`);
    if (new Set(entries.map((candidate) => candidate.era)).size < coveragePlan.batchRules.minimumErasPerBatch) throw new Error(`Coverage batch ${batch} has too few eras.`);
    if (Math.max(...regionCounts.values()) / entries.length > coveragePlan.batchRules.maximumSingleRegionShare) throw new Error(`Coverage batch ${batch} exceeds the regional share limit.`);
  }

  const syntheticDirectory = [
    ...published.people.map((person) => ({ id: person.id, name: person.names.display, region: person.primaryRegion, status: "published" })),
    ...candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, region: candidate.primaryRegion, status: "candidate" })),
  ];
  scaleSimulation = {
    people: syntheticDirectory.length,
    pageSize: 24,
    directoryPages: Math.ceil(syntheticDirectory.length / 24),
    searchableRecords: syntheticDirectory.filter((item) => item.name.toLowerCase().includes("a") || item.name.includes("子")).length,
    serializedBytes: Buffer.byteLength(JSON.stringify(syntheticDirectory)),
  };
}

const knowledgeBase = {
  people: published.people,
  concepts: published.concepts,
  traditions: published.traditions,
  works: published.works,
  contexts: published.contexts,
  places: published.places,
  sources: published.sources,
  relations: published.relations,
};

await mkdir(outputRoot, { recursive: true });
const writeOutput = (name, value) => writeFile(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`);
await Promise.all([
  writeOutput("knowledge.json", knowledgeBase),
  writeOutput("knowledge-index.json", indexItems),
  writeOutput("search-index.json", indexItems.map(({ id, entityType, title, href, searchText }) => ({ id, entityType, title, href, searchText }))),
  writeOutput("atlas.json", { sources: atlasSources, works: atlasWorks, thinkers: atlasThinkers, relations: atlasRelations }),
  writeOutput("coverage-report.json", {
    generatedAt: new Date().toISOString(),
    published: {
      people: published.people.length,
      concepts: published.concepts.length,
      traditions: published.traditions.length,
      works: published.works.length,
      contexts: published.contexts.length,
      places: published.places.length,
      sources: published.sources.length,
      relations: published.relations.length,
    },
    editorial: Object.fromEntries(["candidate", "edited", "reviewed", "published"].map((status) => [status, Object.values(all).flat().filter((record) => record.editorialStatus === status).length])),
    peopleByRegion: regionCounts,
    peopleByTier: tierCounts,
    coveragePlan,
    scaleSimulation,
  }),
]);

console.log(`Knowledge base generated: ${published.people.length} people, ${published.relations.length} relations, ${published.sources.length} sources.`);
