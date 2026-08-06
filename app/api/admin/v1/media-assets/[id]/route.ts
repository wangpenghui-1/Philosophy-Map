import { apiEnvelope, archiveMediaSchema, updateMediaMetadataSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { versionEtag } from "../../../../_lib/editorial";
import { archiveMediaAsset, updateMediaMetadata } from "../../../../_lib/media";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = updateMediaMetadataSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const asset = await updateMediaMetadata(auth.principal, (await params).id, request, parsed.data);
    if (!asset) return problemResponse(404, "未找到媒体资产");
    return jsonResponse(apiEnvelope(asset), { headers: { etag: versionEtag(asset) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法更新媒体资产", error instanceof Error ? error.message : undefined);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = archiveMediaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const asset = await archiveMediaAsset(auth.principal, (await params).id, request, parsed.data.reason);
    if (!asset) return problemResponse(404, "未找到媒体资产");
    return jsonResponse(apiEnvelope(asset));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法归档媒体资产", error instanceof Error ? error.message : undefined);
  }
}
