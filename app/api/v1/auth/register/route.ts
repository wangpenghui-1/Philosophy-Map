import { apiEnvelope, memberRegisterSchema } from "@atlas/api-contracts";
import { issueAuthToken, registerMember } from "@atlas/auth";
import { isDatabaseConfigured } from "@atlas/db";
import { logEvent } from "@atlas/observability";
import { isEmailConfigured, sendVerificationEmail } from "../../../_lib/email";
import { jsonResponse, problemResponse, requestId, validationProblem } from "../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";
import { isSameOrigin } from "../../../_lib/session";

export async function POST(request: Request) {
  const registrationRequestId = requestId(request);
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:member-register", { limit: 5, windowSeconds: 60 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  if (!isDatabaseConfigured() || !isEmailConfigured()) return problemResponse(503, "会员注册尚未开放", "数据库或验证邮件服务尚未配置。");
  const parsed = memberRegisterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  try {
    const result = await registerMember(parsed.data.email, parsed.data.password, parsed.data.displayName);
    if (!result.alreadyVerified) {
      const issued = await issueAuthToken(result.userId, "email-verification");
      await sendVerificationEmail(parsed.data.email, issued.token);
    }
    return withRateLimitHeaders(jsonResponse(apiEnvelope({ accepted: true, message: "如果该邮箱可以注册，验证邮件会很快送达。" }), { status: 202 }), limited.result);
  } catch (error) {
    logEvent("error", "Member registration failed", {
      requestId: registrationRequestId,
      module: "auth",
      operation: "member-register",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return problemResponse(500, "无法完成注册", "注册服务暂时不可用，请稍后重试。", {
      instance: `urn:request:${registrationRequestId}`,
    });
  }
}
