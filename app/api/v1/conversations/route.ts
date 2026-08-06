import { randomUUID } from "node:crypto";
import { apiEnvelope, createConversationSchema } from "@atlas/api-contracts";
import { isDatabaseConfigured } from "@atlas/db";
import { resolveAnonymousSession } from "../../_lib/anonymous-session";
import { createConversationRecord } from "../../_lib/conversations";
import { jsonResponse, validationProblem } from "../../_lib/http";

export async function POST(request: Request) {
  const parsed = createConversationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationProblem(parsed.error);
  const anonymous = resolveAnonymousSession(request);
  const id = randomUUID();
  const persistent = await createConversationRecord({
    id,
    anonymousSessionHash: anonymous.hash,
    title: parsed.data.title,
    locale: parsed.data.locale,
  });
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
    headers: anonymous.setCookie ? { "set-cookie": anonymous.setCookie } : undefined,
  });
}
