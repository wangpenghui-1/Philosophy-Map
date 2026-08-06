import { hasPermission, type Permission } from "@atlas/domain";
import type { EditorialStatus } from "@atlas/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { versionEtag } from "../../../../api/_lib/editorial";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminQualityReport, getAdminVersion, getAdminVersionHistory } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { DraftEditor } from "./DraftEditor";
import { EditorialActions } from "./EditorialActions";
import { PublicationControls } from "./PublicationControls";

const possibleTransitions: Record<EditorialStatus, Array<{ to: EditorialStatus; permission: Permission }>> = {
  candidate: [{ to: "edited", permission: "knowledge:draft:edit" }],
  edited: [
    { to: "candidate", permission: "knowledge:draft:edit" },
    { to: "reviewed", permission: "knowledge:review:complete" },
  ],
  reviewed: [
    { to: "edited", permission: "knowledge:draft:edit" },
    { to: "published", permission: "knowledge:publish" },
  ],
  published: [],
};

export default async function AdminContentVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requireAdminPrincipal(`/admin/content/${id}`);
  const version = await getAdminVersion(principal, id);
  if (!version) notFound();
  const history = await getAdminVersionHistory(principal, version.entityId);
  const quality = getAdminQualityReport(version);
  const etag = versionEtag(version);
  const canWrite = principal.mode !== "local-preview";
  const editable = canWrite && ["candidate", "edited"].includes(version.editorialStatus) && hasPermission(principal.role, "knowledge:draft:edit");
  const transitions = (canWrite ? possibleTransitions[version.editorialStatus] : [])
    .filter((item) => hasPermission(principal.role, item.permission))
    .filter((item) => item.to !== "published" || quality.readyToPublish)
    .map((item) => item.to);
  const isCurrentPublishedVersion = version.currentPublishedVersionId === version.id;

  return (
    <>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>{version.entityType} · {version.locale} · v{version.version}</span><h1>{version.title}</h1><p>{version.stableKey} · {version.slug}</p></div>
        <Link className={styles.secondaryAction} href="/admin/content">返回内容列表</Link>
      </header>
      <section className={styles.workflowBar}>
        <div><span>当前状态</span><strong className={`${styles.status} ${styles[`status_${version.editorialStatus}`]}`}>{version.editorialStatus}</strong></div>
        <EditorialActions etag={etag} id={version.id} transitions={transitions} />
      </section>
      <section className={styles.qualityPanel} aria-labelledby="quality-title">
        <div className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>QUALITY GATE</span><h2 id="quality-title">发布质量门禁</h2></div>
          <strong className={quality.readyToPublish ? styles.qualityReady : styles.qualityBlocked}>
            {quality.readyToPublish ? "可以发布" : "存在阻断项"}
          </strong>
        </div>
        {quality.findings.length ? (
          <ul className={styles.qualityFindings}>
            {quality.findings.map((finding) => (
              <li className={finding.severity === "blocker" ? styles.findingBlocker : styles.findingWarning} key={finding.code}>
                <strong>{finding.severity === "blocker" ? "阻断" : "提醒"}</strong>
                <span>{finding.message}</span>
                <code>{finding.code}</code>
              </li>
            ))}
          </ul>
        ) : <p className={styles.qualityEmpty}>当前版本通过基础结构、正文和来源检查。</p>}
      </section>
      <DraftEditor editable={editable} etag={etag} version={version} />
      {version.editorialStatus === "published" && (
        <PublicationControls
          canCreateRevision={canWrite && hasPermission(principal.role, "knowledge:candidate:create")}
          canRollback={canWrite && hasPermission(principal.role, "knowledge:publish")}
          canWithdraw={canWrite && hasPermission(principal.role, "knowledge:withdraw")}
          currentPublishedVersionId={version.currentPublishedVersionId}
          id={version.id}
          isCurrentPublishedVersion={isCurrentPublishedVersion}
        />
      )}
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div><span className={styles.eyebrow}>VERSION HISTORY</span><h2>版本历史</h2></div>
          <span>{history.length} 个不可变版本</span>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>版本</th><th>状态</th><th>更新时间</th><th>公开指针</th><th>操作</th></tr></thead>
            <tbody>{history.map((item) => (
              <tr key={item.id}>
                <td>v{item.version}<small>{item.locale}</small></td>
                <td><span className={`${styles.status} ${styles[`status_${item.editorialStatus}`]}`}>{item.editorialStatus}</span></td>
                <td>{item.updatedAt.toLocaleString("zh-CN")}</td>
                <td>{item.currentPublishedVersionId === item.id ? <strong className={styles.currentPointer}>当前公开</strong> : "—"}</td>
                <td>{item.id === version.id ? <span className={styles.muted}>正在查看</span> : <Link href={`/admin/content/${item.id}`}>查看版本</Link>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
