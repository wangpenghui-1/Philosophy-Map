import type { EntityType, EvidencePacket } from "@atlas/domain";

export interface StaticEntityRecord {
  id: string;
  slug?: string;
  entityType: EntityType | "relation";
  editorialStatus: "candidate" | "edited" | "reviewed" | "published";
  contentTier?: "index" | "standard" | "deep";
  version: number;
  summary?: string;
  names?: { display: string; english: string; original?: string; aliases: string[] };
  name?: string;
  title?: string;
  historicalName?: string;
  sections?: Array<{
    id: string;
    heading: string;
    paragraphs: Array<{
      text: string;
      citations: Array<{ sourceId: string; locator: string; claim: string }>;
    }>;
  }>;
  citations?: Array<{ sourceId: string; locator: string; claim: string }>;
  sourceIds?: string[];
  primaryRegion?: string;
  chronology?: { label: string; startYear: number; endYear: number };
  [key: string]: unknown;
}

export interface StaticSourceRecord extends StaticEntityRecord {
  entityType: "source";
  title: string;
  publication: string;
  url?: string;
  doi?: string;
}

export interface StaticRelationRecord extends StaticEntityRecord {
  entityType: "relation";
  from: { entityType: EntityType; id: string };
  to: { entityType: EntityType; id: string };
  directed: boolean;
  relationType: string;
  evidenceStatus: string;
  title: string;
  explanation: string;
  note?: string;
  atlasVisibility: boolean;
}

export interface StaticIndexItem {
  id: string;
  slug: string;
  entityType: Extract<EntityType, "person" | "concept" | "tradition" | "work">;
  title: string;
  subtitle: string;
  summary: string;
  contentTier: "index" | "standard" | "deep";
  region?: string;
  startYear?: number;
  traditionIds: string[];
  searchText: string;
  href: string;
  [key: string]: unknown;
}

export interface StaticKnowledgeBase {
  people: StaticEntityRecord[];
  concepts: StaticEntityRecord[];
  traditions: StaticEntityRecord[];
  works: StaticEntityRecord[];
  contexts: StaticEntityRecord[];
  places: StaticEntityRecord[];
  sources: StaticSourceRecord[];
  relations: StaticRelationRecord[];
}

export interface SearchOptions {
  query: string;
  entityType?: EntityType;
  region?: string;
  offset?: number;
  limit?: number;
}

export interface SearchResult {
  items: StaticIndexItem[];
  total: number;
  nextOffset: number | null;
}

export interface GraphResult {
  rootId: string;
  entities: StaticEntityRecord[];
  relations: StaticRelationRecord[];
}

export interface KnowledgeRepository {
  catalog(): Record<string, number>;
  getEntity(entityType: EntityType, slugOrId: string): StaticEntityRecord | undefined;
  getSource(id: string): StaticSourceRecord | undefined;
  search(options: SearchOptions): SearchResult;
  graph(entity: string, depth: number, relationType?: string): GraphResult | undefined;
  retrieveEvidence(query: string, locale?: string, limit?: number): EvidencePacket;
}

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
}

function recordTitle(record: StaticEntityRecord) {
  return record.names?.display ?? record.name ?? record.title ?? record.historicalName ?? record.id;
}

function directoryForType(base: StaticKnowledgeBase, entityType: EntityType) {
  const directories: Record<EntityType, StaticEntityRecord[]> = {
    person: base.people,
    concept: base.concepts,
    tradition: base.traditions,
    work: base.works,
    context: base.contexts,
    place: base.places,
    source: base.sources,
  };
  return directories[entityType];
}

