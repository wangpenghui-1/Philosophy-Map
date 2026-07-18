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
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Line2, LineMaterial, OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  relations,
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
  getGlobeMarkerLod,
  layoutGlobeMarkers,
  type GlobeMarkerLayoutItem,
  type GlobeMarkerLod,
} from "./globe-marker-layout";

const GLOBE_RADIUS = 2;
const MARKER_RADIUS = GLOBE_RADIUS + 0.065;
const DETAIL_BORDERS_URL = "/media/globe/countries-50m.json";
const EARTH_TEXTURE_URLS = [
  "/media/globe/earth-day.jpg",
  "/media/globe/earth-night.png",
  "/media/globe/earth-normal.jpg",
  "/media/globe/earth-specular.jpg",
  "/media/globe/earth-clouds.png",
] as const;

let cachedWebgl2Availability: boolean | null = null;

export type EarthLightingMode = "day" | "night";

interface GlobeCanvasProps {
  mode: AtlasMode;
  earthMode: EarthLightingMode;
  isPlaying: boolean;
  chapterIndex: number;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  activeQuestionId: QuestionId | null;
  timelineYear: number;
  quality: QualityTier;
  reduceMotion: boolean;
  onSelectThinker: (id: string) => void;
  onSelectRelation: (id: string) => void;
  onFallback: () => void;
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

    float ambient = mix(0.15, 0.032, uNightMix);
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
    float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.45);
    float daySide = smoothstep(-0.28, 0.34, lightAmount);
    float terminator = 1.0 - smoothstep(0.0, 0.28, abs(lightAmount));
    vec3 nightAtmosphere = vec3(0.18, 0.25, 0.50);
    vec3 dayAtmosphere = vec3(0.16, 0.54, 0.92);
    vec3 sunset = vec3(0.95, 0.43, 0.15);
    vec3 color = mix(nightAtmosphere, dayAtmosphere, daySide);
    color = mix(color, sunset, terminator * daySide * 0.28);
    float alpha = rim * mix(0.16, 0.40, daySide) * mix(0.94, 1.12, uNightMix);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function getWebgl2Availability() {
  if (cachedWebgl2Availability !== null) return cachedWebgl2Availability;
  try {
    const canvas = document.createElement("canvas");
    cachedWebgl2Availability = Boolean(canvas.getContext("webgl2"));
  } catch {
    cachedWebgl2Availability = false;
  }
  return cachedWebgl2Availability;
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
        for (let index = 0; index < ring.length - step; index += step) {
          const current = ring[index];
          const next = ring[Math.min(index + step, ring.length - 1)];
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
  shared,
}: {
  globeRef: RefObject<THREE.Mesh | null>;
  quality: QualityTier;
  shared: SharedEarthUniforms;
}) {
  const { gl } = useThree();
  const [dayMap, nightMap, normalMap, specularMap, cloudMap] = useTexture(
    EARTH_TEXTURE_URLS as unknown as string[],
  ) as unknown as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture];

  useEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    normalMap.colorSpace = THREE.NoColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;
    cloudMap.colorSpace = THREE.NoColorSpace;
    const anisotropy = Math.min(
      quality === "high" ? 8 : quality === "medium" ? 4 : 2,
      gl.capabilities.getMaxAnisotropy(),
    );
    for (const texture of [dayMap, nightMap, normalMap, specularMap, cloudMap]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
  }, [cloudMap, dayMap, gl, nightMap, normalMap, quality, specularMap]);

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
    uCityIntensity: { value: 1.95 },
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
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const visibleSide = camera.position.clone().normalize();
    const targetSun = earthMode === "day" ? visibleSide : visibleSide.clone().negate();
    const startSun = shared.uSunDirection.value.clone().normalize();
    const targetMix = earthMode === "night" ? 1 : 0;

    if (reduceMotion) {
      shared.uSunDirection.value.copy(targetSun);
      shared.uNightMix.value = targetMix;
      invalidate();
      return;
    }

    const rotation = new THREE.Quaternion().setFromUnitVectors(startSun, targetSun);
    const identity = new THREE.Quaternion();
    const partial = new THREE.Quaternion();
    const progress = { value: 0 };
    const startMix = shared.uNightMix.value;
    const tween = gsap.to(progress, {
      value: 1,
      duration: 0.95,
      ease: "power2.inOut",
      onUpdate: () => {
        partial.slerpQuaternions(identity, rotation, progress.value);
        shared.uSunDirection.value.copy(startSun).applyQuaternion(partial).normalize();
        shared.uNightMix.value = THREE.MathUtils.lerp(startMix, targetMix, progress.value);
        invalidate();
      },
    });

    return () => {
      tween.kill();
    };
  }, [camera, earthMode, invalidate, reduceMotion, shared]);

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
  const arcHeight = THREE.MathUtils.clamp(angularDistance * 0.32, 0.13, 0.48);
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const progress = index / pointCount;
    const point = start.clone().lerp(end, progress).normalize();
    const altitude = GLOBE_RADIUS + 0.05 + Math.sin(Math.PI * progress) * arcHeight;
    points.push(point.multiplyScalar(altitude));
  }
  return points;
}

