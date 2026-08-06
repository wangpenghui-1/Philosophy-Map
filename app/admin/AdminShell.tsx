import type { AuthPrincipal } from "@atlas/auth";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminLogoutButton } from "./AdminLogoutButton";
import styles from "./admin.module.css";

export function AdminShell({ principal, children }: { principal: AuthPrincipal; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin">
          <span>思想星图</span>
          <strong>内容管理后台</strong>
        </Link>
        <nav aria-label="后台导航">
          <Link href="/admin">总览</Link>
          <Link href="/admin/content">知识内容</Link>
          <Link href="/admin/sources">来源资料库</Link>
          <Link href="/admin/relations">关系图谱</Link>
          <Link href="/admin/journeys">思想旅程</Link>
          <Link href="/admin/media">媒体资产</Link>
          <Link href="/admin/content/new">新建候选稿</Link>
          <Link href="/backend-status">系统状态</Link>
          <Link href="/knowledge">查看公开站</Link>
        </nav>
        <footer>
          <span>{principal.mode === "local-preview" ? "本地只读预览" : principal.role}</span>
          <AdminLogoutButton />
        </footer>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
