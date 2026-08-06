import Link from "next/link";
import { requireAdminPrincipal } from "../../../_lib/auth";
import styles from "../../../admin.module.css";
import { CreateDraftForm } from "./CreateDraftForm";

export default async function NewAdminContentPage() {
  const principal = await requireAdminPrincipal("/admin/content/new");
  return (
    <>
      <header className={styles.pageHeader}>
        <div><span className={styles.eyebrow}>NEW CANDIDATE</span><h1>创建候选内容</h1><p>新内容只能从 candidate 开始，不会直接进入公开站或 AI 检索。</p></div>
        <Link className={styles.secondaryAction} href="/admin/content">返回内容列表</Link>
      </header>
      <CreateDraftForm readOnly={principal.mode === "local-preview"} />
    </>
  );
}
