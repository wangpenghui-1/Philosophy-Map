import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const projectRoot = path.resolve(import.meta.dirname, "..");
const peopleRoot = path.join(projectRoot, "content", "knowledge", "people");
const worksRoot = path.join(projectRoot, "content", "knowledge", "works");
const outputPath = process.argv[2] ?? path.join(projectRoot, ".tmp", "quote-research-candidates.json");

async function readJsonDirectory(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

const [people, works] = await Promise.all([readJsonDirectory(peopleRoot), readJsonDirectory(worksRoot)]);
const workById = new Map(works.map((work) => [work.id, work]));
const pending = people.filter((person) => !person.representativeQuote);

function wikiFor(person) {
  const languages = new Set(person.workIds.flatMap((id) => workById.get(id)?.languages ?? []));
  if (languages.has("zh")) return { domain: "zh.wikiquote.org", title: person.names.display };
  return { domain: "en.wikiquote.org", title: person.names.english };
}

function cleanWikiText(value) {
  return value
    .replace(/<!--.*?-->/gs, " ")
    .replace(/<ref\b[^>]*>.*?<\/ref>/gis, " ")
    .replace(/<ref\b[^/>]*\/>/gi, " ")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g, "$1")
    .replace(/''+/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCandidates(wikitext) {
  const lines = wikitext.split(/\r?\n/);
  const results = [];
  let blockedSection = false;
  let sectionTitle = "";
  let subsectionTitle = "";
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    const heading = raw.match(/^(={2,})\s*(.*?)\s*\1$/);
    if (heading) {
      const cleanHeading = cleanWikiText(heading[2]);
      const label = cleanHeading.toLowerCase();
      if (heading[1].length === 2) {
        sectionTitle = cleanHeading;
        subsectionTitle = "";
        blockedSection = /quotes? about|about the|misattributed|attributed|disputed|评价|关于|误传|伪托/.test(label);
      } else if (heading[1].length === 3) {
        subsectionTitle = cleanHeading;
      }
      continue;
    }
    if (blockedSection) continue;
    if (!/^\*[^*]/.test(raw)) continue;
    if (/^\*\s*(?:File|Image|Category):/i.test(raw)) continue;
    const text = cleanWikiText(raw.replace(/^\*\s*/, ""));
    if (text.length < 18 || text.length > 700) continue;
    const sourceLines = [];
    for (let offset = 1; offset <= 5 && index + offset < lines.length; offset += 1) {
      const next = lines[index + offset].trim();
      if (/^\*[^*]/.test(next) || /^==/.test(next)) break;
      if (/^\*\*/.test(next)) sourceLines.push(cleanWikiText(next.replace(/^\*+\s*/, "")));
    }
    const rawSource = sourceLines.filter(Boolean).join(" · ");
    if (!rawSource || /misattributed|attributed to|quotation about|as quoted by|regarding .*['’]s work/i.test(rawSource)) continue;
    const contextTitles = [sectionTitle, subsectionTitle]
      .filter((title, titleIndex, titles) => title && !/^(?:quotes?|语录|名言)$/i.test(title) && titles.indexOf(title) === titleIndex);
    const source = [...contextTitles, rawSource].join(" · ");
    const score = (source ? 4 : 0)
      + (/\b(?:chapter|book|page|p\.|vol\.|speech|essay|letter|interview|lecture|section)\b/i.test(source) ? 3 : 0)
      + (/\b\d{4}\b/.test(source) ? 1 : 0)
      + (text.length <= 280 ? 1 : 0);
    results.push({ text, source, rawSource, sectionTitle, subsectionTitle, score });
  }
  return results.sort((left, right) => right.score - left.score || left.text.length - right.text.length).slice(0, 12);
}

async function fetchBatch(domain, entries) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: entries.map((entry) => entry.title).join("|"),
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const endpoint = `https://${domain}/w/api.php?${params}`;
  try {
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(endpoint, { headers: { "user-agent": "PhilosophyMapQuoteResearch/1.0 (local editorial research)" } });
      if (response.status !== 429) break;
      const retryAfter = Number(response.headers.get("retry-after")) || (attempt + 1) * 2;
      await delay(Math.min(retryAfter * 1000, 10000));
    }
    if (!response?.ok) throw new Error(`HTTP ${response?.status ?? "unknown"}`);
    const payload = await response.json();
    if (!payload.query?.pages) throw new Error(payload.error?.info ?? "query failed");
    const aliases = new Map([
      ...(payload.query.normalized ?? []).map((item) => [item.from, item.to]),
      ...(payload.query.redirects ?? []).map((item) => [item.from, item.to]),
    ]);
    const resolveTitle = (title) => {
      let current = title;
      const seen = new Set();
      while (aliases.has(current) && !seen.has(current)) {
        seen.add(current);
        current = aliases.get(current);
      }
      return current;
    };
    const pageByTitle = new Map(payload.query.pages.map((page) => [page.title, page]));
    return entries.map(({ person, title }) => {
      const resolvedTitle = resolveTitle(title);
      const page = pageByTitle.get(resolvedTitle);
      const wikitext = page?.revisions?.[0]?.slots?.main?.content;
      if (!page || page.missing || !wikitext) {
        return { personId: person.id, name: person.names.display, pageTitle: resolvedTitle, error: "page not found", candidates: [] };
      }
      return {
        personId: person.id,
        name: person.names.display,
        pageTitle: page.title,
        pageUrl: `https://${domain}/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        candidates: extractCandidates(wikitext),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return entries.map(({ person, title }) => ({ personId: person.id, name: person.names.display, pageTitle: title, error: message, candidates: [] }));
  }
}

const results = [];
const entriesByDomain = Map.groupBy(pending.map((person) => ({ person, ...wikiFor(person) })), (entry) => entry.domain);
for (const [domain, entries] of entriesByDomain) {
  for (let index = 0; index < entries.length; index += 30) {
    results.push(...await fetchBatch(domain, entries.slice(index, index + 30)));
    await delay(1000);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  disclaimer: "Candidate discovery only. Every quotation, work locator, original-language status, and translation must be checked against a primary text or reliable edition before publication.",
  summary: {
    pendingPeople: pending.length,
    pagesFound: results.filter((item) => !item.error).length,
    peopleWithCandidates: results.filter((item) => item.candidates.length).length,
  },
  people: results,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
