import type { QuestionId, RelationType } from "./atlas";

export interface QuestionPresentation {
  questionId: QuestionId;
  featuredOrder: number | null;
  title: string;
  subtitle: string;
  artwork: {
    avif1280: string;
    avif640: string;
    webp1280: string;
    webp640: string;
  };
  theme: {
    accent: string;
    glow: string;
  };
  camera: { lat: number; lon: number; distance: number };
  thinkerIds: string[];
  relationIds: string[];
  primaryJourneyId: string;
  relatedJourneyIds?: string[];
}

function artwork(id: QuestionId): QuestionPresentation["artwork"] {
  return {
    avif1280: `/media/questions/${id}-1280.avif`,
    avif640: `/media/questions/${id}-640.avif`,
    webp1280: `/media/questions/${id}-1280.webp`,
    webp640: `/media/questions/${id}-640.webp`,
  };
}

export const questionPresentations: QuestionPresentation[] = [
  {
    questionId: "reality",
    featuredOrder: 1,
    title: "世界是什么？",
    subtitle: "存在、物质与真实",
    artwork: artwork("reality"),
    theme: { accent: "#b99a61", glow: "rgba(185, 154, 97, .34)" },
    camera: { lat: 29, lon: 54, distance: 4.86 },
    thinkerIds: ["thales", "parmenides", "democritus", "zhuangzi", "avicenna", "aquinas", "george-berkeley", "heidegger"],
    relationIds: ["aristotle-avicenna", "avicenna-aquinas", "aristotle-aquinas"],
    primaryJourneyId: "ontology",
    relatedJourneyIds: ["knowledge-world"],
  },
  {
    questionId: "knowledge",
    featuredOrder: 2,
    title: "我们如何知道？",
    subtitle: "感官、推理与经验",
    artwork: artwork("knowledge"),
    theme: { accent: "#8099c6", glow: "rgba(94, 124, 184, .36)" },
    camera: { lat: 34, lon: 38, distance: 4.72 },
    thinkerIds: ["plato", "akshapada-gautama", "dignaga", "descartes", "locke", "hume", "kant", "thomas-kuhn", "donna-haraway"],
    relationIds: ["locke-hume", "hume-kant"],
    primaryJourneyId: "epistemology",
  },
  {
    questionId: "self",
    featuredOrder: null,
    title: "“我”是谁？",
    subtitle: "意识、身体与无我",
    artwork: artwork("self"),
    theme: { accent: "#a184bd", glow: "rgba(129, 91, 166, .38)" },
    camera: { lat: 27, lon: 76, distance: 4.68 },
    thinkerIds: ["buddha", "zhuangzi", "avicenna", "descartes", "hume", "kierkegaard", "husserl", "heidegger", "beauvoir"],
    relationIds: ["buddha-nagarjuna", "husserl-heidegger"],
    primaryJourneyId: "existentialism",
    relatedJourneyIds: ["phenomenology"],
  },
  {
    questionId: "good-life",
    featuredOrder: 3,
    title: "怎样过好一生？",
    subtitle: "德性、幸福与解脱",
    artwork: artwork("good-life"),
    theme: { accent: "#78aa8a", glow: "rgba(74, 142, 106, .34)" },
    camera: { lat: 31, lon: 89, distance: 4.76 },
    thinkerIds: ["confucius", "aristotle", "epicurus", "buddha", "spinoza", "jeremy-bentham", "martha-nussbaum"],
    relationIds: ["confucius-aristotle"],
    primaryJourneyId: "happiness",
  },
  {
    questionId: "society",
    featuredOrder: null,
    title: "怎样组织公正社会？",
    subtitle: "权利、制度与共同生活",
    artwork: artwork("society"),
    theme: { accent: "#c2755e", glow: "rgba(168, 73, 49, .36)" },
    camera: { lat: 38, lon: 10, distance: 4.92 },
    thinkerIds: ["confucius", "plato", "aristotle", "hobbes", "rousseau", "wollstonecraft", "marx", "john-rawls", "angela-davis"],
    relationIds: ["plato-aristotle", "rousseau-wollstonecraft", "hegel-marx"],
    primaryJourneyId: "justice",
  },
  {
    questionId: "freedom",
    featuredOrder: null,
    title: "我们真的自由吗？",
    subtitle: "意志、权力与处境",
    artwork: artwork("freedom"),
    theme: { accent: "#b96b58", glow: "rgba(86, 157, 132, .32)" },
    camera: { lat: 43, lon: 18, distance: 4.7 },
    thinkerIds: ["epictetus", "zhuangzi", "augustine", "spinoza", "kant", "nietzsche", "beauvoir", "foucault"],
    relationIds: ["nietzsche-foucault"],
    primaryJourneyId: "free-will",
  },
];

export const questionPresentationById = new Map(
  questionPresentations.map((presentation) => [presentation.questionId, presentation]),
);

export const featuredQuestionPresentations = questionPresentations
  .filter((presentation) => presentation.featuredOrder !== null)
  .sort((left, right) => Number(left.featuredOrder) - Number(right.featuredOrder));

export const relationTypeOrder: RelationType[] = [
  "direct-influence",
  "text-transmission",
  "critique",
  "lineage",
  "thematic-resonance",
];
