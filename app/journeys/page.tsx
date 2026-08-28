import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { journeyCatalog } from "../_data/journeys";
import { questionPresentations } from "../_data/question-presentations";

export const metadata: Metadata = {
  title: "全部思想旅程",
  description: "沿八条策展路径进入认识论、本体论、幸福、正义、自由意志、存在主义与现象学。",
};

export default function JourneysPage() {
  return (
    <main className="journey-catalog-page">
      <header className="journey-catalog-header">
        <Link href="/">← 返回思想星图</Link>
        <small>CURATED JOURNEYS</small>
        <h1>全部思想旅程</h1>
        <p>每条旅程都从一个问题开始，沿人物、概念与有来源的关系逐站展开。</p>
      </header>
      <section className="journey-catalog-grid" aria-label="八条思想旅程">
        {journeyCatalog.map((journey) => {
          const presentation = questionPresentations.find((item) =>
            item.primaryJourneyId === journey.id || item.relatedJourneyIds?.includes(journey.id),
          ) ?? questionPresentations[0];
          return (
            <Link href={`/journey/${journey.id}`} key={journey.id}>
              <div aria-hidden="true">
                <Image src={presentation.artwork.avif640} alt="" fill sizes="(max-width: 760px) 100vw, 33vw" />
              </div>
              <small>{Math.max(1, Math.round(journey.estimatedDurationMs / 60_000))} 分钟 · {journey.nodes.length} 站</small>
              <h2>{journey.title}</h2>
              <p>{journey.description}</p>
              <span>开始旅程 →</span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
