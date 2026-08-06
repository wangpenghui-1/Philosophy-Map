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

export type EditorialQualitySeverity = "blocker" | "warning";

export interface EditorialQualityFinding {
  code: string;
  severity: EditorialQualitySeverity;
  message: string;
}

export interface EditorialQualityReport {
  readyToPublish: boolean;
  findings: EditorialQualityFinding[];
  checkedAt: string;
}

export interface EditorialQualityInput {
  entityType: EntityType;
  title: string;
  slug: string;
  summary: string;
  contentTier: "index" | "standard" | "deep";
  payload: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function collectSourceIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectSourceIds(item, result);
    return result;
  }
  if (!isRecord(value)) return result;
  for (const [key, item] of Object.entries(value)) {
    if (key === "sourceId" && typeof item === "string" && item.trim()) result.add(item.trim());
    if (key === "sourceIds" && Array.isArray(item)) {
      for (const sourceId of item) if (typeof sourceId === "string" && sourceId.trim()) result.add(sourceId.trim());
    }
    collectSourceIds(item, result);
  }
  return result;
}

export interface PayloadCitationAudit {
  paragraphCount: number;
  citedParagraphCount: number;
  sourceIds: string[];
  errors: string[];
}

export function auditPayloadCitations(payload: unknown): PayloadCitationAudit {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  let paragraphCount = 0;
  let citedParagraphCount = 0;
  if (!isRecord(payload)) return { paragraphCount, citedParagraphCount, sourceIds: [], errors: ["结构化内容必须是 JSON 对象。"] };
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  sections.forEach((section, sectionIndex) => {
    if (!isRecord(section) || !Array.isArray(section.paragraphs)) return;
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      if (!isRecord(paragraph) || typeof paragraph.text !== "string" || !paragraph.text.trim()) return;
      paragraphCount += 1;
      const citations = Array.isArray(paragraph.citations) ? paragraph.citations : [];
      let validCount = 0;
      citations.forEach((citation, citationIndex) => {
        const path = `sections.${sectionIndex}.paragraphs.${paragraphIndex}.citations.${citationIndex}`;
        if (!isRecord(citation)) {
          errors.push(`${path} 必须是引用对象。`);
          return;
        }
        for (const field of ["sourceId", "locator", "claim"] as const) {
          if (typeof citation[field] !== "string" || !citation[field].trim()) errors.push(`${path}.${field} 不能为空。`);
        }
        if (typeof citation.sourceId === "string" && citation.sourceId.trim()) {
          sourceIds.add(citation.sourceId.trim());
          validCount += 1;
        }
      });
      if (validCount > 0) citedParagraphCount += 1;
    });
  });
  return { paragraphCount, citedParagraphCount, sourceIds: [...sourceIds], errors };
}

export function evaluateEditorialQuality(
  input: EditorialQualityInput,
  checkedAt = new Date().toISOString(),
): EditorialQualityReport {
  const findings: EditorialQualityFinding[] = [];
  const payload = isRecord(input.payload) ? input.payload : null;
  const sections = payload && Array.isArray(payload.sections) ? payload.sections : [];
  const sourceIds = collectSourceIds(payload);
  const citationAudit = auditPayloadCitations(payload);

  if (!input.title.trim()) {
    findings.push({ code: "title.missing", severity: "blocker", message: "标题不能为空。" });
  }
  if (!input.slug.trim()) {
    findings.push({ code: "slug.missing", severity: "blocker", message: "Slug 不能为空。" });
  }
  if (input.summary.trim().length < 40) {
    findings.push({ code: "summary.too-short", severity: "blocker", message: "摘要至少需要 40 个字符。" });
  }
  if (!payload) {
    findings.push({ code: "payload.invalid", severity: "blocker", message: "结构化内容必须是 JSON 对象。" });
  }
  if (input.contentTier !== "index" && sections.length === 0) {
    findings.push({ code: "sections.missing", severity: "blocker", message: "标准或深入内容至少需要一个正文段落分区。" });
  }
  if (input.entityType !== "place" && sourceIds.size === 0) {
    findings.push({ code: "sources.missing", severity: "blocker", message: "发布前至少需要绑定一个可追溯来源。" });
  }
  if (input.contentTier !== "index" && citationAudit.paragraphCount > citationAudit.citedParagraphCount) {
    findings.push({
      code: "citations.paragraph-coverage",
      severity: "blocker",
      message: `${citationAudit.paragraphCount - citationAudit.citedParagraphCount} 个正文段落尚未绑定来源。`,
    });
  }
  if (input.contentTier === "deep" && sourceIds.size < 2) {
    findings.push({ code: "sources.too-few-for-deep", severity: "warning", message: "深入内容建议至少使用两个相互独立的来源。" });
  }
  if (input.entityType === "person" && payload && !payload.representativeQuote) {
    findings.push({ code: "person.quote-missing", severity: "warning", message: "人物内容尚未提供可追溯的代表引文。" });
  }

  return {
    readyToPublish: !findings.some((finding) => finding.severity === "blocker"),
    findings,
    checkedAt,
  };
}

