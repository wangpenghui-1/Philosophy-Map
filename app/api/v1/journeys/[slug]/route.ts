import { apiEnvelope } from "@atlas/api-contracts";
import { journeyById } from "../../../_lib/backend";
import { problemResponse, publicJson } from "../../../_lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const journey = journeyById.get(slug);
  if (!journey || journey.availability !== "available") {
    return problemResponse(404, "未找到已发布的思想旅程");
  }
  return publicJson(apiEnvelope(journey));
}