export function createStaticKnowledgeRepository(
  base: StaticKnowledgeBase,
  index: StaticIndexItem[],
): KnowledgeRepository {
  const allEntities = [
    ...base.people,
    ...base.concepts,
    ...base.traditions,
    ...base.works,
    ...base.contexts,
    ...base.places,
    ...base.sources,
  ];
  const entityById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const sourceById = new Map(base.sources.map((source) => [source.id, source]));

  return {
    catalog() {
      return {
        people: base.people.length,
        concepts: base.concepts.length,
        traditions: base.traditions.length,
        works: base.works.length,
        contexts: base.contexts.length,
        places: base.places.length,
        sources: base.sources.length,
        relations: base.relations.length,
      };
    },

    getEntity(entityType, slugOrId) {
      const decoded = (() => {
        try { return decodeURIComponent(slugOrId); } catch { return slugOrId; }
      })();
      return directoryForType(base, entityType).find((record) =>
        record.editorialStatus === "published"
        && (record.slug === decoded || record.id === decoded));
    },

    getSource(id) {
      const source = sourceById.get(id);
      return source?.editorialStatus === "published" ? source : undefined;
    },

    search({ query, entityType, region, offset = 0, limit = 24 }) {
      const needle = normalize(query);
      const matches = index.filter((item) => {
        if (entityType && item.entityType !== entityType) return false;
        if (region && item.region !== region) return false;
        if (!needle) return true;
        const title = normalize(item.title);
        const subtitle = normalize(item.subtitle);
        return normalize(item.searchText).includes(needle)
          || title.includes(needle)
          || subtitle.includes(needle)
          || ((item.entityType === "person" ? title.length >= 2 : title.length >= 3) && needle.includes(title))
          || (subtitle.length >= 3 && needle.includes(subtitle));
      });
      const items = matches.slice(offset, offset + limit);
      const nextOffset = offset + items.length < matches.length ? offset + items.length : null;
      return { items, total: matches.length, nextOffset };
    },

    graph(entity, depth, relationType) {
      const root = allEntities.find((record) => record.id === entity || record.slug === entity);
      if (!root || root.editorialStatus !== "published") return undefined;
      const visited = new Set([root.id]);
      let frontier = new Set([root.id]);
      const selectedRelations = new Map<string, StaticRelationRecord>();

      for (let level = 0; level < depth; level += 1) {
        const next = new Set<string>();
        for (const relation of base.relations) {
          if (relation.editorialStatus !== "published") continue;
          if (relationType && relation.relationType !== relationType) continue;
          if (!frontier.has(relation.from.id) && !frontier.has(relation.to.id)) continue;
          selectedRelations.set(relation.id, relation);
          for (const id of [relation.from.id, relation.to.id]) {
            if (!visited.has(id)) next.add(id);
            visited.add(id);
          }
        }
        frontier = next;
      }

      return {
        rootId: root.id,
        entities: [...visited].map((id) => entityById.get(id)).filter((item): item is StaticEntityRecord => Boolean(item)),
        relations: [...selectedRelations.values()],
      };
    },

    retrieveEvidence(query, locale = "zh-CN", limit = 6) {
      const matches = this.search({ query, limit }).items;
      const excerpts = matches.flatMap((match) => {
        const record = entityById.get(match.id);
        if (!record) return [];
        const paragraphs = record.sections?.flatMap((section) =>
          section.paragraphs.map((paragraph) => ({
            entityId: record.id,
            entityType: record.entityType as EntityType,
            title: `${recordTitle(record)} · ${section.heading}`,
            text: paragraph.text,
            score: 1,
            citations: paragraph.citations.map((citation) => {
              const source = sourceById.get(citation.sourceId);
              return {
                ...citation,
                sourceTitle: source?.title ?? citation.sourceId,
                entityId: record.id,
                entityVersion: record.version,
                fragmentId: `${record.id}:${section.id}`,
                href: record.slug ? `/${record.entityType === "person" ? "thinker" : record.entityType}/${record.slug}` : undefined,
              };
            }),
          }))) ?? [];

        if (paragraphs.length) return paragraphs.slice(0, 2);
        return [{
          entityId: record.id,
          entityType: record.entityType as EntityType,
          title: recordTitle(record),
          text: record.summary ?? match.summary,
          score: 0.75,
          citations: (record.citations ?? []).map((citation) => ({
            ...citation,
            sourceTitle: sourceById.get(citation.sourceId)?.title ?? citation.sourceId,
            entityId: record.id,
            entityVersion: record.version,
            href: record.slug ? `/${record.entityType === "person" ? "thinker" : record.entityType}/${record.slug}` : undefined,
          })),
        }];
      }).slice(0, limit);

      return { query, locale, retrievedAt: new Date().toISOString(), excerpts };
    },
  };
}
