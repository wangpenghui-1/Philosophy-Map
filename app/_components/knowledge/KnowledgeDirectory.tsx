import Link from "next/link";
import { contentTierLabels, entityTypeLabels, knowledgeBase, knowledgeIndex, knowledgeTraditionById } from "../../_data/knowledge";
import type { ContentTier, KnowledgeIndexItem } from "../../_generated/knowledge-types";
import { KnowledgeTierBadge } from "./KnowledgeChrome";

type SearchValue = string | string[] | undefined;

export interface KnowledgeFilters {
  q: string;
  type: string;
  region: string;
  tradition: string;
  tier: string;
  period: string;
  page: number;
}

const periodLabels = {
  ancient: "古代（500年以前）",
  medieval: "中古（500–1500）",
  "early-modern": "早期现代（1500–1800）",
  modern: "现代（1800–1945）",
  contemporary: "当代（1945至今）",
};

function one(value: SearchValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function parseKnowledgeFilters(searchParams: Record<string, SearchValue>): KnowledgeFilters {
  const page = Number(one(searchParams.page));
  return {
    q: one(searchParams.q).trim(),
    type: one(searchParams.type),
    region: one(searchParams.region),
    tradition: one(searchParams.tradition),
    tier: one(searchParams.tier),
    period: one(searchParams.period),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function matchesPeriod(item: KnowledgeIndexItem, period: string) {
  if (!period || item.entityType !== "person") return true;
  const year = item.startYear ?? 0;
  if (period === "ancient") return year < 500;
  if (period === "medieval") return year >= 500 && year < 1500;
  if (period === "early-modern") return year >= 1500 && year < 1800;
  if (period === "modern") return year >= 1800 && year < 1945;
  if (period === "contemporary") return year >= 1945;
  return true;
}

function toQuery(filters: KnowledgeFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: page > 1 ? String(page) : "" })) {
    if (value) params.set(key, String(value));
  }
  return `/knowledge${params.size ? `?${params}` : ""}`;
}

function withoutFilter(filters: KnowledgeFilters, key: keyof KnowledgeFilters) {
  return toQuery({ ...filters, [key]: key === "page" ? 1 : "", page: 1 }, 1);
}

const entitySymbols = {
  person: "人",
  concept: "义",
  tradition: "脉",
  work: "文",
} as const;

export default function KnowledgeDirectory({ filters }: { filters: KnowledgeFilters }) {
  const normalizedQuery = filters.q.toLowerCase();
  const filtered = knowledgeIndex.filter((item) => {
    if (filters.type && item.entityType !== filters.type) return false;
    if (filters.region && item.region !== filters.region) return false;
    if (filters.tradition && !item.traditionIds.includes(filters.tradition)) return false;
    if (filters.tier && item.contentTier !== filters.tier) return false;
    if (!matchesPeriod(item, filters.period)) return false;
    if (normalizedQuery && !item.searchText.includes(normalizedQuery)) return false;
    return true;
  });
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const items = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const regions = [...new Set(knowledgeBase.people.map((person) => person.primaryRegion))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const traditions = [...knowledgeBase.traditions].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const activeFilters = [
    filters.q ? { key: "q" as const, label: `关键词：${filters.q}` } : null,
    filters.type ? { key: "type" as const, label: `类型：${entityTypeLabels[filters.type as keyof typeof entityTypeLabels]}` } : null,
    filters.region ? { key: "region" as const, label: `地区：${filters.region}` } : null,
    filters.tradition ? { key: "tradition" as const, label: `传统：${knowledgeTraditionById.get(filters.tradition)?.name ?? filters.tradition}` } : null,
    filters.period ? { key: "period" as const, label: `时代：${periodLabels[filters.period as keyof typeof periodLabels]}` } : null,
    filters.tier ? { key: "tier" as const, label: `深度：${contentTierLabels[filters.tier as keyof typeof contentTierLabels]}` } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <form className="knowledge-filters" action="/knowledge" method="get">
        <label className="knowledge-search">
          <span>搜索人物、原名、著作或术语</span>
          <input name="q" defaultValue={filters.q} placeholder="例如：空、自由、Kant、《论语》" />
        </label>
        <label><span>条目类型</span><select name="type" defaultValue={filters.type}><option value="">全部类型</option>{Object.entries(entityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>地区</span><select name="region" defaultValue={filters.region}><option value="">全部地区</option>{regions.map((region) => <option key={region}>{region}</option>)}</select></label>
        <label><span>传统</span><select name="tradition" defaultValue={filters.tradition}><option value="">全部传统</option>{traditions.map((tradition) => <option key={tradition.id} value={tradition.id}>{tradition.name}</option>)}</select></label>
        <label><span>时代</span><select name="period" defaultValue={filters.period}><option value="">全部时代</option>{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>内容深度</span><select name="tier" defaultValue={filters.tier}><option value="">全部深度</option>{Object.entries(contentTierLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit">应用筛选</button>
        <Link href="/knowledge">清除</Link>
      </form>

      {activeFilters.length ? (
        <nav className="knowledge-active-filters" aria-label="当前筛选条件">
          <span>当前视野</span>
          {activeFilters.map((filter) => (
            <Link key={filter.key} href={withoutFilter(filters, filter.key)} aria-label={`移除${filter.label}`}>
              {filter.label}<i aria-hidden="true">×</i>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="knowledge-results-head">
        <p>找到 <strong>{filtered.length}</strong> 个条目</p>
        <span>第 {currentPage} / {totalPages} 页</span>
      </div>
      {items.length ? (
        <div className="knowledge-grid">
          {items.map((item) => (
            <article className={`knowledge-card knowledge-card--${item.entityType}`} key={`${item.entityType}:${item.id}`}>
              <div className="knowledge-card__visual" aria-hidden={item.media ? undefined : true}>
                {item.media ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="knowledge-card__backdrop" src={item.media.thumbSrc} alt="" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="knowledge-card__portrait" src={item.media.thumbSrc} alt={item.media.alt} style={{ objectPosition: item.media.objectPosition }} />
                  </>
                ) : <span>{entitySymbols[item.entityType]}</span>}
              </div>
              <div className="knowledge-card__body">
                <div><span>{entityTypeLabels[item.entityType]}</span><KnowledgeTierBadge tier={item.contentTier as ContentTier} /></div>
                <h2><Link href={item.href}>{item.title}</Link></h2>
                <small>{item.subtitle}</small>
                <p>{item.summary}</p>
                {item.traditionIds.length ? <ul>{item.traditionIds.slice(0, 3).map((id) => <li key={id}>{knowledgeTraditionById.get(id)?.name ?? id}</li>)}</ul> : null}
                <Link className="knowledge-card-link" href={item.href}>打开条目 →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : <div className="knowledge-empty"><h2>没有找到匹配条目</h2><p>尝试清除部分筛选，或换用人物原名和著作名称搜索。</p></div>}
      {totalPages > 1 ? (
        <nav className="knowledge-pagination" aria-label="知识库分页">
          {currentPage > 1 ? <Link href={toQuery(filters, currentPage - 1)}>← 上一页</Link> : <span />}
          {currentPage < totalPages ? <Link href={toQuery(filters, currentPage + 1)}>下一页 →</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}
