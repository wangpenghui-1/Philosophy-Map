import { and, desc, eq, isNull } from "drizzle-orm";
import { apiEnvelope, createMemorySchema } from "@atlas/api-contracts";
import { databaseSchema, withUserContext } from "@atlas/db";
import { rejectsSensitiveMemory } from "../../../_lib/memories";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const rows = await withUserContext(auth.principal.subject!, (transaction) => transaction.select().from(databaseSchema.memoryItems).where(and(
    eq(databaseSchema.memoryItems.userId, auth.principal.subject!),
    isNull(databaseSchema.memoryItems.deletedAt),
  )).orderBy(desc(databaseSchema.memoryItems.updatedAt)));
  return jsonResponse(apiEnvelope(rows));
}

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createMemorySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  if (rejectsSensitiveMemory(parsed.data)) return problemResponse(422, "该信息不能保存为长期记忆", "思想星图不保存政治立场、宗教身份、健康状况或病史等敏感属性。");
  const memory = await withUserContext(auth.principal.subject!, async (transaction) => {
    const [profile] = await transaction.select({ memoryEnabled: databaseSchema.userProfiles.memoryEnabled }).from(databaseSchema.userProfiles).where(eq(databaseSchema.userProfiles.userId, auth.principal.subject!)).limit(1);
    if (!profile?.memoryEnabled) return null;
    const [created] = await transaction.insert(databaseSchema.memoryItems).values({ userId: auth.principal.subject!, status: parsed.data.confirmed ? "confirmed" : "candidate", memoryType: parsed.data.memoryType, label: parsed.data.label, value: parsed.data.value, confirmedAt: parsed.data.confirmed ? new Date() : undefined, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined }).returning();
    await transaction.insert(databaseSchema.memoryEvents).values({ memoryId: created.id, actorId: auth.principal.subject!, action: parsed.data.confirmed ? "explicitly-confirmed" : "candidate-created" });
    return created;
  });
  if (!memory) return problemResponse(409, "长期记忆尚未开启", "请先在个人设置中明确开启长期记忆。");
  return jsonResponse(apiEnvelope(memory), { status: 201 });
}
