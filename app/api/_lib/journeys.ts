import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { assertEditorialTransition, evaluateJourneyQuality, type EditorialStatus, type JourneyQualityInput } from "@atlas/domain";
import { and, eq, inArray, isNotNull, max, or } from "drizzle-orm";
import { assertMatchingEtag } from "./editorial";

type JourneyNodeInput = JourneyQualityInput["nodes"][number];
type JourneyInput = Omit<JourneyQualityInput, "stableKey"> & {
  locale: string;
  recommended: boolean;
};

function permissionForTransition(to: EditorialStatus) {
  if (to === "reviewed") return "knowledge:review:complete" as const;
  if (to === "published") return "knowledge:publish" as const;
  return "journey:edit" as const;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function payloadFor(stableKey: string, version: number, status: EditorialStatus, input: JourneyInput) {
  const estimatedDurationMs = input.nodes.reduce((total, node) => total + node.durationMs, 0);
  return {
    id: stableKey,
    ...input,
    relatedJourneyId: input.relatedJourneyId ?? undefined,
    openingQuestion: input.openingQuestion ?? undefined,
    closingTitle: input.closingTitle ?? undefined,
    closingBody: input.closingBody ?? undefined,
    estimatedDurationMs,
    editorialStatus: status,
    version,
  };
}

async function resolveJourneyNodes(
  transaction: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  nodes: JourneyNodeInput[],
) {
  const thinkerIds = [...new Set(nodes.map((node) => node.thinkerId))];
  const entities = thinkerIds.length ? await transaction.select({
    id: databaseSchema.entities.id,
    stableKey: databaseSchema.entities.stableKey,
    currentPublishedVersionId: databaseSchema.entities.currentPublishedVersionId,
  }).from(databaseSchema.entities).where(and(
    eq(databaseSchema.entities.entityType, "person"),
    inArray(databaseSchema.entities.stableKey, thinkerIds),
  )) : [];
  const entityByStableKey = new Map(entities.filter((entity) => entity.currentPublishedVersionId).map((entity) => [entity.stableKey, entity]));
  const missing = thinkerIds.filter((id) => !entityByStableKey.has(id));
  if (missing.length) throw Object.assign(new Error(`节点引用了不存在或未发布的人物：${missing.join("、")}`), { status: 422 });
  return nodes.map((node, ordinal) => ({
    journeyNode: node,
    row: {
      nodeKey: node.id,
      ordinal,
      entityId: entityByStableKey.get(node.thinkerId)!.id,
      title: node.title,
      body: node.body,
      camera: node.camera,
      transition: node.incomingTransition ?? null,
    },
    entityId: entityByStableKey.get(node.thinkerId)!.id,
  }));
}

async function assertPublishedJourneyReferences(
  transaction: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  resolvedNodes: Awaited<ReturnType<typeof resolveJourneyNodes>>,
) {
  const relationIds = [...new Set(resolvedNodes.flatMap(({ journeyNode }) => journeyNode.incomingTransition?.kind === "evidence-relation" ? [journeyNode.incomingTransition.relationId] : []))];
  const evidenceRelations = relationIds.length ? await transaction.select().from(databaseSchema.relations)
    .where(inArray(databaseSchema.relations.stableKey, relationIds)) : [];
  const relationByStableKey = new Map(evidenceRelations.filter((relation) => relation.currentPublishedVersionId).map((relation) => [relation.stableKey, relation]));
  const missing = relationIds.filter((id) => !relationByStableKey.has(id));
  if (missing.length) throw Object.assign(new Error(`历史转场引用了不存在或未发布的关系：${missing.join("、")}`), { status: 422 });

  for (let index = 1; index < resolvedNodes.length; index += 1) {
    const previous = resolvedNodes[index - 1];
    const current = resolvedNodes[index];
    const transition = current.journeyNode.incomingTransition;
    if (!transition) continue;
    if (transition.kind === "evidence-relation") {
      const relation = relationByStableKey.get(transition.relationId)!;
      const endpointMatch = relation.directed
        ? relation.fromEntityId === previous.entityId && relation.toEntityId === current.entityId
        : [relation.fromEntityId, relation.toEntityId].includes(previous.entityId) && [relation.fromEntityId, relation.toEntityId].includes(current.entityId);
      if (!endpointMatch) throw Object.assign(new Error(`节点 ${current.journeyNode.id} 引用的历史关系与前后人物不一致。`), { status: 422 });
      continue;
    }
    const historical = await transaction.select({ id: databaseSchema.relations.id }).from(databaseSchema.relations).where(and(
      or(
        and(eq(databaseSchema.relations.fromEntityId, previous.entityId), eq(databaseSchema.relations.toEntityId, current.entityId)),
        and(eq(databaseSchema.relations.fromEntityId, current.entityId), eq(databaseSchema.relations.toEntityId, previous.entityId)),
      ),
      inArray(databaseSchema.relations.relationType, ["direct-influence", "text-transmission", "critique", "lineage"]),
      isNotNull(databaseSchema.relations.currentPublishedVersionId),
    )).limit(1);
    if (historical.length) throw Object.assign(new Error(`节点 ${current.journeyNode.id} 已存在历史关系，应使用“证据关系”转场。`), { status: 422 });
  }
}

async function insertJourneyNodes(
  transaction: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  journeyVersionId: string,
  resolvedNodes: Awaited<ReturnType<typeof resolveJourneyNodes>>,
) {
  if (!resolvedNodes.length) return;
  await transaction.insert(databaseSchema.journeyNodes).values(resolvedNodes.map(({ row }) => ({ journeyVersionId, ...row })));
}

export async function createJourneyDraft(principal: AuthPrincipal, input: JourneyInput & { stableKey: string }) {
  requirePermission(principal, "journey:edit");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [existing] = await transaction.select().from(databaseSchema.journeys).where(eq(databaseSchema.journeys.stableKey, input.stableKey)).limit(1);
    if (existing) throw Object.assign(new Error("Stable key 已存在；请从现有已发布旅程创建后继修订。"), { status: 409 });
    if (input.relatedJourneyId) {
      const [related] = await transaction.select().from(databaseSchema.journeys).where(eq(databaseSchema.journeys.stableKey, input.relatedJourneyId)).limit(1);
      if (!related) throw Object.assign(new Error("关联旅程不存在。"), { status: 422 });
    }
    const resolvedNodes = await resolveJourneyNodes(transaction, input.nodes);
    const [journey] = await transaction.insert(databaseSchema.journeys).values({ stableKey: input.stableKey }).returning();
    const versionNumber = 1;
    const payload = payloadFor(input.stableKey, versionNumber, "candidate", input);
    const [version] = await transaction.insert(databaseSchema.journeyVersions).values({
      journeyId: journey.id,
      version: versionNumber,
      locale: input.locale,
      slug: input.slug,
      title: input.title,
      summary: input.description,
      estimatedDurationMs: payload.estimatedDurationMs,
      editorialStatus: "candidate",
      payload,
    }).returning();
    await insertJourneyNodes(transaction, version.id, resolvedNodes);
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "journey-version.created",
      resourceType: "journey-version", resourceId: version.id, metadata: { journeyId: journey.id, stableKey: input.stableKey },
    });
    return version;
  });
}

