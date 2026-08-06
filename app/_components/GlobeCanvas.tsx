"use client";

/* eslint-disable react-hooks/immutability -- Three.js textures and shader uniforms are intentionally imperative. */

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, OrbitControls, useTexture } from "@react-three/drei";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { gsap } from "gsap";
import * as THREE from "three";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Topology } from "topojson-specification";
import type { CSSProperties, RefObject } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Line2, LineMaterial, OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  evidenceLabels,
  relations,
  relationTypeLabels,
  storyChapters,
  thinkerById,
  thinkers,
  type Relation,
  type QuestionId,
  type StoryChapter,
  type Thinker,
} from "../_data/atlas";
import type { AtlasMode, QualityTier } from "../_state/atlas-store";
import {
  GLOBE_HIGH_QUALITY_WARMUP_MS,
  GLOBE_NATIVE_CONTEXT_RESTORE_MS,
  getFocusedThinkerIds,
  getRenderPixelRatio,
  getWebglRetryDelayMs,
  isWindowsEdgeUserAgent,
  percentile,
  shouldDirectGlobeCamera,
  type FocusDepth,
  type GlobeCameraSnapshot,
} from "./atlas-visual-policy";
import { createElevatedArcPoints, GLOBE_RADIUS } from "./globe-visual-geometry";
import {
  getGlobeMarkerLod,
  getGlobeAnchorMountIds,
  getGlobeMarkerExclusionRects,
  layoutGlobeMarkers,
  type GlobeMarkerLayoutItem,
  type GlobeMarkerLod,
} from "./globe-marker-layout";

const MARKER_RADIUS = GLOBE_RADIUS + 0.065;
const DETAIL_BORDERS_URL = "/media/globe/countries-50m.json";
const EARTH_TEXTURE_URLS = [
  "/media/globe/earth-day.jpg",
  "/media/globe/earth-night.png",
  "/media/globe/earth-normal.jpg",
  "/media/globe/earth-specular.jpg",
  "/media/globe/earth-clouds.png",
] as const;

type GlobePowerPreference = "default" | "high-performance";

const cachedWebgl2Availability = new Map<GlobePowerPreference, boolean>();
const EDGE_GPU_SESSION_KEY = "atlas-edge-gpu-session:v1";
const AtlasPostprocessing = lazy(() => import("./AtlasPostprocessing"));

type WebglRuntimeStatus = "checking" | "ready" | "lost" | "retrying" | "unavailable" | "unsupported";

export type EarthLightingMode = "day" | "night";

export interface GlobeThematicTransition {
  from: string;
  to: string;
  label: string;
}

export interface GlobeStoryFocus {
  key: string;
  camera: StoryChapter["camera"];
  focusThinkerId?: string;
  thinkerIds: string[];
  relationIds: string[];
  thematicTransitions: GlobeThematicTransition[];
}

interface GlobeCanvasProps {
  mode: AtlasMode;
  earthMode: EarthLightingMode;
  detailOpen: boolean;
  isPlaying: boolean;
  chapterIndex: number;
  storyFocus?: GlobeStoryFocus | null;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  activeQuestionId: QuestionId | null;
  timelineYear: number;
  timelineScrubbing: boolean;
  quality: QualityTier;
  focusDepth: FocusDepth;
  cameraSnapshot: GlobeCameraSnapshot | null;
  reduceMotion: boolean;
  onSelectThinker: (id: string) => void;
  onSelectRelation: (id: string) => void;
  onFallback: () => void;
  onRuntimeFallback: () => void;
  onCameraSnapshotChange: (snapshot: GlobeCameraSnapshot) => void;
  onPerformanceSample: (p75FrameMs: number) => void;
  onStoryInterruption: () => void;
}

interface SharedEarthUniforms {
  uSunDirection: THREE.IUniform<THREE.Vector3>;
  uNightMix: THREE.IUniform<number>;
  uCloudOffset: THREE.IUniform<number>;
}

