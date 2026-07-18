import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitationList, KnowledgePage, KnowledgeTierBadge, RelatedLinks } from "../../_components/knowledge/KnowledgeChrome";
import { getKnowledgeConcept, knowledgeBase, knowledgePersonById, knowledgeTraditionById, knowledgeWorkById } from "../../_data/knowledge";

export function generateStaticParams() { return knowledgeBase.concepts.map((item) => ({ slug: item.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = getKnowledgeConcept((await params).slug); return item ? { title: `${item.name} · 哲学概念`, description: item.summary } : {};
}
export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = getKnowledgeConcept((await params).slug); if (!item) notFound();
  const people = item.personIds.map((id) => knowledgePersonById.get(id)).filter(Boolean);
  const traditions = item.traditionIds.map((id) => knowledgeTraditionById.get(id)).filter(Boolean);
  const works = item.workIds.map((id) => knowledgeWorkById.get(id)).filter(Boolean);
  return <KnowledgePage><main className="knowledge-article knowledge-article--text">
    <nav className="knowledge-breadcrumb"><Link href="/knowledge">知识库</Link><span>/</span><span>概念</span><span>/</span><strong>{item.name}</strong></nav>
    <header className="knowledge-text-hero"><KnowledgeTierBadge tier={item.contentTier} /><p>CONCEPT</p><h1>{item.name}</h1>{item.originalTerms.length ? <h2>{item.originalTerms.join(" · ")}</h2> : null}<p>{item.summary}</p></header>
    <div className="knowledge-article__layout"><article className="knowledge-prose"><section><h2>传统中的不同含义</h2>{item.senses.map((sense, index) => <article className="knowledge-sense" key={`${sense.traditionId}-${index}`}><small>{knowledgeTraditionById.get(sense.traditionId)?.name ?? sense.label}</small><h3>{sense.label}</h3><p>{sense.explanation}</p></article>)}</section><CitationList citations={item.citations} /></article>
    <aside className="knowledge-sidebar"><RelatedLinks heading="相关人物" items={people.map((person) => ({ href: `/thinker/${person!.slug}`, title: person!.names.display, subtitle: person!.chronology.label }))} /><RelatedLinks heading="思想传统" items={traditions.map((tradition) => ({ href: `/tradition/${encodeURIComponent(tradition!.slug)}`, title: tradition!.name }))} /><RelatedLinks heading="相关著作" items={works.map((work) => ({ href: `/work/${work!.slug}`, title: work!.title, subtitle: work!.dateLabel }))} /></aside></div>
  </main></KnowledgePage>;
}
