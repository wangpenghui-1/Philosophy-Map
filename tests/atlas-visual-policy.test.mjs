import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  ATLAS_INTRO_DURATION_MS,
  QUESTION_CAMERA_SETTLE_MS,
  advanceAutoQuality,
  detailSheetSnapFromProgress,
  getFocusedThinkerIds,
  getRenderPixelRatio,
  getWebglRetryDelayMs,
  initialAutoQuality,
  isWindowsEdgeUserAgent,
  parsePersistedVisualState,
  percentile,
  shouldDirectGlobeCamera,
  timelineDensity,
} from "../app/_components/atlas-visual-policy.ts";
import { createElevatedArcPoints, GLOBE_RADIUS } from "../app/_components/globe-visual-geometry.ts";

test("auto quality starts conservatively and changes only after sustained evidence", () => {
  assert.equal(initialAutoQuality(390, true), "low");
  assert.equal(initialAutoQuality(1440, false), "medium");
  let state = { quality: "medium", aboveBudgetSince: null, belowBudgetSince: null, lastChangeAt: -20_000 };
  state = advanceAutoQuality(state, 28, 0);
  assert.equal(state.quality, "medium");
  state = advanceAutoQuality(state, 28, 2_100);
  assert.equal(state.quality, "low");
  state = advanceAutoQuality(state, 12, 12_200);
  state = advanceAutoQuality(state, 12, 18_300);
  assert.equal(state.quality, "medium");
});

test("render DPR stays inside a pixel budget while preserving high-detail assets", () => {
  assert.equal(getRenderPixelRatio(1440, 900, 2, "high"), 1.5);
  assert.equal(getRenderPixelRatio(1920, 1080, 2, "high"), 1.39);
  assert.equal(getRenderPixelRatio(3840, 2160, 2, "high"), 0.69);
  assert.equal(getRenderPixelRatio(1440, 900, 2, "high", true), 1.15);
  assert.equal(getRenderPixelRatio(1440, 900, 1, "high"), 1);
  assert.equal(getRenderPixelRatio(1920, 1080, 2, "high", false, true), 1.16);
});

test("Windows Edge receives a conservative GPU profile and increasing retry delays", () => {
  assert.equal(isWindowsEdgeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/140.0"), true);
  assert.equal(isWindowsEdgeUserAgent("Mozilla/5.0 (Macintosh) Edg/140.0"), false);
  assert.equal(isWindowsEdgeUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/140.0"), false);
  assert.deepEqual([1, 2, 3, 4].map((count) => getWebglRetryDelayMs(count, true)), [1_500, 3_000, 6_000, 6_000]);
});

test("visual policy helpers remain deterministic", () => {
  assert.equal(percentile([10, 30, 20, 40], 0.75), 30);
  assert.equal(detailSheetSnapFromProgress(0.1), "peek");
  assert.equal(detailSheetSnapFromProgress(0.5), "half");
  assert.equal(detailSheetSnapFromProgress(0.9), "full");
  assert.deepEqual(timelineDensity([-600, 0, 1000, 2026], -600, 2026, 4), [1, 0, 0.5, 0.5]);
});

test("atlas motion timings match the first-screen interaction specification", () => {
  assert.deepEqual(ATLAS_INTRO_DURATION_MS, { full: 1_800, quick: 800, reduced: 120 });
  assert.equal(QUESTION_CAMERA_SETTLE_MS, 900);
});

test("exploration camera only directs toward an explicit selection", () => {
  assert.equal(shouldDirectGlobeCamera("explore", null, null), false);
  assert.equal(shouldDirectGlobeCamera("explore", null, null, true), true);
  assert.equal(shouldDirectGlobeCamera("explore", "confucius", null), true);
  assert.equal(shouldDirectGlobeCamera("explore", null, "confucius-laozi"), true);
  assert.equal(shouldDirectGlobeCamera("story", null, null), true);
});

test("focus depth includes the selected thinker and deterministic graph hops", () => {
  const relations = [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "c", to: "d" },
  ];
  assert.deepEqual([...getFocusedThinkerIds("a", 1, relations)], ["a", "b"]);
  assert.deepEqual([...getFocusedThinkerIds("a", 2, relations)], ["a", "b", "c"]);
  assert.equal(getFocusedThinkerIds("a", "all", relations), null);
});

test("v2 visual state keeps only safe display preferences", () => {
  const parsed = parsePersistedVisualState(JSON.stringify({
    version: 2,
    entrySeen: true,
    earthMode: "night",
    qualityPreference: "auto",
    soundEnabled: false,
  }));
  assert.deepEqual(parsed, {
    version: 2,
    entrySeen: true,
    earthMode: "night",
    qualityPreference: "auto",
    soundEnabled: false,
  });
  assert.equal(parsePersistedVisualState("{}"), null);
});

test("v1 migration preserves display preferences and discards selections", () => {
  const migrated = parsePersistedVisualState(null, JSON.stringify({
    version: 1,
    entrySeen: true,
    mode: "explore",
    timelineYear: 1000,
    questionId: "freedom",
    thinkerSlug: "kant",
    relationId: "hume-kant",
    earthMode: "day",
    qualityPreference: "high",
    camera: { position: [0, 1, 6], target: [0, 0, 0], distance: 6.08 },
  }));
  assert.deepEqual(migrated, {
    version: 2,
    entrySeen: true,
    earthMode: "day",
    qualityPreference: "high",
    soundEnabled: false,
  });
});

test("elevated relation arcs never enter the globe", () => {
  const start = new THREE.Vector3(2, 0, 0);
  const end = new THREE.Vector3(0, 2, 0);
  const points = createElevatedArcPoints(start, end, 64);
  assert.equal(points.length, 65);
  assert.ok(points.every((point) => point.length() > GLOBE_RADIUS + 0.04));
});
