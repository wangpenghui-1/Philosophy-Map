import { and, asc, eq, lte } from "drizzle-orm";
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

const defaultHandlers: Record<string, OutboxHandler> = {
  "knowledge.entity.published": refreshKnowledgeProjection,
  "knowledge.entity.withdrawn": refreshKnowledgeProjection,
  "knowledge.entity.rolled-back": refreshKnowledgeProjection,
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
