import { apiEnvelope, memberLoginSchema } from "@atlas/api-contracts";
import { authenticatePassword, createDatabaseSession, highestRoleForUser } from "@atlas/auth";
import { isDatabaseConfigured } from "@atlas/db";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { isSameOrigin, sessionCookie } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  if (!isDatabaseConfigured()) return problemResponse(503, "会员登录尚未开放");
  const parsed = memberLoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = await authenticatePassword(parsed.data.email, parsed.data.password);
  if (!userId) return problemResponse(401, "邮箱或密码不正确", "账户未验证、已锁定或凭据错误时都会返回此结果。");
  const [session, role] = await Promise.all([createDatabaseSession(userId), highestRoleForUser(userId)]);
  return jsonResponse(apiEnvelope({ role, expiresAt: session.expiresAt.toISOString() }), { headers: { "set-cookie": sessionCookie(request, session.token, session.maxAge) } });
}
