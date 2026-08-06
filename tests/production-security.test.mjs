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
