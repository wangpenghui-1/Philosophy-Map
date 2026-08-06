import { DatabaseSessionAuthAdapter } from "@atlas/auth";
import { problemResponse } from "./http";

const adapter = new DatabaseSessionAuthAdapter();

export async function authenticatedPrincipal(request: Request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return { response: problemResponse(403, "请求来源无效", "状态变更请求必须来自同一站点。") };
        }
      } catch {
        return { response: problemResponse(403, "请求来源无效") };
      }
    }
  }
  const principal = await adapter.resolve(request);
  return principal.subject
    ? { principal }
    : { response: problemResponse(401, "需要登录", "该操作会持久化个人数据，因此需要登录。") };
}
