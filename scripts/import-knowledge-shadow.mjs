import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { getDatabase, closeDatabase, databaseSchema } from "../packages/db/src/index.ts";

const projectRoot = path.resolve(import.meta.dirname, "..");
const generatedRoot = path.join(projectRoot, "app", "_generated");
const apply = process.argv.includes("--apply");

const knowledge = JSON.parse(await readFile(path.join(generatedRoot, "knowledge.json"), "utf8"));
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

const manifest = Object.fromEntries([
  ...directories.map((directory) => [directory, knowledge[directory].length]),
  ["relations", knowledge.relations.length],
]);

for (const directory of directories) {
  for (const record of knowledge[directory]) {
    if (record.editorialStatus !== "published") {
      throw new Error(`Generated snapshot leaked non-published record ${directory}/${record.id}.`);
    }
  }
}
for (const relation of knowledge.relations) {
  if (relation.editorialStatus !== "published") {
    throw new Error(`Generated snapshot leaked non-published relation ${relation.id}.`);
  }
  if (relation.relationType === "thematic-resonance" && relation.directed) {
    throw new Error(`Thematic resonance ${relation.id} is directed.`);
  }
}

if (!apply) {
  console.log(JSON.stringify({ mode: "check", safeToImport: true, manifest }, null, 2));
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required with --apply.");
const database = getDatabase();

async function ensureEntity(transaction, record, entityType) {
  const [existing] = await transaction.select().from(databaseSchema.entities).where(and(
    eq(databaseSchema.entities.entityType, entityType),
    eq(databaseSchema.entities.stableKey, record.id),
  )).limit(1);
  const entity = existing ?? (await transaction.insert(databaseSchema.entities).values({
    stableKey: record.id,
    entityType,
  }).returning())[0];

  const slug = record.slug ?? record.id;
  const title = record.names?.display
    ?? record.name
    ?? record.title
    ?? record.historicalName
    ?? record.id;
  const summary = record.summary ?? record.depictionNote ?? title;
  const [existingVersion] = await transaction.select().from(databaseSchema.entityVersions).where(and(
    eq(databaseSchema.entityVersions.entityId, entity.id),
    eq(databaseSchema.entityVersions.version, record.version),
    eq(databaseSchema.entityVersions.locale, "zh-CN"),
  )).limit(1);
  const version = existingVersion ?? (await transaction.insert(databaseSchema.entityVersions).values({
    entityId: entity.id,
    version: record.version,
    locale: "zh-CN",
    slug,
    title,
    summary,
    contentTier: record.contentTier ?? "index",
    editorialStatus: record.editorialStatus,
    schemaVersion: 1,
    payload: record,
    editedBy: record.editedBy,
    reviewedBy: record.reviewedBy,
    reviewedAt: record.lastReviewedAt ? new Date(`${record.lastReviewedAt}T00:00:00Z`) : undefined,
    publishedAt: record.lastReviewedAt ? new Date(`${record.lastReviewedAt}T00:00:00Z`) : new Date(),
  }).returning())[0];
  if (record.editorialStatus === "published" && entity.currentPublishedVersionId !== version.id) {
    await transaction.update(databaseSchema.entities)
      .set({ currentPublishedVersionId: version.id, updatedAt: new Date() })
      .where(eq(databaseSchema.entities.id, entity.id));
  }
  return { entity, version };
}

await database.transaction(async (transaction) => {
  const entityMap = new Map();
  const sourceVersionMap = new Map();

  for (const directory of directories) {
    for (const record of knowledge[directory]) {
      const result = await ensureEntity(transaction, record, typeByDirectory[directory]);
      entityMap.set(record.id, result);

      if (directory === "sources") {
        const [existingSource] = await transaction.select().from(databaseSchema.sources)
          .where(eq(databaseSchema.sources.stableKey, record.id)).limit(1);
        const source = existingSource ?? (await transaction.insert(databaseSchema.sources)
          .values({ stableKey: record.id }).returning())[0];
        const [existingSourceVersion] = await transaction.select().from(databaseSchema.sourceVersions).where(and(
          eq(databaseSchema.sourceVersions.sourceId, source.id),
          eq(databaseSchema.sourceVersions.version, record.version),
        )).limit(1);
        const sourceVersion = existingSourceVersion ?? (await transaction.insert(databaseSchema.sourceVersions).values({
          sourceId: source.id,
          version: record.version,
          title: record.title,
          authors: record.authors,
          sourceType: record.sourceType,
          publication: record.publication,
          publicationYear: record.year,
          url: record.url,
          doi: record.doi,
          isbn: record.isbn,
          language: record.language,
          editorialStatus: record.editorialStatus,
          payload: record,
        }).returning())[0];
        sourceVersionMap.set(record.id, sourceVersion);
        if (source.currentPublishedVersionId !== sourceVersion.id) {
          await transaction.update(databaseSchema.sources)
            .set({ currentPublishedVersionId: sourceVersion.id, updatedAt: new Date() })
            .where(eq(databaseSchema.sources.id, source.id));
        }
      }
    }
  }

  for (const directory of directories.filter((value) => value !== "sources")) {
    for (const record of knowledge[directory]) {
      const mapped = entityMap.get(record.id);
      if (!mapped) continue;
      const fragments = record.sections?.flatMap((section, sectionIndex) => section.paragraphs.map((paragraph, paragraphIndex) => ({
        key: `${section.id}:${paragraphIndex}`,
        heading: section.heading,
        body: paragraph.text,
        ordinal: sectionIndex * 100 + paragraphIndex,
        citations: paragraph.citations,
      }))) ?? [{
        key: "summary:0",
        heading: null,
        body: record.summary ?? mapped.version.summary,
        ordinal: 0,
        citations: record.citations ?? [],
      }];
      for (const fragmentRecord of fragments) {
        const [existingFragment] = await transaction.select().from(databaseSchema.contentFragments).where(and(
          eq(databaseSchema.contentFragments.entityVersionId, mapped.version.id),
          eq(databaseSchema.contentFragments.fragmentKey, fragmentRecord.key),
        )).limit(1);
        const fragment = existingFragment ?? (await transaction.insert(databaseSchema.contentFragments).values({
          entityVersionId: mapped.version.id,
          fragmentKey: fragmentRecord.key,
          heading: fragmentRecord.heading,
          body: fragmentRecord.body,
          ordinal: fragmentRecord.ordinal,
        }).returning())[0];
        if (!existingFragment) {
          for (const citation of fragmentRecord.citations) {
            const sourceVersion = sourceVersionMap.get(citation.sourceId);
            if (!sourceVersion) throw new Error(`Missing source version ${citation.sourceId}.`);
            await transaction.insert(databaseSchema.citations).values({
              fragmentId: fragment.id,
              sourceVersionId: sourceVersion.id,
              locator: citation.locator,
              claim: citation.claim,
              displayAnchor: fragmentRecord.key,
            });
          }
        }
      }
    }
  }

  for (const record of knowledge.relations) {
    const from = entityMap.get(record.from.id)?.entity;
    const to = entityMap.get(record.to.id)?.entity;
    if (!from || !to) throw new Error(`Relation ${record.id} has a missing endpoint.`);
    const [existingRelation] = await transaction.select().from(databaseSchema.relations)
      .where(eq(databaseSchema.relations.stableKey, record.id)).limit(1);
    const relation = existingRelation ?? (await transaction.insert(databaseSchema.relations).values({
      stableKey: record.id,
      fromEntityId: from.id,
      toEntityId: to.id,
      directed: record.directed,
      relationType: record.relationType,
    }).returning())[0];
    const [existingVersion] = await transaction.select().from(databaseSchema.relationVersions).where(and(
      eq(databaseSchema.relationVersions.relationId, relation.id),
      eq(databaseSchema.relationVersions.version, record.version),
      eq(databaseSchema.relationVersions.locale, "zh-CN"),
    )).limit(1);
    const version = existingVersion ?? (await transaction.insert(databaseSchema.relationVersions).values({
      relationId: relation.id,
      version: record.version,
      locale: "zh-CN",
      title: record.title,
      explanation: record.explanation,
      note: record.note,
      evidenceStatus: record.evidenceStatus,
      editorialStatus: record.editorialStatus,
      atlasVisibility: record.atlasVisibility,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.lastReviewedAt ? new Date(`${record.lastReviewedAt}T00:00:00Z`) : undefined,
      publishedAt: new Date(),
    }).returning())[0];
    if (!existingVersion) {
      for (const citation of record.citations) {
        const sourceVersion = sourceVersionMap.get(citation.sourceId);
        if (!sourceVersion) throw new Error(`Missing relation source ${citation.sourceId}.`);
        await transaction.insert(databaseSchema.citations).values({
          relationVersionId: version.id,
          sourceVersionId: sourceVersion.id,
          locator: citation.locator,
          claim: citation.claim,
        });
      }
    }
    await transaction.update(databaseSchema.relations)
      .set({ currentPublishedVersionId: version.id, updatedAt: new Date() })
      .where(eq(databaseSchema.relations.id, relation.id));
  }
});

console.log(JSON.stringify({ mode: "apply", imported: true, manifest }, null, 2));
await closeDatabase();
