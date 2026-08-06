import { and, asc, eq, lte } from "drizzle-orm";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { closeDatabase, databaseSchema, getDatabase } from "@atlas/db";
import { logEvent } from "@atlas/observability";

export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
}

export type OutboxHandler = (event: OutboxEvent) => Promise<void>;

const refreshKnowledgeProjection: OutboxHandler = async (event) => {
    logEvent("info", "Knowledge publication changed; snapshot and search refresh are required.", {
      module: "worker",
      operation: event.eventType,
      aggregateId: event.aggregateId,
    });
};

export function isPrivateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

const checkSourceLink: OutboxHandler = async (event) => {
  const payload = event.payload as { url?: string };
  if (!payload.url) throw new Error("Source link-check event has no URL.");
  const url = new URL(payload.url);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported source URL protocol.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("Source URL resolves to a private address.");
  const response = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8_000) });
  if (response.status < 200 || response.status >= 400) throw new Error(`Source URL returned HTTP ${response.status}.`);
  logEvent("info", "Source URL check succeeded.", { module: "worker", operation: event.eventType, aggregateId: event.aggregateId, status: response.status });
};

const scanMediaAsset: OutboxHandler = async (event) => {
  const endpoint = process.env.MEDIA_SCAN_ENDPOINT?.trim();
  const token = process.env.MEDIA_SCAN_TOKEN?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const payload = event.payload as { assetId?: string; storageKey?: string };
  const assetId = payload.assetId;
  const storageKey = payload.storageKey;
  if (!endpoint || !token || !bucket) throw new Error("Media scanner is not configured.");
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("Media scanner endpoint must use HTTPS.");
  if (!assetId || !storageKey) throw new Error("Media scan event is incomplete.");
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ bucket, key: storageKey }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Media scanner returned HTTP ${response.status}.`);
  const result = await response.json() as { clean?: boolean; engine?: string; signature?: string | null };
  if (typeof result.clean !== "boolean") throw new Error("Media scanner response is invalid.");
  const database = getDatabase();
  const [asset] = await database.select().from(databaseSchema.mediaAssets).where(eq(databaseSchema.mediaAssets.id, assetId)).limit(1);
  if (!asset || asset.deletedAt) return;
  const now = new Date();
  const metadata = asset.metadata as Record<string, unknown>;
  await database.transaction(async (transaction) => {
    await transaction.update(databaseSchema.mediaAssets).set({
      metadata: { ...metadata, state: result.clean ? "ready" : "rejected", scannedAt: now.toISOString(), scanEngine: result.engine ?? "external", scanSignature: result.signature ?? null },
      updatedAt: now,
    }).where(eq(databaseSchema.mediaAssets.id, assetId));
    await transaction.insert(databaseSchema.auditEvents).values({
      actorRole: "admin", action: result.clean ? "media.scan-clean" : "media.scan-rejected",
      resourceType: "media-asset", resourceId: assetId,
      metadata: { engine: result.engine ?? "external", signature: result.signature ?? null },
    });
    if (result.clean) await transaction.insert(databaseSchema.outboxEvents).values({
      aggregateType: "media", aggregateId: assetId, eventType: "media.asset.ready",
      payload: { assetId, storageKey },
    });
  });
};

const defaultHandlers: Record<string, OutboxHandler> = {
  "knowledge.entity.published": refreshKnowledgeProjection,
  "knowledge.entity.withdrawn": refreshKnowledgeProjection,
  "knowledge.entity.rolled-back": refreshKnowledgeProjection,
  "knowledge.source.published": refreshKnowledgeProjection,
  "knowledge.relation.published": refreshKnowledgeProjection,
  "journey.published": refreshKnowledgeProjection,
  "media.asset.ready": refreshKnowledgeProjection,
  "media.scan.requested": scanMediaAsset,
  "source.link-check.requested": checkSourceLink,
};

export async function processOutboxBatch(
  handlers: Record<string, OutboxHandler> = defaultHandlers,
  limit = 20,
) {
  const database = getDatabase();
  const events = await database.select().from(databaseSchema.outboxEvents).where(and(
    eq(databaseSchema.outboxEvents.status, "pending"),
    lte(databaseSchema.outboxEvents.availableAt, new Date()),
  )).orderBy(asc(databaseSchema.outboxEvents.createdAt)).limit(limit);

  let completed = 0;
  let failed = 0;
  for (const event of events) {
    const claimed = await database.update(databaseSchema.outboxEvents).set({
      status: "processing",
      attempts: event.attempts + 1,
    }).where(and(
      eq(databaseSchema.outboxEvents.id, event.id),
      eq(databaseSchema.outboxEvents.status, "pending"),
    )).returning({ id: databaseSchema.outboxEvents.id });
    if (!claimed.length) continue;
    try {
      const handler = handlers[event.eventType];
      if (!handler) throw new Error(`No handler registered for ${event.eventType}.`);
      await handler(event);
      await database.update(databaseSchema.outboxEvents).set({
        status: "completed",
        processedAt: new Date(),
        lastError: null,
      }).where(eq(databaseSchema.outboxEvents.id, event.id));
      completed += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      await database.update(databaseSchema.outboxEvents).set({
        status: attempts >= 5 ? "failed" : "pending",
        availableAt: new Date(Date.now() + Math.min(60_000, 2 ** attempts * 1_000)),
        lastError: error instanceof Error ? error.message : "Unknown worker error",
      }).where(eq(databaseSchema.outboxEvents.id, event.id));
      failed += 1;
    }
  }
  return { selected: events.length, completed, failed };
}

export async function closeWorkerDatabase() {
  await closeDatabase();
}
