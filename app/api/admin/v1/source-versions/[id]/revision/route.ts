import { apiEnvelope } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { versionEtag } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse } from "../../../../../_lib/http";
import { createSourceRevision } from "../../../../../_lib/sources";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  try {
    const version = await createSourceRevision(auth.principal, (await params).id);
    if (!version) return problemResponse(404, "未找到可修订的已发布来源");
    return jsonResponse(apiEnvelope(version), { status: 201, headers: { etag: versionEtag(version) } });
  } catch (error) {
    return problemResponse(403, "无法创建来源修订", error instanceof Error ? error.message : undefined);
  }
}
