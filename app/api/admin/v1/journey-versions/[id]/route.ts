import { apiEnvelope, updateJourneyDraftSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { versionEtag } from "../../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";
import { updateJourneyDraft } from "../../../../_lib/journeys";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = updateJourneyDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const value = await updateJourneyDraft(auth.principal, (await params).id, request, parsed.data);
    if (!value) return problemResponse(404, "未找到旅程版本");
    return jsonResponse(apiEnvelope(value), { headers: { etag: versionEtag(value) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法更新旅程版本", error instanceof Error ? error.message : undefined);
  }
}
