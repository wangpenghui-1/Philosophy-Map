import { randomUUID } from "node:crypto";
import { apiEnvelope, createConversationSchema } from "@atlas/api-contracts";
import { isDatabaseConfigured } from "@atlas/db";
import { resolveConversationIdentity } from "../../_lib/anonymous-session";
import { createConversationRecord, listConversationRecords } from "../../_lib/conversations";
import { jsonResponse, problemResponse, validationProblem } from "../../_lib/http";
import { rateLimit, requestNetworkKey } from "../../_lib/rate-limit";
import { isSameOrigin } from "../../_lib/session";

export async function GET(request: Request) {
  const identity = await resolveConversationIdentity(request);
  const rows = await listConversationRecords(identity.owner);
  return jsonResponse(apiEnvelope(rows), { headers: identity.setCookie ? { "set-cookie": identity.setCookie } : undefined });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const identity = await resolveConversationIdentity(request);
  const limit = await rateLimit("conversation-create", `${identity.rateSubject}:${requestNetworkKey(request)}`, { limit: identity.principal.subject ? 30 : 8, windowSeconds: 3600 });
  if (!limit.allowed) return problemResponse(429, "创建会话过于频繁", `请在 ${limit.retryAfter} 秒后重试。`);
  const parsed = createConversationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const id = randomUUID();
  const persistent = await createConversationRecord({
    id,
    title: parsed.data.title,
    locale: parsed.data.locale,
  }, identity.owner);
  return jsonResponse(apiEnvelope({
    id,
    locale: parsed.data.locale,
    persistence: persistent ? "database" : "ephemeral",
  }, {
    meta: {
      databaseConfigured: isDatabaseConfigured(),
      notice: persistent
        ? "匿名会话已保存；登录后才会获得跨设备长期保存。"
        : "数据库未配置，本会话只支持单轮临时回答。",
    },
  }), {
    status: 201,
    headers: { ...(identity.setCookie ? { "set-cookie": identity.setCookie } : {}), "x-ratelimit-remaining": String(limit.remaining) },
  });
}
