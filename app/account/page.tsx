import { desc, eq } from "drizzle-orm";
import { databaseSchema, getDatabase, withUserContext } from "@atlas/db";
import { AccountDashboard } from "./AccountDashboard";
import { requireMemberPrincipal } from "./_lib/auth";

export default async function AccountPage() {
  const principal = await requireMemberPrincipal("/account");
  const userId = principal.subject!;
  const [user] = await getDatabase().select({ email: databaseSchema.users.email, emailVerifiedAt: databaseSchema.users.emailVerifiedAt, createdAt: databaseSchema.users.createdAt }).from(databaseSchema.users).where(eq(databaseSchema.users.id, userId)).limit(1);
  const data = await withUserContext(userId, async (transaction) => {
    const [profileRows, favorites, readingProgress, journeyProgress, sessions] = await Promise.all([
      transaction.select().from(databaseSchema.userProfiles).where(eq(databaseSchema.userProfiles.userId, userId)).limit(1),
      transaction.select({ entityId: databaseSchema.entities.stableKey, entityType: databaseSchema.entities.entityType, title: databaseSchema.entityVersions.title, slug: databaseSchema.entityVersions.slug }).from(databaseSchema.favorites).innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.favorites.entityId)).innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId)).where(eq(databaseSchema.favorites.userId, userId)).orderBy(desc(databaseSchema.favorites.createdAt)),
      transaction.select({ entityId: databaseSchema.entities.stableKey, entityType: databaseSchema.entities.entityType, title: databaseSchema.entityVersions.title, slug: databaseSchema.entityVersions.slug, progress: databaseSchema.readingProgress.progress }).from(databaseSchema.readingProgress).innerJoin(databaseSchema.entities, eq(databaseSchema.entities.id, databaseSchema.readingProgress.entityId)).innerJoin(databaseSchema.entityVersions, eq(databaseSchema.entityVersions.id, databaseSchema.entities.currentPublishedVersionId)).where(eq(databaseSchema.readingProgress.userId, userId)).orderBy(desc(databaseSchema.readingProgress.updatedAt)),
      transaction.select({ journeyId: databaseSchema.journeys.stableKey, title: databaseSchema.journeyVersions.title, slug: databaseSchema.journeyVersions.slug, nodeOrdinal: databaseSchema.journeyProgress.nodeOrdinal, completedAt: databaseSchema.journeyProgress.completedAt }).from(databaseSchema.journeyProgress).innerJoin(databaseSchema.journeys, eq(databaseSchema.journeys.id, databaseSchema.journeyProgress.journeyId)).innerJoin(databaseSchema.journeyVersions, eq(databaseSchema.journeyVersions.id, databaseSchema.journeys.currentPublishedVersionId)).where(eq(databaseSchema.journeyProgress.userId, userId)).orderBy(desc(databaseSchema.journeyProgress.updatedAt)),
      transaction.select({ id: databaseSchema.sessions.id, createdAt: databaseSchema.sessions.createdAt, lastSeenAt: databaseSchema.sessions.lastSeenAt, expiresAt: databaseSchema.sessions.expiresAt }).from(databaseSchema.sessions).where(eq(databaseSchema.sessions.userId, userId)).orderBy(desc(databaseSchema.sessions.createdAt)),
    ]);
    return { profile: profileRows[0], favorites, readingProgress, journeyProgress, sessions };
  });
  const profile = data.profile ?? { displayName: null, locale: "zh-CN", explanationDepth: "balanced", memoryEnabled: false };
  return <AccountDashboard
    initialMe={{ account: { email: user?.email, emailVerifiedAt: user?.emailVerifiedAt?.toISOString() ?? null, createdAt: user?.createdAt.toISOString() }, profile }}
    initialLibrary={{ favorites: data.favorites, readingProgress: data.readingProgress, journeyProgress: data.journeyProgress.map((item) => ({ ...item, completedAt: item.completedAt?.toISOString() ?? null })) }}
    initialSessions={data.sessions.map((session) => ({ ...session, current: session.id === principal.sessionId, createdAt: session.createdAt.toISOString(), lastSeenAt: session.lastSeenAt.toISOString(), expiresAt: session.expiresAt.toISOString() }))}
  />;
}
