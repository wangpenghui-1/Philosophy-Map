import Link from "next/link";
import { getAdminDashboard } from "../_lib/data";
import { requireAdminPrincipal } from "../_lib/auth";
import styles from "../admin.module.css";

const statusLabels = {
  candidate: "候选",
  edited: "已编辑",
  reviewed: "已复核",
  published: "已发布",
} as const;

export default async function AdminDashboardPage() {
  const principal = await requireAdminPrincipal("/admin");
  const dashboard = await getAdminDashboard(principal);

  return (
    <>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>EDITORIAL OVERVIEW</span><h1>内容治理总览</h1></div>
        <Link className={styles.primaryAction} href="/admin/content/new">创建候选稿</Link>
      </header>

      {dashboard.mode === "local-preview" && (
        <section className={styles.previewBanner}>
          <strong>你正在查看本地只读预览</strong>
          <span>连接 PostgreSQL 并登录正式账户后，候选稿、审核与发布操作才会启用。</span>
        </section>
      )}

      <section className={styles.metrics} aria-label="内容状态统计">
        {Object.entries(dashboard.statusCounts).map(([status, value]) => (
          <Link href={`/admin/content?status=${status}`} key={status}>
            <span>{statusLabels[status as keyof typeof statusLabels]}</span>
            <strong>{value}</strong>
            <small>查看内容 →</small>
          </Link>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>RECENT ACTIVITY</span><h2>最近内容版本</h2></div><Link href="/admin/content">查看全部</Link></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>标题</th><th>类型</th><th>版本</th><th>状态</th><th>语言</th></tr></thead>
            <tbody>{dashboard.recent.map((item) => (
              <tr key={item.id}>
                <td>{item.publicHref ? <Link href={item.publicHref}>{item.title}</Link> : <Link href={`/admin/content/${item.id}`}>{item.title}</Link>}<small>{item.stableKey}</small></td>
                <td>{item.entityType}</td><td>v{item.version}</td><td><span className={`${styles.status} ${styles[`status_${item.status}`]}`}>{statusLabels[item.status]}</span></td><td>{item.locale}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
