import { eq } from "drizzle-orm";
import { apiEnvelope, profileUpdateSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase, withUserContext } from "@atlas/db";
import { authenticatedPrincipal } from "../../_lib/auth";
import { jsonResponse, validationProblem } from "../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const [profile] = await withUserContext(auth.principal.subject!, (transaction) => transaction.select().from(databaseSchema.userProfiles)
    .where(eq(databaseSchema.userProfiles.userId, auth.principal.subject!)).limit(1));
  const [account] = await getDatabase().select({ email: databaseSchema.users.email, emailVerifiedAt: databaseSchema.users.emailVerifiedAt, createdAt: databaseSchema.users.createdAt }).from(databaseSchema.users).where(eq(databaseSchema.users.id, auth.principal.subject!)).limit(1);
  return jsonResponse(apiEnvelope({ account, profile: profile ?? {
    userId: auth.principal.subject,
    locale: "zh-CN",
    explanationDepth: "balanced",
    memoryEnabled: false,
  } }));
}

export async function PATCH(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const [profile] = await withUserContext(auth.principal.subject!, async (transaction) => {
    const updated = await transaction.insert(databaseSchema.userProfiles).values({ userId: auth.principal.subject!, ...parsed.data })
      .onConflictDoUpdate({ target: databaseSchema.userProfiles.userId, set: { ...parsed.data, updatedAt: new Date() } }).returning();
    if (parsed.data.memoryEnabled !== undefined) {
      await transaction.insert(databaseSchema.consents).values({ userId: auth.principal.subject!, consentType: "long-term-memory", granted: parsed.data.memoryEnabled, policyVersion: "2026-08-07" });
      await transaction.insert(databaseSchema.auditEvents).values({ actorId: auth.principal.subject!, actorRole: auth.principal.role, action: parsed.data.memoryEnabled ? "memory.enabled" : "memory.disabled", resourceType: "user", resourceId: auth.principal.subject! });
    }
    return updated;
  });
  return jsonResponse(apiEnvelope({ profile }));
}