export async function updateJourneyDraft(principal: AuthPrincipal, id: string, request: Request, input: Partial<JourneyInput>) {
  requirePermission(principal, "journey:edit");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(databaseSchema.journeyVersions).where(eq(databaseSchema.journeyVersions.id, id)).limit(1);
    if (!current) return null;
    if (["reviewed", "published"].includes(current.editorialStatus)) throw Object.assign(new Error("已复核和已发布旅程不可原位修改。"), { status: 409 });
    assertMatchingEtag(request, current);
    const [journey] = await transaction.select().from(databaseSchema.journeys).where(eq(databaseSchema.journeys.id, current.journeyId)).limit(1);
    if (!journey) return null;
    const merged = { ...asRecord(current.payload), ...input, stableKey: undefined } as unknown as JourneyInput;
    if (merged.relatedJourneyId) {
      if (merged.relatedJourneyId === journey.stableKey) throw Object.assign(new Error("关联旅程不能指向自身。"), { status: 422 });
      const [related] = await transaction.select().from(databaseSchema.journeys).where(eq(databaseSchema.journeys.stableKey, merged.relatedJourneyId)).limit(1);
      if (!related) throw Object.assign(new Error("关联旅程不存在。"), { status: 422 });
    }
    const resolvedNodes = await resolveJourneyNodes(transaction, merged.nodes);
    const payload = payloadFor(journey.stableKey, current.version, current.editorialStatus, merged);
    const [updated] = await transaction.update(databaseSchema.journeyVersions).set({
      locale: merged.locale,
      slug: merged.slug,
      title: merged.title,
      summary: merged.description,
      estimatedDurationMs: payload.estimatedDurationMs,
      payload,
      updatedAt: new Date(),
    }).where(eq(databaseSchema.journeyVersions.id, id)).returning();
    await transaction.delete(databaseSchema.journeyNodes).where(eq(databaseSchema.journeyNodes.journeyVersionId, id));
    await insertJourneyNodes(transaction, id, resolvedNodes);
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "journey-version.updated",
      resourceType: "journey-version", resourceId: id,
    });
    return updated;
  });
}

