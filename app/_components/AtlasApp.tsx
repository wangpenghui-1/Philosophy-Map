"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
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
import { useAtlasStore, type AtlasMode, type QualityTier } from "../_state/atlas-store";

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

function QualityBadge({ quality, onChange }: { quality: QualityTier; onChange: (value: QualityTier) => void }) {
  const labels: Record<QualityTier, string> = { high: "高画质", medium: "均衡", low: "省电" };
  const next: Record<QualityTier, QualityTier> = { high: "medium", medium: "low", low: "high" };
  return (
    <button className="quality-badge" type="button" onClick={() => onChange(next[quality])}>
      <span className="quality-badge__dot" />
      {labels[quality]}
    </button>
  );
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
  return (
    <aside className="relation-legend" aria-label="关系图例">
      <span className="relation-legend__title">关系证据</span>
      <button type="button" onClick={() => onSelect("aristotle-avicenna")}>
        <i className="line-sample line-sample--direct" />
        <span>直接影响</span>
      </button>
      <button type="button" onClick={() => onSelect("buddha-nagarjuna")}>
        <i className="line-sample line-sample--lineage" />
        <span>传统延展</span>
      </button>
      <button type="button" onClick={() => onSelect("confucius-aristotle")}>
        <i className="line-sample line-sample--resonance" />
        <span>主题共鸣</span>
      </button>
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
        <Link href={`/thinker/${thinker.slug}`}>人物独立链接</Link>
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
        <div><h2>{left.name}</h2><small>{left.period}</small></div>
        <span>×</span>
        <div><h2>{right.name}</h2><small>{right.period}</small></div>
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
      <div className="detail-card__index">样片说明 · 8个节点</div>
      <h2>把注意力放在连接上</h2>
      <p>点击人物，查看问题、主张和文本；点击关系线，查看它为什么存在。灰白虚线只表示主题共鸣。</p>
      <div className="sample-stats">
        <div><strong>08</strong><span>人物节点</span></div>
        <div><strong>03</strong><span>示范关系</span></div>
        <div><strong>09</strong><span>权威来源</span></div>
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
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return thinkers;
    const workOwnerIds = works
      .filter((work) => `${work.title} ${work.originalTitle ?? ""}`.toLowerCase().includes(normalized))
      .map((work) => work.thinkerId);
    return thinkers.filter((thinker) =>
      `${thinker.name} ${thinker.englishName} ${thinker.originalName ?? ""} ${thinker.keywords.join(" ")}`
        .toLowerCase()
        .includes(normalized) || workOwnerIds.includes(thinker.id),
    );
  }, [query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
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
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：空、德性、Kant、《论语》" />
              <kbd>/</kbd>
            </label>
            <div className="search-results">
              {results.length ? results.map((thinker) => (
                <button
                  type="button"
                  key={thinker.id}
                  onClick={() => { onSelect(thinker.id); close(); }}
                >
                  <span className="search-results__mark" style={{ background: thinker.color }} />
                  <span><strong>{thinker.name}</strong><small>{thinker.englishName} · {thinker.period}</small></span>
                  <i>定位</i>
                </button>
              )) : <p>没有找到匹配节点。</p>}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SemanticExplorer({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="semantic-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="semantic-panel__head">
            <div><small>ACCESSIBLE INDEX</small><h2>文字探索</h2></div>
            <button type="button" onClick={onClose}>返回地球</button>
          </div>
          <p className="semantic-panel__intro">这里提供与3D地球同源的完整人物和关系入口，适用于键盘、读屏器或低性能设备。</p>
          <div className="semantic-panel__grid">
            {thinkers.map((thinker) => (
              <article key={thinker.id}>
                <small>{thinker.region} · {thinker.period}</small>
                <h3>{thinker.name}<span>{thinker.englishName}</span></h3>
                <p>{thinker.thesis}</p>
                <button type="button" onClick={() => { onSelect(thinker.id); onClose(); }}>在地球中定位</button>
                <SourceLinks sourceIds={thinker.sourceIds} />
              </article>
            ))}
          </div>
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

function BottomDock({ mode }: { mode: AtlasMode }) {
  const isPlaying = useAtlasStore((state) => state.isPlaying);
  const chapterIndex = useAtlasStore((state) => state.chapterIndex);
  const timelineYear = useAtlasStore((state) => state.timelineYear);
  const compareIds = useAtlasStore((state) => state.compareIds);
  const setPlaying = useAtlasStore((state) => state.setPlaying);
  const setChapterIndex = useAtlasStore((state) => state.setChapterIndex);
  const setTimelineYear = useAtlasStore((state) => state.setTimelineYear);
  const setMode = useAtlasStore((state) => state.setMode);

  const takeover = () => {
    setPlaying(false);
    setMode("explore");
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
      <input
        aria-label="历史时间轴"
        type="range"
        min={-600}
        max={1961}
        step={10}
        value={timelineYear}
        onChange={(event) => setTimelineYear(Number(event.target.value))}
      />
      <div className="timeline-scale" aria-hidden="true"><span>前600</span><span>0</span><span>1000</span><span>1961</span></div>
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
  const mode = useAtlasStore((state) => state.mode);
  const isPlaying = useAtlasStore((state) => state.isPlaying);
  const chapterIndex = useAtlasStore((state) => state.chapterIndex);
  const selectedThinkerId = useAtlasStore((state) => state.selectedThinkerId);
  const selectedRelationId = useAtlasStore((state) => state.selectedRelationId);
  const activeQuestionId = useAtlasStore((state) => state.activeQuestionId);
  const timelineYear = useAtlasStore((state) => state.timelineYear);
  const listViewOpen = useAtlasStore((state) => state.listViewOpen);
  const searchOpen = useAtlasStore((state) => state.searchOpen);
  const quality = useAtlasStore((state) => state.quality);
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
  const toggleCompare = useAtlasStore((state) => state.toggleCompare);
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
    setMode(initialMode);
    if (initialChapterId) {
      const nextIndex = storyChapters.findIndex((chapter) => chapter.id === initialChapterId);
      if (nextIndex >= 0) setChapterIndex(nextIndex);
    }
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
    const query = new URLSearchParams(window.location.search);
    const question = query.get("question") as QuestionId | null;
    const year = Number(query.get("year"));
    if (question && questions.some((item) => item.id === question)) setQuestion(question);
    if (Number.isFinite(year) && year >= -600 && year <= 1961) setTimelineYear(year);
  }, [initialChapterId, initialCompareSlugs, initialMode, initialThinkerSlug, selectThinker, setChapterIndex, setMode, setPlaying, setQuestion, setTimelineYear, toggleCompare]);

  useEffect(() => {
    const setAdaptiveQuality = () => {
      const cores = navigator.hardwareConcurrency || 4;
      if (window.innerWidth <= 680 || cores <= 4) setQuality("low");
      else if (window.innerWidth <= 1180 || cores <= 8) setQuality("medium");
      else setQuality("high");
    };
    setAdaptiveQuality();
    window.addEventListener("resize", setAdaptiveQuality);
    return () => window.removeEventListener("resize", setAdaptiveQuality);
  }, [setQuality]);

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

  useEffect(() => {
    if (mode === "explore") syncExploreUrl(activeQuestionId, timelineYear);
  }, [activeQuestionId, mode, timelineYear]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setListViewOpen(false);
        selectThinker(null);
        selectRelation(null);
      }
      if (mode === "story" && event.key === "ArrowRight") setChapterIndex(Math.min(storyChapters.length - 1, chapterIndex + 1));
      if (mode === "story" && event.key === "ArrowLeft") setChapterIndex(Math.max(0, chapterIndex - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chapterIndex, mode, selectRelation, selectThinker, setChapterIndex, setListViewOpen, setSearchOpen]);

  const changeMode = (nextMode: AtlasMode) => {
    setMode(nextMode);
    setPlaying(nextMode === "story");
    if (nextMode === "story") {
      setChapterIndex(0);
      window.history.replaceState({}, "", "/story/world-asks");
    } else {
      window.history.replaceState({}, "", "/explore");
    }
  };

  const showCompare = displayCompareIds.length === 2 && !displaySelectedThinkerId && !displaySelectedRelationId;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`atlas-shell atlas-shell--${displayMode}`}>
        <a className="skip-link" href="#atlas-content">跳到思想内容</a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="思想星图首页">
            <span className="brand__seal">I</span>
            <span><strong>思想星图</strong><small>ATLAS OF IDEAS</small></span>
          </Link>
          <p className="site-header__prompt">人类在不同地方，如何回答相同的问题？</p>
          <div className="header-actions">
            <button className="search-button" type="button" onClick={() => setSearchOpen(true)}>
              <span>搜索</span><kbd>/</kbd>
            </button>
            <button className="text-view-button" type="button" onClick={() => setListViewOpen(true)}>文字探索</button>
            <div className="mode-switch" aria-label="浏览模式">
              <button type="button" className={displayMode === "story" ? "is-active" : ""} onClick={() => changeMode("story")}>故事</button>
              <button type="button" className={displayMode === "explore" ? "is-active" : ""} onClick={() => changeMode("explore")}>探索</button>
            </div>
          </div>
        </header>

        <main id="atlas-content" className="atlas-main">
          <section className="globe-stage" aria-label="思想星图3D地球">
            <div className="globe-stage__topline">
              <span>VERTICAL SLICE · 08 NODES</span>
              <span>WEBGL2 · EVIDENCE LED</span>
            </div>
            <div className="globe-canvas-wrap">
              <GlobeCanvas
                mode={displayMode}
                isPlaying={isPlaying}
                chapterIndex={displayChapterIndex}
                selectedThinkerId={displaySelectedThinkerId}
                selectedRelationId={displaySelectedRelationId}
                activeQuestionId={activeQuestionId}
                timelineYear={timelineYear}
                quality={quality}
                reduceMotion={reduceMotion}
                onSelectThinker={selectThinker}
                onSelectRelation={selectRelation}
                onFallback={() => setListViewOpen(true)}
              />
            </div>
            <div className="globe-vignette" aria-hidden="true" />
            <QualityBadge quality={quality} onChange={setQuality} />
            {displayMode === "story" ? <StoryOverlay chapterIndex={displayChapterIndex} isPlaying={isPlaying} /> : (
              <QuestionRail activeQuestionId={activeQuestionId} onSelect={setQuestion} />
            )}
            <RelationLegend onSelect={selectRelation} />
            <div className="globe-instruction">
              <span>{displayMode === "story" && isPlaying ? "镜头正在讲述" : "拖动旋转 · 滚轮缩放 · 点击节点"}</span>
            </div>
          </section>

          <aside className={`detail-pane${displaySelectedThinkerId || displaySelectedRelationId || showCompare ? " detail-pane--active" : ""}`}>
            <div className="detail-pane__rail"><span>ARCHIVE</span><i /></div>
            <AnimatePresence mode="wait">
              {displaySelectedThinkerId ? <ThinkerDetail thinkerId={displaySelectedThinkerId} />
                : displaySelectedRelationId ? <RelationDetail relationId={displaySelectedRelationId} />
                  : showCompare ? <CompareDetail ids={displayCompareIds} />
                    : <EmptyDetail onSelectRelation={selectRelation} />}
            </AnimatePresence>
          </aside>
        </main>

        <BottomDock mode={displayMode} />
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={selectThinker} />
        <SemanticExplorer open={listViewOpen} onClose={() => setListViewOpen(false)} onSelect={selectThinker} />
      </div>
    </MotionConfig>
  );
}
