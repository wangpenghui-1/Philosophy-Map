import { apiEnvelope } from "@atlas/api-contracts";
import { knowledgeRepository } from "../../_lib/backend";
import { publicJson } from "../../_lib/http";

export function GET() {
  return publicJson(apiEnvelope(knowledgeRepository.catalog(), {
    meta: { locale: "zh-CN", source: "published-static-snapshot" },
  }));
}
