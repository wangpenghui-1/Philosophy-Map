import { DatabaseSessionAuthAdapter } from "@atlas/auth";
import { problemResponse } from "./http";
import { isSameOrigin } from "./session";

const adapter = new DatabaseSessionAuthAdapter();

export async function optionalPrincipal(request: Request) {
  return adapter.resolve(request);
}

export async function authenticatedPrincipal(request: Request) {
  if (!isSameOrigin(request)) {
    return { response: problemResponse(403, "请求来源无效", "使用 Cookie 的状态变更请求必须来自同一站点。") };
  }
  const principal = await adapter.resolve(request);
  return principal.subject
    ? { principal }
    : { response: problemResponse(401, "需要登录", "该操作会持久化个人数据，因此需要登录。") };
}
