import { apiEnvelope, graphQuerySchema } from "@atlas/api-contracts";
import { knowledgeRepository } from "../../_lib/backend";
import { problemResponse, publicJson, validationProblem } from "../../_lib/http";

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = graphQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationProblem(parsed.error);
  const graph = knowledgeRepository.graph(
    parsed.data.entity,
    parsed.data.depth,
    parsed.data.relationType,
  );
  if (!graph) return problemResponse(404, "未找到已发布的图谱起点");
  return publicJson(apiEnvelope(graph));
}
