"use client";

import type { AdminSourceOption } from "../../../_lib/data";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "../../../admin.module.css";

interface Citation { sourceId: string; locator: string; claim: string }
interface Paragraph { text: string; citations: Citation[]; [key: string]: unknown }
interface Section { id?: string; heading?: string; paragraphs: Paragraph[]; [key: string]: unknown }

function readSections(payload: unknown): Section[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const sections = (payload as Record<string, unknown>).sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) return [];
    const value = section as Record<string, unknown>;
    if (!Array.isArray(value.paragraphs)) return [];
    return [{ ...value, paragraphs: value.paragraphs.flatMap((paragraph) => {
      if (!paragraph || typeof paragraph !== "object" || Array.isArray(paragraph)) return [];
      const item = paragraph as Record<string, unknown>;
      if (typeof item.text !== "string") return [];
      const citations = Array.isArray(item.citations) ? item.citations.flatMap((citation) => {
        if (!citation || typeof citation !== "object" || Array.isArray(citation)) return [];
        const ref = citation as Record<string, unknown>;
        return [{ sourceId: String(ref.sourceId ?? ""), locator: String(ref.locator ?? ""), claim: String(ref.claim ?? "") }];
      }) : [];
      return [{ ...item, text: item.text, citations }];
    }) } as Section];
  });
}

export function CitationWorkbench({ id, etag, payload, sources, editable }: {
  id: string;
  etag: string;
  payload: unknown;
  sources: AdminSourceOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(() => readSections(payload));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  function updateCitation(sectionIndex: number, paragraphIndex: number, citationIndex: number, field: keyof Citation, value: string) {
    setSections((current) => current.map((section, s) => s !== sectionIndex ? section : {
      ...section,
      paragraphs: section.paragraphs.map((paragraph, p) => p !== paragraphIndex ? paragraph : {
        ...paragraph,
        citations: paragraph.citations.map((citation, c) => c === citationIndex ? { ...citation, [field]: value } : citation),
      }),
    }));
  }

  function addCitation(sectionIndex: number, paragraphIndex: number) {
    setSections((current) => current.map((section, s) => s !== sectionIndex ? section : {
      ...section,
      paragraphs: section.paragraphs.map((paragraph, p) => p !== paragraphIndex ? paragraph : {
        ...paragraph,
        citations: [...paragraph.citations, { sourceId: sources[0]?.id ?? "", locator: "", claim: "" }],
      }),
    }));
  }

  function removeCitation(sectionIndex: number, paragraphIndex: number, citationIndex: number) {
    setSections((current) => current.map((section, s) => s !== sectionIndex ? section : {
      ...section,
      paragraphs: section.paragraphs.map((paragraph, p) => p !== paragraphIndex ? paragraph : {
        ...paragraph,
        citations: paragraph.citations.filter((_, c) => c !== citationIndex),
      }),
    }));
  }

  async function save() {
    setPending(true);
    setError(undefined);
    try {
      const base = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const response = await fetch(`/api/admin/v1/entity-versions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "if-match": etag },
        body: JSON.stringify({ payload: { ...base, sections } }),
      });
      const result = await response.json() as { title?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ?? result.title ?? "引用保存失败。");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "引用保存失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.citationWorkbench} aria-labelledby="citation-workbench-title">
      <div className={styles.panelHeading}>
        <div><span className={styles.eyebrow}>SOURCE EVIDENCE</span><h2 id="citation-workbench-title">逐段引用工作台</h2></div>
        <span>{editable ? "可编辑草稿" : "只读核验"}</span>
      </div>
      {!sections.length && <p className={styles.qualityEmpty}>当前内容没有可绑定引用的正文分区。</p>}
      <div className={styles.citationSections}>{sections.map((section, sectionIndex) => (
        <article key={section.id ?? sectionIndex}>
          <h3>{section.heading ?? `分区 ${sectionIndex + 1}`}</h3>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <div className={styles.citationParagraph} key={paragraphIndex}>
              <p>{paragraph.text}</p>
              <div className={styles.citationList}>{paragraph.citations.map((citation, citationIndex) => (
                <div className={styles.citationEditor} key={citationIndex}>
                  <label><span>来源</span><select disabled={!editable} onChange={(event) => updateCitation(sectionIndex, paragraphIndex, citationIndex, "sourceId", event.target.value)} value={citation.sourceId}>
                    {!sourceById.has(citation.sourceId) && <option value={citation.sourceId}>{citation.sourceId || "请选择来源"}</option>}
                    {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                  </select></label>
                  <label><span>定位</span><input disabled={!editable} onChange={(event) => updateCitation(sectionIndex, paragraphIndex, citationIndex, "locator", event.target.value)} value={citation.locator} /></label>
                  <label><span>支持的主张</span><input disabled={!editable} onChange={(event) => updateCitation(sectionIndex, paragraphIndex, citationIndex, "claim", event.target.value)} value={citation.claim} /></label>
                  {editable && <button onClick={() => removeCitation(sectionIndex, paragraphIndex, citationIndex)} type="button">移除</button>}
                </div>
              ))}</div>
              {editable && <button className={styles.addCitation} disabled={!sources.length} onClick={() => addCitation(sectionIndex, paragraphIndex)} type="button">添加引用</button>}
            </div>
          ))}
        </article>
      ))}</div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      {editable && <div className={styles.formActions}><button disabled={pending} onClick={save} type="button">{pending ? "正在保存…" : "保存逐段引用"}</button></div>}
    </section>
  );
}
