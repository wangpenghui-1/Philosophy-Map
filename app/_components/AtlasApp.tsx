"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
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
  works,
  type QuestionId,
  type RelationType,
} from "../_data/atlas";
import {
  emitJourneyEvent,
  formatJourneyRemaining,
  journeyById,
  journeyCatalog,
  journeyRemainingMs,
  validateJourneyReferences,
  type JourneyDefinition,
} from "../_data/journeys";
import {
  questionPresentationById,
  relationTypeOrder,
  type QuestionPresentation,
} from "../_data/question-presentations";
import { useAtlasStore, type AtlasMode } from "../_state/atlas-store";
import type { EarthLightingMode, GlobeStoryFocus } from "./GlobeCanvas";
import ThinkerPortrait from "./ThinkerPortrait";
import { DisplaySettings, FocusDepthControl } from "./AtlasVisualControls";
import {
  AtlasHeader,
  AtlasIntro,
  QuestionDock,
  RelationFilter,
  type IntroSequence,
} from "./AtlasFirstScreen";
import {
  ATLAS_VISUAL_LEGACY_STORAGE_KEY,
  ATLAS_VISUAL_STORAGE_KEY,
  ATLAS_INTRO_DURATION_MS,
  QUESTION_CAMERA_SETTLE_MS,
  advanceAutoQuality,
  initialAutoQuality,
  parsePersistedVisualState,
  timelineDensity,
  type AutoQualityState,
  type DetailSheetSnap,
  type GlobeCameraSnapshot,
  type QualityPreference,
} from "./atlas-visual-policy";

validateJourneyReferences(journeyCatalog, new Set(thinkerById.keys()), new Set(relationById.keys()));

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
  initialJourneyId?: string;
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

