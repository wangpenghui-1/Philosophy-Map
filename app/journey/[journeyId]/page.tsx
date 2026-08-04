import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AtlasApp from "../../_components/AtlasApp";
import { journeyCatalog, journeyById } from "../../_data/journeys";

export function generateStaticParams() {
  return journeyCatalog
    .filter((journey) => journey.availability === "available")
    .map((journey) => ({ journeyId: journey.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}): Promise<Metadata> {
  const { journeyId } = await params;
  const journey = journeyById.get(journeyId);
  if (!journey || journey.availability !== "available") return {};
  return {
    title: `${journey.title}思想旅程`,
    description: journey.description,
  };
}

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ journeyId: string }>;
}) {
  const { journeyId } = await params;
  const journey = journeyById.get(journeyId);
  if (!journey || journey.availability !== "available") notFound();
  return <AtlasApp initialMode="story" initialJourneyId={journeyId} />;
}
