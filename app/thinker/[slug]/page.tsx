import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasApp from "../../_components/AtlasApp";
import { thinkerBySlug, thinkers } from "../../_data/atlas";

export function generateStaticParams() {
  return thinkers.map((thinker) => ({ slug: thinker.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const thinker = thinkerBySlug.get(slug);
  if (!thinker) return {};
  return {
    title: `${thinker.name} · ${thinker.englishName}`,
    description: `${thinker.question} ${thinker.thesis}`,
  };
}

export default async function ThinkerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!thinkerBySlug.has(slug)) notFound();
  return <AtlasApp initialMode="explore" initialThinkerSlug={slug} />;
}

