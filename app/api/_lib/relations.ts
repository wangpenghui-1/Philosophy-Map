import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { assertEditorialTransition, evaluateRelationQuality, type EditorialStatus, type RelationQualityInput } from "@atlas/domain";
import { and, eq, inArray, max } from "drizzle-orm";
import { assertMatchingEtag } from "./editorial";

type RelationInput = RelationQualityInput & { stableKey?: string; relationType: typeof databaseSchema.relations.$inferInsert.relationType; atlasVisibility: boolean };
function permission(to: EditorialStatus) { return to === "published" ? "knowledge:publish" as const : to === "reviewed" ? "knowledge:review:complete" as const : "knowledge:draft:edit" as const; }
async function resolveSources(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await getDatabase().select({ id: databaseSchema.sources.stableKey, versionId: databaseSchema.sources.currentPublishedVersionId }).from(databaseSchema.sources).where(inArray(databaseSchema.sources.stableKey, ids));
  const found = new Map(rows.filter((row): row is typeof row & { versionId: string } => Boolean(row.versionId)).map((row) => [row.id, row.versionId])); const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw Object.assign(new Error(`引用了不存在的来源：${missing.join("、")}`), { status: 422 });
  return found;
}
export async function createRelationDraft(principal: AuthPrincipal, input: RelationInput & { stableKey: string }) {
  requirePermission(principal, "knowledge:candidate:create"); const sourceVersions = await resolveSources(input.citations.map((item) => item.sourceId));
  const db = getDatabase(); return db.transaction(async (tx) => {
    const endpoints = await tx.select().from(databaseSchema.entities).where(inArray(databaseSchema.entities.stableKey, [input.fromEntityId, input.toEntityId]));
    const from = endpoints.find((item) => item.stableKey === input.fromEntityId); const to = endpoints.find((item) => item.stableKey === input.toEntityId);
    if (!from || !to || from.id === to.id) throw Object.assign(new Error("关系端点不存在或重复。"), { status: 422 });
    const [existing] = await tx.select().from(databaseSchema.relations).where(eq(databaseSchema.relations.stableKey, input.stableKey)).limit(1);
    if (existing) throw Object.assign(new Error("Stable key 已存在；请从现有已发布关系创建后继修订。"), { status: 409 });
    const relation = (await tx.insert(databaseSchema.relations).values({ stableKey: input.stableKey, fromEntityId: from.id, toEntityId: to.id, directed: input.directed, relationType: input.relationType }).returning())[0];
    const [latest] = await tx.select({ value: max(databaseSchema.relationVersions.version) }).from(databaseSchema.relationVersions).where(eq(databaseSchema.relationVersions.relationId, relation.id));
    const [version] = await tx.insert(databaseSchema.relationVersions).values({ relationId: relation.id, version: (latest?.value ?? 0) + 1, title: input.title, explanation: input.explanation, note: input.note, evidenceStatus: input.evidenceStatus, editorialStatus: "candidate", atlasVisibility: input.atlasVisibility }).returning();
    if (input.citations.length) await tx.insert(databaseSchema.citations).values(input.citations.map((item) => ({ relationVersionId: version.id, sourceVersionId: sourceVersions.get(item.sourceId)!, locator: item.locator, claim: item.claim })));
    await tx.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: "relation-version.created", resourceType: "relation-version", resourceId: version.id, metadata: { ...input, relationId: relation.id } });
    return version;
  });
}
export async function updateRelationDraft(principal: AuthPrincipal, id: string, request: Request, input: Partial<RelationInput>) {
  requirePermission(principal, "knowledge:draft:edit"); const sourceVersions = input.citations ? await resolveSources(input.citations.map((item) => item.sourceId)) : null;
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(databaseSchema.relationVersions).where(eq(databaseSchema.relationVersions.id, id)).limit(1);
    if (!current) return null; if (["reviewed", "published"].includes(current.editorialStatus)) throw Object.assign(new Error("已复核和已发布关系不可原位修改。"), { status: 409 });
    assertMatchingEtag(request, current); const { citations, ...fields } = input;
    const [updated] = await tx.update(databaseSchema.relationVersions).set({ ...fields, updatedAt: new Date() }).where(eq(databaseSchema.relationVersions.id, id)).returning();
    if (input.citations && sourceVersions) { await tx.delete(databaseSchema.citations).where(eq(databaseSchema.citations.relationVersionId, id)); if (input.citations.length) await tx.insert(databaseSchema.citations).values(input.citations.map((item) => ({ relationVersionId: id, sourceVersionId: sourceVersions.get(item.sourceId)!, locator: item.locator, claim: item.claim }))); }
    await tx.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: "relation-version.updated", resourceType: "relation-version", resourceId: id, metadata: citations ? { citations } : {} });
    return updated;
  });
}
export async function transitionRelationVersion(principal: AuthPrincipal, id: string, request: Request, to: EditorialStatus, note?: string) {
  requirePermission(principal, permission(to)); const db = getDatabase(); return db.transaction(async (tx) => {
    const [current] = await tx.select().from(databaseSchema.relationVersions).where(eq(databaseSchema.relationVersions.id, id)).limit(1); if (!current) return null;
    const [relation] = await tx.select().from(databaseSchema.relations).where(eq(databaseSchema.relations.id, current.relationId)).limit(1); if (!relation) return null;
    assertMatchingEtag(request, current); assertEditorialTransition(current.editorialStatus, to);
    const citations = await tx.select({ sourceId: databaseSchema.sources.stableKey, locator: databaseSchema.citations.locator, claim: databaseSchema.citations.claim }).from(databaseSchema.citations).innerJoin(databaseSchema.sourceVersions, eq(databaseSchema.sourceVersions.id, databaseSchema.citations.sourceVersionId)).innerJoin(databaseSchema.sources, eq(databaseSchema.sources.id, databaseSchema.sourceVersions.sourceId)).where(eq(databaseSchema.citations.relationVersionId, id));
    if (to === "published") { const quality = evaluateRelationQuality({ ...current, fromEntityId: relation.fromEntityId, toEntityId: relation.toEntityId, directed: relation.directed, relationType: relation.relationType, citations }); if (!quality.readyToPublish) throw Object.assign(new Error(quality.findings.filter((x) => x.severity === "blocker").map((x) => x.message).join(" ")), { status: 422 }); }
    const now = new Date(); const [updated] = await tx.update(databaseSchema.relationVersions).set({ editorialStatus: to, reviewedBy: to === "reviewed" ? principal.subject! : current.reviewedBy, reviewedAt: to === "reviewed" ? now : current.reviewedAt, publishedAt: to === "published" ? now : current.publishedAt, updatedAt: now }).where(eq(databaseSchema.relationVersions.id, id)).returning();
    if (to === "published") { await tx.update(databaseSchema.relations).set({ currentPublishedVersionId: id, updatedAt: now }).where(eq(databaseSchema.relations.id, relation.id)); await tx.insert(databaseSchema.outboxEvents).values({ aggregateType: "relation", aggregateId: relation.id, eventType: "knowledge.relation.published", payload: { relationId: relation.id, relationVersionId: id } }); }
    await tx.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: `relation-version.${to}`, resourceType: "relation-version", resourceId: id, metadata: { from: current.editorialStatus, to, note } }); return updated;
  });
}

