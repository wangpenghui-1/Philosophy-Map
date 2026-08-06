import { eq } from "drizzle-orm";
import { accountDeleteSchema } from "@atlas/api-contracts";
import { databaseSchema, getDatabase } from "@atlas/db";
import { authenticatedPrincipal } from "../../../_lib/auth";
import { problemResponse, validationProblem } from "../../../_lib/http";
import { clearedSessionCookie, isSameOrigin } from "../../../_lib/session";
import { enforceRateLimit, withRateLimitHeaders } from "../../../_lib/rate-limit";

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const auth = await authenticatedPrincipal(request);
  if ("response" in auth) return auth.response;
  const parsed = accountDeleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const userId = auth.principal.subject!;
  const limited = await enforceRateLimit(request, "privacy:account-delete", { limit: 3, windowSeconds: 60 * 60 }, userId);
  if (limited.response) return withRateLimitHeaders(limited.response, limited.result);
  const database = getDatabase();
  const deleted = await database.transaction(async (transaction) => {
    await transaction.insert(databaseSchema.auditEvents).values({
      actorId: userId,
      actorRole: auth.principal.role,
      action: "user-data.deleted",
      resourceType: "user",
      resourceId: userId,
      metadata: { method: "self-service-hard-delete" },
    });
    return transaction.delete(databaseSchema.users)
      .where(eq(databaseSchema.users.id, userId))
      .returning({ id: databaseSchema.users.id });
  });
  if (!deleted.length) return problemResponse(404, "未找到账户");
  return withRateLimitHeaders(new Response(null, {
    status: 204,
    headers: { "set-cookie": clearedSessionCookie(request) },
  }), limited.result);
}
