import { apiEnvelope, passwordResetRequestSchema } from "@atlas/api-contracts";
import { issueAuthToken, requestPasswordReset } from "@atlas/auth";
import { isEmailConfigured, sendPasswordResetEmail } from "../../../../_lib/email";
import { jsonResponse, problemResponse, validationProblem } from "../../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../../_lib/rate-limit";
import { isSameOrigin } from "../../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:password-reset-request", { limit: 5, windowSeconds: 60 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  if (!isEmailConfigured()) return problemResponse(503, "密码重置邮件服务尚未配置");
  const parsed = passwordResetRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const user = await requestPasswordReset(parsed.data.email);
  if (user?.email) {
    const issued = await issueAuthToken(user.id, "password-reset");
    await sendPasswordResetEmail(user.email, issued.token);
  }
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ accepted: true, message: "如果账户存在，重置邮件会很快送达。" }), { status: 202 }), limited.result);
}
