export type GlobeMarkerLod = "near" | "medium" | "far";

export interface ProjectedGlobeMarker {
  id: string;
  x: number;
  y: number;
  name: string;
  priority: number;
  clusterKey?: string | null;
  frontFacing: boolean;
  selected?: boolean;
}

export interface GlobeMarkerViewport {
  width: number;
  height: number;
}

export interface GlobeMarkerBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface GlobeMarkerLayoutItem {
  id: string;
  visible: boolean;
  /** Final screen-space centre after collision avoidance. */
  screenX: number;
  /** Final screen-space centre after collision avoidance. */
  screenY: number;
  /** Offset from the projected anchor, in CSS pixels. */
  offsetX: number;
  /** Offset from the projected anchor, in CSS pixels. */
  offsetY: number;
  scale: number;
  clusterCount: number;
  lod: GlobeMarkerLod;
  /** The unpadded visual bounds. Null when the marker is hidden. */
  bounds: GlobeMarkerBounds | null;
}

/**
 * Limits mounted WebGL anchors to the same small budget as the portrait-label
 * layout while reserving room for a selected thinker or relation endpoints.
 */
export function getGlobeAnchorMountIds(
  layout: readonly GlobeMarkerLayoutItem[],
  protectedIds: readonly (string | null | undefined)[],
  maximum: number,
) {
  const mounted = new Set<string>();
  const limit = Math.max(0, Math.floor(maximum));

  for (const id of protectedIds) {
    if (id && mounted.size < limit) mounted.add(id);
  }
  for (const item of layout) {
    if (item.visible && mounted.size < limit) mounted.add(item.id);
  }

  return mounted;
}

export interface GlobeMarkerSize {
  width: number;
  height: number;
}

export interface GlobeMarkerLayoutOptions {
  /** Forces a LOD chosen by a camera controller with hysteresis. */
  lodOverride?: GlobeMarkerLod;
  /** Screen-space UI regions that portrait markers must not cover. */
  exclusionRects?: readonly GlobeMarkerBounds[];
  viewportPadding?: number;
  collisionPadding?: number;
  nearLodMaxDistance?: number;
  mediumLodMaxDistance?: number;
  minimumCameraDistance?: number;
  maximumCameraDistance?: number;
  maxVisible?: Partial<Record<GlobeMarkerLod, number>>;
  measureMarker?: (
    candidate: ProjectedGlobeMarker,
    scale: number,
    lod: GlobeMarkerLod,
  ) => GlobeMarkerSize;
}

interface ResolvedOptions {
  viewportPadding: number;
  collisionPadding: number;
  nearLodMaxDistance: number;
  mediumLodMaxDistance: number;
  minimumCameraDistance: number;
  maximumCameraDistance: number;
  exclusionRects: readonly GlobeMarkerBounds[];
  maxVisible: Partial<Record<GlobeMarkerLod, number>>;
  measureMarker: NonNullable<GlobeMarkerLayoutOptions["measureMarker"]>;
}

interface CandidateEntry {
  candidate: ProjectedGlobeMarker;
  inputIndex: number;
  scale: number;
  size: GlobeMarkerSize;
}

interface CandidateGroup {
  members: CandidateEntry[];
  anchorX: number;
  anchorY: number;
}

interface PlacementCandidate {
  entry: CandidateEntry;
  desiredX: number;
  desiredY: number;
  clusterCount: number;
}

const DEFAULT_OPTIONS = {
  viewportPadding: 12,
  collisionPadding: 8,
  nearLodMaxDistance: 4.45,
  mediumLodMaxDistance: 6.15,
  minimumCameraDistance: 3.1,
  maximumCameraDistance: 7.8,
} as const;

const DENSITY = {
  near: { pixelsPerMarker: 18_000, minimum: 16, maximum: 72 },
  medium: { pixelsPerMarker: 34_000, minimum: 10, maximum: 40 },
  far: { pixelsPerMarker: 72_000, minimum: 5, maximum: 20 },
} as const;