export interface SourceQualityInput {
  title: string;
  authors: string[];
  sourceType: string;
  publication: string;
  publicationYear?: number | null;
  url?: string | null;
  doi?: string | null;
  isbn?: string | null;
  language: string;
}

export function evaluateSourceQuality(input: SourceQualityInput, checkedAt = new Date().toISOString()): EditorialQualityReport {
  const findings: EditorialQualityFinding[] = [];
  if (!input.title.trim()) findings.push({ code: "source.title-missing", severity: "blocker", message: "来源标题不能为空。" });
  if (!input.authors.some((author) => author.trim())) findings.push({ code: "source.authors-missing", severity: "blocker", message: "至少需要一位作者或责任主体。" });
  if (!input.sourceType.trim()) findings.push({ code: "source.type-missing", severity: "blocker", message: "来源类型不能为空。" });
  if (!input.publication.trim()) findings.push({ code: "source.publication-missing", severity: "blocker", message: "出版信息或馆藏信息不能为空。" });
  if (!input.language.trim()) findings.push({ code: "source.language-missing", severity: "blocker", message: "来源语言不能为空。" });
  if (!input.url && !input.doi && !input.isbn) {
    findings.push({ code: "source.locator-missing", severity: "blocker", message: "URL、DOI 或 ISBN 至少需要填写一项。" });
  }
  if (input.url) {
    try {
      const url = new URL(input.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error("unsupported");
    } catch {
      findings.push({ code: "source.url-invalid", severity: "blocker", message: "来源 URL 必须是有效的 HTTP 或 HTTPS 地址。" });
    }
  }
  if (!input.publicationYear) findings.push({ code: "source.year-missing", severity: "warning", message: "建议补充出版年份。" });
  return { readyToPublish: !findings.some((finding) => finding.severity === "blocker"), findings, checkedAt };
}

export interface RelationQualityInput {
  fromEntityId: string; toEntityId: string; directed: boolean; relationType: string;
  evidenceStatus: "established" | "supported" | "disputed"; title: string; explanation: string;
  note?: string | null; citations: Array<{ sourceId: string; locator: string; claim: string }>;
}

export function evaluateRelationQuality(input: RelationQualityInput, checkedAt = new Date().toISOString()): EditorialQualityReport {
  const findings: EditorialQualityFinding[] = [];
  if (!input.fromEntityId || !input.toEntityId || input.fromEntityId === input.toEntityId) findings.push({ code: "relation.endpoints-invalid", severity: "blocker", message: "关系必须连接两个不同的有效实体。" });
  if (!input.title.trim()) findings.push({ code: "relation.title-missing", severity: "blocker", message: "关系标题不能为空。" });
  if (input.explanation.trim().length < 40) findings.push({ code: "relation.explanation-short", severity: "blocker", message: "关系说明至少需要40个字符。" });
  if (input.relationType === "thematic-resonance" && input.directed) findings.push({ code: "relation.resonance-directed", severity: "blocker", message: "主题共鸣必须是非方向关系。" });
  if (input.citations.length === 0) findings.push({ code: "relation.citations-missing", severity: "blocker", message: "关系至少需要一条可追溯引用。" });
  if (input.citations.some((item) => !item.sourceId.trim() || !item.locator.trim() || !item.claim.trim())) findings.push({ code: "relation.citation-incomplete", severity: "blocker", message: "关系引用必须包含来源、定位和支持主张。" });
  if (input.evidenceStatus === "disputed" && !input.note?.trim()) findings.push({ code: "relation.dispute-note-missing", severity: "blocker", message: "争议关系必须说明争议边界。" });
  return { readyToPublish: !findings.some((item) => item.severity === "blocker"), findings, checkedAt };
}
