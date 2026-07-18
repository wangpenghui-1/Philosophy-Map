import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AtlasApp from "../../../_components/AtlasApp";
import { thinkerBySlug, thinkers } from "../../../_data/atlas";

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
  const leftIndex = thinkers.findIndex((thinker) => thinker.slug === leftSlug);
  const rightIndex = thinkers.findIndex((thinker) => thinker.slug === rightSlug);
  if (leftIndex > rightIndex) redirect(`/compare/${rightSlug}/${leftSlug}`);
  return <AtlasApp initialMode="explore" initialCompareSlugs={[leftSlug, rightSlug]} />;
}