function boundedRect(
  viewport: GlobeMarkerViewport,
  left: number,
  top: number,
  right: number,
  bottom: number,
): GlobeMarkerBounds | null {
  const resolvedLeft = clamp(left, 0, viewport.width);
  const resolvedTop = clamp(top, 0, viewport.height);
  const resolvedRight = clamp(right, 0, viewport.width);
  const resolvedBottom = clamp(bottom, 0, viewport.height);
  if (resolvedRight <= resolvedLeft || resolvedBottom <= resolvedTop) return null;
  return {
    left: resolvedLeft,
    top: resolvedTop,
    right: resolvedRight,
    bottom: resolvedBottom,
    width: resolvedRight - resolvedLeft,
    height: resolvedBottom - resolvedTop,
  };
}

/** Returns the screen regions occupied by the atlas controls and reading pane. */
export function getGlobeMarkerExclusionRects(
  viewport: GlobeMarkerViewport,
  mode: "story" | "explore",
  detailOpen: boolean,
): GlobeMarkerBounds[] {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) return [];

  const mobile = viewport.width <= 820;
  const candidates: Array<[number, number, number, number]> = [
    // Quality and day/night controls.
    [Math.max(0, viewport.width - (mobile ? 224 : 226)), 18, viewport.width - 8, mobile ? 72 : 76],
    // Story copy or the question filter rail.
    mode === "story"
      ? mobile
        ? [10, 52, Math.min(viewport.width - 10, Math.max(270, viewport.width * 0.86)), Math.min(viewport.height - 10, 340)]
        : [20, 50, Math.min(viewport.width - 16, 530), Math.min(viewport.height - 16, 390)]
      : mobile
        ? [8, 62, viewport.width - 8, Math.min(viewport.height - 8, 138)]
        : [14, 58, Math.min(viewport.width - 14, 330), Math.min(viewport.height - 12, 430)],
    // Relationship legend.
    mobile
      ? [8, Math.max(0, viewport.height - 72), Math.min(viewport.width - 8, 152), viewport.height - 8]
      : [14, Math.max(0, viewport.height - 216), Math.min(viewport.width - 14, 190), viewport.height - 8],
  ];

  if (mobile && detailOpen) {
    const overlayHeight = Math.min(520, Math.max(240, (viewport.height + 151) * 0.6));
    candidates.push([0, Math.max(0, viewport.height - overlayHeight - 6), viewport.width, viewport.height]);
  }

  return candidates
    .map(([left, top, right, bottom]) => boundedRect(viewport, left, top, right, bottom))
    .filter((bounds): bounds is GlobeMarkerBounds => bounds !== null);
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const round = (value: number) => Math.round(value * 10_000) / 10_000;

function codePointCompare(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveOptions(options: GlobeMarkerLayoutOptions): ResolvedOptions {
  const minimumCameraDistance = finiteOr(
    options.minimumCameraDistance,
    DEFAULT_OPTIONS.minimumCameraDistance,
  );
  const maximumCameraDistance = Math.max(
    minimumCameraDistance + 0.001,
    finiteOr(options.maximumCameraDistance, DEFAULT_OPTIONS.maximumCameraDistance),
  );
  const nearLodMaxDistance = clamp(
    finiteOr(options.nearLodMaxDistance, DEFAULT_OPTIONS.nearLodMaxDistance),
    minimumCameraDistance,
    maximumCameraDistance,
  );
  const mediumLodMaxDistance = clamp(
    finiteOr(options.mediumLodMaxDistance, DEFAULT_OPTIONS.mediumLodMaxDistance),
    nearLodMaxDistance,
    maximumCameraDistance,
  );

  return {
    viewportPadding: Math.max(0, finiteOr(options.viewportPadding, DEFAULT_OPTIONS.viewportPadding)),
    collisionPadding: Math.max(0, finiteOr(options.collisionPadding, DEFAULT_OPTIONS.collisionPadding)),
    nearLodMaxDistance,
    mediumLodMaxDistance,
    minimumCameraDistance,
    maximumCameraDistance,
    exclusionRects: options.exclusionRects ?? [],
    maxVisible: options.maxVisible ?? {},
    measureMarker: options.measureMarker ?? defaultMarkerSize,
  };
}

export function getGlobeMarkerLod(
  cameraDistance: number,
  options: Pick<GlobeMarkerLayoutOptions, "nearLodMaxDistance" | "mediumLodMaxDistance"> = {},
): GlobeMarkerLod {
  const nearMaximum = finiteOr(options.nearLodMaxDistance, DEFAULT_OPTIONS.nearLodMaxDistance);
  const mediumMaximum = Math.max(
    nearMaximum,
    finiteOr(options.mediumLodMaxDistance, DEFAULT_OPTIONS.mediumLodMaxDistance),
  );
  if (cameraDistance <= nearMaximum) return "near";
  if (cameraDistance <= mediumMaximum) return "medium";
  return "far";
}

function markerScale(cameraDistance: number, selected: boolean, options: ResolvedOptions) {
  const progress = clamp(
    (cameraDistance - options.minimumCameraDistance)
      / (options.maximumCameraDistance - options.minimumCameraDistance),
    0,
    1,
  );
  const eased = progress * progress * (3 - 2 * progress);
  const scale = 1.08 + (0.68 - 1.08) * eased;
  return round(scale * (selected ? 1.14 : 1));
}

function estimatedTextWidth(name: string) {
  let width = 0;
  for (const character of Array.from(name.trim())) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (/\s/u.test(character)) width += 4;
    else if (codePoint > 0xff) width += 13.5;
    else if (/[A-Z]/u.test(character)) width += 8.2;
    else width += 7.1;
  }
  return clamp(width, 24, 112);
}

