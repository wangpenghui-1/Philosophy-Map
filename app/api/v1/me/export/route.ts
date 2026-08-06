import { asc, eq, inArray } from "drizzle-orm";
import { apiEnvelope } from "@atlas/api-contracts";
import { databaseSchema, getDatabase, withUserContext } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse } from "../../../_lib/http";

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const userId = auth.principal.subject!;
  const database = getDatabase();
  const { profile, favorites, reading, journeys, memories, conversations } = await withUserContext(userId, async (transaction) => {
    const [profile, favorites, reading, journeys, memories, conversations] = await Promise.all([
      transaction.select().from(databaseSchema.userProfiles).where(eq(databaseSchema.userProfiles.userId, userId)),
      transaction.select().from(databaseSchema.favorites).where(eq(databaseSchema.favorites.userId, userId)),
      transaction.select().from(databaseSchema.readingProgress).where(eq(databaseSchema.readingProgress.userId, userId)),
      transaction.select().from(databaseSchema.journeyProgress).where(eq(databaseSchema.journeyProgress.userId, userId)),
      transaction.select().from(databaseSchema.memoryItems).where(eq(databaseSchema.memoryItems.userId, userId)),
      transaction.select().from(databaseSchema.conversations).where(eq(databaseSchema.conversations.userId, userId)).orderBy(asc(databaseSchema.conversations.createdAt)),
    ]);
    return { profile, favorites, reading, journeys, memories, conversations };
  });
  const messages = conversations.length
    ? await database.select().from(databaseSchema.messages)
      .where(inArray(databaseSchema.messages.conversationId, conversations.map((item) => item.id)))
      .orderBy(asc(databaseSchema.messages.createdAt))
    : [];
  await database.insert(databaseSchema.auditEvents).values({
    actorId: userId,
    actorRole: auth.principal.role,
    action: "user-data.exported",
    resourceType: "user",
    resourceId: userId,
  });
  return jsonResponse(apiEnvelope({
    exportedAt: new Date().toISOString(),
    profile,
    favorites,
    readingProgress: reading,
    journeyProgress: journeys,
    memories,
    conversations,
    messages,
  }), { headers: { "content-disposition": `attachment; filename="atlas-export-${userId}.json"` } });
}
