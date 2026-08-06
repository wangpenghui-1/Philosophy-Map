import { apiEnvelope, memberLoginSchema } from "@atlas/api-contracts";
import { authenticatePassword, createDatabaseSession, highestRoleForUser } from "@atlas/auth";
import { isDatabaseConfigured } from "@atlas/db";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";
import { isSameOrigin, sessionCookie } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:member-login", { limit: 10, windowSeconds: 15 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  if (!isDatabaseConfigured()) return problemResponse(503, "会员登录尚未开放");
  const parsed = memberLoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = await authenticatePassword(parsed.data.email, parsed.data.password);
  if (!userId) return withRateLimitHeaders(problemResponse(401, "邮箱或密码不正确", "账户未验证、已锁定或凭据错误时都会返回此结果。"), limited.result);
  const [session, role] = await Promise.all([createDatabaseSession(userId), highestRoleForUser(userId)]);
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ role, expiresAt: session.expiresAt.toISOString() }), { headers: { "set-cookie": sessionCookie(request, session.token, session.maxAge) } }), limited.result);
}
