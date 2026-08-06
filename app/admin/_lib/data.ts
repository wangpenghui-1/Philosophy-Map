import type { AuthPrincipal } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { evaluateEditorialQuality, type EditorialStatus, type EntityType } from "@atlas/domain";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { knowledgeBase, knowledgeIndex } from "../../_data/knowledge";

export interface AdminContentRow {
  id: string;
  stableKey: string;
  entityType: EntityType;
  title: string;
  slug: string;
  locale: string;
  version: number;
  status: EditorialStatus;
  contentTier: "index" | "standard" | "deep";
  updatedAt?: Date;
  publicHref?: string;
}

export interface AdminSourceOption {
  id: string;
  title: string;
  publication: string;
  language: string;
}

export interface AdminSourceRow extends AdminSourceOption {
  versionId: string;
  version: number;
  status: EditorialStatus;
  sourceType: string;
  url?: string | null;
  updatedAt: Date;
}

interface AdminDashboardData {
  mode: "local-preview" | "database";
  catalog: Record<string, number>;
  statusCounts: Record<EditorialStatus, number>;
  recent: AdminContentRow[];
}

const snapshotCatalog = {
  people: knowledgeBase.people.length,
  concepts: knowledgeBase.concepts.length,
  traditions: knowledgeBase.traditions.length,
  works: knowledgeBase.works.length,
  sources: knowledgeBase.sources.length,
  relations: knowledgeBase.relations.length,
};

function previewRows() {
  return knowledgeIndex.map<AdminContentRow>((item) => ({
    id: item.id,
    stableKey: item.id,
    entityType: item.entityType,
    title: item.title,
    slug: item.slug,
    locale: "zh-CN",
    version: 1,
    status: "published",
    contentTier: item.contentTier,
    publicHref: item.href,
  }));
}

function previewVersion(id: string) {
  const indexItem = knowledgeIndex.find((item) => item.id === id);
  if (!indexItem) return null;
  const directories = {
    person: knowledgeBase.people,
    concept: knowledgeBase.concepts,
    tradition: knowledgeBase.traditions,
    work: knowledgeBase.works,
  } as const;
  const record = directories[indexItem.entityType].find((item) => item.id === id);
  if (!record) return null;
  const reviewedAt = record.lastReviewedAt
    ? new Date(`${record.lastReviewedAt}T00:00:00.000Z`)
    : new Date(0);
  return {
    id: record.id,
    entityId: record.id,
    currentPublishedVersionId: record.id,
    stableKey: record.id,
    entityType: record.entityType,
    title: indexItem.title,
    slug: record.slug,
    summary: record.summary,
    locale: "zh-CN",
    version: record.version,
    editorialStatus: record.editorialStatus,
    contentTier: record.contentTier,
    payload: record,
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
  };
}

export async function getAdminDashboard(principal: AuthPrincipal): Promise<AdminDashboardData> {
  if (principal.mode === "local-preview") {
    return {
      mode: "local-preview" as const,
      catalog: snapshotCatalog,
      statusCounts: { candidate: 0, edited: 0, reviewed: 0, published: knowledgeIndex.length },
      recent: previewRows().slice(0, 8),
    };
  }

  const database = getDatabase();
  const statusRows = await database.select({
    status: databaseSchema.entityVersions.editorialStatus,
    value: count(),
  }).from(databaseSchema.entityVersions).groupBy(databaseSchema.entityVersions.editorialStatus);
  const statusCounts = { candidate: 0, edited: 0, reviewed: 0, published: 0 };
  for (const row of statusRows) statusCounts[row.status] = row.value;
  const [entityCount] = await database.select({ value: count() }).from(databaseSchema.entities);
  const [sourceCount] = await database.select({ value: count() }).from(databaseSchema.sources);
  const [relationCount] = await database.select({ value: count() }).from(databaseSchema.relations);
  const recent = await database.select({
    id: databaseSchema.entityVersions.id,
    stableKey: databaseSchema.entities.stableKey,
    entityType: databaseSchema.entities.entityType,
    title: databaseSchema.entityVersions.title,
    slug: databaseSchema.entityVersions.slug,
    locale: databaseSchema.entityVersions.locale,
    version: databaseSchema.entityVersions.version,
    status: databaseSchema.entityVersions.editorialStatus,
    contentTier: databaseSchema.entityVersions.contentTier,
    updatedAt: databaseSchema.entityVersions.updatedAt,
  }).from(databaseSchema.entityVersions)
    .innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.entityVersions.entityId))
    .orderBy(desc(databaseSchema.entityVersions.updatedAt)).limit(8);

  return {
    mode: "database" as const,
    catalog: { entities: entityCount.value, sources: sourceCount.value, relations: relationCount.value },
    statusCounts,
    recent,
  };
}

