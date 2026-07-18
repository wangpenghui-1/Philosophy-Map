import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");
const peopleRoot = path.join(contentRoot, "people");
const catalogPath = path.join(contentRoot, "coverage", "media-210.json");
const publicFullRoot = path.join(projectRoot, "public", "media", "thinkers", "full");
const publicThumbRoot = path.join(projectRoot, "public", "media", "thinkers", "thumb");
const temporaryRoot = "/private/tmp/philosophy-map-media-210";
const retrievedAt = "2026-07-19";
const fetchMedia = process.argv.includes("--fetch");
const refreshMedia = process.argv.includes("--refresh");
const primaryOnly = process.argv.includes("--primary-only");

const approvedLicense = /^(?:Public domain|CC0|CC BY(?:-SA)?(?: [0-9.]+)?|PDM)/iu;
const excludedFile = /\.(?:pdf|djvu|ogg|ogv|webm)$/iu;
const negativeImageTerms = /signature|grave|tomb|book|manuscript|map|house|logo|coat of arms|stamp|poster|group|conference|plaque|memorial|museum room|crater|flag|diagram|title page|temple|shrine|landscape|building|seal|square|sqaure|portada|libro|gumbad/iu;
const positiveImageTerms = /portrait|photo|photograph|painting|statue|bust|人物|肖像|像/iu;
const userAgent = "Philosophy-Map/0.2 (https://github.com/wangpenghui-1/Philosophy-Map; educational knowledge base)";
let apiRequestTail = Promise.resolve();
let downloadRequestTail = Promise.resolve();

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalize(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function stripHtml(value = "") {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, "\"")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function throttleApiRequest() {
  const previous = apiRequestTail;
  let release;
  apiRequestTail = new Promise((resolve) => { release = resolve; });
  await previous;
  await new Promise((resolve) => setTimeout(resolve, 2800));
  release();
}

async function throttleDownloadRequest() {
  const previous = downloadRequestTail;
  let release;
  downloadRequestTail = new Promise((resolve) => { release = resolve; });
  await previous;
  await new Promise((resolve) => setTimeout(resolve, 1800));
  release();
}

async function fetchJson(url, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await throttleApiRequest();
      const response = await fetch(url, {
        headers: { "user-agent": userAgent },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        if (response.status === 429 && attempt < attempts) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 30);
          await new Promise((resolve) => setTimeout(resolve, Math.max(30, retryAfter) * 1000));
          continue;
        }
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError;
}

function apiUrl(host, parameters) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", ...parameters }).toString();
  return url;
}

async function queryWikipediaPageImages(people) {
  const imagesByPersonId = new Map();
  const wikidataByPersonId = new Map();
  for (const group of chunks(people, 30)) {
    const data = await fetchJson(apiUrl("en.wikipedia.org", {
      action: "query",
      titles: group.map((person) => person.names.english).join("|"),
      redirects: "1",
      prop: "pageimages|pageprops",
      piprop: "name",
      ppprop: "wikibase_item",
    }));
    const aliases = new Map(group.map((person) => [normalize(person.names.english), person.id]));
    for (const item of data.query?.normalized ?? []) {
      const personId = aliases.get(normalize(item.from));
      if (personId) aliases.set(normalize(item.to), personId);
    }
    for (const item of data.query?.redirects ?? []) {
      const personId = aliases.get(normalize(item.from));
      if (personId) aliases.set(normalize(item.to), personId);
    }
    for (const page of data.query?.pages ?? []) {
      const personId = aliases.get(normalize(page.title));
      if (personId && page.pageimage) imagesByPersonId.set(personId, page.pageimage);
      if (personId && page.pageprops?.wikibase_item) wikidataByPersonId.set(personId, page.pageprops.wikibase_item);
    }
  }
  return { imagesByPersonId, wikidataByPersonId };
}

