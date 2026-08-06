"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./chat.module.css";

interface Citation { sourceId: string; sourceTitle: string; locator: string; claim: string; href?: string; entityId?: string }
interface ChatMessage { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; pending?: boolean }
interface ConversationSummary { id: string; title?: string | null; updatedAt: string }

function decodeEvent(block: string) {
  const lines = block.split("\n");
  const name = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  const raw = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
  if (!name || !raw) return null;
  try { return { name, data: JSON.parse(raw) as Record<string, unknown> }; } catch { return null; }
}

export function ChatClient() {
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [usage, setUsage] = useState<string>();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/v1/conversations").then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { data: ConversationSummary[] };
      setHistory(payload.data);
    }).catch(() => undefined);
  }, []);

  async function createConversation() {
    const response = await fetch("/api/v1/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: "zh-CN" }) });
    const payload = await response.json() as { data?: { id: string }; detail?: string; title?: string };
    if (!response.ok || !payload.data) throw new Error(payload.detail ?? payload.title ?? "无法创建对话。");
    setConversationId(payload.data.id);
    return payload.data.id;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = inputRef.current?.value.trim();
    if (!content || busy) return;
    if (inputRef.current) inputRef.current.value = "";
    setBusy(true); setError(undefined); setUsage(undefined);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", citations: [], pending: true }]);
    try {
      const id = conversationId ?? await createConversation();
      const response = await fetch(`/api/v1/conversations/${id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, locale: "zh-CN" }) });
      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string };
        throw new Error(problem.detail ?? problem.title ?? "回答生成失败。");
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const blocks = buffer.split("\n\n"); buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const parsed = decodeEvent(block); if (!parsed) continue;
          if (parsed.name === "text.delta") setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + String(parsed.data.text ?? "") } : message));
          if (parsed.name === "citation") setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, citations: [...(message.citations ?? []), parsed.data as unknown as Citation] } : message));
          if (parsed.name === "usage") setUsage(`${String(parsed.data.provider)} · ${String(parsed.data.model)} · 剩余额度 ${String(parsed.data.remaining ?? "—")}`);
          if (parsed.name === "error") throw new Error(String(parsed.data.message ?? "回答生成失败。"));
        }
        if (done) break;
      }
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, pending: false } : message));
      setHistory((current) => [{ id, title: content.slice(0, 60), updatedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "回答生成失败。");
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content || "本次回答没有完成。", pending: false } : message));
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!conversationId) return;
    await fetch(`/api/v1/conversations/${conversationId}/cancel`, { method: "POST" });
  }

  async function openConversation(id: string) {
    if (busy) return;
    const response = await fetch(`/api/v1/conversations/${id}`); if (!response.ok) return;
    const payload = await response.json() as { data: { messages: Array<{ id: string; role: "user" | "assistant"; content: string; citations?: Citation[] }> } };
    setConversationId(id); setMessages(payload.data.messages.map((message) => ({ ...message, citations: message.citations ?? [] })));
  }

  function newConversation() { if (busy) return; setConversationId(undefined); setMessages([]); setError(undefined); setUsage(undefined); }

  return <div className={styles.shell}>
    <aside className={styles.sidebar}><Link className={styles.brand} href="/"><span>I</span><strong>思想星图<small>ATLAS OF IDEAS</small></strong></Link><button onClick={newConversation} type="button">＋ 新对话</button><nav aria-label="对话历史">{history.map((item) => <button className={item.id === conversationId ? styles.active : ""} key={item.id} onClick={() => openConversation(item.id)} type="button"><strong>{item.title || "未命名对话"}</strong><small>{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</small></button>)}</nav><div className={styles.sideLinks}><Link href="/knowledge">知识库</Link><Link href="/account">我的账户</Link></div></aside>
    <section className={styles.conversation}><header><div><span>GROUNDED DIALOGUE</span><h1>有据可查的哲学对话</h1></div><p>回答只使用站内已发布材料；证据不足时会明确停下。</p></header>
      <div className={styles.messages} aria-live="polite">{messages.length ? messages.map((message) => <article className={message.role === "user" ? styles.user : styles.assistant} key={message.id}><small>{message.role === "user" ? "你" : "思想星图"}</small><div>{message.content || (message.pending ? "正在检索证据…" : "")}</div>{message.citations?.length ? <ol>{message.citations.map((citation, index) => <li key={`${citation.sourceId}:${citation.locator}:${index}`}><strong>[{index + 1}] {citation.sourceTitle}</strong><span>{citation.locator}</span><p>{citation.claim}</p>{citation.href ? <Link href={citation.href}>查看知识条目</Link> : null}</li>)}</ol> : null}</article>) : <div className={styles.empty}><span>从一个具体问题开始</span><h2>“康德为什么认为经验不能独自构成知识？”</h2><p>也可以询问人物、概念、著作与有证据的思想关系。</p><div>{["庄子的自我观是什么？", "休谟如何影响康德？", "主题共鸣和历史影响有什么区别？"].map((question) => <button key={question} onClick={() => { if (inputRef.current) { inputRef.current.value = question; inputRef.current.focus(); } }} type="button">{question}</button>)}</div></div>}</div>
      <footer><form onSubmit={submit}><label><span className="sr-only">输入哲学问题</span><textarea ref={inputRef} disabled={busy} maxLength={8000} placeholder="提出一个可由知识库检验的问题…" rows={3} /></label><div><small>{usage ?? "模型不能把自身记忆伪装成站内史料"}</small>{busy ? <button onClick={cancel} type="button">取消</button> : null}<button disabled={busy} type="submit">发送问题</button></div></form>{error ? <p className={styles.error} role="alert">{error}</p> : null}</footer>
    </section>
  </div>;
}
