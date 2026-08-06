export function secureCookie(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function sessionCookie(request: Request, token: string, maxAge: number) {
  return [`atlas_session=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAge}`, secureCookie(request) ? "Secure" : ""].filter(Boolean).join("; ");
}

export function clearedSessionCookie(request: Request) {
  return `atlas_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie(request) ? "; Secure" : ""}`;
}

export function isSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return true;

  // Native/mobile and other API clients are protected by their bearer token,
  // not by browser cookies, so they do not participate in CSRF checks.
  if (request.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const expectedProtocol = forwardedProtocol ? `${forwardedProtocol}:` : new URL(request.url).protocol;
      const parsed = new URL(origin);
      return parsed.protocol === expectedProtocol && parsed.host === host;
    } catch {
      return false;
    }
  }

  // Modern browsers send this header even when an Origin header is omitted.
  // Reject ambiguous cookie-capable writes instead of treating a missing
  // Origin as trusted.
  return request.headers.get("sec-fetch-site") === "same-origin";
}
