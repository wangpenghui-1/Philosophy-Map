import { eq } from "drizzle-orm";
import { apiEnvelope, profileUpdateSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../_lib/auth";
import { jsonResponse, validationProblem } from "../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const database = getDatabase();
  const [profile] = await database.select().from(databaseSchema.userProfiles)
    .where(eq(databaseSchema.userProfiles.userId, auth.principal.subject!)).limit(1);
  return jsonResponse(apiEnvelope(profile ?? {
    userId: auth.principal.subject,
    locale: "zh-CN",
    explanationDepth: "balanced",
    memoryEnabled: false,
  }));
}

export async function PATCH(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const database = getDatabase();
  const [profile] = await database.insert(databaseSchema.userProfiles).values({
    userId: auth.principal.subject!,
    ...parsed.data,
  }).onConflictDoUpdate({
    target: databaseSchema.userProfiles.userId,
    set: { ...parsed.data, updatedAt: new Date() },
  }).returning();
  return jsonResponse(apiEnvelope(profile));
}