export async function listAdminContent(
  principal: AuthPrincipal,
  filters: { q?: string; status?: EditorialStatus | "all"; type?: EntityType | "all" },
): Promise<AdminContentRow[]> {
  if (principal.mode === "local-preview") {
    const query = filters.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    return previewRows().filter((row) =>
      (!query || `${row.title} ${row.slug} ${row.stableKey}`.toLocaleLowerCase("zh-CN").includes(query))
      && (!filters.type || filters.type === "all" || row.entityType === filters.type)
      && (!filters.status || filters.status === "all" || filters.status === "published"),
    ).slice(0, 120);
  }

  const conditions = [];
  if (filters.q?.trim()) conditions.push(ilike(databaseSchema.entityVersions.title, `%${filters.q.trim()}%`));
  if (filters.status && filters.status !== "all") conditions.push(eq(databaseSchema.entityVersions.editorialStatus, filters.status));
  if (filters.type && filters.type !== "all") conditions.push(eq(databaseSchema.entities.entityType, filters.type));
  return getDatabase().select({
    id: databaseSchema.entityVersions.id,
    stableKey: databaseSchema.entities.stableKey,
    entityType: databaseSchema.entities.entityType,
    title: databaseSchema.entityVersions.title,
    slug: databaseSchema.entityVersions.slug,
    locale: databaseSchema.entityVersions.locale,
    version: databaseSchema.entityVersions.version,
    status: databaseSchema.entityVersions.editorialStatus,
    contentTier: databaseSchema.entityVersions.contentTier,
    updatedAt: databaseSchema.entityVersions.updatedAt,
  }).from(databaseSchema.entityVersions)
    .innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.entityVersions.entityId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(databaseSchema.entityVersions.updatedAt)).limit(120);
}

export async function getAdminVersion(principal: AuthPrincipal, id: string) {
  if (principal.mode === "local-preview") return previewVersion(id);
  const [record] = await getDatabase().select({
    id: databaseSchema.entityVersions.id,
    entityId: databaseSchema.entityVersions.entityId,
    currentPublishedVersionId: databaseSchema.entities.currentPublishedVersionId,
    stableKey: databaseSchema.entities.stableKey,
    entityType: databaseSchema.entities.entityType,
    title: databaseSchema.entityVersions.title,
    slug: databaseSchema.entityVersions.slug,
    summary: databaseSchema.entityVersions.summary,
    locale: databaseSchema.entityVersions.locale,
    version: databaseSchema.entityVersions.version,
    editorialStatus: databaseSchema.entityVersions.editorialStatus,
    contentTier: databaseSchema.entityVersions.contentTier,
    payload: databaseSchema.entityVersions.payload,
    createdAt: databaseSchema.entityVersions.createdAt,
    updatedAt: databaseSchema.entityVersions.updatedAt,
  }).from(databaseSchema.entityVersions)
    .innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.entityVersions.entityId))
    .where(eq(databaseSchema.entityVersions.id, id)).limit(1);
  return record ?? null;
}

export async function getAdminVersionHistory(principal: AuthPrincipal, entityId: string) {
  if (principal.mode === "local-preview") {
    const version = previewVersion(entityId);
    return version ? [{
      id: version.id,
      version: version.version,
      locale: version.locale,
      title: version.title,
      editorialStatus: version.editorialStatus,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      publishedAt: version.updatedAt,
      supersedesVersionId: null,
      currentPublishedVersionId: version.currentPublishedVersionId,
    }] : [];
  }
  return getDatabase().select({
    id: databaseSchema.entityVersions.id,
    version: databaseSchema.entityVersions.version,
    locale: databaseSchema.entityVersions.locale,
    title: databaseSchema.entityVersions.title,
    editorialStatus: databaseSchema.entityVersions.editorialStatus,
    createdAt: databaseSchema.entityVersions.createdAt,
    updatedAt: databaseSchema.entityVersions.updatedAt,
    publishedAt: databaseSchema.entityVersions.publishedAt,
    supersedesVersionId: databaseSchema.entityVersions.supersedesVersionId,
    currentPublishedVersionId: databaseSchema.entities.currentPublishedVersionId,
  }).from(databaseSchema.entityVersions)
    .innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.entityVersions.entityId))
    .where(eq(databaseSchema.entityVersions.entityId, entityId))
    .orderBy(desc(databaseSchema.entityVersions.version));
}

