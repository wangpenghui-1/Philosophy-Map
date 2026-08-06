import { apiEnvelope } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { versionEtag } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse } from "../../../../../_lib/http";
import { createRelationRevision } from "../../../../../_lib/relations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  try {
    const version = await createRelationRevision(auth.principal, (await params).id);
    if (!version) return problemResponse(404, "未找到可修订的已发布关系");
    return jsonResponse(apiEnvelope(version), { status: 201, headers: { etag: versionEtag(version) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法创建关系修订", error instanceof Error ? error.message : undefined);
  }
}
