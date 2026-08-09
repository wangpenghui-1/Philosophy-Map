import type { AuthPrincipal } from "@atlas/auth";
import { requirePermission } from "@atlas/auth";
import { databaseSchema, getDatabase } from "@atlas/db";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { assertMatchingEtag } from "./editorial";
import { assertMediaUploadsEnabled, createMediaUploadUrl, inspectMediaObject, publicMediaUrl } from "./media-storage";

export interface MediaUploadInput {
  fileName: string; mimeType: string; byteSize: number; checksumSha256: string;
  title: string; altText: string; purpose: string; rightsStatus: string; authenticity: string;
  credit: string; license?: string | null; sourceUrl?: string | null; entityStableKey?: string | null;
}

type MediaMetadataInput = Partial<Omit<MediaUploadInput, "fileName" | "mimeType" | "byteSize" | "checksumSha256">>;

function safeFileName(value: string) {
  const extension = value.toLocaleLowerCase("en-US").match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  return `original${extension}`;
}

async function resolveEntityId(stableKey?: string | null) {
  if (!stableKey) return null;
  const [entity] = await getDatabase().select({ id: databaseSchema.entities.id })
    .from(databaseSchema.entities).where(eq(databaseSchema.entities.stableKey, stableKey)).limit(1);
  if (!entity) throw Object.assign(new Error("绑定的知识实体不存在。"), { status: 422 });
  return entity.id;
}

function mediaMetadata(input: MediaUploadInput, state: string) {
  return {
    state, title: input.title, altText: input.altText, purpose: input.purpose,
    fileName: input.fileName, license: input.license ?? null, sourceUrl: input.sourceUrl ?? null,
    entityStableKey: input.entityStableKey ?? null, uploadExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

export async function createMediaUpload(principal: AuthPrincipal, input: MediaUploadInput) {
  requirePermission(principal, "media:manage");
  assertMediaUploadsEnabled();
  const database = getDatabase();
  const id = randomUUID();
  const entityId = await resolveEntityId(input.entityStableKey);
  const storageKey = `media/${id}/${safeFileName(input.fileName)}`;
  const uploadUrl = await createMediaUploadUrl({ storageKey, mimeType: input.mimeType, byteSize: input.byteSize, checksumSha256: input.checksumSha256 });
  const [asset] = await database.transaction(async (transaction) => {
    const inserted = await transaction.insert(databaseSchema.mediaAssets).values({
      id, entityId, storageKey, mimeType: input.mimeType, byteSize: input.byteSize,
      checksum: input.checksumSha256, rightsStatus: input.rightsStatus,
      authenticity: input.authenticity, credit: input.credit,
      metadata: { ...mediaMetadata(input, "pending-upload"), uploadedBy: principal.subject },
    }).returning();
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: principal.subject!, actorRole: principal.role, action: "media.upload-created",
      resourceType: "media-asset", resourceId: id, metadata: { storageKey, mimeType: input.mimeType, byteSize: input.byteSize },
    });
    return inserted;
  });
  return { asset, upload: { url: uploadUrl, method: "PUT" as const, expiresIn: 900, headers: { "content-type": input.mimeType, "x-amz-checksum-sha256": input.checksumSha256 } } };
}

export async function completeMediaUpload(principal: AuthPrincipal, id: string) {
  requirePermission(principal, "media:manage");
  assertMediaUploadsEnabled();
  const database = getDatabase();
  const [asset] = await database.select().from(databaseSchema.mediaAssets).where(eq(databaseSchema.mediaAssets.id, id)).limit(1);
  if (!asset || asset.deletedAt) return null;
  const metadata = asset.metadata as Record<string, unknown>;
  if (metadata.state === "ready") return { ...asset, publicUrl: publicMediaUrl(asset.storageKey) };
  if (metadata.state === "quarantined") return { ...asset, publicUrl: null };
  const object = await inspectMediaObject(asset.storageKey);
  if (object.ContentLength !== asset.byteSize) throw Object.assign(new Error("对象大小与上传申请不一致。"), { status: 422 });
  if (object.ContentType && object.ContentType !== asset.mimeType) throw Object.assign(new Error("对象 MIME 类型与上传申请不一致。"), { status: 422 });
  if (object.ChecksumSHA256 && object.ChecksumSHA256 !== asset.checksum) throw Object.assign(new Error("对象 SHA-256 校验失败。"), { status: 422 });
  const now = new Date();
  const [updated] = await database.transaction(async (transaction) => {
    const rows = await transaction.update(databaseSchema.mediaAssets).set({
      metadata: { ...metadata, state: "quarantined", quarantinedAt: now.toISOString(), uploadExpiresAt: null }, updatedAt: now,
    }).where(eq(databaseSchema.mediaAssets.id, id)).returning();
    await transaction.insert(databaseSchema.outboxEvents).values({ aggregateType: "media", aggregateId: id, eventType: "media.scan.requested", payload: { assetId: id, storageKey: asset.storageKey } });
    await transaction.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: "media.upload-completed", resourceType: "media-asset", resourceId: id });
    return rows;
  });
  return { ...updated, publicUrl: null };
}

export async function updateMediaMetadata(principal: AuthPrincipal, id: string, request: Request, input: MediaMetadataInput) {
  requirePermission(principal, "media:manage");
  const database = getDatabase();
  const [current] = await database.select().from(databaseSchema.mediaAssets).where(eq(databaseSchema.mediaAssets.id, id)).limit(1);
  if (!current || current.deletedAt) return null;
  assertMatchingEtag(request, current);
  const metadata = current.metadata as Record<string, unknown>;
  const entityId = input.entityStableKey === undefined ? current.entityId : await resolveEntityId(input.entityStableKey);
  const [updated] = await database.transaction(async (transaction) => {
    const rows = await transaction.update(databaseSchema.mediaAssets).set({
      entityId,
      rightsStatus: input.rightsStatus ?? current.rightsStatus,
      authenticity: input.authenticity ?? current.authenticity,
      credit: input.credit ?? current.credit,
      metadata: {
        ...metadata,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.altText !== undefined ? { altText: input.altText } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
        ...(input.license !== undefined ? { license: input.license } : {}),
        ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
        ...(input.entityStableKey !== undefined ? { entityStableKey: input.entityStableKey } : {}),
      },
      updatedAt: new Date(),
    }).where(eq(databaseSchema.mediaAssets.id, id)).returning();
    await transaction.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: "media.metadata-updated", resourceType: "media-asset", resourceId: id });
    return rows;
  });
  return updated;
}

export async function archiveMediaAsset(principal: AuthPrincipal, id: string, request: Request, reason: string) {
  requirePermission(principal, "media:manage");
  const database = getDatabase();
  const [current] = await database.select().from(databaseSchema.mediaAssets).where(eq(databaseSchema.mediaAssets.id, id)).limit(1);
  if (!current || current.deletedAt) return null;
  assertMatchingEtag(request, current);
  const now = new Date();
  const [archived] = await database.transaction(async (transaction) => {
    const rows = await transaction.update(databaseSchema.mediaAssets).set({ deletedAt: now, updatedAt: now, metadata: { ...current.metadata as Record<string, unknown>, state: "archived", archivedAt: now.toISOString() } }).where(eq(databaseSchema.mediaAssets.id, id)).returning();
    await transaction.insert(databaseSchema.auditEvents).values({ actorId: principal.subject!, actorRole: principal.role, action: "media.archived", resourceType: "media-asset", resourceId: id, metadata: { reason } });
    return rows;
  });
  return archived;
}
