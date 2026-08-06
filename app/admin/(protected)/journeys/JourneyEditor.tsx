"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import styles from "../../admin.module.css";

type Transition =
  | { kind: "evidence-relation"; relationId: string; label: string }
  | { kind: "thematic-transition"; from: string; to: string; label: "平行回答" | "问题转向" | "概念重构" | "批判推进" };

interface JourneyNodeDraft {
  id: string; thinkerId: string; eyebrow: string; title: string; coreIdea: string; body: string;
  transitionPrompt: string; durationMs: number; camera: { lat: number; lon: number; distance: number };
  incomingTransition?: Transition;
}

interface JourneyDraft {
  slug: string; locale: string; title: string; category: "philosophical-question" | "philosophical-tradition";
  availability: "available" | "coming-soon"; recommended: boolean; relatedJourneyId: string | null;
  question: string; description: string; openingQuestion: string; closingTitle: string; closingBody: string;
  nodes: JourneyNodeDraft[];
}

const emptyNode = (index: number, thinkerId = ""): JourneyNodeDraft => ({
  id: `node-${index + 1}`,
  thinkerId,
  eyebrow: `第${index + 1}站`,
  title: "",
  coreIdea: "",
  body: "",
  transitionPrompt: "",
  durationMs: 10_000,
  camera: { lat: 0, lon: 0, distance: 4 },
});

function normalizeTransitions(nodes: JourneyNodeDraft[]) {
  return nodes.map((node, index) => {
    if (index === 0) return { ...node, incomingTransition: undefined };
    if (node.incomingTransition?.kind !== "thematic-transition") return node;
    return { ...node, incomingTransition: { ...node.incomingTransition, from: nodes[index - 1].thinkerId, to: node.thinkerId } };
  });
}

function readDraft(payload: unknown, thinkers: Array<{ id: string }>): JourneyDraft {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const nodes = Array.isArray(value.nodes) ? value.nodes as JourneyNodeDraft[] : [];
  return {
    slug: String(value.slug ?? value.id ?? ""),
    locale: String(value.locale ?? "zh-CN"),
    title: String(value.title ?? ""),
    category: value.category === "philosophical-tradition" ? "philosophical-tradition" : "philosophical-question",
    availability: value.availability === "available" ? "available" : "coming-soon",
    recommended: Boolean(value.recommended),
    relatedJourneyId: typeof value.relatedJourneyId === "string" ? value.relatedJourneyId : null,
    question: String(value.question ?? ""),
    description: String(value.description ?? ""),
    openingQuestion: String(value.openingQuestion ?? ""),
    closingTitle: String(value.closingTitle ?? ""),
    closingBody: String(value.closingBody ?? ""),
    nodes: nodes.length ? nodes.map((node) => ({ ...node, camera: { ...node.camera }, incomingTransition: node.incomingTransition ? { ...node.incomingTransition } : undefined })) : [emptyNode(0, thinkers[0]?.id)],
  };
}