const EARTH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  void main() {
    vUv = uv;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const EARTH_FRAGMENT_SHADER = `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;
  uniform float uNightMix;
  uniform float uCloudOffset;
  uniform float uNormalScale;
  uniform float uSunIntensity;
  uniform float uCityIntensity;
  uniform float uSpecularStrength;
  uniform float uCloudShadowStrength;

  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  vec3 perturbNormal(vec3 eyePosition, vec3 surfaceNormal, vec3 mapNormal, vec2 uv) {
    vec3 q0 = dFdx(eyePosition);
    vec3 q1 = dFdy(eyePosition);
    vec2 st0 = dFdx(uv);
    vec2 st1 = dFdy(uv);
    vec3 q1Perp = cross(q1, surfaceNormal);
    vec3 q0Perp = cross(surfaceNormal, q0);
    vec3 tangent = q1Perp * st0.x + q0Perp * st1.x;
    vec3 bitangent = q1Perp * st0.y + q0Perp * st1.y;
    float determinant = max(dot(tangent, tangent), dot(bitangent, bitangent));
    float scale = determinant > 0.0 ? inversesqrt(determinant) : 0.0;
    return normalize(
      tangent * mapNormal.x * scale +
      bitangent * mapNormal.y * scale +
      surfaceNormal * mapNormal.z
    );
  }

  void main() {
    vec2 earthUv = vec2(fract(vUv.x), clamp(vUv.y, 0.001, 0.999));
    vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
    vec3 normal = normalize(vViewNormal);

    #ifdef USE_EARTH_NORMAL
      vec3 sampledNormal = texture2D(uNormalMap, earthUv).xyz * 2.0 - 1.0;
      sampledNormal.xy *= uNormalScale;
      normal = perturbNormal(vViewPosition, normal, normalize(sampledNormal), earthUv);
    #endif

    vec3 viewDirection = normalize(-vViewPosition);
    vec3 lightDirection = normalize((viewMatrix * vec4(normalize(uSunDirection), 0.0)).xyz);
    float normalLight = dot(normal, lightDirection);
    float daylight = smoothstep(-0.12, 0.18, normalLight);
    float nightSide = 1.0 - daylight;
    float diffuse = max(normalLight, 0.0);

    vec3 dayColor = texture2D(uDayMap, earthUv).rgb;
    vec3 cityColor = texture2D(uNightMap, earthUv).rgb;
    float waterMask = 0.0;
    #ifdef USE_EARTH_SPECULAR
      waterMask = texture2D(uSpecularMap, earthUv).r;
    #endif

    float cloudMask = 0.0;
    #ifdef USE_CLOUD_SHADOW
      cloudMask = texture2D(uCloudMap, cloudUv).a;
    #endif

    float ambient = mix(0.15, 0.068, uNightMix);
    float sunEnergy = mix(uSunIntensity, uSunIntensity * 0.34, uNightMix);
    vec3 color = dayColor * (ambient + diffuse * sunEnergy);
    color *= 1.0 - cloudMask * daylight * uCloudShadowStrength;

    vec3 halfDirection = normalize(lightDirection + viewDirection);
    float specularPower = mix(28.0, 104.0, waterMask);
    float specular = pow(max(dot(normal, halfDirection), 0.0), specularPower)
      * waterMask * diffuse * uSpecularStrength;
    vec3 sunColor = mix(vec3(0.82, 0.92, 1.0), vec3(1.0, 0.72, 0.32), uNightMix);
    color += sunColor * specular;

    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    color += vec3(0.08, 0.22, 0.38) * fresnel * waterMask * daylight * 0.34;

    float cityGain = mix(0.82, uCityIntensity, uNightMix);
    color += cityColor * nightSide * cityGain * (1.0 - cloudMask * 0.46);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERTEX_SHADER = EARTH_VERTEX_SHADER;

const CLOUD_FRAGMENT_SHADER = `
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;
  uniform float uNightMix;
  uniform float uCloudOffset;
  varying vec2 vUv;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  void main() {
    vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
    float cloud = smoothstep(0.08, 0.78, texture2D(uCloudMap, cloudUv).a);
    vec3 normal = normalize(vViewNormal);
    vec3 viewDirection = normalize(-vViewPosition);
    vec3 lightDirection = normalize((viewMatrix * vec4(normalize(uSunDirection), 0.0)).xyz);
    float light = smoothstep(-0.16, 0.42, dot(normal, lightDirection));
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
    vec3 cloudColor = mix(vec3(0.14, 0.20, 0.31), vec3(0.94, 0.97, 1.0), light);
    float alpha = cloud * mix(0.10, 0.57, light) * mix(1.0, 0.62, uNightMix);
    alpha += cloud * rim * 0.07;
    gl_FragColor = vec4(cloudColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX_SHADER = EARTH_VERTEX_SHADER;

const ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 uSunDirection;
  uniform float uNightMix;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  void main() {
    vec3 normal = normalize(vViewNormal);
    vec3 viewDirection = normalize(-vViewPosition);
    vec3 lightDirection = normalize((viewMatrix * vec4(normalize(uSunDirection), 0.0)).xyz);
    float lightAmount = dot(normal, lightDirection);
    float rimBase = max(1.0 - abs(clamp(dot(normal, viewDirection), -1.0, 1.0)), 0.0);
    float rim = pow(rimBase, 2.45);
    float daySide = smoothstep(-0.28, 0.34, lightAmount);
    float terminator = 1.0 - smoothstep(0.0, 0.28, abs(lightAmount));
    vec3 nightAtmosphere = vec3(0.18, 0.25, 0.50);
    vec3 dayAtmosphere = vec3(0.16, 0.54, 0.92);
    vec3 sunset = vec3(0.95, 0.43, 0.15);
    vec3 color = mix(nightAtmosphere, dayAtmosphere, daySide);
    color = mix(color, sunset, terminator * daySide * 0.28);
    float alpha = rim * mix(0.24, 0.40, daySide) * mix(0.94, 1.06, uNightMix);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function getWebgl2Availability(powerPreference: GlobePowerPreference) {
  const cached = cachedWebgl2Availability.get(powerPreference);
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference,
      stencil: false,
    });
    cachedWebgl2Availability.set(powerPreference, Boolean(context));
    canvas.width = 1;
    canvas.height = 1;
  } catch {
    cachedWebgl2Availability.set(powerPreference, false);
  }
  return cachedWebgl2Availability.get(powerPreference) ?? false;
}

function getInitialGpuProfile() {
  if (typeof window === "undefined") {
    return { windowsEdge: false, suspectedRendererCrash: false };
  }
  const windowsEdge = isWindowsEdgeUserAgent(window.navigator.userAgent);
  let suspectedRendererCrash = false;
  if (windowsEdge) {
    try {
      suspectedRendererCrash = window.sessionStorage.getItem(EDGE_GPU_SESSION_KEY) === "active";
    } catch {
      // Storage can be unavailable in hardened browser profiles.
    }
  }
  return { windowsEdge, suspectedRendererCrash };
}

function latLonToVector3(lat: number, lon: number, radius = GLOBE_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function cameraPositionFromPreset(preset: StoryChapter["camera"]) {
  return latLonToVector3(preset.lat, preset.lon, preset.distance);
}

function collectRings(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  if (geometry.type === "GeometryCollection") {
    return geometry.geometries.flatMap((item) => collectRings(item));
  }
  return [];
}

function CountryBorderGeometry({
  topology,
  quality,
}: {
  topology: Topology;
  quality: QualityTier;
}) {
  const geometry = useMemo(() => {
    const countriesObject = topology.objects.countries;
    const countries = feature(topology, countriesObject) as FeatureCollection;
    const positions: number[] = [];
    const step = quality === "high" ? 1 : quality === "medium" ? 2 : 2;

    for (const country of countries.features) {
      if (!country.geometry) continue;
      for (const ring of collectRings(country.geometry)) {
        let lastConnectedIndex = 0;
        for (let index = 0; index < ring.length - step; index += step) {
          const current = ring[index];
          lastConnectedIndex = Math.min(index + step, ring.length - 1);
          const next = ring[lastConnectedIndex];
          const a = latLonToVector3(current[1], current[0], GLOBE_RADIUS + 0.011);
          const b = latLonToVector3(next[1], next[0], GLOBE_RADIUS + 0.011);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
        if (lastConnectedIndex < ring.length - 1) {
          const current = ring[lastConnectedIndex];
          const next = ring[ring.length - 1];
          const a = latLonToVector3(current[1], current[0], GLOBE_RADIUS + 0.011);
          const b = latLonToVector3(next[1], next[0], GLOBE_RADIUS + 0.011);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return result;
  }, [quality, topology]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} renderOrder={3}>
      <lineBasicMaterial
        color="#d0aa62"
        transparent
        opacity={quality === "high" ? 0.32 : quality === "medium" ? 0.24 : 0.2}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function DetailedCountryBorders({ quality }: { quality: QualityTier }) {
  const source = useLoader(THREE.FileLoader, DETAIL_BORDERS_URL) as string;
  const topology = useMemo(() => JSON.parse(source) as Topology, [source]);
  return <CountryBorderGeometry topology={topology} quality={quality} />;
}

function CountryBorders({ quality }: { quality: QualityTier }) {
  const fallback = (
    <CountryBorderGeometry
      topology={worldData as unknown as Topology}
      quality={quality}
    />
  );
  if (quality === "low") return fallback;
  return (
    <Suspense fallback={fallback}>
      <DetailedCountryBorders quality={quality} />
    </Suspense>
  );
}

function StarField({ quality }: { quality: QualityTier }) {
  const geometry = useMemo(() => {
    const count = quality === "high" ? 980 : quality === "medium" ? 540 : 220;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 20260710;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const radius = 8 + random() * 8;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const warmth = random();
      colors[index * 3] = 0.72 + warmth * 0.2;
      colors[index * 3 + 1] = 0.76 + warmth * 0.14;
      colors[index * 3 + 2] = 0.86 - warmth * 0.08;
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    result.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return result;
  }, [quality]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={quality === "high" ? 0.017 : 0.013}
        transparent
        opacity={0.68}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function LegacyEarth({
  globeRef,
}: {
  globeRef: RefObject<THREE.Mesh | null>;
}) {
  return (
    <mesh ref={globeRef}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 40]} />
      <meshBasicMaterial color="#172431" />
    </mesh>
  );
}

function EarthSystem({
  globeRef,
  quality,
  reduceMotion,
  shared,
  stableGpuProfile,
}: {
  globeRef: RefObject<THREE.Mesh | null>;
  quality: QualityTier;
  reduceMotion: boolean;
  shared: SharedEarthUniforms;
  stableGpuProfile: boolean;
}) {
  const { gl, invalidate } = useThree();
  const textureUrls = useMemo(
    () => quality === "low" ? EARTH_TEXTURE_URLS.slice(0, 2) : [...EARTH_TEXTURE_URLS],
    [quality],
  );
  const loadedTextures = useTexture(textureUrls as string[]) as THREE.Texture[];
  const [dayMap, nightMap, loadedNormalMap, loadedSpecularMap, loadedCloudMap] = loadedTextures;
  const normalMap = loadedNormalMap ?? dayMap;
  const specularMap = loadedSpecularMap ?? dayMap;
  const cloudMap = loadedCloudMap ?? dayMap;

  useEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    if (loadedNormalMap) loadedNormalMap.colorSpace = THREE.NoColorSpace;
    if (loadedSpecularMap) loadedSpecularMap.colorSpace = THREE.NoColorSpace;
    if (loadedCloudMap) loadedCloudMap.colorSpace = THREE.NoColorSpace;
    const anisotropy = Math.min(
      stableGpuProfile
        ? quality === "low" ? 2 : 4
        : quality === "high" ? 8 : quality === "medium" ? 4 : 2,
      gl.capabilities.getMaxAnisotropy(),
    );
    for (const texture of loadedTextures) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }, [dayMap, gl, loadedCloudMap, loadedNormalMap, loadedSpecularMap, loadedTextures, nightMap, quality, stableGpuProfile]);

  useEffect(() => {
    if (reduceMotion || quality === "low") return;
    const interval = window.setInterval(
      () => invalidate(),
      quality === "high" && !stableGpuProfile ? 1000 / 24 : 1000 / 18,
    );
    return () => window.clearInterval(interval);
  }, [invalidate, quality, reduceMotion, stableGpuProfile]);

  const surfaceUniforms = useMemo(() => ({
    uDayMap: { value: dayMap },
    uNightMap: { value: nightMap },
    uNormalMap: { value: normalMap },
    uSpecularMap: { value: specularMap },
    uCloudMap: { value: cloudMap },
    uSunDirection: shared.uSunDirection,
    uNightMix: shared.uNightMix,
    uCloudOffset: shared.uCloudOffset,
    uNormalScale: { value: 0.58 },
    uSunIntensity: { value: 1.42 },
    uCityIntensity: { value: 1.32 },
    uSpecularStrength: { value: 0.72 },
    uCloudShadowStrength: { value: 0.18 },
  }), [cloudMap, dayMap, nightMap, normalMap, shared, specularMap]);

  const cloudUniforms = useMemo(() => ({
    uCloudMap: { value: cloudMap },
    uSunDirection: shared.uSunDirection,
    uNightMix: shared.uNightMix,
    uCloudOffset: shared.uCloudOffset,
  }), [cloudMap, shared]);

  const defines = useMemo(() => {
    if (quality === "high") {
      return { USE_EARTH_NORMAL: 1, USE_EARTH_SPECULAR: 1, USE_CLOUD_SHADOW: 1 };
    }
    if (quality === "medium") {
      return { USE_EARTH_SPECULAR: 1, USE_CLOUD_SHADOW: 1 };
    }
    return {};
  }, [quality]);

  const segments: [number, number] =
    quality === "high" ? [128, 72] : quality === "medium" ? [96, 56] : [64, 40];

  useFrame(({ clock }) => {
    shared.uCloudOffset.value = (clock.elapsedTime * 0.00078) % 1;
  });

  return (
    <>
      <mesh ref={globeRef} renderOrder={1}>
        <sphereGeometry args={[GLOBE_RADIUS, segments[0], segments[1]]} />
        <shaderMaterial
          key={"earth-surface-" + quality}
          uniforms={surfaceUniforms}
          defines={defines}
          vertexShader={EARTH_VERTEX_SHADER}
          fragmentShader={EARTH_FRAGMENT_SHADER}
          toneMapped
        />
      </mesh>
      {quality !== "low" ? (
        <mesh scale={1.006} renderOrder={2}>
          <sphereGeometry args={[GLOBE_RADIUS, segments[0], segments[1]]} />
          <shaderMaterial
            uniforms={cloudUniforms}
            vertexShader={CLOUD_VERTEX_SHADER}
            fragmentShader={CLOUD_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            depthTest
            side={THREE.FrontSide}
            toneMapped
          />
        </mesh>
      ) : null}
    </>
  );
}

function Atmosphere({
  quality,
  shared,
}: {
  quality: QualityTier;
  shared: SharedEarthUniforms;
}) {
  const uniforms = useMemo(() => ({
    uSunDirection: shared.uSunDirection,
    uNightMix: shared.uNightMix,
  }), [shared]);

  return (
    <mesh scale={quality === "low" ? 1.032 : 1.043} renderOrder={2}>
      <sphereGeometry args={[GLOBE_RADIUS, quality === "low" ? 48 : 80, quality === "low" ? 32 : 56]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest
        vertexShader={ATMOSPHERE_VERTEX_SHADER}
        fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
        toneMapped
      />
    </mesh>
  );
}

function DayNightDirector({
  earthMode,
  reduceMotion,
  shared,
}: {
  earthMode: EarthLightingMode;
  reduceMotion: boolean;
  shared: SharedEarthUniforms;
}) {
  const { camera, gl, invalidate } = useThree();
  const targetSun = useMemo(() => new THREE.Vector3(), []);
  const nightTangent = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []);
  const partial = useMemo(() => new THREE.Quaternion(), []);
  const identity = useMemo(() => new THREE.Quaternion(), []);

  const updateTargetSun = useCallback(() => {
    targetSun.copy(camera.position).normalize();
    if (earthMode === "day") return;

    nightTangent.set(0, 1, 0).addScaledVector(targetSun, -targetSun.y);
    if (nightTangent.lengthSq() < 0.0001) nightTangent.set(1, 0, 0);
    nightTangent.normalize();
    targetSun.multiplyScalar(-0.38).addScaledVector(nightTangent, 0.925).normalize();
  }, [camera, earthMode, nightTangent, targetSun]);

  useFrame((_, delta) => {
    updateTargetSun();

    const currentSun = shared.uSunDirection.value.normalize();
    const alignment = THREE.MathUtils.clamp(currentSun.dot(targetSun), -1, 1);
    if (alignment > 0.99999) return;

    rotation.setFromUnitVectors(currentSun, targetSun);
    const amount = reduceMotion ? 1 : 1 - Math.exp(-6 * delta);
    partial.slerpQuaternions(identity, rotation, amount);
    currentSun.applyQuaternion(partial).normalize();
  });

  useEffect(() => {
    const targetMix = earthMode === "night" ? 1 : 0;
    const targetExposure = earthMode === "night" ? 1.02 : 0.94;

    if (reduceMotion) {
      updateTargetSun();
      shared.uSunDirection.value.copy(targetSun);
      shared.uNightMix.value = targetMix;
      gl.toneMappingExposure = targetExposure;
      invalidate();
      return;
    }

    const progress = { value: 0 };
    const startMix = shared.uNightMix.value;
    const startExposure = gl.toneMappingExposure;
    const tween = gsap.to(progress, {
      value: 1,
      duration: 0.95,
      ease: "power2.inOut",
      onUpdate: () => {
        shared.uNightMix.value = THREE.MathUtils.lerp(startMix, targetMix, progress.value);
        gl.toneMappingExposure = THREE.MathUtils.lerp(startExposure, targetExposure, progress.value);
        invalidate();
      },
      onComplete: () => {
        updateTargetSun();
        shared.uSunDirection.value.copy(targetSun);
        invalidate();
      },
    });

    return () => {
      tween.kill();
    };
  }, [earthMode, gl, invalidate, reduceMotion, shared, targetSun, updateTargetSun]);

  return null;
}

function greatCirclePoints(relation: Relation, quality: QualityTier) {
  const from = thinkerById.get(relation.from);
  const to = thinkerById.get(relation.to);
  if (!from || !to) return [];
  const start = latLonToVector3(from.anchors[0].lat, from.anchors[0].lon, GLOBE_RADIUS + 0.042);
  const end = latLonToVector3(to.anchors[0].lat, to.anchors[0].lon, GLOBE_RADIUS + 0.042);
  const pointCount = quality === "high" ? 64 : quality === "medium" ? 48 : 32;
  const angularDistance = start.clone().normalize().angleTo(end.clone().normalize());
  const points: THREE.Vector3[] = [];

  if (angularDistance < 0.012) {
    const normal = start.clone().normalize();
    const reference = Math.abs(normal.y) < 0.88
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(normal, reference).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const hash = Array.from(relation.id).reduce((total, character) => total + character.charCodeAt(0), 0);
    const phase = THREE.MathUtils.degToRad(hash % 360);
    const outward = tangent.clone().multiplyScalar(Math.cos(phase))
      .add(bitangent.clone().multiplyScalar(Math.sin(phase)));
    const sideways = new THREE.Vector3().crossVectors(normal, outward).normalize();
    for (let index = 0; index <= pointCount; index += 1) {
      const progress = index / pointCount;
      const lift = Math.sin(Math.PI * progress);
      const point = start.clone()
        .addScaledVector(normal, lift * 0.13)
        .addScaledVector(outward, lift * 0.2)
        .addScaledVector(sideways, Math.sin(Math.PI * 2 * progress) * 0.055);
      points.push(point);
    }
    return points;
  }

  return createElevatedArcPoints(start, end, pointCount);
}

function relationColor(relation: Relation) {
  if (relation.type === "lineage") return "#72deb2";
  if (relation.type === "thematic-resonance") return "#c8cac8";
  if (relation.type === "critique") return "#e07256";
  if (relation.type === "text-transmission") return "#8ba9ed";
  return "#d3ab67";
}

function RelationArc({
  relation,
  emphasized,
  selected,
  hovered,
  dimmed,
  visible,
  animate,
  quality,
  reduceMotion,
  onSelect,
  onHover,
}: {
  relation: Relation;
  emphasized: boolean;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  visible: boolean;
  animate: boolean;
  quality: QualityTier;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const points = useMemo(() => greatCirclePoints(relation, quality), [quality, relation]);
  const pulseRef = useRef<Line2 | null>(null);
  const { invalidate } = useThree();
  const color = relationColor(relation);
  const isResonance = relation.type === "thematic-resonance";
  const isCritique = relation.type === "critique";
  const isTextTransmission = relation.type === "text-transmission";

  useEffect(() => {
    if (!visible || !animate || reduceMotion || !pulseRef.current) return;
    const material = pulseRef.current.material as LineMaterial;
    const travel = { offset: material.dashOffset };
    const tween = gsap.to(travel, {
      offset: travel.offset + (relation.directed ? -2.6 : 2.6),
      duration: selected ? 1.65 : 2.25,
      ease: "none",
      repeat: selected ? -1 : 1,
      onUpdate: () => {
        material.dashOffset = travel.offset;
        invalidate();
      },
    });
    return () => {
      tween.kill();
    };
  }, [animate, invalidate, reduceMotion, relation.directed, relation.id, selected, visible]);

  if (!visible || points.length === 0) return null;
  const showHalo = selected || hovered || (emphasized && quality !== "low");

  const handleSelect = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(relation.id);
  };

  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(relation.id);
      }}
      onPointerOut={() => onHover(null)}
    >
      {showHalo ? (
        <Line
          points={points}
          color={color}
          lineWidth={selected ? 11 : hovered ? 9 : 7}
          transparent
          opacity={selected ? 0.22 : hovered ? 0.14 : 0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest
          toneMapped={false}
          renderOrder={4}
          onClick={handleSelect}
        />
      ) : null}
      {isTextTransmission && !dimmed ? (
        <Line
          points={points}
          color="#dce6ff"
          lineWidth={selected || hovered ? 4.4 : 2.8}
          transparent
          opacity={selected || hovered ? 0.22 : 0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest
          toneMapped={false}
          renderOrder={4}
          onClick={handleSelect}
        />
      ) : null}
      <Line
        points={points}
        color={color}
        lineWidth={selected ? 2.7 : hovered ? 2.15 : emphasized ? 1.6 : 0.72}
        transparent
        opacity={dimmed ? 0.035 : selected ? 0.98 : hovered ? 0.9 : emphasized ? 0.76 : 0.11}
        dashed={isResonance || isCritique}
        dashSize={isCritique ? 0.055 : 0.08}
        gapSize={isCritique ? 0.085 : 0.055}
        dashScale={1}
        depthWrite={false}
        depthTest
        toneMapped={false}
        renderOrder={5}
        onClick={handleSelect}
      />
      {animate ? (
        <Line
          ref={pulseRef}
          points={points}
          color="#fff4d2"
          lineWidth={selected ? 2.9 : 2.1}
          dashed
          dashSize={0.1}
          gapSize={0.34}
          dashScale={1}
          transparent
          opacity={dimmed ? 0 : reduceMotion ? 0.5 : 0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest
          toneMapped={false}
          renderOrder={6}
          onClick={handleSelect}
        />
      ) : null}
    </group>
  );
}

function ThematicJourneyArc({
  transition,
  quality,
  reduceMotion,
}: {
  transition: GlobeThematicTransition;
  quality: QualityTier;
  reduceMotion: boolean;
}) {
  const pulseRef = useRef<Line2 | null>(null);
  const { invalidate } = useThree();
  const points = useMemo(() => {
    const from = thinkerById.get(transition.from);
    const to = thinkerById.get(transition.to);
    if (!from || !to) return [];
    const start = latLonToVector3(from.anchors[0].lat, from.anchors[0].lon, GLOBE_RADIUS + 0.04);
    const end = latLonToVector3(to.anchors[0].lat, to.anchors[0].lon, GLOBE_RADIUS + 0.04);
    return createElevatedArcPoints(start, end, quality === "low" ? 28 : quality === "medium" ? 46 : 64);
  }, [quality, transition.from, transition.to]);

  useEffect(() => {
    if (reduceMotion || !pulseRef.current) return;
    const material = pulseRef.current.material as LineMaterial;
    const travel = { offset: material.dashOffset };
    const tween = gsap.to(travel, {
      offset: travel.offset - 1.8,
      duration: 3.2,
      ease: "none",
      repeat: -1,
      onUpdate: () => {
        material.dashOffset = travel.offset;
        invalidate();
      },
    });
    return () => {
      tween.kill();
    };
  }, [invalidate, reduceMotion, transition.from, transition.to]);

  if (!points.length) return null;
  return (
    <group>
      {quality !== "low" ? (
        <Line
          points={points}
          color="#9fb9d8"
          lineWidth={5.5}
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest
          toneMapped={false}
          renderOrder={4}
        />
      ) : null}
      <Line
        ref={pulseRef}
        points={points}
        color="#9fb9d8"
        lineWidth={1.35}
        dashed
        dashSize={0.055}
        gapSize={0.1}
        dashScale={1}
        transparent
        opacity={reduceMotion ? 0.46 : 0.68}
        depthWrite={false}
        depthTest
        toneMapped={false}
        renderOrder={5}
      />
    </group>
  );
}

function ThinkerAnchor({
  thinker,
  emphasized,
  selected,
  hovered,
  dimmed,
  quality,
  onSelect,
}: {
  thinker: Thinker;
  emphasized: boolean;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  quality: QualityTier;
  onSelect: (id: string) => void;
}) {
  const { point, surfaceQuaternion } = useMemo(() => {
    const point = latLonToVector3(
      thinker.anchors[0].lat,
      thinker.anchors[0].lon,
      GLOBE_RADIUS + 0.014,
    );
    const surfaceQuaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      point.clone().normalize(),
    );
    return { point, surfaceQuaternion };
  }, [thinker]);

  return (
    <group
      position={point}
      quaternion={surfaceQuaternion}
      scale={hovered ? 1.08 : selected ? 1.12 : 1}
    >
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(thinker.id);
        }}
      >
        <circleGeometry args={[selected ? 0.018 : 0.012, quality === "low" ? 10 : 16]} />
        <meshBasicMaterial
          color={thinker.color}
          transparent
          opacity={dimmed ? 0.12 : selected ? 1 : emphasized || hovered ? 0.9 : 0.64}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {emphasized ? (
        <mesh>
          <ringGeometry args={[selected ? 0.04 : 0.034, selected ? 0.047 : 0.04, quality === "low" ? 16 : 24]} />
          <meshBasicMaterial
            color={thinker.color}
            transparent
            opacity={selected ? 0.88 : 0.64}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function CameraDirector({
  controlsRef,
  abortRef,
  mode,
  chapterIndex,
  storyFocus,
  selectedThinkerId,
  selectedRelationId,
  reduceMotion,
  onSnapshotChange,
  suppressInitialDirection,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  abortRef: RefObject<(() => void) | null>;
  mode: AtlasMode;
  chapterIndex: number;
  storyFocus?: GlobeStoryFocus | null;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  reduceMotion: boolean;
  onSnapshotChange: (snapshot: GlobeCameraSnapshot) => void;
  suppressInitialDirection: boolean;
}) {
  const { camera, invalidate, size } = useThree();
  const [controlsReady, setControlsReady] = useState(false);
  const suppressInitialRef = useRef(suppressInitialDirection);
  const lastStoryFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const waitForControls = () => {
      if (controlsRef.current) {
        setControlsReady(true);
        return;
      }
      frame = window.requestAnimationFrame(waitForControls);
    };
    waitForControls();
    return () => window.cancelAnimationFrame(frame);
  }, [controlsRef]);

  useEffect(() => {
    if (!controlsReady) return;
    if (suppressInitialRef.current) {
      suppressInitialRef.current = false;
      return;
    }
    const controls = controlsRef.current;
    if (!controls) return;

    const thinker = selectedThinkerId ? thinkerById.get(selectedThinkerId) : undefined;
    const relation = selectedRelationId ? relations.find((item) => item.id === selectedRelationId) : undefined;
    if (!shouldDirectGlobeCamera(mode, selectedThinkerId, selectedRelationId)) return;
    if (mode === "story" && !thinker && !relation && storyFocus) {
      if (lastStoryFocusKeyRef.current === storyFocus.key) return;
      lastStoryFocusKeyRef.current = storyFocus.key;
    }
    const relationFrom = relation ? thinkerById.get(relation.from) : undefined;
    const relationTo = relation ? thinkerById.get(relation.to) : undefined;
    const relationDirection = relationFrom && relationTo
      ? (() => {
          const fromDirection = latLonToVector3(relationFrom.anchors[0].lat, relationFrom.anchors[0].lon, 1);
          const midpoint = fromDirection.clone().add(latLonToVector3(relationTo.anchors[0].lat, relationTo.anchors[0].lon, 1));
          return midpoint.lengthSq() < 0.01 ? fromDirection : midpoint.normalize();
        })()
      : null;
    const storyThinker = storyFocus?.focusThinkerId ? thinkerById.get(storyFocus.focusThinkerId) : undefined;
    const destination = thinker
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 3.72)
      : relationDirection
        ? relationDirection.clone().multiplyScalar(4.25)
        : storyThinker
          ? latLonToVector3(storyThinker.anchors[0].lat, storyThinker.anchors[0].lon, storyFocus?.camera.distance ?? 4)
          : cameraPositionFromPreset(storyFocus?.camera ?? storyChapters[chapterIndex]?.camera ?? storyChapters[0].camera);
    const target = thinker
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 0.42)
      : relationDirection
        ? relationDirection.clone().multiplyScalar(0.34)
        : storyThinker
          ? latLonToVector3(storyThinker.anchors[0].lat, storyThinker.anchors[0].lon, 0.42)
          : new THREE.Vector3(0, 0, 0);
    const duration = reduceMotion ? 0.01 : thinker || relation ? (size.width <= 820 ? 0.65 : 0.9) : mode === "story" ? 1.45 : 0.9;

    const cameraTween = gsap.to(camera.position, {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration,
      ease: "power3.inOut",
      onUpdate: () => {
        camera.lookAt(controls.target);
        invalidate();
      },
    });
    const targetTween = gsap.to(controls.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration,
      ease: "power3.inOut",
      onUpdate: () => {
        controls.update();
        invalidate();
      },
      onComplete: () => {
        onSnapshotChange({
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
          distance: camera.position.distanceTo(controls.target),
        });
      },
    });

    const abort = () => {
      cameraTween.kill();
      targetTween.kill();
    };
    abortRef.current = abort;

    return () => {
      abort();
      if (abortRef.current === abort) abortRef.current = null;
    };
  }, [abortRef, camera, chapterIndex, controlsReady, controlsRef, invalidate, mode, onSnapshotChange, reduceMotion, selectedRelationId, selectedThinkerId, size.width, storyFocus]);

  return null;
}

function CameraStateBridge({
  controlsRef,
  initialSnapshot,
  onSnapshotChange,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  initialSnapshot: GlobeCameraSnapshot | null;
  onSnapshotChange: (snapshot: GlobeCameraSnapshot) => void;
}) {
  const { camera, invalidate } = useThree();
  const restoredRef = useRef(false);
  const lastReportRef = useRef(0);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (restoredRef.current) return;
    const controls = controlsRef.current;
    restoredRef.current = true;
    if (!controls || !initialSnapshot) return;
    camera.position.set(...initialSnapshot.position);
    controls.target.set(...initialSnapshot.target);
    controls.update();
    invalidate();
  }, [camera, controlsRef, initialSnapshot, invalidate]);

  useFrame(({ clock }) => {
    const controls = controlsRef.current;
    if (!controls || clock.elapsedTime - lastReportRef.current < 0.25) return;
    lastReportRef.current = clock.elapsedTime;
    const snapshot: GlobeCameraSnapshot = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      distance: camera.position.distanceTo(controls.target),
    };
    const signature = [...snapshot.position, ...snapshot.target].map((value) => value.toFixed(3)).join(":");
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    onSnapshotChange(snapshot);
  });

  return null;
}

