import { apiEnvelope } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { versionEtag } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse } from "../../../../../_lib/http";
import { createJourneyRevision } from "../../../../../_lib/journeys";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  try {
    const value = await createJourneyRevision(auth.principal, (await params).id);
    if (!value) return problemResponse(404, "未找到可修订的已发布旅程");
    return jsonResponse(apiEnvelope(value), { status: 201, headers: { etag: versionEtag(value) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法创建旅程修订", error instanceof Error ? error.message : undefined);
  }
}
