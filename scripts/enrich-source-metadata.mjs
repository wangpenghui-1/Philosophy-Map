import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(projectRoot, "content", "knowledge", "sources");
const files = (await readdir(sourceRoot)).filter((file) => file.endsWith(".json")).sort();

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&ouml;", "ö")
    .replaceAll("&rsquo;", "’")
    .trim();
}

function citationAuthors(html) {
  const authors = [];
  const patterns = [
    /<meta\s+(?:name|property)=["']citation_author["']\s+content=["']([^"']+)["'][^>]*>/gi,
    /<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["']citation_author["'][^>]*>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) authors.push(decodeHtml(match[1]));
  }
  return [...new Set(authors.filter(Boolean))];
}

async function fetchAuthors(source) {
  const doi = source.doi ?? (() => {
    const match = source.url?.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i);
    return match ? decodeURIComponent(match[1]) : null;
  })();
  if (doi) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`https://api.crossref.org/works/${encodeURI(doi)}`, {
        headers: { "user-agent": "AtlasOfIdeasMetadataAudit/1.0 (+https://github.com/wangpenghui-1/Philosophy-Map)" },
        signal: controller.signal,
      });
      if (response.ok) {
        const body = await response.json();
        const authors = (body.message?.author ?? [])
          .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
          .filter(Boolean);
        if (authors.length) return { authors: [...new Set(authors)], reason: "Crossref DOI metadata", doi };
      }
    } catch { /* fall through to citation metadata */ }
    finally { clearTimeout(timeout); }
  }
  const url = source.url ?? (doi ? `https://doi.org/${doi}` : null);
  if (!url) return { authors: [], reason: "no URL or DOI" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "AtlasOfIdeasMetadataAudit/1.0 (+https://github.com/wangpenghui-1/Philosophy-Map)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return { authors: [], reason: `HTTP ${response.status}` };
    const authors = citationAuthors(await response.text());
    return { authors, reason: authors.length ? "citation metadata" : "citation_author metadata missing" };
  } catch (error) {
    return { authors: [], reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const queue = [];
for (const file of files) {
  const absolutePath = path.join(sourceRoot, file);
  const source = JSON.parse(await readFile(absolutePath, "utf8"));
  if (source.authors.length === 0) queue.push({ file, absolutePath, source });
}

const enriched = [];
const unresolved = [];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const item = queue[cursor];
    cursor += 1;
    const result = await fetchAuthors(item.source);
    if (!result.authors.length) {
      unresolved.push({ id: item.source.id, reason: result.reason });
      continue;
    }
    item.source.authors = result.authors;
    if (result.doi && !item.source.doi) item.source.doi = result.doi;
    await writeFile(item.absolutePath, `${JSON.stringify(item.source, null, 2)}\n`);
    enriched.push({ id: item.source.id, authors: result.authors });
  }
}

await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()));
console.log(`Enriched ${enriched.length} source record(s); ${unresolved.length} remain unresolved.`);
enriched.forEach((item) => console.log(`- ${item.id}: ${item.authors.join("; ")}`));
unresolved.forEach((item) => console.log(`- unresolved ${item.id}: ${item.reason}`));
