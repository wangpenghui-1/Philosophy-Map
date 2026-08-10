import Link from "next/link";
import { requireAdminPrincipal } from "../../_lib/auth";
import { listAdminJourneys } from "../../_lib/data";
import styles from "../../admin.module.css";

export default async function JourneysPage() {
  const principal = await requireAdminPrincipal("/admin/journeys");
  const rows = await listAdminJourneys(principal);
  return <>
    <header className={styles.pageHeader}>
      <div><span className={styles.eyebrow}>GUIDED JOURNEYS</span><h1>思想旅程</h1><p>编辑问题线索、人物节点、证据关系、主题转场、镜头与阅读节奏。</p></div>
      <Link className={styles.primaryAction} href="/admin/journeys/new">新建思想旅程</Link>
    </header>
    <section className={styles.panel}>
      <div className={styles.panelHeading}><h2>{rows.length} 个旅程版本</h2><span>{principal.mode === "local-preview" ? "只读前端快照" : "数据库版本"}</span></div>
      <div className={styles.tableWrap}><table><thead><tr><th>旅程</th><th>版本</th><th>节点</th><th>时长</th><th>可用状态</th><th>审核状态</th></tr></thead><tbody>{rows.map((row) => <tr key={row.versionId}>
        <td><Link href={`/admin/journeys/${row.versionId}`}>{row.title}</Link><small>{row.slug}</small></td>
        <td>v{row.version}</td><td>{row.nodeCount}</td><td>{Math.round(row.estimatedDurationMs / 1_000)} 秒</td><td>{row.availability}</td><td>{row.status}</td>
      </tr>)}</tbody></table></div>
    </section>
  </>;
}
