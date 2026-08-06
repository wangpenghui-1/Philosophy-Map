import { hasPermission, type Permission } from "@atlas/domain";
import type { EditorialStatus } from "@atlas/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { versionEtag } from "../../../../api/_lib/editorial";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminVersion } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { DraftEditor } from "./DraftEditor";
import { EditorialActions } from "./EditorialActions";

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
  const etag = versionEtag(version);
  const editable = ["candidate", "edited"].includes(version.editorialStatus) && hasPermission(principal.role, "knowledge:draft:edit");
  const transitions = possibleTransitions[version.editorialStatus]
    .filter((item) => hasPermission(principal.role, item.permission))
    .map((item) => item.to);

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
      <DraftEditor editable={editable} etag={etag} version={version} />
    </>
  );
}
