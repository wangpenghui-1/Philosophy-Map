"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../../admin.module.css";

interface MediaValue { id: string; title: string; altText: string; purpose: string; rightsStatus: string; authenticity: string | null; credit: string | null; license?: string | null; sourceUrl?: string | null; entityStableKey?: string | null }

export function MediaMetadataForm({ value, entities, etag, readOnly }: { value: MediaValue; entities: Array<{ id: string; title: string }>; etag: string; readOnly: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined); const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/v1/media-assets/${value.id}`, { method: "PATCH", headers: { "content-type": "application/json", "if-match": etag }, body: JSON.stringify({ title: form.get("title"), altText: form.get("altText"), purpose: form.get("purpose"), rightsStatus: form.get("rightsStatus"), authenticity: form.get("authenticity"), credit: form.get("credit"), license: form.get("license") || null, sourceUrl: form.get("sourceUrl") || null, entityStableKey: form.get("entityStableKey") || null }) });
      const payload = await response.json() as { detail?: string; title?: string };
      if (!response.ok) throw new Error(payload.detail ?? payload.title ?? "保存媒体元数据失败。"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存媒体元数据失败。"); } finally { setPending(false); }
  }
  async function archive() {
    const reason = window.prompt("请输入归档原因（至少 8 个字符）："); if (!reason) return; setPending(true); setError(undefined);
    try { const response = await fetch(`/api/admin/v1/media-assets/${value.id}`, { method: "DELETE", headers: { "content-type": "application/json", "if-match": etag }, body: JSON.stringify({ reason }) }); const payload = await response.json() as { detail?: string; title?: string }; if (!response.ok) throw new Error(payload.detail ?? payload.title ?? "归档失败。"); router.push("/admin/media"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "归档失败。"); } finally { setPending(false); }
  }
  return <form className={styles.editorForm} onSubmit={submit}>{readOnly && <div className={styles.previewBanner}><strong>只读媒体快照</strong><span>Git 媒体保持可用；连接数据库后才能修改元数据。</span></div>}<div className={styles.formGrid}>
    <label><span>标题</span><input defaultValue={value.title} disabled={readOnly} name="title" required /></label><label><span>用途</span><select defaultValue={value.purpose} disabled={readOnly} name="purpose"><option value="portrait">人物肖像</option><option value="illustration">插图</option><option value="document">文档</option><option value="audio">音频</option><option value="other">其他</option></select></label>
    <label><span>绑定知识实体</span><select defaultValue={value.entityStableKey ?? ""} disabled={readOnly} name="entityStableKey"><option value="">暂不绑定</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select></label><label><span>真实性</span><select defaultValue={value.authenticity ?? "unknown"} disabled={readOnly} name="authenticity"><option value="historical">历史原件</option><option value="documentary">纪实材料</option><option value="stylized">风格化</option><option value="interpretive">解释性创作</option><option value="synthetic">AI／合成</option><option value="unknown">待核验</option></select></label>
    <label className={styles.fullField}><span>替代文本</span><input defaultValue={value.altText} disabled={readOnly} name="altText" required /></label><label><span>授权状态</span><input defaultValue={value.rightsStatus} disabled={readOnly} name="rightsStatus" required /></label><label><span>署名</span><input defaultValue={value.credit ?? ""} disabled={readOnly} name="credit" required /></label><label><span>许可证</span><input defaultValue={value.license ?? ""} disabled={readOnly} name="license" /></label><label><span>来源 URL</span><input defaultValue={value.sourceUrl ?? ""} disabled={readOnly} name="sourceUrl" type="url" /></label>
  </div>{error && <p className={styles.formError} role="alert">{error}</p>}{!readOnly && <div className={styles.formActions}><button disabled={pending}>{pending ? "处理中…" : "保存媒体元数据"}</button><button className={styles.archiveButton} disabled={pending} onClick={archive} type="button">归档资产</button></div>}</form>;
}