export async function transitionJourneyVersion(principal: AuthPrincipal, id: string, request: Request, to: EditorialStatus, note?: string) {
  requirePermission(principal, permissionForTransition(to));
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(databaseSchema.journeyVersions).where(eq(databaseSchema.journeyVersions.id, id)).limit(1);
    if (!current) return null;
    const [journey] = await transaction.select().from(databaseSchema.journeys).where(eq(databaseSchema.journeys.id, current.journeyId)).limit(1);
    if (!journey) return null;
    assertMatchingEtag(request, current);
    assertEditorialTransition(current.editorialStatus, to);
    const payload = asRecord(current.payload) as unknown as JourneyInput;
    if (to === "published") {
      const quality = evaluateJourneyQuality({ ...payload, stableKey: journey.stableKey });
      if (!quality.readyToPublish) throw Object.assign(new Error(quality.findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message).join(" ")), { status: 422 });
      const resolvedNodes = await resolveJourneyNodes(transaction, payload.nodes);
      await assertPublishedJourneyReferences(transaction, resolvedNodes);
    }
    const now = new Date();
    const [updated] = await transaction.update(databaseSchema.journeyVersions).set({
      editorialStatus: to,
      payload: { ...asRecord(current.payload), editorialStatus: to },
      reviewedBy: to === "reviewed" ? principal.subject! : current.reviewedBy,
      reviewedAt: to === "reviewed" ? now : current.reviewedAt,
      publishedAt: to === "published" ? now : current.publishedAt,
      updatedAt: now,
    }).where(eq(databaseSchema.journeyVersions.id, id)).returning();
    if (to === "published") {
      await transaction.update(databaseSchema.journeys).set({ currentPublishedVersionId: id, updatedAt: now }).where(eq(databaseSchema.journeys.id, current.journeyId));
      await transaction.insert(databaseSchema.outboxEvents).values({
        aggregateType: "journey", aggregateId: current.journeyId, eventType: "journey.published",
        payload: { journeyId: current.journeyId, journeyVersionId: id, locale: current.locale },
      });
    }
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: `journey-version.${to}`,
      resourceType: "journey-version", resourceId: id, metadata: { from: current.editorialStatus, to, note },
    });
    return updated;
  });
}

export async function createJourneyRevision(principal: AuthPrincipal, id: string) {
  requirePermission(principal, "journey:edit");
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [current] = await transaction.select().from(databaseSchema.journeyVersions).where(and(
      eq(databaseSchema.journeyVersions.id, id),
      eq(databaseSchema.journeyVersions.editorialStatus, "published"),
    )).limit(1);
    if (!current) return null;
    const [latest] = await transaction.select({ value: max(databaseSchema.journeyVersions.version) }).from(databaseSchema.journeyVersions).where(eq(databaseSchema.journeyVersions.journeyId, current.journeyId));
    const versionNumber = (latest?.value ?? current.version) + 1;
    const payload = { ...asRecord(current.payload), editorialStatus: "candidate", version: versionNumber };
    const [revision] = await transaction.insert(databaseSchema.journeyVersions).values({
      journeyId: current.journeyId,
      version: versionNumber,
      locale: current.locale,
      slug: current.slug,
      title: current.title,
      summary: current.summary,
      estimatedDurationMs: current.estimatedDurationMs,
      editorialStatus: "candidate",
      payload,
    }).returning();
    const nodes = await transaction.select().from(databaseSchema.journeyNodes).where(eq(databaseSchema.journeyNodes.journeyVersionId, current.id));
    if (nodes.length) await transaction.insert(databaseSchema.journeyNodes).values(nodes.map((node) => ({
      journeyVersionId: revision.id,
      nodeKey: node.nodeKey,
      ordinal: node.ordinal,
      entityId: node.entityId,
      title: node.title,
      body: node.body,
      camera: node.camera,
      transition: node.transition,
    })));
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "journey-version.revision-created",
      resourceType: "journey-version", resourceId: revision.id,
      metadata: { journeyId: current.journeyId, sourceVersionId: current.id },
    });
    return revision;
  });
}
