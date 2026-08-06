"use client";

import { useState, type FormEvent } from "react";
import styles from "./account.module.css";

export interface MemoryData { id: string; memoryType: string; label: string; value: string; status: string; createdAt: string; lastUsedAt?: string | null; expiresAt?: string | null }

export function MemoryPanel({ enabled, initialMemories }: { enabled: boolean; initialMemories: MemoryData[] }) {
  const [memories, setMemories] = useState(initialMemories);
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(undefined);
    const form = new FormData(event.currentTarget);
    const body = { memoryType: form.get("memoryType"), label: form.get("label"), value: form.get("value"), confirmed: true };
    try {
      const response = await fetch("/api/v1/me/memories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { data?: MemoryData; detail?: string; title?: string };
      if (!response.ok || !payload.data) throw new Error(payload.detail ?? payload.title ?? "记忆保存失败。");
      setMemories((current) => [payload.data!, ...current]); event.currentTarget.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "记忆保存失败。"); }
    finally { setPending(false); }
  }

  async function save(memory: MemoryData, form: HTMLFormElement) {
    setPending(true); setError(undefined); const data = new FormData(form);
    try {
      const response = await fetch(`/api/v1/me/memories/${memory.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: data.get("label"), value: data.get("value"), status: "confirmed" }) });
      const payload = await response.json().catch(() => ({})) as { data?: MemoryData; detail?: string; title?: string };
      if (!response.ok || !payload.data) throw new Error(payload.detail ?? payload.title ?? "记忆更新失败。");
      setMemories((current) => current.map((item) => item.id === memory.id ? payload.data! : item)); setEditingId(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "记忆更新失败。"); }
    finally { setPending(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("永久删除这条记忆？删除后无法恢复。")) return;
    const response = await fetch(`/api/v1/me/memories/${id}`, { method: "DELETE" });
    if (response.ok) setMemories((current) => current.filter((item) => item.id !== id)); else setError("记忆删除失败。");
  }

  return <section className={styles.panel}><h2>长期记忆</h2><p>{enabled ? "只有你明确保存的内容会用于调整语言、解释深度和关注重点；它不会被当作哲学事实来源。" : "长期记忆当前关闭。现有条目仍可查看和删除，但不会进入任何对话。"}</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {enabled ? <form className={styles.form} onSubmit={submit}><label>类型<select defaultValue="preference" name="memoryType"><option value="preference">表达偏好</option><option value="learning">学习目标</option><option value="explicit">其他明确记忆</option></select></label><label>标题<input maxLength={120} name="label" placeholder="例如：解释深度" required /></label><label>内容<textarea maxLength={2000} name="value" placeholder="例如：先用日常例子，再解释术语" required rows={3} /></label><button disabled={pending}>明确保存这条记忆</button></form> : null}
    {memories.length ? <ul>{memories.map((memory) => <li key={memory.id}>{editingId === memory.id ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void save(memory, event.currentTarget); }}><label>标题<input defaultValue={memory.label} name="label" required /></label><label>内容<textarea defaultValue={memory.value} name="value" required rows={3} /></label><div className={styles.links}><button disabled={pending}>保存修改</button><button onClick={() => setEditingId(undefined)} type="button">取消</button></div></form> : <><div><strong>{memory.label}</strong><small>{memory.memoryType} · {memory.lastUsedAt ? `最近使用 ${new Date(memory.lastUsedAt).toLocaleDateString("zh-CN")}` : "尚未用于对话"}</small><p>{memory.value}</p></div><div className={styles.links}><button onClick={() => setEditingId(memory.id)} type="button">修改</button><button onClick={() => remove(memory.id)} type="button">永久删除</button></div></>}</li>)}</ul> : <p>还没有长期记忆。</p>}
    <small>思想星图拒绝保存政治立场、宗教身份、健康状况和病史等敏感属性。</small>
  </section>;
}