function FramePerformanceReporter({ onSample }: { onSample: (p75FrameMs: number) => void }) {
  const samplesRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (delta > 0 && delta < 0.25) samplesRef.current.push(delta * 1_000);
    elapsedRef.current += delta;
    if (elapsedRef.current < 1 || samplesRef.current.length < 8) return;
    onSample(percentile(samplesRef.current, 0.75));
    samplesRef.current = [];
    elapsedRef.current = 0;
  });
  return null;
}

function WebglContextLifecycle({
  onLost,
  onRestored,
}: {
  onLost: () => void;
  onRestored: () => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    const handleRestored = () => onRestored();
    canvas.dataset.webglLifecycle = "ready";
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      delete canvas.dataset.webglLifecycle;
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl, onLost, onRestored]);

  return null;
}

function resolveMarkerLod(distance: number, current: GlobeMarkerLod) {
  if (current === "near") {
    if (distance > 6.35) return "far";
    if (distance > 4.68) return "medium";
    return "near";
  }
  if (current === "medium") {
    if (distance < 4.2) return "near";
    if (distance > 6.35) return "far";
    return "medium";
  }
  if (distance < 4.2) return "near";
  if (distance < 5.88) return "medium";
  return "far";
}

function markerClusterKey(thinker: Thinker) {
  const anchor = thinker.anchors[0];
  return String(Math.round(anchor.lat * 4) / 4) + ":" + String(Math.round(anchor.lon * 4) / 4);
}

