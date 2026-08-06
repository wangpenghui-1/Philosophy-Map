import { apiEnvelope } from "@atlas/api-contracts";
import { knowledgeRepository } from "../../../_lib/backend";
import { problemResponse, publicJson } from "../../../_lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = knowledgeRepository.getSource(id);
  if (!source) return problemResponse(404, "未找到已发布的来源");
  return publicJson(apiEnvelope(source));
}
