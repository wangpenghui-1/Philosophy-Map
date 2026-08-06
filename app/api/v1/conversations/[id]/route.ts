import { apiEnvelope } from "@atlas/api-contracts";
import { resolveAnonymousSession } from "../../../_lib/anonymous-session";
import { deleteConversationRecord, readConversationRecord } from "../../../_lib/conversations";
import { jsonResponse, problemResponse } from "../../../_lib/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anonymous = resolveAnonymousSession(request);
  const conversation = await readConversationRecord(id, anonymous.hash);
  if (!conversation) return problemResponse(404, "未找到可读取的持久会话");
  return jsonResponse(apiEnvelope(conversation));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anonymous = resolveAnonymousSession(request);
  const deleted = await deleteConversationRecord(id, anonymous.hash);
  if (!deleted) return problemResponse(404, "未找到可删除的持久会话");
  return new Response(null, { status: 204 });
}
