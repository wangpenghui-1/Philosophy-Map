export type QuestionId =
  | "good-life"
  | "knowledge"
  | "self"
  | "reality"
  | "society"
  | "freedom";

export type RelationType =
  | "direct-influence"
  | "text-transmission"
  | "critique"
  | "lineage"
  | "thematic-resonance";

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
  kind: "scholarly-encyclopedia" | "peer-reviewed-article";
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
  questionIds: QuestionId[];
  question: string;
  thesis: string;
  keywords: string[];
  workIds: string[];
  anchors: GeoAnchor[];
  sourceIds: string[];
  color: string;
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
  camera: {
    lat: number;
    lon: number;
    distance: number;
  };
}

export interface Question {
  id: QuestionId;
  label: string;
  shortLabel: string;
  color: string;
}

export const questions: Question[] = [
  { id: "reality", label: "世界究竟由什么构成？", shortLabel: "世界", color: "#b99a61" },
  { id: "knowledge", label: "我们如何获得知识？", shortLabel: "知识", color: "#7d91bb" },
  { id: "self", label: "‘自我’是什么？", shortLabel: "自我", color: "#9b7fb5" },
  { id: "good-life", label: "怎样才算过好一生？", shortLabel: "好生活", color: "#7fa68b" },
  { id: "society", label: "公正的社会应当怎样组织？", shortLabel: "社会", color: "#bc775f" },
  { id: "freedom", label: "人是否自由，权力如何塑造我们？", shortLabel: "自由", color: "#b45e52" },
];

export const sources: Source[] = [
  {
    id: "src-confucius",
    title: "Confucius",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/sum2020/entries/confucius/",
    locator: "Sections 3–4: ritual psychology, virtues and character formation",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-zhuangzi",
    title: "Zhuangzi",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/sum2025/entries/zhuangzi/",
    locator: "Sections 4.3–4.8: language, perspectives and skepticism",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-buddha",
    title: "Buddha",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/fall2024/entries/buddha/",
    locator: "Section 2: Core Teachings",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-nagarjuna",
    title: "Nāgārjuna",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/spr2023/entries/nagarjuna/",
    locator: "Introduction and sections on emptiness and the middle way",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-aristotle",
    title: "Aristotle’s Ethics",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/win2025/entries/aristotle-ethics/",
    locator: "Introduction and Section 2: the human good",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-avicenna",
    title: "Ibn Sina’s Metaphysics",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/entries/ibn-sina-metaphysics/",
    locator: "Introduction: Avicenna’s reading of Aristotle’s Metaphysics",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-kant",
    title: "Immanuel Kant",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/entries/kant/",
    locator: "Sections 2 and 5: knowledge, autonomy and freedom",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-fanon",
    title: "Frantz Fanon",
    publisher: "Stanford Encyclopedia of Philosophy",
    url: "https://plato.stanford.edu/archives/win2020/entries/frantz-fanon/",
    locator: "Introduction and sections on colonial subjectivity and liberation",
    kind: "scholarly-encyclopedia",
  },
  {
    id: "src-confucius-aristotle",
    title: "Rethinking Virtue Ethics and Social Justice with Aristotle and Confucius",
    publisher: "Asian Philosophy, 20(2)",
    url: "https://doi.org/10.1080/09552367.2010.484954",
    locator: "Comparative discussion of Aristotelian and Confucian virtue ethics",
    kind: "peer-reviewed-article",
  },
];

export const works: Work[] = [
  { id: "analects", title: "《论语》", originalTitle: "論語", thinkerId: "confucius", dateLabel: "后世编纂" },
  { id: "zhuangzi-text", title: "《庄子》", originalTitle: "莊子", thinkerId: "zhuangzi", dateLabel: "战国至汉初成书" },
  { id: "nikayas", title: "尼柯耶／阿含经", originalTitle: "Nikāyas / Āgamas", thinkerId: "buddha", dateLabel: "口传后结集" },
  { id: "mulamadhyamakakarika", title: "《中论》", originalTitle: "Mūlamadhyamakakārikā", thinkerId: "nagarjuna", dateLabel: "约2–3世纪" },
  { id: "nicomachean-ethics", title: "《尼各马可伦理学》", originalTitle: "Nicomachean Ethics", thinkerId: "aristotle", dateLabel: "公元前4世纪" },
  { id: "metaphysics", title: "《形而上学》", originalTitle: "Metaphysics", thinkerId: "aristotle", dateLabel: "公元前4世纪" },
  { id: "healing", title: "《治愈之书》", originalTitle: "Kitāb al-Shifāʾ", thinkerId: "avicenna", dateLabel: "11世纪" },
  { id: "salvation", title: "《拯救之书》", originalTitle: "Kitāb al-Najāt", thinkerId: "avicenna", dateLabel: "11世纪" },
  { id: "pure-reason", title: "《纯粹理性批判》", originalTitle: "Kritik der reinen Vernunft", thinkerId: "kant", dateLabel: "1781／1787" },
  { id: "groundwork", title: "《道德形而上学奠基》", originalTitle: "Grundlegung", thinkerId: "kant", dateLabel: "1785" },
  { id: "black-skin", title: "《黑皮肤，白面具》", originalTitle: "Peau noire, masques blancs", thinkerId: "fanon", dateLabel: "1952" },
  { id: "wretched", title: "《全世界受苦的人》", originalTitle: "Les damnés de la terre", thinkerId: "fanon", dateLabel: "1961" },
];

