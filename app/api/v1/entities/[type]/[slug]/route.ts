import { apiEnvelope, entityTypeSchema } from "@atlas/api-contracts";
import { knowledgeRepository } from "../../../../_lib/backend";
import { problemResponse, publicJson } from "../../../../_lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; slug: string }> },
) {
  const { type, slug } = await params;
  const parsedType = entityTypeSchema.safeParse(type);
  if (!parsedType.success) return problemResponse(404, "未知的知识实体类型");
  const entity = knowledgeRepository.getEntity(parsedType.data, slug);
  if (!entity) return problemResponse(404, "未找到已发布的知识实体");
  return publicJson(apiEnvelope(entity, {
    meta: { locale: "zh-CN", source: "published-static-snapshot" },
  }));
}
