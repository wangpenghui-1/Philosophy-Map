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
  soundEnabled?: boolean;
}

export interface AtlasPersistedVisualStateV2 {
  version: 2;
  entrySeen: boolean;
  earthMode: "day" | "night";
  qualityPreference: QualityPreference;
  soundEnabled: boolean;
}

export interface AutoQualityState {
  quality: EffectiveQuality;
  aboveBudgetSince: number | null;
  belowBudgetSince: number | null;
  lastChangeAt: number;
}

export const ATLAS_VISUAL_STORAGE_KEY = "atlas-visual-state:v2";
export const ATLAS_VISUAL_LEGACY_STORAGE_KEY = "atlas-visual-state:v1";
export const AUTO_QUALITY_COOLDOWN_MS = 10_000;
export const AUTO_QUALITY_DOWNGRADE_MS = 2_000;
export const AUTO_QUALITY_UPGRADE_MS = 6_000;

const RENDER_PIXEL_BUDGET: Record<EffectiveQuality, number> = {
  low: 1_500_000,
  medium: 2_600_000,
  high: 4_000_000,
};

const RENDER_DPR_CAP: Record<EffectiveQuality, number> = {
  low: 1,
  medium: 1.2,
  high: 1.5,
};

export const GLOBE_HIGH_QUALITY_WARMUP_MS = 3_500;
export const GLOBE_NATIVE_CONTEXT_RESTORE_MS = 4_000;
export const ATLAS_INTRO_DURATION_MS = {
  full: 1_800,
  quick: 800,
  reduced: 120,
} as const;
export const QUESTION_CAMERA_SETTLE_MS = 900;

const QUALITY_ORDER: EffectiveQuality[] = ["low", "medium", "high"];
const DETAIL_SHEET_ORDER: DetailSheetSnap[] = ["peek", "half", "full"];

export function initialAutoQuality(width: number, coarsePointer: boolean): EffectiveQuality {
  return width <= 820 || coarsePointer ? "low" : "medium";
}

export function isWindowsEdgeUserAgent(userAgent: string) {
  return /Windows/i.test(userAgent) && /Edg\//i.test(userAgent);
}

export function getWebglRetryDelayMs(retryCount: number, windowsEdge: boolean) {
  const delays = windowsEdge ? [1_500, 3_000, 6_000] : [800, 1_500, 3_000];
  return delays[Math.min(Math.max(0, retryCount - 1), delays.length - 1)];
}

/**
 * Keeps the render target inside a predictable GPU pixel budget. Large and
 * high-DPI Windows displays retain the 2K earth assets and geometry detail,
 * while avoiding an oversized framebuffer that can exhaust ANGLE/D3D memory.
 */
export function getRenderPixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
  quality: EffectiveQuality,
  warmingUp = false,
  conservativeGpu = false,
) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const nativeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  let budget = warmingUp
    ? Math.min(RENDER_PIXEL_BUDGET[quality], RENDER_PIXEL_BUDGET.medium)
    : RENDER_PIXEL_BUDGET[quality];
  let cap = warmingUp
    ? Math.min(RENDER_DPR_CAP[quality], 1.15)
    : RENDER_DPR_CAP[quality];
  if (conservativeGpu) {
    budget = Math.min(budget, 2_800_000);
    cap = Math.min(cap, 1.25);
  }
  const budgetDpr = Math.sqrt(budget / (safeWidth * safeHeight));
  const dpr = Math.min(nativeDpr, cap, Math.max(0.65, budgetDpr));
  return Math.round(dpr * 100) / 100;
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

export function shouldDirectGlobeCamera(
  mode: AtlasMode,
  selectedThinkerId: string | null,
  selectedRelationId: string | null,
  hasQuestionFocus = false,
) {
  return mode === "story" || hasQuestionFocus || Boolean(selectedThinkerId || selectedRelationId);
}

export function parsePersistedVisualState(
  raw: string | null,
  legacyRaw: string | null = null,
): AtlasPersistedVisualStateV2 | null {
  const parse = (source: string | null): Record<string, unknown> | null => {
    if (!source) return null;
    try {
      const value = JSON.parse(source) as unknown;
      return value && typeof value === "object" ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  };
  const current = parse(raw);
  const legacy = parse(legacyRaw);
  const value = current?.version === 2 ? current : legacy?.version === 1 ? legacy : null;
  if (!value || typeof value.entrySeen !== "boolean") return null;
  const qualityPreference = value.qualityPreference === "auto"
    || value.qualityPreference === "high"
    || value.qualityPreference === "medium"
    || value.qualityPreference === "low"
    ? value.qualityPreference
    : "auto";
  return {
    version: 2,
    entrySeen: value.entrySeen,
    earthMode: value.earthMode === "day" ? "day" : "night",
    qualityPreference,
    soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : false,
  };
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
