import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { databaseSchema, getDatabase, isDatabaseConfigured, withAnonymousContext, withUserContext } from "@atlas/db";

export interface ConversationOwner {
  userId?: string;
  anonymousSessionHash?: string;
}

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

function validOwner(owner: ConversationOwner) {
  return Boolean(owner.userId) !== Boolean(owner.anonymousSessionHash);
}

function runWithOwner<T>(owner: ConversationOwner, operation: (transaction: Transaction) => Promise<T>) {
  if (!validOwner(owner)) throw new Error("A conversation must have exactly one owner.");
  return owner.userId
    ? withUserContext(owner.userId, operation)
    : withAnonymousContext(owner.anonymousSessionHash!, operation);
}

function ownerCondition(owner: ConversationOwner) {
  return owner.userId
    ? eq(databaseSchema.conversations.userId, owner.userId)
    : eq(databaseSchema.conversations.anonymousSessionHash, owner.anonymousSessionHash!);
}

export async function createConversationRecord(input: { id: string; title?: string; locale: string }, owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return false;
  await runWithOwner(owner, (transaction) => transaction.insert(databaseSchema.conversations).values({
    ...input,
    userId: owner.userId,
    anonymousSessionHash: owner.anonymousSessionHash,
  }));
  return true;
}

export async function listConversationRecords(owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return [];
  return runWithOwner(owner, (transaction) => transaction.select({
    id: databaseSchema.conversations.id,
    title: databaseSchema.conversations.title,
    locale: databaseSchema.conversations.locale,
    createdAt: databaseSchema.conversations.createdAt,
    updatedAt: databaseSchema.conversations.updatedAt,
  }).from(databaseSchema.conversations).where(and(ownerCondition(owner), isNull(databaseSchema.conversations.archivedAt))).orderBy(desc(databaseSchema.conversations.updatedAt)).limit(50));
}

export async function readConversationRecord(id: string, owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return null;
  return runWithOwner(owner, async (transaction) => {
    const [conversation] = await transaction.select().from(databaseSchema.conversations).where(and(
      eq(databaseSchema.conversations.id, id), ownerCondition(owner),
    )).limit(1);
    if (!conversation) return null;
    const rows = await transaction.select().from(databaseSchema.messages)
      .where(eq(databaseSchema.messages.conversationId, id)).orderBy(asc(databaseSchema.messages.sequence));
    const messageIds = rows.map((row) => row.id);
    const citations = messageIds.length ? await transaction.select().from(databaseSchema.messageCitations)
      .where(inArray(databaseSchema.messageCitations.messageId, messageIds))
      .orderBy(asc(databaseSchema.messageCitations.ordinal)) : [];
    return { ...conversation, messages: rows.map((message) => ({ ...message, citations: citations.filter((citation) => citation.messageId === message.id).map((citation) => citation.snapshot) })) };
  });
}

export async function deleteConversationRecord(id: string, owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return false;
  const deleted = await runWithOwner(owner, (transaction) => transaction.delete(databaseSchema.conversations).where(and(
    eq(databaseSchema.conversations.id, id), ownerCondition(owner),
  )).returning({ id: databaseSchema.conversations.id }));
  return deleted.length > 0;
}

export async function conversationExists(id: string, owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return true;
  const rows = await runWithOwner(owner, (transaction) => transaction.select({ id: databaseSchema.conversations.id }).from(databaseSchema.conversations).where(and(
    eq(databaseSchema.conversations.id, id), ownerCondition(owner),
  )).limit(1));
  return rows.length > 0;
}

export async function appendConversationExchange(input: {
  conversationId: string;
  userText: string;
  assistantText: string;
  providerResponseId?: string;
  citations?: unknown[];
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  retrievalSnapshot?: unknown;
  latencyMs?: number;
  estimatedCostUsd?: string;
}, owner: ConversationOwner) {
  if (!isDatabaseConfigured()) return false;
  return runWithOwner(owner, async (transaction) => {
    const [conversation] = await transaction.select({ id: databaseSchema.conversations.id, title: databaseSchema.conversations.title })
      .from(databaseSchema.conversations).where(and(eq(databaseSchema.conversations.id, input.conversationId), ownerCondition(owner))).limit(1);
    if (!conversation) return false;
    const [current] = await transaction.select({ value: max(databaseSchema.messages.sequence) }).from(databaseSchema.messages).where(eq(databaseSchema.messages.conversationId, input.conversationId));
    const firstSequence = (current?.value ?? 0) + 1;
    const inserted = await transaction.insert(databaseSchema.messages).values([
      { conversationId: input.conversationId, role: "user", content: input.userText, sequence: firstSequence },
      { conversationId: input.conversationId, role: "assistant", content: input.assistantText, sequence: firstSequence + 1, providerResponseId: input.providerResponseId },
    ]).returning();
    const assistantMessage = inserted[1];
    if (assistantMessage && input.citations?.length) await transaction.insert(databaseSchema.messageCitations).values(input.citations.map((citation, index) => ({ messageId: assistantMessage.id, ordinal: index + 1, snapshot: citation })));
    const [modelRun] = await transaction.insert(databaseSchema.modelRuns).values({ conversationId: input.conversationId, messageId: assistantMessage?.id, provider: input.provider, model: input.model, status: "completed", latencyMs: input.latencyMs, inputTokens: input.usage?.inputTokens, outputTokens: input.usage?.outputTokens, retrievalSnapshot: input.retrievalSnapshot }).returning();
    await transaction.insert(databaseSchema.usageLedger).values({ userId: owner.userId, anonymousSessionHash: owner.anonymousSessionHash, modelRunId: modelRun.id, inputTokens: input.usage?.inputTokens ?? 0, outputTokens: input.usage?.outputTokens ?? 0, estimatedCostUsd: input.estimatedCostUsd });
    await transaction.update(databaseSchema.conversations).set({ title: conversation.title ?? input.userText.slice(0, 60), updatedAt: new Date() }).where(eq(databaseSchema.conversations.id, input.conversationId));
    return true;
  });
}
