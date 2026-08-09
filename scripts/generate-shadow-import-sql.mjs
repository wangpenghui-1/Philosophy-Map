import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { journeyCatalog } from "../app/_data/journeys.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");
const knowledge = JSON.parse(await readFile(path.join(projectRoot, "app", "_generated", "knowledge.json"), "utf8"));
const outputFlag = process.argv.indexOf("--output");
const outputPath = outputFlag >= 0 ? path.resolve(process.argv[outputFlag + 1]) : "/tmp/atlas-shadow-import.sql";

const directories = ["people", "concepts", "traditions", "works", "contexts", "places", "sources"];
const typeByDirectory = {
  people: "person",
  concepts: "concept",
  traditions: "tradition",
  works: "work",
  contexts: "context",
  places: "place",
  sources: "source",
};

function jsonLiteral(value, tag) {
  const delimiter = `$${tag}$`;
  const json = JSON.stringify(value);
  if (json.includes(delimiter)) throw new Error(`Generated JSON contains reserved delimiter ${delimiter}.`);
  return `${delimiter}${json}${delimiter}::jsonb`;
}

function reviewedAt(record) {
  return record.lastReviewedAt ? `${record.lastReviewedAt}T00:00:00Z` : null;
}

const entityRows = [];
const fragmentRows = [];
const fragmentCitationRows = [];
for (const directory of directories) {
  for (const record of knowledge[directory]) {
    if (record.editorialStatus !== "published") throw new Error(`Non-published record ${directory}/${record.id}.`);
    const entityType = typeByDirectory[directory];
    const title = record.names?.display ?? record.name ?? record.title ?? record.historicalName ?? record.id;
    const summary = record.summary ?? record.depictionNote ?? title;
    entityRows.push({
      stableKey: record.id,
      entityType,
      version: record.version,
      locale: "zh-CN",
      slug: record.slug ?? record.id,
      title,
      summary,
      contentTier: record.contentTier ?? "index",
      editorialStatus: record.editorialStatus,
      schemaVersion: 1,
      payload: record,
      editedBy: record.editedBy ?? null,
      reviewedBy: record.reviewedBy ?? null,
      reviewedAt: reviewedAt(record),
      publishedAt: reviewedAt(record) ?? new Date().toISOString(),
    });

    if (directory === "sources") continue;
    const fragments = record.sections?.flatMap((section, sectionIndex) => section.paragraphs.map((paragraph, paragraphIndex) => ({
      fragmentKey: `${section.id}:${paragraphIndex}`,
      heading: section.heading ?? null,
      body: paragraph.text,
      ordinal: sectionIndex * 100 + paragraphIndex,
      citations: paragraph.citations ?? [],
    }))) ?? [{
      fragmentKey: "summary:0",
      heading: null,
      body: record.summary ?? summary,
      ordinal: 0,
      citations: record.citations ?? [],
    }];
    for (const fragment of fragments) {
      fragmentRows.push({
        stableKey: record.id, entityType, version: record.version, locale: "zh-CN",
        fragmentKey: fragment.fragmentKey, heading: fragment.heading, body: fragment.body, ordinal: fragment.ordinal,
      });
      for (const citation of fragment.citations) {
        fragmentCitationRows.push({
          stableKey: record.id, entityType, version: record.version, locale: "zh-CN", fragmentKey: fragment.fragmentKey,
          sourceKey: citation.sourceId, locator: citation.locator, claim: citation.claim, displayAnchor: fragment.fragmentKey,
        });
      }
    }
  }
}

const sourceRows = knowledge.sources.map((record) => ({
  stableKey: record.id,
  version: record.version,
  title: record.title,
  authors: record.authors ?? [],
  sourceType: record.sourceType,
  publication: record.publication,
  publicationYear: record.year ?? null,
  url: record.url ?? null,
  doi: record.doi ?? null,
  isbn: record.isbn ?? null,
  language: record.language,
  editorialStatus: record.editorialStatus,
  payload: record,
}));

