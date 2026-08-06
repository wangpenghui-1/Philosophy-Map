import { apiEnvelope, createMediaUploadSchema } from "@atlas/api-contracts";
import { authenticatedPrincipal } from "../../../../_lib/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";
import { createMediaUpload } from "../../../../_lib/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = createMediaUploadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    return jsonResponse(apiEnvelope(await createMediaUpload(auth.principal, parsed.data)), { status: 201 });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 403;
    return problemResponse(status, "无法创建媒体上传", error instanceof Error ? error.message : undefined);
  }
}
