"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { gsap } from "gsap";
import * as THREE from "three";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Topology } from "topojson-specification";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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

const GLOBE_RADIUS = 2;
let cachedWebgl2Availability: boolean | null = null;

function getWebgl2Availability() {
  if (cachedWebgl2Availability !== null) return cachedWebgl2Availability;
  const canvas = document.createElement("canvas");
  cachedWebgl2Availability = Boolean(canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
  return cachedWebgl2Availability;
}

interface GlobeCanvasProps {
  mode: AtlasMode;
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

function CountryBorders({ quality }: { quality: QualityTier }) {
  const geometry = useMemo(() => {
    const topology = worldData as unknown as Topology;
    const countriesObject = topology.objects.countries;
    const countries = feature(topology, countriesObject) as FeatureCollection;
    const positions: number[] = [];
    const step = quality === "low" ? 2 : 1;

    for (const country of countries.features) {
      if (!country.geometry) continue;
      for (const ring of collectRings(country.geometry)) {
        for (let index = 0; index < ring.length - step; index += step) {
          const current = ring[index];
          const next = ring[Math.min(index + step, ring.length - 1)];
          const a = latLonToVector3(current[1], current[0], GLOBE_RADIUS + 0.009);
          const b = latLonToVector3(next[1], next[0], GLOBE_RADIUS + 0.009);
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return result;
  }, [quality]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} renderOrder={2}>
      <lineBasicMaterial
        color="#9c7e48"
        transparent
        opacity={quality === "low" ? 0.34 : 0.5}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function StarField({ quality }: { quality: QualityTier }) {
  const geometry = useMemo(() => {
    const count = quality === "high" ? 850 : quality === "medium" ? 480 : 180;
    const positions = new Float32Array(count * 3);
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
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return result;
  }, [quality]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#d8ceb8"
        size={quality === "high" ? 0.016 : 0.012}
        transparent
        opacity={0.52}
        sizeAttenuation
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function Atmosphere() {
  return (
    <mesh scale={1.055} renderOrder={1}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <shaderMaterial
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float rim = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.7);
            vec3 bronze = vec3(0.67, 0.48, 0.23);
            vec3 indigo = vec3(0.18, 0.28, 0.48);
            vec3 color = mix(bronze, indigo, 0.42);
            gl_FragColor = vec4(color, rim * 0.34);
          }
        `}
      />
    </mesh>
  );
}

function greatCirclePoints(relation: Relation) {
  const from = thinkerById.get(relation.from);
  const to = thinkerById.get(relation.to);
  if (!from || !to) return [];
  const start = latLonToVector3(from.anchors[0].lat, from.anchors[0].lon, GLOBE_RADIUS + 0.045);
  const end = latLonToVector3(to.anchors[0].lat, to.anchors[0].lon, GLOBE_RADIUS + 0.045);
  const points: THREE.Vector3[] = [];

  for (let index = 0; index <= 48; index += 1) {
    const progress = index / 48;
    const point = start.clone().lerp(end, progress).normalize();
    const altitude = GLOBE_RADIUS + 0.055 + Math.sin(Math.PI * progress) * 0.38;
    points.push(point.multiplyScalar(altitude));
  }
  return points;
}

function RelationArc({
  relation,
  active,
  selected,
  visible,
  onSelect,
}: {
  relation: Relation;
  active: boolean;
  selected: boolean;
  visible: boolean;
  onSelect: (id: string) => void;
}) {
  const points = useMemo(() => greatCirclePoints(relation), [relation]);
  if (!visible || points.length === 0) return null;

  const isResonance = relation.type === "thematic-resonance";
  const color = isResonance ? "#d7d2c6" : relation.type === "lineage" ? "#6c9ca2" : "#d0a75e";

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={selected ? 3.4 : active ? 2.2 : 0.75}
        transparent
        opacity={selected ? 0.98 : active ? 0.78 : 0.12}
        dashed={isResonance}
        dashSize={0.075}
        gapSize={0.06}
        dashScale={1}
        depthWrite={false}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(relation.id);
        }}
      />
      {!isResonance && active ? (
        <mesh position={points[Math.floor(points.length / 2)]}>
          <sphereGeometry args={[selected ? 0.032 : 0.022, 12, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function ThinkerNode({
  thinker,
  globeRef,
  active,
  visible,
  selected,
  onSelect,
}: {
  thinker: Thinker;
  globeRef: RefObject<THREE.Mesh>;
  active: boolean;
  visible: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const point = useMemo(
    () => latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, GLOBE_RADIUS + 0.07),
    [thinker],
  );
  const scale = selected ? 1.38 : active ? 1 : 0.78;
  if (!visible) return null;

  return (
    <group position={point} scale={scale}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(thinker.id);
        }}
      >
        <sphereGeometry args={[0.045, 18, 18]} />
        <meshStandardMaterial
          color={thinker.color}
          emissive={thinker.color}
          emissiveIntensity={selected ? 2.1 : active ? 1.4 : 0.42}
          roughness={0.46}
          metalness={0.28}
          transparent
          opacity={active || selected ? 1 : 0.38}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.075, 0.004, 8, 40]} />
        <meshBasicMaterial
          color={thinker.color}
          transparent
          opacity={selected ? 0.9 : active ? 0.56 : 0.16}
          toneMapped={false}
        />
      </mesh>
      <Html
        center
        sprite
        position={[0, 0.15, 0]}
        distanceFactor={7.6}
        occlude={[globeRef]}
        zIndexRange={[30, 0]}
      >
        <button
          className={`globe-label${active || selected ? " globe-label--active" : ""}`}
          style={{ "--node-color": thinker.color } as React.CSSProperties}
          type="button"
          onClick={() => onSelect(thinker.id)}
          aria-label={`查看${thinker.name}，${thinker.period}`}
        >
          <span>{thinker.name}</span>
          <small>{thinker.period}</small>
        </button>
      </Html>
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
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 3.55)
      : cameraPositionFromPreset(storyChapters[chapterIndex]?.camera ?? storyChapters[0].camera);
    const target = thinker
      ? latLonToVector3(thinker.anchors[0].lat, thinker.anchors[0].lon, 0.54)
      : new THREE.Vector3(0, 0, 0);
    const duration = reduceMotion ? 0.12 : thinker ? 1.35 : mode === "story" ? 2.15 : 1.2;

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

function GlobeScene(props: Omit<GlobeCanvasProps, "onFallback">) {
  const globeRef = useRef<THREE.Mesh>(null!);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const currentChapter = storyChapters[props.chapterIndex] ?? storyChapters[0];
  const storyThinkers = new Set(currentChapter.thinkerIds);
  const storyRelations = new Set(currentChapter.relationIds);
  const visibleThinkers = new Set(
    thinkers
      .filter((thinker) => {
        if (props.mode === "story") return true;
        const questionMatch = !props.activeQuestionId || thinker.questionIds.includes(props.activeQuestionId);
        return questionMatch && thinker.startYear <= props.timelineYear;
      })
      .map((thinker) => thinker.id),
  );

  return (
    <>
      <color attach="background" args={["#050606"]} />
      <fog attach="fog" args={["#050606", 8.5, 17]} />
      <ambientLight intensity={0.36} color="#c8b68e" />
      <directionalLight position={[4, 3, 5]} intensity={2.4} color="#d5b77b" />
      <directionalLight position={[-4, -1, -3]} intensity={0.82} color="#486395" />
      <StarField quality={props.quality} />
      <group>
        <mesh ref={globeRef}>
          <sphereGeometry args={[GLOBE_RADIUS, props.quality === "low" ? 48 : 80, props.quality === "low" ? 48 : 80]} />
          <meshPhysicalMaterial
            color="#11130f"
            emissive="#16170e"
            emissiveIntensity={0.55}
            roughness={0.78}
            metalness={0.28}
            clearcoat={0.18}
            clearcoatRoughness={0.72}
          />
        </mesh>
        <mesh scale={1.0025}>
          <sphereGeometry args={[GLOBE_RADIUS, 30, 30]} />
          <meshBasicMaterial
            color="#8f7341"
            wireframe
            transparent
            opacity={props.quality === "low" ? 0.025 : 0.045}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <CountryBorders quality={props.quality} />
        <Atmosphere />
        {relations.map((relation) => {
          const endpointsVisible = visibleThinkers.has(relation.from) && visibleThinkers.has(relation.to);
          return (
            <RelationArc
              key={relation.id}
              relation={relation}
              active={props.mode === "explore" || storyRelations.has(relation.id)}
              selected={props.selectedRelationId === relation.id}
              visible={props.mode === "story" || endpointsVisible}
              onSelect={props.onSelectRelation}
            />
          );
        })}
        {thinkers.map((thinker) => (
          <ThinkerNode
            key={thinker.id}
            thinker={thinker}
            globeRef={globeRef}
            active={props.mode === "explore" || storyThinkers.has(thinker.id)}
            visible={visibleThinkers.has(thinker.id)}
            selected={props.selectedThinkerId === thinker.id}
            onSelect={props.onSelectThinker}
          />
        ))}
      </group>
      <OrbitControls
        ref={controlsRef}
        enabled={props.mode === "explore" || !props.isPlaying}
        enablePan={false}
        enableDamping={!props.reduceMotion}
        dampingFactor={0.055}
        rotateSpeed={0.46}
        zoomSpeed={0.68}
        minDistance={3.1}
        maxDistance={7.8}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI - 0.18}
      />
      <CameraDirector
        controlsRef={controlsRef}
        mode={props.mode}
        chapterIndex={props.chapterIndex}
        selectedThinkerId={props.selectedThinkerId}
        reduceMotion={props.reduceMotion}
      />
    </>
  );
}

export default function GlobeCanvas(props: GlobeCanvasProps) {
  const webgl2Available = useSyncExternalStore(
    () => () => undefined,
    getWebgl2Availability,
    () => null,
  );

  if (webgl2Available === false) {
    return (
      <div className="globe-fallback" role="status">
        <span>3D渲染不可用</span>
        <strong>内容仍然完整。</strong>
        <button type="button" onClick={props.onFallback}>打开文字探索</button>
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
    props.quality === "high" ? [1, 1.75] : props.quality === "medium" ? [0.9, 1.35] : [0.72, 1];

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.4, 6.6], fov: 38, near: 0.1, far: 40 }}
      frameloop={props.mode === "story" && props.isPlaying ? "always" : "demand"}
      gl={{ antialias: props.quality !== "low", alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.92;
      }}
      aria-label="可旋转的3D思想地球。人物节点锚定在主要活动区域，关系线跨越球面。"
    >
      <GlobeScene {...props} />
    </Canvas>
  );
}
