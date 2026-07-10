import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("keeps relation evidence and resonance semantics explicit in source data", async () => {
  const data = await readFile(new URL("../app/_data/atlas.ts", import.meta.url), "utf8");
  assert.match(data, /id: "aristotle-avicenna"[\s\S]*type: "direct-influence"[\s\S]*sourceIds:/);
  assert.match(data, /id: "confucius-aristotle"[\s\S]*directed: false[\s\S]*type: "thematic-resonance"/);
  assert.match(data, /主题共鸣，不主张历史传播/);
  assert.match(data, /validateAtlasData\(\)/);
});

