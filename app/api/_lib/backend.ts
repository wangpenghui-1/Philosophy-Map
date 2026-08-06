import { createHash } from "node:crypto";
import atlasRaw from "../../_generated/atlas.json";
import indexRaw from "../../_generated/knowledge-index.json";
import knowledgeRaw from "../../_generated/knowledge.json";
import { journeyById, journeyCatalog } from "../../_data/journeys";
import {
  createStaticKnowledgeRepository,
  type StaticIndexItem,
  type StaticKnowledgeBase,
} from "@atlas/knowledge";

export const knowledgeRepository = createStaticKnowledgeRepository(
  knowledgeRaw as unknown as StaticKnowledgeBase,
  indexRaw as unknown as StaticIndexItem[],
);

export const atlasSnapshot = atlasRaw;
export const atlasSnapshotVersion = createHash("sha256")
  .update(JSON.stringify(atlasRaw))
  .digest("hex")
  .slice(0, 16);

export { journeyById, journeyCatalog };
