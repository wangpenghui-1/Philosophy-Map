import { apiEnvelope } from "@atlas/api-contracts";
import { resolveConversationIdentity } from "../../../_lib/anonymous-session";
import { deleteConversationRecord, readConversationRecord } from "../../../_lib/conversations";
import { jsonResponse, problemResponse } from "../../../_lib/http";
import { isSameOrigin } from "../../../_lib/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const identity = await resolveConversationIdentity(request);
  const conversation = await readConversationRecord(id, identity.owner);
  if (!conversation) return problemResponse(404, "未找到可读取的持久会话");
  return jsonResponse(apiEnvelope(conversation));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return problemResponse(403, "请求来源无效");
  const { id } = await params;
  const identity = await resolveConversationIdentity(request);
  const deleted = await deleteConversationRecord(id, identity.owner);
  if (!deleted) return problemResponse(404, "未找到可删除的持久会话");
  return new Response(null, { status: 204 });
}
