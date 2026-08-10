import { createHash } from "node:crypto";
import { and, eq, inArray, max } from "drizzle-orm";
import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import {
  assertEditorialTransition,
  auditPayloadCitations,
  evaluateEditorialQuality,
  type EditorialStatus,
} from "@atlas/domain";
import { databaseSchema, getDatabase } from "@atlas/db";

async function assertPayloadCitationsAreValid(payload: unknown) {
  const audit = auditPayloadCitations(payload);
  if (audit.errors.length) throw Object.assign(new Error(audit.errors.join(" ")), { status: 422 });
  if (!audit.sourceIds.length) return;
  const rows = await getDatabase().select({ stableKey: databaseSchema.sources.stableKey })
    .from(databaseSchema.sources)
    .where(inArray(databaseSchema.sources.stableKey, audit.sourceIds));
  const found = new Set(rows.map((row) => row.stableKey));
  const missing = audit.sourceIds.filter((sourceId) => !found.has(sourceId));
  if (missing.length) {
    throw Object.assign(new Error(`引用了不存在的来源：${missing.join("、")}`), { status: 422 });
  }
}

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
  await assertPayloadCitationsAreValid(input.payload);
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
  if (input.payload) await assertPayloadCitationsAreValid(input.payload);
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
    if (to === "published") {
      const [entity] = await transaction.select({ entityType: databaseSchema.entities.entityType })
        .from(databaseSchema.entities)
        .where(eq(databaseSchema.entities.id, current.entityId)).limit(1);
      if (!entity) return null;
      const quality = evaluateEditorialQuality({ ...current, entityType: entity.entityType });
      if (!quality.readyToPublish) {
        const detail = quality.findings
          .filter((finding) => finding.severity === "blocker")
          .map((finding) => finding.message)
          .join(" ");
        throw Object.assign(new Error(detail), { status: 422, quality });
      }
    }
    const now = new Date();
    const payload = current.payload && typeof current.payload === "object" && !Array.isArray(current.payload)
      ? { ...current.payload as Record<string, unknown>, editorialStatus: to }
      : { editorialStatus: to };
    const returningToDraft = current.editorialStatus === "reviewed" && to === "edited";
    const [updated] = await transaction.update(databaseSchema.entityVersions).set({
      editorialStatus: to,
      payload,
      reviewedBy: to === "reviewed" ? principal.subject! : returningToDraft ? null : current.reviewedBy,
      reviewedAt: to === "reviewed" ? now : returningToDraft ? null : current.reviewedAt,
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

export async function createEntityRevision(
  principal: AuthPrincipal,
  sourceVersionId: string,
  note?: string,
) {
  requirePermission(principal, "knowledge:candidate:create");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [source] = await transaction.select().from(databaseSchema.entityVersions)
      .where(eq(databaseSchema.entityVersions.id, sourceVersionId)).limit(1);
    if (!source) return null;
    if (source.editorialStatus !== "published") {
      throw Object.assign(new Error("只能从不可变的已发布版本创建新修订。"), { status: 409 });
    }
    const [entity] = await transaction.select().from(databaseSchema.entities)
      .where(eq(databaseSchema.entities.id, source.entityId)).limit(1);
    if (!entity) return null;
    if (entity.entityType === "source") {
      throw Object.assign(new Error("来源版本需要在来源工作台中修订。"), { status: 409 });
    }
    const [latest] = await transaction.select({ value: max(databaseSchema.entityVersions.version) })
      .from(databaseSchema.entityVersions)
      .where(and(
        eq(databaseSchema.entityVersions.entityId, source.entityId),
        eq(databaseSchema.entityVersions.locale, source.locale),
      ));
    const sourcePayload = source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? source.payload as Record<string, unknown>
      : {};
    const [revision] = await transaction.insert(databaseSchema.entityVersions).values({
      entityId: source.entityId,
      version: (latest?.value ?? source.version) + 1,
      locale: source.locale,
      slug: source.slug,
      title: source.title,
      summary: source.summary,
      contentTier: source.contentTier,
      editorialStatus: "candidate",
      schemaVersion: source.schemaVersion,
      payload: { ...sourcePayload, editorialStatus: "candidate" },
      createdBy: principal.subject!,
      supersedesVersionId: source.id,
    }).returning();
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!,
      actorRole: principal.role,
      action: "entity-version.revision-created",
      resourceType: "entity-version",
      resourceId: revision.id,
      metadata: { entityId: source.entityId, sourceVersionId: source.id, note },
    });
    return revision;
  });
}

export async function changeEntityPublication(
  principal: AuthPrincipal,
  targetVersionId: string,
  action: "withdraw" | "rollback",
  reason: string,
  expectedCurrentVersionId: string | null,
) {
  requirePermission(principal, action === "withdraw" ? "knowledge:withdraw" : "knowledge:publish");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [target] = await transaction.select().from(databaseSchema.entityVersions)
      .where(eq(databaseSchema.entityVersions.id, targetVersionId)).limit(1);
    if (!target) return null;
    if (target.editorialStatus !== "published") {
      throw Object.assign(new Error("撤回或回滚目标必须是不可变的已发布版本。"), { status: 409 });
    }
    const [entity] = await transaction.select().from(databaseSchema.entities)
      .where(eq(databaseSchema.entities.id, target.entityId)).limit(1);
    if (!entity) return null;
    if (entity.currentPublishedVersionId !== expectedCurrentVersionId) {
      throw Object.assign(new Error("公开版本已被其他操作改变，请刷新页面后重试。"), { status: 412 });
    }
    const now = new Date();

    if (action === "withdraw") {
      if (entity.currentPublishedVersionId !== target.id) {
        throw Object.assign(new Error("只能撤回当前正在公开的版本。"), { status: 409 });
      }
      await transaction.update(databaseSchema.entities).set({
        currentPublishedVersionId: null,
        updatedAt: now,
      }).where(eq(databaseSchema.entities.id, entity.id));
    } else {
      if (entity.currentPublishedVersionId === target.id) {
        throw Object.assign(new Error("该版本已经是当前公开版本。"), { status: 409 });
      }
      await transaction.update(databaseSchema.entities).set({
        currentPublishedVersionId: target.id,
        updatedAt: now,
      }).where(eq(databaseSchema.entities.id, entity.id));
    }

    await transaction.insert(databaseSchema.publicationEvents).values({
      entityId: entity.id,
      entityVersionId: target.id,
      action: action === "withdraw" ? "withdrawn" : "rolled-back",
      actorId: principal.subject!,
      reason,
    });
    await transaction.insert(databaseSchema.outboxEvents).values({
      aggregateType: "entity",
      aggregateId: entity.id,
      eventType: action === "withdraw" ? "knowledge.entity.withdrawn" : "knowledge.entity.rolled-back",
      payload: {
        entityId: entity.id,
        entityVersionId: target.id,
        previousVersionId: entity.currentPublishedVersionId,
        locale: target.locale,
      },
    });
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!,
      actorRole: principal.role,
      action: `entity-version.${action}`,
      resourceType: "entity-version",
      resourceId: target.id,
      metadata: { entityId: entity.id, previousVersionId: entity.currentPublishedVersionId, reason },
    });
    return { action, entityId: entity.id, entityVersionId: target.id, reason };
  });
}
