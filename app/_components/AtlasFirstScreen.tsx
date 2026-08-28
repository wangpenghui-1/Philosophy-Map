"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { relationTypeLabels, type QuestionId, type RelationType } from "../_data/atlas";
import {
  featuredQuestionPresentations,
  questionPresentationById,
  questionPresentations,
  relationTypeOrder,
  type QuestionPresentation,
} from "../_data/question-presentations";

export type IntroSequence = "full" | "quick" | "reduced" | "none";

export function AtlasHeader({
  onSearch,
  onTextExplorer,
  settings,
}: {
  onSearch: () => void;
  onTextExplorer: () => void;
  settings: ReactNode;
}) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="思想星图首页">
        <span className="brand__seal">I</span>
        <span><strong>思想星图</strong><small>ATLAS OF IDEAS</small></span>
      </Link>
      <p className="site-header__prompt">从问题进入思想史</p>
      <div className="header-actions">
        <button className="search-button" type="button" aria-label="搜索思想星图" onClick={onSearch}>
          <span>搜索</span><kbd>/</kbd>
        </button>
        <Link className="knowledge-button" href="/knowledge">知识库</Link>
        <details className="more-menu">
          <summary>更多</summary>
          <nav className="more-menu__panel" aria-label="更多探索入口">
            <button type="button" onClick={onTextExplorer}>文字探索</button>
            <Link href="/journeys">全部思想旅程</Link>
            <Link href="/chat">AI 对话</Link>
            <Link href="/account">账户</Link>
            {settings}
          </nav>
        </details>
      </div>
    </header>
  );
}

function QuestionArtwork({
  presentation,
  reducedMotion,
}: {
  presentation: QuestionPresentation;
  reducedMotion: boolean;
}) {
  const moveArtwork = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 12;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 12;
    event.currentTarget.style.setProperty("--art-x", `${x.toFixed(2)}px`);
    event.currentTarget.style.setProperty("--art-y", `${y.toFixed(2)}px`);
  };
  const resetArtwork = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--art-x", "0px");
    event.currentTarget.style.setProperty("--art-y", "0px");
  };

  return (
    <div
      className="question-card__art"
      aria-hidden="true"
      onPointerMove={moveArtwork}
      onPointerLeave={resetArtwork}
    >
      <Image
        src={presentation.artwork.avif1280}
        alt=""
        fill
        sizes="(max-width: 820px) 78vw, 260px"
        preload={presentation.featuredOrder === 1}
      />
      <span className="question-card__art-glow" />
    </div>
  );
}

function QuestionCard({
  presentation,
  active,
  reducedMotion,
  onSelect,
  onPreview,
}: {
  presentation: QuestionPresentation;
  active: boolean;
  reducedMotion: boolean;
  onSelect: (questionId: QuestionId) => void;
  onPreview: (questionId: QuestionId | null) => void;
}) {
  return (
    <button
      type="button"
      className={`question-card${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-label={`${presentation.title}：${presentation.subtitle}`}
      style={{
        "--question-accent": presentation.theme.accent,
        "--question-glow": presentation.theme.glow,
      } as CSSProperties}
      onClick={() => onSelect(presentation.questionId)}
      onPointerEnter={() => onPreview(presentation.questionId)}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => onPreview(presentation.questionId)}
      onBlur={() => onPreview(null)}
    >
      <QuestionArtwork presentation={presentation} reducedMotion={reducedMotion} />
      <span className="question-card__copy">
        <small>{presentation.subtitle}</small>
        <strong>{presentation.title}</strong>
        <i aria-hidden="true">进入 →</i>
      </span>
    </button>
  );
}

export function QuestionDock({
  activeQuestionId,
  reducedMotion,
  onSelect,
  onPreview,
}: {
  activeQuestionId: QuestionId | null;
  reducedMotion: boolean;
  onSelect: (questionId: QuestionId) => void;
  onPreview: (questionId: QuestionId | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const activePresentation = activeQuestionId
    ? questionPresentationById.get(activeQuestionId) ?? null
    : null;
  const visiblePresentations = activePresentation && !expanded
    ? [activePresentation]
    : expanded
      ? questionPresentations
      : featuredQuestionPresentations;

  return (
    <aside
      className={`question-dock${expanded ? " is-expanded" : ""}${activePresentation ? " has-active-question" : ""}`}
      aria-label="从哲学问题开始探索"
    >
      <div className="question-dock__heading">
        <div>
          <small>从问题进入思想史</small>
          <h1>{activePresentation ? activePresentation.title : "你想先追问什么？"}</h1>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起" : activePresentation ? "换个问题" : "全部问题"}
        </button>
      </div>
      <div className="question-dock__cards" data-count={visiblePresentations.length}>
        {visiblePresentations.map((presentation) => (
          <QuestionCard
            key={presentation.questionId}
            presentation={presentation}
            active={activeQuestionId === presentation.questionId}
            reducedMotion={reducedMotion}
            onSelect={(questionId) => {
              setExpanded(false);
              onSelect(questionId);
            }}
            onPreview={onPreview}
          />
        ))}
        {activePresentation && !expanded ? (
          <button className="question-dock__change" type="button" onClick={() => setExpanded(true)}>
            <span aria-hidden="true">＋</span>
            <strong>选择另一个问题</strong>
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export function RelationFilter({
  visibleTypes,
  onToggle,
}: {
  visibleTypes: RelationType[];
  onToggle: (type: RelationType) => void;
}) {
  return (
    <details className="relation-filter">
      <summary>关系 <span>{visibleTypes.length}/{relationTypeOrder.length}</span></summary>
      <div className="relation-filter__panel" role="group" aria-label="显示或隐藏关系类型">
        {relationTypeOrder.map((type) => (
          <button
            type="button"
            key={type}
            className={`relation-filter__${type}`}
            aria-pressed={visibleTypes.includes(type)}
            onClick={() => onToggle(type)}
          >
            <i aria-hidden="true" />
            <span>{relationTypeLabels[type]}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

export function AtlasIntro({
  sequence,
  onComplete,
}: {
  sequence: IntroSequence;
  onComplete: () => void;
}) {
  if (sequence === "none") return null;
  return (
    <div
      className={`atlas-intro atlas-intro--${sequence}`}
      data-intro-sequence={sequence}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.currentTarget === event.target) onComplete();
      }}
    >
      <span className="atlas-intro__halo" />
      <span className="atlas-intro__seal">I</span>
      <span className="atlas-intro__line" />
    </div>
  );
}