export async function createRelationRevision(principal: AuthPrincipal, id: string) {
  requirePermission(principal, "knowledge:candidate:create");
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(databaseSchema.relationVersions).where(and(
      eq(databaseSchema.relationVersions.id, id),
      eq(databaseSchema.relationVersions.editorialStatus, "published"),
    )).limit(1);
    if (!current) return null;
    const [latest] = await tx.select({ value: max(databaseSchema.relationVersions.version) })
      .from(databaseSchema.relationVersions)
      .where(eq(databaseSchema.relationVersions.relationId, current.relationId));
    const [revision] = await tx.insert(databaseSchema.relationVersions).values({
      relationId: current.relationId,
      version: (latest?.value ?? current.version) + 1,
      locale: current.locale,
      title: current.title,
      explanation: current.explanation,
      note: current.note,
      evidenceStatus: current.evidenceStatus,
      editorialStatus: "candidate",
      atlasVisibility: current.atlasVisibility,
    }).returning();
    const citations = await tx.select({
      sourceVersionId: databaseSchema.citations.sourceVersionId,
      locator: databaseSchema.citations.locator,
      claim: databaseSchema.citations.claim,
      displayAnchor: databaseSchema.citations.displayAnchor,
    }).from(databaseSchema.citations).where(eq(databaseSchema.citations.relationVersionId, current.id));
    if (citations.length) {
      await tx.insert(databaseSchema.citations).values(citations.map((citation) => ({
        relationVersionId: revision.id,
        ...citation,
      })));
    }
    await tx.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "relation-version.revision-created",
      resourceType: "relation-version", resourceId: revision.id,
      metadata: { relationId: current.relationId, sourceVersionId: current.id },
    });
    return revision;
  });
}
