import { createHash } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import { assertEditorialTransition, type EditorialStatus } from "@atlas/domain";
import { databaseSchema, getDatabase } from "@atlas/db";

export function versionEtag(record: { id: string; updatedAt: Date }) {
  const digest = createHash("sha256").update(`${record.id}:${record.updatedAt.toISOString()}`).digest("hex").slice(0, 20);
  return `W/"${digest}"`;
}

export function assertMatchingEtag(request: Request, record: { id: string; updatedAt: Date }) {
  const provided = request.headers.get("if-match");
  if (!provided) throw Object.assign(new Error("If-Match header is required."), { status: 428 });
  if (provided !== versionEtag(record)) throw Object.assign(new Error("The draft changed after it was loaded."), { status: 412 });
}

export async function createEntityDraft(
  principal: AuthPrincipal,
  input: {
    stableKey: string;
    entityType: "person" | "concept" | "tradition" | "work" | "context" | "place";
    slug: string;
    locale: string;
    title: string;
    summary: string;
    contentTier: "index" | "standard" | "deep";
    payload: Record<string, unknown>;
  },
) {
  requirePermission(principal, "knowledge:candidate:create");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [existing] = await transaction.select().from(databaseSchema.entities).where(and(
      eq(databaseSchema.entities.entityType, input.entityType),
      eq(databaseSchema.entities.stableKey, input.stableKey),
    )).limit(1);
    const entity = existing ?? (await transaction.insert(databaseSchema.entities).values({
      stableKey: input.stableKey,
      entityType: input.entityType,
    }).returning())[0];
    const [latest] = await transaction.select({ value: max(databaseSchema.entityVersions.version) })
      .from(databaseSchema.entityVersions)
      .where(and(
        eq(databaseSchema.entityVersions.entityId, entity.id),
        eq(databaseSchema.entityVersions.locale, input.locale),
      ));
    const [version] = await transaction.insert(databaseSchema.entityVersions).values({
      entityId: entity.id,
      version: (latest?.value ?? 0) + 1,
      locale: input.locale,
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      contentTier: input.contentTier,
      editorialStatus: "candidate",
      payload: { ...input.payload, editorialStatus: "candidate" },
      createdBy: principal.subject!,
    }).returning();
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!,
      actorRole: principal.role,
      action: "entity-version.created",
      resourceType: "entity-version",
      resourceId: version.id,
      metadata: { entityId: entity.id, stableKey: input.stableKey },
    });
    return version;
  });
}

export async function updateEntityDraft(
  principal: AuthPrincipal,
  id: string,
  request: Request,
  input: Partial<{
    slug: string;
    title: string;
    summary: string;
    contentTier: "index" | "standard" | "deep";
    payload: Record<string, unknown>;
  }>,
) {
  requirePermission(principal, "knowledge:draft:edit");
  const database = getDatabase();
  const [current] = await database.select().from(databaseSchema.entityVersions)
    .where(eq(databaseSchema.entityVersions.id, id)).limit(1);
  if (!current) return null;
  if (current.editorialStatus === "published" || current.editorialStatus === "reviewed") {
    throw Object.assign(new Error("Reviewed and published versions are immutable."), { status: 409 });
  }
  assertMatchingEtag(request, current);
  const [updated] = await database.update(databaseSchema.entityVersions).set({
    ...input,
    payload: input.payload ? { ...input.payload, editorialStatus: current.editorialStatus } : undefined,
    updatedAt: new Date(),
  }).where(eq(databaseSchema.entityVersions.id, id)).returning();
  await database.insert(databaseSchema.auditEvents).values({
    actorId: principal.subject!,
    actorRole: principal.role,
    action: "entity-version.updated",
    resourceType: "entity-version",
    resourceId: id,
  });
  return updated;
}

function permissionForTransition(to: EditorialStatus) {
  if (to === "edited") return "knowledge:draft:edit" as const;
  if (to === "reviewed") return "knowledge:review:complete" as const;
  if (to === "published") return "knowledge:publish" as const;
  return "knowledge:draft:edit" as const;
}

export async function transitionEntityVersion(
  principal: AuthPrincipal,
  id: string,
  request: Request,
  to: EditorialStatus,
  note?: string,
) {
  requirePermission(principal, permissionForTransition(to));
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(databaseSchema.entityVersions)
      .where(eq(databaseSchema.entityVersions.id, id)).limit(1);
    if (!current) return null;
    assertMatchingEtag(request, current);
    assertEditorialTransition(current.editorialStatus, to);
    const now = new Date();
    const [updated] = await transaction.update(databaseSchema.entityVersions).set({
      editorialStatus: to,
      reviewedBy: to === "reviewed" ? principal.subject! : current.reviewedBy,
      reviewedAt: to === "reviewed" ? now : current.reviewedAt,
      publishedAt: to === "published" ? now : current.publishedAt,
      updatedAt: now,
    }).where(eq(databaseSchema.entityVersions.id, id)).returning();
    if (to === "published") {
      await transaction.update(databaseSchema.entities)
        .set({ currentPublishedVersionId: id, updatedAt: now })
        .where(eq(databaseSchema.entities.id, current.entityId));
      await transaction.insert(databaseSchema.publicationEvents).values({
        entityId: current.entityId,
        entityVersionId: id,
        action: "published",
        actorId: principal.subject!,
        reason: note,
      });
      await transaction.insert(databaseSchema.outboxEvents).values({
        aggregateType: "entity",
        aggregateId: current.entityId,
        eventType: "knowledge.entity.published",
        payload: { entityId: current.entityId, entityVersionId: id, locale: current.locale },
      });
    }
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!,
      actorRole: principal.role,
      action: `entity-version.${to}`,
      resourceType: "entity-version",
      resourceId: id,
      metadata: { from: current.editorialStatus, to, note },
    });
    return updated;
  });
}
