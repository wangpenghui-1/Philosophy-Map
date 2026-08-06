import { hasPermission, evaluateSourceQuality, type EditorialStatus, type Permission } from "@atlas/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { versionEtag } from "../../../../api/_lib/editorial";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminSourceHistory, getAdminSourceVersion } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { SourceActions } from "../SourceActions";
import { SourceForm } from "../SourceForm";

const next: Record<EditorialStatus, Array<{ to: EditorialStatus; permission: Permission }>> = { candidate: [{ to: "edited", permission: "knowledge:draft:edit" }], edited: [{ to: "candidate", permission: "knowledge:draft:edit" }, { to: "reviewed", permission: "knowledge:review:complete" }], reviewed: [{ to: "edited", permission: "knowledge:draft:edit" }, { to: "published", permission: "knowledge:publish" }], published: [] };
export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const principal = await requireAdminPrincipal(`/admin/sources/${id}`);
  const source = await getAdminSourceVersion(principal, id); if (!source) notFound();
  const history = await getAdminSourceHistory(principal, source.sourceId); const quality = evaluateSourceQuality(source);
  const canWrite = principal.mode !== "local-preview"; const etag = versionEtag(source);
  const transitions = (canWrite ? next[source.editorialStatus] : []).filter((item) => hasPermission(principal.role, item.permission)).filter((item) => item.to !== "published" || quality.readyToPublish).map((item) => item.to);
  return <><header className={styles.pageHeader}><div><span className={styles.eyebrow}>SOURCE · v{source.version}</span><h1>{source.title}</h1><p>{source.stableKey} · {source.publication}</p></div><Link className={styles.secondaryAction} href="/admin/sources">返回来源库</Link></header>
    <section className={styles.workflowBar}><div><span>当前状态</span><strong className={`${styles.status} ${styles[`status_${source.editorialStatus}`]}`}>{source.editorialStatus}</strong></div><SourceActions etag={etag} id={source.id} revision={canWrite && source.editorialStatus === "published" && hasPermission(principal.role, "knowledge:candidate:create")} transitions={transitions} /></section>
    <section className={styles.qualityPanel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>SOURCE QUALITY</span><h2>来源质量门禁</h2></div><strong className={quality.readyToPublish ? styles.qualityReady : styles.qualityBlocked}>{quality.readyToPublish ? "可以发布" : "存在阻断项"}</strong></div>{quality.findings.length ? <ul className={styles.qualityFindings}>{quality.findings.map((item) => <li className={item.severity === "blocker" ? styles.findingBlocker : styles.findingWarning} key={item.code}><strong>{item.severity === "blocker" ? "阻断" : "提醒"}</strong><span>{item.message}</span><code>{item.code}</code></li>)}</ul> : <p className={styles.qualityEmpty}>来源元数据通过基础检查。</p>}</section>
    <SourceForm etag={etag} readOnly={!canWrite || !["candidate", "edited"].includes(source.editorialStatus)} value={source} />
    <section className={styles.panel}><div className={styles.panelHeading}><h2>来源版本历史</h2><span>{history.length} 个版本</span></div><div className={styles.tableWrap}><table><thead><tr><th>版本</th><th>标题</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><Link href={`/admin/sources/${item.id}`}>v{item.version}</Link></td><td>{item.title}</td><td>{item.editorialStatus}</td><td>{item.updatedAt.toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div></section>
  </>;
}
