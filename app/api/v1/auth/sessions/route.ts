import { desc, eq } from "drizzle-orm";
import { apiEnvelope } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { jsonResponse } from "../../../_lib/http";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request); if ("response" in auth) return auth.response;
  const rows = await getDatabase().select({ id: databaseSchema.sessions.id, createdAt: databaseSchema.sessions.createdAt, lastSeenAt: databaseSchema.sessions.lastSeenAt, expiresAt: databaseSchema.sessions.expiresAt })
    .from(databaseSchema.sessions).where(eq(databaseSchema.sessions.userId, auth.principal.subject!)).orderBy(desc(databaseSchema.sessions.createdAt));
  return jsonResponse(apiEnvelope(rows.map((row) => ({ ...row, current: row.id === auth.principal.sessionId }))));
}
