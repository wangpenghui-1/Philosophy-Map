import { isSameOrigin, secureCookie, sessionCookie } from "../../../_lib/session";

export { isSameOrigin, sessionCookie };

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

export function isLoopback(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host
    ? host.split(":")[0].replace(/^\[|\]$/g, "")
    : new URL(request.url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
