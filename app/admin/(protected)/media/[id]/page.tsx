/* eslint-disable @next/next/no-img-element */
import { hasPermission } from "@atlas/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { versionEtag } from "../../../../api/_lib/editorial";
import { requireAdminPrincipal } from "../../../_lib/auth";
import { getAdminMediaAsset, getAdminRelationEntityOptions } from "../../../_lib/data";
import styles from "../../../admin.module.css";
import { MediaMetadataForm } from "../MediaMetadataForm";

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const principal = await requireAdminPrincipal(`/admin/media/${id}`);
  const [asset, entities] = await Promise.all([getAdminMediaAsset(principal, id), getAdminRelationEntityOptions(principal)]); if (!asset) notFound();
  const readOnly = principal.mode === "local-preview" || !hasPermission(principal.role, "media:manage");
  return <><header className={styles.pageHeader}><div><span className={styles.eyebrow}>MEDIA ASSET</span><h1>{asset.title}</h1><p>{asset.mimeType} · {asset.state} · {asset.rightsStatus}</p></div><Link className={styles.secondaryAction} href="/admin/media">返回媒体库</Link></header>
    <section className={styles.mediaPreview}>{asset.publicUrl ? asset.mimeType.startsWith("audio/") ? <audio controls src={asset.publicUrl} /> : <img alt={asset.altText} src={asset.publicUrl} /> : <p>当前对象存储未配置公开读取地址。</p>}<dl><div><dt>真实性</dt><dd>{asset.authenticity ?? "待核验"}</dd></div><div><dt>署名</dt><dd>{asset.credit ?? "未填写"}</dd></div><div><dt>绑定实体</dt><dd>{asset.entityStableKey ?? "未绑定"}</dd></div>{asset.byteSize !== null && <div><dt>文件大小</dt><dd>{Math.round(asset.byteSize / 1_024)} KB</dd></div>}</dl></section>
    <MediaMetadataForm entities={entities} etag={versionEtag(asset)} readOnly={readOnly} value={asset} />
  </>;
}
