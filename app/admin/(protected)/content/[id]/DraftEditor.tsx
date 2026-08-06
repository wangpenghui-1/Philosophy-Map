"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../../../admin.module.css";

export function DraftEditor({ version, etag, editable }: {
  version: { id: string; title: string; summary: string; contentTier: string; payload: unknown };
  etag: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/v1/entity-versions/${version.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "if-match": etag },
        body: JSON.stringify({
          title: form.get("title"), summary: form.get("summary"), contentTier: form.get("contentTier"),
          payload: JSON.parse(String(form.get("payload"))),
        }),
      });
      const result = await response.json() as { title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "保存失败。 ");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof SyntaxError ? "结构化内容必须是合法 JSON。" : cause instanceof Error ? cause.message : "保存失败。 ");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.editorForm} onSubmit={save}>
      <div className={styles.formGrid}>
        <label className={styles.fullField}><span>标题</span><input defaultValue={version.title} disabled={!editable} name="title" required /></label>
        <label><span>内容层级</span><select defaultValue={version.contentTier} disabled={!editable} name="contentTier"><option value="index">索引</option><option value="standard">标准</option><option value="deep">深入</option></select></label>
        <label className={styles.fullField}><span>摘要</span><textarea defaultValue={version.summary} disabled={!editable} minLength={40} name="summary" rows={6} /></label>
        <label className={styles.fullField}><span>结构化内容 JSON</span><textarea defaultValue={JSON.stringify(version.payload, null, 2)} disabled={!editable} name="payload" rows={18} spellCheck={false} /></label>
      </div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      {editable && <div className={styles.formActions}><button disabled={pending} type="submit">{pending ? "正在保存…" : "保存当前版本"}</button></div>}
    </form>
  );
}
