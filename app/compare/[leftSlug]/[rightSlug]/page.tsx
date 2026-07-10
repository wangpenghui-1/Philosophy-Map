import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasApp from "../../../_components/AtlasApp";
import { thinkerBySlug, thinkers } from "../../../_data/atlas";

export function generateStaticParams() {
  return thinkers.flatMap((left, leftIndex) =>
    thinkers.slice(leftIndex + 1).map((right) => ({ leftSlug: left.slug, rightSlug: right.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ leftSlug: string; rightSlug: string }> }): Promise<Metadata> {
  const { leftSlug, rightSlug } = await params;
  const left = thinkerBySlug.get(leftSlug);
  const right = thinkerBySlug.get(rightSlug);
  if (!left || !right) return {};
  return { title: `${left.name} × ${right.name}`, description: `比较${left.name}与${right.name}的问题、主张与思想背景。` };
}

export default async function ComparePage({ params }: { params: Promise<{ leftSlug: string; rightSlug: string }> }) {
  const { leftSlug, rightSlug } = await params;
  if (!thinkerBySlug.has(leftSlug) || !thinkerBySlug.has(rightSlug) || leftSlug === rightSlug) notFound();
  return <AtlasApp initialMode="explore" initialCompareSlugs={[leftSlug, rightSlug]} />;
}

