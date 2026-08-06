"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../../admin.module.css";

function checksumBase64(buffer: ArrayBuffer) {
  return crypto.subtle.digest("SHA-256", buffer).then((digest) => btoa(String.fromCharCode(...new Uint8Array(digest))));
}

async function problemText(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { detail?: string; title?: string } | null;
  return payload?.detail ?? payload?.title ?? fallback;
}

export function MediaUploadForm({ readOnly, entities }: { readOnly: boolean; entities: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) { setPending(false); setError("请选择需要上传的文件。"); return; }
    try {
      const checksumSha256 = await checksumBase64(await file.arrayBuffer());
      const createResponse = await fetch("/api/admin/v1/media/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        fileName: file.name, mimeType: file.type, byteSize: file.size, checksumSha256,
        title: form.get("title"), altText: form.get("altText"), purpose: form.get("purpose"),
        rightsStatus: form.get("rightsStatus"), authenticity: form.get("authenticity"), credit: form.get("credit"),
        license: form.get("license") || null, sourceUrl: form.get("sourceUrl") || null, entityStableKey: form.get("entityStableKey") || null,
      }) });
      if (!createResponse.ok) throw new Error(await problemText(createResponse, "创建上传失败。"));
      const created = await createResponse.json() as { data: { asset: { id: string }; upload: { url: string; headers: Record<string, string> } } };
      const uploadResponse = await fetch(created.data.upload.url, { method: "PUT", headers: created.data.upload.headers, body: file });
      if (!uploadResponse.ok) throw new Error(`对象存储上传失败（${uploadResponse.status}）。`);
      const completeResponse = await fetch(`/api/admin/v1/media-assets/${created.data.asset.id}/complete`, { method: "POST" });
      if (!completeResponse.ok) throw new Error(await problemText(completeResponse, "上传完成校验失败。"));
      router.push(`/admin/media/${created.data.asset.id}`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "媒体上传失败。"); }
    finally { setPending(false); }
  }
  return <form className={styles.editorForm} onSubmit={submit}>
    {readOnly && <div className={styles.previewBanner}><strong>只读媒体快照</strong><span>连接数据库和 S3 兼容对象存储后才可上传文件。</span></div>}
    <div className={styles.formGrid}>
      <label className={styles.fullField}><span>文件</span><input accept="image/jpeg,image/png,image/webp,image/avif,audio/mpeg,audio/mp4,audio/wav,audio/webm" disabled={readOnly} name="file" required type="file" /></label>
      <label><span>标题</span><input disabled={readOnly} name="title" required /></label>
      <label><span>用途</span><select disabled={readOnly} name="purpose"><option value="portrait">人物肖像</option><option value="illustration">插图</option><option value="document">文档</option><option value="audio">音频</option><option value="other">其他</option></select></label>
      <label><span>绑定知识实体</span><select disabled={readOnly} name="entityStableKey"><option value="">暂不绑定</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select></label>
      <label><span>真实性</span><select disabled={readOnly} name="authenticity"><option value="historical">历史原件</option><option value="documentary">纪实材料</option><option value="stylized">风格化</option><option value="interpretive">解释性创作</option><option value="synthetic">AI／合成</option><option value="unknown">待核验</option></select></label>
      <label className={styles.fullField}><span>替代文本</span><input disabled={readOnly} name="altText" required /></label>
      <label><span>授权状态</span><input defaultValue="project-commissioned" disabled={readOnly} name="rightsStatus" required /></label>
      <label><span>署名</span><input disabled={readOnly} name="credit" required /></label>
      <label><span>许可证</span><input disabled={readOnly} name="license" /></label>
      <label><span>来源 URL</span><input disabled={readOnly} name="sourceUrl" type="url" /></label>
    </div>
    {error && <p className={styles.formError} role="alert">{error}</p>}
    {!readOnly && <div className={styles.formActions}><button disabled={pending}>{pending ? "校验并上传中…" : "上传媒体资产"}</button></div>}
  </form>;
}
