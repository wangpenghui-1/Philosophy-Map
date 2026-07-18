import Link from "next/link";
import type { ReactNode } from "react";
import { contentTierLabels, knowledgeSourceById } from "../../_data/knowledge";
import type { CitationRef, ContentTier } from "../../_generated/knowledge-types";

export function KnowledgeHeader() {
  return (
    <header className="knowledge-header">
      <Link className="knowledge-brand" href="/">
        <span aria-hidden="true">I</span>
        <strong>思想星图<small>ATLAS OF IDEAS</small></strong>
      </Link>
      <nav aria-label="知识库导航">
        <Link href="/knowledge">知识库</Link>
        <Link href="/explore">3D探索</Link>
        <Link href="/">思想故事</Link>
      </nav>
    </header>
  );
}

export function KnowledgeTierBadge({ tier }: { tier: ContentTier }) {
  return <span className={`knowledge-tier knowledge-tier--${tier}`}>{contentTierLabels[tier]}</span>;
}

export function KnowledgePage({ children }: { children: ReactNode }) {
  return (
    <div className="knowledge-page">
      <KnowledgeHeader />
      {children}
      <footer className="knowledge-footer">
        <span>世界哲学知识库 · 内容分层、关系有据、争议可见</span>
        <Link href="/explore">返回思想地球</Link>
      </footer>
    </div>
  );
}

export function CitationList({ citations, heading = "来源与定位" }: { citations: CitationRef[]; heading?: string }) {
  const unique = [...new Map(citations.map((citation) => [`${citation.sourceId}:${citation.locator}`, citation])).values()];
  return (
    <section className="knowledge-citations">
      <h2>{heading}</h2>
      <ol>
        {unique.map((citation) => {
          const source = knowledgeSourceById.get(citation.sourceId);
          if (!source) return null;
          const content = (
            <>
              <strong>{source.title}</strong>
              <span>{source.publication}</span>
              <small>{citation.locator}</small>
              <p>{citation.claim}</p>
            </>
          );
          return <li key={`${citation.sourceId}:${citation.locator}`}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{content}</a> : content}</li>;
        })}
      </ol>
    </section>
  );
}

export function RelatedLinks({
  heading,
  items,
}: {
  heading: string;
  items: Array<{ href: string; title: string; subtitle?: string }>;
}) {
  if (!items.length) return null;
  return (
    <section className="knowledge-related">
      <h2>{heading}</h2>
      <div>
        {items.map((item) => (
          <Link href={item.href} key={item.href}>
            <strong>{item.title}</strong>
            {item.subtitle ? <small>{item.subtitle}</small> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
