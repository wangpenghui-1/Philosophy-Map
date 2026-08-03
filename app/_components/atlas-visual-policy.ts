import type { AtlasMode, QualityTier } from "../_state/atlas-store";
import type { QuestionId } from "../_data/atlas";

export type QualityPreference = "auto" | QualityTier;
export type EffectiveQuality = QualityTier;
export type FocusDepth = 1 | 2 | "all";
export type DetailSheetSnap = "peek" | "half" | "full";

export interface GlobeCameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
}

export interface AtlasPersistedVisualStateV1 {
  version: 1;
  entrySeen: boolean;
  mode: AtlasMode;
  timelineYear: number;
  questionId: QuestionId | null;
  thinkerSlug: string | null;
  relationId: string | null;
  earthMode: "day" | "night";
  qualityPreference: QualityPreference;
  camera: GlobeCameraSnapshot | null;
}

export interface PersistedStateValidators {
  isQuestionId: (value: string) => value is QuestionId;
  isThinkerSlug: (value: string) => boolean;
  isRelationId: (value: string) => boolean;
  minYear: number;
  maxYear: number;
}

export interface AutoQualityState {
  quality: EffectiveQuality;
  aboveBudgetSince: number | null;
  belowBudgetSince: number | null;
  lastChangeAt: number;
}

export const ATLAS_VISUAL_STORAGE_KEY = "atlas-visual-state:v1";
export const AUTO_QUALITY_COOLDOWN_MS = 10_000;
export const AUTO_QUALITY_DOWNGRADE_MS = 2_000;
export const AUTO_QUALITY_UPGRADE_MS = 6_000;

const QUALITY_ORDER: EffectiveQuality[] = ["low", "medium", "high"];
const DETAIL_SHEET_ORDER: DetailSheetSnap[] = ["peek", "half", "full"];

export function initialAutoQuality(width: number, coarsePointer: boolean): EffectiveQuality {
  return width <= 820 || coarsePointer ? "low" : "medium";
}

function moveQuality(quality: EffectiveQuality, direction: -1 | 1) {
  const index = QUALITY_ORDER.indexOf(quality);
  return QUALITY_ORDER[Math.max(0, Math.min(QUALITY_ORDER.length - 1, index + direction))];
}

export function advanceAutoQuality(
  state: AutoQualityState,
  p75FrameMs: number,
  now: number,
): AutoQualityState {
  if (!Number.isFinite(p75FrameMs) || p75FrameMs <= 0) return state;
  const coolingDown = now - state.lastChangeAt < AUTO_QUALITY_COOLDOWN_MS;
  const aboveBudgetSince = p75FrameMs > 24
    ? state.aboveBudgetSince ?? now
    : null;
  const belowBudgetSince = p75FrameMs < 16
    ? state.belowBudgetSince ?? now
    : null;

  if (!coolingDown
    && aboveBudgetSince !== null
    && now - aboveBudgetSince >= AUTO_QUALITY_DOWNGRADE_MS
    && state.quality !== "low") {
    return {
      quality: moveQuality(state.quality, -1),
      aboveBudgetSince: null,
      belowBudgetSince: null,
      lastChangeAt: now,
    };
  }
  if (!coolingDown
    && belowBudgetSince !== null
    && now - belowBudgetSince >= AUTO_QUALITY_UPGRADE_MS
    && state.quality !== "high") {
    return {
      quality: moveQuality(state.quality, 1),
      aboveBudgetSince: null,
      belowBudgetSince: null,
      lastChangeAt: now,
    };
  }
  return { ...state, aboveBudgetSince, belowBudgetSince };
}

export function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index];
}

export function parsePersistedVisualState(
  raw: string | null,
  validators: PersistedStateValidators,
): AtlasPersistedVisualStateV1 | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<AtlasPersistedVisualStateV1>;
    if (value.version !== 1 || typeof value.entrySeen !== "boolean") return null;
    if (value.mode !== "story" && value.mode !== "explore") return null;
    if (!Number.isFinite(value.timelineYear)
      || Number(value.timelineYear) < validators.minYear
      || Number(value.timelineYear) > validators.maxYear) return null;
    const questionId = typeof value.questionId === "string" && validators.isQuestionId(value.questionId)
      ? value.questionId
      : null;
    const thinkerSlug = typeof value.thinkerSlug === "string" && validators.isThinkerSlug(value.thinkerSlug)
      ? value.thinkerSlug
      : null;
    const relationId = typeof value.relationId === "string" && validators.isRelationId(value.relationId)
      ? value.relationId
      : null;
    const qualityPreference = value.qualityPreference === "auto"
      || value.qualityPreference === "high"
      || value.qualityPreference === "medium"
      || value.qualityPreference === "low"
      ? value.qualityPreference
      : "auto";
    const earthMode = value.earthMode === "day" ? "day" : "night";
    const camera = isCameraSnapshot(value.camera) ? value.camera : null;
    return {
      version: 1,
      entrySeen: value.entrySeen,
      mode: value.mode,
      timelineYear: Number(value.timelineYear),
      questionId,
      thinkerSlug,
      relationId,
      earthMode,
      qualityPreference,
      camera,
    };
  } catch {
    return null;
  }
}

function isVector3Tuple(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function isCameraSnapshot(value: unknown): value is GlobeCameraSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GlobeCameraSnapshot>;
  return isVector3Tuple(candidate.position)
    && isVector3Tuple(candidate.target)
    && typeof candidate.distance === "number"
    && Number.isFinite(candidate.distance)
    && candidate.distance >= 2.5
    && candidate.distance <= 9;
}

export function detailSheetSnapFromProgress(progress: number): DetailSheetSnap {
  if (progress < 0.34) return DETAIL_SHEET_ORDER[0];
  if (progress < 0.74) return DETAIL_SHEET_ORDER[1];
  return DETAIL_SHEET_ORDER[2];
}

export function getFocusedThinkerIds(
  selectedThinkerId: string | null,
  depth: FocusDepth,
  relations: Array<{ from: string; to: string }>,
) {
  if (!selectedThinkerId || depth === "all") return null;
  const focused = new Set([selectedThinkerId]);
  const firstHop = new Set<string>();
  for (const relation of relations) {
    if (relation.from === selectedThinkerId) firstHop.add(relation.to);
    if (relation.to === selectedThinkerId) firstHop.add(relation.from);
  }
  for (const id of firstHop) focused.add(id);
  if (depth === 2) {
    for (const relation of relations) {
      if (firstHop.has(relation.from)) focused.add(relation.to);
      if (firstHop.has(relation.to)) focused.add(relation.from);
    }
  }
  return focused;
}

export function timelineDensity(
  years: number[],
  minYear: number,
  maxYear: number,
  bins = 48,
) {
  const output = Array.from({ length: bins }, () => 0);
  const range = Math.max(1, maxYear - minYear);
  for (const year of years) {
    const progress = Math.max(0, Math.min(0.999999, (year - minYear) / range));
    output[Math.floor(progress * bins)] += 1;
  }
  const peak = Math.max(1, ...output);
  return output.map((count) => count / peak);
}