const relationRows = [];
const relationCitationRows = [];
for (const record of knowledge.relations) {
  if (record.editorialStatus !== "published") throw new Error(`Non-published relation ${record.id}.`);
  if (record.relationType === "thematic-resonance" && record.directed) throw new Error(`Directed thematic resonance ${record.id}.`);
  relationRows.push({
    stableKey: record.id,
    fromStableKey: record.from.id,
    toStableKey: record.to.id,
    directed: record.directed,
    relationType: record.relationType,
    version: record.version,
    locale: "zh-CN",
    title: record.title,
    explanation: record.explanation,
    note: record.note ?? null,
    evidenceStatus: record.evidenceStatus,
    editorialStatus: record.editorialStatus,
    atlasVisibility: record.atlasVisibility,
    reviewedBy: record.reviewedBy ?? null,
    reviewedAt: reviewedAt(record),
    publishedAt: new Date().toISOString(),
  });
  for (const citation of record.citations ?? []) {
    relationCitationRows.push({
      relationKey: record.id,
      version: record.version,
      locale: "zh-CN",
      sourceKey: citation.sourceId,
      locator: citation.locator,
      claim: citation.claim,
    });
  }
}

const journeyRows = journeyCatalog.map((record) => ({
  stableKey: record.id,
  version: 1,
  locale: "zh-CN",
  slug: record.id,
  title: record.title,
  summary: record.description,
  estimatedDurationMs: record.estimatedDurationMs,
  editorialStatus: "published",
  payload: { ...record, slug: record.id, locale: "zh-CN", editorialStatus: "published", version: 1 },
  reviewedBy: "git-snapshot-import",
  reviewedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
}));
const journeyNodeRows = journeyCatalog.flatMap((record) => record.nodes.map((node, ordinal) => ({
  journeyKey: record.id,
  journeyVersion: 1,
  locale: "zh-CN",
  nodeKey: node.id,
  ordinal,
  entityStableKey: node.thinkerId,
  title: node.title,
  body: node.body,
  camera: node.camera ?? null,
  transition: node.incomingTransition ?? null,
})));

