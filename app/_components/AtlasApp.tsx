"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, MotionConfig, useReducedMotion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  atlasTimelineEndYear,
  atlasTimelineStartYear,
  evidenceLabels,
  questions,
  relationById,
  relations,
  relationTypeLabels,
  sourceById,
  storyChapters,
  thinkerById,
  thinkerBySlug,
  thinkers,
  workById,
  works,
  type QuestionId,
} from "../_data/atlas";
import { useAtlasStore, type AtlasMode } from "../_state/atlas-store";
import type { EarthLightingMode } from "./GlobeCanvas";
import ThinkerPortrait from "./ThinkerPortrait";
import { DisplaySettings, FocusDepthControl } from "./AtlasVisualControls";
import {
  ATLAS_VISUAL_STORAGE_KEY,
  advanceAutoQuality,
  initialAutoQuality,
  parsePersistedVisualState,
  timelineDensity,
  type AutoQualityState,
  type DetailSheetSnap,
  type GlobeCameraSnapshot,
  type QualityPreference,
} from "./atlas-visual-policy";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="globe-loading" role="status" aria-live="polite">
      <span className="globe-loading__orbit" />
      <strong>正在点亮思想星图</strong>
      <small>文字内容已经可用，3D地球正在进入现场。</small>
    </div>
  ),
});

interface AtlasAppProps {
  initialMode?: AtlasMode;
  initialChapterId?: string;
  initialThinkerSlug?: string;
  initialCompareSlugs?: [string, string];
}

function formatYear(year: number) {
  if (year < 0) return `公元前${Math.abs(year)}年`;
  return `${year}年`;
}