export function JourneyEditor({ value, thinkers, relations, journeys, etag, readOnly, create = false }: {
  value?: { id?: string; stableKey?: string; payload?: unknown };
  thinkers: Array<{ id: string; title: string }>;
  relations: Array<{ id: string; title: string }>;
  journeys: Array<{ id: string; title: string }>;
  etag?: string;
  readOnly: boolean;
  create?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => readDraft(value?.payload, thinkers));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const thinkerById = useMemo(() => new Map(thinkers.map((thinker) => [thinker.id, thinker.title])), [thinkers]);

  function updateNode(index: number, update: (node: JourneyNodeDraft) => JourneyNodeDraft) {
    setDraft((current) => {
      const nodes = current.nodes.map((node, nodeIndex) => nodeIndex === index ? update(node) : node);
      return { ...current, nodes: normalizeTransitions(nodes) };
    });
  }

  function changeTransition(index: number, kind: "none" | "evidence-relation" | "thematic-transition") {
    updateNode(index, (node) => ({
      ...node,
      incomingTransition: kind === "none" ? undefined : kind === "evidence-relation"
        ? { kind, relationId: relations[0]?.id ?? "", label: "历史关系" }
        : { kind, from: draft.nodes[index - 1]?.thinkerId ?? "", to: node.thinkerId, label: "问题转向" },
    }));
  }

  function addNode() {
    if (draft.nodes.length >= 7) return;
    setDraft((current) => ({ ...current, nodes: [...current.nodes, emptyNode(current.nodes.length, thinkers[0]?.id)] }));
  }

  function removeNode(index: number) {
    setDraft((current) => ({ ...current, nodes: normalizeTransitions(current.nodes.filter((_, nodeIndex) => nodeIndex !== index)) }));
  }

  function moveNode(index: number, offset: -1 | 1) {
    setDraft((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.nodes.length) return current;
      const nodes = [...current.nodes];
      [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
      return { ...current, nodes: normalizeTransitions(nodes) };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const body = {
      ...(create ? { stableKey: form.get("stableKey") } : {}),
      ...draft,
      slug: form.get("slug"),
      locale: form.get("locale"),
      relatedJourneyId: draft.relatedJourneyId || null,
      openingQuestion: draft.openingQuestion || null,
      closingTitle: draft.closingTitle || null,
      closingBody: draft.closingBody || null,
    };
    try {
      const response = await fetch(create ? "/api/admin/v1/journeys" : `/api/admin/v1/journey-versions/${value?.id}`, {
        method: create ? "POST" : "PATCH",
        headers: { "content-type": "application/json", ...(etag ? { "if-match": etag } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok || !result.data?.id) throw new Error(result.detail ?? result.title ?? "保存旅程失败。");
      if (create) router.push(`/admin/journeys/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存旅程失败。");
    } finally {
      setPending(false);
    }
  }

  return <form className={styles.editorForm} onSubmit={submit}>
    {readOnly && <div className={styles.previewBanner}><strong>只读旅程快照</strong><span>连接数据库后才可修改叙事、节点和转场。</span></div>}
    <div className={styles.formGrid}>
      {create && <label><span>Stable key</span><input defaultValue={value?.stableKey} disabled={readOnly} name="stableKey" required /></label>}
      <label><span>Slug</span><input defaultValue={draft.slug} disabled={readOnly} name="slug" required /></label>
      <label><span>语言</span><input defaultValue={draft.locale} disabled={readOnly} name="locale" required /></label>
      <label className={styles.fullField}><span>标题</span><input disabled={readOnly} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
      <label><span>分类</span><select disabled={readOnly} onChange={(event) => setDraft({ ...draft, category: event.target.value as JourneyDraft["category"] })} value={draft.category}><option value="philosophical-question">哲学问题</option><option value="philosophical-tradition">哲学传统</option></select></label>
      <label><span>可用状态</span><select disabled={readOnly} onChange={(event) => setDraft({ ...draft, availability: event.target.value as JourneyDraft["availability"] })} value={draft.availability}><option value="available">available</option><option value="coming-soon">coming-soon</option></select></label>
      <label><span>关联旅程</span><select disabled={readOnly} onChange={(event) => setDraft({ ...draft, relatedJourneyId: event.target.value || null })} value={draft.relatedJourneyId ?? ""}><option value="">不设置</option>{journeys.filter((journey) => journey.id !== value?.stableKey).map((journey) => <option key={journey.id} value={journey.id}>{journey.title}</option>)}</select></label>
      <label><input checked={draft.recommended} disabled={readOnly} onChange={(event) => setDraft({ ...draft, recommended: event.target.checked })} type="checkbox" /> 设为推荐旅程</label>
      <label className={styles.fullField}><span>核心问题</span><input disabled={readOnly} onChange={(event) => setDraft({ ...draft, question: event.target.value })} required value={draft.question} /></label>
      <label className={styles.fullField}><span>简介</span><textarea disabled={readOnly} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={3} value={draft.description} /></label>
      <label className={styles.fullField}><span>开场问题</span><textarea disabled={readOnly} onChange={(event) => setDraft({ ...draft, openingQuestion: event.target.value })} rows={2} value={draft.openingQuestion} /></label>
      <label><span>结语标题</span><input disabled={readOnly} onChange={(event) => setDraft({ ...draft, closingTitle: event.target.value })} value={draft.closingTitle} /></label>
      <label><span>结语正文</span><textarea disabled={readOnly} onChange={(event) => setDraft({ ...draft, closingBody: event.target.value })} rows={3} value={draft.closingBody} /></label>
    </div>

    <section className={styles.journeyNodes}>
      <div className={styles.panelHeading}><div><span className={styles.eyebrow}>STORY NODES</span><h2>旅程节点与转场</h2></div><span>{draft.nodes.length} / 7 个节点</span></div>
      {draft.nodes.map((node, index) => <article className={styles.journeyNodeCard} key={`${node.id}-${index}`}>
        <header><div><span>节点 {index + 1}</span><strong>{node.title || "未命名节点"}</strong></div>{!readOnly && <div><button disabled={index === 0} onClick={() => moveNode(index, -1)} type="button">上移</button><button disabled={index === draft.nodes.length - 1} onClick={() => moveNode(index, 1)} type="button">下移</button><button disabled={draft.nodes.length === 1} onClick={() => removeNode(index)} type="button">移除</button></div>}</header>
        <div className={styles.formGrid}>
          <label><span>节点 ID</span><input disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, id: event.target.value }))} value={node.id} /></label>
          <label><span>思想家</span><select disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, thinkerId: event.target.value }))} value={node.thinkerId}>{!thinkerById.has(node.thinkerId) && <option value={node.thinkerId}>{node.thinkerId || "请选择"}</option>}{thinkers.map((thinker) => <option key={thinker.id} value={thinker.id}>{thinker.title}</option>)}</select></label>
          <label><span>站点眉题</span><input disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, eyebrow: event.target.value }))} value={node.eyebrow} /></label>
          <label><span>节点标题</span><input disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, title: event.target.value }))} value={node.title} /></label>
          <label className={styles.fullField}><span>核心思想</span><textarea disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, coreIdea: event.target.value }))} rows={2} value={node.coreIdea} /></label>
          <label className={styles.fullField}><span>讲述正文</span><textarea disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, body: event.target.value }))} rows={4} value={node.body} /></label>
          <label className={styles.fullField}><span>转场提问</span><textarea disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, transitionPrompt: event.target.value }))} rows={2} value={node.transitionPrompt} /></label>
          <label><span>停留秒数</span><input disabled={readOnly} min={5} max={120} onChange={(event) => updateNode(index, (current) => ({ ...current, durationMs: Number(event.target.value) * 1_000 }))} type="number" value={node.durationMs / 1_000} /></label>
          <label><span>镜头纬度</span><input disabled={readOnly} max={90} min={-90} onChange={(event) => updateNode(index, (current) => ({ ...current, camera: { ...current.camera, lat: Number(event.target.value) } }))} step="0.01" type="number" value={node.camera.lat} /></label>
          <label><span>镜头经度</span><input disabled={readOnly} max={180} min={-180} onChange={(event) => updateNode(index, (current) => ({ ...current, camera: { ...current.camera, lon: Number(event.target.value) } }))} step="0.01" type="number" value={node.camera.lon} /></label>
          <label><span>镜头距离</span><input disabled={readOnly} max={20} min={1} onChange={(event) => updateNode(index, (current) => ({ ...current, camera: { ...current.camera, distance: Number(event.target.value) } }))} step="0.05" type="number" value={node.camera.distance} /></label>
          {index > 0 && <>
            <label><span>进入转场</span><select disabled={readOnly} onChange={(event) => changeTransition(index, event.target.value as "none" | Transition["kind"])} value={node.incomingTransition?.kind ?? "none"}><option value="none">未设置</option><option value="evidence-relation">证据关系</option><option value="thematic-transition">主题比较</option></select></label>
            {node.incomingTransition?.kind === "evidence-relation" && <><label><span>历史关系</span><select disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, incomingTransition: { ...(current.incomingTransition as Extract<Transition, { kind: "evidence-relation" }>), relationId: event.target.value } }))} value={node.incomingTransition.relationId}>{relations.map((relation) => <option key={relation.id} value={relation.id}>{relation.title}</option>)}</select></label><label><span>关系标签</span><input disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, incomingTransition: { ...(current.incomingTransition as Extract<Transition, { kind: "evidence-relation" }>), label: event.target.value } }))} value={node.incomingTransition.label} /></label></>}
            {node.incomingTransition?.kind === "thematic-transition" && <label><span>比较标签</span><select disabled={readOnly} onChange={(event) => updateNode(index, (current) => ({ ...current, incomingTransition: { ...(current.incomingTransition as Extract<Transition, { kind: "thematic-transition" }>), label: event.target.value as Extract<Transition, { kind: "thematic-transition" }>["label"] } }))} value={node.incomingTransition.label}><option>平行回答</option><option>问题转向</option><option>概念重构</option><option>批判推进</option></select></label>}
          </>}
        </div>
      </article>)}
      {!readOnly && <button className={styles.addJourneyNode} disabled={draft.nodes.length >= 7} onClick={addNode} type="button">添加旅程节点</button>}
    </section>
    {error && <p className={styles.formError} role="alert">{error}</p>}
    {!readOnly && <div className={styles.formActions}><button disabled={pending}>{pending ? "保存中…" : create ? "创建旅程候选" : "保存旅程版本"}</button></div>}
  </form>;
}
