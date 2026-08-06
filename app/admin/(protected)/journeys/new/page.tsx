import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminJourneyOptions, getAdminJourneyRelationOptions, getAdminJourneyThinkerOptions } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { JourneyEditor } from "../JourneyEditor";

export default async function NewJourneyPage() {
  const principal = await requireAdminPrincipal("/admin/journeys/new");
  const [thinkers, relations, journeys] = await Promise.all([
    getAdminJourneyThinkerOptions(principal),
    getAdminJourneyRelationOptions(principal),
    getAdminJourneyOptions(principal),
  ]);
  return <>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>NEW JOURNEY</span><h1>新建思想旅程</h1><p>新记录始终从 candidate 开始，不会直接进入公开播放器。</p></div></header>
    <JourneyEditor create journeys={journeys} readOnly={principal.mode === "local-preview"} relations={relations} thinkers={thinkers} />
  </>;
}
