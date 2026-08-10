import { desc, eq } from "drizzle-orm";
import { apiEnvelope } from "@atlas/api-contracts";
import { databaseSchema, withUserContext } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse } from "../../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request); if ("response" in auth) return auth.response;
  const userId = auth.principal.subject!;
  const data = await withUserContext(userId, async (transaction) => {
    const [favorites, reading, journeys] = await Promise.all([
      transaction.select({ entityId: databaseSchema.entities.stableKey, entityType: databaseSchema.entities.entityType, title: databaseSchema.entityVersions.title, slug: databaseSchema.entityVersions.slug, createdAt: databaseSchema.favorites.createdAt })
        .from(databaseSchema.favorites).innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.favorites.entityId)).innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId)).where(eq(databaseSchema.favorites.userId, userId)).orderBy(desc(databaseSchema.favorites.createdAt)),
      transaction.select({ entityId: databaseSchema.entities.stableKey, entityType: databaseSchema.entities.entityType, title: databaseSchema.entityVersions.title, slug: databaseSchema.entityVersions.slug, progress: databaseSchema.readingProgress.progress, anchor: databaseSchema.readingProgress.anchor, updatedAt: databaseSchema.readingProgress.updatedAt })
        .from(databaseSchema.readingProgress).innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.readingProgress.entityId)).innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId)).where(eq(databaseSchema.readingProgress.userId, userId)).orderBy(desc(databaseSchema.readingProgress.updatedAt)),
      transaction.select({ journeyId: databaseSchema.journeys.stableKey, title: databaseSchema.journeyVersions.title, slug: databaseSchema.journeyVersions.slug, nodeOrdinal: databaseSchema.journeyProgress.nodeOrdinal, completedAt: databaseSchema.journeyProgress.completedAt, updatedAt: databaseSchema.journeyProgress.updatedAt })
        .from(databaseSchema.journeyProgress).innerJoin(databaseSchema.journeys, eq(databaseSchema.journeys.id, databaseSchema.journeyProgress.journeyId)).innerJoin(databaseSchema.journeyVersions, eq(databaseSchema.journeyVersions.id, databaseSchema.journeys.currentPublishedVersionId)).where(eq(databaseSchema.journeyProgress.userId, userId)).orderBy(desc(databaseSchema.journeyProgress.updatedAt)),
    ]);
    return { favorites, readingProgress: reading, journeyProgress: journeys };
  });
  return jsonResponse(apiEnvelope(data));
}
