import { apiEnvelope } from "@atlas/api-contracts";
import { revokeDatabaseSession, sessionTokenFromRequest } from "@atlas/auth";
import { jsonResponse, problemResponse } from "../../../_lib/http";
import { clearedSessionCookie, isSameOrigin } from "../../../_lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  await revokeDatabaseSession(sessionTokenFromRequest(request));
  return jsonResponse(apiEnvelope({ signedOut: true }), { headers: { "set-cookie": clearedSessionCookie(request) } });
}
