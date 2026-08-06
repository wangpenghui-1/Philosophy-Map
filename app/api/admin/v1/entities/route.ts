import { apiEnvelope, createEntityDraftSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { createEntityDraft, versionEtag } from "../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createEntityDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const version = await createEntityDraft(auth.principal, parsed.data);
    return jsonResponse(apiEnvelope(version), {
      status: 201,
      headers: { etag: versionEtag(version) },
    });
  } catch (error) {
    return problemResponse(403, "没有创建候选内容的权限", error instanceof Error ? error.message : undefined);
  }
}
