import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const entityTypeEnum = pgEnum("entity_type", [
  "person", "concept", "tradition", "work", "context", "place", "source",
]);
export const editorialStatusEnum = pgEnum("editorial_status", [
  "candidate", "edited", "reviewed", "published",
]);
export const contentTierEnum = pgEnum("content_tier", ["index", "standard", "deep"]);
export const evidenceStatusEnum = pgEnum("evidence_status", ["established", "supported", "disputed"]);
export const relationTypeEnum = pgEnum("relation_type", [
  "direct-influence", "text-transmission", "critique", "lineage",
  "thematic-resonance", "authorship", "participation", "conceptualization",
]);
export const roleEnum = pgEnum("role", [
  "anonymous", "member", "contributor", "editor", "reviewer", "publisher", "admin", "owner",
]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system", "tool"]);
export const memoryStatusEnum = pgEnum("memory_status", ["candidate", "confirmed", "rejected", "expired"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "completed", "failed"]);

export const entities = pgTable("entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id"),
  stableKey: varchar("stable_key", { length: 180 }).notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  currentPublishedVersionId: uuid("current_published_version_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("entities_type_stable_key_uq").on(table.entityType, table.stableKey),
  index("entities_published_version_idx").on(table.currentPublishedVersionId),
]);

export const entityVersions = pgTable("entity_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  locale: varchar("locale", { length: 16 }).default("zh-CN").notNull(),
  slug: varchar("slug", { length: 220 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  contentTier: contentTierEnum("content_tier").notNull(),
  editorialStatus: editorialStatusEnum("editorial_status").notNull(),
  schemaVersion: integer("schema_version").default(1).notNull(),
  payload: jsonb("payload").notNull(),
  createdBy: uuid("created_by"),
  editedBy: text("edited_by"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  supersedesVersionId: uuid("supersedes_version_id"),
  ...timestamps,
}, (table) => [
  uniqueIndex("entity_versions_number_locale_uq").on(table.entityId, table.version, table.locale),
  index("entity_versions_slug_locale_version_idx").on(table.slug, table.locale, table.version),
  index("entity_versions_public_lookup_idx").on(table.editorialStatus, table.locale, table.slug),
]);

export const entityNames = pgTable("entity_names", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id, { onDelete: "cascade" }).notNull(),
  locale: varchar("locale", { length: 16 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
}, (table) => [index("entity_names_normalized_idx").on(table.normalizedValue)]);

export const relations = pgTable("relations", {
  id: uuid("id").defaultRandom().primaryKey(),
  stableKey: varchar("stable_key", { length: 220 }).notNull().unique(),
  fromEntityId: uuid("from_entity_id").references(() => entities.id).notNull(),
  toEntityId: uuid("to_entity_id").references(() => entities.id).notNull(),
  directed: boolean("directed").notNull(),
  relationType: relationTypeEnum("relation_type").notNull(),
  currentPublishedVersionId: uuid("current_published_version_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("relations_from_idx").on(table.fromEntityId, table.relationType),
  index("relations_to_idx").on(table.toEntityId, table.relationType),
]);

export const relationVersions = pgTable("relation_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  relationId: uuid("relation_id").references(() => relations.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  locale: varchar("locale", { length: 16 }).default("zh-CN").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  note: text("note"),
  evidenceStatus: evidenceStatusEnum("evidence_status").notNull(),
  editorialStatus: editorialStatusEnum("editorial_status").notNull(),
  atlasVisibility: boolean("atlas_visibility").default(false).notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("relation_versions_number_locale_uq").on(table.relationId, table.version, table.locale),
  index("relation_versions_public_idx").on(table.editorialStatus, table.locale),
]);

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  stableKey: varchar("stable_key", { length: 220 }).notNull().unique(),
  currentPublishedVersionId: uuid("current_published_version_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const sourceVersions = pgTable("source_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().default([]).notNull(),
  sourceType: varchar("source_type", { length: 60 }).notNull(),
  publication: text("publication").notNull(),
  publicationYear: integer("publication_year"),
  url: text("url"),
  doi: varchar("doi", { length: 180 }),
  isbn: varchar("isbn", { length: 80 }),
  language: varchar("language", { length: 16 }).notNull(),
  editorialStatus: editorialStatusEnum("editorial_status").notNull(),
  payload: jsonb("payload").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("source_versions_number_uq").on(table.sourceId, table.version)]);

export const contentFragments = pgTable("content_fragments", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id, { onDelete: "cascade" }).notNull(),
  fragmentKey: varchar("fragment_key", { length: 220 }).notNull(),
  heading: text("heading"),
  body: text("body").notNull(),
  ordinal: integer("ordinal").notNull(),
}, (table) => [
  uniqueIndex("content_fragments_key_uq").on(table.entityVersionId, table.fragmentKey),
]);

