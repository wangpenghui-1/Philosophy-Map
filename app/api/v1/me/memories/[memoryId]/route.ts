import { and, eq } from "drizzle-orm";
import { apiEnvelope, memoryPatchSchema } from "@atlas/api-contracts";
import { databaseSchema, withUserContext } from "@atlas/db";
import { rejectsSensitiveMemory } from "../../../../_lib/memories";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memoryId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = memoryPatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  if (parsed.data.label && parsed.data.value && rejectsSensitiveMemory({ label: parsed.data.label, value: parsed.data.value })) return problemResponse(422, "该信息不能保存为长期记忆");
  const { memoryId } = await params;
  const memory = await withUserContext(auth.principal.subject!, async (transaction) => {
    const [current] = await transaction.select({ label: databaseSchema.memoryItems.label, value: databaseSchema.memoryItems.value }).from(databaseSchema.memoryItems).where(and(eq(databaseSchema.memoryItems.id, memoryId), eq(databaseSchema.memoryItems.userId, auth.principal.subject!))).limit(1);
    if (!current || rejectsSensitiveMemory({ label: parsed.data.label ?? current.label, value: parsed.data.value ?? current.value })) return null;
    const [updated] = await transaction.update(databaseSchema.memoryItems).set({
    ...parsed.data,
    expiresAt: parsed.data.expiresAt === undefined
      ? undefined
      : parsed.data.expiresAt === null ? null : new Date(parsed.data.expiresAt),
    confirmedAt: parsed.data.status === "confirmed" ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(and(
    eq(databaseSchema.memoryItems.id, memoryId),
    eq(databaseSchema.memoryItems.userId, auth.principal.subject!),
    )).returning();
    if (updated) await transaction.insert(databaseSchema.memoryEvents).values({ memoryId, actorId: auth.principal.subject!, action: "updated-by-user" });
    return updated;
  });
  if (!memory) return problemResponse(404, "未找到记忆或内容不允许保存");
  return jsonResponse(apiEnvelope(memory));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const { memoryId } = await params;
  const deleted = await withUserContext(auth.principal.subject!, async (transaction) => {
    const rows = await transaction.delete(databaseSchema.memoryItems).where(and(eq(databaseSchema.memoryItems.id, memoryId), eq(databaseSchema.memoryItems.userId, auth.principal.subject!))).returning({ id: databaseSchema.memoryItems.id });
    if (rows.length) await transaction.insert(databaseSchema.auditEvents).values({ actorId: auth.principal.subject!, actorRole: auth.principal.role, action: "memory.hard-deleted", resourceType: "memory", resourceId: memoryId });
    return rows;
  });
  if (!deleted.length) return problemResponse(404, "未找到记忆");
  return new Response(null, { status: 204 });
}
