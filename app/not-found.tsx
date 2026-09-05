import type { Metadata } from "next";
import Link from "next/link";
import { KnowledgePage } from "./_components/knowledge/KnowledgeChrome";
import { knowledgeBase } from "./_data/knowledge";

export const metadata: Metadata = {
  title: "页面不存在",
  description: "这个地址在思想星图上没有对应条目。",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <KnowledgePage>
      <main className="knowledge-main not-found">
        <p className="not-found__code">404 · NOT FOUND</p>
        <h1>这个地址上没有条目</h1>
        <p className="not-found__lead">
          这个页面可能已经移动，或地址有误。你可以回到地球继续探索，也可以从知识库和思想旅程开始。
        </p>
        <nav className="not-found__exits" aria-label="继续探索">
          <Link href="/">
            <small>3D 地球</small>
            <strong>回到思想星图</strong>
            <span>从六个哲学问题重新进入</span>
          </Link>
          <Link href="/knowledge">
            <small>知识库</small>
            <strong>浏览全部条目</strong>
            <span>
              {knowledgeBase.people.length} 位思想家，以及概念、传统与著作
            </span>
          </Link>
          <Link href="/journeys">
            <small>思想旅程</small>
            <strong>沿一条线索读下去</strong>
            <span>八条从问题出发的策展路线</span>
          </Link>
        </nav>
      </main>
    </KnowledgePage>
  );
}
