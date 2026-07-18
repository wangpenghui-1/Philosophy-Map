export type ContentTier = "index" | "standard" | "deep";
export type EditorialStatus = "candidate" | "edited" | "reviewed" | "published";
export type KnowledgeEntityType = "person" | "concept" | "tradition" | "work" | "context" | "place";

export interface CitationRef {
  sourceId: string;
  locator: string;
  claim: string;
}

export interface EditorialMetadata {
  contentTier: ContentTier;
  editorialStatus: EditorialStatus;
  version: number;
  editedBy?: string;
  reviewedBy?: string;
  lastReviewedAt?: string;
  notes?: string;
}

export interface KnowledgeSource extends EditorialMetadata {
  id: string;
  entityType: "source";
  title: string;
  authors: string[];
  sourceType: string;
  publication: string;
  year?: number;
  url?: string;
  doi?: string;
  isbn?: string;
  defaultLocator?: string;
  language: string;
}

export interface KnowledgePerson extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "person";
  names: { display: string; english: string; original?: string; aliases: string[] };
  chronology: { label: string; startYear: number; endYear: number; certainty: string; note?: string };
  primaryRegion: string;
  secondaryRegions: string[];
  traditionIds: string[];
  conceptIds: string[];
  questionIds: string[];
  guidingQuestion: string;
  thesis: string;
  summary: string;
  workIds: string[];
  placeLinks: Array<{ placeId: string; role: string }>;
  sourceIds: string[];
  citations: CitationRef[];
  sections: Array<{ id: string; heading: string; paragraphs: Array<{ text: string; citations: CitationRef[] }> }>;
  media: {
    fullSrc?: string;
    thumbSrc?: string;
    alt: string;
    objectPosition?: string;
    depictionNote: string;
    presentationType: string;
    authenticity: string;
    rightsStatus: string;
    credit: string;
  };
  uncertainty?: string;
  color: string;
  mapVisible: boolean;
}

export interface KnowledgeConcept extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "concept";
  name: string;
  originalTerms: string[];
  summary: string;
  senses: Array<{ traditionId: string; label: string; explanation: string; citations: CitationRef[] }>;
  personIds: string[];
  workIds: string[];
  traditionIds: string[];
  sourceIds: string[];
  citations: CitationRef[];
}

export interface KnowledgeTradition extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "tradition";
  name: string;
  originalNames: string[];
  summary: string;
  periodLabel: string;
  regionLabels: string[];
  parentIds: string[];
  relatedTraditionIds: string[];
  personIds: string[];
  conceptIds: string[];
  sourceIds: string[];
  citations: CitationRef[];
}

export interface KnowledgeWork extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "work";
  title: string;
  originalTitle?: string;
  authorRefs: Array<{ personId: string; role: string; certainty: string }>;
  dateLabel: string;
  languages: string[];
  summary: string;
  conceptIds: string[];
  traditionIds: string[];
  sourceIds: string[];
  citations: CitationRef[];
}

export interface KnowledgePlace extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "place";
  historicalName: string;
  historicalRegion: string;
  modernReferenceName?: string;
  coordinates: { lat: number; lon: number };
  certainty: "established" | "approximate" | "disputed";
  note?: string;
  relatedPersonIds: string[];
}

export interface KnowledgeContext extends EditorialMetadata {
  id: string;
  slug: string;
  entityType: "context";
  contextType: string;
  name: string;
  chronologyLabel: string;
  summary: string;
  personIds: string[];
  placeIds: string[];
  sourceIds: string[];
  citations: CitationRef[];
}

export interface KnowledgeRelation extends EditorialMetadata {
  id: string;
  entityType: "relation";
  from: { entityType: KnowledgeEntityType; id: string };
  to: { entityType: KnowledgeEntityType; id: string };
  directed: boolean;
  relationType: string;
  evidenceStatus: string;
  title: string;
  explanation: string;
  note?: string;
  citations: CitationRef[];
  atlasVisibility: boolean;
}

export interface KnowledgeBase {
  people: KnowledgePerson[];
  concepts: KnowledgeConcept[];
  traditions: KnowledgeTradition[];
  works: KnowledgeWork[];
  contexts: KnowledgeContext[];
  places: KnowledgePlace[];
  sources: KnowledgeSource[];
  relations: KnowledgeRelation[];
}

export interface KnowledgeIndexItem {
  id: string;
  slug: string;
  entityType: "person" | "concept" | "tradition" | "work";
  title: string;
  subtitle: string;
  summary: string;
  contentTier: ContentTier;
  region?: string;
  period?: string;
  startYear?: number;
  traditionIds: string[];
  searchText: string;
  href: string;
}
