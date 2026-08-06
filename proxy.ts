import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function contentSecurityPolicy(nonce: string) {
  let mediaOrigin = "";
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "");
    if (["http:", "https:"].includes(parsed.protocol)) mediaOrigin = parsed.origin;
  } catch {
    // An invalid deployment value must not be copied into a response header.
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:" + (mediaOrigin ? ` ${mediaOrigin}` : ""),
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:" + (mediaOrigin ? ` ${mediaOrigin}` : ""),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("content-security-policy", contentSecurityPolicy(nonce));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", contentSecurityPolicy(nonce));
  response.headers.set("x-request-id", requestId);
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set("cross-origin-resource-policy", "same-origin");
  if (process.env.NODE_ENV === "production") response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = { matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|media/).*)", missing: [{ type: "header", key: "next-router-prefetch" }] }] };
