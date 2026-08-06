import { z } from "zod";

export const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default("zh-CN");
export const entityTypeSchema = z.enum([
  "person",
  "concept",
  "tradition",
  "work",
  "context",
  "place",
  "source",
]);

export const cursorSchema = z.string().max(200).optional();
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(24);

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  type: entityTypeSchema.optional(),
  region: z.string().trim().max(100).optional(),
  locale: localeSchema,
  cursor: cursorSchema,
  limit: pageSizeSchema,
});

export const graphQuerySchema = z.object({
  entity: z.string().trim().min(1).max(160),
  depth: z.coerce.number().int().min(1).max(2).default(1),
  relationType: z.enum([
    "direct-influence",
    "text-transmission",
    "critique",
    "lineage",
    "thematic-resonance",
    "authorship",
    "participation",
    "conceptualization",
  ]).optional(),
});

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  locale: localeSchema,
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(8_000),
  locale: localeSchema,
});

export const memoryUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(2_000),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).nullable().optional(),
  locale: localeSchema.optional(),
  explanationDepth: z.enum(["concise", "balanced", "deep"]).optional(),
  memoryEnabled: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
});

export const createMemorySchema = memoryUpdateSchema.extend({
  memoryType: z.enum(["preference", "learning", "explicit"]),
  confirmed: z.boolean().default(true),
});

export const memoryPatchSchema = memoryUpdateSchema.partial().extend({
  status: z.enum(["candidate", "confirmed", "rejected", "expired"]).optional(),
});

export const createEntityDraftSchema = z.object({
  stableKey: z.string().trim().min(1).max(180),
  entityType: entityTypeSchema.exclude(["source"]),
  slug: z.string().trim().min(1).max(220),
  locale: localeSchema,
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(40).max(2_000),
  contentTier: z.enum(["index", "standard", "deep"]),
  payload: z.record(z.string(), z.unknown()),
});

export const editorialTransitionSchema = z.object({
  to: z.enum(["candidate", "edited", "reviewed", "published"]),
  note: z.string().trim().max(2_000).optional(),
});

export const createRevisionSchema = z.object({
  note: z.string().trim().max(2_000).optional(),
});

export const publicationActionSchema = z.object({
  action: z.enum(["withdraw", "rollback"]),
  reason: z.string().trim().min(8).max(2_000),
  expectedCurrentVersionId: z.string().uuid().nullable(),
});

