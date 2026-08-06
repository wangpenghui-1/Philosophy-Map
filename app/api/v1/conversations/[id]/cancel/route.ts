import { apiEnvelope } from "@atlas/api-contracts";
import { jsonResponse } from "../../../../_lib/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return jsonResponse(apiEnvelope({ conversationId: id, cancellationRequested: true }), { status: 202 });
}