export function getAdminQualityReport(version: NonNullable<Awaited<ReturnType<typeof getAdminVersion>>>) {
  return evaluateEditorialQuality(version);
}

export async function getAdminSourceOptions(principal: AuthPrincipal): Promise<AdminSourceOption[]> {
  if (principal.mode === "local-preview") {
    return knowledgeBase.sources.map((source) => ({
      id: source.id,
      title: source.title,
      publication: source.publication,
      language: source.language,
    })).sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
  }
  return getDatabase().select({
    id: databaseSchema.sources.stableKey,
    title: databaseSchema.sourceVersions.title,
    publication: databaseSchema.sourceVersions.publication,
    language: databaseSchema.sourceVersions.language,
  }).from(databaseSchema.sources)
    .innerJoin(
      databaseSchema.sourceVersions,
      eq(databaseSchema.sourceVersions.id, databaseSchema.sources.currentPublishedVersionId),
    )
    .orderBy(databaseSchema.sourceVersions.title);
}

function previewSourceVersion(id: string) {
  const source = knowledgeBase.sources.find((item) => item.id === id);
  if (!source) return null;
  const updatedAt = source.lastReviewedAt ? new Date(`${source.lastReviewedAt}T00:00:00.000Z`) : new Date(0);
  return {
    id: source.id, sourceId: source.id, stableKey: source.id, currentPublishedVersionId: source.id,
    version: source.version, title: source.title, authors: source.authors, sourceType: source.sourceType,
    publication: source.publication, publicationYear: source.year ?? null, url: source.url ?? null,
    doi: source.doi ?? null, isbn: source.isbn ?? null, language: source.language,
    editorialStatus: source.editorialStatus, payload: source, createdAt: updatedAt, updatedAt,
  };
}

export async function listAdminSources(principal: AuthPrincipal, filters: { q?: string; status?: EditorialStatus | "all" } = {}): Promise<AdminSourceRow[]> {
  if (principal.mode === "local-preview") {
    const query = filters.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
    return knowledgeBase.sources.filter((source) => !query || `${source.title} ${source.id} ${source.authors.join(" ")}`.toLocaleLowerCase("zh-CN").includes(query))
      .map((source) => {
        const version = previewSourceVersion(source.id)!;
        return { id: source.id, versionId: source.id, title: source.title, publication: source.publication, language: source.language,
          version: source.version, status: source.editorialStatus, sourceType: source.sourceType, url: source.url, updatedAt: version.updatedAt };
      }).slice(0, 150);
  }
  const conditions = [];
  if (filters.q?.trim()) conditions.push(ilike(databaseSchema.sourceVersions.title, `%${filters.q.trim()}%`));
  if (filters.status && filters.status !== "all") conditions.push(eq(databaseSchema.sourceVersions.editorialStatus, filters.status));
  return getDatabase().select({
    id: databaseSchema.sources.stableKey, versionId: databaseSchema.sourceVersions.id, title: databaseSchema.sourceVersions.title,
    publication: databaseSchema.sourceVersions.publication, language: databaseSchema.sourceVersions.language,
    version: databaseSchema.sourceVersions.version, status: databaseSchema.sourceVersions.editorialStatus,
    sourceType: databaseSchema.sourceVersions.sourceType, url: databaseSchema.sourceVersions.url, updatedAt: databaseSchema.sourceVersions.updatedAt,
  }).from(databaseSchema.sourceVersions).innerJoin(databaseSchema.sources, eq(databaseSchema.sources.id, databaseSchema.sourceVersions.sourceId))
    .where(conditions.length ? and(...conditions) : undefined).orderBy(desc(databaseSchema.sourceVersions.updatedAt)).limit(150);
}

