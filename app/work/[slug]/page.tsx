import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitationList, KnowledgePage, KnowledgeTierBadge, RelatedLinks } from "../../_components/knowledge/KnowledgeChrome";
import { getKnowledgeWork, knowledgeBase, knowledgeConceptById, knowledgePersonById, knowledgeTraditionById } from "../../_data/knowledge";

export function generateStaticParams() { return knowledgeBase.works.map((item) => ({ slug: item.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const item = getKnowledgeWork((await params).slug); return item ? { title: item.title, description: item.summary } : {}; }
export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = getKnowledgeWork((await params).slug); if (!item) notFound();
  const people = item.authorRefs.map(({ personId }) => knowledgePersonById.get(personId)).filter(Boolean); const concepts = item.conceptIds.map((id) => knowledgeConceptById.get(id)).filter(Boolean); const traditions = item.traditionIds.map((id) => knowledgeTraditionById.get(id)).filter(Boolean);
  return <KnowledgePage><main className="knowledge-article knowledge-article--text"><nav className="knowledge-breadcrumb"><Link href="/knowledge">知识库</Link><span>/</span><span>著作</span><span>/</span><strong>{item.title}</strong></nav>
    <header className="knowledge-text-hero"><KnowledgeTierBadge tier={item.contentTier} /><p>WORK</p><h1>{item.title}</h1>{item.originalTitle ? <h2>{item.originalTitle}</h2> : null}<p>{item.dateLabel}</p><p>{item.summary}</p></header>
    <div className="knowledge-article__layout"><article className="knowledge-prose"><section><h2>版本与归属</h2>{item.authorRefs.map((author) => <p key={`${author.personId}:${author.role}`}>{knowledgePersonById.get(author.personId)?.names.display ?? author.personId} · {author.role} · {author.certainty}</p>)}</section><CitationList citations={item.citations} /></article><aside className="knowledge-sidebar"><RelatedLinks heading="相关人物" items={people.map((person) => ({ href: `/thinker/${person!.slug}`, title: person!.names.display, subtitle: person!.chronology.label }))} /><RelatedLinks heading="核心概念" items={concepts.map((concept) => ({ href: `/concept/${encodeURIComponent(concept!.slug)}`, title: concept!.name }))} /><RelatedLinks heading="思想传统" items={traditions.map((tradition) => ({ href: `/tradition/${encodeURIComponent(tradition!.slug)}`, title: tradition!.name }))} /></aside></div>
  </main></KnowledgePage>;
}
