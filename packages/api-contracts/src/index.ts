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

export const updateEntityDraftSchema = z.object({
  slug: z.string().trim().min(1).max(220).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().min(40).max(2_000).optional(),
  contentTier: z.enum(["index", "standard", "deep"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, "至少提供一个需要更新的字段。 ");

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