function MarkerLayoutController({
  mode,
  detailOpen,
  visibleThinkerIds,
  storyThinkerIds,
  selectedThinkerId,
  selectedRelationId,
  onLayout,
}: {
  mode: AtlasMode;
  detailOpen: boolean;
  visibleThinkerIds: Set<string>;
  storyThinkerIds: Set<string>;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  onLayout: (layout: GlobeMarkerLayoutItem[], anchorBudget: number) => void;
}) {
  const lodRef = useRef<GlobeMarkerLod>("far");
  const lastUpdateRef = useRef(-1);
  const lastSignatureRef = useRef("");
  const selectedRelation = selectedRelationId
    ? relations.find((relation) => relation.id === selectedRelationId)
    : undefined;
  const selectedEndpoints = useMemo(
    () => new Set(selectedRelation ? [selectedRelation.from, selectedRelation.to] : []),
    [selectedRelation],
  );

  useFrame(({ camera, clock, size }) => {
    const elapsed = clock.elapsedTime;
    if (lastUpdateRef.current >= 0 && elapsed - lastUpdateRef.current < 1 / 30) return;
    lastUpdateRef.current = elapsed;

    const cameraDistance = camera.position.length();
    lodRef.current = resolveMarkerLod(cameraDistance, lodRef.current);
    const cameraPosition = camera.position;
    const candidates = thinkers
      .map((thinker, index) => {
        if (!visibleThinkerIds.has(thinker.id)) return null;
        const point = latLonToVector3(
          thinker.anchors[0].lat,
          thinker.anchors[0].lon,
          MARKER_RADIUS,
        );
        const projected = point.clone().project(camera);
        const normal = point.clone().normalize();
        const frontFacing = normal.dot(cameraPosition) > MARKER_RADIUS + 0.01;
        let priority = thinkers.length - index;
        if (storyThinkerIds.has(thinker.id)) priority += 4_000;
        if (selectedEndpoints.has(thinker.id)) priority += 8_000;
        if (selectedThinkerId === thinker.id) priority += 12_000;
        return {
          id: thinker.id,
          name: thinker.name,
          x: (projected.x * 0.5 + 0.5) * size.width,
          y: (-projected.y * 0.5 + 0.5) * size.height,
          priority,
          selected: selectedThinkerId === thinker.id,
          clusterKey: markerClusterKey(thinker),
          frontFacing,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

    const anchorBudget = size.width < 620 ? 16 : 36;
    const layout = layoutGlobeMarkers(
      candidates,
      { width: size.width, height: size.height },
      cameraDistance,
      {
        lodOverride: lodRef.current,
        exclusionRects: getGlobeMarkerExclusionRects(size, mode, detailOpen),
        viewportPadding: size.width < 620 ? 8 : 16,
        collisionPadding: size.width < 620 ? 6 : 9,
        maxVisible: size.width < 620
          ? { far: 6, medium: 10, near: 16 }
          : { far: 11, medium: 20, near: 36 },
      },
    );

    const signature = layout
      .map((item) => [
        item.id,
        item.visible ? 1 : 0,
        Math.round(item.screenX * 2),
        Math.round(item.screenY * 2),
        item.lod,
        item.clusterCount,
        anchorBudget,
      ].join(":"))
      .join("|");
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      onLayout(layout, anchorBudget);
    }
  });

  return null;
}

function GlobeScene({
  onMarkerLayout,
  markerLayout,
  anchorBudget,
  hoveredRelationId,
  bloomEnabled,
  stableGpuProfile,
  onHoverRelation,
  ...props
}: Omit<GlobeCanvasProps, "onFallback"> & {
  onMarkerLayout: (layout: GlobeMarkerLayoutItem[], anchorBudget: number) => void;
  markerLayout: GlobeMarkerLayoutItem[];
  anchorBudget: number;
  hoveredRelationId: string | null;
  onHoverRelation: (id: string | null) => void;
  bloomEnabled: boolean;
  stableGpuProfile: boolean;
}) {
  const globeRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const directorAbortRef = useRef<(() => void) | null>(null);
  const bloomGroupRef = useRef<THREE.Group | null>(null);
  const currentChapter = storyChapters[props.chapterIndex] ?? storyChapters[0];
  const activeStoryFocus = useMemo<GlobeStoryFocus>(() => props.storyFocus ?? ({
    key: currentChapter.id,
    camera: currentChapter.camera,
    thinkerIds: currentChapter.thinkerIds,
    relationIds: currentChapter.relationIds,
    thematicTransitions: [],
  }), [currentChapter, props.storyFocus]);
  const storyThinkerIds = useMemo(
    () => new Set(activeStoryFocus.thinkerIds),
    [activeStoryFocus.thinkerIds],
  );
  const storyRelationIds = useMemo(
    () => new Set(activeStoryFocus.relationIds),
    [activeStoryFocus.relationIds],
  );
  const selectedRelation = props.selectedRelationId
    ? relations.find((relation) => relation.id === props.selectedRelationId)
    : undefined;
  const selectedRelationEndpoints = useMemo(
    () => new Set(selectedRelation ? [selectedRelation.from, selectedRelation.to] : []),
    [selectedRelation],
  );
  const hoveredRelation = hoveredRelationId
    ? relations.find((relation) => relation.id === hoveredRelationId)
    : undefined;
  const hoveredRelationEndpoints = useMemo(
    () => new Set(hoveredRelation ? [hoveredRelation.from, hoveredRelation.to] : []),
    [hoveredRelation],
  );
  const focusedThinkerIds = useMemo(
    () => getFocusedThinkerIds(props.selectedThinkerId, props.focusDepth, relations),
    [props.focusDepth, props.selectedThinkerId],
  );
  const mountedAnchorIds = useMemo(
    () => getGlobeAnchorMountIds(
      markerLayout,
      [
        props.selectedThinkerId,
        selectedRelation?.from,
        selectedRelation?.to,
      ],
      anchorBudget,
    ),
    [anchorBudget, markerLayout, props.selectedThinkerId, selectedRelation],
  );
  const visibleThinkerIds = useMemo(
    () => new Set(
      thinkers
        .filter((thinker) => {
          if (props.mode === "story" && props.storyFocus) return storyThinkerIds.has(thinker.id);
          if (props.mode === "story") return true;
          const questionMatch = !props.activeQuestionId
            || thinker.questionIds.includes(props.activeQuestionId);
          return questionMatch && thinker.startYear <= props.timelineYear;
        })
        .map((thinker) => thinker.id),
    ),
    [props.activeQuestionId, props.mode, props.storyFocus, props.timelineYear, storyThinkerIds],
  );
  const shared = useMemo<SharedEarthUniforms>(() => ({
    uSunDirection: { value: new THREE.Vector3(4, 2.5, 5).normalize() },
    uNightMix: { value: props.earthMode === "night" ? 1 : 0 },
    uCloudOffset: { value: 0 },
  // Deliberately stable: the director animates these shared objects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  return (
    <>
      <color attach="background" args={["#020407"]} />
      <fog attach="fog" args={["#020407", 9.5, 18]} />
      <StarField quality={props.quality} />
      <group>
        <Suspense fallback={<LegacyEarth globeRef={globeRef} />}>
          <EarthSystem
            globeRef={globeRef}
            quality={props.quality}
            reduceMotion={props.reduceMotion}
            shared={shared}
            stableGpuProfile={stableGpuProfile}
          />
        </Suspense>
        <CountryBorders quality={props.quality} />
        <group ref={bloomGroupRef}>
          <Atmosphere quality={props.quality} shared={shared} />
          {relations.map((relation) => {
          const endpointsVisible = visibleThinkerIds.has(relation.from)
            && visibleThinkerIds.has(relation.to);
          const incidentToSelection = Boolean(
            props.selectedThinkerId
            && (relation.from === props.selectedThinkerId || relation.to === props.selectedThinkerId),
          );
          const selected = props.selectedRelationId === relation.id;
          const hovered = hoveredRelationId === relation.id;
          const storyEmphasis = props.mode === "story" && storyRelationIds.has(relation.id);
          const emphasized = selected || incidentToSelection || storyEmphasis;
          const dimmed = Boolean(
            focusedThinkerIds
            && (!focusedThinkerIds.has(relation.from) || !focusedThinkerIds.has(relation.to)),
          );
          const visible = endpointsVisible && (
            (props.mode === "explore" && (!props.timelineScrubbing || selected || incidentToSelection))
            || storyEmphasis
            || selected
          );
          return (
            <RelationArc
              key={relation.id}
              relation={relation}
              emphasized={emphasized}
              selected={selected}
              hovered={hovered}
              dimmed={dimmed}
              visible={visible}
              animate={selected || storyEmphasis || incidentToSelection}
              quality={props.timelineScrubbing && props.quality === "high" ? "medium" : props.quality}
              reduceMotion={props.reduceMotion}
              onSelect={props.onSelectRelation}
              onHover={onHoverRelation}
            />
          );
          })}
          {props.mode === "story" ? activeStoryFocus.thematicTransitions.map((transition) => (
            <ThematicJourneyArc
              key={`${transition.from}-${transition.to}`}
              transition={transition}
              quality={props.quality}
              reduceMotion={props.reduceMotion}
            />
          )) : null}
          {thinkers
          .filter((thinker) => mountedAnchorIds.has(thinker.id))
          .map((thinker) => (
            <ThinkerAnchor
              key={thinker.id}
              thinker={thinker}
              emphasized={
                props.selectedThinkerId === thinker.id
                || selectedRelationEndpoints.has(thinker.id)
                || (props.mode === "story" && storyThinkerIds.has(thinker.id))
              }
              selected={props.selectedThinkerId === thinker.id}
              hovered={hoveredRelationEndpoints.has(thinker.id)}
              dimmed={Boolean(focusedThinkerIds && !focusedThinkerIds.has(thinker.id))}
              quality={props.quality}
              onSelect={props.onSelectThinker}
            />
          ))}
        </group>
      </group>
      <OrbitControls
        ref={controlsRef}
        enabled
        enablePan={false}
        enableDamping={!props.reduceMotion}
        dampingFactor={0.072}
        rotateSpeed={0.42}
        zoomSpeed={0.58}
        zoomToCursor
        onStart={() => {
          directorAbortRef.current?.();
          if (props.mode === "story" && props.isPlaying) props.onStoryInterruption();
        }}
        onChange={() => {
          const controls = controlsRef.current;
          if (controls && controls.target.length() > 0.58) controls.target.setLength(0.58);
        }}
        minDistance={2.78}
        maxDistance={8.2}
        minPolarAngle={0.13}
        maxPolarAngle={Math.PI - 0.13}
      />
      <CameraDirector
        controlsRef={controlsRef}
        abortRef={directorAbortRef}
        mode={props.mode}
        chapterIndex={props.chapterIndex}
        storyFocus={activeStoryFocus}
        selectedThinkerId={props.selectedThinkerId}
        selectedRelationId={props.selectedRelationId}
        reduceMotion={props.reduceMotion}
        onSnapshotChange={props.onCameraSnapshotChange}
        suppressInitialDirection={Boolean(props.cameraSnapshot)}
      />
      <CameraStateBridge
        controlsRef={controlsRef}
        initialSnapshot={props.cameraSnapshot}
        onSnapshotChange={props.onCameraSnapshotChange}
      />
      <DayNightDirector
        earthMode={props.earthMode}
        reduceMotion={props.reduceMotion}
        shared={shared}
      />
      <MarkerLayoutController
        mode={props.mode}
        detailOpen={props.detailOpen}
        visibleThinkerIds={visibleThinkerIds}
        storyThinkerIds={storyThinkerIds}
        selectedThinkerId={props.selectedThinkerId}
        selectedRelationId={props.selectedRelationId}
        onLayout={onMarkerLayout}
      />
      <FramePerformanceReporter onSample={props.onPerformanceSample} />
      {props.quality !== "low" ? (
        <Suspense fallback={null}>
          <AtlasPostprocessing selection={bloomGroupRef} bloomEnabled={bloomEnabled} />
        </Suspense>
      ) : null}
    </>
  );
}

function markerStyle(
  item: GlobeMarkerLayoutItem | undefined,
  thinker: Thinker,
): CSSProperties {
  const x = item?.screenX ?? -200;
  const y = item?.screenY ?? -200;
  const scale = item?.visible ? item.scale : Math.max(0.62, (item?.scale ?? 0.72) - 0.1);
  return {
    "--node-color": thinker.color,
    transform:
      "translate3d(" + String(x) + "px," + String(y) + "px,0) "
      + "translate(-50%,-50%) scale(" + String(scale) + ")",
  } as CSSProperties;
}

function MarkerLeader({ item }: { item: GlobeMarkerLayoutItem }) {
  const length = Math.hypot(item.offsetX, item.offsetY);
  if (length < 12) return null;
  const angle = Math.atan2(-item.offsetY, -item.offsetX);
  return (
    <span
      className="globe-marker__leader"
      aria-hidden="true"
      style={{
        width: Math.min(length, 150),
        transform: "rotate(" + String(angle) + "rad)",
      }}
    />
  );
}

export default function GlobeCanvas(props: GlobeCanvasProps) {
  const [gpuProfile] = useState(getInitialGpuProfile);
  const powerPreference: GlobePowerPreference = gpuProfile.windowsEdge ? "default" : "high-performance";
  const [webglStatus, setWebglStatus] = useState<WebglRuntimeStatus>(() =>
    typeof document === "undefined"
      ? "checking"
      : gpuProfile.suspectedRendererCrash
        ? "checking"
        : getWebgl2Availability(powerPreference) ? "ready" : "unsupported",
  );
  const [attempt, setAttempt] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [markerLayout, setMarkerLayout] = useState<GlobeMarkerLayoutItem[]>([]);
  const [anchorBudget, setAnchorBudget] = useState(0);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [renderSize, setRenderSize] = useState(() => ({
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const [warmedQualityKey, setWarmedQualityKey] = useState<string | null>(null);
  const [contextLossCount, setContextLossCount] = useState(0);
  const runtimeRef = useRef<HTMLDivElement | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const runtimeRecoveryRef = useRef(false);
  const { onRuntimeFallback } = props;

  useEffect(() => {
    if (webglStatus !== "checking") return;
    const delay = gpuProfile.suspectedRendererCrash && retryCount === 0 ? 2_500 : 0;
    const timer = window.setTimeout(() => {
      cachedWebgl2Availability.delete(powerPreference);
      setWebglStatus(getWebgl2Availability(powerPreference) ? "ready" : "unsupported");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [gpuProfile.suspectedRendererCrash, powerPreference, retryCount, webglStatus]);

  useEffect(() => {
    if (!gpuProfile.windowsEdge) return;
    try {
      window.sessionStorage.setItem(EDGE_GPU_SESSION_KEY, "active");
    } catch {
      return;
    }
    const markCleanExit = () => {
      try {
        window.sessionStorage.setItem(EDGE_GPU_SESSION_KEY, "clean");
      } catch {
        // Storage can disappear when the browser is shutting down.
      }
    };
    window.addEventListener("pagehide", markCleanExit);
    return () => window.removeEventListener("pagehide", markCleanExit);
  }, [gpuProfile.windowsEdge]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (webglStatus !== "ready" || props.quality !== "high") return;
    const qualityKey = `${attempt}:${contextLossCount}`;
    if (warmedQualityKey === qualityKey) return;
    const timer = window.setTimeout(
      () => setWarmedQualityKey(qualityKey),
      GLOBE_HIGH_QUALITY_WARMUP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [attempt, contextLossCount, props.quality, warmedQualityKey, webglStatus]);

  useEffect(() => {
    const element = runtimeRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      setRenderSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [attempt, webglStatus]);

  const handleContextLost = useCallback(() => {
    runtimeRecoveryRef.current = true;
    setContextLossCount((value) => value + 1);
    onRuntimeFallback();
    setWebglStatus("lost");
  }, [onRuntimeFallback]);

  const handleContextRestored = useCallback(() => {
    runtimeRecoveryRef.current = false;
    setRetryCount(0);
    setWebglStatus("ready");
  }, []);

  const retry = useCallback(() => {
    if (webglStatus === "retrying") return;
    const recoveringRuntime = webglStatus === "lost" || runtimeRecoveryRef.current;
    const nextRetryCount = retryCount + 1;
    if (!recoveringRuntime) cachedWebgl2Availability.delete(powerPreference);
    onRuntimeFallback();
    setRetryCount(nextRetryCount);
    setWebglStatus("retrying");
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (!recoveringRuntime && !getWebgl2Availability(powerPreference)) {
        setWebglStatus("unavailable");
        return;
      }
      runtimeRecoveryRef.current = false;
      setAttempt((value) => value + 1);
      setWebglStatus("ready");
    }, getWebglRetryDelayMs(nextRetryCount, gpuProfile.windowsEdge));
  }, [gpuProfile.windowsEdge, onRuntimeFallback, powerPreference, retryCount, webglStatus]);

  useEffect(() => {
    if (webglStatus !== "lost") return;
    const timer = window.setTimeout(retry, GLOBE_NATIVE_CONTEXT_RESTORE_MS);
    return () => window.clearTimeout(timer);
  }, [retry, webglStatus]);

  const handleMarkerLayout = useCallback((layout: GlobeMarkerLayoutItem[], nextAnchorBudget: number) => {
    setMarkerLayout(layout);
    setAnchorBudget(nextAnchorBudget);
  }, []);

  if (webglStatus === "unsupported" || webglStatus === "unavailable") {
    const edgeNeedsRestart = gpuProfile.windowsEdge && retryCount >= 2;
    return (
      <div className="globe-fallback" role="status" aria-live="polite">
        <span>3D渲染不可用</span>
        <strong>{edgeNeedsRestart
          ? "Edge 的显卡进程没有恢复，请完全退出浏览器后重新打开。"
          : webglStatus === "unavailable"
            ? "显卡仍在恢复，请稍后再次检测。"
            : "当前浏览器没有建立 WebGL2。"}</strong>
        {gpuProfile.windowsEdge ? <small>请确认 Edge 的“使用硬件加速”已开启。</small> : null}
        <div className="globe-fallback__actions">
          <button type="button" onClick={props.onFallback}>打开文字探索</button>
          <button type="button" onClick={retry}>重新尝试3D</button>
        </div>
      </div>
    );
  }

  if (webglStatus === "checking" || webglStatus === "retrying") {
    return (
      <div className="globe-loading" role="status" aria-live="polite">
        <span className="globe-loading__orbit" />
        <strong>{webglStatus === "retrying" ? "正在重新建立3D地球" : "正在点亮思想星图"}</strong>
        <small>{webglStatus === "retrying" ? "正在释放旧画布，并以稳定画质恢复当前位置。" : "内容已经可用，3D地球正在进入现场。"}</small>
        {webglStatus === "retrying" ? (
          <button type="button" className="globe-loading__text-action" onClick={props.onFallback}>打开文字探索</button>
        ) : null}
      </div>
    );
  }

  const renderQuality: QualityTier = props.quality;
  const highQualityReady = warmedQualityKey === `${attempt}:${contextLossCount}`;
  const warmingUp = renderQuality === "high" && (
    !highQualityReady
    || contextLossCount >= 2
    || gpuProfile.suspectedRendererCrash
  );
  const dpr = getRenderPixelRatio(
    renderSize.width,
    renderSize.height,
    typeof window === "undefined" ? 1 : window.devicePixelRatio,
    renderQuality,
    warmingUp,
    gpuProfile.windowsEdge,
  );
  const bloomEnabled = renderQuality === "high"
    && highQualityReady
    && contextLossCount < 2
    && !gpuProfile.windowsEdge;
  const markerById = new Map(markerLayout.map((item) => [item.id, item]));
  const selectedRelation = props.selectedRelationId
    ? relations.find((relation) => relation.id === props.selectedRelationId)
    : undefined;
  const hoveredRelation = hoveredRelationId
    ? relations.find((relation) => relation.id === hoveredRelationId)
    : undefined;
  const focusedThinkerIds = getFocusedThinkerIds(props.selectedThinkerId, props.focusDepth, relations);
  const mountedMarkerIds = new Set(
    markerLayout.filter((item) => item.visible).map((item) => item.id),
  );
  if (props.selectedThinkerId) mountedMarkerIds.add(props.selectedThinkerId);
  if (selectedRelation) {
    mountedMarkerIds.add(selectedRelation.from);
    mountedMarkerIds.add(selectedRelation.to);
  }
  if (hoveredRelation) {
    mountedMarkerIds.add(hoveredRelation.from);
    mountedMarkerIds.add(hoveredRelation.to);
  }
  const mountedThinkers = thinkers.filter((thinker) => mountedMarkerIds.has(thinker.id));

  return (
    <div
      ref={runtimeRef}
      className={"globe-runtime globe-runtime--" + props.earthMode}
      data-render-dpr={dpr.toFixed(2)}
      data-render-effects={bloomEnabled ? "bloom-smaa" : renderQuality === "low" ? "none" : "smaa"}
      data-gpu-profile={gpuProfile.windowsEdge ? "edge-stable" : "standard"}
    >
      <Canvas
        key={attempt}
        dpr={dpr}
        camera={{ position: [0, 0.4, 6.6], fov: 38, near: 0.1, far: 40 }}
        frameloop="demand"
        gl={{
          antialias: false,
          alpha: false,
          stencil: false,
          powerPreference,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = props.earthMode === "night" ? 1.02 : 0.94;
        }}
        aria-label="可旋转缩放的3D思想地球。人物肖像锚定在主要活动区域，发光关系线跨越球面。"
      >
        <WebglContextLifecycle onLost={handleContextLost} onRestored={handleContextRestored} />
        <GlobeScene
          {...props}
          quality={renderQuality}
          anchorBudget={anchorBudget}
          markerLayout={markerLayout}
          hoveredRelationId={hoveredRelationId}
          onHoverRelation={setHoveredRelationId}
          onMarkerLayout={handleMarkerLayout}
          bloomEnabled={bloomEnabled}
          stableGpuProfile={gpuProfile.windowsEdge}
        />
      </Canvas>
      <div className="globe-marker-layer" aria-label="地图人物">
        {mountedThinkers.map((thinker) => {
          const item = markerById.get(thinker.id);
          const visible = Boolean(item?.visible);
          const selected = props.selectedThinkerId === thinker.id;
          const clustered = Boolean(item && item.clusterCount > 1 && item.lod !== "near");
          const dimmed = Boolean(focusedThinkerIds && !focusedThinkerIds.has(thinker.id));
          const hovered = Boolean(
            hoveredRelation
            && (hoveredRelation.from === thinker.id || hoveredRelation.to === thinker.id),
          );
          return (
            <button
              key={thinker.id}
              className={"globe-marker"
                + (selected ? " globe-marker--selected" : "")
                + (dimmed ? " globe-marker--dimmed" : "")
                + (hovered ? " globe-marker--relation-hover" : "")}
              data-visible={visible ? "true" : "false"}
              data-lod={item?.lod ?? getGlobeMarkerLod(8)}
              style={markerStyle(item, thinker)}
              type="button"
              tabIndex={visible ? 0 : -1}
              aria-hidden={!visible}
              aria-label={
                "查看" + thinker.name + "，" + thinker.period
                + (clustered ? "；此地点共" + String(item!.clusterCount) + "人，放大后显示更多人物" : "")
              }
              onClick={() => props.onSelectThinker(thinker.id)}
            >
              {item ? <MarkerLeader item={item} /> : null}
              <span className="globe-marker__portrait">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thinker.media.thumbSrc}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: thinker.media.objectPosition }}
                />
              </span>
              <span className="globe-marker__name">{thinker.name}</span>
              {clustered ? (
                <span className="globe-marker__count" aria-label={"同地点另有" + String(item!.clusterCount - 1) + "人"}>
                  +{item!.clusterCount - 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hoveredRelation ? (
        <div className="relation-hover-card" role="status">
          <small>{relationTypeLabels[hoveredRelation.type]} · {evidenceLabels[hoveredRelation.evidence]}</small>
          <strong>{hoveredRelation.title}</strong>
        </div>
      ) : null}
      {webglStatus === "lost" ? (
        <div className="globe-fallback globe-fallback--overlay" role="status" aria-live="polite">
          <span>3D渲染暂时中断</span>
          <strong>正在等待显卡自行恢复；若未恢复，将自动重建3D地球。</strong>
          <div className="globe-fallback__actions">
            <button type="button" onClick={props.onFallback}>打开文字探索</button>
            <button type="button" disabled>等待显卡恢复…</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
