import { and, eq, isNull } from "drizzle-orm";
import { apiEnvelope } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { jsonResponse, problemResponse } from "../../../../_lib/http";

async function resolveEntity(stableKey: string) {
  const database = getDatabase();
  const [entity] = await database.select({ id: databaseSchema.entities.id })
    .from(databaseSchema.entities)
    .where(and(
      eq(databaseSchema.entities.stableKey, stableKey),
      isNull(databaseSchema.entities.archivedAt),
    )).limit(1);
  return entity;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const { entityId } = await params;
  const entity = await resolveEntity(entityId);
  if (!entity) return problemResponse(404, "未找到知识实体");
  const database = getDatabase();
  await database.insert(databaseSchema.favorites).values({
    userId: auth.principal.subject!,
    entityId: entity.id,
  }).onConflictDoNothing();
  return jsonResponse(apiEnvelope({ entityId, favorite: true }));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const { entityId } = await params;
  const entity = await resolveEntity(entityId);
  if (!entity) return problemResponse(404, "未找到知识实体");
  const database = getDatabase();
  await database.delete(databaseSchema.favorites).where(and(
    eq(databaseSchema.favorites.userId, auth.principal.subject!),
    eq(databaseSchema.favorites.entityId, entity.id),
  ));
  return new Response(null, { status: 204 });
}
