"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function KnowledgeFavoriteButton({ entityId, returnPath }: { entityId: string; returnPath: string }) {
  const [favorite, setFavorite] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/me/favorites/${encodeURIComponent(entityId)}`)
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { setAvailable(false); return; }
        if (!response.ok) throw new Error("favorite-status-unavailable");
        const payload = await response.json() as { data: { favorite: boolean } };
        if (active) { setFavorite(payload.data.favorite); setAvailable(true); }
      })
      .catch(() => { if (active) setAvailable(null); });
    return () => { active = false; };
  }, [entityId]);

  if (available === false) return <Link href={`/account/login?next=${encodeURIComponent(returnPath)}`}>登录后收藏</Link>;
  return <button
    aria-pressed={favorite}
    disabled={pending}
    onClick={async () => {
      setPending(true);
      try {
        const response = await fetch(`/api/v1/me/favorites/${encodeURIComponent(entityId)}`, { method: favorite ? "DELETE" : "PUT" });
        if (response.status === 401) { setAvailable(false); return; }
        if (response.ok) { setFavorite(!favorite); setAvailable(true); }
      } finally { setPending(false); }
    }}
    type="button"
  >{pending ? "保存中…" : favorite ? "已收藏" : "收藏人物"}</button>;
}
