export const entityTypes = [
  "person",
  "concept",
  "tradition",
  "work",
  "context",
  "place",
  "source",
] as const;

export type EntityType = (typeof entityTypes)[number];

export const editorialStatuses = [
  "candidate",
  "edited",
  "reviewed",
  "published",
] as const;

export type EditorialStatus = (typeof editorialStatuses)[number];

const editorialTransitions: Record<EditorialStatus, readonly EditorialStatus[]> = {
  candidate: ["edited"],
  edited: ["candidate", "reviewed"],
  reviewed: ["edited", "published"],
  published: [],
};

export function canTransitionEditorialStatus(
  from: EditorialStatus,
  to: EditorialStatus,
) {
  return editorialTransitions[from].includes(to);
}

export function assertEditorialTransition(
  from: EditorialStatus,
  to: EditorialStatus,
) {
  if (!canTransitionEditorialStatus(from, to)) {
    throw new Error(`Editorial status cannot transition from ${from} to ${to}.`);
  }
}

export const roles = [
  "anonymous",
  "member",
  "contributor",
  "editor",
  "reviewer",
  "publisher",
  "admin",
  "owner",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "knowledge:read",
  "knowledge:candidate:create",
  "knowledge:draft:edit",
  "knowledge:review:submit",
  "knowledge:review:complete",
  "knowledge:publish",
  "knowledge:withdraw",
  "journey:edit",
  "media:manage",
  "conversation:use",
  "profile:manage",
  "memory:manage",
  "user:manage",
  "system:operate",
  "role:manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  anonymous: new Set(["knowledge:read"]),
  member: new Set([
    "knowledge:read",
    "conversation:use",
    "profile:manage",
    "memory:manage",
  ]),
  contributor: new Set([
    "knowledge:read",
    "knowledge:candidate:create",
    "knowledge:draft:edit",
    "conversation:use",
    "profile:manage",
    "memory:manage",
  ]),
  editor: new Set([
    "knowledge:read",
    "knowledge:candidate:create",
    "knowledge:draft:edit",
    "knowledge:review:submit",
    "journey:edit",
    "media:manage",
  ]),
  reviewer: new Set([
    "knowledge:read",
    "knowledge:draft:edit",
    "knowledge:review:submit",
    "knowledge:review:complete",
  ]),
  publisher: new Set([
    "knowledge:read",
    "knowledge:publish",
    "knowledge:withdraw",
  ]),
  admin: new Set([
    "knowledge:read",
    "knowledge:candidate:create",
    "knowledge:draft:edit",
    "knowledge:review:submit",
    "journey:edit",
    "media:manage",
    "user:manage",
    "system:operate",
  ]),
  owner: new Set(permissions),
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role].has(permission);
}

export function assertPermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} does not have permission ${permission}.`);
  }
}

export interface PublishedEntitySummary {
  id: string;
  stableKey: string;
  slug: string;
  entityType: EntityType;
  locale: string;
  title: string;
  summary: string;
  contentTier: "index" | "standard" | "deep";
  version: number;
}

export interface EvidenceCitation {
  sourceId: string;
  sourceTitle: string;
  locator: string;
  claim: string;
  entityId: string;
  entityVersion: number;
  fragmentId?: string;
  href?: string;
}

export interface EvidencePacket {
  query: string;
  locale: string;
  retrievedAt: string;
  excerpts: Array<{
    entityId: string;
    entityType: EntityType;
    title: string;
    text: string;
    score: number;
    citations: EvidenceCitation[];
  }>;
}