export async function getAdminSourceVersion(principal: AuthPrincipal, id: string) {
  if (principal.mode === "local-preview") return previewSourceVersion(id);
  const [record] = await getDatabase().select({
    id: databaseSchema.sourceVersions.id, sourceId: databaseSchema.sourceVersions.sourceId,
    stableKey: databaseSchema.sources.stableKey, currentPublishedVersionId: databaseSchema.sources.currentPublishedVersionId,
    version: databaseSchema.sourceVersions.version, title: databaseSchema.sourceVersions.title, authors: databaseSchema.sourceVersions.authors,
    sourceType: databaseSchema.sourceVersions.sourceType, publication: databaseSchema.sourceVersions.publication,
    publicationYear: databaseSchema.sourceVersions.publicationYear, url: databaseSchema.sourceVersions.url,
    doi: databaseSchema.sourceVersions.doi, isbn: databaseSchema.sourceVersions.isbn, language: databaseSchema.sourceVersions.language,
    editorialStatus: databaseSchema.sourceVersions.editorialStatus, payload: databaseSchema.sourceVersions.payload,
    createdAt: databaseSchema.sourceVersions.createdAt, updatedAt: databaseSchema.sourceVersions.updatedAt,
  }).from(databaseSchema.sourceVersions).innerJoin(databaseSchema.sources, eq(databaseSchema.sources.id, databaseSchema.sourceVersions.sourceId))
    .where(eq(databaseSchema.sourceVersions.id, id)).limit(1);
  return record ?? null;
}

export async function getAdminSourceHistory(principal: AuthPrincipal, sourceId: string) {
  if (principal.mode === "local-preview") {
    const record = previewSourceVersion(sourceId);
    return record ? [record] : [];
  }
  return getDatabase().select({
    id: databaseSchema.sourceVersions.id, version: databaseSchema.sourceVersions.version,
    title: databaseSchema.sourceVersions.title, editorialStatus: databaseSchema.sourceVersions.editorialStatus,
    updatedAt: databaseSchema.sourceVersions.updatedAt,
  }).from(databaseSchema.sourceVersions).where(eq(databaseSchema.sourceVersions.sourceId, sourceId))
    .orderBy(desc(databaseSchema.sourceVersions.version));
}

const previewEntityTitle = new Map([
  ...knowledgeBase.people.map((item) => [item.id, item.names.display] as const), ...knowledgeBase.concepts.map((item) => [item.id, item.name] as const),
  ...knowledgeBase.traditions.map((item) => [item.id, item.name] as const), ...knowledgeBase.works.map((item) => [item.id, item.title] as const),
]);

async function getDatabaseEntityTitles(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await getDatabase().select({
    id: databaseSchema.entities.id,
    title: databaseSchema.entityVersions.title,
  }).from(databaseSchema.entities)
    .innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId))
    .where(inArray(databaseSchema.entities.id, ids));
  return new Map(rows.map((row) => [row.id, row.title]));
}

