import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { databaseSchema, withUserContext } from "@atlas/db";

export const sensitiveMemoryPattern = /(政治立场|政治倾向|宗教身份|宗教信仰|健康状况|病史|诊断结果|political (?:view|affiliation)|religious (?:identity|belief)|health (?:condition|status)|medical history)/i;

export function rejectsSensitiveMemory(input: { label: string; value: string }) {
  return sensitiveMemoryPattern.test(`${input.label}\n${input.value}`);
}

export async function loadConfirmedMemoryContext(userId: string) {
  return withUserContext(userId, async (transaction) => {
    const [profile] = await transaction.select({ memoryEnabled: databaseSchema.userProfiles.memoryEnabled }).from(databaseSchema.userProfiles).where(eq(databaseSchema.userProfiles.userId, userId)).limit(1);
    if (!profile?.memoryEnabled) return [];
    const rows = await transaction.select({ id: databaseSchema.memoryItems.id, memoryType: databaseSchema.memoryItems.memoryType, label: databaseSchema.memoryItems.label, value: databaseSchema.memoryItems.value })
      .from(databaseSchema.memoryItems).where(and(
        eq(databaseSchema.memoryItems.userId, userId),
        eq(databaseSchema.memoryItems.status, "confirmed"),
        isNull(databaseSchema.memoryItems.deletedAt),
        or(isNull(databaseSchema.memoryItems.expiresAt), gt(databaseSchema.memoryItems.expiresAt, new Date())),
      )).orderBy(asc(databaseSchema.memoryItems.createdAt)).limit(8);
    if (rows.length) {
      await transaction.update(databaseSchema.memoryItems).set({ lastUsedAt: new Date() }).where(and(eq(databaseSchema.memoryItems.userId, userId), eq(databaseSchema.memoryItems.status, "confirmed")));
      await transaction.insert(databaseSchema.auditEvents).values({ actorId: userId, actorRole: "member", action: "memory.context-read", resourceType: "memory", metadata: { count: rows.length, purpose: "conversation-personalization" } });
    }
    return rows;
  });
}
