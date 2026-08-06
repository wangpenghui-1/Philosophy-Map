import { apiEnvelope, publicationActionSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../../_lib/auth";
import { changeEntityPublication } from "../../../../../_lib/editorial";
import { jsonResponse, problemResponse, validationProblem } from "../../../../../_lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = publicationActionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const { id } = await params;
  try {
    const result = await changeEntityPublication(
      auth.principal,
      id,
      parsed.data.action,
      parsed.data.reason,
      parsed.data.expectedCurrentVersionId,
    );
    if (!result) return problemResponse(404, "未找到内容版本");
    return jsonResponse(apiEnvelope(result));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法变更公开版本", error instanceof Error ? error.message : undefined);
  }
}
