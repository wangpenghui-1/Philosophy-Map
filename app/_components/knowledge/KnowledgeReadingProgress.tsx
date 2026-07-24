"use client";

import { useEffect, useState } from "react";

export default function KnowledgeReadingProgress() {
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

  return (
    <div className="knowledge-reading-progress" aria-hidden="true">
      <span style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
