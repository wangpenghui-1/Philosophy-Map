import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isSameOrigin } from "../app/api/_lib/session.ts";

function request(headers = {}, url = "https://ideaglobemap.cn/api/v1/me") {
  return new Request(url, { method: "POST", headers });
}

test("cookie-capable writes require a same-origin browser signal", () => {
  assert.equal(isSameOrigin(request({ origin: "https://ideaglobemap.cn", host: "ideaglobemap.cn" })), true);
  assert.equal(isSameOrigin(request({ origin: "https://evil.example", host: "ideaglobemap.cn" })), false);
  assert.equal(isSameOrigin(request({ origin: "http://ideaglobemap.cn", host: "ideaglobemap.cn" })), false);
  assert.equal(isSameOrigin(request({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(isSameOrigin(request({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOrigin(request()), false);
});

test("bearer API writes do not depend on browser Origin headers", () => {
  assert.equal(isSameOrigin(request({ authorization: "Bearer mobile-access-token" })), true);
});

test("sensitive routes enforce scoped rate limits", async () => {
  const files = [
    "../app/api/v1/auth/login/route.ts",
    "../app/api/v1/auth/register/route.ts",
    "../app/api/v1/auth/password-reset/request/route.ts",
    "../app/api/admin/v1/auth/login/route.ts",
    "../app/api/v1/me/export/route.ts",
    "../app/api/v1/me/account/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /enforceRateLimit\(/, file);
    assert.match(source, /withRateLimitHeaders\(/, file);
  }
  const helper = await readFile(new URL("../app/api/_lib/rate-limit.ts", import.meta.url), "utf8");
  assert.match(helper, /problemResponse\(429/);
  assert.match(helper, /retry-after/);
  assert.match(helper, /x-ratelimit-backend/);
});

test("production proxy declares nonce CSP and hardened response headers", async () => {
  const [proxy, config, serverSentry, edgeSentry, clientSentry] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../sentry.server.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../sentry.edge.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../instrumentation-client.ts", import.meta.url), "utf8"),
  ]);
  assert.match(proxy, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(proxy, /strict-transport-security/);
  assert.match(proxy, /cross-origin-opener-policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /Permissions-Policy/);
  for (const source of [serverSentry, edgeSentry, clientSentry]) {
    assert.match(source, /sendDefaultPii: false/);
    assert.match(source, /delete event\.request\.cookies/);
    assert.match(source, /delete event\.request\.data/);
  }
});

test("health probes preserve static compatibility and protect detailed operations", async () => {
  const [health, live, ready, admin] = await Promise.all([
    readFile(new URL("../app/api/_lib/health.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/live/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/ready/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/v1/system/health/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(health, /snapshotAvailable: true/);
  assert.match(health, /REQUIRE_PRODUCTION_SERVICES === "1"/);
  assert.match(health, /outboxFailed/);
  assert.match(health, /aiCostUsd24h/);
  assert.match(live, /status: "alive"/);
  assert.match(ready, /report\.status === "not-ready" \? 503 : 200/);
  assert.match(admin, /system:operate/);
  assert.match(admin, /cache-control": "no-store/);
});

test("RLS covers user-owned conversation and memory child records", async () => {
  const migration = await readFile(new URL("../drizzle/0007_user-child-rls.sql", import.meta.url), "utf8");
  for (const table of ["messages", "message_citations", "memory_links", "memory_events"]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`), table);
    assert.match(migration, new RegExp(`CREATE POLICY "${table}_owner_policy"`), table);
  }
  assert.match(migration, /current_setting\('app\.user_id', true\)/);
  assert.match(migration, /current_setting\('app\.anonymous_session_hash', true\)/);
});

test("entity slugs may overlap across entity types without changing public URLs", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../packages/db/src/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0008_entity-slug-scope.sql", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(schema, /uniqueIndex\("entity_versions_slug_locale_version_uq"\)/);
  assert.match(schema, /index\("entity_versions_slug_locale_version_idx"\)/);
  assert.match(migration, /DROP INDEX IF EXISTS "entity_versions_slug_locale_version_uq"/);
  assert.match(migration, /CREATE INDEX "entity_versions_slug_locale_version_idx"/);
});

test("zero-cost production policy disables media writes at the API and admin UI", async () => {
  const [storage, media, uploadPage, mediaPage, readiness] = await Promise.all([
    readFile(new URL("../app/api/_lib/media-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_lib/media.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/(protected)/media/new/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/(protected)/media/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../infra/production-readiness.json", import.meta.url), "utf8"),
  ]);
  assert.match(storage, /MEDIA_UPLOADS_ENABLED === "1"/);
  assert.match(storage, /媒体上传已按零付费生产策略关闭/);
  assert.match(media, /assertMediaUploadsEnabled\(\)/);
  assert.match(uploadPage, /readOnly=!\{?uploadEnabled|readOnly=\{!uploadEnabled\}/);
  assert.match(mediaPage, /uploadEnabled && <Link/);
  assert.equal(JSON.parse(readiness).publicValueAssertions.MEDIA_UPLOADS_ENABLED, "0");
});
