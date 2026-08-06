import { and, eq } from "drizzle-orm";
import { apiEnvelope, memoryPatchSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
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
  const { memoryId } = await params;
  const database = getDatabase();
  const [memory] = await database.update(databaseSchema.memoryItems).set({
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
  if (!memory) return problemResponse(404, "未找到记忆");
  await database.insert(databaseSchema.memoryEvents).values({
    memoryId,
    actorId: auth.principal.subject!,
    action: "updated-by-user",
  });
  return jsonResponse(apiEnvelope(memory));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memoryId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const { memoryId } = await params;
  const database = getDatabase();
  const deleted = await database.delete(databaseSchema.memoryItems).where(and(
    eq(databaseSchema.memoryItems.id, memoryId),
    eq(databaseSchema.memoryItems.userId, auth.principal.subject!),
  )).returning({ id: databaseSchema.memoryItems.id });
  if (!deleted.length) return problemResponse(404, "未找到记忆");
  return new Response(null, { status: 204 });
}
