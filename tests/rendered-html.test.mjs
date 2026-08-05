import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

const knowledgeRoot = new URL("../content/knowledge/", import.meta.url);
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let appServer;
let appOrigin;
let serverOutput = "";

async function readEntities(directory) {
  const directoryUrl = new URL(`${directory}/`, knowledgeRoot);
  const files = (await readdir(directoryUrl)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, directoryUrl), "utf8"))));
}

async function reservePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  server.close();
  await once(server, "close");
  if (!port) throw new Error("Unable to reserve a local test port.");
  return port;
}

async function waitForServer(origin) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (appServer?.exitCode !== null) {
      throw new Error(`Next.js server exited before becoming ready.\n${serverOutput}`);
    }
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch {
      // The server may still be compiling its first route.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js server did not become ready.\n${serverOutput}`);
}

test.before(async () => {
  const port = await reservePort();
  appOrigin = `http://127.0.0.1:${port}`;
  appServer = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  appServer.stdout.on("data", (chunk) => { serverOutput += chunk; });
  appServer.stderr.on("data", (chunk) => { serverOutput += chunk; });
  await waitForServer(appOrigin);
});

test.after(async () => {
  if (!appServer || appServer.exitCode !== null) return;
  appServer.kill("SIGTERM");
  await Promise.race([
    once(appServer, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (appServer.exitCode === null) appServer.kill("SIGKILL");
});

async function render(pathname = "/") {
  return fetch(`${appOrigin}${pathname}`, { headers: { accept: "text/html" } });
}

test("server-renders the Atlas product shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /思想星图/);
  assert.match(html, /ATLAS OF IDEAS/);
  assert.match(html, /开启一次思想旅程/);
  assert.match(html, /你凭什么说“我知道”/);
  assert.match(html, /展陈设置/);
  assert.match(html, /WORLD PHILOSOPHY/);
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

test("new release people, concepts, traditions, and works are publicly searchable", async () => {
  const routes = [
    "/knowledge?q=Xunzi&type=person",
    `/knowledge?q=${encodeURIComponent("荀子")}&type=work`,
    "/thinker/xunzi",
    `/concept/${encodeURIComponent("性恶")}`,
    `/tradition/${encodeURIComponent("儒家")}`,
    "/work/xunzi-text",
  ];
  const responses = await Promise.all(routes.map(render));
  for (const response of responses) assert.equal(response.status, 200);
  const html = await Promise.all(responses.map((response) => response.text()));
  assert.match(html[0], /荀子|Xunzi/);
  assert.match(html[1], /荀子/);
  assert.match(html[2], /荀子|性恶|深入阅读/);
  assert.match(html[3], /性恶/);
  assert.match(html[4], /儒家/);
  assert.match(html[5], /荀子/);
});

test("publishes Camus as a complete, searchable journey thinker", async () => {
  const routes = [
    "/knowledge?q=Camus&type=person",
    "/thinker/camus",
    `/concept/${encodeURIComponent("荒诞")}`,
    `/tradition/${encodeURIComponent("荒诞哲学")}`,
    "/work/myth-of-sisyphus",
  ];
  const responses = await Promise.all(routes.map(render));
  for (const response of responses) assert.equal(response.status, 200);
  const html = await Promise.all(responses.map((response) => response.text()));
  assert.match(html[0], /加缪|Albert Camus/);
  assert.match(html[1], /荒诞不是虚无的结论|从个人清醒到共同反抗|拒绝标签与政治限度/);
  assert.match(html[1], /不确定性说明|拒绝“存在主义者”标签/);
  assert.match(html[2], /人的追问与世界的沉默/);
  assert.match(html[3], /不把荒诞当作虚无主义结论/);
  assert.match(html[4], /自杀问题|哲学自杀/);
});

test("publishes the current increment while preserving the historical corpus and relations", async () => {
  const [people, relations, sources, generatedCoverage] = await Promise.all([
    readEntities("people"),
    readEntities("relations"),
    readEntities("sources"),
    JSON.parse(await readFile(new URL("../app/_generated/coverage-report.json", import.meta.url), "utf8")),
  ]);
  const release = JSON.parse(await readFile(new URL("coverage/release-210.json", knowledgeRoot), "utf8"));
  const increment = JSON.parse(await readFile(new URL("coverage/release-213-increment.json", knowledgeRoot), "utf8"));
  const publishedRelations = relations.filter((relation) => relation.editorialStatus === "published");
  const publishedSources = sources.filter((source) => source.editorialStatus === "published");
  assert.equal(people.length, increment.publicPeople);
  assert.equal(publishedRelations.length, generatedCoverage.published.relations);
  assert.equal(publishedSources.length, generatedCoverage.published.sources);
  assert.equal(new Set(people.map((person) => person.slug)).size, people.length);
  assert.equal(release.members.length, release.addedPeople);
  assert.equal(increment.members.length, increment.addedPeople);
  assert.ok(["confucius", "plato", "kant", "foucault"].every((slug) => people.some((person) => person.slug === slug)));
  assert.ok(release.members.every((member) => people.some((person) => person.id === member.personId)));
  assert.ok(increment.members.every((member) => people.some((person) => person.id === member.personId)));
  assert.ok(["husserl-merleau-ponty", "heidegger-merleau-ponty", "heidegger-sartre", "nietzsche-camus", "sartre-camus"].every((id) => publishedRelations.some((relation) => relation.id === id)));
  assert.ok(people.every((person) => person.editorialStatus === "published"));
  const editorialDisclaimer = "条目结合代表文本、活动地点和学术研究，提示相关年代、归属或解释中的不确定性。";
  assert.ok(people.every((person) => !person.summary.includes(editorialDisclaimer)));
  assert.ok(people.every((person) => person.sections.every((section) => section.paragraphs.every((paragraph) => !paragraph.text.includes(editorialDisclaimer)))));
});

test("keeps representative quotations traceable to explicit source tiers", async () => {
  const [people, works, sources] = await Promise.all([
    readEntities("people"),
    readEntities("works"),
    readEntities("sources"),
  ]);
  const workIds = new Set(works.map((work) => work.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const quotedPeople = people.filter((person) => person.representativeQuote);

  assert.ok(quotedPeople.length >= 79);
  const quotedPersonIds = new Set(quotedPeople.map((person) => person.id));
  assert.ok(
    [
      "achille-mbembe", "angela-davis", "arendt", "augustine", "charles-sanders-peirce", "confucius",
      "cornel-west", "dai-zhen", "dong-zhongshu", "fazang", "frederick-douglass", "han-fei", "han-yu",
      "ifi-amadiume", "jiddu-krishnamurti", "john-mbiti", "john-rawls", "judith-butler", "kant", "laozi",
      "li-zhi", "liang-qichao", "locke", "mahavira", "maimonides", "meister-eckhart", "mencius", "mozi",
      "nietzsche", "philo-alexandria", "rabindranath-tagore", "socrates", "thomas-kuhn", "vine-deloria-jr",
      "wang-fuzhi", "wang-yangming", "xunzi", "zhiyi", "zhu-xi", "zhuangzi", "sartre", "merleau-ponty", "camus",
    ].every((id) => quotedPersonIds.has(id)),
  );
  for (const person of quotedPeople) {
    const quote = person.representativeQuote;
    if (quote.workId) assert.ok(workIds.has(quote.workId));
    assert.equal(sourceById.get(quote.sourceId)?.sourceType, quote.sourceType);
    assert.ok(quote.sourceTitle.length > 0);
    assert.ok(["primary-verified", "source-attributed", "traditional-attribution", "disputed"].includes(quote.verificationStatus));
    if (quote.verificationStatus !== "primary-verified") assert.ok(quote.attributionNote.length > 0);
    assert.ok(person.sourceIds.includes(quote.sourceId));
    if (["en", "fr"].includes(quote.displayLanguage)) {
      assert.ok(quote.chineseTranslation.length > 0);
      if (quote.textStatus === "translation") assert.ok(quote.translator.length > 0);
      else assert.equal(quote.originalLanguage, quote.displayLanguage);
    }
  }
});

test("keeps the eight enriched thinker pilots substantial, sourced, and connected", async () => {
  const [people, works, relations] = await Promise.all([
    readEntities("people"),
    readEntities("works"),
    readEntities("relations"),
  ]);
  const pilotIds = ["kant", "zhuangzi", "dignaga", "aristotle", "john-rawls", "avicenna", "fanon", "husserl"];
  const personById = new Map(people.map((person) => [person.id, person]));
  const workById = new Map(works.map((work) => [work.id, work]));

  for (const id of pilotIds) {
    const person = personById.get(id);
    assert.ok(person, `${id}: pilot person is missing`);
    const sectionText = person.sections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("");
    const personRelations = relations.filter((relation) => relation.from.id === id || relation.to.id === id);
    assert.equal(person.contentTier, "standard", `${id}: pilot should be standard tier`);
    assert.ok(person.sections.length >= 3, `${id}: pilot needs at least three sections`);
    assert.ok(sectionText.length >= 600, `${id}: pilot prose is too short`);
    assert.ok(person.conceptIds.length >= 3, `${id}: pilot needs at least three concepts`);
    assert.ok(person.sourceIds.length >= 2, `${id}: pilot needs at least two sources`);
    assert.ok(personRelations.length >= 2, `${id}: pilot needs at least two thinker relations`);
    assert.ok(person.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.citations.length > 0)), `${id}: every paragraph needs a citation`);
    assert.ok(person.workIds.every((workId) => !/后续将补充|文本入口/.test(workById.get(workId)?.summary ?? "")), `${id}: work summaries must be substantive`);
  }

  const response = await render("/thinker/kant");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /核心概念|代表著作|与其他哲学家的关联/);
  assert.match(html, /直接影响|证据明确/);
  assert.match(html, /href="#source-\d+"/);
});

test("keeps Camus substantial, sourced, connected, and explicit about classification", async () => {
  const [people, works, relations] = await Promise.all([
    readEntities("people"),
    readEntities("works"),
    readEntities("relations"),
  ]);
  const person = people.find((candidate) => candidate.id === "camus");
  const workById = new Map(works.map((work) => [work.id, work]));
  const sectionText = person.sections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("");
  const personRelations = relations.filter((relation) => relation.from.id === "camus" || relation.to.id === "camus");
  assert.equal(person.contentTier, "standard");
  assert.ok(person.sections.length >= 3);
  assert.ok(sectionText.length >= 600);
  assert.ok(person.conceptIds.length >= 3);
  assert.ok(person.sourceIds.length >= 3);
  assert.ok(personRelations.length >= 2);
  assert.ok(person.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.citations.length > 0)));
  assert.ok(person.workIds.every((workId) => !/后续将补充|文本入口/.test(workById.get(workId)?.summary ?? "")));
  assert.match(person.uncertainty, /拒绝“存在主义者”标签/);
});

test("keeps the second journey batch substantial, sourced, and connected", async () => {
  const [people, works, relations] = await Promise.all([
    readEntities("people"),
    readEntities("works"),
    readEntities("relations"),
  ]);
  const batchIds = ["heidegger", "beauvoir", "spinoza", "nietzsche", "kierkegaard"];
  const personById = new Map(people.map((person) => [person.id, person]));
  const workById = new Map(works.map((work) => [work.id, work]));

  for (const id of batchIds) {
    const person = personById.get(id);
    assert.ok(person, `${id}: batch person is missing`);
    const sectionText = person.sections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("");
    const personRelations = relations.filter((relation) => relation.from.id === id || relation.to.id === id);
    assert.equal(person.contentTier, "standard", `${id}: batch person should be standard tier`);
    assert.ok(person.sections.length >= 3, `${id}: batch person needs at least three sections`);
    assert.ok(sectionText.length >= 600 && sectionText.length <= 1500, `${id}: batch prose should stay substantial and readable`);
    assert.ok(person.conceptIds.length >= 3, `${id}: batch person needs at least three concepts`);
    assert.ok(person.sourceIds.length >= 2, `${id}: batch person needs at least two sources`);
    assert.ok(person.workIds.length >= 2, `${id}: batch person needs at least two representative works`);
    assert.ok(personRelations.length >= 2, `${id}: batch person needs at least two thinker relations`);
    assert.ok(person.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.citations.length > 0)), `${id}: every paragraph needs a citation`);
    assert.ok(person.workIds.every((workId) => !/后续将补充|文本入口/.test(workById.get(workId)?.summary ?? "")), `${id}: work summaries must be substantive`);
  }
});

