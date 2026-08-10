"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../../admin.module.css";

interface SourceValue {
  id?: string; stableKey?: string; title?: string; authors?: string[]; sourceType?: string; publication?: string;
  publicationYear?: number | null; url?: string | null; doi?: string | null; isbn?: string | null; language?: string;
}

export function SourceForm({ value = {}, etag, readOnly = false, create = false }: { value?: SourceValue; etag?: string; readOnly?: boolean; create?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    const body = {
      ...(create ? { stableKey: form.get("stableKey") } : {}), title: form.get("title"),
      authors: String(form.get("authors")).split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      sourceType: form.get("sourceType"), publication: form.get("publication"),
      publicationYear: form.get("publicationYear") ? Number(form.get("publicationYear")) : null,
      url: form.get("url") || null, doi: form.get("doi") || null, isbn: form.get("isbn") || null,
      language: form.get("language"), payload: {},
    };
    try {
      const response = await fetch(create ? "/api/admin/v1/sources" : `/api/admin/v1/source-versions/${value.id}`, {
        method: create ? "POST" : "PATCH",
        headers: { "content-type": "application/json", ...(etag ? { "if-match": etag } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok || !result.data?.id) throw new Error(result.detail ?? result.title ?? "保存来源失败。");
      if (create) router.push(`/admin/sources/${result.data.id}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存来源失败。"); }
    finally { setPending(false); }
  }
  return <form className={styles.editorForm} onSubmit={submit}>
    {readOnly && <div className={styles.previewBanner}><strong>只读来源快照</strong><span>连接数据库后才可创建或修订来源。</span></div>}
    <div className={styles.formGrid}>
      {create && <label><span>Stable key</span><input disabled={readOnly} defaultValue={value.stableKey} name="stableKey" required /></label>}
      <label className={create ? "" : styles.fullField}><span>标题</span><input disabled={readOnly} defaultValue={value.title} name="title" required /></label>
      <label className={styles.fullField}><span>作者／责任主体（逗号分隔）</span><input disabled={readOnly} defaultValue={value.authors?.join("，")} name="authors" required /></label>
      <label><span>来源类型</span><input disabled={readOnly} defaultValue={value.sourceType ?? "primary-text"} name="sourceType" required /></label>
      <label><span>语言</span><input disabled={readOnly} defaultValue={value.language ?? "zh-CN"} name="language" required /></label>
      <label className={styles.fullField}><span>出版／馆藏信息</span><input disabled={readOnly} defaultValue={value.publication} name="publication" required /></label>
      <label><span>出版年份</span><input disabled={readOnly} defaultValue={value.publicationYear ?? ""} name="publicationYear" type="number" /></label>
      <label><span>URL</span><input disabled={readOnly} defaultValue={value.url ?? ""} name="url" type="url" /></label>
      <label><span>DOI</span><input disabled={readOnly} defaultValue={value.doi ?? ""} name="doi" /></label>
      <label><span>ISBN</span><input disabled={readOnly} defaultValue={value.isbn ?? ""} name="isbn" /></label>
    </div>
    {error && <p className={styles.formError} role="alert">{error}</p>}
    {!readOnly && <div className={styles.formActions}><button disabled={pending} type="submit">{pending ? "正在保存…" : create ? "创建来源候选" : "保存来源版本"}</button></div>}
  </form>;
}
