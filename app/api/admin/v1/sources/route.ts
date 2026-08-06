import { apiEnvelope, createSourceDraftSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { problemResponse, jsonResponse, validationProblem } from "../../../_lib/http";
import { createSourceDraft } from "../../../_lib/sources";
import { versionEtag } from "../../../_lib/editorial";

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createSourceDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const version = await createSourceDraft(auth.principal, parsed.data);
    return jsonResponse(apiEnvelope(version), { status: 201, headers: { etag: versionEtag(version) } });
  } catch (error) {
    return problemResponse(403, "无法创建来源候选版本", error instanceof Error ? error.message : undefined);
  }
}
