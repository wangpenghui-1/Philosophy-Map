import { apiEnvelope } from "@atlas/api-contracts";
import { jsonResponse } from "../../_lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse(apiEnvelope({
    status: "alive",
    service: "atlas-of-ideas",
    uptimeSeconds: Math.round(process.uptime()),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    checkedAt: new Date().toISOString(),
  }), { headers: { "cache-control": "no-store" } });
}