export async function listAdminRelations(principal: AuthPrincipal) {
  if (principal.mode === "local-preview") return knowledgeBase.relations.map((item) => ({ id: item.id, versionId: item.id, title: item.title, directed: item.directed, relationType: item.relationType, evidenceStatus: item.evidenceStatus, status: item.editorialStatus, fromTitle: previewEntityTitle.get(item.from.id) ?? item.from.id, toTitle: previewEntityTitle.get(item.to.id) ?? item.to.id }));
  const rows = await getDatabase().select({ id: databaseSchema.relations.stableKey, versionId: databaseSchema.relationVersions.id, title: databaseSchema.relationVersions.title, directed: databaseSchema.relations.directed, relationType: databaseSchema.relations.relationType, evidenceStatus: databaseSchema.relationVersions.evidenceStatus, status: databaseSchema.relationVersions.editorialStatus, fromEntityId: databaseSchema.relations.fromEntityId, toEntityId: databaseSchema.relations.toEntityId }).from(databaseSchema.relationVersions).innerJoin(databaseSchema.relations, eq(databaseSchema.relations.id, databaseSchema.relationVersions.relationId)).orderBy(desc(databaseSchema.relationVersions.updatedAt)).limit(150);
  const titles = await getDatabaseEntityTitles([...new Set(rows.flatMap((row) => [row.fromEntityId, row.toEntityId]))]);
  return rows.map((row) => ({ ...row, fromTitle: titles.get(row.fromEntityId) ?? row.fromEntityId, toTitle: titles.get(row.toEntityId) ?? row.toEntityId }));
}
export async function getAdminRelationVersion(principal: AuthPrincipal, id: string) {
  if (principal.mode === "local-preview") {
    const item = knowledgeBase.relations.find((relation) => relation.id === id); if (!item) return null; const date = new Date(`${item.lastReviewedAt ?? "1970-01-01"}T00:00:00.000Z`);
    return { id: item.id, relationId: item.id, currentPublishedVersionId: item.id, stableKey: item.id, version: item.version, title: item.title, explanation: item.explanation, note: item.note ?? null, directed: item.directed, relationType: item.relationType, evidenceStatus: item.evidenceStatus as "established" | "supported" | "disputed", editorialStatus: item.editorialStatus, atlasVisibility: item.atlasVisibility, fromEntityId: item.from.id, toEntityId: item.to.id, fromTitle: previewEntityTitle.get(item.from.id) ?? item.from.id, toTitle: previewEntityTitle.get(item.to.id) ?? item.to.id, citations: item.citations, updatedAt: date };
  }
  const [record] = await getDatabase().select({ id: databaseSchema.relationVersions.id, relationId: databaseSchema.relations.id, stableKey: databaseSchema.relations.stableKey, currentPublishedVersionId: databaseSchema.relations.currentPublishedVersionId, version: databaseSchema.relationVersions.version, title: databaseSchema.relationVersions.title, explanation: databaseSchema.relationVersions.explanation, note: databaseSchema.relationVersions.note, directed: databaseSchema.relations.directed, relationType: databaseSchema.relations.relationType, evidenceStatus: databaseSchema.relationVersions.evidenceStatus, editorialStatus: databaseSchema.relationVersions.editorialStatus, atlasVisibility: databaseSchema.relationVersions.atlasVisibility, fromEntityId: databaseSchema.relations.fromEntityId, toEntityId: databaseSchema.relations.toEntityId, updatedAt: databaseSchema.relationVersions.updatedAt }).from(databaseSchema.relationVersions).innerJoin(databaseSchema.relations, eq(databaseSchema.relations.id, databaseSchema.relationVersions.relationId)).where(eq(databaseSchema.relationVersions.id, id)).limit(1); if (!record) return null;
  const [citations, titles] = await Promise.all([
    getDatabase().select({ sourceId: databaseSchema.sources.stableKey, locator: databaseSchema.citations.locator, claim: databaseSchema.citations.claim }).from(databaseSchema.citations).innerJoin(databaseSchema.sourceVersions, eq(databaseSchema.sourceVersions.id, databaseSchema.citations.sourceVersionId)).innerJoin(databaseSchema.sources, eq(databaseSchema.sources.id, databaseSchema.sourceVersions.sourceId)).where(eq(databaseSchema.citations.relationVersionId, id)),
    getDatabaseEntityTitles([record.fromEntityId, record.toEntityId]),
  ]);
  return { ...record, fromTitle: titles.get(record.fromEntityId) ?? record.fromEntityId, toTitle: titles.get(record.toEntityId) ?? record.toEntityId, citations };
}
export async function getAdminRelationHistory(principal: AuthPrincipal, relationId: string) {
  if (principal.mode === "local-preview") {
    const relation = await getAdminRelationVersion(principal, relationId);
    return relation ? [{ id: relation.id, version: relation.version, title: relation.title, editorialStatus: relation.editorialStatus, updatedAt: relation.updatedAt }] : [];
  }
  return getDatabase().select({
    id: databaseSchema.relationVersions.id,
    version: databaseSchema.relationVersions.version,
    title: databaseSchema.relationVersions.title,
    editorialStatus: databaseSchema.relationVersions.editorialStatus,
    updatedAt: databaseSchema.relationVersions.updatedAt,
  }).from(databaseSchema.relationVersions)
    .where(eq(databaseSchema.relationVersions.relationId, relationId))
    .orderBy(desc(databaseSchema.relationVersions.version));
}
export async function getAdminRelationEntityOptions(principal: AuthPrincipal) {
  if (principal.mode === "local-preview") return knowledgeIndex.map((item) => ({ id: item.id, title: item.title, entityType: item.entityType }));
  return getDatabase().select({ id: databaseSchema.entities.stableKey, title: databaseSchema.entityVersions.title, entityType: databaseSchema.entities.entityType }).from(databaseSchema.entities).innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId)).orderBy(databaseSchema.entityVersions.title);
}
