import { DatabaseSessionAuthAdapter, isAdminConsoleRole } from "@atlas/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const adapter = new DatabaseSessionAuthAdapter();

async function requestFromServerHeaders(pathname: string) {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "127.0.0.1:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("127.0.0.1") || host.startsWith("localhost") ? "http" : "https");
  return new Request(`${protocol}://${host}${pathname}`, { headers: incoming });
}

export async function currentAdminPrincipal(pathname = "/admin") {
  return adapter.resolve(await requestFromServerHeaders(pathname));
}

export async function requireAdminPrincipal(pathname = "/admin") {
  const principal = await currentAdminPrincipal(pathname);
  if (!principal.subject || !isAdminConsoleRole(principal.role)) {
    redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }
  return principal;
}
