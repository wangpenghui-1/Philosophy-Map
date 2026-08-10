import Link from "next/link";
import { requireAdminPrincipal } from "../../_lib/auth";
import { listAdminMedia } from "../../_lib/data";
import { areMediaUploadsEnabled } from "../../../api/_lib/media-storage";
import styles from "../../admin.module.css";

export default async function MediaPage() {
  const principal = await requireAdminPrincipal("/admin/media");
  const rows = await listAdminMedia(principal);
  const uploadEnabled = principal.mode !== "local-preview" && areMediaUploadsEnabled();
  return <>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>MEDIA LIBRARY</span><h1>媒体资产</h1><p>统一管理人物图像、插图、文档与音频的文件、授权、真实性和替代文本。</p></div>{uploadEnabled && <Link className={styles.primaryAction} href="/admin/media/new">上传媒体</Link>}</header>
    <section className={styles.panel}><div className={styles.panelHeading}><h2>{rows.length} 个媒体资产</h2><span>{uploadEnabled ? "对象存储与数据库" : "只读静态媒体 · 零付费策略"}</span></div>
      <div className={styles.tableWrap}><table><thead><tr><th>资产</th><th>用途</th><th>格式</th><th>授权</th><th>真实性</th><th>状态</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/admin/media/${row.id}`}>{row.title}</Link><small>{row.entityStableKey ?? row.id}</small></td><td>{row.purpose}</td><td>{row.mimeType}</td><td>{row.rightsStatus}</td><td>{row.authenticity}</td><td>{row.state}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}
