import { createHash, randomBytes } from "node:crypto";

const cookieName = "atlas_anon";

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

export function resolveAnonymousSession(request: Request) {
  const existing = cookieValue(request);
  const token = existing && /^[A-Za-z0-9_-]{32,200}$/.test(existing)
    ? existing
    : randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const setCookie = existing ? undefined : [
    `${cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
  return { hash, setCookie };
}
