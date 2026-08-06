import { apiEnvelope, authTokenSchema } from "@atlas/api-contracts";
import { createDatabaseSession, verifyMemberEmail } from "@atlas/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { isSameOrigin, sessionCookie } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const parsed = authTokenSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = await verifyMemberEmail(parsed.data.token);
  if (!userId) return problemResponse(400, "验证链接无效或已经过期");
  const session = await createDatabaseSession(userId);
  return jsonResponse(apiEnvelope({ verified: true }), { headers: { "set-cookie": sessionCookie(request, session.token, session.maxAge) } });
}
