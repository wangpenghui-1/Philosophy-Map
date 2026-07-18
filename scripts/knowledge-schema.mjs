import { z } from "zod";

export const editorialSchema = z.object({
  contentTier: z.enum(["index", "standard", "deep"]),
  editorialStatus: z.enum(["candidate", "edited", "reviewed", "published"]),
  version: z.number().int().positive(),
  editedBy: z.string().min(1).optional(),
  reviewedBy: z.string().min(1).optional(),
  lastReviewedAt: z.string().date().optional(),
  notes: z.string().optional(),
});

export const citationSchema = z.object({
  sourceId: z.string().min(1),
  locator: z.string().min(1),
  claim: z.string().min(1),
});

const paragraphSchema = z.object({
  text: z.string().min(1),
  citations: z.array(citationSchema).min(1),
});

const sectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  paragraphs: z.array(paragraphSchema).min(1),
});

export const personSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("person"),
  names: z.object({
    display: z.string().min(1),
    english: z.string().min(1),
    original: z.string().min(1).optional(),
    aliases: z.array(z.string()),
  }),
  chronology: z.object({
    label: z.string().min(1),
    startYear: z.number().int(),
    endYear: z.number().int(),
    certainty: z.enum(["established", "approximate", "disputed"]),
    note: z.string().optional(),
  }),
  primaryRegion: z.string().min(1),
  secondaryRegions: z.array(z.string()),
  traditionIds: z.array(z.string()).min(1),
  conceptIds: z.array(z.string()).min(1),
  questionIds: z.array(z.enum(["good-life", "knowledge", "self", "reality", "society", "freedom"])).min(1),
  guidingQuestion: z.string().min(1),
  thesis: z.string().min(1),
  summary: z.string().min(80).max(180),
  workIds: z.array(z.string()),
  placeLinks: z.array(z.object({ placeId: z.string(), role: z.string() })).min(1),
  sourceIds: z.array(z.string()).min(1),
  citations: z.array(citationSchema).min(1),
  sections: z.array(sectionSchema).min(1),
  media: z.object({
    fullSrc: z.string().optional(),
    thumbSrc: z.string().optional(),
    alt: z.string().min(1),
    objectPosition: z.string().optional(),
    depictionNote: z.string().min(1),
    presentationType: z.enum(["historical", "photographic", "stylized", "placeholder"]),
    authenticity: z.enum(["documented", "traditional", "interpretive", "unavailable"]),
    rightsStatus: z.string().min(1),
    credit: z.string().min(1),
  }),
  uncertainty: z.string().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  mapVisible: z.boolean(),
}).merge(editorialSchema);

export const sourceSchema = z.object({
  id: z.string().min(1),
  entityType: z.literal("source"),
  title: z.string().min(1),
  authors: z.array(z.string()),
  sourceType: z.enum([
    "primary-text",
    "scholarly-book",
    "peer-reviewed-article",
    "scholarly-encyclopedia",
    "reference-dataset",
    "archival-source",
  ]),
  publication: z.string().min(1),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  defaultLocator: z.string().optional(),
  language: z.string().min(2),
}).merge(editorialSchema);

export const workSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("work"),
  title: z.string().min(1),
  originalTitle: z.string().optional(),
  authorRefs: z.array(z.object({
    personId: z.string(),
    role: z.enum(["author", "attributed-author", "editor", "compiler", "translator"]),
    certainty: z.enum(["established", "supported", "disputed"]),
  })).min(1),
  dateLabel: z.string().min(1),
  languages: z.array(z.string()),
  summary: z.string().min(40),
  conceptIds: z.array(z.string()),
  traditionIds: z.array(z.string()),
  sourceIds: z.array(z.string()).min(1),
  citations: z.array(citationSchema).min(1),
}).merge(editorialSchema);

export const placeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("place"),
  historicalName: z.string().min(1),
  historicalRegion: z.string().min(1),
  modernReferenceName: z.string().optional(),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  certainty: z.enum(["established", "approximate", "disputed"]),
  note: z.string().optional(),
  relatedPersonIds: z.array(z.string()),
}).merge(editorialSchema);

export const traditionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("tradition"),
  name: z.string().min(1),
  originalNames: z.array(z.string()),
  summary: z.string().min(40),
  periodLabel: z.string().min(1),
  regionLabels: z.array(z.string()).min(1),
  parentIds: z.array(z.string()),
  relatedTraditionIds: z.array(z.string()),
  personIds: z.array(z.string()).min(1),
  conceptIds: z.array(z.string()).min(1),
  sourceIds: z.array(z.string()).min(1),
  citations: z.array(citationSchema).min(1),
}).merge(editorialSchema);

export const conceptSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("concept"),
  name: z.string().min(1),
  originalTerms: z.array(z.string()),
  summary: z.string().min(40),
  senses: z.array(z.object({
    traditionId: z.string(),
    label: z.string(),
    explanation: z.string().min(1),
    citations: z.array(citationSchema).min(1),
  })).min(1),
  personIds: z.array(z.string()).min(1),
  workIds: z.array(z.string()),
  traditionIds: z.array(z.string()).min(1),
  sourceIds: z.array(z.string()).min(1),
  citations: z.array(citationSchema).min(1),
}).merge(editorialSchema);

export const contextSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  entityType: z.literal("context"),
  contextType: z.enum(["event", "institution", "movement", "translation-network"]),
  name: z.string().min(1),
  chronologyLabel: z.string().min(1),
  summary: z.string().min(40),
  personIds: z.array(z.string()),
  placeIds: z.array(z.string()),
  sourceIds: z.array(z.string()).min(1),
  citations: z.array(citationSchema).min(1),
}).merge(editorialSchema);

export const entityRefSchema = z.object({
  entityType: z.enum(["person", "work", "concept", "tradition", "context", "place"]),
  id: z.string().min(1),
});

export const relationSchema = z.object({
  id: z.string().min(1),
  entityType: z.literal("relation"),
  from: entityRefSchema,
  to: entityRefSchema,
  directed: z.boolean(),
  relationType: z.enum([
    "direct-influence",
    "text-transmission",
    "critique",
    "lineage",
    "thematic-resonance",
    "authorship",
    "participation",
    "conceptualization",
  ]),
  evidenceStatus: z.enum(["established", "supported", "disputed"]),
  title: z.string().min(1),
  explanation: z.string().min(1),
  note: z.string().optional(),
  citations: z.array(citationSchema).min(1),
  atlasVisibility: z.boolean(),
}).merge(editorialSchema);

export const schemasByDirectory = {
  people: personSchema,
  concepts: conceptSchema,
  traditions: traditionSchema,
  works: workSchema,
  contexts: contextSchema,
  places: placeSchema,
  sources: sourceSchema,
  relations: relationSchema,
};
