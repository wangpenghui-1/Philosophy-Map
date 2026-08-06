import { apiEnvelope } from "@atlas/api-contracts";
import { revokeDatabaseSession, sessionTokenFromRequest } from "@atlas/auth";
import { jsonResponse, problemResponse } from "../../../../_lib/http";
import { clearedAuthCookies, isSameOrigin } from "../_lib";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  await revokeDatabaseSession(sessionTokenFromRequest(request));
  const headers = new Headers();
  for (const cookie of clearedAuthCookies(request)) headers.append("set-cookie", cookie);
  return jsonResponse(apiEnvelope({ signedOut: true }), { headers });
}
