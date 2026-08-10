import { DatabaseSessionAuthAdapter } from "@atlas/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const adapter = new DatabaseSessionAuthAdapter();

export async function requireMemberPrincipal(pathname = "/account") {
  const incoming = await headers(); const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "127.0.0.1:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  const principal = await adapter.resolve(new Request(`${protocol}://${host}${pathname}`, { headers: incoming }));
  if (!principal.subject) redirect(`/account/login?next=${encodeURIComponent(pathname)}`);
  return principal;
}