const sql = `-- Generated by scripts/generate-shadow-import-sql.mjs. Do not edit by hand.
BEGIN;
SET LOCAL statement_timeout = '10min';

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(entityRows, "atlas_entities")}) AS x(
    "stableKey" text, "entityType" text, version integer, locale text, slug text, title text, summary text,
    "contentTier" text, "editorialStatus" text, "schemaVersion" integer, payload jsonb,
    "editedBy" text, "reviewedBy" text, "reviewedAt" timestamptz, "publishedAt" timestamptz
  )
)
INSERT INTO entities (stable_key, entity_type)
SELECT "stableKey", "entityType"::entity_type FROM data
ON CONFLICT (entity_type, stable_key) DO NOTHING;

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(entityRows, "atlas_entity_versions")}) AS x(
    "stableKey" text, "entityType" text, version integer, locale text, slug text, title text, summary text,
    "contentTier" text, "editorialStatus" text, "schemaVersion" integer, payload jsonb,
    "editedBy" text, "reviewedBy" text, "reviewedAt" timestamptz, "publishedAt" timestamptz
  )
)
INSERT INTO entity_versions (
  entity_id, version, locale, slug, title, summary, content_tier, editorial_status, schema_version,
  payload, edited_by, reviewed_by, reviewed_at, published_at
)
SELECT e.id, d.version, d.locale, d.slug, d.title, d.summary, d."contentTier"::content_tier,
       d."editorialStatus"::editorial_status, d."schemaVersion", d.payload, d."editedBy", d."reviewedBy",
       d."reviewedAt", d."publishedAt"
FROM data d
JOIN entities e ON e.stable_key = d."stableKey" AND e.entity_type = d."entityType"::entity_type
ON CONFLICT (entity_id, version, locale) DO NOTHING;

UPDATE entities e
SET current_published_version_id = ev.id, updated_at = now()
FROM entity_versions ev
WHERE ev.entity_id = e.id AND ev.editorial_status = 'published';

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(sourceRows, "atlas_sources")}) AS x(
    "stableKey" text, version integer, title text, authors jsonb, "sourceType" text, publication text,
    "publicationYear" integer, url text, doi text, isbn text, language text, "editorialStatus" text, payload jsonb
  )
)
INSERT INTO sources (stable_key)
SELECT "stableKey" FROM data
ON CONFLICT (stable_key) DO NOTHING;

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(sourceRows, "atlas_source_versions")}) AS x(
    "stableKey" text, version integer, title text, authors jsonb, "sourceType" text, publication text,
    "publicationYear" integer, url text, doi text, isbn text, language text, "editorialStatus" text, payload jsonb
  )
)
INSERT INTO source_versions (
  source_id, version, title, authors, source_type, publication, publication_year, url, doi, isbn,
  language, editorial_status, payload
)
SELECT s.id, d.version, d.title, d.authors, d."sourceType", d.publication, d."publicationYear", d.url, d.doi,
       d.isbn, d.language, d."editorialStatus"::editorial_status, d.payload
FROM data d JOIN sources s ON s.stable_key = d."stableKey"
ON CONFLICT (source_id, version) DO NOTHING;

UPDATE sources s
SET current_published_version_id = sv.id, updated_at = now()
FROM source_versions sv
WHERE sv.source_id = s.id AND sv.editorial_status = 'published';

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(fragmentRows, "atlas_fragments")}) AS x(
    "stableKey" text, "entityType" text, version integer, locale text, "fragmentKey" text,
    heading text, body text, ordinal integer
  )
)
INSERT INTO content_fragments (entity_version_id, fragment_key, heading, body, ordinal)
SELECT ev.id, d."fragmentKey", d.heading, d.body, d.ordinal
FROM data d
JOIN entities e ON e.stable_key = d."stableKey" AND e.entity_type = d."entityType"::entity_type
JOIN entity_versions ev ON ev.entity_id = e.id AND ev.version = d.version AND ev.locale = d.locale
ON CONFLICT (entity_version_id, fragment_key) DO NOTHING;

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(fragmentCitationRows, "atlas_fragment_citations")}) AS x(
    "stableKey" text, "entityType" text, version integer, locale text, "fragmentKey" text,
    "sourceKey" text, locator text, claim text, "displayAnchor" text
  )
)
INSERT INTO citations (fragment_id, source_version_id, locator, claim, display_anchor)
SELECT f.id, sv.id, d.locator, d.claim, d."displayAnchor"
FROM data d
JOIN entities e ON e.stable_key = d."stableKey" AND e.entity_type = d."entityType"::entity_type
JOIN entity_versions ev ON ev.entity_id = e.id AND ev.version = d.version AND ev.locale = d.locale
JOIN content_fragments f ON f.entity_version_id = ev.id AND f.fragment_key = d."fragmentKey"
JOIN sources s ON s.stable_key = d."sourceKey"
JOIN source_versions sv ON sv.source_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM citations c
  WHERE c.fragment_id = f.id AND c.source_version_id = sv.id AND c.locator = d.locator AND c.claim = d.claim
);

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(relationRows, "atlas_relations")}) AS x(
    "stableKey" text, "fromStableKey" text, "toStableKey" text, directed boolean, "relationType" text,
    version integer, locale text, title text, explanation text, note text, "evidenceStatus" text,
    "editorialStatus" text, "atlasVisibility" boolean, "reviewedBy" text, "reviewedAt" timestamptz,
    "publishedAt" timestamptz
  )
)
INSERT INTO relations (stable_key, from_entity_id, to_entity_id, directed, relation_type)
SELECT d."stableKey", source.id, target.id, d.directed, d."relationType"::relation_type
FROM data d
JOIN entities source ON source.stable_key = d."fromStableKey"
JOIN entities target ON target.stable_key = d."toStableKey"
ON CONFLICT (stable_key) DO NOTHING;

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(relationRows, "atlas_relation_versions")}) AS x(
    "stableKey" text, "fromStableKey" text, "toStableKey" text, directed boolean, "relationType" text,
    version integer, locale text, title text, explanation text, note text, "evidenceStatus" text,
    "editorialStatus" text, "atlasVisibility" boolean, "reviewedBy" text, "reviewedAt" timestamptz,
    "publishedAt" timestamptz
  )
)
INSERT INTO relation_versions (
  relation_id, version, locale, title, explanation, note, evidence_status, editorial_status,
  atlas_visibility, reviewed_by, reviewed_at, published_at
)
SELECT r.id, d.version, d.locale, d.title, d.explanation, d.note, d."evidenceStatus"::evidence_status,
       d."editorialStatus"::editorial_status, d."atlasVisibility", d."reviewedBy", d."reviewedAt", d."publishedAt"
FROM data d JOIN relations r ON r.stable_key = d."stableKey"
ON CONFLICT (relation_id, version, locale) DO NOTHING;

UPDATE relations r
SET current_published_version_id = rv.id, updated_at = now()
FROM relation_versions rv
WHERE rv.relation_id = r.id AND rv.editorial_status = 'published';

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(relationCitationRows, "atlas_relation_citations")}) AS x(
    "relationKey" text, version integer, locale text, "sourceKey" text, locator text, claim text
  )
)
INSERT INTO citations (relation_version_id, source_version_id, locator, claim)
SELECT rv.id, sv.id, d.locator, d.claim
FROM data d
JOIN relations r ON r.stable_key = d."relationKey"
JOIN relation_versions rv ON rv.relation_id = r.id AND rv.version = d.version AND rv.locale = d.locale
JOIN sources s ON s.stable_key = d."sourceKey"
JOIN source_versions sv ON sv.source_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM citations c
  WHERE c.relation_version_id = rv.id AND c.source_version_id = sv.id AND c.locator = d.locator AND c.claim = d.claim
);

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(journeyRows, "atlas_journeys")}) AS x(
    "stableKey" text, version integer, locale text, slug text, title text, summary text,
    "estimatedDurationMs" integer, "editorialStatus" text, payload jsonb, "reviewedBy" text,
    "reviewedAt" timestamptz, "publishedAt" timestamptz
  )
)
INSERT INTO journeys (stable_key)
SELECT "stableKey" FROM data
ON CONFLICT (stable_key) DO NOTHING;

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(journeyRows, "atlas_journey_versions")}) AS x(
    "stableKey" text, version integer, locale text, slug text, title text, summary text,
    "estimatedDurationMs" integer, "editorialStatus" text, payload jsonb, "reviewedBy" text,
    "reviewedAt" timestamptz, "publishedAt" timestamptz
  )
)
INSERT INTO journey_versions (
  journey_id, version, locale, slug, title, summary, estimated_duration_ms, editorial_status,
  payload, reviewed_by, reviewed_at, published_at
)
SELECT j.id, d.version, d.locale, d.slug, d.title, d.summary, d."estimatedDurationMs",
       d."editorialStatus"::editorial_status, d.payload, d."reviewedBy", d."reviewedAt", d."publishedAt"
FROM data d JOIN journeys j ON j.stable_key = d."stableKey"
ON CONFLICT (journey_id, version, locale) DO NOTHING;

UPDATE journeys j
SET current_published_version_id = jv.id, updated_at = now()
FROM journey_versions jv
WHERE jv.journey_id = j.id AND jv.editorial_status = 'published';

WITH data AS (
  SELECT * FROM jsonb_to_recordset(${jsonLiteral(journeyNodeRows, "atlas_journey_nodes")}) AS x(
    "journeyKey" text, "journeyVersion" integer, locale text, "nodeKey" text, ordinal integer,
    "entityStableKey" text, title text, body text, camera jsonb, transition jsonb
  )
)
INSERT INTO journey_nodes (journey_version_id, node_key, ordinal, entity_id, title, body, camera, transition)
SELECT jv.id, d."nodeKey", d.ordinal, e.id, d.title, d.body, d.camera, d.transition
FROM data d
JOIN journeys j ON j.stable_key = d."journeyKey"
JOIN journey_versions jv ON jv.journey_id = j.id AND jv.version = d."journeyVersion" AND jv.locale = d.locale
JOIN entities e ON e.stable_key = d."entityStableKey" AND e.entity_type = 'person'
ON CONFLICT (journey_version_id, node_key) DO NOTHING;

COMMIT;

SELECT
  (SELECT count(*)::int FROM entities) AS entities,
  (SELECT count(*)::int FROM entity_versions) AS entity_versions,
  (SELECT count(*)::int FROM content_fragments) AS content_fragments,
  (SELECT count(*)::int FROM citations) AS citations,
  (SELECT count(*)::int FROM relations) AS relations,
  (SELECT count(*)::int FROM sources) AS sources,
  (SELECT count(*)::int FROM journeys) AS journeys,
  (SELECT count(*)::int FROM journey_nodes) AS journey_nodes;
`;

await writeFile(outputPath, sql, { mode: 0o600 });
console.log(JSON.stringify({
  outputPath,
  bytes: Buffer.byteLength(sql),
  rows: {
    entities: entityRows.length,
    fragments: fragmentRows.length,
    fragmentCitations: fragmentCitationRows.length,
    sources: sourceRows.length,
    relations: relationRows.length,
    relationCitations: relationCitationRows.length,
    journeys: journeyRows.length,
    journeyNodes: journeyNodeRows.length,
  },
}, null, 2));
