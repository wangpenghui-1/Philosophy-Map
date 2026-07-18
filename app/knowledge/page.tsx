import type { Metadata } from "next";
import KnowledgeDirectory, { parseKnowledgeFilters } from "../_components/knowledge/KnowledgeDirectory";
import { KnowledgePage } from "../_components/knowledge/KnowledgeChrome";
import { knowledgeBase } from "../_data/knowledge";

export const metadata: Metadata = {
  title: "世界哲学知识库",
  description: "按人物、概念、思想传统与著作浏览世界思想史，追踪有来源支持的思想关系。",
};

export default async function KnowledgeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseKnowledgeFilters(await searchParams);
  return (
    <KnowledgePage>
      <main className="knowledge-main">
        <section className="knowledge-hero">
          <p>WORLD PHILOSOPHY KNOWLEDGE BASE</p>
          <h1>从人物出发，沿着概念与文本阅读思想史</h1>
          <div>
            <span><strong>{knowledgeBase.people.length}</strong> 人物</span>
            <span><strong>{knowledgeBase.concepts.length}</strong> 概念</span>
            <span><strong>{knowledgeBase.traditions.length}</strong> 传统</span>
            <span><strong>{knowledgeBase.works.length}</strong> 著作</span>
          </div>
          <p>120人物版本已覆盖八个主要思想区域。索引条目提供可靠入口，不以简短摘要冒充完整解释；思想关系只有在能够说明证据与传播路径时才会发布。</p>
        </section>
        <KnowledgeDirectory filters={filters} />
      </main>
    </KnowledgePage>
  );
}
