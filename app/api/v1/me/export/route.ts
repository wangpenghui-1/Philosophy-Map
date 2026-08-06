import { asc, eq, inArray } from "drizzle-orm";
import { apiEnvelope } from "@atlas/api-contracts";
import { databaseSchema, withUserContext } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse } from "../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const userId = auth.principal.subject!;
  const limited = await enforceRateLimit(request, "privacy:data-export", { limit: 2, windowSeconds: 60 * 60 }, userId);
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  const exported = await withUserContext(userId, async (transaction) => {
    const [account, profile, consents, favorites, reading, journeys, memories, conversations, sessions] = await Promise.all([
      transaction.select({ id: databaseSchema.users.id, email: databaseSchema.users.email, emailVerifiedAt: databaseSchema.users.emailVerifiedAt, createdAt: databaseSchema.users.createdAt, updatedAt: databaseSchema.users.updatedAt }).from(databaseSchema.users).where(eq(databaseSchema.users.id, userId)),
      transaction.select().from(databaseSchema.userProfiles).where(eq(databaseSchema.userProfiles.userId, userId)),
      transaction.select().from(databaseSchema.consents).where(eq(databaseSchema.consents.userId, userId)).orderBy(asc(databaseSchema.consents.createdAt)),
      transaction.select().from(databaseSchema.favorites).where(eq(databaseSchema.favorites.userId, userId)),
      transaction.select().from(databaseSchema.readingProgress).where(eq(databaseSchema.readingProgress.userId, userId)),
      transaction.select().from(databaseSchema.journeyProgress).where(eq(databaseSchema.journeyProgress.userId, userId)),
      transaction.select().from(databaseSchema.memoryItems).where(eq(databaseSchema.memoryItems.userId, userId)),
      transaction.select().from(databaseSchema.conversations).where(eq(databaseSchema.conversations.userId, userId)).orderBy(asc(databaseSchema.conversations.createdAt)),
      transaction.select({ id: databaseSchema.sessions.id, createdAt: databaseSchema.sessions.createdAt, lastSeenAt: databaseSchema.sessions.lastSeenAt, expiresAt: databaseSchema.sessions.expiresAt, revokedAt: databaseSchema.sessions.revokedAt }).from(databaseSchema.sessions).where(eq(databaseSchema.sessions.userId, userId)),
    ]);
    const conversationIds = conversations.map((item) => item.id);
    const memoryIds = memories.map((item) => item.id);
    const messages = conversationIds.length ? await transaction.select().from(databaseSchema.messages).where(inArray(databaseSchema.messages.conversationId, conversationIds)).orderBy(asc(databaseSchema.messages.createdAt)) : [];
    const messageIds = messages.map((item) => item.id);
    const [messageCitations, modelRuns, usage, memoryLinks, memoryEvents, memoryEmbeddings] = await Promise.all([
      messageIds.length ? transaction.select().from(databaseSchema.messageCitations).where(inArray(databaseSchema.messageCitations.messageId, messageIds)) : [],
      conversationIds.length ? transaction.select().from(databaseSchema.modelRuns).where(inArray(databaseSchema.modelRuns.conversationId, conversationIds)) : [],
      transaction.select().from(databaseSchema.usageLedger).where(eq(databaseSchema.usageLedger.userId, userId)),
      memoryIds.length ? transaction.select().from(databaseSchema.memoryLinks).where(inArray(databaseSchema.memoryLinks.memoryId, memoryIds)) : [],
      memoryIds.length ? transaction.select().from(databaseSchema.memoryEvents).where(inArray(databaseSchema.memoryEvents.memoryId, memoryIds)) : [],
      transaction.select().from(databaseSchema.memoryEmbeddings).where(eq(databaseSchema.memoryEmbeddings.userId, userId)),
    ]);
    await transaction.insert(databaseSchema.auditEvents).values({ actorId: userId, actorRole: auth.principal.role, action: "user-data.exported", resourceType: "user", resourceId: userId, metadata: { format: "json", schemaVersion: 1 } });
    return { account, profile, consents, sessions, favorites, readingProgress: reading, journeyProgress: journeys, memories, memoryLinks, memoryEvents, memoryEmbeddings, conversations, messages, messageCitations, modelRuns, usage };
  });
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ exportedAt: new Date().toISOString(), schemaVersion: 1, ...exported }), { headers: { "content-disposition": `attachment; filename="atlas-export-${userId}.json"` } }), limited.result);
}
