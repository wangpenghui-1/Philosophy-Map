import type { AuthPrincipal } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { evaluateEditorialQuality, type EditorialStatus, type EntityType } from "@atlas/domain";
import { and, count, desc, eq, ilike } from "drizzle-orm";
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
