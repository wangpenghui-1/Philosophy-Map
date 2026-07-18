import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitationList, KnowledgePage, KnowledgeTierBadge, RelatedLinks } from "../../_components/knowledge/KnowledgeChrome";
import { getKnowledgeTradition, knowledgeBase, knowledgeConceptById, knowledgePersonById } from "../../_data/knowledge";

export function generateStaticParams() { return knowledgeBase.traditions.map((item) => ({ slug: item.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const item = getKnowledgeTradition((await params).slug); return item ? { title: `${item.name} · 思想传统`, description: item.summary } : {}; }
export default async function TraditionPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = getKnowledgeTradition((await params).slug); if (!item) notFound();
  const people = item.personIds.map((id) => knowledgePersonById.get(id)).filter(Boolean); const concepts = item.conceptIds.map((id) => knowledgeConceptById.get(id)).filter(Boolean);
  return <KnowledgePage><main className="knowledge-article knowledge-article--text"><nav className="knowledge-breadcrumb"><Link href="/knowledge">知识库</Link><span>/</span><span>传统</span><span>/</span><strong>{item.name}</strong></nav>
    <header className="knowledge-text-hero"><KnowledgeTierBadge tier={item.contentTier} /><p>TRADITION</p><h1>{item.name}</h1><h2>{item.regionLabels.join(" · ")} · {item.periodLabel}</h2><p>{item.summary}</p></header>
    <div className="knowledge-article__layout"><article className="knowledge-prose"><section><h2>阅读提示</h2><p>思想传统不是封闭、同质的容器。本页用它组织人物、概念与文本，同时保留内部争论、传播变化和跨传统接触。</p></section><CitationList citations={item.citations} /></article><aside className="knowledge-sidebar"><RelatedLinks heading="代表人物" items={people.map((person) => ({ href: `/thinker/${person!.slug}`, title: person!.names.display, subtitle: person!.chronology.label }))} /><RelatedLinks heading="相关概念" items={concepts.map((concept) => ({ href: `/concept/${encodeURIComponent(concept!.slug)}`, title: concept!.name }))} /></aside></div>
  </main></KnowledgePage>;
}
