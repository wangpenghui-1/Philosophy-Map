import type { EditorialStatus } from "@atlas/domain";
import Link from "next/link";
import { requireAdminPrincipal } from "../../_lib/auth";
import { listAdminSources } from "../../_lib/data";
import styles from "../../admin.module.css";

const statuses = ["all", "candidate", "edited", "reviewed", "published"] as const;
export default async function AdminSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const principal = await requireAdminPrincipal("/admin/sources"); const params = await searchParams;
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status as EditorialStatus | "all" : "all";
  const rows = await listAdminSources(principal, { q: params.q, status });
  return <>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>SOURCE LIBRARY</span><h1>来源资料库</h1><p>来源同样经过候选、编辑、复核和发布，正文只能引用已存在的来源记录。</p></div><Link className={styles.primaryAction} href="/admin/sources/new">新建来源</Link></header>
    <form className={styles.filters}><label><span>搜索来源</span><input defaultValue={params.q} name="q" placeholder="标题或作者" /></label><label><span>状态</span><select defaultValue={status} name="status">{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><button type="submit">筛选</button></form>
    <section className={styles.panel}><div className={styles.panelHeading}><h2>{rows.length} 条来源版本</h2><span>{principal.mode === "local-preview" ? "只读公开快照" : "数据库版本"}</span></div><div className={styles.tableWrap}><table><thead><tr><th>来源</th><th>类型</th><th>语言</th><th>版本</th><th>状态</th></tr></thead><tbody>{rows.map((row) => <tr key={row.versionId}><td><Link href={`/admin/sources/${row.versionId}`}>{row.title}</Link><small>{row.publication}</small></td><td>{row.sourceType}</td><td>{row.language}</td><td>v{row.version}</td><td><span className={`${styles.status} ${styles[`status_${row.status}`]}`}>{row.status}</span></td></tr>)}</tbody></table></div></section>
  </>;
}
