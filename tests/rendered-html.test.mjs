import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const knowledgeRoot = new URL("../content/knowledge/", import.meta.url);

async function readEntities(directory) {
  const directoryUrl = new URL(`${directory}/`, knowledgeRoot);
  const files = (await readdir(directoryUrl)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, directoryUrl), "utf8"))));
}

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Atlas product shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /思想星图/);
  assert.match(html, /ATLAS OF IDEAS/);
  assert.match(html, /世界同时开始提问/);
  assert.match(html, /关系证据/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is building|codex-preview/);
  assert.doesNotMatch(html, /<img[^>]+\/media\/thinkers\/full\//);
});

test("renders the public exploration and thinker routes", async () => {
  const [exploreResponse, thinkerResponse] = await Promise.all([
    render("/explore"),
    render("/thinker/confucius"),
  ]);
  assert.equal(exploreResponse.status, 200);
  assert.equal(thinkerResponse.status, 200);
  assert.match(await exploreResponse.text(), /自由探索|问题坐标|文字探索/);
  assert.match(await thinkerResponse.text(), /孔子|Confucius|学术来源/);
});

test("server-renders the knowledge directory and all four entity types", async () => {
  const routes = [
    "/knowledge?q=Kant&type=person&tier=index",
    "/thinker/confucius",
    `/concept/${encodeURIComponent("解脱")}`,
    `/tradition/${encodeURIComponent("儒家")}`,
    "/work/analects",
  ];
  const responses = await Promise.all(routes.map(render));
  for (const response of responses) assert.equal(response.status, 200);
  const html = await Promise.all(responses.map((response) => response.text()));
  assert.match(html[0], /世界哲学知识库|找到/);
  assert.match(html[1], /孔子|来源与定位/);
  assert.match(html[2], /解脱|概念/);
  assert.match(html[3], /儒家|思想传统/);
  assert.match(html[4], /论语|Analects/);
});

test("migrates the legacy corpus without changing its public cardinality", async () => {
  const [people, relations, sources] = await Promise.all([
    readEntities("people"),
    readEntities("relations"),
    readEntities("sources"),
  ]);
  assert.equal(people.length, 30);
  assert.equal(relations.length, 27);
  assert.equal(sources.length, 31);
  assert.equal(new Set(people.map((person) => person.slug)).size, 30);
  assert.ok(people.every((person) => person.editorialStatus === "published"));
});

test("keeps relation evidence and resonance semantics explicit in entity data", async () => {
  const relations = await readEntities("relations");
  const influence = relations.find((relation) => relation.id === "aristotle-avicenna");
  const resonance = relations.find((relation) => relation.id === "confucius-aristotle");
  assert.equal(influence.relationType, "direct-influence");
  assert.ok(influence.citations.every((citation) => citation.sourceId && citation.locator && citation.claim));
  assert.equal(resonance.directed, false);
  assert.equal(resonance.relationType, "thematic-resonance");
  assert.match(`${resonance.explanation} ${resonance.note ?? ""}`, /主题共鸣|不主张历史传播/);
});

test("keeps thinker media metadata complete and backed by public files", async () => {
  const people = await readEntities("people");
  assert.equal(people.length, 30);

  for (const { media } of people) {
    const { fullSrc, thumbSrc, alt, objectPosition, depictionNote } = media;
    assert.match(fullSrc, /^\/media\/thinkers\/full\/.+\.webp$/);
    assert.match(thumbSrc, /^\/media\/thinkers\/thumb\/.+\.webp$/);
    assert.ok(alt.length > 4);
    assert.match(objectPosition, /^\d+% \d+%$/);
    assert.ok(depictionNote.length > 4);
    assert.ok(media.credit.length > 0);
    assert.ok(media.rightsStatus.length > 0);
    assert.ok(["documented", "traditional", "interpretive", "unavailable"].includes(media.authenticity));
    await Promise.all([
      access(new URL(`../public${fullSrc}`, import.meta.url)),
      access(new URL(`../public${thumbSrc}`, import.meta.url)),
    ]);
  }
});

test("keeps candidates private and validates the 240-person editorial matrix", async () => {
  const [contexts, coverage, publishedKnowledge, atlasIndex, searchIndex] = await Promise.all([
    readEntities("contexts"),
    JSON.parse(await readFile(new URL("coverage/people.json", knowledgeRoot), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/knowledge.json", import.meta.url), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/atlas.json", import.meta.url), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/search-index.json", import.meta.url), "utf8")),
  ]);
  assert.equal(coverage.publishedBaseline, 30);
  assert.equal(coverage.candidates.length, 210);
  assert.equal(coverage.publishedBaseline + coverage.candidates.length, 240);
  for (let batch = 1; batch <= 7; batch += 1) {
    assert.equal(coverage.candidates.filter((candidate) => candidate.batch === batch).length, 30);
  }
  assert.ok(contexts.some((context) => context.editorialStatus === "candidate"));
  assert.equal(publishedKnowledge.contexts.length, 0);
  assert.equal(atlasIndex.thinkers.length, 30);
  assert.ok(atlasIndex.thinkers.every((thinker) => !("sections" in thinker)));
  assert.ok(searchIndex.every((item) => !("sections" in item) && !("paragraphs" in item)));
});

test("returns 404 for invalid public resource routes", async () => {
  const responses = await Promise.all([
    render("/thinker/not-a-thinker"),
    render("/story/not-a-chapter"),
    render("/compare/confucius/confucius"),
    render("/compare/confucius/not-a-thinker"),
    render("/concept/not-a-concept"),
    render("/tradition/not-a-tradition"),
    render("/work/not-a-work"),
  ]);
  for (const response of responses) assert.equal(response.status, 404);
});