function relationColor(relation: Relation) {
  if (relation.type === "lineage") return "#72deb2";
  if (relation.type === "thematic-resonance") return "#58cff2";
  return "#a98cff";
}

function RelationArc({
  relation,
  emphasized,
  selected,
  visible,
  animate,
  quality,
  reduceMotion,
  onSelect,
}: {
  relation: Relation;
  emphasized: boolean;
  selected: boolean;
  visible: boolean;
  animate: boolean;
  quality: QualityTier;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}) {
  const points = useMemo(() => greatCirclePoints(relation, quality), [quality, relation]);
  const pulseRef = useRef<Line2 | null>(null);
  const { invalidate } = useThree();
  const color = relationColor(relation);
  const isResonance = relation.type === "thematic-resonance";

  useEffect(() => {
    if (!animate || reduceMotion || !pulseRef.current) return;
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
  }, [animate, invalidate, reduceMotion, relation.directed, relation.id, selected]);

  if (!visible || points.length === 0) return null;
  const showHalo = selected || (emphasized && quality !== "low");

  const handleSelect = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(relation.id);
  };

  return (
    <group>
      {showHalo ? (
        <Line
          points={points}
          color={color}
          lineWidth={selected ? 11 : 7}
          transparent
          opacity={selected ? 0.2 : 0.08}
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
        lineWidth={selected ? 2.7 : emphasized ? 1.6 : 0.72}
        transparent
        opacity={selected ? 0.98 : emphasized ? 0.76 : 0.11}
        dashed={isResonance}
        dashSize={0.08}
        gapSize={0.055}
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
          opacity={reduceMotion ? 0.5 : 0.92}
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

function ThinkerAnchor({
  thinker,
  active,
  visible,
  selected,
  quality,
  onSelect,
}: {
  thinker: Thinker;
  active: boolean;
  visible: boolean;
  selected: boolean;
  quality: QualityTier;
  onSelect: (id: string) => void;
}) {
  const point = useMemo(
    () => latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, GLOBE_RADIUS + 0.04),
    [thinker],
  );
  if (!visible) return null;

  return (
    <group position={point} scale={selected ? 1.35 : active ? 1 : 0.72}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(thinker.id);
        }}
      >
        <sphereGeometry args={[selected ? 0.04 : 0.026, quality === "low" ? 10 : 16, quality === "low" ? 10 : 16]} />
        <meshBasicMaterial
          color={thinker.color}
          transparent
          opacity={selected ? 1 : active ? 0.82 : 0.34}
          toneMapped={false}
        />
      </mesh>
      {active || selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[selected ? 0.082 : 0.058, 0.004, 8, quality === "low" ? 24 : 40]} />
          <meshBasicMaterial
            color={thinker.color}
            transparent
            opacity={selected ? 0.92 : 0.46}
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
  mode,
  chapterIndex,
  selectedThinkerId,
  reduceMotion,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  mode: AtlasMode;
  chapterIndex: number;
  selectedThinkerId: string | null;
  reduceMotion: boolean;
}) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const thinker = selectedThinkerId ? thinkerById.get(selectedThinkerId) : undefined;
    const destination = thinker
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 3.72)
      : cameraPositionFromPreset(storyChapters[chapterIndex]?.camera ?? storyChapters[0].camera);
    const target = thinker
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 0.42)
      : new THREE.Vector3(0, 0, 0);
    const duration = reduceMotion ? 0.12 : thinker ? 0.92 : mode === "story" ? 1.75 : 1.05;

    const context = gsap.context(() => {
      gsap.to(camera.position, {
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
      gsap.to(controls.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          controls.update();
          invalidate();
        },
      });
    });

    return () => context.revert();
  }, [camera, chapterIndex, controlsRef, invalidate, mode, reduceMotion, selectedThinkerId]);

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
  visibleThinkerIds,
  storyThinkerIds,
  selectedThinkerId,
  selectedRelationId,
  onLayout,
}: {
  visibleThinkerIds: Set<string>;
  storyThinkerIds: Set<string>;
  selectedThinkerId: string | null;
  selectedRelationId: string | null;
  onLayout: (layout: GlobeMarkerLayoutItem[]) => void;
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

    const layout = layoutGlobeMarkers(
      candidates,
      { width: size.width, height: size.height },
      cameraDistance,
      {
        lodOverride: lodRef.current,
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
      ].join(":"))
      .join("|");
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      onLayout(layout);
    }
  });

  return null;
}