test("keeps the person-by-person journey rewrites substantive and free of index placeholders", async () => {
  const [people, works, relations, concepts] = await Promise.all([
    readEntities("people"),
    readEntities("works"),
    readEntities("relations"),
    readEntities("concepts"),
  ]);
  const rewriteIds = ["plato", "akshapada-gautama", "descartes", "locke", "hume", "thomas-kuhn", "protagoras", "george-berkeley", "wittgenstein"];
  const singleWorkCorpusIds = new Set(["akshapada-gautama", "protagoras"]);
  const personById = new Map(people.map((person) => [person.id, person]));
  const workById = new Map(works.map((work) => [work.id, work]));
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

  for (const id of rewriteIds) {
    const person = personById.get(id);
    assert.ok(person, `${id}: rewritten journey thinker is missing`);
    const sectionText = person.sections.flatMap((section) => section.paragraphs).map((paragraph) => paragraph.text).join("");
    const personRelations = relations.filter((relation) => relation.editorialStatus === "published" && (relation.from.id === id || relation.to.id === id));
    assert.equal(person.contentTier, "standard", `${id}: rewritten thinker should be standard tier`);
    assert.ok(person.sections.length >= 3, `${id}: rewritten thinker needs at least three sections`);
    assert.ok(sectionText.length >= 600 && sectionText.length <= 1500, `${id}: rewritten prose should stay substantial and readable`);
    assert.ok(person.conceptIds.length >= 3, `${id}: rewritten thinker needs at least three concepts`);
    assert.ok(person.sourceIds.length >= 2, `${id}: rewritten thinker needs at least two sources`);
    const minimumWorks = singleWorkCorpusIds.has(id) ? 1 : 2;
    assert.ok(person.workIds.length >= minimumWorks, `${id}: rewritten thinker needs enough historically attributable representative works`);
    assert.ok(personRelations.length >= 2, `${id}: rewritten thinker needs at least two evidenced relations`);
    assert.ok(person.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.citations.length > 0)), `${id}: every paragraph needs a citation`);
    assert.ok(person.workIds.every((workId) => !/后续将补充|文本入口|本索引保留/.test(workById.get(workId)?.summary ?? "")), `${id}: work summaries must be substantive`);
    assert.ok(person.conceptIds.every((conceptId) => !/概念索引|概念入口|具体含义需结合/.test(conceptById.get(conceptId)?.summary ?? "")), `${id}: concept summaries must explain the thinker-specific idea`);
  }
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
  const increment = JSON.parse(await readFile(new URL("coverage/release-213-increment.json", knowledgeRoot), "utf8"));
  assert.equal(people.length, increment.publicPeople);
  assert.equal(people.filter((person) => person.media.presentationType === "placeholder").length, 0);

  for (const { media } of people) {
    const { fullSrc, thumbSrc, alt, objectPosition, depictionNote } = media;
    assert.ok(alt.length > 4);
    assert.ok(depictionNote.length > 4);
    assert.ok(media.credit.length > 0);
    assert.ok(media.rightsStatus.length > 0);
    assert.ok(["documented", "traditional", "interpretive", "unavailable"].includes(media.authenticity));
    if (media.presentationType === "placeholder") {
      assert.equal(fullSrc, undefined);
      assert.equal(thumbSrc, undefined);
      assert.equal(media.authenticity, "unavailable");
    } else {
      assert.match(fullSrc, /^\/media\/thinkers\/full\/.+\.webp$/);
      assert.match(thumbSrc, /^\/media\/thinkers\/thumb\/.+\.webp$/);
      assert.match(objectPosition, /^\d+% \d+%$/);
      await Promise.all([
        access(new URL(`../public${fullSrc}`, import.meta.url)),
        access(new URL(`../public${thumbSrc}`, import.meta.url)),
      ]);
      if (media.rightsStatus !== "project-commissioned") {
        assert.match(media.sourceUrl, /^https:\/\/commons\.wikimedia\.org\//);
        assert.ok(media.sourceFile.length > 0);
        assert.ok(media.license.length > 0);
        assert.match(media.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  }
});

test("publishes exactly the current release and keeps non-published records out of client indexes", async () => {
  const [contexts, coverage, release, increment, publishedKnowledge, atlasIndex, searchIndex] = await Promise.all([
    readEntities("contexts"),
    JSON.parse(await readFile(new URL("coverage/people.json", knowledgeRoot), "utf8")),
    JSON.parse(await readFile(new URL("coverage/release-210.json", knowledgeRoot), "utf8")),
    JSON.parse(await readFile(new URL("coverage/release-213-increment.json", knowledgeRoot), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/knowledge.json", import.meta.url), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/atlas.json", import.meta.url), "utf8")),
    JSON.parse(await readFile(new URL("../app/_generated/search-index.json", import.meta.url), "utf8")),
  ]);
  assert.equal(coverage.targetTotal, increment.publicPeople);
  assert.equal(coverage.publishedBaseline, increment.publicPeople);
  assert.equal(coverage.candidates.length, 0);
  assert.equal(release.baselinePeople + release.addedPeople, increment.baselinePeople);
  assert.equal(release.members.length, release.addedPeople);
  assert.equal(increment.members.length, increment.addedPeople);
  assert.ok(contexts.some((context) => context.editorialStatus === "candidate"));
  assert.equal(publishedKnowledge.contexts.length, 0);
  assert.equal(publishedKnowledge.people.length, increment.publicPeople);
  assert.equal(atlasIndex.thinkers.length, increment.publicPeople);
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