export const citations = pgTable("citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  fragmentId: uuid("fragment_id").references(() => contentFragments.id, { onDelete: "cascade" }),
  relationVersionId: uuid("relation_version_id").references(() => relationVersions.id, { onDelete: "cascade" }),
  sourceVersionId: uuid("source_version_id").references(() => sourceVersions.id).notNull(),
  locator: text("locator").notNull(),
  claim: text("claim").notNull(),
  displayAnchor: varchar("display_anchor", { length: 220 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("citations_fragment_idx").on(table.fragmentId),
  index("citations_relation_idx").on(table.relationVersionId),
  index("citations_source_idx").on(table.sourceVersionId),
]);

export const editorialTasks = pgTable("editorial_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id, { onDelete: "cascade" }).notNull(),
  taskType: varchar("task_type", { length: 80 }).notNull(),
  status: jobStatusEnum("status").default("pending").notNull(),
  assignedTo: uuid("assigned_to"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  payload: jsonb("payload").default({}).notNull(),
  ...timestamps,
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id, { onDelete: "cascade" }).notNull(),
  reviewerId: uuid("reviewer_id"),
  outcome: varchar("outcome", { length: 40 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const publicationEvents = pgTable("publication_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id).notNull(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id).notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  actorId: uuid("actor_id"),
  snapshotId: uuid("snapshot_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const journeys = pgTable("journeys", {
  id: uuid("id").defaultRandom().primaryKey(),
  stableKey: varchar("stable_key", { length: 180 }).notNull().unique(),
  currentPublishedVersionId: uuid("current_published_version_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
});

export const journeyVersions = pgTable("journey_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  locale: varchar("locale", { length: 16 }).default("zh-CN").notNull(),
  slug: varchar("slug", { length: 220 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  estimatedDurationMs: integer("estimated_duration_ms").notNull(),
  editorialStatus: editorialStatusEnum("editorial_status").notNull(),
  payload: jsonb("payload").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("journey_versions_number_locale_uq").on(table.journeyId, table.version, table.locale)]);

export const journeyNodes = pgTable("journey_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  journeyVersionId: uuid("journey_version_id").references(() => journeyVersions.id, { onDelete: "cascade" }).notNull(),
  nodeKey: varchar("node_key", { length: 180 }).notNull(),
  ordinal: integer("ordinal").notNull(),
  entityId: uuid("entity_id").references(() => entities.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  camera: jsonb("camera"),
  transition: jsonb("transition"),
}, (table) => [uniqueIndex("journey_nodes_key_uq").on(table.journeyVersionId, table.nodeKey)]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const authAccounts = pgTable("auth_accounts", {
  provider: varchar("provider", { length: 80 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 220 }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  payload: jsonb("payload").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);

export const passwordCredentials = pgTable("password_credentials", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  passwordHash: text("password_hash").notNull(),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  purpose: varchar("purpose", { length: 40 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("auth_tokens_user_purpose_idx").on(table.userId, table.purpose, table.expiresAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  displayName: varchar("display_name", { length: 120 }),
  locale: varchar("locale", { length: 16 }).default("zh-CN").notNull(),
  explanationDepth: varchar("explanation_depth", { length: 32 }).default("balanced").notNull(),
  memoryEnabled: boolean("memory_enabled").default(false).notNull(),
  preferences: jsonb("preferences").default({}).notNull(),
  ...timestamps,
});

export const consents = pgTable("consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  consentType: varchar("consent_type", { length: 80 }).notNull(),
  granted: boolean("granted").notNull(),
  policyVersion: varchar("policy_version", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  organizationId: uuid("organization_id"),
  role: roleEnum("role").notNull(),
  grantedBy: uuid("granted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.role] })]);

export const favorites = pgTable("favorites", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.entityId] })]);

export const readingProgress = pgTable("reading_progress", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  progress: real("progress").default(0).notNull(),
  anchor: varchar("anchor", { length: 220 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.entityId] })]);

export const journeyProgress = pgTable("journey_progress", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  journeyId: uuid("journey_id").references(() => journeys.id, { onDelete: "cascade" }).notNull(),
  nodeOrdinal: integer("node_ordinal").default(0).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.journeyId] })]);

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  anonymousSessionHash: varchar("anonymous_session_hash", { length: 128 }),
  title: varchar("title", { length: 120 }),
  locale: varchar("locale", { length: 16 }).default("zh-CN").notNull(),
  rollingSummary: text("rolling_summary"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("conversations_user_idx").on(table.userId, table.updatedAt),
  index("conversations_anonymous_idx").on(table.anonymousSessionHash),
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 40 }).default("completed").notNull(),
  sequence: integer("sequence").notNull(),
  providerResponseId: varchar("provider_response_id", { length: 220 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("messages_sequence_uq").on(table.conversationId, table.sequence),
  index("messages_conversation_idx").on(table.conversationId, table.createdAt),
]);

export const messageCitations = pgTable("message_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }).notNull(),
  citationId: uuid("citation_id").references(() => citations.id),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id),
  sourceVersionId: uuid("source_version_id").references(() => sourceVersions.id),
  ordinal: integer("ordinal").notNull(),
  snapshot: jsonb("snapshot").notNull(),
});

export const modelRuns = pgTable("model_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 80 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  status: varchar("status", { length: 40 }).notNull(),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  retrievalSnapshot: jsonb("retrieval_snapshot"),
  errorCode: varchar("error_code", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usageLedger = pgTable("usage_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonymousSessionHash: varchar("anonymous_session_hash", { length: 128 }),
  modelRunId: uuid("model_run_id").references(() => modelRuns.id, { onDelete: "set null" }),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memoryItems = pgTable("memory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: memoryStatusEnum("status").default("candidate").notNull(),
  memoryType: varchar("memory_type", { length: 60 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  value: text("value").notNull(),
  sourceMessageId: uuid("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  confidence: real("confidence"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("memory_items_user_status_idx").on(table.userId, table.status)]);

export const memoryLinks = pgTable("memory_links", {
  memoryId: uuid("memory_id").references(() => memoryItems.id, { onDelete: "cascade" }).notNull(),
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.memoryId, table.entityId] })]);

export const memoryEmbeddings = pgTable("memory_embeddings", {
  memoryId: uuid("memory_id").references(() => memoryItems.id, { onDelete: "cascade" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  embedding: vector1536("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("memory_embeddings_user_idx").on(table.userId)]);

export const memoryEvents = pgTable("memory_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  memoryId: uuid("memory_id").references(() => memoryItems.id, { onDelete: "cascade" }).notNull(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 60 }).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  rightsStatus: text("rights_status").notNull(),
  authenticity: varchar("authenticity", { length: 40 }),
  credit: text("credit"),
  metadata: jsonb("metadata").default({}).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const mediaVariants = pgTable("media_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id").references(() => mediaAssets.id, { onDelete: "cascade" }).notNull(),
  variant: varchar("variant", { length: 60 }).notNull(),
  storageKey: text("storage_key").notNull().unique(),
  width: integer("width"),
  height: integer("height"),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const searchDocuments = pgTable("search_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityVersionId: uuid("entity_version_id").references(() => entityVersions.id, { onDelete: "cascade" }).notNull().unique(),
  locale: varchar("locale", { length: 16 }).notNull(),
  title: text("title").notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
  normalizedText: text("normalized_text").notNull(),
  region: varchar("region", { length: 120 }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
});

export const contentChunks = pgTable("content_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  fragmentId: uuid("fragment_id").references(() => contentFragments.id, { onDelete: "cascade" }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  locale: varchar("locale", { length: 16 }).notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  metadata: jsonb("metadata").default({}).notNull(),
}, (table) => [uniqueIndex("content_chunks_fragment_index_uq").on(table.fragmentId, table.chunkIndex)]);

export const chunkEmbeddings = pgTable("chunk_embeddings", {
  chunkId: uuid("chunk_id").references(() => contentChunks.id, { onDelete: "cascade" }).primaryKey(),
  model: varchar("model", { length: 120 }).notNull(),
  embedding: vector1536("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const releaseSnapshots = pgTable("release_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: varchar("version", { length: 100 }).notNull().unique(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  storageKey: text("storage_key"),
  manifest: jsonb("manifest").notNull(),
  status: varchar("status", { length: 40 }).default("ready").notNull(),
  publishedBy: uuid("published_by"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  actorRole: roleEnum("actor_role"),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resource_type", { length: 80 }).notNull(),
  resourceId: varchar("resource_id", { length: 220 }),
  requestId: varchar("request_id", { length: 120 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_events_resource_idx").on(table.resourceType, table.resourceId, table.createdAt)]);

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
  aggregateId: varchar("aggregate_id", { length: 220 }).notNull(),
  eventType: varchar("event_type", { length: 120 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: jobStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("outbox_events_pending_idx").on(table.status, table.availableAt)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  scope: varchar("scope", { length: 120 }).notNull(),
  key: varchar("key", { length: 220 }).notNull(),
  requestHash: varchar("request_hash", { length: 128 }).notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.scope, table.key] })]);
