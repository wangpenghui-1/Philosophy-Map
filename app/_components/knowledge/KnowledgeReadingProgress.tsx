"use client";

import { useEffect, useState } from "react";

export default function KnowledgeReadingProgress({ entityId }: { entityId?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const maximum = Math.max(1, root.scrollHeight - window.innerHeight);
      setProgress(Math.max(0, Math.min(1, window.scrollY / maximum)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!entityId || progress < 0.05) return;
    const timeout = window.setTimeout(() => {
      void fetch(`/api/v1/me/progress/entity/${encodeURIComponent(entityId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ progress: Math.round(progress * 100) / 100, anchor: window.location.hash || null }),
      });
    }, 1_500);
    return () => window.clearTimeout(timeout);
  }, [entityId, progress]);

  return (
    <div className="knowledge-reading-progress" aria-hidden="true">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
