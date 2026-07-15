"use client";

import { useState, type CSSProperties } from "react";
import type { Thinker } from "../_data/atlas";

interface ThinkerPortraitProps {
  thinker: Thinker;
  variant: "full" | "thumb";
  showNote?: boolean;
  className?: string;
}

export default function ThinkerPortrait({ thinker, variant, showNote = false, className = "" }: ThinkerPortraitProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = variant === "full" ? thinker.media.fullSrc : thinker.media.thumbSrc;
  const failed = failedSource === source;

  return (
    <figure
      className={`thinker-portrait thinker-portrait--${variant}${failed ? " is-fallback" : ""}${className ? ` ${className}` : ""}`}
      style={{ "--portrait-color": thinker.color } as CSSProperties}
    >
      {failed ? (
        <div className="thinker-portrait__fallback" role="img" aria-label={`${thinker.name}的人物形象暂不可用`}>
          <strong>{thinker.name}</strong>
          <span>{thinker.englishName}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={thinker.media.alt}
          width={variant === "full" ? 900 : 320}
          height={variant === "full" ? 1200 : 420}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: thinker.media.objectPosition }}
          onError={() => setFailedSource(source)}
        />
      )}
      {showNote ? <figcaption>{thinker.media.depictionNote}</figcaption> : null}
    </figure>
  );
}
