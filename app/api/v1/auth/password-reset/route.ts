import { apiEnvelope, passwordResetSchema } from "@atlas/api-contracts";
import { resetMemberPassword } from "@atlas/auth";
import { jsonResponse, problemResponse, validationProblem } from "../../../_lib/http";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";
import { isSameOrigin } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const limited = await enforceRateLimit(request, "auth:password-reset", { limit: 10, windowSeconds: 60 * 60 });
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  const parsed = passwordResetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = await resetMemberPassword(parsed.data.token, parsed.data.password);
  if (!userId) return problemResponse(400, "重置链接无效或已经过期");
  return withRateLimitHeaders(jsonResponse(apiEnvelope({ reset: true })), limited.result);
}
