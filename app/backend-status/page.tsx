import type { Metadata } from "next";
import Link from "next/link";
import { isDatabaseConfigured } from "@atlas/db";
import { knowledgeBase } from "../_data/knowledge";
import { BackendApiInspector, type BackendEndpoint } from "./BackendApiInspector";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "后端状态",
  robots: { index: false, follow: false },
};

const endpoints = [
  ["公开目录", "/api/v1/catalog"],
  ["康德实体", "/api/v1/entities/person/kant"],
  ["知识搜索", "/api/v1/search?q=康德&limit=3"],
  ["关系图谱", "/api/v1/graph?entity=kant&depth=1"],
  ["思想旅程", "/api/v1/journeys/epistemology"],
  ["Atlas Snapshot", "/api/v1/atlas/snapshots/current"],
  ["OpenAPI 3.1", "/api/v1/openapi"],
] as const satisfies readonly BackendEndpoint[];

export default function BackendStatusPage() {
  const databaseReady = isDatabaseConfigured();
  const modelReady = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_RESPONSE_MODEL);
  return (
    <main className={styles.page}>
      <header>
        <p>ATLAS OF IDEAS · BACKEND</p>
        <h1>后端兼容层已运行</h1>
        <span>公开站继续使用已发布静态快照；数据库和模型服务可以独立接入。</span>
      </header>

      <section className={styles.metrics} aria-label="公开知识快照">
        <article><strong>{knowledgeBase.people.length}</strong><span>人物</span></article>
        <article><strong>{knowledgeBase.concepts.length}</strong><span>概念</span></article>
        <article><strong>{knowledgeBase.relations.length}</strong><span>已发布关系</span></article>
        <article><strong>{knowledgeBase.sources.length}</strong><span>已发布来源</span></article>
      </section>

      <section className={styles.status}>
        <h2>运行状态</h2>
        <dl>
          <div><dt>公共知识 API</dt><dd className={styles.ready}>已就绪</dd></div>
          <div><dt>静态故障回退</dt><dd className={styles.ready}>已就绪</dd></div>
          <div><dt>PostgreSQL 持久化</dt><dd>{databaseReady ? "已配置" : "等待 DATABASE_URL"}</dd></div>
          <div><dt>OpenAI 模型回答</dt><dd>{modelReady ? "已配置" : "使用有据可查的抽取式回退"}</dd></div>
          <div><dt>AI 共享限流</dt><dd>{process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? "Redis 已配置" : "单实例内存限流（生产前需配置 Redis）"}</dd></div>
        </dl>
      </section>

      <BackendApiInspector endpoints={endpoints} />

      <footer>
        <Link href="/admin/login">进入内容管理后台</Link>
        <Link href="/chat">检查 AI 对话</Link>
        <Link href="/thinker/kant">检查公开人物页</Link>
        <Link href="/knowledge">返回知识库</Link>
      </footer>
    </main>
  );
}
