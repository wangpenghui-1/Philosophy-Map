import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasApp from "../../_components/AtlasApp";
import { storyChapters } from "../../_data/atlas";

export function generateStaticParams() {
  return storyChapters.map((chapter) => ({ chapterId: chapter.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ chapterId: string }> }): Promise<Metadata> {
  const { chapterId } = await params;
  const chapter = storyChapters.find((item) => item.id === chapterId);
  if (!chapter) return {};
  return { title: chapter.title, description: chapter.body };
}

export default async function StoryChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  if (!storyChapters.some((chapter) => chapter.id === chapterId)) notFound();
  return <AtlasApp initialMode="story" initialChapterId={chapterId} />;
}

