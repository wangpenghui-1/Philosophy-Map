import { apiEnvelope, authTokenSchema } from "@atlas/api-contracts";
import { createDatabaseSession, verifyMemberEmail } from "@atlas/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";
import { isSameOrigin, sessionCookie } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:email-verify", { limit: 10, windowSeconds: 15 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  const parsed = authTokenSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = await verifyMemberEmail(parsed.data.token);
  if (!userId) return problemResponse(400, "验证链接无效或已经过期");
  const session = await createDatabaseSession(userId);
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ verified: true }), { headers: { "set-cookie": sessionCookie(request, session.token, session.maxAge) } }), limited.result);
}