function defaultMarkerSize(candidate: ProjectedGlobeMarker, scale: number): GlobeMarkerSize {
  const portraitDiameter = 40;
  const labelGap = 7;
  return {
    width: clamp((portraitDiameter + labelGap + estimatedTextWidth(candidate.name) + 16) * scale, 58, 192),
    height: clamp((portraitDiameter + 4) * scale, 30, 62),
  };
}

function sanitizeSize(size: GlobeMarkerSize, fallback: GlobeMarkerSize): GlobeMarkerSize {
  return {
    width: Math.max(1, finiteOr(size.width, fallback.width)),
    height: Math.max(1, finiteOr(size.height, fallback.height)),
  };
}

function compareEntries(left: CandidateEntry, right: CandidateEntry) {
  const selectedDifference = Number(Boolean(right.candidate.selected))
    - Number(Boolean(left.candidate.selected));
  if (selectedDifference !== 0) return selectedDifference;

  const priorityDifference = finiteOr(right.candidate.priority, 0)
    - finiteOr(left.candidate.priority, 0);
  if (priorityDifference !== 0) return priorityDifference;

  const idDifference = codePointCompare(left.candidate.id, right.candidate.id);
  if (idDifference !== 0) return idDifference;
  const nameDifference = codePointCompare(left.candidate.name, right.candidate.name);
  if (nameDifference !== 0) return nameDifference;
  if (left.candidate.x !== right.candidate.x) return left.candidate.x - right.candidate.x;
  if (left.candidate.y !== right.candidate.y) return left.candidate.y - right.candidate.y;
  return left.inputIndex - right.inputIndex;
}

function groupKey(entry: CandidateEntry) {
  const key = entry.candidate.clusterKey?.trim();
  return key ? `cluster:${key}` : `marker:${entry.candidate.id}:${entry.inputIndex}`;
}

function isProjectable(candidate: ProjectedGlobeMarker, viewport: GlobeMarkerViewport) {
  if (!candidate.frontFacing || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    return false;
  }
  const margin = Math.max(72, Math.min(viewport.width, viewport.height) * 0.18);
  return candidate.x >= -margin
    && candidate.x <= viewport.width + margin
    && candidate.y >= -margin
    && candidate.y <= viewport.height + margin;
}

function makeGroups(entries: CandidateEntry[]) {
  const byKey = new Map<string, CandidateEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry);
    const group = byKey.get(key);
    if (group) group.push(entry);
    else byKey.set(key, [entry]);
  }

  const groups: CandidateGroup[] = [];
  for (const members of byKey.values()) {
    members.sort(compareEntries);
    let x = 0;
    let y = 0;
    for (const member of members) {
      x += member.candidate.x;
      y += member.candidate.y;
    }
    groups.push({ members, anchorX: x / members.length, anchorY: y / members.length });
  }
  groups.sort((left, right) => compareEntries(left.members[0], right.members[0]));
  return groups;
}

