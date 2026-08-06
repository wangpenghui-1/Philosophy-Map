import { apiEnvelope, updateEntityDraftSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { updateEntityDraft, versionEtag } from "../../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = updateEntityDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { id } = await params;
  try {
    const version = await updateEntityDraft(auth.principal, id, request, parsed.data);
    if (!version) return problemResponse(404, "未找到内容版本");
    return jsonResponse(apiEnvelope(version), { headers: { etag: versionEtag(version) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法更新内容版本", error instanceof Error ? error.message : undefined);
  }
}
