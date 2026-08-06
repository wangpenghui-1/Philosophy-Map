import type { AuthPrincipal } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import type { EditorialStatus, EntityType } from "@atlas/domain";
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
  if (principal.mode === "local-preview") return null;
  const [record] = await getDatabase().select({
    id: databaseSchema.entityVersions.id,
    entityId: databaseSchema.entityVersions.entityId,
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
