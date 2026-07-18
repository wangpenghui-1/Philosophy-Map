import atlasRaw from "../_generated/atlas.json";
import type { ContentTier } from "../_generated/knowledge-types";

export type QuestionId = "good-life" | "knowledge" | "self" | "reality" | "society" | "freedom";
export type RelationType = "direct-influence" | "text-transmission" | "critique" | "lineage" | "thematic-resonance";
export type EvidenceStatus = "established" | "supported" | "disputed";

export interface GeoAnchor {
  id: string;
  label: string;
  historicalRegion: string;
  lat: number;
  lon: number;
  certainty: "established" | "approximate" | "disputed";
  note?: string;
}

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  locator: string;
  kind: "primary-text" | "scholarly-book" | "peer-reviewed-article" | "scholarly-encyclopedia" | "reference-dataset" | "archival-source";
}

export interface Work {
  id: string;
  title: string;
  originalTitle?: string;
  thinkerId: string;
  dateLabel: string;
}

export interface Thinker {
  id: string;
  slug: string;
  name: string;
  englishName: string;
  originalName?: string;
  period: string;
  startYear: number;
  endYear: number;
  region: string;
  tradition: string;
  traditionIds: string[];
  conceptIds: string[];
  contentTier: ContentTier;
  questionIds: QuestionId[];
  question: string;
  thesis: string;
  keywords: string[];
  workIds: string[];
  anchors: GeoAnchor[];
  sourceIds: string[];
  color: string;
  media: {
    fullSrc: string;
    thumbSrc: string;
    alt: string;
    objectPosition: string;
    depictionNote: string;
  };
  uncertainty?: string;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  directed: boolean;
  type: RelationType;
  evidence: EvidenceStatus;
  title: string;
  explanation: string;
  sourceIds: string[];
  note?: string;
}

export interface StoryChapter {
  id: string;
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  thinkerIds: string[];
  relationIds: string[];
  durationMs: number;
  camera: { lat: number; lon: number; distance: number };
}

export interface Question {
  id: QuestionId;
  label: string;
  shortLabel: string;
  color: string;
}

const atlasProjection = atlasRaw as unknown as {
  sources: Source[];
  works: Work[];
  thinkers: Thinker[];
  relations: Relation[];
};

export const sources = atlasProjection.sources;
export const works = atlasProjection.works;
export const thinkers = atlasProjection.thinkers;
export const relations = atlasProjection.relations;

export const questions: Question[] = [
  { id: "reality", label: "世界究竟由什么构成？", shortLabel: "世界", color: "#b99a61" },
  { id: "knowledge", label: "我们如何获得知识？", shortLabel: "知识", color: "#7d91bb" },
  { id: "self", label: "‘自我’是什么？", shortLabel: "自我", color: "#9b7fb5" },
  { id: "good-life", label: "怎样才算过好一生？", shortLabel: "好生活", color: "#7fa68b" },
  { id: "society", label: "公正的社会应当怎样组织？", shortLabel: "社会", color: "#bc775f" },
  { id: "freedom", label: "人是否自由，权力如何塑造我们？", shortLabel: "自由", color: "#b45e52" },
];

export const atlasTimelineStartYear = Math.min(-600, ...thinkers.map((thinker) => thinker.startYear));
export const atlasTimelineEndYear = Math.max(...thinkers.map((thinker) => thinker.endYear));

