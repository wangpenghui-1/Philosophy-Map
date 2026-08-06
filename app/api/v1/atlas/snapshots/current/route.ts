import { apiEnvelope } from "@atlas/api-contracts";
import { atlasSnapshot, atlasSnapshotVersion } from "../../../../_lib/backend";
import { publicJson } from "../../../../_lib/http";

export function GET(request: Request) {
  const etag = `"${atlasSnapshotVersion}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }
  return publicJson(apiEnvelope(atlasSnapshot, {
    meta: { version: atlasSnapshotVersion, source: "published-static-snapshot" },
  }), { headers: { etag } });
}
