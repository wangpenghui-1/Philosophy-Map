"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "../../../admin.module.css";

export function CreateDraftForm({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const payload = JSON.parse(String(form.get("payload")));
      const response = await fetch("/api/admin/v1/entities", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          stableKey: form.get("stableKey"), entityType: form.get("entityType"), slug: form.get("slug"),
          locale: form.get("locale"), title: form.get("title"), summary: form.get("summary"),
          contentTier: form.get("contentTier"), payload,
        }),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok || !result.data?.id) throw new Error(result.detail ?? result.title ?? "创建失败。 ");
      router.push(`/admin/content/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof SyntaxError ? "结构化内容必须是合法 JSON。" : cause instanceof Error ? cause.message : "创建失败。 ");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.editorForm} onSubmit={submit}>
      {readOnly && <div className={styles.previewBanner}><strong>只读预览不能创建内容</strong><span>连接数据库并使用 contributor 以上账户登录后启用。</span></div>}
      <div className={styles.formGrid}>
        <label><span>实体类型</span><select disabled={readOnly} name="entityType" defaultValue="person"><option value="person">人物</option><option value="concept">概念</option><option value="tradition">传统</option><option value="work">著作</option><option value="context">语境</option><option value="place">地点</option></select></label>
        <label><span>内容层级</span><select disabled={readOnly} name="contentTier" defaultValue="standard"><option value="index">索引</option><option value="standard">标准</option><option value="deep">深入</option></select></label>
        <label><span>Stable key</span><input disabled={readOnly} name="stableKey" placeholder="例如 simone-weil" required /></label>
        <label><span>Slug</span><input disabled={readOnly} name="slug" placeholder="例如 simone-weil" required /></label>
        <label><span>语言</span><input disabled={readOnly} name="locale" defaultValue="zh-CN" required /></label>
        <label className={styles.fullField}><span>标题</span><input disabled={readOnly} name="title" required /></label>
        <label className={styles.fullField}><span>摘要</span><textarea disabled={readOnly} minLength={40} name="summary" required rows={5} /></label>
        <label className={styles.fullField}><span>结构化内容 JSON</span><textarea defaultValue={'{\n  "sections": []\n}'} disabled={readOnly} name="payload" required rows={12} spellCheck={false} /></label>
      </div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formActions}><button disabled={readOnly || pending} type="submit">{pending ? "正在创建…" : "创建 candidate 版本"}</button></div>
    </form>
  );
}
