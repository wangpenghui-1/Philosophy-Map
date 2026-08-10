import { apiEnvelope } from "@atlas/api-contracts";
import { getSystemHealth } from "../../_lib/health";
import { jsonResponse } from "../../_lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getSystemHealth();
  const publicSummary = {
    status: report.status,
    mode: report.mode,
    snapshotAvailable: report.snapshotAvailable,
    checkedAt: report.checkedAt,
    dependencies: report.services.map(({ name, status, required }) => ({ name, status, required })),
  };
  return jsonResponse(apiEnvelope(publicSummary), {
    status: report.status === "not-ready" ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
