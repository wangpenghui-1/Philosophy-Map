import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  advanceAutoQuality,
  detailSheetSnapFromProgress,
  getFocusedThinkerIds,
  initialAutoQuality,
  parsePersistedVisualState,
  percentile,
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

test("visual policy helpers remain deterministic", () => {
  assert.equal(percentile([10, 30, 20, 40], 0.75), 30);
  assert.equal(detailSheetSnapFromProgress(0.1), "peek");
  assert.equal(detailSheetSnapFromProgress(0.5), "half");
  assert.equal(detailSheetSnapFromProgress(0.9), "full");
  assert.deepEqual(timelineDensity([-600, 0, 1000, 2026], -600, 2026, 4), [1, 0, 0.5, 0.5]);
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

test("persisted visual state validates ids, ranges, preferences, and camera", () => {
  const parsed = parsePersistedVisualState(JSON.stringify({
    version: 1,
    entrySeen: true,
    mode: "explore",
    timelineYear: 1000,
    questionId: "freedom",
    thinkerSlug: "kant",
    relationId: "hume-kant",
    earthMode: "night",
    qualityPreference: "auto",
    camera: { position: [0, 1, 6], target: [0, 0, 0], distance: 6.08 },
  }), {
    isQuestionId: (value) => value === "freedom",
    isThinkerSlug: (value) => value === "kant",
    isRelationId: (value) => value === "hume-kant",
    minYear: -600,
    maxYear: 2026,
  });
  assert.equal(parsed?.thinkerSlug, "kant");
  assert.equal(parsed?.camera?.distance, 6.08);
  assert.equal(parsePersistedVisualState("{}", {
    isQuestionId: () => false,
    isThinkerSlug: () => false,
    isRelationId: () => false,
    minYear: -600,
    maxYear: 2026,
  }), null);
});

test("elevated relation arcs never enter the globe", () => {
  const start = new THREE.Vector3(2, 0, 0);
  const end = new THREE.Vector3(0, 2, 0);
  const points = createElevatedArcPoints(start, end, 64);
  assert.equal(points.length, 65);
  assert.ok(points.every((point) => point.length() > GLOBE_RADIUS + 0.04));
});