function JourneyOverlay({
  journey,
  nodeIndex,
  phase,
  remainingMs,
  onPrevious,
  onNext,
  onPause,
  onResume,
  onSkip,
  onExplore,
  onRelated,
}: {
  journey: JourneyDefinition;
  nodeIndex: number;
  phase: "playing" | "paused" | "completed";
  remainingMs: number;
  onPrevious: () => void;
  onNext: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onExplore: () => void;
  onRelated: (journeyId: string) => void;
}) {
  if (phase === "completed") {
    const relatedJourney = journey.relatedJourneyId ? journeyById.get(journey.relatedJourneyId) : null;
    return (
      <motion.article
        className="journey-story-card journey-story-card--complete"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        aria-live="polite"
      >
        <small>{journey.title}之旅 · 完成</small>
        <h2>{journey.closingTitle}</h2>
        <p>{journey.closingBody}</p>
        <div className="journey-story-card__complete-actions">
          {relatedJourney ? (
            <button type="button" onClick={() => onRelated(relatedJourney.id)}>
              继续：{relatedJourney.title}
            </button>
          ) : null}
          <button type="button" onClick={onExplore}>进入自由探索</button>
        </div>
      </motion.article>
    );
  }

  const node = journey.nodes[nodeIndex] ?? journey.nodes[0];
  const thinker = thinkerById.get(node.thinkerId);
  if (!thinker) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.article
        className={`journey-story-card${phase === "paused" ? " is-paused" : ""}`}
        key={node.id}
        initial={{ opacity: 0, x: -18, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 12, y: -8 }}
        transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
        aria-live="polite"
      >
        <header className="journey-story-card__meta">
          <span>{journey.title}之旅 · {nodeIndex + 1}/{journey.nodes.length}</span>
          <span>{formatJourneyRemaining(remainingMs)}</span>
        </header>
        {nodeIndex === 0 && journey.openingQuestion ? (
          <p className="journey-story-card__opening">{journey.openingQuestion}</p>
        ) : null}
        <div className="journey-story-card__thinker">
          <ThinkerPortrait thinker={thinker} variant="thumb" />
          <div><small>{node.eyebrow}</small><strong>{thinker.name}</strong><span>{thinker.period}</span></div>
        </div>
        {node.incomingTransition ? (
          <span className={`journey-transition-label journey-transition-label--${node.incomingTransition.kind}`}>
            {node.incomingTransition.label}
          </span>
        ) : null}
        <h2>{node.title}</h2>
        <p className="journey-story-card__core">{node.coreIdea}</p>
        <p className="journey-story-card__body">{node.body}</p>
        <p className="journey-story-card__transition">{node.transitionPrompt}</p>
        <small className="journey-story-card__editorial">本站策展性摘要，并非人物原话</small>
        {phase === "paused" ? <p className="journey-story-card__paused">旅程已暂停。你可以继续浏览人物与关系，准备好后再回来。</p> : null}
        <div className="journey-story-card__progress" aria-label={`第${nodeIndex + 1}站，共${journey.nodes.length}站`}>
          {journey.nodes.map((item, index) => <i key={item.id} className={index <= nodeIndex ? "is-active" : ""} />)}
        </div>
        <footer className="journey-story-card__footer">
          <div className="journey-story-card__controls">
            <button type="button" onClick={onPrevious} disabled={nodeIndex === 0} aria-label="上一站">←</button>
            {phase === "playing" ? (
              <button className="journey-story-card__primary" type="button" onClick={onPause}>暂停旅程</button>
            ) : (
              <button className="journey-story-card__primary" type="button" onClick={onResume}>继续旅程</button>
            )}
            <button type="button" onClick={onNext} aria-label={nodeIndex === journey.nodes.length - 1 ? "完成旅程" : "下一站"}>→</button>
          </div>
          <button className="journey-story-card__skip" type="button" onClick={onSkip}>退出旅程，自由探索</button>
        </footer>
      </motion.article>
    </AnimatePresence>
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
              <small>{source.publisher}</small>
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
  if (!thinker) return null;

  return (
    <motion.article
      className="detail-card detail-card--thinker"
      key={thinker.id}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38 }}
    >
      <div className="detail-card__index">人物 · {String(thinkers.findIndex((item) => item.id === thinker.id) + 1).padStart(2, "0")}</div>
      <div className="thinker-preview__hero">
        <ThinkerPortrait thinker={thinker} variant="full" className="thinker-preview__portrait" />
        <div className="thinker-preview__identity">
          <div className="detail-card__heading">
            <div>
              <h2>{thinker.name}</h2>
              <p>{thinker.englishName}</p>
            </div>
            <span style={{ "--thinker-color": thinker.color } as React.CSSProperties}>{thinker.period}</span>
          </div>
          <div className="keyword-row keyword-row--preview" aria-label="关键词">
            {thinker.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
          </div>
        </div>
      </div>
      <section className="detail-card__statement">
        <small>核心思想</small>
        <p>{thinker.thesis}</p>
      </section>
      <div className="detail-actions detail-actions--thinker">
        <Link className="detail-actions__primary" href={`/thinker/${thinker.slug}`}>
          查看人物详情 <span aria-hidden="true">→</span>
        </Link>
        <button
          className={compareIds.includes(thinker.id) ? "is-active" : ""}
          type="button"
          onClick={() => toggleCompare(thinker.id)}
        >
          {compareIds.includes(thinker.id) ? "已加入比较" : "加入比较"}
        </button>
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
      <details className="relation-evidence">
        <summary>查看证据</summary>
        {relation.note ? <p className="uncertainty-note"><strong>阅读提示：</strong>{relation.note}</p> : null}
        <section className="detail-section detail-section--sources">
          <h4>为什么可以这样连接</h4>
          <SourceLinks sourceIds={relation.sourceIds} />
        </section>
      </details>
    </motion.article>
  );
}

function QuestionDetail({
  presentation,
  onStart,
}: {
  presentation: QuestionPresentation;
  onStart: (journeyId: string) => void;
}) {
  return (
    <motion.article
      className="detail-card question-detail"
      key={presentation.questionId}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: .42, ease: [0.22, 1, 0.36, 1] }}
      style={{ "--question-accent": presentation.theme.accent } as React.CSSProperties}
    >
      <div className="detail-card__index">问题入口</div>
      <div className="question-detail__art" aria-hidden="true">
        <Image src={presentation.artwork.avif640} alt="" width={640} height={400} sizes="380px" />
      </div>
      <h2>{presentation.title}</h2>
      <p>{presentation.subtitle}</p>
      <button type="button" onClick={() => onStart(presentation.primaryJourneyId)}>开始思想旅程</button>
      {presentation.relatedJourneyIds?.length ? (
        <small>也可继续：{presentation.relatedJourneyIds.map((id) => journeyById.get(id)?.title).filter(Boolean).join("、")}</small>
      ) : null}
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
      .filter((work) => work.title.toLowerCase().includes(normalized))
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
  const journeyPhase = useAtlasStore((state) => state.journeyPhase);
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

  if (journeyPhase !== "idle" && journeyPhase !== "legacy") return null;

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
      {compareThinkers.length ? (
        <div className="compare-status">
          <small>人物比较</small>
          <span>{compareThinkers.map((item) => item?.name).join(" × ")}</span>
        </div>
      ) : null}
    </footer>
  );
}

