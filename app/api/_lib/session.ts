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
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}
