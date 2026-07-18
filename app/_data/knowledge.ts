import knowledgeRaw from "../_generated/knowledge.json";
import indexRaw from "../_generated/knowledge-index.json";
import type {
  KnowledgeBase,
  KnowledgeConcept,
  KnowledgeIndexItem,
  KnowledgePerson,
  KnowledgeTradition,
  KnowledgeWork,
} from "../_generated/knowledge-types";

export const knowledgeBase = knowledgeRaw as unknown as KnowledgeBase;
export const knowledgeIndex = indexRaw as unknown as KnowledgeIndexItem[];

export const knowledgePersonById = new Map(knowledgeBase.people.map((item) => [item.id, item]));
export const knowledgePersonBySlug = new Map(knowledgeBase.people.map((item) => [item.slug, item]));
export const knowledgeConceptById = new Map(knowledgeBase.concepts.map((item) => [item.id, item]));
export const knowledgeConceptBySlug = new Map(knowledgeBase.concepts.map((item) => [item.slug, item]));
export const knowledgeTraditionById = new Map(knowledgeBase.traditions.map((item) => [item.id, item]));
export const knowledgeTraditionBySlug = new Map(knowledgeBase.traditions.map((item) => [item.slug, item]));
export const knowledgeWorkById = new Map(knowledgeBase.works.map((item) => [item.id, item]));
export const knowledgeWorkBySlug = new Map(knowledgeBase.works.map((item) => [item.slug, item]));
export const knowledgePlaceById = new Map(knowledgeBase.places.map((item) => [item.id, item]));
export const knowledgeSourceById = new Map(knowledgeBase.sources.map((item) => [item.id, item]));

export const contentTierLabels = {
  index: "索引条目",
  standard: "标准条目",
  deep: "深入条目",
} as const;

export const entityTypeLabels = {
  person: "人物",
  concept: "概念",
  tradition: "传统",
  work: "著作",
} as const;

export function decodeKnowledgeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function getKnowledgePerson(slug: string): KnowledgePerson | undefined {
  return knowledgePersonBySlug.get(decodeKnowledgeSlug(slug));
}

export function getKnowledgeConcept(slug: string): KnowledgeConcept | undefined {
  return knowledgeConceptBySlug.get(decodeKnowledgeSlug(slug));
}

export function getKnowledgeTradition(slug: string): KnowledgeTradition | undefined {
  return knowledgeTraditionBySlug.get(decodeKnowledgeSlug(slug));
}

export function getKnowledgeWork(slug: string): KnowledgeWork | undefined {
  return knowledgeWorkBySlug.get(decodeKnowledgeSlug(slug));
}
