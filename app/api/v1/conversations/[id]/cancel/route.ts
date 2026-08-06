import { apiEnvelope } from "@atlas/api-contracts";
import { resolveConversationIdentity } from "../../../../_lib/anonymous-session";
import { cancelConversationRun } from "../../../../_lib/ai-runtime";
import { conversationExists } from "../../../../_lib/conversations";
import { jsonResponse, problemResponse } from "../../../../_lib/http";
import { isSameOrigin } from "../../../../_lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const { id } = await params;
  const identity = await resolveConversationIdentity(request);
  if (!await conversationExists(id, identity.owner)) return problemResponse(404, "未找到会话");
  const cancelled = cancelConversationRun(id);
  return jsonResponse(apiEnvelope({ conversationId: id, cancellationRequested: cancelled }), { status: cancelled ? 202 : 200 });
}
