import { apiEnvelope } from "@atlas/api-contracts";
import { hasPermission } from "@atlas/domain";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { getOperationalMetrics, getSystemHealth } from "../../../../_lib/health";
import { jsonResponse, problemResponse } from "../../../../_lib/http";
import { logEvent } from "@atlas/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  if (!hasPermission(auth.principal.role, "system:operate")) return problemResponse(403, "没有系统运维权限");
  const [health, metrics] = await Promise.all([getSystemHealth(), getOperationalMetrics()]);
  logEvent("info", "admin.system.health-read", {
    requestId: request.headers.get("x-request-id") ?? undefined,
    module: "administration",
    actorId: auth.principal.subject,
    status: health.status,
  });
  return jsonResponse(apiEnvelope({ health, metrics }), { headers: { "cache-control": "no-store" } });
}
