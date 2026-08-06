import { apiEnvelope } from "@atlas/api-contracts";
import { DatabaseSessionAuthAdapter, isAdminConsoleRole } from "@atlas/auth";
import { isDatabaseConfigured } from "@atlas/db";
import { jsonResponse } from "../../../../_lib/http";

const adapter = new DatabaseSessionAuthAdapter();

export async function GET(request: Request) {
  const principal = await adapter.resolve(request);
  return jsonResponse(apiEnvelope({
    authenticated: Boolean(principal.subject) && isAdminConsoleRole(principal.role),
    role: principal.role,
    mode: principal.mode ?? "anonymous",
    databaseConfigured: isDatabaseConfigured(),
  }));
}
