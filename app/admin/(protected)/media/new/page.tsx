import Link from "next/link";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminRelationEntityOptions } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { MediaUploadForm } from "../MediaUploadForm";

export default async function NewMediaPage() {
  const principal = await requireAdminPrincipal("/admin/media/new");
  const entities = await getAdminRelationEntityOptions(principal);
  return <><header className={styles.pageHeader}><div><span className={styles.eyebrow}>NEW MEDIA</span><h1>上传媒体资产</h1><p>文件直传对象存储，数据库只保存校验、授权和展示元数据。</p></div><Link className={styles.secondaryAction} href="/admin/media">返回媒体库</Link></header><MediaUploadForm entities={entities} readOnly={principal.mode === "local-preview"} /></>;
}
