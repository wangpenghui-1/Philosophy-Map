import { requireAdminPrincipal } from "../../../_lib/auth";
import styles from "../../../admin.module.css";
import { SourceForm } from "../SourceForm";

export default async function NewSourcePage() {
  const principal = await requireAdminPrincipal("/admin/sources/new");
  return <><header className={styles.pageHeader}><div><span className={styles.eyebrow}>NEW SOURCE</span><h1>新建来源候选</h1><p>机器导入与人工录入都只能先进入 candidate。</p></div></header><SourceForm create readOnly={principal.mode === "local-preview"} /></>;
}