export default function AtlasApp({
  initialMode = "explore",
  initialChapterId,
  initialJourneyId,
  initialThinkerSlug,
  initialCompareSlugs,
}: AtlasAppProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const [earthMode, setEarthMode] = useState<EarthLightingMode>("night");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<QuestionId | null>(null);
  const [questionPreviewOpen, setQuestionPreviewOpen] = useState(false);
  const [visibleRelationTypes, setVisibleRelationTypes] = useState<RelationType[]>(relationTypeOrder);
  const [introSequence, setIntroSequence] = useState<IntroSequence>("none");
  const [uiHidden, setUiHidden] = useState(false);
  const mode = useAtlasStore((state) => state.mode);
  const isPlaying = useAtlasStore((state) => state.isPlaying);
  const chapterIndex = useAtlasStore((state) => state.chapterIndex);
  const journeyPhase = useAtlasStore((state) => state.journeyPhase);
  const activeJourneyId = useAtlasStore((state) => state.activeJourneyId);
  const journeyNodeIndex = useAtlasStore((state) => state.journeyNodeIndex);
  const journeyCameraRevision = useAtlasStore((state) => state.journeyCameraRevision);
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
  const startJourney = useAtlasStore((state) => state.startJourney);
  const pauseJourney = useAtlasStore((state) => state.pauseJourney);
  const resumeJourney = useAtlasStore((state) => state.resumeJourney);
  const setJourneyNodeIndex = useAtlasStore((state) => state.setJourneyNodeIndex);
  const completeJourney = useAtlasStore((state) => state.completeJourney);
  const leaveJourney = useAtlasStore((state) => state.leaveJourney);
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
  const [journeyRemaining, setJourneyRemaining] = useState(
    journeyCatalog.find((journey) => journey.recommended)?.estimatedDurationMs ?? 0,
  );
  const initializationAppliedRef = useRef(false);
  const entrySeenRef = useRef(false);
  const questionPreviewTimerRef = useRef<number | null>(null);
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
  const initialJourney = initialJourneyId ? journeyById.get(initialJourneyId) ?? null : null;
  const displayMode = initialized ? mode : initialThinkerId || initialCompareIds.length === 2 ? "explore" : initialMode;
  const displayJourneyPhase = initialized
    ? journeyPhase
    : initialJourney
      ? "playing"
      : initialChapterId
      ? "legacy"
      : initialMode === "story"
        ? "entry"
        : "idle";
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
      window.localStorage.getItem(ATLAS_VISUAL_LEGACY_STORAGE_KEY),
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
    setSoundEnabled(persisted?.soundEnabled ?? false);

    // Every ordinary visit starts from a clean atlas. Shareable selections are
    // restored only from the URL below; v1 camera and selection fields are ignored.
    setQuestion(null);
    selectThinker(null);
    selectRelation(null);
    clearCompare();
    setTimelineYear(atlasTimelineEndYear);
    setCameraSnapshot(null);

    const nextIntroSequence: IntroSequence | null = !explicitRoute && !initialJourney && !initialChapterId
      ? reduceMotion ? "reduced" : persisted?.entrySeen ? "quick" : "full"
      : null;
    if (nextIntroSequence) {
      entrySeenRef.current = true;
      window.localStorage.setItem(ATLAS_VISUAL_STORAGE_KEY, JSON.stringify({
        version: 2,
        entrySeen: true,
        earthMode: persisted?.earthMode ?? "night",
        qualityPreference: restoredPreference,
        soundEnabled: persisted?.soundEnabled ?? false,
      }));
    }

    if (initialJourney) {
      startJourney(initialJourney.id);
      emitJourneyEvent("start", { journeyId: initialJourney.id });
    } else if (initialChapterId) {
      setMode("story");
      setPlaying(true);
      useAtlasStore.setState({ journeyPhase: "legacy", activeJourneyId: null, journeyNodeIndex: 0 });
    } else {
      leaveJourney();
    }

    if (initialChapterId) {
      const nextIndex = storyChapters.findIndex((chapter) => chapter.id === initialChapterId);
      if (nextIndex >= 0) setChapterIndex(nextIndex);
    }
    const question = query.get("question") as QuestionId | null;
    const relation = query.get("relation");
    const yearParam = query.get("year");
    const year = yearParam === null ? Number.NaN : Number(yearParam);
    const shouldOpenQuestionPreview = Boolean(question && questions.some((item) => item.id === question));
    if (shouldOpenQuestionPreview && question) {
      setQuestion(question);
    }
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
      if (nextIntroSequence) setIntroSequence(nextIntroSequence);
      if (shouldOpenQuestionPreview) setQuestionPreviewOpen(true);
      setPersistenceReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clearCompare, initialChapterId, initialCompareSlugs, initialJourney, initialMode, initialThinkerSlug, leaveJourney, reduceMotion, selectRelation, selectThinker, setChapterIndex, setMode, setPlaying, setQuality, setQualityPreference, setQuestion, setTimelineYear, startJourney, toggleCompare]);

  useEffect(() => {
    if (introSequence === "none") return;
    const duration = ATLAS_INTRO_DURATION_MS[introSequence];
    const finish = () => setIntroSequence("none");
    const timer = window.setTimeout(finish, duration);
    const events: Array<keyof WindowEventMap> = ["pointerdown", "wheel", "keydown"];
    events.forEach((eventName) => window.addEventListener(eventName, finish, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, finish));
    };
  }, [introSequence]);

  useEffect(() => () => {
    if (questionPreviewTimerRef.current !== null) window.clearTimeout(questionPreviewTimerRef.current);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!initialized || mode !== "story" || !isPlaying || journeyPhase !== "legacy") return;
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
  }, [chapterIndex, initialized, isPlaying, journeyPhase, mode, reduceMotion, setChapterIndex, setMode, setPlaying]);

  const activeJourney = activeJourneyId ? journeyById.get(activeJourneyId) ?? null : null;
  useEffect(() => {
    if (!initialized || !activeJourneyId || !["playing", "paused", "completed"].includes(journeyPhase)) return;
    const timeout = window.setTimeout(() => {
      void fetch(`/api/v1/me/progress/journey/${encodeURIComponent(activeJourneyId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeOrdinal: journeyNodeIndex, completed: journeyPhase === "completed" }),
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [activeJourneyId, initialized, journeyNodeIndex, journeyPhase]);
  const journeyStoryFocus = useMemo<GlobeStoryFocus | null>(() => {
    if (!activeJourney || displayJourneyPhase === "entry" || displayJourneyPhase === "idle" || displayJourneyPhase === "legacy") return null;
    const node = activeJourney.nodes[journeyNodeIndex] ?? activeJourney.nodes[0];
    if (!node) return null;
    const visited = activeJourney.nodes.slice(0, journeyNodeIndex + 1);
    return {
      key: `${node.id}:${journeyCameraRevision}`,
      camera: node.camera,
      focusThinkerId: node.thinkerId,
      thinkerIds: visited.map((item) => item.thinkerId),
      relationIds: visited.flatMap((item) => item.incomingTransition?.kind === "evidence-relation"
        ? [item.incomingTransition.relationId]
        : []),
      thematicTransitions: visited.flatMap((item) => item.incomingTransition?.kind === "thematic-transition"
        ? [{
            from: item.incomingTransition.from,
            to: item.incomingTransition.to,
            label: item.incomingTransition.label,
          }]
        : []),
    };
  }, [activeJourney, displayJourneyPhase, journeyCameraRevision, journeyNodeIndex]);
  const activeQuestionPresentation = activeQuestionId
    ? questionPresentationById.get(activeQuestionId) ?? null
    : null;
  const questionGlobeFocus = useMemo<GlobeStoryFocus | null>(() => {
    if (!activeQuestionPresentation || displayMode !== "explore") return null;
    return {
      key: `question:${activeQuestionPresentation.questionId}`,
      camera: activeQuestionPresentation.camera,
      thinkerIds: activeQuestionPresentation.thinkerIds,
      relationIds: activeQuestionPresentation.relationIds,
      thematicTransitions: [],
    };
  }, [activeQuestionPresentation, displayMode]);

  useEffect(() => {
    if (!initialized || !activeJourney || journeyPhase !== "playing" || !isPlaying) return;
    const node = activeJourney.nodes[journeyNodeIndex];
    if (!node) return;
    const settleMs = reduceMotion ? 120 : 1_750;
    const startedAt = performance.now() + settleMs;
    const interval = window.setInterval(() => {
      const elapsed = Math.max(0, performance.now() - startedAt);
      const later = activeJourney.nodes
        .slice(journeyNodeIndex + 1)
        .reduce((total, item) => total + item.durationMs, 0);
      setJourneyRemaining(Math.max(0, node.durationMs - elapsed) + later);
    }, 1_000);
    const timeout = window.setTimeout(() => {
      if (journeyNodeIndex < activeJourney.nodes.length - 1) {
        setJourneyRemaining(journeyRemainingMs(activeJourney, journeyNodeIndex + 1));
        setJourneyNodeIndex(journeyNodeIndex + 1);
      } else {
        completeJourney();
        emitJourneyEvent("complete", { journeyId: activeJourney.id });
      }
    }, settleMs + node.durationMs);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [activeJourney, completeJourney, initialized, isPlaying, journeyNodeIndex, journeyPhase, reduceMotion, setJourneyNodeIndex]);

  useEffect(() => {
    const interrupt = () => {
      if (useAtlasStore.getState().journeyPhase !== "playing") return;
      pauseJourney();
      const journeyId = useAtlasStore.getState().activeJourneyId;
      if (journeyId) emitJourneyEvent("pause", { journeyId, reason: "window" });
    };
    const handleVisibility = () => {
      if (document.hidden) interrupt();
    };
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", interrupt);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pauseJourney]);

  const persistVisualState = useCallback((nextMode: AtlasMode = mode) => {
    if (nextMode === "explore") entrySeenRef.current = true;
    window.localStorage.setItem(ATLAS_VISUAL_STORAGE_KEY, JSON.stringify({
      version: 2,
      entrySeen: entrySeenRef.current,
      earthMode,
      qualityPreference,
      soundEnabled,
    }));
  }, [earthMode, mode, qualityPreference, soundEnabled]);

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
    if (questionPreviewOpen && !selectedThinkerId && !selectedRelationId && compareIds.length !== 2) {
      setQuestionPreviewOpen(false);
      setDetailSheetSnap("peek");
      return;
    }
    setQuestionPreviewOpen(false);
    selectThinker(null);
    selectRelation(null);
    clearCompare();
    setDetailSheetSnap("peek");
    if (mode !== "explore") return;

    const params = new URLSearchParams();
    if (activeQuestionId) params.set("question", activeQuestionId);
    params.set("year", String(timelineYear));
    window.history.replaceState({}, "", `/explore?${params.toString()}`);
  }, [activeQuestionId, clearCompare, compareIds.length, mode, questionPreviewOpen, selectRelation, selectThinker, selectedRelationId, selectedThinkerId, timelineYear]);

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
      if (mode === "story" && (journeyPhase === "playing" || journeyPhase === "paused")) {
        const state = useAtlasStore.getState();
        const journey = state.activeJourneyId ? journeyById.get(state.activeJourneyId) : null;
        if (journey && event.key === "ArrowRight") {
          if (state.journeyNodeIndex >= journey.nodes.length - 1) completeJourney();
          else {
            const nextIndex = state.journeyNodeIndex + 1;
            setJourneyRemaining(journeyRemainingMs(journey, nextIndex));
            setJourneyNodeIndex(nextIndex);
          }
        }
        if (journey && event.key === "ArrowLeft") {
          const nextIndex = Math.max(0, state.journeyNodeIndex - 1);
          setJourneyRemaining(journeyRemainingMs(journey, nextIndex));
          setJourneyNodeIndex(nextIndex);
        }
        if (event.key === " " && !typing) {
          event.preventDefault();
          if (state.journeyPhase === "playing") pauseJourney();
          else resumeJourney();
        }
      } else if (mode === "story" && journeyPhase === "legacy") {
        if (event.key === "ArrowRight") setChapterIndex(Math.min(storyChapters.length - 1, chapterIndex + 1));
        if (event.key === "ArrowLeft") setChapterIndex(Math.max(0, chapterIndex - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chapterIndex, compareIds.length, completeJourney, handleCloseDetail, journeyPhase, listViewOpen, mode, pauseJourney, resumeJourney, searchOpen, selectedRelationId, selectedThinkerId, setChapterIndex, setJourneyNodeIndex, setListViewOpen, setSearchOpen]);

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

  const chooseSoundEnabled = (enabled: boolean) => {
    setSoundEnabled(enabled);
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

  const handleWebglRuntimeFallback = useCallback(() => {
    const currentState = useAtlasStore.getState();
    if (currentState.qualityPreference !== "auto") return;
    const safeQuality = currentState.quality === "high" ? "medium" : currentState.quality;
    autoQualityRef.current = {
      quality: safeQuality,
      aboveBudgetSince: null,
      belowBudgetSince: null,
      lastChangeAt: performance.now(),
    };
    setQuality(safeQuality);
  }, [setQuality]);

  const openSemanticExplorer = useCallback(() => setListViewOpen(true), [setListViewOpen]);

  const interruptJourney = useCallback((reason: string) => {
    const state = useAtlasStore.getState();
    if (state.journeyPhase !== "playing" || !state.activeJourneyId) return;
    const journey = journeyById.get(state.activeJourneyId);
    if (journey) setJourneyRemaining(journeyRemainingMs(journey, state.journeyNodeIndex));
    pauseJourney();
    emitJourneyEvent("pause", { journeyId: state.activeJourneyId, reason });
  }, [pauseJourney]);

  const handleStartJourney = useCallback((journeyId: string, source = "catalog") => {
    const journey = journeyById.get(journeyId);
    if (!journey || journey.availability !== "available") return;
    setQuestionPreviewOpen(false);
    setDetailSheetSnap("peek");
    startJourney(journeyId);
    setJourneyRemaining(journey.estimatedDurationMs);
    window.history.replaceState({}, "", `/journey/${journeyId}`);
    emitJourneyEvent("start", { journeyId, source });
  }, [startJourney]);

  const handleLeaveJourney = useCallback((eventName: "skip" | "complete" = "skip") => {
    const journeyId = useAtlasStore.getState().activeJourneyId;
    if (journeyId) emitJourneyEvent(eventName, { journeyId });
    entrySeenRef.current = true;
    leaveJourney();
    persistVisualState("explore");
    window.history.replaceState({}, "", `/explore?from=${eventName === "complete" ? "journey" : "journey-skip"}`);
  }, [leaveJourney, persistVisualState]);

  const handleResumeJourney = useCallback(() => {
    const state = useAtlasStore.getState();
    const journeyId = state.activeJourneyId;
    const journey = journeyId ? journeyById.get(journeyId) : null;
    if (journey) setJourneyRemaining(journeyRemainingMs(journey, state.journeyNodeIndex));
    resumeJourney();
    setDetailSheetSnap("peek");
    if (journeyId) emitJourneyEvent("resume", { journeyId });
  }, [resumeJourney]);

  const handleJourneyPrevious = useCallback(() => {
    const state = useAtlasStore.getState();
    const nextIndex = Math.max(0, state.journeyNodeIndex - 1);
    const journey = state.activeJourneyId ? journeyById.get(state.activeJourneyId) : null;
    if (journey) setJourneyRemaining(journeyRemainingMs(journey, nextIndex));
    setJourneyNodeIndex(nextIndex);
  }, [setJourneyNodeIndex]);

  const handleJourneyNext = useCallback(() => {
    const state = useAtlasStore.getState();
    const journey = state.activeJourneyId ? journeyById.get(state.activeJourneyId) : null;
    if (!journey) return;
    if (state.journeyNodeIndex >= journey.nodes.length - 1) {
      completeJourney();
      emitJourneyEvent("complete", { journeyId: journey.id });
      return;
    }
    const nextIndex = state.journeyNodeIndex + 1;
    setJourneyRemaining(journeyRemainingMs(journey, nextIndex));
    setJourneyNodeIndex(nextIndex);
  }, [completeJourney, setJourneyNodeIndex]);

  const handleSelectThinker = useCallback((id: string | null) => {
    if (id) interruptJourney("thinker");
    selectThinker(id);
    if (id) {
      setQuestionPreviewOpen(false);
      setDetailSheetSnap("half");
    }
    if (mode !== "explore") return;
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
  }, [interruptJourney, mode, selectThinker, timelineYear]);

  const handleSelectRelation = useCallback((id: string | null) => {
    if (id) interruptJourney("relation");
    selectRelation(id);
    if (!id) return;
    setQuestionPreviewOpen(false);
    setDetailSheetSnap("half");
    if (mode !== "explore") return;
    window.history.replaceState({}, "", `/explore?relation=${encodeURIComponent(id)}&year=${timelineYear}`);
  }, [interruptJourney, mode, selectRelation, timelineYear]);

  const handleSelectQuestion = useCallback((id: QuestionId) => {
    entrySeenRef.current = true;
    if (questionPreviewTimerRef.current !== null) window.clearTimeout(questionPreviewTimerRef.current);
    clearCompare();
    setQuestion(id);
    setQuestionPreviewOpen(false);
    setDetailSheetSnap("half");
    if (mode !== "explore") leaveJourney();
    const url = new URL(window.location.href);
    url.pathname = "/explore";
    url.search = "";
    url.searchParams.set("question", id);
    url.searchParams.set("year", String(timelineYear));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    questionPreviewTimerRef.current = window.setTimeout(
      () => setQuestionPreviewOpen(true),
      reduceMotion ? ATLAS_INTRO_DURATION_MS.reduced : QUESTION_CAMERA_SETTLE_MS,
    );
  }, [clearCompare, leaveJourney, mode, reduceMotion, setQuestion, timelineYear]);

  const toggleRelationType = useCallback((type: RelationType) => {
    setVisibleRelationTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : relationTypeOrder.filter((item) => item === type || current.includes(item)));
  }, []);

  useEffect(() => {
    if (!initialized || compareIds.length !== 2 || selectedThinkerId || selectedRelationId) return;
    const left = thinkerById.get(compareIds[0]);
    const right = thinkerById.get(compareIds[1]);
    if (left && right) window.history.replaceState({}, "", `/compare/${left.slug}/${right.slug}`);
  }, [compareIds, initialized, selectedRelationId, selectedThinkerId]);

  const showCompare = displayCompareIds.length === 2 && !displaySelectedThinkerId && !displaySelectedRelationId;
  const showQuestionPreview = Boolean(
    questionPreviewOpen
    && activeQuestionPresentation
    && !displaySelectedThinkerId
    && !displaySelectedRelationId
    && !showCompare,
  );
  const detailOpen = Boolean(displaySelectedThinkerId || displaySelectedRelationId || showCompare || showQuestionPreview);
  const closeDetailLabel = displaySelectedThinkerId
    ? "关闭人物详情"
    : displaySelectedRelationId
      ? "关闭关系详情"
      : showCompare
        ? "关闭比较详情"
        : "关闭问题预览";

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
      <div
        className={`atlas-shell atlas-shell--${displayMode} atlas-shell--journey-${displayJourneyPhase}${detailOpen ? " atlas-shell--detail-open" : ""}${uiHidden ? " atlas-shell--ui-hidden" : ""}${introSequence !== "none" ? ` atlas-shell--intro-${introSequence}` : ""}`}
        data-hydrated={initialized ? "true" : "false"}
      >
        <a className="skip-link" href="#atlas-content">跳到思想内容</a>
        <AtlasHeader
          onSearch={() => setSearchOpen(true)}
          onTextExplorer={() => setListViewOpen(true)}
          settings={(
            <DisplaySettings
              earthMode={earthMode}
              qualityPreference={qualityPreference}
              effectiveQuality={quality}
              soundEnabled={soundEnabled}
              onEarthModeChange={chooseEarthMode}
              onQualityPreferenceChange={chooseQualityPreference}
              onSoundEnabledChange={chooseSoundEnabled}
            />
          )}
        />

        <main id="atlas-content" className="atlas-main">
          <section className={`globe-stage${detailOpen ? " globe-stage--detail-open" : ""}`} aria-label="思想星图3D地球">
            <div className="globe-stage__topline">
              <span>WORLD PHILOSOPHY · {String(thinkers.length).padStart(2, "0")} VOICES</span>
            </div>
            <button
              className="immersive-toggle"
              type="button"
              aria-label={uiHidden ? "显示探索界面" : "隐藏界面，进入沉浸模式"}
              aria-pressed={uiHidden}
              onClick={() => setUiHidden((hidden) => !hidden)}
            >
              <span aria-hidden="true" />
              <strong>{uiHidden ? "显示界面" : "沉浸模式"}</strong>
            </button>
            <div className="globe-canvas-wrap">
              <GlobeCanvas
                mode={displayMode}
                earthMode={earthMode}
                detailOpen={detailOpen}
                isPlaying={isPlaying}
                chapterIndex={displayChapterIndex}
                storyFocus={journeyStoryFocus}
                questionFocus={questionGlobeFocus}
                selectedThinkerId={displaySelectedThinkerId}
                selectedRelationId={displaySelectedRelationId}
                activeQuestionId={activeQuestionId}
                highlightQuestionId={hoveredQuestionId ?? activeQuestionId}
                visibleRelationTypes={visibleRelationTypes}
                timelineYear={timelineYear}
                timelineScrubbing={isTimelineScrubbing}
                quality={quality}
                focusDepth={focusDepth}
                cameraSnapshot={cameraSnapshot}
                reduceMotion={reduceMotion}
                ambientMotion={introSequence !== "none"}
                onSelectThinker={handleSelectThinker}
                onSelectRelation={handleSelectRelation}
                onFallback={openSemanticExplorer}
                onRuntimeFallback={handleWebglRuntimeFallback}
                onCameraSnapshotChange={handleCameraSnapshotChange}
                onPerformanceSample={handlePerformanceSample}
                onStoryInterruption={() => interruptJourney("globe")}
              />
            </div>
            <div className="globe-vignette" aria-hidden="true" />
            {displayMode === "story" ? (
              activeJourney && (displayJourneyPhase === "playing" || displayJourneyPhase === "paused" || displayJourneyPhase === "completed") ? (
                <JourneyOverlay
                  journey={activeJourney}
                  nodeIndex={journeyNodeIndex}
                  phase={displayJourneyPhase}
                  remainingMs={journeyRemaining}
                  onPrevious={handleJourneyPrevious}
                  onNext={handleJourneyNext}
                  onPause={() => interruptJourney("control")}
                  onResume={handleResumeJourney}
                  onSkip={() => handleLeaveJourney("skip")}
                  onExplore={() => handleLeaveJourney("complete")}
                  onRelated={(journeyId) => handleStartJourney(journeyId, "ending")}
                />
              ) : (
                <StoryOverlay chapterIndex={displayChapterIndex} isPlaying={isPlaying} />
              )
            ) : !displaySelectedThinkerId && !displaySelectedRelationId && !showCompare ? (
              <QuestionDock
                activeQuestionId={activeQuestionId}
                reducedMotion={reduceMotion}
                onSelect={handleSelectQuestion}
                onPreview={setHoveredQuestionId}
              />
            ) : null}
            {displayMode === "explore" ? (
              <RelationFilter visibleTypes={visibleRelationTypes} onToggle={toggleRelationType} />
            ) : null}
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
            <AnimatePresence mode="wait">
              {displaySelectedThinkerId ? <ThinkerDetail thinkerId={displaySelectedThinkerId} />
                : displaySelectedRelationId ? <RelationDetail relationId={displaySelectedRelationId} />
                  : showCompare ? <CompareDetail ids={displayCompareIds} />
                    : showQuestionPreview && activeQuestionPresentation
                      ? <QuestionDetail presentation={activeQuestionPresentation} onStart={(journeyId) => handleStartJourney(journeyId, "question")} />
                      : null}
            </AnimatePresence>
          </motion.aside>
        </main>

        <BottomDock mode={displayMode} onTakeover={() => persistVisualState("explore")} />
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSelectThinker} />
        <SemanticExplorer open={listViewOpen} onClose={() => setListViewOpen(false)} onSelect={handleSelectThinker} />
        <AtlasIntro sequence={introSequence} onComplete={() => setIntroSequence("none")} />
      </div>
    </MotionConfig>
  );
}
