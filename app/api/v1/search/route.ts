import { apiEnvelope, createCursor, parseCursor, searchQuerySchema } from "@atlas/api-contracts";
import { knowledgeRepository } from "../../_lib/backend";
import { publicJson, validationProblem } from "../../_lib/http";

export function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationProblem(parsed.error);
  const offset = parseCursor(parsed.data.cursor);
  const result = knowledgeRepository.search({
    query: parsed.data.q,
    entityType: parsed.data.type,
    region: parsed.data.region,
    offset,
    limit: parsed.data.limit,
  });
  const nextCursor = result.nextOffset === null ? null : createCursor(result.nextOffset);
  const nextUrl = nextCursor === null ? null : new URL(request.url);
  if (nextUrl && nextCursor !== null) nextUrl.searchParams.set("cursor", nextCursor);
  return publicJson(apiEnvelope(result.items, {
    meta: { total: result.total, limit: parsed.data.limit },
    links: { next: nextUrl?.toString() ?? null },
  }));
}
