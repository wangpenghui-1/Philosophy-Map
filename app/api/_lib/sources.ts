import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { assertEditorialTransition, evaluateSourceQuality, type EditorialStatus } from "@atlas/domain";
import { and, eq, max } from "drizzle-orm";
import { assertMatchingEtag } from "./editorial";

export interface SourceDraftInput {
  stableKey?: string;
  title: string;
  authors: string[];
  sourceType: string;
  publication: string;
  publicationYear?: number | null;
  url?: string | null;
  doi?: string | null;
  isbn?: string | null;
  language: string;
  payload?: Record<string, unknown>;
}

function permissionForTransition(to: EditorialStatus) {
  if (to === "reviewed") return "knowledge:review:complete" as const;
  if (to === "published") return "knowledge:publish" as const;
  return "knowledge:draft:edit" as const;
}

function payloadFor(input: Partial<SourceDraftInput>, current: Record<string, unknown> = {}, status: EditorialStatus) {
  return {
    ...current,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.authors !== undefined ? { authors: input.authors } : {}),
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    ...(input.publication !== undefined ? { publication: input.publication } : {}),
    ...(input.publicationYear !== undefined ? { year: input.publicationYear } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.doi !== undefined ? { doi: input.doi } : {}),
    ...(input.isbn !== undefined ? { isbn: input.isbn } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    editorialStatus: status,
  };
}

export async function createSourceDraft(principal: AuthPrincipal, input: SourceDraftInput & { stableKey: string }) {
  requirePermission(principal, "knowledge:candidate:create");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [existing] = await transaction.select().from(databaseSchema.sources)
      .where(eq(databaseSchema.sources.stableKey, input.stableKey)).limit(1);
    const source = existing ?? (await transaction.insert(databaseSchema.sources).values({ stableKey: input.stableKey }).returning())[0];
    const [latest] = await transaction.select({ value: max(databaseSchema.sourceVersions.version) })
      .from(databaseSchema.sourceVersions).where(eq(databaseSchema.sourceVersions.sourceId, source.id));
    const [version] = await transaction.insert(databaseSchema.sourceVersions).values({
      sourceId: source.id,
      version: (latest?.value ?? 0) + 1,
      title: input.title,
      authors: input.authors,
      sourceType: input.sourceType,
      publication: input.publication,
      publicationYear: input.publicationYear,
      url: input.url,
      doi: input.doi,
      isbn: input.isbn,
      language: input.language,
      editorialStatus: "candidate",
      payload: payloadFor(input, input.payload, "candidate"),
    }).returning();
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "source-version.created",
      resourceType: "source-version", resourceId: version.id, metadata: { sourceId: source.id, stableKey: input.stableKey },
    });
    return version;
  });
}

export async function updateSourceDraft(principal: AuthPrincipal, id: string, request: Request, input: Partial<SourceDraftInput>) {
  requirePermission(principal, "knowledge:draft:edit");
  const database = getDatabase();
  const [current] = await database.select().from(databaseSchema.sourceVersions).where(eq(databaseSchema.sourceVersions.id, id)).limit(1);
  if (!current) return null;
  if (["reviewed", "published"].includes(current.editorialStatus)) throw Object.assign(new Error("已复核和已发布来源不可原位修改。"), { status: 409 });
  assertMatchingEtag(request, current);
  const currentPayload = current.payload && typeof current.payload === "object" && !Array.isArray(current.payload) ? current.payload as Record<string, unknown> : {};
  const [updated] = await database.update(databaseSchema.sourceVersions).set({
    ...input,
    payload: payloadFor(input, currentPayload, current.editorialStatus),
    updatedAt: new Date(),
  }).where(eq(databaseSchema.sourceVersions.id, id)).returning();
  await database.insert(databaseSchema.auditEvents).values({
    actorId: principal.subject!, actorRole: principal.role, action: "source-version.updated",
    resourceType: "source-version", resourceId: id,
  });
  return updated;
}

export async function transitionSourceVersion(principal: AuthPrincipal, id: string, request: Request, to: EditorialStatus, note?: string) {
  requirePermission(principal, permissionForTransition(to));
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(databaseSchema.sourceVersions).where(eq(databaseSchema.sourceVersions.id, id)).limit(1);
    if (!current) return null;
    assertMatchingEtag(request, current);
    assertEditorialTransition(current.editorialStatus, to);
    if (to === "published") {
      const quality = evaluateSourceQuality(current);
      if (!quality.readyToPublish) {
        throw Object.assign(new Error(quality.findings.filter((item) => item.severity === "blocker").map((item) => item.message).join(" ")), { status: 422 });
      }
    }
    const currentPayload = current.payload && typeof current.payload === "object" && !Array.isArray(current.payload) ? current.payload as Record<string, unknown> : {};
    const now = new Date();
    const [updated] = await transaction.update(databaseSchema.sourceVersions).set({
      editorialStatus: to,
      payload: { ...currentPayload, editorialStatus: to },
      updatedAt: now,
    }).where(eq(databaseSchema.sourceVersions.id, id)).returning();
    if (to === "published") {
      await transaction.update(databaseSchema.sources).set({ currentPublishedVersionId: id, updatedAt: now })
        .where(eq(databaseSchema.sources.id, current.sourceId));
      await transaction.insert(databaseSchema.outboxEvents).values({
        aggregateType: "source", aggregateId: current.sourceId, eventType: "knowledge.source.published",
        payload: { sourceId: current.sourceId, sourceVersionId: id },
      });
      if (current.url) await transaction.insert(databaseSchema.outboxEvents).values({
        aggregateType: "source", aggregateId: current.sourceId, eventType: "source.link-check.requested",
        payload: { sourceId: current.sourceId, sourceVersionId: id, url: current.url },
      });
    }
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: `source-version.${to}`,
      resourceType: "source-version", resourceId: id, metadata: { from: current.editorialStatus, to, note },
    });
    return updated;
  });
}

export async function createSourceRevision(principal: AuthPrincipal, id: string) {
  requirePermission(principal, "knowledge:candidate:create");
  const database = getDatabase();
  const [current] = await database.select().from(databaseSchema.sourceVersions).where(and(
    eq(databaseSchema.sourceVersions.id, id), eq(databaseSchema.sourceVersions.editorialStatus, "published"),
  )).limit(1);
  if (!current) return null;
  const [source] = await database.select().from(databaseSchema.sources).where(eq(databaseSchema.sources.id, current.sourceId)).limit(1);
  if (!source) return null;
  return createSourceDraft(principal, {
    stableKey: source.stableKey, title: current.title, authors: current.authors, sourceType: current.sourceType,
    publication: current.publication, publicationYear: current.publicationYear, url: current.url,
    doi: current.doi, isbn: current.isbn, language: current.language,
    payload: current.payload as Record<string, unknown>,
  });
}
