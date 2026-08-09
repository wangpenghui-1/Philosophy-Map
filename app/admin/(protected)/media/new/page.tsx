import Link from "next/link";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminRelationEntityOptions } from "../../../_lib/data";
import { areMediaUploadsEnabled } from "../../../../api/_lib/media-storage";
import styles from "../../../admin.module.css";
import { MediaUploadForm } from "../MediaUploadForm";

export default async function NewMediaPage() {
  const principal = await requireAdminPrincipal("/admin/media/new");
  const entities = await getAdminRelationEntityOptions(principal);
  const uploadEnabled = principal.mode !== "local-preview" && areMediaUploadsEnabled();
  return <><header className={styles.pageHeader}><div><span className={styles.eyebrow}>NEW MEDIA</span><h1>上传媒体资产</h1><p>{uploadEnabled ? "文件直传对象存储，数据库只保存校验、授权和展示元数据。" : "媒体上传当前按零付费策略关闭，现有静态媒体继续正常使用。"}</p></div><Link className={styles.secondaryAction} href="/admin/media">返回媒体库</Link></header><MediaUploadForm entities={entities} readOnly={!uploadEnabled} disabledReason={uploadEnabled ? undefined : "媒体上传已关闭；未启用任何可能产生按量费用的对象存储。"} /></>;
}
