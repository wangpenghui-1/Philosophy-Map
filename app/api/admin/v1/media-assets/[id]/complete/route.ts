import { apiEnvelope } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { jsonResponse, problemResponse } from "../../../../../_lib/http";
import { completeMediaUpload } from "../../../../../_lib/media";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  try {
    const asset = await completeMediaUpload(auth.principal, (await params).id);
    if (!asset) return problemResponse(404, "未找到媒体资产");
    return jsonResponse(apiEnvelope(asset));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法确认媒体上传", error instanceof Error ? error.message : undefined);
  }
}
