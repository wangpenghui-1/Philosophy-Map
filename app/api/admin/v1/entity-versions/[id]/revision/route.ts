import { apiEnvelope, createRevisionSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { createEntityRevision, versionEtag } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../../../_lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createRevisionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { id } = await params;
  try {
    const revision = await createEntityRevision(auth.principal, id, parsed.data.note);
    if (!revision) return problemResponse(404, "未找到内容版本");
    return jsonResponse(apiEnvelope(revision), {
      status: 201,
      headers: { etag: versionEtag(revision) },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法创建修订版本", error instanceof Error ? error.message : undefined);
  }
}
