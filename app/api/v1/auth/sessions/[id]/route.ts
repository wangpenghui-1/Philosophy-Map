import { and, eq, isNull } from "drizzle-orm";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { problemResponse } from "../../../../_lib/http";
import { clearedSessionCookie } from "../../../../_lib/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request); if ("response" in auth) return auth.response;
  const { id } = await params;
  const revoked = await getDatabase().update(databaseSchema.sessions).set({ revokedAt: new Date() }).where(and(eq(databaseSchema.sessions.id, id), eq(databaseSchema.sessions.userId, auth.principal.subject!), isNull(databaseSchema.sessions.revokedAt))).returning({ id: databaseSchema.sessions.id });
  if (!revoked.length) return problemResponse(404, "未找到活动会话");
  return new Response(null, { status: 204, headers: id === auth.principal.sessionId ? { "set-cookie": clearedSessionCookie(request) } : undefined });
}
