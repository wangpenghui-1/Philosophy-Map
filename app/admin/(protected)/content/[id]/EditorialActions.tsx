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

export function EditorialActions({ id, etag, transitions }: { id: string; etag: string; transitions: EditorialStatus[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<EditorialStatus>();
  const [error, setError] = useState<string>();

  async function transition(to: EditorialStatus) {
    setPending(to);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/v1/entity-versions/${id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json", "if-match": etag },
        body: JSON.stringify({ to, note: `通过管理后台推进至 ${to}` }),
      });
      const result = await response.json() as { title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "状态更新失败。 ");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "状态更新失败。 ");
    } finally {
      setPending(undefined);
    }
  }

  if (!transitions.length) return <p className={styles.muted}>当前角色没有可执行的下一步动作。</p>;
  return (
    <div className={styles.editorialActions}>
      {transitions.map((to) => <button disabled={Boolean(pending)} key={to} onClick={() => transition(to)} type="button">{pending === to ? "正在处理…" : labels[to]}</button>)}
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </div>
  );
}
