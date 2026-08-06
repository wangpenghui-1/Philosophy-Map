import { apiEnvelope, editorialTransitionSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { versionEtag } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../../../_lib/http";
import { transitionSourceVersion } from "../../../../../_lib/sources";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = editorialTransitionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const version = await transitionSourceVersion(auth.principal, (await params).id, request, parsed.data.to, parsed.data.note);
    if (!version) return problemResponse(404, "未找到来源版本");
    return jsonResponse(apiEnvelope(version), { headers: { etag: versionEtag(version) } });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法推进来源状态", error instanceof Error ? error.message : undefined);
  }
}
