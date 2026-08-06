import { evaluateJourneyQuality, hasPermission, type EditorialStatus, type JourneyQualityInput, type Permission } from "@atlas/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { versionEtag } from "../../../../api/_lib/editorial";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminJourneyHistory, getAdminJourneyOptions, getAdminJourneyRelationOptions, getAdminJourneyThinkerOptions, getAdminJourneyVersion } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { EditorialActions } from "../../content/[id]/EditorialActions";
import { JourneyEditor } from "../JourneyEditor";

const next: Record<EditorialStatus, Array<{ to: EditorialStatus; permission: Permission }>> = {
  candidate: [{ to: "edited", permission: "journey:edit" }],
  edited: [{ to: "candidate", permission: "journey:edit" }, { to: "reviewed", permission: "knowledge:review:complete" }],
  reviewed: [{ to: "edited", permission: "journey:edit" }, { to: "published", permission: "knowledge:publish" }],
  published: [],
};

export default async function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const principal = await requireAdminPrincipal(`/admin/journeys/${id}`);
  const journey = await getAdminJourneyVersion(principal, id);
  if (!journey) notFound();
  const [thinkers, relations, journeys, history] = await Promise.all([
    getAdminJourneyThinkerOptions(principal),
    getAdminJourneyRelationOptions(principal),
    getAdminJourneyOptions(principal),
    getAdminJourneyHistory(principal, journey.journeyId),
  ]);
  const payload = journey.payload as JourneyQualityInput;
  const quality = evaluateJourneyQuality({ ...payload, stableKey: journey.stableKey });
  const canWrite = principal.mode !== "local-preview";
  const transitions = (canWrite ? next[journey.editorialStatus] : [])
    .filter((item) => hasPermission(principal.role, item.permission))
    .filter((item) => item.to !== "published" || quality.readyToPublish)
    .map((item) => item.to);
  const etag = versionEtag(journey);
  const canRevise = canWrite && journey.editorialStatus === "published" && hasPermission(principal.role, "journey:edit");
  return <>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>JOURNEY · v{journey.version}</span><h1>{journey.title}</h1><p>{journey.stableKey} · {journey.estimatedDurationMs / 1_000} 秒 · {payload.nodes.length} 个节点</p></div><Link className={styles.secondaryAction} href="/admin/journeys">返回旅程列表</Link></header>
    <section className={styles.workflowBar}><div><span>当前状态</span><strong>{journey.editorialStatus}</strong></div><EditorialActions endpoint="journey-versions" etag={etag} id={journey.id} revision={canRevise} transitions={transitions} /></section>
    <section className={styles.qualityPanel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>JOURNEY QUALITY</span><h2>旅程发布门禁</h2></div><strong className={quality.readyToPublish ? styles.qualityReady : styles.qualityBlocked}>{quality.readyToPublish ? "可以发布" : "存在阻断项"}</strong></div>{quality.findings.length ? <ul className={styles.qualityFindings}>{quality.findings.map((finding) => <li className={finding.severity === "blocker" ? styles.findingBlocker : styles.findingWarning} key={finding.code}><strong>{finding.severity === "blocker" ? "阻断" : "提醒"}</strong><span>{finding.message}</span><code>{finding.code}</code></li>)}</ul> : <p className={styles.qualityEmpty}>节点数量、叙事、时长、镜头与转场通过基础检查。</p>}</section>
    <JourneyEditor etag={etag} journeys={journeys} readOnly={!canWrite || !["candidate", "edited"].includes(journey.editorialStatus)} relations={relations} thinkers={thinkers} value={journey} />
    <section className={styles.panel}><div className={styles.panelHeading}><h2>旅程版本历史</h2><span>{history.length} 个版本</span></div><div className={styles.tableWrap}><table><thead><tr><th>版本</th><th>标题</th><th>时长</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><Link href={`/admin/journeys/${item.id}`}>v{item.version}</Link></td><td>{item.title}</td><td>{Math.round(item.estimatedDurationMs / 1_000)} 秒</td><td>{item.editorialStatus}</td><td>{item.updatedAt.toLocaleString("zh-CN")}</td></tr>)}</tbody></table></div></section>
  </>;
}
