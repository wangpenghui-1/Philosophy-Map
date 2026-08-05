import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitationList, CitationMarkers, KnowledgePage, KnowledgeTierBadge, RelatedLinks } from "../../_components/knowledge/KnowledgeChrome";
import KnowledgeReadingProgress from "../../_components/knowledge/KnowledgeReadingProgress";
import RepresentativeQuote from "../../_components/RepresentativeQuote";
import {
  getKnowledgePerson,
  knowledgeBase,
  knowledgeConceptById,
  knowledgePersonById,
  knowledgeTraditionById,
  knowledgeWorkById,
  knowledgeSourceById,
} from "../../_data/knowledge";

export function generateStaticParams() {
  return knowledgeBase.people.map((person) => ({ slug: person.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const thinker = getKnowledgePerson((await params).slug);
  if (!thinker) return {};
  return { title: `${thinker.names.display} · ${thinker.names.english}`, description: thinker.summary };
}

export default async function ThinkerPage({ params }: { params: Promise<{ slug: string }> }) {
  const thinker = getKnowledgePerson((await params).slug);
  if (!thinker) notFound();
  const works = thinker.workIds.map((id) => knowledgeWorkById.get(id)).filter(Boolean);
  const concepts = thinker.conceptIds.map((id) => knowledgeConceptById.get(id)).filter(Boolean);
  const traditions = thinker.traditionIds.map((id) => knowledgeTraditionById.get(id)).filter(Boolean);
  const relations = knowledgeBase.relations.filter((relation) => relation.from.id === thinker.id || relation.to.id === thinker.id);
  const thinkerIndex = knowledgeBase.people.findIndex((person) => person.id === thinker.id);
  const previousThinker = thinkerIndex > 0 ? knowledgeBase.people[thinkerIndex - 1] : null;
  const nextThinker = thinkerIndex < knowledgeBase.people.length - 1 ? knowledgeBase.people[thinkerIndex + 1] : null;
  const representativeQuote = thinker.representativeQuote;
  const quoteWork = representativeQuote?.workId ? knowledgeWorkById.get(representativeQuote.workId) : null;
  const quoteSource = representativeQuote ? knowledgeSourceById.get(representativeQuote.sourceId) : null;
  const pageCitations = [
    ...thinker.citations,
    ...thinker.sections.flatMap((section) => section.paragraphs.flatMap((paragraph) => paragraph.citations)),
    ...relations.flatMap((relation) => relation.citations),
  ];
  const relationTypeLabels: Record<string, string> = {
    "direct-influence": "直接影响",
    "text-transmission": "文本传播",
    critique: "批判与回应",
    lineage: "思想谱系",
    "thematic-resonance": "主题共鸣",
    authorship: "作者关系",
    participation: "参与关系",
    conceptualization: "概念建构",
  };
  const evidenceLabels: Record<string, string> = { established: "证据明确", supported: "有材料支持", disputed: "存在争议" };

  return (
    <KnowledgePage>
      <KnowledgeReadingProgress />
      <main className="knowledge-article">
        <nav className="knowledge-breadcrumb"><Link href="/knowledge">知识库</Link><span>/</span><span>人物</span><span>/</span><strong>{thinker.names.display}</strong></nav>
        <header className="knowledge-article__hero">
          <div className="knowledge-article__portrait">
            {thinker.media.fullSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="knowledge-article__portrait-backdrop" src={thinker.media.fullSrc} alt="" aria-hidden="true" width={960} height={1200} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="knowledge-article__portrait-image" src={thinker.media.fullSrc} alt={thinker.media.alt} width={960} height={1200} style={{ objectPosition: thinker.media.objectPosition }} />
              </>
            ) : <span aria-hidden="true">{thinker.names.display.slice(0, 1)}</span>}
          </div>
          <div>
            <KnowledgeTierBadge tier={thinker.contentTier} />
            <p>{thinker.primaryRegion} · {thinker.chronology.label}</p>
            <h1>{thinker.names.display}</h1>
            <h2>{thinker.names.english}{thinker.names.original ? ` · ${thinker.names.original}` : ""}</h2>
            {representativeQuote ? (
              <RepresentativeQuote
                quote={representativeQuote}
                sourceLabel={`${quoteWork?.title ?? representativeQuote.sourceTitle} · ${representativeQuote.locator}`}
                sourceHref={quoteSource?.url}
              />
            ) : null}
            <p className="knowledge-article__lead">{thinker.summary}</p>
            <div className="knowledge-article__actions"><Link href={`/explore?thinker=${thinker.slug}`}>在3D地球中定位</Link><Link href={`/knowledge?q=${encodeURIComponent(thinker.names.display)}`}>查看相关条目</Link></div>
          </div>
        </header>

        <div className="knowledge-article__layout">
          <article className="knowledge-prose">
            <section id="core-question" className="knowledge-question"><small>核心问题</small><h2>{thinker.guidingQuestion}</h2><p>{thinker.thesis}<CitationMarkers citations={thinker.citations} allCitations={pageCitations} /></p></section>
            {thinker.sections.map((section) => <section id={`section-${section.id}`} key={section.id}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph.text}<CitationMarkers citations={paragraph.citations} allCitations={pageCitations} /></p>)}</section>)}
            {concepts.length ? (
              <section id="concepts"><h2>核心概念</h2><div className="knowledge-detail-grid">{concepts.map((concept) => (
                <Link className="knowledge-detail-card" href={`/concept/${encodeURIComponent(concept!.slug)}`} key={concept!.id}>
                  <small>CONCEPT</small><h3>{concept!.name}</h3><p>{concept!.summary}</p>
                </Link>
              ))}</div></section>
            ) : null}
            {works.length ? (
              <section id="works"><h2>代表著作</h2><div className="knowledge-detail-grid">{works.map((work) => (
                <Link className="knowledge-detail-card" href={`/work/${work!.slug}`} key={work!.id}>
                  <small>{work!.dateLabel}</small><h3>{work!.title}</h3>{work!.originalTitle ? <span>{work!.originalTitle}</span> : null}<p>{work!.summary}</p>
                </Link>
              ))}</div></section>
            ) : null}
            {relations.length ? (
              <section id="relations"><h2>与其他哲学家的关联</h2><div className="knowledge-relation-list">{relations.map((relation) => {
                const otherId = relation.from.id === thinker.id ? relation.to.id : relation.from.id;
                const other = knowledgePersonById.get(otherId);
                return (
                  <article className="knowledge-relation-card" key={relation.id}>
                    <div>
                      <small>{relationTypeLabels[relation.relationType]} · {evidenceLabels[relation.evidenceStatus]}</small>
                      {other ? (
                        <Link className="knowledge-relation-link" href={`/thinker/${other.slug}`}>
                          <h3>{relation.title}</h3><strong>{other.names.display}</strong>
                        </Link>
                      ) : <><h3>{relation.title}</h3><strong>{otherId}</strong></>}
                    </div>
                    <p>{relation.explanation}{relation.note ? ` ${relation.note}` : ""}<CitationMarkers citations={relation.citations} allCitations={pageCitations} /></p>
                  </article>
                );
              })}</div></section>
            ) : null}
            {thinker.uncertainty ? <aside className="knowledge-note"><strong>不确定性说明</strong><p>{thinker.uncertainty}</p></aside> : null}
            <div id="sources"><CitationList citations={pageCitations} /></div>
          </article>
          <aside className="knowledge-sidebar">
            <details className="knowledge-toc" open>
              <summary>本页目录</summary>
              <nav aria-label="人物条目页内目录">
                <a href="#core-question">核心问题</a>
                {thinker.sections.map((section) => <a key={section.id} href={`#section-${section.id}`}>{section.heading}</a>)}
                {concepts.length ? <a href="#concepts">核心概念</a> : null}
                {works.length ? <a href="#works">代表著作</a> : null}
                {relations.length ? <a href="#relations">思想关联</a> : null}
                <a href="#sources">来源与定位</a>
              </nav>
            </details>
            <RelatedLinks heading="思想传统" items={traditions.map((item) => ({ href: `/tradition/${encodeURIComponent(item!.slug)}`, title: item!.name, subtitle: item!.periodLabel }))} />
            <section className="knowledge-media-note">
              <h2>图像说明</h2>
              <p>{thinker.media.depictionNote}</p>
              <small>
                {thinker.media.sourceUrl
                  ? <a href={thinker.media.sourceUrl} target="_blank" rel="noreferrer">{thinker.media.credit} · {thinker.media.license ?? thinker.media.rightsStatus}</a>
                  : `${thinker.media.credit} · ${thinker.media.rightsStatus}`}
              </small>
            </section>
          </aside>
        </div>
        <nav className="knowledge-sequence" aria-label="人物条目顺序导航">
          {previousThinker ? <Link href={`/thinker/${previousThinker.slug}`}><small>上一篇</small><strong>← {previousThinker.names.display}</strong></Link> : <span />}
          {nextThinker ? <Link href={`/thinker/${nextThinker.slug}`}><small>下一篇</small><strong>{nextThinker.names.display} →</strong></Link> : <span />}
        </nav>
      </main>
    </KnowledgePage>
  );
}
