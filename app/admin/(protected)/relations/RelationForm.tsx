"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { AdminSourceOption } from "../../_lib/data";
import styles from "../../admin.module.css";

interface RelationCitation {
  sourceId: string;
  locator: string;
  claim: string;
}

interface RelationValue {
  id?: string;
  title?: string;
  explanation?: string;
  note?: string | null;
  evidenceStatus?: string;
  atlasVisibility?: boolean;
  citations?: RelationCitation[];
}

function initialCitations(value?: RelationValue) {
  return value?.citations?.map((citation) => ({ ...citation })) ?? [];
}

export function RelationForm({ value, entities, sources, etag, readOnly, create = false }: {
  value?: RelationValue;
  entities: Array<{ id: string; title: string; entityType: string }>;
  sources: AdminSourceOption[];
  etag?: string;
  readOnly: boolean;
  create?: boolean;
}) {
  const router = useRouter();
  const [citations, setCitations] = useState(() => initialCitations(value));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  function updateCitation(index: number, field: keyof RelationCitation, fieldValue: string) {
    setCitations((current) => current.map((citation, citationIndex) => citationIndex === index
      ? { ...citation, [field]: fieldValue }
      : citation));
  }

  function addCitation() {
    setCitations((current) => [...current, { sourceId: sources[0]?.id ?? "", locator: "", claim: "" }]);
  }

  function removeCitation(index: number) {
    setCitations((current) => current.filter((_, citationIndex) => citationIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const body = {
      ...(create ? {
        stableKey: form.get("stableKey"),
        fromEntityId: form.get("fromEntityId"),
        toEntityId: form.get("toEntityId"),
        directed: form.get("directed") === "on",
        relationType: form.get("relationType"),
      } : {}),
      title: form.get("title"),
      explanation: form.get("explanation"),
      note: form.get("note") || null,
      evidenceStatus: form.get("evidenceStatus"),
      atlasVisibility: form.get("atlasVisibility") === "on",
      citations,
    };
    try {
      const response = await fetch(create ? "/api/admin/v1/relations" : `/api/admin/v1/relation-versions/${value?.id}`, {
        method: create ? "POST" : "PATCH",
        headers: { "content-type": "application/json", ...(etag ? { "if-match": etag } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { data?: { id?: string }; title?: string; detail?: string };
      if (!response.ok || !result.data?.id) throw new Error(result.detail ?? result.title ?? "保存失败。");
      if (create) router.push(`/admin/relations/${result.data.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败。");
    } finally {
      setPending(false);
    }
  }

  return <form className={styles.editorForm} onSubmit={submit}>
    {readOnly && <div className={styles.previewBanner}><strong>只读关系快照</strong><span>连接数据库后才可编辑关系。</span></div>}
    <div className={styles.formGrid}>
      {create && <>
        <label><span>Stable key</span><input disabled={readOnly} name="stableKey" required /></label>
        <label><span>关系类型</span><select disabled={readOnly} name="relationType" defaultValue="direct-influence"><option>direct-influence</option><option>text-transmission</option><option>critique</option><option>lineage</option><option>thematic-resonance</option><option>authorship</option><option>participation</option><option>conceptualization</option></select></label>
        <label><span>起点</span><select disabled={readOnly} name="fromEntityId">{entities.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.entityType}</option>)}</select></label>
        <label><span>终点</span><select defaultValue={entities[1]?.id} disabled={readOnly} name="toEntityId">{entities.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.entityType}</option>)}</select></label>
        <label><input disabled={readOnly} name="directed" type="checkbox" /> 有方向</label>
      </>}
      <label className={styles.fullField}><span>标题</span><input defaultValue={value?.title ?? ""} disabled={readOnly} name="title" required /></label>
      <label><span>证据等级</span><select defaultValue={value?.evidenceStatus ?? "supported"} disabled={readOnly} name="evidenceStatus"><option>established</option><option>supported</option><option>disputed</option></select></label>
      <label><input defaultChecked={Boolean(value?.atlasVisibility)} disabled={readOnly} name="atlasVisibility" type="checkbox" /> 在星图中显示</label>
      <label className={styles.fullField}><span>关系说明</span><textarea defaultValue={value?.explanation ?? ""} disabled={readOnly} minLength={40} name="explanation" rows={6} /></label>
      <label className={styles.fullField}><span>争议／边界说明</span><textarea defaultValue={value?.note ?? ""} disabled={readOnly} name="note" rows={3} /></label>
      <div className={styles.fullField}>
        <span>来源证据</span>
        <div className={styles.citationList}>{citations.map((citation, index) => <div className={styles.citationEditor} key={index}>
          <label><span>来源</span><select disabled={readOnly} onChange={(event) => updateCitation(index, "sourceId", event.target.value)} value={citation.sourceId}>
            {!sourceById.has(citation.sourceId) && <option value={citation.sourceId}>{citation.sourceId || "请选择来源"}</option>}
            {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
          </select></label>
          <label><span>定位</span><input disabled={readOnly} onChange={(event) => updateCitation(index, "locator", event.target.value)} value={citation.locator} /></label>
          <label><span>支持的主张</span><input disabled={readOnly} onChange={(event) => updateCitation(index, "claim", event.target.value)} value={citation.claim} /></label>
          {!readOnly && <button onClick={() => removeCitation(index)} type="button">移除</button>}
        </div>)}</div>
        {!readOnly && <button className={styles.addCitation} disabled={!sources.length} onClick={addCitation} type="button">添加来源证据</button>}
        {!citations.length && <p className={styles.qualityEmpty}>尚未绑定来源；没有证据的关系不能发布。</p>}
      </div>
    </div>
    {error && <p className={styles.formError} role="alert">{error}</p>}
    {!readOnly && <div className={styles.formActions}><button disabled={pending}>{pending ? "保存中…" : create ? "创建关系候选" : "保存关系版本"}</button></div>}
  </form>;
}
