"use client";

import { EffectComposer, SelectiveBloom, SMAA } from "@react-three/postprocessing";
import type { RefObject } from "react";
import type { Object3D } from "three";

export default function AtlasPostprocessing({
  selection,
}: {
  selection: RefObject<Object3D | null>;
}) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SelectiveBloom
        selection={selection as RefObject<Object3D>}
        intensity={0.72}
        luminanceThreshold={0.28}
        luminanceSmoothing={0.72}
        mipmapBlur
        ignoreBackground
      />
      <SMAA />
    </EffectComposer>
  );
}
