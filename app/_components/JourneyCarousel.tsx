"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  emitJourneyEvent,
  formatJourneyDuration,
  journeyCatalog,
  type JourneyDefinition,
} from "../_data/journeys";

const WHEEL_LOCK_MS = 380;
const SWIPE_THRESHOLD_PX = 42;

type JourneyCardStyle = CSSProperties & {
  "--journey-x": string;
  "--journey-y": string;
  "--journey-scale": string;
  "--journey-rotate": string;
  "--journey-opacity": string;
  "--journey-z": string;
};

function circularOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
}

function styleForOffset(offset: number): JourneyCardStyle {
  const distance = Math.abs(offset);
  const direction = Math.sign(offset);
  const x = distance === 0 ? 0 : distance === 1 ? direction * 64 : direction * 112;
  const scale = distance === 0 ? 1 : distance === 1 ? 0.88 : 0.74;
  return {
    "--journey-x": `${x}%`,
    "--journey-y": `${distance * 13}px`,
    "--journey-scale": String(scale),
    "--journey-rotate": `${direction * -4.5}deg`,
    "--journey-opacity": distance === 0 ? "1" : distance === 1 ? ".72" : ".34",
    "--journey-z": String(20 - distance),
  };
}

function journeyKind(journey: JourneyDefinition) {
  if (journey.recommended) return "推荐起点";
  return journey.category === "philosophical-question" ? "哲学问题" : "思想传统";
}

