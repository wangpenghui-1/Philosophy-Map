import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getGlobeAnchorMountIds,
  getGlobeMarkerExclusionRects,
  layoutGlobeMarkers,
} from "../app/_components/globe-marker-layout.ts";

const viewport = { width: 960, height: 640 };

function marker(id, x, y, overrides = {}) {
  return {
    id,
    x,
    y,
    name: id,
    priority: 1,
    clusterKey: null,
    frontFacing: true,
    ...overrides,
  };
}

function overlaps(left, right) {
  return !(left.right <= right.left
    || left.left >= right.right
    || left.bottom <= right.top
    || left.top >= right.bottom);
}

function byId(layout) {
  return new Map(layout.map((item) => [item.id, item]));
}

test("visible portrait/name markers have non-overlapping screen-space bounds", () => {
  const candidates = Array.from({ length: 18 }, (_, index) => marker(
    `thinker-${String(index).padStart(2, "0")}`,
    390 + (index % 6) * 24,
    250 + Math.floor(index / 6) * 24,
    { priority: 30 - index },
  ));
  const visible = layoutGlobeMarkers(candidates, viewport, 3.35)
    .filter((item) => item.visible);

  assert.ok(visible.length > 2, "expected collision search to retain several markers");
  for (let leftIndex = 0; leftIndex < visible.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < visible.length; rightIndex += 1) {
      assert.equal(
        overlaps(visible[leftIndex].bounds, visible[rightIndex].bounds),
        false,
        `${visible[leftIndex].id} overlaps ${visible[rightIndex].id}`,
      );
    }
  }
});

test("selected marker wins a collision even when its numeric priority is lower", () => {
  const candidates = [
    marker("high-priority", 480, 320, { priority: 100 }),
    marker("selected", 480, 320, { priority: -100, selected: true }),
  ];
  const layout = byId(layoutGlobeMarkers(candidates, viewport, 7.7));

  assert.equal(layout.get("selected").visible, true);
  assert.equal(layout.get("high-priority").visible, false);
  assert.ok(layout.get("selected").scale > layout.get("high-priority").scale);
});

test("far LOD applies a deterministic density budget lower than near LOD", () => {
  const candidates = Array.from({ length: 48 }, (_, index) => marker(
    `person-${String(index).padStart(2, "0")}`,
    55 + (index % 12) * 75,
    65 + Math.floor(index / 12) * 145,
    { name: "A", priority: 100 - index },
  ));
  const far = layoutGlobeMarkers(candidates, viewport, 7.7);
  const near = layoutGlobeMarkers(candidates, viewport, 3.2);
  const farVisible = far.filter((item) => item.visible).length;
  const nearVisible = near.filter((item) => item.visible).length;

  assert.equal(far.every((item) => item.lod === "far"), true);
  assert.equal(near.every((item) => item.lod === "near"), true);
  assert.ok(farVisible <= 20, `far LOD showed ${farVisible} markers`);
  assert.ok(nearVisible > farVisible, `${nearVisible} near markers should exceed ${farVisible} far markers`);

  const reversed = byId(layoutGlobeMarkers([...candidates].reverse(), viewport, 7.7));
  for (const item of far) {
    const replay = reversed.get(item.id);
    assert.deepEqual(
      { visible: replay.visible, x: replay.screenX, y: replay.screenY },
      { visible: item.visible, x: item.screenX, y: item.screenY },
    );
  }
});

test("near LOD radially expands people sharing one projected location", () => {
  const candidates = [
    marker("alpha", 480, 320, { clusterKey: "athens", priority: 4 }),
    marker("beta", 480, 320, { clusterKey: "athens", priority: 3 }),
    marker("gamma", 480, 320, { clusterKey: "athens", priority: 2 }),
    marker("delta", 480, 320, { clusterKey: "athens", priority: 1 }),
  ];
  const layout = layoutGlobeMarkers(candidates, viewport, 3.2);
  const visible = layout.filter((item) => item.visible);

  assert.equal(visible.length, candidates.length);
  assert.equal(visible.every((item) => item.clusterCount === candidates.length), true);
  assert.equal(new Set(visible.map((item) => `${item.screenX},${item.screenY}`)).size, candidates.length);
  assert.deepEqual(
    { x: byId(layout).get("alpha").offsetX, y: byId(layout).get("alpha").offsetY },
    { x: 0, y: 0 },
  );
  assert.equal(visible.filter((item) => item.offsetX !== 0 || item.offsetY !== 0).length, 3);
});