export const thinkers: Thinker[] = [
  {
    id: "confucius",
    slug: "confucius",
    name: "孔子",
    englishName: "Confucius",
    originalName: "孔丘",
    period: "约公元前551–479",
    startYear: -551,
    endYear: -479,
    region: "东亚",
    tradition: "儒家",
    questionIds: ["good-life", "society", "knowledge"],
    question: "一个人如何在关系与共同生活中成为更好的人？",
    thesis: "以礼与仁的日常实践，塑造能够承担关系责任的人。",
    keywords: ["仁", "礼", "修身"],
    workIds: ["analects"],
    anchors: [
      { id: "qufu", label: "曲阜", historicalRegion: "鲁", lat: 35.596, lon: 116.991, certainty: "established" },
    ],
    sourceIds: ["src-confucius"],
    color: "#82a987",
    uncertainty: "早期材料中的生平细节与后世叙述并不完全一致。",
  },
  {
    id: "zhuangzi",
    slug: "zhuangzi",
    name: "庄子",
    englishName: "Zhuangzi",
    originalName: "莊周",
    period: "约公元前4世纪",
    startYear: -369,
    endYear: -286,
    region: "东亚",
    tradition: "道家",
    questionIds: ["self", "knowledge", "freedom"],
    question: "当语言和立场不断变化，我们如何保存行动与生命的自由？",
    thesis: "松动固执的区分，从多重视角理解变化中的世界。",
    keywords: ["道", "逍遥", "齐物"],
    workIds: ["zhuangzi-text"],
    anchors: [
      { id: "song", label: "宋地", historicalRegion: "战国宋国", lat: 34.45, lon: 115.65, certainty: "approximate", note: "具体活动地点只能近似表示。" },
    ],
    sourceIds: ["src-zhuangzi"],
    color: "#71a59b",
    uncertainty: "《庄子》由不同时期材料构成，不能将全书观点都直接归于庄周本人。",
  },
  {
    id: "buddha",
    slug: "buddha",
    name: "佛陀",
    englishName: "Gautama Buddha",
    originalName: "Siddhārtha Gautama",
    period: "约公元前5世纪",
    startYear: -480,
    endYear: -400,
    region: "南亚",
    tradition: "早期佛教",
    questionIds: ["good-life", "self", "knowledge"],
    question: "痛苦从何而来，又如何可能止息？",
    thesis: "苦有其成因，也可以通过训练、洞见与实践止息。",
    keywords: ["苦", "无我", "解脱"],
    workIds: ["nikayas"],
    anchors: [
      { id: "bodh-gaya", label: "菩提伽耶", historicalRegion: "摩揭陀地区", lat: 24.696, lon: 84.991, certainty: "established" },
    ],
    sourceIds: ["src-buddha"],
    color: "#c18b5f",
    uncertainty: "现代研究对其确切生卒年代仍有不同估计。",
  },
  {
    id: "nagarjuna",
    slug: "nagarjuna",
    name: "龙树",
    englishName: "Nāgārjuna",
    originalName: "Nāgārjuna",
    period: "约150–250",
    startYear: 150,
    endYear: 250,
    region: "南亚",
    tradition: "中观佛教",
    questionIds: ["reality", "self", "knowledge"],
    question: "事物是否拥有独立、固定、不依赖条件的本性？",
    thesis: "空揭示缘起与依存，并不意味着世界是虚无。",
    keywords: ["空", "缘起", "中道"],
    workIds: ["mulamadhyamakakarika"],
    anchors: [
      { id: "deccan", label: "德干地区", historicalRegion: "南印度（约）", lat: 17.4, lon: 78.5, certainty: "disputed", note: "生平资料稀少，地点仅作为区域性锚点。" },
    ],
    sourceIds: ["src-nagarjuna"],
    color: "#9a75ad",
    uncertainty: "可靠生平材料极少，活动地点与具体著作归属存在争议。",
  },
  {
    id: "aristotle",
    slug: "aristotle",
    name: "亚里士多德",
    englishName: "Aristotle",
    originalName: "Ἀριστοτέλης",
    period: "公元前384–322",
    startYear: -384,
    endYear: -322,
    region: "地中海",
    tradition: "古希腊哲学",
    questionIds: ["good-life", "knowledge", "society", "reality"],
    question: "德性如何在完整的人生与共同体中成为实践？",
    thesis: "好生活是德性、判断与行动在完整人生中的持续实践。",
    keywords: ["德性", "实践智慧", "幸福"],
    workIds: ["nicomachean-ethics", "metaphysics"],
    anchors: [
      { id: "athens", label: "雅典", historicalRegion: "阿提卡", lat: 37.984, lon: 23.728, certainty: "established" },
    ],
    sourceIds: ["src-aristotle"],
    color: "#c3a15f",
  },
  {
    id: "avicenna",
    slug: "avicenna",
    name: "阿维森纳",
    englishName: "Avicenna / Ibn Sīnā",
    originalName: "ابن سينا",
    period: "980–1037",
    startYear: 980,
    endYear: 1037,
    region: "伊斯兰思想世界",
    tradition: "阿拉伯语哲学",
    questionIds: ["reality", "knowledge", "self"],
    question: "理性如何说明存在、灵魂与必然性？",
    thesis: "在继承并重构希腊哲学的同时，建立关于存在与心灵的系统。",
    keywords: ["存在", "本质", "灵魂"],
    workIds: ["healing", "salvation"],
    anchors: [
      { id: "bukhara", label: "布哈拉", historicalRegion: "萨曼王朝文化圈", lat: 39.768, lon: 64.456, certainty: "established" },
      { id: "hamadan", label: "哈马丹", historicalRegion: "伊朗高原", lat: 34.799, lon: 48.515, certainty: "established" },
    ],
    sourceIds: ["src-avicenna"],
    color: "#5f9f9a",
  },
  {
    id: "kant",
    slug: "kant",
    name: "康德",
    englishName: "Immanuel Kant",
    originalName: "Immanuel Kant",
    period: "1724–1804",
    startYear: 1724,
    endYear: 1804,
    region: "欧洲",
    tradition: "批判哲学",
    questionIds: ["knowledge", "freedom", "society"],
    question: "人的认识能够达到哪里，自由又如何可能？",
    thesis: "经验由认识结构组织；自由要求人把自己视为能够自我立法的主体。",
    keywords: ["批判", "先验", "自主"],
    workIds: ["pure-reason", "groundwork"],
    anchors: [
      { id: "konigsberg", label: "柯尼斯堡", historicalRegion: "东普鲁士", lat: 54.711, lon: 20.511, certainty: "established" },
    ],
    sourceIds: ["src-kant"],
    color: "#7589b6",
  },
  {
    id: "fanon",
    slug: "fanon",
    name: "法农",
    englishName: "Frantz Fanon",
    originalName: "Frantz Omar Fanon",
    period: "1925–1961",
    startYear: 1925,
    endYear: 1961,
    region: "加勒比—北非",
    tradition: "反殖民思想",
    questionIds: ["freedom", "self", "society"],
    question: "殖民权力如何进入身体、自我与被承认的可能？",
    thesis: "殖民不仅控制土地，也制造被种族化的主体与心理结构。",
    keywords: ["殖民", "异化", "解放"],
    workIds: ["black-skin", "wretched"],
    anchors: [
      { id: "fort-de-france", label: "法兰西堡", historicalRegion: "马提尼克", lat: 14.617, lon: -61.058, certainty: "established" },
      { id: "blida", label: "卜利达", historicalRegion: "法属阿尔及利亚", lat: 36.47, lon: 2.83, certainty: "established" },
    ],
    sourceIds: ["src-fanon"],
    color: "#b45c4e",
  },
];

