import { and, asc, eq, max } from "drizzle-orm";
import { getDatabase, isDatabaseConfigured, databaseSchema } from "@atlas/db";

export async function createConversationRecord(input: {
  id: string;
  anonymousSessionHash: string;
  title?: string;
  locale: string;
}) {
  if (!isDatabaseConfigured()) return false;
  const database = getDatabase();
  await database.insert(databaseSchema.conversations).values(input);
  return true;
}

export async function readConversationRecord(id: string, anonymousSessionHash: string) {
  if (!isDatabaseConfigured()) return null;
  const database = getDatabase();
  const [conversation] = await database.select().from(databaseSchema.conversations).where(and(
    eq(databaseSchema.conversations.id, id),
    eq(databaseSchema.conversations.anonymousSessionHash, anonymousSessionHash),
  )).limit(1);
  if (!conversation) return null;
  const rows = await database.select().from(databaseSchema.messages)
    .where(eq(databaseSchema.messages.conversationId, id))
    .orderBy(asc(databaseSchema.messages.sequence));
  return { ...conversation, messages: rows };
}

export async function deleteConversationRecord(id: string, anonymousSessionHash: string) {
  if (!isDatabaseConfigured()) return false;
  const database = getDatabase();
  const deleted = await database.delete(databaseSchema.conversations).where(and(
    eq(databaseSchema.conversations.id, id),
    eq(databaseSchema.conversations.anonymousSessionHash, anonymousSessionHash),
  )).returning({ id: databaseSchema.conversations.id });
  return deleted.length > 0;
}

export async function appendConversationExchange(input: {
  conversationId: string;
  anonymousSessionHash: string;
  userText: string;
  assistantText: string;
  providerResponseId?: string;
  citations?: unknown[];
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  retrievalSnapshot?: unknown;
}) {
  if (!isDatabaseConfigured()) return false;
  const database = getDatabase();
  return database.transaction(async (transaction) => {
    const [conversation] = await transaction.select({ id: databaseSchema.conversations.id })
      .from(databaseSchema.conversations)
      .where(and(
        eq(databaseSchema.conversations.id, input.conversationId),
        eq(databaseSchema.conversations.anonymousSessionHash, input.anonymousSessionHash),
      )).limit(1);
    if (!conversation) return false;
    const [current] = await transaction.select({ value: max(databaseSchema.messages.sequence) })
      .from(databaseSchema.messages)
      .where(eq(databaseSchema.messages.conversationId, input.conversationId));
    const firstSequence = (current?.value ?? 0) + 1;
    const inserted = await transaction.insert(databaseSchema.messages).values([
      {
        conversationId: input.conversationId,
        role: "user",
        content: input.userText,
        sequence: firstSequence,
      },
      {
        conversationId: input.conversationId,
        role: "assistant",
        content: input.assistantText,
        sequence: firstSequence + 1,
        providerResponseId: input.providerResponseId,
      },
    ]).returning();
    const assistantMessage = inserted[1];
    if (assistantMessage && input.citations?.length) {
      await transaction.insert(databaseSchema.messageCitations).values(input.citations.map((citation, index) => ({
        messageId: assistantMessage.id,
        ordinal: index + 1,
        snapshot: citation,
      })));
    }
    const [modelRun] = await transaction.insert(databaseSchema.modelRuns).values({
      conversationId: input.conversationId,
      messageId: assistantMessage?.id,
      provider: input.provider,
      model: input.model,
      status: "completed",
      inputTokens: input.usage?.inputTokens,
      outputTokens: input.usage?.outputTokens,
      retrievalSnapshot: input.retrievalSnapshot,
    }).returning();
    await transaction.insert(databaseSchema.usageLedger).values({
      anonymousSessionHash: input.anonymousSessionHash,
      modelRunId: modelRun.id,
      inputTokens: input.usage?.inputTokens ?? 0,
      outputTokens: input.usage?.outputTokens ?? 0,
    });
    await transaction.update(databaseSchema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(databaseSchema.conversations.id, input.conversationId));
    return true;
  });
}
