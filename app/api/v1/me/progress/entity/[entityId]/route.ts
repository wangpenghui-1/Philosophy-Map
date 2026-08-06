import { and, eq, isNull } from "drizzle-orm";
import { apiEnvelope, progressUpdateSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../../../_lib/http";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = progressUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { entityId } = await params;
  const database = getDatabase();
  const [entity] = await database.select({ id: databaseSchema.entities.id })
    .from(databaseSchema.entities).where(and(
      eq(databaseSchema.entities.stableKey, entityId),
      isNull(databaseSchema.entities.archivedAt),
    )).limit(1);
  if (!entity) return problemResponse(404, "未找到知识实体");
  const [progress] = await database.insert(databaseSchema.readingProgress).values({
    userId: auth.principal.subject!,
    entityId: entity.id,
    progress: parsed.data.progress,
    anchor: parsed.data.anchor,
  }).onConflictDoUpdate({
    target: [databaseSchema.readingProgress.userId, databaseSchema.readingProgress.entityId],
    set: { ...parsed.data, updatedAt: new Date() },
  }).returning();
  return jsonResponse(apiEnvelope(progress));
}