function GlobeScene({
  onMarkerLayout,
  ...props
}: Omit<GlobeCanvasProps, "onFallback"> & {
  onMarkerLayout: (layout: GlobeMarkerLayoutItem[]) => void;
}) {
  const globeRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const currentChapter = storyChapters[props.chapterIndex] ?? storyChapters[0];
  const storyThinkerIds = useMemo(
    () => new Set(currentChapter.thinkerIds),
    [currentChapter.thinkerIds],
  );
  const storyRelationIds = useMemo(
    () => new Set(currentChapter.relationIds),
    [currentChapter.relationIds],
  );
  const visibleThinkerIds = useMemo(
    () => new Set(
      thinkers
        .filter((thinker) => {
          if (props.mode === "story") return true;
          const questionMatch = !props.activeQuestionId
            || thinker.questionIds.includes(props.activeQuestionId);
          return questionMatch && thinker.startYear <= props.timelineYear;
        })
        .map((thinker) => thinker.id),
    ),
    [props.activeQuestionId, props.mode, props.timelineYear],
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
          <EarthSystem globeRef={globeRef} quality={props.quality} shared={shared} />
        </Suspense>
        <CountryBorders quality={props.quality} />
        <Atmosphere quality={props.quality} shared={shared} />
        {relations.map((relation) => {
          const endpointsVisible = visibleThinkerIds.has(relation.from)
            && visibleThinkerIds.has(relation.to);
          const incidentToSelection = Boolean(
            props.selectedThinkerId
            && (relation.from === props.selectedThinkerId || relation.to === props.selectedThinkerId),
          );
          const selected = props.selectedRelationId === relation.id;
          const storyEmphasis = props.mode === "story" && storyRelationIds.has(relation.id);
          const emphasized = selected || incidentToSelection || storyEmphasis;
          const visible = endpointsVisible && (
            props.mode === "explore"
            || storyEmphasis
            || selected
          );
          return (
            <RelationArc
              key={relation.id}
              relation={relation}
              emphasized={emphasized}
              selected={selected}
              visible={visible}
              animate={selected || storyEmphasis}
              quality={props.quality}
              reduceMotion={props.reduceMotion}
              onSelect={props.onSelectRelation}
            />
          );
        })}
        {thinkers.map((thinker) => (
          <ThinkerAnchor
            key={thinker.id}
            thinker={thinker}
            active={props.mode === "explore" || storyThinkerIds.has(thinker.id)}
            visible={visibleThinkerIds.has(thinker.id)}
            selected={props.selectedThinkerId === thinker.id}
            quality={props.quality}
            onSelect={props.onSelectThinker}
          />
        ))}
      </group>
      <OrbitControls
        ref={controlsRef}
        enabled={props.mode === "explore" || !props.isPlaying}
        enablePan={false}
        enableDamping={!props.reduceMotion}
        dampingFactor={0.072}
        rotateSpeed={0.42}
        zoomSpeed={0.58}
        zoomToCursor
        minDistance={2.78}
        maxDistance={8.2}
        minPolarAngle={0.13}
        maxPolarAngle={Math.PI - 0.13}
      />
      <CameraDirector
        controlsRef={controlsRef}
        mode={props.mode}
        chapterIndex={props.chapterIndex}
        selectedThinkerId={props.selectedThinkerId}
        reduceMotion={props.reduceMotion}
      />
      <DayNightDirector
        earthMode={props.earthMode}
        reduceMotion={props.reduceMotion}
        shared={shared}
      />
      <MarkerLayoutController
        visibleThinkerIds={visibleThinkerIds}
        storyThinkerIds={storyThinkerIds}
        selectedThinkerId={props.selectedThinkerId}
        selectedRelationId={props.selectedRelationId}
        onLayout={onMarkerLayout}
      />
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
  const [webgl2Available, setWebgl2Available] = useState<boolean | null>(() =>
    typeof document === "undefined" ? null : getWebgl2Availability(),
  );
  const [attempt, setAttempt] = useState(0);
  const [markerLayout, setMarkerLayout] = useState<GlobeMarkerLayoutItem[]>([]);
  const { onFallback } = props;

  useEffect(() => {
    if (webgl2Available === false) onFallback();
  }, [onFallback, webgl2Available]);

  const retry = () => {
    cachedWebgl2Availability = null;
    setWebgl2Available(getWebgl2Availability());
    setAttempt((value) => value + 1);
  };

  const handleMarkerLayout = useCallback((layout: GlobeMarkerLayoutItem[]) => {
    setMarkerLayout(layout);
  }, []);

  if (webgl2Available === false) {
    return (
      <div className="globe-fallback" role="status">
        <span>3D渲染不可用</span>
        <strong>内容仍然完整。</strong>
        <div className="globe-fallback__actions">
          <button type="button" onClick={props.onFallback}>打开文字探索</button>
          <button type="button" onClick={retry}>重新尝试3D</button>
        </div>
      </div>
    );
  }

  if (webgl2Available === null) {
    return (
      <div className="globe-loading" role="status" aria-live="polite">
        <span className="globe-loading__orbit" />
        <strong>正在点亮思想星图</strong>
        <small>内容已经可用，3D地球正在进入现场。</small>
      </div>
    );
  }

  const dpr: [number, number] =
    props.quality === "high" ? [1, 1.65] : props.quality === "medium" ? [0.85, 1.3] : [0.7, 1];
  const markerById = new Map(markerLayout.map((item) => [item.id, item]));
  const selectedRelation = props.selectedRelationId
    ? relations.find((relation) => relation.id === props.selectedRelationId)
    : undefined;
  const mountedMarkerIds = new Set(
    markerLayout.filter((item) => item.visible).map((item) => item.id),
  );
  if (props.selectedThinkerId) mountedMarkerIds.add(props.selectedThinkerId);
  if (selectedRelation) {
    mountedMarkerIds.add(selectedRelation.from);
    mountedMarkerIds.add(selectedRelation.to);
  }
  const mountedThinkers = thinkers.filter((thinker) => mountedMarkerIds.has(thinker.id));

  return (
    <div className={"globe-runtime globe-runtime--" + props.earthMode}>
      <Canvas
        key={attempt}
        dpr={dpr}
        camera={{ position: [0, 0.4, 6.6], fov: 38, near: 0.1, far: 40 }}
        frameloop="demand"
        gl={{
          antialias: props.quality !== "low",
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = props.earthMode === "night" ? 1.02 : 0.94;
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            cachedWebgl2Availability = false;
            setWebgl2Available(false);
          }, { once: true });
        }}
        aria-label="可旋转缩放的3D思想地球。人物肖像锚定在主要活动区域，发光关系线跨越球面。"
      >
        <GlobeScene {...props} onMarkerLayout={handleMarkerLayout} />
      </Canvas>
      <div className="globe-marker-layer" aria-label="地图人物">
        {mountedThinkers.map((thinker) => {
          const item = markerById.get(thinker.id);
          const visible = Boolean(item?.visible);
          const selected = props.selectedThinkerId === thinker.id;
          const clustered = Boolean(item && item.clusterCount > 1 && item.lod !== "near");
          return (
            <button
              key={thinker.id}
              className={"globe-marker" + (selected ? " globe-marker--selected" : "")}
              data-visible={visible ? "true" : "false"}
              data-lod={item?.lod ?? getGlobeMarkerLod(8)}
              style={markerStyle(item, thinker)}
              type="button"
              tabIndex={visible ? 0 : -1}
              aria-hidden={!visible}
              aria-label={"查看" + thinker.name + "，" + thinker.period}
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
    </div>
  );
}
