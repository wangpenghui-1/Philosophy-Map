import { isAdminConsoleRole } from "@atlas/auth";
import { isDatabaseConfigured } from "@atlas/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdminPrincipal } from "../_lib/auth";
import styles from "../admin.module.css";
import { LoginPanel } from "./LoginPanel";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const principal = await currentAdminPrincipal("/admin/login");
  if (principal.subject && isAdminConsoleRole(principal.role)) redirect("/admin");
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/admin") ? params.next : "/admin";

  return (
    <main className={styles.loginPage}>
      <Link className={styles.loginBack} href="/">← 返回思想星图</Link>
      <LoginPanel databaseConfigured={isDatabaseConfigured()} nextPath={nextPath} />
    </main>
  );
}