export const storyChapters: StoryChapter[] = [
  {
    id: "world-asks",
    index: 0,
    eyebrow: "序章 · 00:00",
    title: "世界同时开始提问",
    body: "思想并不从一个中心向外扩散。不同地方的人，在不同时间面对生活、知识、自我与自由。",
    thinkerIds: thinkers.map((thinker) => thinker.id),
    relationIds: [],
    durationMs: 14000,
    camera: { lat: 15, lon: 45, distance: 6.6 },
  },
  {
    id: "good-life",
    index: 1,
    eyebrow: "第一章 · 00:14",
    title: "怎样才算过好一生？",
    body: "诘问、修身、止息痛苦与德性实践，是对同一问题给出的不同回答。相似并不自动意味着影响。",
    thinkerIds: ["socrates", "plato", "confucius", "buddha", "aristotle"],
    relationIds: ["socrates-plato", "plato-aristotle", "confucius-aristotle"],
    durationMs: 15000,
    camera: { lat: 27, lon: 66, distance: 5.15 },
  },
  {
    id: "self-and-real",
    index: 2,
    eyebrow: "第二章 · 00:29",
    title: "自我与真实世界",
    body: "视角、无我、空、我思、经验与语言，让‘自我和真实是什么’分化成彼此不能简单翻译的多条道路。",
    thinkerIds: ["zhuangzi", "buddha", "nagarjuna", "avicenna", "descartes", "spinoza", "hume", "husserl", "heidegger", "wittgenstein"],
    relationIds: ["buddha-nagarjuna", "descartes-spinoza", "locke-hume", "husserl-heidegger"],
    durationMs: 15000,
    camera: { lat: 24, lon: 86, distance: 4.75 },
  },
  {
    id: "reason-and-freedom",
    index: 3,
    eyebrow: "第三章 · 00:44",
    title: "理性、自由与被塑造的人",
    body: "文本跨越语言延续，制度塑造自由，权力进入身体与主体。每一条关系线都必须说明‘如何连接’。",
    thinkerIds: ["plato", "augustine", "aristotle", "avicenna", "aquinas", "machiavelli", "hobbes", "locke", "rousseau", "wollstonecraft", "kant", "hegel", "kierkegaard", "marx", "nietzsche", "beauvoir", "arendt", "fanon", "foucault"],
    relationIds: ["plato-augustine", "aristotle-avicenna", "aristotle-aquinas", "avicenna-aquinas", "hume-kant", "rousseau-wollstonecraft", "kant-hegel", "hegel-marx", "marx-fanon", "nietzsche-foucault"],
    durationMs: 15000,
    camera: { lat: 34, lon: 25, distance: 5.25 },
  },
  {
    id: "handoff",
    index: 4,
    eyebrow: "尾声 · 00:59",
    title: "现在，把地球交给你",
    body: "选择一个问题、一个人物或一条关系。故事停止，但思想之间的路径仍然开放。",
    thinkerIds: thinkers.map((thinker) => thinker.id),
    relationIds: relations.map((relation) => relation.id),
    durationMs: 10000,
    camera: { lat: 12, lon: 36, distance: 6.35 },
  },
];

export const thinkerById = new Map(thinkers.map((thinker) => [thinker.id, thinker]));
export const thinkerBySlug = new Map(thinkers.map((thinker) => [thinker.slug, thinker]));
export const sourceById = new Map(sources.map((source) => [source.id, source]));
export const workById = new Map(works.map((work) => [work.id, work]));
export const relationById = new Map(relations.map((relation) => [relation.id, relation]));

export const relationTypeLabels: Record<RelationType, string> = {
  "direct-influence": "有文献依据的直接影响",
  "text-transmission": "翻译或文本传播",
  critique: "批判或反驳",
  lineage: "师承或传统联系",
  "thematic-resonance": "跨文化主题共鸣",
};

export const evidenceLabels: Record<EvidenceStatus, string> = {
  established: "已确证",
  supported: "学术支持",
  disputed: "存在争议",
};

function validateAtlasProjection() {
  const unique = (label: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate ids.`);
  };
  unique("thinkers", thinkers.map((item) => item.id));
  unique("works", works.map((item) => item.id));
  unique("relations", relations.map((item) => item.id));
  unique("sources", sources.map((item) => item.id));
  for (const thinker of thinkers) {
    if (!thinker.sourceIds.length || !thinker.anchors.length) throw new Error(`Thinker ${thinker.id} has incomplete atlas data.`);
    thinker.sourceIds.forEach((id) => { if (!sourceById.has(id)) throw new Error(`Thinker ${thinker.id} references missing source ${id}.`); });
    thinker.workIds.forEach((id) => { if (!workById.has(id)) throw new Error(`Thinker ${thinker.id} references missing work ${id}.`); });
  }
  for (const relation of relations) {
    if (!thinkerById.has(relation.from) || !thinkerById.has(relation.to)) throw new Error(`Relation ${relation.id} has a missing endpoint.`);
    if (!relation.sourceIds.length) throw new Error(`Relation ${relation.id} has no source.`);
    if (relation.type === "thematic-resonance" && relation.directed) throw new Error(`Thematic resonance ${relation.id} must be non-directional.`);
  }
}

validateAtlasProjection();
