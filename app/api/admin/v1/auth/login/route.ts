import { adminLoginSchema, apiEnvelope } from "@atlas/api-contracts";
import {
  authenticatePassword,
  createDatabaseSession,
  highestRoleForUser,
  isAdminConsoleRole,
} from "@atlas/auth";
import { databaseSchema, getDatabase, isDatabaseConfigured } from "@atlas/db";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../../_lib/rate-limit";
import { isSameOrigin, sessionCookie } from "../_lib";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:admin-login", { limit: 8, windowSeconds: 15 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  if (!isDatabaseConfigured()) {
    return problemResponse(503, "数据库尚未配置", "请先配置 DATABASE_URL 并创建首个 owner 账户。 ");
  }
  const parsed = adminLoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);

  const userId = await authenticatePassword(parsed.data.email, parsed.data.password);
  if (!userId) return problemResponse(401, "邮箱或密码不正确", "连续失败过多时账户会暂时锁定。 ");
  const role = await highestRoleForUser(userId);
  if (!isAdminConsoleRole(role)) {
    return problemResponse(403, "该账户没有管理后台权限");
  }

  const session = await createDatabaseSession(userId);
  await getDatabase().insert(databaseSchema.auditEvents).values({
    actorId: userId,
    actorRole: role,
    action: "auth.admin.login",
    resourceType: "session",
    resourceId: session.sessionId,
  });
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ role, expiresAt: session.expiresAt.toISOString() }), {
    headers: { "set-cookie": sessionCookie(request, session.token, session.maxAge) },
  }), limited.result);
}
