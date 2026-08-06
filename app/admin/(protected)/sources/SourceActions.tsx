"use client";

import type { EditorialStatus } from "@atlas/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../admin.module.css";

export function SourceActions({ id, etag, transitions, revision }: { id: string; etag: string; transitions: EditorialStatus[]; revision: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState<string>(); const [error, setError] = useState<string>();
  async function act(to?: EditorialStatus) {
    const action = to ?? "revision"; setPending(action); setError(undefined);
    try {
      const response = await fetch(`/api/admin/v1/source-versions/${id}/${to ? "transition" : "revision"}`, {
        method: "POST", headers: { "content-type": "application/json", ...(to ? { "if-match": etag } : {}) },
        body: JSON.stringify(to ? { to, note: `通过来源工作台推进至 ${to}` } : {}),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "操作失败。");
      if (!to && result.data?.id) router.push(`/admin/sources/${result.data.id}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败。"); }
    finally { setPending(undefined); }
  }
  return <div className={styles.editorialActions}>
    {transitions.map((to) => <button disabled={Boolean(pending)} key={to} onClick={() => act(to)} type="button">{pending === to ? "处理中…" : to === "edited" ? "标记已编辑" : to === "reviewed" ? "完成复核" : to === "published" ? "发布来源" : "退回候选"}</button>)}
    {revision && <button disabled={Boolean(pending)} onClick={() => act()} type="button">{pending === "revision" ? "创建中…" : "创建后继修订"}</button>}
    {error && <p className={styles.formError} role="alert">{error}</p>}
  </div>;
}
