import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");
const entityDirectories = ["people", "concepts", "traditions", "works", "contexts", "places", "sources", "relations"];
const deduplicatedArrayKeys = new Set([
  "aliases",
  "authors",
  "conceptIds",
  "languages",
  "originalNames",
  "originalTerms",
  "parentIds",
  "personIds",
  "placeIds",
  "questionIds",
  "regionLabels",
  "relatedPersonIds",
  "relatedTraditionIds",
  "secondaryRegions",
  "sourceIds",
  "traditionIds",
  "workIds",
]);

function collectCitationSourceIds(record) {
  const citations = [...(record.citations ?? [])];
  for (const section of record.sections ?? []) {
    for (const paragraph of section.paragraphs ?? []) citations.push(...(paragraph.citations ?? []));
  }
  for (const sense of record.senses ?? []) citations.push(...(sense.citations ?? []));
  return citations.map((citation) => citation.sourceId).filter(Boolean);
}

function conciseClaim(text, prefix = "支持具体主张") {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return prefix;
  return `${prefix}：${normalized.length > 88 ? `${normalized.slice(0, 88)}…` : normalized}`;
}

function isGenericClaim(claim) {
  return /支持本条目|概述或关系说明|生平、思想概述/.test(claim ?? "");
}

function specifyCitationClaims(record) {
  const fallback = record.explanation
    ?? record.summary
    ?? record.thesis
    ?? record.guidingQuestion
    ?? record.title
    ?? record.name
    ?? record.names?.display;
  for (const citation of record.citations ?? []) {
    if (isGenericClaim(citation.claim)) citation.claim = conciseClaim(fallback, `支持${record.names?.display ?? record.name ?? record.title ?? record.id}的摘要主张`);
  }
  for (const section of record.sections ?? []) {
    for (const paragraph of section.paragraphs ?? []) {
      for (const citation of paragraph.citations ?? []) {
        if (isGenericClaim(citation.claim)) citation.claim = conciseClaim(paragraph.text, "支持本段主张");
      }
    }
  }
  for (const sense of record.senses ?? []) {
    for (const citation of sense.citations ?? []) {
      if (isGenericClaim(citation.claim)) citation.claim = conciseClaim(sense.explanation, `支持“${sense.label}”义项`);
    }
  }
}

function normalizeValue(value, key = "") {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeValue(item));
    return deduplicatedArrayKeys.has(key) && normalized.every((item) => typeof item === "string")
      ? [...new Set(normalized)]
      : normalized;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, normalizeValue(childValue, childKey)]));
  }
  return value;
}

export function normalizeKnowledgeRecord(record) {
  const normalized = normalizeValue(record);
  if (Array.isArray(normalized.authors)) {
    normalized.authors = normalized.authors.map((author) => author.replaceAll("&ouml;", "ö").replaceAll("&rsquo;", "’"));
  }
  if (normalized.reviewedBy === "首轮迁移复核") normalized.reviewedBy = "automated-migration-review/v1";
  specifyCitationClaims(normalized);
  if (Array.isArray(normalized.sourceIds)) {
    normalized.sourceIds = [...new Set([...normalized.sourceIds, ...collectCitationSourceIds(normalized)])];
  }
  return normalized;
}

export async function inspectAutomatedEdits({ write = false } = {}) {
  const changes = [];
  for (const directory of entityDirectories) {
    const absoluteDirectory = path.join(contentRoot, directory);
    const files = (await readdir(absoluteDirectory)).filter((file) => file.endsWith(".json")).sort();
    for (const file of files) {
      const absolutePath = path.join(absoluteDirectory, file);
      const before = await readFile(absolutePath, "utf8");
      const normalized = normalizeKnowledgeRecord(JSON.parse(before));
      const after = `${JSON.stringify(normalized, null, 2)}\n`;
      if (before === after) continue;
      changes.push(path.relative(projectRoot, absolutePath));
      if (write) await writeFile(absolutePath, after);
    }
  }
  return changes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes("--write");
  const changes = await inspectAutomatedEdits({ write });
  if (changes.length) {
    console.log(`${write ? "Applied" : "Required"} ${changes.length} safe editorial normalization(s).`);
    changes.slice(0, 20).forEach((file) => console.log(`- ${file}`));
    if (changes.length > 20) console.log(`- … and ${changes.length - 20} more`);
    if (!write) process.exitCode = 1;
  } else {
    console.log("Automated editor found no pending safe normalizations.");
  }
}
