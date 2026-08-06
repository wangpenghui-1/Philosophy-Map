import { createHash } from "node:crypto";
import { problemResponse } from "./http";

interface RateLimitOptions { limit: number; windowSeconds: number }
interface LocalBucket { count: number; expiresAt: number }

const localBuckets = new Map<string, LocalBucket>();

function safeKey(scope: string, subject: string) {
  return `atlas:${scope}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

async function redisIncrement(key: string, windowSeconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSeconds, "NX"], ["TTL", key]]),
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`Redis rate limit failed with ${response.status}.`);
  const result = await response.json() as Array<{ result: number }>;
  return { count: Number(result[0]?.result ?? 1), retryAfter: Math.max(1, Number(result[2]?.result ?? windowSeconds)) };
}

function localIncrement(key: string, windowSeconds: number) {
  const now = Date.now();
  const current = localBuckets.get(key);
  const bucket = !current || current.expiresAt <= now ? { count: 1, expiresAt: now + windowSeconds * 1_000 } : { ...current, count: current.count + 1 };
  localBuckets.set(key, bucket);
  if (localBuckets.size > 10_000) {
    for (const [entryKey, entry] of localBuckets) if (entry.expiresAt <= now) localBuckets.delete(entryKey);
  }
  return { count: bucket.count, retryAfter: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1_000)) };
}

export async function rateLimit(scope: string, subject: string, options: RateLimitOptions) {
  const key = safeKey(scope, subject);
  let value: { count: number; retryAfter: number };
  let backend: "redis" | "memory" = "redis";
  try { value = await redisIncrement(key, options.windowSeconds) ?? localIncrement(key, options.windowSeconds); if (!process.env.UPSTASH_REDIS_REST_URL) backend = "memory"; }
  catch { value = localIncrement(key, options.windowSeconds); backend = "memory"; }
  return { allowed: value.count <= options.limit, remaining: Math.max(0, options.limit - value.count), retryAfter: value.retryAfter, backend };
}

export function requestNetworkKey(request: Request) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown-network";
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions,
  subject = requestNetworkKey(request),
) {
  const result = await rateLimit(scope, subject, options);
  if (result.allowed) return { result };
  return {
    result,
    response: problemResponse(429, "请求过于频繁", `请在 ${result.retryAfter} 秒后重试。`),
  };
}

export function withRateLimitHeaders(response: Response, result: Awaited<ReturnType<typeof rateLimit>>) {
  response.headers.set("x-ratelimit-remaining", String(result.remaining));
  response.headers.set("x-ratelimit-backend", result.backend);
  if (!result.allowed) response.headers.set("retry-after", String(result.retryAfter));
  return response;
}
