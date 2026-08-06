import type { ReactNode } from "react";
import { AdminShell } from "../AdminShell";
import { requireAdminPrincipal } from "../_lib/auth";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const principal = await requireAdminPrincipal("/admin");
  return <AdminShell principal={principal}>{children}</AdminShell>;
}