async function queryWikidataImages(wikidataByPersonId) {
  const imageByWikidataId = new Map();
  for (const group of chunks([...new Set(wikidataByPersonId.values())], 50)) {
    const data = await fetchJson(apiUrl("www.wikidata.org", {
      action: "wbgetentities",
      ids: group.join("|"),
      props: "claims",
    }));
    for (const entity of Object.values(data.entities ?? {})) {
      const fileName = entity.claims?.P18?.find((claim) => claim.rank !== "deprecated")?.mainsnak?.datavalue?.value;
      if (fileName) imageByWikidataId.set(entity.id, fileName);
    }
  }
  return new Map([...wikidataByPersonId].flatMap(([personId, wikidataId]) => {
    const fileName = imageByWikidataId.get(wikidataId);
    return fileName ? [[personId, fileName]] : [];
  }));
}

async function queryCommonsFiles(fileNames) {
  const byFileName = new Map();
  for (const group of chunks([...new Set(fileNames)], 30)) {
    const data = await fetchJson(apiUrl("en.wikipedia.org", {
      action: "query",
      titles: group.map((file) => `File:${file}`).join("|"),
      redirects: "1",
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime|size",
      iiurlwidth: "1000",
    }));
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const key = page.title.replace(/^File:/u, "");
      byFileName.set(normalize(key), { page, info });
    }
  }
  return byFileName;
}

function licenseOf(candidate) {
  return stripHtml(candidate.info.extmetadata?.LicenseShortName?.value ?? candidate.info.extmetadata?.UsageTerms?.value ?? "");
}

function candidateIsReusable(candidate) {
  const license = licenseOf(candidate);
  return approvedLicense.test(license)
    && candidate.info.mime?.startsWith("image/")
    && candidate.info.descriptionurl?.startsWith("https://commons.wikimedia.org/")
    && !excludedFile.test(candidate.page.title)
    && Number(candidate.info.width ?? 0) >= 180
    && Number(candidate.info.height ?? 0) >= 180;
}

function candidateHaystack(candidate) {
  const metadata = candidate.info.extmetadata ?? {};
  return stripHtml([
    candidate.page.title,
    metadata.ObjectName?.value,
    metadata.ImageDescription?.value,
    metadata.Categories?.value,
  ].filter(Boolean).join(" "));
}

function scoreCandidate(candidate, person) {
  if (!candidateIsReusable(candidate)) return -Infinity;
  const haystack = candidateHaystack(candidate);
  const normalizedHaystack = normalize(haystack);
  const nameTokens = normalize(person.names.english).split(" ").filter((token) => token.length > 2);
  const matchingTokens = nameTokens.filter((token) => normalizedHaystack.includes(token)).length;
  if (matchingTokens === 0) return -Infinity;
  let score = matchingTokens * 8;
  if (normalizedHaystack.includes(normalize(person.names.english))) score += 20;
  if (positiveImageTerms.test(haystack)) score += 8;
  if (negativeImageTerms.test(haystack)) return -Infinity;
  if (candidate.info.height >= candidate.info.width) score += 5;
  if (candidate.info.height >= candidate.info.width * 1.15) score += 3;
  return score;
}

function candidateLooksLikePortrait(candidate, person) {
  const haystack = candidateHaystack(candidate);
  return scoreCandidate(candidate, person) >= 8
    && (positiveImageTerms.test(haystack) || candidate.info.height >= candidate.info.width * 1.05);
}

async function searchCommons(person) {
  const queries = [`\"${person.names.english}\" portrait`, person.names.english];
  let best = null;
  let bestScore = -Infinity;
  for (const search of queries) {
    const data = await fetchJson(apiUrl("commons.wikimedia.org", {
      action: "query",
      generator: "search",
      gsrsearch: search,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|extmetadata|mime|size",
      iiurlwidth: "1000",
    }));
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const candidate = { page, info };
      const score = scoreCandidate(candidate, person);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (bestScore >= 28) break;
  }
  return bestScore >= 8 ? best : null;
}