function radialOffsets(group: CandidateGroup, collisionPadding: number) {
  const offsets = new Map<number, { x: number; y: number }>();
  const [centre, ...satellites] = group.members;
  offsets.set(centre.inputIndex, { x: 0, y: 0 });
  if (satellites.length === 0) return offsets;

  const maximumWidth = Math.max(...group.members.map(({ size }) => size.width));
  const maximumHeight = Math.max(...group.members.map(({ size }) => size.height));
  const safeDiagonal = Math.hypot(
    maximumWidth + collisionPadding,
    maximumHeight + collisionPadding,
  );
  const centreClearance = Math.hypot(
    (centre.size.width + maximumWidth) / 2 + collisionPadding,
    (centre.size.height + maximumHeight) / 2 + collisionPadding,
  );

  let memberIndex = 0;
  let ring = 1;
  let previousRadius = 0;
  while (memberIndex < satellites.length) {
    const count = Math.min(ring * 6, satellites.length - memberIndex);
    const sameRingClearance = count > 1
      ? safeDiagonal / (2 * Math.sin(Math.PI / count))
      : 0;
    const radius = Math.max(
      centreClearance,
      sameRingClearance,
      previousRadius === 0 ? 0 : previousRadius + safeDiagonal,
    );
    const angleShift = ring % 2 === 0 ? Math.PI / count : 0;

    for (let slot = 0; slot < count; slot += 1) {
      const member = satellites[memberIndex + slot];
      const angle = -Math.PI / 2 + angleShift + (slot / count) * Math.PI * 2;
      offsets.set(member.inputIndex, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
    memberIndex += count;
    previousRadius = radius;
    ring += 1;
  }
  return offsets;
}

function placementCandidates(
  groups: CandidateGroup[],
  lod: GlobeMarkerLod,
  collisionPadding: number,
) {
  const placements: PlacementCandidate[] = [];
  for (const group of groups) {
    if (lod !== "near") {
      placements.push({
        entry: group.members[0],
        desiredX: group.anchorX,
        desiredY: group.anchorY,
        clusterCount: group.members.length,
      });
      continue;
    }

    const offsets = radialOffsets(group, collisionPadding);
    for (const entry of group.members) {
      const offset = offsets.get(entry.inputIndex) ?? { x: 0, y: 0 };
      placements.push({
        entry,
        desiredX: group.anchorX + offset.x,
        desiredY: group.anchorY + offset.y,
        clusterCount: group.members.length,
      });
    }
  }
  placements.sort((left, right) => compareEntries(left.entry, right.entry));
  return placements;
}

function makeBounds(x: number, y: number, size: GlobeMarkerSize): GlobeMarkerBounds {
  return {
    left: x - size.width / 2,
    top: y - size.height / 2,
    right: x + size.width / 2,
    bottom: y + size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function boundsCollide(
  candidate: GlobeMarkerBounds,
  placed: GlobeMarkerBounds,
  padding: number,
) {
  return !(candidate.right + padding <= placed.left
    || candidate.left >= placed.right + padding
    || candidate.bottom + padding <= placed.top
    || candidate.top >= placed.bottom + padding);
}

function fitsViewport(
  bounds: GlobeMarkerBounds,
  viewport: GlobeMarkerViewport,
  padding: number,
) {
  return bounds.left >= padding
    && bounds.top >= padding
    && bounds.right <= viewport.width - padding
    && bounds.bottom <= viewport.height - padding;
}

function clampToViewport(
  x: number,
  y: number,
  size: GlobeMarkerSize,
  viewport: GlobeMarkerViewport,
  padding: number,
) {
  const minimumX = padding + size.width / 2;
  const maximumX = viewport.width - padding - size.width / 2;
  const minimumY = padding + size.height / 2;
  const maximumY = viewport.height - padding - size.height / 2;
  if (maximumX < minimumX || maximumY < minimumY) return null;
  return {
    x: clamp(x, minimumX, maximumX),
    y: clamp(y, minimumY, maximumY),
  };
}

function stringHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function searchOffsets(lod: GlobeMarkerLod, entry: CandidateEntry, collisionPadding: number) {
  const offsets = [{ x: 0, y: 0 }];
  const rings = lod === "near" ? 3 : lod === "medium" ? 1 : 0;
  if (rings === 0) return offsets;

  const step = Math.max(18, entry.size.height + collisionPadding);
  const slots = 8;
  const phase = stringHash(entry.candidate.id) % slots;
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let index = 0; index < slots; index += 1) {
      const angle = ((phase + index) / slots) * Math.PI * 2;
      offsets.push({
        x: Math.cos(angle) * step * ring,
        y: Math.sin(angle) * step * ring,
      });
    }
  }
  return offsets;
}

function densityLimit(
  lod: GlobeMarkerLod,
  viewport: GlobeMarkerViewport,
  override: number | undefined,
) {
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.max(0, Math.floor(override));
  }
  const density = DENSITY[lod];
  return clamp(
    Math.floor((viewport.width * viewport.height) / density.pixelsPerMarker),
    density.minimum,
    density.maximum,
  );
}

/**
 * Resolves projected portrait/name markers in screen space.
 *
 * The output order matches the input order, while placement itself is sorted by
 * selection, priority, then id. This makes the per-id result independent of the
 * candidate array's order. Far and medium LODs collapse `clusterKey` groups;
 * near LOD keeps the highest-priority member at the anchor and expands the rest
 * radially.
 */
export function layoutGlobeMarkers(
  candidates: readonly ProjectedGlobeMarker[],
  viewport: GlobeMarkerViewport,
  cameraDistance: number,
  options: GlobeMarkerLayoutOptions = {},
): GlobeMarkerLayoutItem[] {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)
    || viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError("Globe marker viewport dimensions must be positive finite numbers.");
  }
  if (!Number.isFinite(cameraDistance)) {
    throw new RangeError("Globe marker camera distance must be a finite number.");
  }

  const resolved = resolveOptions(options);
  const lod = options.lodOverride ?? getGlobeMarkerLod(cameraDistance, resolved);
  const entries: CandidateEntry[] = candidates.map((candidate, inputIndex) => {
    const scale = markerScale(cameraDistance, Boolean(candidate.selected), resolved);
    const fallbackSize = defaultMarkerSize(candidate, scale);
    return {
      candidate,
      inputIndex,
      scale,
      size: sanitizeSize(resolved.measureMarker(candidate, scale, lod), fallbackSize),
    };
  });

  const result: GlobeMarkerLayoutItem[] = entries.map(({ candidate, scale }) => ({
    id: candidate.id,
    visible: false,
    screenX: candidate.x,
    screenY: candidate.y,
    offsetX: 0,
    offsetY: 0,
    scale,
    clusterCount: 1,
    lod,
    bounds: null,
  }));

  const projectable = entries.filter(({ candidate }) => isProjectable(candidate, viewport));
  const groups = makeGroups(projectable);
  for (const group of groups) {
    for (const member of group.members) result[member.inputIndex].clusterCount = group.members.length;
  }

  const placements = placementCandidates(groups, lod, resolved.collisionPadding);
  const maximumVisible = densityLimit(lod, viewport, resolved.maxVisible[lod]);
  const occupied: GlobeMarkerBounds[] = resolved.exclusionRects
    .filter((bounds) => [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite))
    .map((bounds) => ({ ...bounds }));
  let visibleCount = 0;

  for (const placement of placements) {
    const { entry } = placement;
    const selected = Boolean(entry.candidate.selected);
    if (!selected && visibleCount >= maximumVisible) continue;

    const base = clampToViewport(
      placement.desiredX,
      placement.desiredY,
      entry.size,
      viewport,
      resolved.viewportPadding,
    );
    if (!base) continue;

    for (const offset of searchOffsets(lod, entry, resolved.collisionPadding)) {
      const screenX = base.x + offset.x;
      const screenY = base.y + offset.y;
      const bounds = makeBounds(screenX, screenY, entry.size);
      if (!fitsViewport(bounds, viewport, resolved.viewportPadding)) continue;
      if (occupied.some((placed) => boundsCollide(bounds, placed, resolved.collisionPadding))) {
        continue;
      }

      occupied.push(bounds);
      visibleCount += 1;
      result[entry.inputIndex] = {
        id: entry.candidate.id,
        visible: true,
        screenX: round(screenX),
        screenY: round(screenY),
        offsetX: round(screenX - entry.candidate.x),
        offsetY: round(screenY - entry.candidate.y),
        scale: entry.scale,
        clusterCount: placement.clusterCount,
        lod,
        bounds: {
          left: round(bounds.left),
          top: round(bounds.top),
          right: round(bounds.right),
          bottom: round(bounds.bottom),
          width: round(bounds.width),
          height: round(bounds.height),
        },
      };
      break;
    }
  }

  return result;
}
