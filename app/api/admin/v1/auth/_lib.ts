export function secureCookie(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function sessionCookie(request: Request, token: string, maxAge: number) {
  return [
    `atlas_session=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    secureCookie(request) ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function previewCookie(request: Request) {
  return [
    "atlas_admin_preview=1",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=14400",
    secureCookie(request) ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function clearedAuthCookies(request: Request) {
  const secure = secureCookie(request) ? "; Secure" : "";
  return [
    `atlas_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    `atlas_admin_preview=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  ];
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function isLoopback(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host
    ? host.split(":")[0].replace(/^\[|\]$/g, "")
    : new URL(request.url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
