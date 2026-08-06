"use client";

import type { EditorialStatus } from "@atlas/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../../admin.module.css";

const labels: Record<EditorialStatus, string> = {
  candidate: "退回候选",
  edited: "标记已编辑",
  reviewed: "完成学术复核",
  published: "发布版本",
};

export function EditorialActions({ id, etag, transitions, endpoint = "entity-versions", revision = false }: { id: string; etag: string; transitions: EditorialStatus[]; endpoint?: "entity-versions" | "relation-versions"; revision?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<EditorialStatus | "revision">();
  const [error, setError] = useState<string>();

  async function act(to?: EditorialStatus) {
    const action = to ?? "revision";
    setPending(action);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/v1/${endpoint}/${id}/${to ? "transition" : "revision"}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(to ? { "if-match": etag } : {}) },
        body: JSON.stringify(to ? { to, note: `通过管理后台推进至 ${to}` } : {}),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "状态更新失败。 ");
      if (!to && result.data?.id && endpoint === "relation-versions") router.push(`/admin/relations/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。 ");
    } finally {
      setPending(undefined);
    }
  }

  if (!transitions.length && !revision) return <p className={styles.muted}>当前角色没有可执行的下一步动作。</p>;
  return (
    <div className={styles.editorialActions}>
      {transitions.map((to) => <button disabled={Boolean(pending)} key={to} onClick={() => act(to)} type="button">{pending === to ? "正在处理…" : labels[to]}</button>)}
      {revision && <button disabled={Boolean(pending)} onClick={() => act()} type="button">{pending === "revision" ? "正在创建…" : "创建后继修订"}</button>}
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </div>
  );
}
