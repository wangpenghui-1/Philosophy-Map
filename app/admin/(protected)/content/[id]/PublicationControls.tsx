"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../../admin.module.css";

interface PublicationControlsProps {
  id: string;
  currentPublishedVersionId: string | null;
  isCurrentPublishedVersion: boolean;
  canCreateRevision: boolean;
  canWithdraw: boolean;
  canRollback: boolean;
}

export function PublicationControls({
  id,
  currentPublishedVersionId,
  isCurrentPublishedVersion,
  canCreateRevision,
  canWithdraw,
  canRollback,
}: PublicationControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"revision" | "withdraw" | "rollback">();
  const [error, setError] = useState<string>();

  async function createRevision() {
    setPending("revision");
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/v1/entity-versions/${id}/revision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "从管理后台创建后继修订" }),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok || !result.data?.id) throw new Error(result.detail ?? result.title ?? "创建修订失败。");
      router.push(`/admin/content/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建修订失败。");
    } finally {
      setPending(undefined);
    }
  }

  async function changePublication(action: "withdraw" | "rollback") {
    if (reason.trim().length < 8) {
      setError("请填写至少 8 个字符的操作原因，审计记录不能留空。");
      return;
    }
    setPending(action);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/v1/entity-versions/${id}/publication`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason, expectedCurrentVersionId: currentPublishedVersionId }),
      });
      const result = await response.json() as { title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "公开版本变更失败。");
      setReason("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "公开版本变更失败。");
    } finally {
      setPending(undefined);
    }
  }

  const publicationAction = isCurrentPublishedVersion
    ? canWithdraw ? "withdraw" as const : undefined
    : canRollback ? "rollback" as const : undefined;

  if (!canCreateRevision && !publicationAction) return null;
  return (
    <section className={styles.publicationControls} aria-labelledby="publication-controls-title">
      <div>
        <span className={styles.eyebrow}>PUBLICATION CONTROL</span>
        <h2 id="publication-controls-title">公开版本控制</h2>
        <p>已发布版本保持不可变。后续修改会创建 candidate 修订；撤回与回滚只切换公开指针并保留完整审计。</p>
      </div>
      {canCreateRevision && (
        <button disabled={Boolean(pending)} onClick={createRevision} type="button">
          {pending === "revision" ? "正在创建…" : "创建后继修订"}
        </button>
      )}
      {publicationAction && (
        <div className={styles.dangerAction}>
          <label htmlFor="publication-reason">{publicationAction === "withdraw" ? "撤回原因" : "回滚原因"}</label>
          <textarea
            id="publication-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="该原因会进入只追加审计记录"
            rows={3}
            value={reason}
          />
          <button
            disabled={Boolean(pending)}
            onClick={() => changePublication(publicationAction)}
            type="button"
          >
            {pending === publicationAction
              ? "正在处理…"
              : publicationAction === "withdraw" ? "撤回当前公开版本" : "回滚到此版本"}
          </button>
        </div>
      )}
      {error && <p className={styles.formError} role="alert">{error}</p>}
    </section>
  );
}