async function discoverMedia(people) {
  const { imagesByPersonId: pageImages, wikidataByPersonId } = await queryWikipediaPageImages(people);
  const wikidataImages = await queryWikidataImages(wikidataByPersonId);
  for (const [personId, fileName] of wikidataImages) if (!pageImages.has(personId)) pageImages.set(personId, fileName);
  const commonsFiles = await queryCommonsFiles([...pageImages.values()]);
  const discovered = new Map();
  for (const person of people) {
    const fileName = pageImages.get(person.id);
    const candidate = fileName ? commonsFiles.get(normalize(fileName)) : null;
    if (candidate && candidateLooksLikePortrait(candidate, person)) discovered.set(person.id, candidate);
  }
  const missing = people.filter((person) => !discovered.has(person.id));
  if (primaryOnly) return discovered;
  const fallback = await mapLimit(missing, 8, async (person) => {
    try {
      return [person.id, await searchCommons(person)];
    } catch (error) {
      console.warn(`[media] ${person.id} search failed: ${error instanceof Error ? error.message : String(error)}`);
      return [person.id, null];
    }
  });
  for (const [personId, candidate] of fallback) if (candidate) discovered.set(personId, candidate);
  return discovered;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let errorOutput = "";
    child.stderr.on("data", (chunk) => { errorOutput += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${errorOutput.slice(-1000)}`)));
  });
}

async function download(url, file, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await throttleDownloadRequest();
      const response = await fetch(url, {
        headers: { "user-agent": userAgent },
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) {
        if (response.status === 429 && attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 30_000));
          continue;
        }
        throw new Error(`${response.status} ${response.statusText}`);
      }
      await writeFile(file, new Uint8Array(await response.arrayBuffer()));
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function mediaMetadata(person, candidate) {
  const metadata = candidate.info.extmetadata ?? {};
  const license = licenseOf(candidate);
  const creator = stripHtml(metadata.Artist?.value ?? metadata.Credit?.value ?? "Wikimedia Commons contributors").slice(0, 240);
  const photographic = person.chronology.startYear >= 1800;
  return {
    fullSrc: `/media/thinkers/full/${person.slug}.webp`,
    thumbSrc: `/media/thinkers/thumb/${person.slug}.webp`,
    alt: `${person.names.display}的${photographic ? "历史照片" : "后世或传统人物形象"}`,
    objectPosition: "50% 50%",
    depictionNote: photographic
      ? "经开放许可来源核验的人物照片；本站仅作构图裁切、尺寸调整与 WebP 压缩。"
      : "后世流传、纪念性或传统人物形象，并非可考的当时写生肖像；本站按开放许可转载并作构图裁切。",
    presentationType: photographic ? "photographic" : "historical",
    authenticity: photographic ? "documented" : "traditional",
    rightsStatus: license,
    credit: `${creator || "Wikimedia Commons contributors"} · Wikimedia Commons`,
    sourceUrl: candidate.info.descriptionurl,
    sourceFile: candidate.page.title,
    license,
    creator: creator || "Wikimedia Commons contributors",
    retrievedAt,
  };
}

function placeholderMetadata(person) {
  return {
    alt: `${person.names.display}的中性占位图`,
    depictionNote: "暂无经自动审核确认且符合本站授权条件的可靠形象，当前使用明确标注的中性占位。",
    presentationType: "placeholder",
    authenticity: "unavailable",
    rightsStatus: "not-applicable-placeholder",
    credit: "思想星图中性占位",
  };
}

async function prepareAsset(person, candidate) {
  const sourceUrl = candidate.info.thumburl ?? candidate.info.url;
  if (!sourceUrl) throw new Error("missing downloadable image URL");
  await Promise.all([mkdir(temporaryRoot, { recursive: true }), mkdir(publicFullRoot, { recursive: true }), mkdir(publicThumbRoot, { recursive: true })]);
  const sourceFile = path.join(temporaryRoot, `${person.slug}.source`);
  const fullFile = path.join(publicFullRoot, `${person.slug}.webp`);
  const thumbFile = path.join(publicThumbRoot, `${person.slug}.webp`);
  await download(sourceUrl, sourceFile);
  await run("magick", [sourceFile, "-auto-orient", "-resize", "800x1000^", "-gravity", "center", "-extent", "800x1000", "-strip", "-quality", "80", fullFile]);
  await run("magick", [sourceFile, "-auto-orient", "-resize", "200x250^", "-gravity", "center", "-extent", "200x250", "-strip", "-quality", "80", thumbFile]);
  return mediaMetadata(person, candidate);
}

async function readPeople() {
  const files = (await readdir(peopleRoot)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(peopleRoot, file), "utf8"))));
}

function buildCatalog(people) {
  const counts = {};
  for (const person of people) counts[person.media.presentationType] = (counts[person.media.presentationType] ?? 0) + 1;
  return {
    version: 1,
    releaseId: "media-public-210",
    status: (counts.placeholder ?? 0) === 0 ? "release-candidate" : "blocked",
    publicPeople: people.length,
    generatedAt: retrievedAt,
    counts,
    policy: {
      openLicensesOnly: true,
      generatedImagesPresentedAsHistorical: false,
      traditionalDepictionsExplicitlyLabeled: true,
      fullImage: { width: 800, height: 1000, format: "webp", quality: 80 },
      thumbnail: { width: 200, height: 250, format: "webp", quality: 80 },
    },
    members: people.map((person) => ({ personId: person.id, slug: person.slug, media: person.media })),
  };
}

async function checkMedia(people, catalog) {
  const failures = [];
  if (people.length !== 210) failures.push(`expected 210 people, found ${people.length}`);
  if (!catalog || catalog.members?.length !== 210) failures.push("media catalog must contain 210 members");
  const catalogById = new Map((catalog?.members ?? []).map((member) => [member.personId, member]));
  for (const person of people) {
    if (person.media.presentationType === "placeholder") failures.push(`${person.id}: placeholder remains`);
    if (!person.media.fullSrc || !person.media.thumbSrc) failures.push(`${person.id}: asset paths missing`);
    if (person.media.rightsStatus !== "project-commissioned" && (!person.media.sourceUrl || !person.media.sourceFile || !person.media.license || !person.media.retrievedAt)) failures.push(`${person.id}: provenance incomplete`);
    if (JSON.stringify(catalogById.get(person.id)?.media) !== JSON.stringify(person.media)) failures.push(`${person.id}: catalog drift`);
    for (const source of [person.media.fullSrc, person.media.thumbSrc].filter(Boolean)) {
      try {
        await access(path.join(projectRoot, "public", source));
      } catch {
        failures.push(`${person.id}: missing ${source}`);
      }
    }
  }
  if (failures.length) throw new Error(`210-person media check failed (${failures.length}): ${failures.slice(0, 20).join("; ")}`);
  console.log("210-person media check passed: every person has an optimized image and auditable rights metadata.");
}

let people = await readPeople();
if (fetchMedia) {
  const targets = refreshMedia
    ? people.filter((person) => person.media.rightsStatus !== "project-commissioned")
    : people.filter((person) => person.media.presentationType === "placeholder");
  if (refreshMedia) {
    await Promise.all(targets.map((person) => writeFile(path.join(peopleRoot, `${person.id}.json`), jsonText({ ...person, media: placeholderMetadata(person) }))));
  }
  console.log(`[media] discovering reusable images for ${targets.length} people`);
  const candidates = await discoverMedia(targets);
  const failures = [];
  await mapLimit(targets, 4, async (person) => {
    const candidate = candidates.get(person.id);
    if (!candidate) {
      failures.push(`${person.id}: no reusable image found`);
      return;
    }
    try {
      const media = await prepareAsset(person, candidate);
      const updated = { ...person, media };
      await writeFile(path.join(peopleRoot, `${person.id}.json`), jsonText(updated));
      console.log(`[media] ${person.id} <- ${candidate.page.title}`);
    } catch (error) {
      failures.push(`${person.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  people = await readPeople();
  const catalog = buildCatalog(people);
  await writeFile(catalogPath, jsonText(catalog));
  console.log(`[media] catalog written: ${catalog.counts.placeholder ?? 0} placeholders remain`);
  if (failures.length) {
    console.error(`[media] ${failures.length} unresolved item(s):\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
} else {
  let catalog = null;
  try {
    catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await checkMedia(people, catalog);
}