function syncExploreUrl(questionId: QuestionId | null, timelineYear: number) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.pathname !== "/explore") return;
  if (questionId) url.searchParams.set("question", questionId);
  else url.searchParams.delete("question");
  url.searchParams.set("year", String(timelineYear));
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function StoryOverlay({
  chapterIndex,
  isPlaying,
}: {
  chapterIndex: number;
  isPlaying: boolean;
}) {
  const chapter = storyChapters[chapterIndex] ?? storyChapters[0];
  return (
    <AnimatePresence mode="wait">
      <motion.article
        className="story-overlay"
        key={chapter.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        aria-live="polite"
      >
        <div className="story-overlay__meta">
          <span>{chapter.eyebrow}</span>
          <span>{isPlaying ? "自动导览中" : "导览已暂停"}</span>
        </div>
        <h2>{chapter.title}</h2>
        <p>{chapter.body}</p>
        <div className="chapter-track" aria-label={`第${chapterIndex + 1}段，共${storyChapters.length}段`}>
          {storyChapters.map((item, index) => (
            <span key={item.id} className={index <= chapterIndex ? "is-active" : ""} />
          ))}
        </div>
      </motion.article>
    </AnimatePresence>
  );
}

function QuestionRail({
  activeQuestionId,
  onSelect,
}: {
  activeQuestionId: QuestionId | null;
  onSelect: (id: QuestionId | null) => void;
}) {
  return (
    <aside className="question-rail" aria-label="按哲学问题筛选">
      <div className="question-rail__header">
        <span>问题坐标</span>
        <button type="button" onClick={() => onSelect(null)} disabled={!activeQuestionId}>全部</button>
      </div>
      <div className="question-rail__items">
        {questions.map((question, index) => (
          <button
            type="button"
            key={question.id}
            className={activeQuestionId === question.id ? "is-active" : ""}
            onClick={() => onSelect(activeQuestionId === question.id ? null : question.id)}
            style={{ "--question-color": question.color } as React.CSSProperties}
          >
            <small>{String(index + 1).padStart(2, "0")}</small>
            <span>{question.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function RelationLegend({ onSelect }: { onSelect: (id: string) => void }) {
  const types = [
    { type: "direct-influence", className: "direct" },
    { type: "text-transmission", className: "transmission" },
    { type: "critique", className: "critique" },
    { type: "lineage", className: "lineage" },
    { type: "thematic-resonance", className: "resonance" },
  ] as const;
  return (
    <aside className="relation-legend" aria-label="关系图例">
      <span className="relation-legend__title">关系证据</span>
      {types.map(({ type, className }) => {
        const relation = relations.find((item) => item.type === type);
        if (!relation) return null;
        return (
          <button type="button" key={type} onClick={() => onSelect(relation.id)}>
            <i className={`line-sample line-sample--${className}`} />
            <span>{relationTypeLabels[type]}</span>
          </button>
        );
      })}
    </aside>
  );
}

function SourceLinks({ sourceIds }: { sourceIds: string[] }) {
  return (
    <ul className="source-list">
      {sourceIds.map((sourceId) => {
        const source = sourceById.get(sourceId);
        if (!source) return null;
        return (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              <span>{source.title}</span>
              <small>{source.publisher} · {source.locator}</small>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function ThinkerDetail({ thinkerId }: { thinkerId: string }) {
  const thinker = thinkerById.get(thinkerId);
  const compareIds = useAtlasStore((state) => state.compareIds);
  const toggleCompare = useAtlasStore((state) => state.toggleCompare);
  const selectRelation = useAtlasStore((state) => state.selectRelation);
  if (!thinker) return null;
  const thinkerWorks = thinker.workIds.map((id) => workById.get(id)).filter(Boolean);
  const thinkerRelations = relations.filter((relation) => relation.from === thinker.id || relation.to === thinker.id);

  return (
    <motion.article
      className="detail-card"
      key={thinker.id}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38 }}
    >
      <div className="detail-card__index">人物档案 · {String(thinkers.findIndex((item) => item.id === thinker.id) + 1).padStart(2, "0")}</div>
      <div className="detail-card__heading">
        <div>
          <h2>{thinker.name}</h2>
          <p>{thinker.englishName}</p>
        </div>
        <span style={{ "--thinker-color": thinker.color } as React.CSSProperties}>{thinker.period}</span>
      </div>
      <div className="detail-card__location">
        <span>{thinker.region}</span>
        <span>{thinker.anchors.map((anchor) => anchor.label).join(" · ")}</span>
      </div>
      <ThinkerPortrait thinker={thinker} variant="full" showNote />
      <section className="detail-card__statement">
        <small>他／她试图回答</small>
        <h3>{thinker.question}</h3>
        <p>{thinker.thesis}</p>
      </section>
      <div className="keyword-row">
        {thinker.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>
      <section className="detail-section">
        <h4>代表文本</h4>
        <ul className="work-list">
          {thinkerWorks.map((work) => work ? (
            <li key={work.id}>
              <span>{work.title}</span>
              <small>{work.originalTitle} · {work.dateLabel}</small>
            </li>
          ) : null)}
        </ul>
      </section>
      {thinkerRelations.length ? (
        <section className="detail-section">
          <h4>样片关系</h4>
          <div className="related-links">
            {thinkerRelations.map((relation) => (
              <button type="button" key={relation.id} onClick={() => selectRelation(relation.id)}>
                <span>{relation.title}</span>
                <small>{relationTypeLabels[relation.type]}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {thinker.uncertainty ? (
        <p className="uncertainty-note"><strong>不确定性：</strong>{thinker.uncertainty}</p>
      ) : null}
      <section className="detail-section detail-section--sources">
        <h4>学术来源</h4>
        <SourceLinks sourceIds={thinker.sourceIds} />
      </section>
      <div className="detail-actions">
        <button
          className={compareIds.includes(thinker.id) ? "is-active" : ""}
          type="button"
          onClick={() => toggleCompare(thinker.id)}
        >
          {compareIds.includes(thinker.id) ? "已加入比较" : "加入比较"}
        </button>
        <Link href={`/thinker/${thinker.slug}`}>深入阅读</Link>
      </div>
    </motion.article>
  );
}

function RelationDetail({ relationId }: { relationId: string }) {
  const relation = relationById.get(relationId);
  if (!relation) return null;
  const from = thinkerById.get(relation.from);
  const to = thinkerById.get(relation.to);
  return (
    <motion.article
      className="detail-card relation-detail"
      key={relation.id}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="detail-card__index">关系证据 · {evidenceLabels[relation.evidence]}</div>
      <p className={`relation-type relation-type--${relation.type}`}>{relationTypeLabels[relation.type]}</p>
      <h2>{relation.title}</h2>
      <div className="relation-endpoints">
        <span>{from?.name}</span>
        <i>{relation.directed ? "→" : "↔"}</i>
        <span>{to?.name}</span>
      </div>
      <p className="relation-explanation">{relation.explanation}</p>
      {relation.note ? <p className="uncertainty-note"><strong>阅读提示：</strong>{relation.note}</p> : null}
      <section className="detail-section detail-section--sources">
        <h4>为什么可以这样连接</h4>
        <SourceLinks sourceIds={relation.sourceIds} />
      </section>
    </motion.article>
  );
}

function CompareDetail({ ids }: { ids: string[] }) {
  const clearCompare = useAtlasStore((state) => state.clearCompare);
  if (ids.length !== 2) return null;
  const left = thinkerById.get(ids[0]);
  const right = thinkerById.get(ids[1]);
  if (!left || !right) return null;
  const sharedQuestions = questions.filter(
    (question) => left.questionIds.includes(question.id) && right.questionIds.includes(question.id),
  );

  return (
    <motion.article className="detail-card compare-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-card__index">双人物比较</div>
      <div className="compare-card__names">
        <div><ThinkerPortrait thinker={left} variant="thumb" /><h2>{left.name}</h2><small>{left.period}</small></div>
        <span>×</span>
        <div><ThinkerPortrait thinker={right} variant="thumb" /><h2>{right.name}</h2><small>{right.period}</small></div>
      </div>
      <section>
        <h4>共同问题</h4>
        <p>{sharedQuestions.length ? sharedQuestions.map((item) => item.label).join("、") : "没有使用同一问题标签；这并不排除比较，但需要说明比较依据。"}</p>
      </section>
      <div className="compare-card__columns">
        <div><small>{left.tradition}</small><p>{left.thesis}</p></div>
        <div><small>{right.tradition}</small><p>{right.thesis}</p></div>
      </div>
      <p className="uncertainty-note">比较不自动生成影响关系。只有关系数据中通过来源审核的连接，才会显示为关系线。</p>
      <div className="detail-actions">
        <button type="button" onClick={clearCompare}>清除比较</button>
        <Link href={`/compare/${left.slug}/${right.slug}`}>分享比较</Link>
      </div>
    </motion.article>
  );
}

function EmptyDetail({ onSelectRelation }: { onSelectRelation: (id: string) => void }) {
  return (
    <article className="detail-card detail-card--empty">
      <div className="detail-card__index">扩展版 · {thinkers.length}个节点</div>
      <h2>把注意力放在连接上</h2>
      <p>点击人物，查看问题、主张和文本；点击关系线，查看它为什么存在。灰白虚线只表示主题共鸣。</p>
      <div className="sample-stats">
        <div><strong>{String(thinkers.length).padStart(2, "0")}</strong><span>人物节点</span></div>
        <div><strong>{String(relations.length).padStart(2, "0")}</strong><span>证据关系</span></div>
        <div><strong>{String(sourceById.size).padStart(2, "0")}</strong><span>权威来源</span></div>
      </div>
      <div className="related-links">
        {relations.map((relation) => (
          <button type="button" key={relation.id} onClick={() => onSelectRelation(relation.id)}>
            <span>{relation.title}</span>
            <small>{relationTypeLabels[relation.type]}</small>
          </button>
        ))}
      </div>
    </article>
  );
}

function SearchDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [knowledgeSearchIndex, setKnowledgeSearchIndex] = useState<Array<{
    id: string;
    entityType: "person" | "concept" | "tradition" | "work";
    title: string;
    href: string;
    searchText: string;
  }>>([]);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const workOwnerIds = works
      .filter((work) => `${work.title} ${work.originalTitle ?? ""}`.toLowerCase().includes(normalized))
      .map((work) => work.thinkerId);
    return thinkers.filter((thinker) =>
      `${thinker.name} ${thinker.englishName} ${thinker.originalName ?? ""} ${thinker.keywords.join(" ")}`
        .toLowerCase()
        .includes(normalized) || workOwnerIds.includes(thinker.id),
    ).slice(0, 20);
  }, [query]);
  const knowledgeResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return knowledgeSearchIndex
      .filter((item) => item.entityType !== "person" && item.searchText.includes(normalized))
      .slice(0, 12);
  }, [knowledgeSearchIndex, query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    if (!knowledgeSearchIndex.length) {
      void import("../_generated/search-index.json").then((module) => {
        setKnowledgeSearchIndex(module.default as typeof knowledgeSearchIndex);
      });
    }
  }, [knowledgeSearchIndex.length, open]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const results = [...(dialogRef.current?.querySelectorAll<HTMLElement>("[data-search-result]") ?? [])];
      if (!results.length) return;
      event.preventDefault();
      const currentIndex = results.indexOf(document.activeElement as HTMLElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? direction > 0 ? 0 : results.length - 1
        : (currentIndex + direction + results.length) % results.length;
      results[nextIndex]?.focus();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <motion.section
            ref={dialogRef}
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            onKeyDown={handleDialogKeyDown}
            initial={{ opacity: 0, y: -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
          >
            <div className="search-dialog__head">
              <div><small>SEARCH THE ATLAS</small><h2 id="search-title">搜索思想星图</h2></div>
              <button type="button" onClick={close} aria-label="关闭搜索">关闭</button>
            </div>
            <label className="search-input">
              <span>人物、别名、著作或概念</span>
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：空、德性、Kant、《论语》" />
              <kbd>/</kbd>
            </label>
            <div className="search-results">
              {results.length ? <h3>人物</h3> : null}
              {results.map((thinker) => (
                  <button
                    type="button"
                    data-search-result
                    key={thinker.id}
                    onClick={() => { onSelect(thinker.id); close(); }}
                  >
                    <ThinkerPortrait thinker={thinker} variant="thumb" />
                    <span><strong>{thinker.name}</strong><small>{thinker.englishName} · {thinker.period}</small></span>
                    <i>定位</i>
                  </button>
                ))}
              {knowledgeResults.length ? <h3>概念、传统与著作</h3> : null}
              {knowledgeResults.map((item) => (
                <Link data-search-result className="search-results__knowledge" href={item.href} key={`${item.entityType}:${item.id}`} onClick={close}>
                  <span aria-hidden="true">{item.entityType === "concept" ? "义" : item.entityType === "tradition" ? "脉" : "文"}</span>
                  <strong>{item.title}</strong>
                  <small>{item.entityType === "concept" ? "概念" : item.entityType === "tradition" ? "传统" : "著作"}</small>
                </Link>
              ))}
              {!results.length && !knowledgeResults.length ? <p>{query.trim() ? "没有找到匹配条目。" : "输入人物、别名、著作或概念开始搜索。"}</p> : null}
            </div>
            <Link className="search-dialog__knowledge" href={`/knowledge${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`}>在完整知识库中浏览与筛选 →</Link>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SemanticExplorer({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          className="semantic-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="semantic-title"
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
            }
          }}
        >
          <div className="semantic-panel__head">
            <div><small>ACCESSIBLE INDEX</small><h2 id="semantic-title">文字探索</h2></div>
            <button type="button" onClick={onClose}>返回地球</button>
          </div>
          <p className="semantic-panel__intro">这里提供与3D地球同源的完整人物和关系入口，适用于键盘、读屏器或低性能设备。</p>
          <div className="semantic-panel__grid">
            {thinkers.map((thinker) => (
              <article key={thinker.id}>
                <ThinkerPortrait thinker={thinker} variant="thumb" showNote />
                <small>{thinker.region} · {thinker.period}</small>
                <h3>{thinker.name}<span>{thinker.englishName}</span></h3>
                <p>{thinker.thesis}</p>
                <div className="semantic-card__actions">
                  <button type="button" onClick={() => { onSelect(thinker.id); onClose(); }}>在地球中定位</button>
                  <Link href={`/thinker/${thinker.slug}`}>深入阅读</Link>
                </div>
                <SourceLinks sourceIds={thinker.sourceIds} />
              </article>
            ))}
          </div>
          <Link className="semantic-panel__knowledge" href="/knowledge">进入完整、可分页的世界哲学知识库 →</Link>
          <section className="semantic-relations">
            <h2>关系及其证据</h2>
            {relations.map((relation) => (
              <article key={relation.id}>
                <span>{relationTypeLabels[relation.type]} · {evidenceLabels[relation.evidence]}</span>
                <h3>{relation.title}</h3>
                <p>{relation.explanation}</p>
                <SourceLinks sourceIds={relation.sourceIds} />
              </article>
            ))}
          </section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BottomDock({ mode, onTakeover }: { mode: AtlasMode; onTakeover: () => void }) {
  const isPlaying = useAtlasStore((state) => state.isPlaying);
  const chapterIndex = useAtlasStore((state) => state.chapterIndex);
  const timelineYear = useAtlasStore((state) => state.timelineYear);
  const compareIds = useAtlasStore((state) => state.compareIds);
  const setPlaying = useAtlasStore((state) => state.setPlaying);
  const setChapterIndex = useAtlasStore((state) => state.setChapterIndex);
  const setTimelineYear = useAtlasStore((state) => state.setTimelineYear);
  const setTimelineScrubbing = useAtlasStore((state) => state.setTimelineScrubbing);
  const setMode = useAtlasStore((state) => state.setMode);
  const density = useMemo(
    () => timelineDensity(thinkers.map((thinker) => thinker.startYear), atlasTimelineStartYear, atlasTimelineEndYear),
    [],
  );

  const takeover = () => {
    setPlaying(false);
    setMode("explore");
    onTakeover();
    window.history.replaceState({}, "", "/explore?from=story");
  };

  if (mode === "story") {
    const chapter = storyChapters[chapterIndex] ?? storyChapters[0];
    return (
      <footer className="bottom-dock bottom-dock--story">
        <div className="story-controls">
          <button type="button" onClick={() => setChapterIndex(Math.max(0, chapterIndex - 1))} disabled={chapterIndex === 0} aria-label="上一章">←</button>
          <button className="story-controls__play" type="button" onClick={() => setPlaying(!isPlaying)} aria-label={isPlaying ? "暂停故事" : "继续故事"}>{isPlaying ? "Ⅱ" : "▶"}</button>
          <button type="button" onClick={() => setChapterIndex(Math.min(storyChapters.length - 1, chapterIndex + 1))} disabled={chapterIndex === storyChapters.length - 1} aria-label="下一章">→</button>
        </div>
        <div className="dock-progress">
          <div><span>{chapter.eyebrow}</span><strong>{chapter.title}</strong></div>
          <div className="dock-progress__bar"><span style={{ width: `${((chapterIndex + 1) / storyChapters.length) * 100}%` }} /></div>
        </div>
        <button className="takeover-button" type="button" onClick={takeover}>暂停并接管地球</button>
      </footer>
    );
  }

  const compareThinkers = compareIds.map((id) => thinkerById.get(id)).filter(Boolean);
  return (
    <footer className="bottom-dock bottom-dock--explore">
      <div className="timeline-label"><small>历史时间</small><strong>{formatYear(timelineYear)}</strong></div>
      <div className="timeline-control">
        <div className="timeline-density" aria-hidden="true">
          {density.map((height, index) => <i key={index} style={{ height: `${Math.max(8, height * 100)}%` }} />)}
        </div>
        <input
          aria-label="历史时间轴"
          type="range"
          min={atlasTimelineStartYear}
          max={atlasTimelineEndYear}
          step={1}
          value={timelineYear}
          onPointerDown={() => setTimelineScrubbing(true)}
          onPointerUp={() => setTimelineScrubbing(false)}
          onPointerCancel={() => setTimelineScrubbing(false)}
          onBlur={() => setTimelineScrubbing(false)}
          onChange={(event) => setTimelineYear(Number(event.target.value))}
        />
        <div className="timeline-scale" aria-hidden="true"><span>前600</span><span>0</span><span>1000</span><span>{atlasTimelineEndYear}</span></div>
      </div>
      <div className="compare-status">
        <small>人物比较</small>
        {compareThinkers.length ? <span>{compareThinkers.map((item) => item?.name).join(" × ")}</span> : <span>从人物档案加入</span>}
      </div>
    </footer>
  );
}

export default function AtlasApp({
  initialMode = "story",
  initialChapterId,
  initialThinkerSlug,
  initialCompareSlugs,
}: AtlasAppProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [earthMode, setEarthMode] = useState<EarthLightingMode>("night");
  const mode = useAtlasStore((state) => state.mode);
  const isPlaying = useAtlasStore((state) => state.isPlaying);
  const chapterIndex = useAtlasStore((state) => state.chapterIndex);
  const selectedThinkerId = useAtlasStore((state) => state.selectedThinkerId);
  const selectedRelationId = useAtlasStore((state) => state.selectedRelationId);
  const activeQuestionId = useAtlasStore((state) => state.activeQuestionId);
  const timelineYear = useAtlasStore((state) => state.timelineYear);
  const isTimelineScrubbing = useAtlasStore((state) => state.isTimelineScrubbing);
  const listViewOpen = useAtlasStore((state) => state.listViewOpen);
  const searchOpen = useAtlasStore((state) => state.searchOpen);
  const quality = useAtlasStore((state) => state.quality);
  const qualityPreference = useAtlasStore((state) => state.qualityPreference);
  const focusDepth = useAtlasStore((state) => state.focusDepth);
  const compareIds = useAtlasStore((state) => state.compareIds);
  const setMode = useAtlasStore((state) => state.setMode);
  const setPlaying = useAtlasStore((state) => state.setPlaying);
  const setChapterIndex = useAtlasStore((state) => state.setChapterIndex);
  const selectThinker = useAtlasStore((state) => state.selectThinker);
  const selectRelation = useAtlasStore((state) => state.selectRelation);
  const setQuestion = useAtlasStore((state) => state.setQuestion);
  const setTimelineYear = useAtlasStore((state) => state.setTimelineYear);
  const setListViewOpen = useAtlasStore((state) => state.setListViewOpen);
  const setSearchOpen = useAtlasStore((state) => state.setSearchOpen);
  const setQuality = useAtlasStore((state) => state.setQuality);
  const setQualityPreference = useAtlasStore((state) => state.setQualityPreference);
  const setFocusDepth = useAtlasStore((state) => state.setFocusDepth);
  const toggleCompare = useAtlasStore((state) => state.toggleCompare);
  const clearCompare = useAtlasStore((state) => state.clearCompare);
  const [cameraSnapshot, setCameraSnapshot] = useState<GlobeCameraSnapshot | null>(null);
  const [detailSheetSnap, setDetailSheetSnap] = useState<DetailSheetSnap>("half");
  const [isCompact, setIsCompact] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const initializationAppliedRef = useRef(false);
  const entrySeenRef = useRef(false);
  const autoQualityRef = useRef<AutoQualityState>({
    quality: "medium",
    aboveBudgetSince: null,
    belowBudgetSince: null,
    lastChangeAt: -20_000,
  });
  const initialized = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const initialThinkerId = initialThinkerSlug ? thinkerBySlug.get(initialThinkerSlug)?.id ?? null : null;
  const initialCompareIds = initialCompareSlugs
    ? initialCompareSlugs.map((slug) => thinkerBySlug.get(slug)?.id).filter((id): id is string => Boolean(id))
    : [];
  const initialChapterIndex = initialChapterId
    ? Math.max(0, storyChapters.findIndex((chapter) => chapter.id === initialChapterId))
    : 0;
  const displayMode = initialized ? mode : initialThinkerId || initialCompareIds.length === 2 ? "explore" : initialMode;
  const displayChapterIndex = initialized ? chapterIndex : initialChapterIndex;
  const displaySelectedThinkerId = initialized ? selectedThinkerId : initialThinkerId;
  const displaySelectedRelationId = initialized ? selectedRelationId : null;
  const displayCompareIds = initialized ? compareIds : initialCompareIds;

  useEffect(() => {
    if (initializationAppliedRef.current) return;
    initializationAppliedRef.current = true;
    const query = new URLSearchParams(window.location.search);
    const explicitRoute = window.location.pathname !== "/"
      || ["thinker", "relation", "question", "year"].some((key) => query.has(key));
    const persisted = parsePersistedVisualState(
      window.localStorage.getItem(ATLAS_VISUAL_STORAGE_KEY),
      {
        isQuestionId: (value): value is QuestionId => questions.some((item) => item.id === value),
        isThinkerSlug: (value) => thinkerBySlug.has(value),
        isRelationId: (value) => relationById.has(value),
        minYear: atlasTimelineStartYear,
        maxYear: atlasTimelineEndYear,
      },
    );
    entrySeenRef.current = Boolean(persisted?.entrySeen || explicitRoute);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const automaticQuality = initialAutoQuality(window.innerWidth, coarsePointer);
    const restoredPreference = persisted?.qualityPreference ?? "auto";
    const restoredQuality = restoredPreference === "auto" ? automaticQuality : restoredPreference;
    setQualityPreference(restoredPreference);
    setQuality(restoredQuality);
    autoQualityRef.current = {
      quality: restoredQuality,
      aboveBudgetSince: null,
      belowBudgetSince: null,
      lastChangeAt: performance.now() - 20_000,
    };
    setEarthMode(persisted?.earthMode ?? "night");

    const restoredCamera = !explicitRoute && persisted?.entrySeen ? persisted.camera : null;
    if (!explicitRoute && persisted?.entrySeen) {
      setMode(persisted.mode);
      setPlaying(persisted.mode === "story");
      setTimelineYear(persisted.timelineYear);
      setQuestion(persisted.questionId);
      if (persisted.thinkerSlug) {
        const thinker = thinkerBySlug.get(persisted.thinkerSlug);
        if (thinker) selectThinker(thinker.id);
      } else if (persisted.relationId) {
        selectRelation(persisted.relationId);
      }
    } else {
      setMode(initialMode);
      setPlaying(initialMode === "story");
    }

    if (initialChapterId) {
      const nextIndex = storyChapters.findIndex((chapter) => chapter.id === initialChapterId);
      if (nextIndex >= 0) setChapterIndex(nextIndex);
    }
    const question = query.get("question") as QuestionId | null;
    const relation = query.get("relation");
    const yearParam = query.get("year");
    const year = yearParam === null ? Number.NaN : Number(yearParam);
    if (question && questions.some((item) => item.id === question)) setQuestion(question);
    if (Number.isFinite(year) && year >= atlasTimelineStartYear && year <= atlasTimelineEndYear) setTimelineYear(year);
    if (initialThinkerSlug) {
      const thinker = thinkerBySlug.get(initialThinkerSlug);
      if (thinker) {
        selectThinker(thinker.id);
        setMode("explore");
        setPlaying(false);
      }
    }
    if (initialCompareSlugs) {
      for (const slug of initialCompareSlugs) {
        const thinker = thinkerBySlug.get(slug);
        if (thinker && !useAtlasStore.getState().compareIds.includes(thinker.id)) toggleCompare(thinker.id);
      }
      setMode("explore");
      setPlaying(false);
    }
    if (relation && relationById.has(relation)) selectRelation(relation);
    const frame = window.requestAnimationFrame(() => {
      setCameraSnapshot(restoredCamera);
      setPersistenceReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialChapterId, initialCompareSlugs, initialMode, initialThinkerSlug, selectRelation, selectThinker, setChapterIndex, setMode, setPlaying, setQuality, setQualityPreference, setQuestion, setTimelineYear, toggleCompare]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!initialized || mode !== "story" || !isPlaying) return;
    const chapter = storyChapters[chapterIndex] ?? storyChapters[0];
    const timeout = window.setTimeout(() => {
      if (chapterIndex < storyChapters.length - 1) {
        setChapterIndex(chapterIndex + 1);
      } else {
        setPlaying(false);
        setMode("explore");
        window.history.replaceState({}, "", "/explore?from=story");
      }
    }, reduceMotion ? Math.min(4500, chapter.durationMs) : chapter.durationMs);
    return () => window.clearTimeout(timeout);
  }, [chapterIndex, initialized, isPlaying, mode, reduceMotion, setChapterIndex, setMode, setPlaying]);

  const persistVisualState = useCallback((nextMode: AtlasMode = mode) => {
    if (nextMode === "explore") entrySeenRef.current = true;
    const thinkerSlug = selectedThinkerId ? thinkerById.get(selectedThinkerId)?.slug ?? null : null;
    window.localStorage.setItem(ATLAS_VISUAL_STORAGE_KEY, JSON.stringify({
      version: 1,
      entrySeen: entrySeenRef.current,
      mode: nextMode,
      timelineYear,
      questionId: activeQuestionId,
      thinkerSlug,
      relationId: selectedRelationId,
      earthMode,
      qualityPreference,
      camera: cameraSnapshot,
    }));
  }, [activeQuestionId, cameraSnapshot, earthMode, mode, qualityPreference, selectedRelationId, selectedThinkerId, timelineYear]);

  useEffect(() => {
    if (!persistenceReady) return;
    const timeout = window.setTimeout(() => {
      persistVisualState();
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [persistenceReady, persistVisualState]);

  useEffect(() => {
    if (mode === "explore") syncExploreUrl(activeQuestionId, timelineYear);
  }, [activeQuestionId, mode, timelineYear]);

  const handleCloseDetail = useCallback(() => {
    selectThinker(null);
    selectRelation(null);
    clearCompare();
    setDetailSheetSnap("peek");
    if (mode !== "explore") return;

    const params = new URLSearchParams();
    if (activeQuestionId) params.set("question", activeQuestionId);
    params.set("year", String(timelineYear));
    window.history.replaceState({}, "", `/explore?${params.toString()}`);
  }, [activeQuestionId, clearCompare, mode, selectRelation, selectThinker, timelineYear]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        if (searchOpen || listViewOpen) {
          setSearchOpen(false);
          setListViewOpen(false);
          return;
        }
        setSearchOpen(false);
        setListViewOpen(false);
        if (selectedThinkerId || selectedRelationId || compareIds.length > 0) handleCloseDetail();
      }
      if (mode === "story" && event.key === "ArrowRight") setChapterIndex(Math.min(storyChapters.length - 1, chapterIndex + 1));
      if (mode === "story" && event.key === "ArrowLeft") setChapterIndex(Math.max(0, chapterIndex - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chapterIndex, compareIds.length, handleCloseDetail, listViewOpen, mode, searchOpen, selectedRelationId, selectedThinkerId, setChapterIndex, setListViewOpen, setSearchOpen]);

  const chooseQualityPreference = useCallback((preference: QualityPreference) => {
    setQualityPreference(preference);
    const nextQuality = preference === "auto"
      ? initialAutoQuality(window.innerWidth, window.matchMedia("(pointer: coarse)").matches)
      : preference;
    autoQualityRef.current = {
      quality: nextQuality,
      aboveBudgetSince: null,
      belowBudgetSince: null,
      lastChangeAt: performance.now(),
    };
    setQuality(nextQuality);
  }, [setQuality, setQualityPreference]);

  const chooseEarthMode = (nextMode: EarthLightingMode) => {
    setEarthMode(nextMode);
  };

  const handlePerformanceSample = useCallback((p75FrameMs: number) => {
    if (useAtlasStore.getState().qualityPreference !== "auto") return;
    const previous = autoQualityRef.current;
    const next = advanceAutoQuality(previous, p75FrameMs, performance.now());
    autoQualityRef.current = next;
    if (next.quality !== previous.quality) setQuality(next.quality);
  }, [setQuality]);

  const handleCameraSnapshotChange = useCallback((snapshot: GlobeCameraSnapshot) => {
    setCameraSnapshot(snapshot);
  }, []);

  const openSemanticExplorer = useCallback(() => setListViewOpen(true), [setListViewOpen]);

  const handleSelectThinker = useCallback((id: string | null) => {
    selectThinker(id);
    if (id) setDetailSheetSnap("half");
    const url = new URL(window.location.href);
    url.pathname = "/explore";
    if (!id) {
      url.searchParams.delete("thinker");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return;
    }
    const thinker = thinkerById.get(id);
    if (thinker) {
      url.searchParams.set("thinker", thinker.slug);
      url.searchParams.set("year", String(timelineYear));
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [selectThinker, timelineYear]);

  const handleSelectRelation = useCallback((id: string | null) => {
    selectRelation(id);
    if (!id) return;
    setDetailSheetSnap("half");
    window.history.replaceState({}, "", `/explore?relation=${encodeURIComponent(id)}&year=${timelineYear}`);
  }, [selectRelation, timelineYear]);

  useEffect(() => {
    if (!initialized || compareIds.length !== 2 || selectedThinkerId || selectedRelationId) return;
    const left = thinkerById.get(compareIds[0]);
    const right = thinkerById.get(compareIds[1]);
    if (left && right) window.history.replaceState({}, "", `/compare/${left.slug}/${right.slug}`);
  }, [compareIds, initialized, selectedRelationId, selectedThinkerId]);

  const changeMode = (nextMode: AtlasMode) => {
    setMode(nextMode);
    setPlaying(nextMode === "story");
    if (nextMode === "story") {
      setChapterIndex(0);
      window.history.replaceState({}, "", "/story/world-asks");
    } else {
      entrySeenRef.current = true;
      window.history.replaceState({}, "", "/explore");
    }
  };

  const showCompare = displayCompareIds.length === 2 && !displaySelectedThinkerId && !displaySelectedRelationId;
  const detailOpen = Boolean(displaySelectedThinkerId || displaySelectedRelationId || showCompare);
  const closeDetailLabel = displaySelectedThinkerId
    ? "关闭人物详情"
    : displaySelectedRelationId
      ? "关闭关系详情"
      : "关闭比较详情";

  const handleDetailDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const snaps: DetailSheetSnap[] = ["peek", "half", "full"];
    const currentIndex = snaps.indexOf(detailSheetSnap);
    const direction = info.offset.y < -70 || info.velocity.y < -450
      ? 1
      : info.offset.y > 70 || info.velocity.y > 450
        ? -1
        : 0;
    setDetailSheetSnap(snaps[Math.max(0, Math.min(snaps.length - 1, currentIndex + direction))]);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className={`atlas-shell atlas-shell--${displayMode}`} data-hydrated={initialized ? "true" : "false"}>
        <a className="skip-link" href="#atlas-content">跳到思想内容</a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="思想星图首页">
            <span className="brand__seal">I</span>
            <span><strong>思想星图</strong><small>ATLAS OF IDEAS</small></span>
          </Link>
          <p className="site-header__prompt">人类在不同地方，如何回答相同的问题？</p>
          <div className="header-actions">
            <button className="search-button" type="button" aria-label="搜索思想星图" onClick={() => setSearchOpen(true)}>
              <span>搜索</span><kbd>/</kbd>
            </button>
            <button className="text-view-button" type="button" aria-label="打开文字探索" onClick={() => setListViewOpen(true)}>文字探索</button>
            <Link className="knowledge-button" href="/knowledge">知识库</Link>
            <div className="mode-switch" aria-label="浏览模式">
              <button type="button" className={displayMode === "story" ? "is-active" : ""} onClick={() => changeMode("story")}>故事</button>
              <button type="button" className={displayMode === "explore" ? "is-active" : ""} onClick={() => changeMode("explore")}>探索</button>
            </div>
          </div>
        </header>

        <main id="atlas-content" className="atlas-main">
          <section className={`globe-stage${detailOpen ? " globe-stage--detail-open" : ""}`} aria-label="思想星图3D地球">
            <div className="globe-stage__topline">
              <span>WORLD PHILOSOPHY · {String(thinkers.length).padStart(2, "0")} VOICES</span>
            </div>
            <div className="globe-canvas-wrap">
              <GlobeCanvas
                mode={displayMode}
                earthMode={earthMode}
                detailOpen={detailOpen}
                isPlaying={isPlaying}
                chapterIndex={displayChapterIndex}
                selectedThinkerId={displaySelectedThinkerId}
                selectedRelationId={displaySelectedRelationId}
                activeQuestionId={activeQuestionId}
                timelineYear={timelineYear}
                timelineScrubbing={isTimelineScrubbing}
                quality={quality}
                focusDepth={focusDepth}
                cameraSnapshot={cameraSnapshot}
                reduceMotion={reduceMotion}
                onSelectThinker={handleSelectThinker}
                onSelectRelation={handleSelectRelation}
                onFallback={openSemanticExplorer}
                onCameraSnapshotChange={handleCameraSnapshotChange}
                onPerformanceSample={handlePerformanceSample}
              />
            </div>
            <div className="globe-vignette" aria-hidden="true" />
            <DisplaySettings
              earthMode={earthMode}
              qualityPreference={qualityPreference}
              effectiveQuality={quality}
              onEarthModeChange={chooseEarthMode}
              onQualityPreferenceChange={chooseQualityPreference}
            />
            {displayMode === "story" ? <StoryOverlay chapterIndex={displayChapterIndex} isPlaying={isPlaying} /> : (
              <QuestionRail activeQuestionId={activeQuestionId} onSelect={setQuestion} />
            )}
            {displayMode === "explore" ? <RelationLegend onSelect={handleSelectRelation} /> : null}
            {displayMode === "explore" && displaySelectedThinkerId && !isCompact ? (
              <FocusDepthControl value={focusDepth} onChange={setFocusDepth} />
            ) : null}
            <div className="globe-instruction">
              <span>{displayMode === "story" && isPlaying ? "镜头正在讲述" : "拖动旋转 · 滚轮缩放 · 点击节点"}</span>
            </div>
          </section>

          <motion.aside
            className={`detail-pane detail-pane--snap-${detailSheetSnap}${detailOpen ? " detail-pane--active" : ""}`}
            data-snap={detailSheetSnap}
            drag={isCompact && detailOpen ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.08}
            onDragEnd={handleDetailDragEnd}
          >
            {isCompact && detailOpen ? (
              <button
                className="detail-sheet-handle"
                type="button"
                aria-label="调整详情面板高度"
                onClick={() => setDetailSheetSnap(detailSheetSnap === "peek" ? "half" : detailSheetSnap === "half" ? "full" : "peek")}
              ><span /></button>
            ) : null}
            {isCompact && displayMode === "explore" && displaySelectedThinkerId ? (
              <FocusDepthControl value={focusDepth} onChange={setFocusDepth} />
            ) : null}
            {detailOpen ? (
              <button className="detail-pane__close" type="button" aria-label={closeDetailLabel} onClick={handleCloseDetail}>×</button>
            ) : null}
            <div className="detail-pane__rail"><span>ARCHIVE</span><i /></div>
            <AnimatePresence mode="wait">
              {displaySelectedThinkerId ? <ThinkerDetail thinkerId={displaySelectedThinkerId} />
                : displaySelectedRelationId ? <RelationDetail relationId={displaySelectedRelationId} />
                  : showCompare ? <CompareDetail ids={displayCompareIds} />
                    : <EmptyDetail onSelectRelation={handleSelectRelation} />}
            </AnimatePresence>
          </motion.aside>
        </main>

        <BottomDock mode={displayMode} onTakeover={() => persistVisualState("explore")} />
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSelectThinker} />
        <SemanticExplorer open={listViewOpen} onClose={() => setListViewOpen(false)} onSelect={handleSelectThinker} />
      </div>
    </MotionConfig>
  );
}
