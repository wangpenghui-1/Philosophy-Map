import { and, desc, eq, isNull } from "drizzle-orm";
import { apiEnvelope, createMemorySchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const database = getDatabase();
  const rows = await database.select().from(databaseSchema.memoryItems).where(and(
    eq(databaseSchema.memoryItems.userId, auth.principal.subject!),
    isNull(databaseSchema.memoryItems.deletedAt),
  )).orderBy(desc(databaseSchema.memoryItems.updatedAt));
  return jsonResponse(apiEnvelope(rows));
}

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createMemorySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const database = getDatabase();
  const [profile] = await database.select({ memoryEnabled: databaseSchema.userProfiles.memoryEnabled })
    .from(databaseSchema.userProfiles)
    .where(eq(databaseSchema.userProfiles.userId, auth.principal.subject!)).limit(1);
  if (!profile?.memoryEnabled) {
    return problemResponse(409, "长期记忆尚未开启", "请先在个人设置中明确开启长期记忆。 ");
  }
  const [memory] = await database.insert(databaseSchema.memoryItems).values({
    userId: auth.principal.subject!,
    status: parsed.data.confirmed ? "confirmed" : "candidate",
    memoryType: parsed.data.memoryType,
    label: parsed.data.label,
    value: parsed.data.value,
    confirmedAt: parsed.data.confirmed ? new Date() : undefined,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
  }).returning();
  await database.insert(databaseSchema.memoryEvents).values({
    memoryId: memory.id,
    actorId: auth.principal.subject!,
    action: parsed.data.confirmed ? "explicitly-confirmed" : "candidate-created",
  });
  return jsonResponse(apiEnvelope(memory), { status: 201 });
}