test("camera hysteresis can hold a near layout across the raw LOD boundary", () => {
  const candidates = [
    marker("alpha", 480, 320, { clusterKey: "athens", priority: 2 }),
    marker("beta", 480, 320, { clusterKey: "athens", priority: 1 }),
  ];
  const layout = layoutGlobeMarkers(candidates, viewport, 4.6, { lodOverride: "near" });

  assert.equal(layout.every((item) => item.lod === "near"), true);
  assert.equal(layout.filter((item) => item.visible).length, 2);
});

test("the live globe uses budgeted surface anchors, portrait assets, and local day/night textures", () => {
  const source = readFileSync(new URL("../app/_components/GlobeCanvas.tsx", import.meta.url), "utf8");

  assert.match(source, /layoutGlobeMarkers\(/);
  assert.match(source, /thinker\.media\.thumbSrc/);
  assert.match(source, /earth-day\.jpg/);
  assert.match(source, /earth-night\.png/);
  assert.match(source, /getGlobeAnchorMountIds\(/);
  assert.match(source, /circleGeometry/);
  assert.match(source, /ringGeometry/);
  assert.match(source, /surfaceQuaternion/);
  assert.match(source, /THREE\.AdditiveBlending/);
  assert.doesNotMatch(source, /torusGeometry/);
  assert.doesNotMatch(source, /<Html\b/);
});

test("240-person synthetic input respects desktop and mobile marker budgets", () => {
  const candidates = Array.from({ length: 240 }, (_, index) => marker(
    `synthetic-${String(index).padStart(3, "0")}`,
    20 + (index % 24) * 40,
    25 + Math.floor(index / 24) * 58,
    { name: `人物${index}`, priority: 240 - index },
  ));
  const desktop = layoutGlobeMarkers(candidates, viewport, 3.2, {
    maxVisible: { far: 11, medium: 20, near: 36 },
  });
  const mobile = layoutGlobeMarkers(candidates, { width: 390, height: 844 }, 3.2, {
    viewportPadding: 8,
    maxVisible: { far: 6, medium: 10, near: 16 },
  });

  assert.equal(desktop.filter((item) => item.visible).length, 36);
  assert.equal(mobile.filter((item) => item.visible).length, 16);
  assert.equal(desktop.length, 240);
  assert.equal(mobile.length, 240);
});

test("WebGL anchors use the same budget while retaining selected people and relation endpoints", () => {
  const layout = Array.from({ length: 36 }, (_, index) => ({
    id: `visible-${String(index).padStart(2, "0")}`,
    visible: true,
    screenX: index,
    screenY: index,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    clusterCount: 1,
    lod: "near",
    bounds: null,
  }));
  const desktop = getGlobeAnchorMountIds(
    layout,
    ["selected", "relation-from", "relation-to"],
    36,
  );
  const mobile = getGlobeAnchorMountIds(
    layout,
    ["selected", "relation-from", "relation-to"],
    16,
  );

  for (const ids of [desktop, mobile]) {
    assert.equal(ids.has("selected"), true);
    assert.equal(ids.has("relation-from"), true);
    assert.equal(ids.has("relation-to"), true);
  }
  assert.equal(desktop.size, 36);
  assert.equal(mobile.size, 16);
  assert.equal(mobile.has("visible-13"), false);
});

test("screen-space exclusion rectangles reserve room for interface panels", () => {
  const reserved = { left: 420, top: 260, right: 540, bottom: 380 };
  const layout = layoutGlobeMarkers(
    [marker("panel-adjacent", 480, 320, { selected: true, priority: 100 })],
    viewport,
    3.2,
    { exclusionRects: [reserved] },
  );
  const item = layout[0];

  assert.equal(item.visible, true);
  assert.equal(overlaps(item.bounds, reserved), false);
});

test("atlas control regions and mobile detail panels become marker exclusions", () => {
  const desktop = getGlobeMarkerExclusionRects(viewport, "explore", false);
  const mobileViewport = { width: 390, height: 693 };
  const mobile = getGlobeMarkerExclusionRects(mobileViewport, "explore", true);

  assert.equal(desktop.some((rect) => rect.left <= 24 && rect.top <= 80 && rect.right >= 300), true);
  assert.equal(mobile.some((rect) => (
    rect.left === 0
    && rect.right === mobileViewport.width
    && rect.bottom === mobileViewport.height
    && rect.height >= 240
  )), true);
});