export const relations: Relation[] = [
  {
    id: "aristotle-avicenna",
    from: "aristotle",
    to: "avicenna",
    directed: true,
    type: "direct-influence",
    evidence: "established",
    title: "阅读、校验与重构",
    explanation: "阿维森纳以亚里士多德著作为核心参照，同时通过晚期古代注释传统和阿拉伯语哲学语境重新组织其形而上学。",
    sourceIds: ["src-avicenna"],
  },
  {
    id: "buddha-nagarjuna",
    from: "buddha",
    to: "nagarjuna",
    directed: true,
    type: "lineage",
    evidence: "established",
    title: "佛教传统中的哲学展开",
    explanation: "龙树在佛教传统内部发展中道与空的论证；这条线表示思想传统的延展，不表示两人存在直接师承。",
    sourceIds: ["src-buddha", "src-nagarjuna"],
    note: "传统联系，不是直接影响线。",
  },
  {
    id: "confucius-aristotle",
    from: "confucius",
    to: "aristotle",
    directed: false,
    type: "thematic-resonance",
    evidence: "supported",
    title: "德性如何被培养",
    explanation: "两种传统都把品格培养、实践和共同生活置于伦理讨论中心；这是比较研究建立的主题共鸣，不主张历史传播。",
    sourceIds: ["src-confucius", "src-aristotle", "src-confucius-aristotle"],
    note: "跨文化比较，不代表直接影响。",
  },
];

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
    body: "修身、止息痛苦与德性实践，是对同一问题给出的不同回答。相似并不自动意味着影响。",
    thinkerIds: ["confucius", "buddha", "aristotle"],
    relationIds: ["confucius-aristotle"],
    durationMs: 15000,
    camera: { lat: 27, lon: 66, distance: 5.15 },
  },
  {
    id: "self-and-real",
    index: 2,
    eyebrow: "第二章 · 00:29",
    title: "自我与真实世界",
    body: "视角、无我、空与灵魂让‘自我是什么’分化成彼此不能简单翻译的多条道路。",
    thinkerIds: ["zhuangzi", "buddha", "nagarjuna", "avicenna"],
    relationIds: ["buddha-nagarjuna"],
    durationMs: 15000,
    camera: { lat: 24, lon: 86, distance: 4.75 },
  },
  {
    id: "reason-and-freedom",
    index: 3,
    eyebrow: "第三章 · 00:44",
    title: "理性、自由与被塑造的人",
    body: "文本可以跨越语言延续，权力也会进入认识与主体。关系线必须同时说明‘如何连接’。",
    thinkerIds: ["aristotle", "avicenna", "kant", "fanon"],
    relationIds: ["aristotle-avicenna"],
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

function validateAtlasData() {
  const assertUnique = (label: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate ids.`);
  };
  assertUnique("thinkers", thinkers.map((item) => item.id));
  assertUnique("works", works.map((item) => item.id));
  assertUnique("relations", relations.map((item) => item.id));
  assertUnique("sources", sources.map((item) => item.id));
  assertUnique("story chapters", storyChapters.map((item) => item.id));

  for (const thinker of thinkers) {
    if (!thinker.sourceIds.length) throw new Error(`Thinker ${thinker.id} has no source.`);
    if (!thinker.anchors.length) throw new Error(`Thinker ${thinker.id} has no geographic anchor.`);
    for (const sourceId of thinker.sourceIds) {
      if (!sourceById.has(sourceId)) throw new Error(`Thinker ${thinker.id} references missing source ${sourceId}.`);
    }
    for (const workId of thinker.workIds) {
      if (!workById.has(workId)) throw new Error(`Thinker ${thinker.id} references missing work ${workId}.`);
    }
  }

  for (const relation of relations) {
    if (!thinkerById.has(relation.from) || !thinkerById.has(relation.to)) {
      throw new Error(`Relation ${relation.id} has a missing endpoint.`);
    }
    if (!relation.sourceIds.length) throw new Error(`Relation ${relation.id} has no source.`);
    if (relation.type === "thematic-resonance" && relation.directed) {
      throw new Error(`Thematic resonance ${relation.id} must be non-directional.`);
    }
    for (const sourceId of relation.sourceIds) {
      if (!sourceById.has(sourceId)) throw new Error(`Relation ${relation.id} references missing source ${sourceId}.`);
    }
  }

  for (const chapter of storyChapters) {
    for (const thinkerId of chapter.thinkerIds) {
      if (!thinkerById.has(thinkerId)) throw new Error(`Chapter ${chapter.id} references missing thinker ${thinkerId}.`);
    }
    for (const relationId of chapter.relationIds) {
      if (!relationById.has(relationId)) throw new Error(`Chapter ${chapter.id} references missing relation ${relationId}.`);
    }
  }
}

validateAtlasData();
