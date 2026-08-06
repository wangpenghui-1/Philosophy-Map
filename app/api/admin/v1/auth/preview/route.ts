import { apiEnvelope } from "@atlas/api-contracts";
import { isDatabaseConfigured } from "@atlas/db";
import { jsonResponse, problemResponse } from "../../../../_lib/http";
import { isLoopback, isSameOrigin, previewCookie } from "../_lib";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  if (isDatabaseConfigured() || !isLoopback(request)) {
    return problemResponse(403, "本地只读预览不可用");
  }
  return jsonResponse(apiEnvelope({ mode: "local-preview", role: "owner" }), {
    headers: { "set-cookie": previewCookie(request) },
  });
}
