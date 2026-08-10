import { randomUUID } from "node:crypto";
import { problemDetails, type ProblemDetails } from "@atlas/api-contracts";
import type { ZodError } from "zod";

export const publicCacheHeaders = {
  "cache-control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
  "content-type": "application/json; charset=utf-8",
};

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
) {
  return Response.json(body, init);
}

export function publicJson(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...publicCacheHeaders, ...init.headers },
  });
}

export function problemResponse(
  status: number,
  title: string,
  detail?: string,
  extra: Partial<ProblemDetails> = {},
) {
  return Response.json(problemDetails(status, title, detail, extra), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

export function validationProblem(error: ZodError) {
  return problemResponse(400, "请求参数无效", "请修正标记的参数后重试。", {
    errors: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}