export const updateEntityDraftSchema = z.object({
  slug: z.string().trim().min(1).max(220).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().min(40).max(2_000).optional(),
  contentTier: z.enum(["index", "standard", "deep"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, "至少提供一个需要更新的字段。 ");

const sourceFieldsSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  sourceType: z.string().trim().min(1).max(60),
  publication: z.string().trim().min(1).max(1_000),
  publicationYear: z.number().int().min(-3000).max(3000).nullable().optional(),
  url: z.string().trim().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "仅支持 HTTP 或 HTTPS URL").nullable().optional(),
  doi: z.string().trim().max(180).nullable().optional(),
  isbn: z.string().trim().max(80).nullable().optional(),
  language: z.string().trim().min(2).max(16),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const createSourceDraftSchema = sourceFieldsSchema.extend({
  stableKey: z.string().trim().min(1).max(220),
});

export const updateSourceDraftSchema = sourceFieldsSchema.partial()
  .refine((value) => Object.keys(value).length > 0, "至少提供一个需要更新的字段。 ");

const relationCitationSchema = z.object({ sourceId: z.string().trim().min(1).max(220), locator: z.string().trim().min(1).max(1_000), claim: z.string().trim().min(1).max(2_000) });
const relationFieldsSchema = z.object({
  title: z.string().trim().min(1).max(300), explanation: z.string().trim().min(40).max(8_000), note: z.string().trim().max(4_000).nullable().optional(),
  evidenceStatus: z.enum(["established", "supported", "disputed"]), atlasVisibility: z.boolean(), citations: z.array(relationCitationSchema).max(50),
});
export const createRelationDraftSchema = relationFieldsSchema.extend({
  stableKey: z.string().trim().min(1).max(220), fromEntityId: z.string().trim().min(1).max(180), toEntityId: z.string().trim().min(1).max(180),
  directed: z.boolean(), relationType: z.enum(["direct-influence", "text-transmission", "critique", "lineage", "thematic-resonance", "authorship", "participation", "conceptualization"]),
}).refine((value) => value.relationType !== "thematic-resonance" || !value.directed, { message: "主题共鸣必须是非方向关系", path: ["directed"] });
export const updateRelationDraftSchema = relationFieldsSchema.partial().refine((value) => Object.keys(value).length > 0, "至少提供一个需要更新的字段。 ");

const journeyTransitionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("evidence-relation"), relationId: z.string().trim().min(1).max(220), label: z.string().trim().min(1).max(120) }),
  z.object({ kind: z.literal("thematic-transition"), from: z.string().trim().min(1).max(180), to: z.string().trim().min(1).max(180), label: z.enum(["平行回答", "问题转向", "概念重构", "批判推进"]) }),
]);
const journeyNodeSchema = z.object({
  id: z.string().trim().min(1).max(180), thinkerId: z.string().trim().min(1).max(180), eyebrow: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300), coreIdea: z.string().trim().min(10).max(1_000), body: z.string().trim().min(20).max(4_000),
  transitionPrompt: z.string().trim().min(1).max(1_000), durationMs: z.number().int().min(5_000).max(120_000),
  camera: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), distance: z.number().min(1).max(20) }),
  incomingTransition: journeyTransitionSchema.optional(),
});
const journeyFieldsBaseSchema = z.object({
  slug: z.string().trim().min(1).max(220), locale: localeSchema, title: z.string().trim().min(1).max(300),
  category: z.enum(["philosophical-question", "philosophical-tradition"]), availability: z.enum(["available", "coming-soon"]),
  recommended: z.boolean().default(false), relatedJourneyId: z.string().trim().min(1).max(180).nullable().optional(),
  question: z.string().trim().min(4).max(1_000), description: z.string().trim().min(20).max(2_000),
  openingQuestion: z.string().trim().max(2_000).nullable().optional(), closingTitle: z.string().trim().max(300).nullable().optional(),
  closingBody: z.string().trim().max(2_000).nullable().optional(), nodes: z.array(journeyNodeSchema).min(1).max(7),
});
function refineJourney(value: { nodes?: Array<{ id: string }>; relatedJourneyId?: string | null; slug?: string }, context: z.RefinementCtx) {
  if (value.nodes) {
    const ids = value.nodes.map((node) => node.id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["nodes"], message: "旅程节点 ID 不能重复" });
  }
  if (value.relatedJourneyId && value.slug && value.relatedJourneyId === value.slug) context.addIssue({ code: "custom", path: ["relatedJourneyId"], message: "关联旅程不能指向自身" });
}
export const createJourneyDraftSchema = journeyFieldsBaseSchema.extend({ stableKey: z.string().trim().min(1).max(180) }).superRefine(refineJourney);
export const updateJourneyDraftSchema = journeyFieldsBaseSchema.partial().superRefine((value, context) => {
  if (!Object.keys(value).length) context.addIssue({ code: "custom", message: "至少提供一个需要更新的字段。 " });
  refineJourney(value, context);
});

export const progressUpdateSchema = z.object({
  progress: z.number().min(0).max(1),
  anchor: z.string().trim().max(220).nullable().optional(),
});

export const accountDeleteSchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  links?: Record<string, string | null>;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
}

export function apiEnvelope<T>(
  data: T,
  options: Omit<ApiEnvelope<T>, "data"> = {},
): ApiEnvelope<T> {
  return { data, ...options };
}

export function problemDetails(
  status: number,
  title: string,
  detail?: string,
  extra: Partial<ProblemDetails> = {},
): ProblemDetails {
  return {
    type: `https://ideaglobemap.cn/problems/${status}`,
    title,
    status,
    ...(detail ? { detail } : {}),
    ...extra,
  };
}

export function parseCursor(cursor?: string) {
  if (!cursor) return 0;
  try {
    const value = Number(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function createCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