export default function JourneyCarousel({
  onStart,
  onSkip,
}: {
  onStart: (journeyId: string) => void;
  onSkip: () => void;
}) {
  const journeys = useMemo(
    () => journeyCatalog.filter((journey) => journey.availability === "available"),
    [],
  );
  const recommendedIndex = Math.max(0, journeys.findIndex((journey) => journey.recommended));
  const [activeIndex, setActiveIndex] = useState(recommendedIndex);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const activeIndexRef = useRef(recommendedIndex);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wheelLockedUntilRef = useRef(0);
  const pointerStartXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pressedCardRef = useRef<{ id: string; wasActive: boolean } | null>(null);

  useEffect(() => () => {
    const context = audioContextRef.current;
    if (context && context.state !== "closed") void context.close();
  }, []);

  const playSwitchSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;

    const schedule = () => {
      const now = context.currentTime;
      [
        { delay: 0, frequency: 1_250, volume: 0.026 },
        { delay: 0.052, frequency: 760, volume: 0.02 },
      ].forEach(({ delay, frequency, volume }) => {
        const duration = 0.032;
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let index = 0; index < samples.length; index += 1) {
          samples[index] = (Math.random() * 2 - 1) * Math.exp(-index / (context.sampleRate * 0.0045));
        }
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        const startAt = now + delay;
        filter.type = "bandpass";
        filter.frequency.value = frequency;
        filter.Q.value = 1.8;
        gain.gain.setValueAtTime(volume, startAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start(startAt);
        source.stop(startAt + duration);
      });
    };

    if (context.state === "suspended") void context.resume().then(schedule);
    else schedule();
  }, [soundEnabled]);

  const selectIndex = useCallback((targetIndex: number, source: string) => {
    if (!journeys.length) return;
    const nextIndex = (targetIndex + journeys.length) % journeys.length;
    if (nextIndex === activeIndexRef.current) return;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    playSwitchSound();
    emitJourneyEvent("preview", { journeyId: journeys[nextIndex].id, source });
  }, [journeys, playSwitchSound]);

  const step = useCallback((direction: -1 | 1, source: string) => {
    selectIndex(activeIndexRef.current + direction, source);
  }, [selectIndex]);

  const activeJourney = journeys[activeIndex];
  if (!activeJourney) return null;

  return (
    <motion.section
      className="journey-entry"
      initial={{ opacity: 0, scale: 0.975, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, y: -10 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="journey-entry-title"
    >
      <button className="journey-entry__skip" type="button" onClick={onSkip}>跳过，进入地图</button>
      <header className="journey-entry__header">
        <small>ATLAS OF IDEAS · GUIDED JOURNEYS</small>
        <h1 id="journey-entry-title">开启一次思想旅程</h1>
        <p>左右滑动，选择一个问题或一条思想传统，看看几千年来的人们如何理解世界与自身。</p>
      </header>

      <div className="journey-deck__toolbar">
        <span aria-live="polite">{journeyKind(activeJourney)} · {activeIndex + 1}/{journeys.length}</span>
        <button
          type="button"
          className="journey-deck__sound"
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "关闭卡片切换音效" : "开启卡片切换音效"}
          onClick={() => setSoundEnabled((enabled) => !enabled)}
        >
          <i aria-hidden="true">{soundEnabled ? "◖))" : "◖×"}</i>
          {soundEnabled ? "音效开" : "音效关"}
        </button>
      </div>

      <div
        className="journey-deck"
        role="region"
        aria-roledescription="轮播"
        aria-label="思想旅程主题"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1, "keyboard");
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1, "keyboard");
          }
          if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
            event.preventDefault();
            onStart(activeJourney.id);
          }
        }}
        onWheel={(event) => {
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
          if (Math.abs(delta) < 8) return;
          event.preventDefault();
          const now = performance.now();
          if (now < wheelLockedUntilRef.current) return;
          wheelLockedUntilRef.current = now + WHEEL_LOCK_MS;
          step(delta > 0 ? 1 : -1, "wheel");
        }}
        onPointerDown={(event) => {
          suppressClickRef.current = false;
          pointerStartXRef.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStartXRef.current === null) return;
          const offset = event.clientX - pointerStartXRef.current;
          pointerStartXRef.current = null;
          if (Math.abs(offset) >= SWIPE_THRESHOLD_PX) {
            suppressClickRef.current = true;
            step(offset < 0 ? 1 : -1, "swipe");
          }
        }}
        onPointerCancel={() => { pointerStartXRef.current = null; }}
      >
        {journeys.map((journey, index) => {
          const offset = circularOffset(index, activeIndex, journeys.length);
          const distance = Math.abs(offset);
          const isActive = offset === 0;
          const isVisible = distance <= 2;
          return (
            <button
              key={journey.id}
              type="button"
              className={`journey-deck-card${isActive ? " is-active" : ""}${journey.recommended ? " is-recommended" : ""}`}
              style={styleForOffset(offset)}
              data-offset={offset}
              aria-current={isActive ? "true" : undefined}
              aria-hidden={!isVisible}
              tabIndex={isVisible ? 0 : -1}
              onPointerDown={() => {
                pressedCardRef.current = { id: journey.id, wasActive: isActive };
              }}
              onFocus={() => {
                // Pointer presses move focus before the eventual click/swipe.
                // Let that gesture finish so one physical action cannot advance
                // the deck twice; keyboard focus should still reveal the card.
                if (pointerStartXRef.current === null && !isActive) selectIndex(index, "focus");
              }}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  pressedCardRef.current = null;
                  return;
                }
                const pointerPress = pressedCardRef.current?.id === journey.id
                  ? pressedCardRef.current
                  : null;
                pressedCardRef.current = null;
                const shouldStart = event.detail === 0 ? isActive : pointerPress?.wasActive === true;
                if (shouldStart) onStart(journey.id);
                else selectIndex(index, "card");
              }}
            >
              <span className="journey-card__meta">
                <i>{journeyKind(journey)}</i>
                <b>{formatJourneyDuration(journey.estimatedDurationMs)}</b>
              </span>
              <strong>{journey.title}</strong>
              <small>{journey.question}</small>
              <em id={`journey-card-${journey.id}`}>{journey.description}</em>
              <span>{isActive ? "开始旅程" : "移到中央"} <i aria-hidden="true">→</i></span>
            </button>
          );
        })}
      </div>

      <div className="journey-deck__controls">
        <button type="button" aria-label="上一个思想旅程" onClick={() => step(-1, "arrow")}>←</button>
        <div role="group" aria-label="选择思想旅程">
          {journeys.map((journey, index) => (
            <button
              type="button"
              key={journey.id}
              className={index === activeIndex ? "is-active" : ""}
              aria-label={`查看${journey.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => selectIndex(index, "indicator")}
            />
          ))}
        </div>
        <button type="button" aria-label="下一个思想旅程" onClick={() => step(1, "arrow")}>→</button>
      </div>
      <p className="journey-entry__hint">滑动、滚轮或方向键切换 · 点击中央卡片开始旅程</p>
    </motion.section>
  );
}
