import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReport, evaluateEnvironment, normalizeBaseUrl, parseArguments } from "../scripts/check-production-deployment.mjs";

const configUrl = new URL("../infra/production-readiness.json", import.meta.url);

test("production acceptance inventory covers every critical service without storing values", async () => {
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const names = new Set(Object.values(config.environment).flat());
  for (const required of [
    "DATABASE_APP_URL", "AUTH_SECRET", "UPSTASH_REDIS_REST_KV_REST_API_TOKEN", "RESEND_API_KEY",
    "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "MEDIA_UPLOADS_ENABLED", "NEXT_PUBLIC_SENTRY_DSN",
    "SENTRY_AUTH_TOKEN", "SENTRY_OTLP_TRACES_URL", "INNGEST_SIGNING_KEY",
  ]) assert.ok(names.has(required), required);
  assert.equal(config.publicValueAssertions.REQUIRE_PRODUCTION_SERVICES, "1");
  assert.equal(config.publicValueAssertions.MEDIA_UPLOADS_ENABLED, "0");
  assert.ok(config.manualGates.some((gate) => gate.id === "restore-drill"));
  assert.ok(config.manualGates.some((gate) => gate.id === "repository-protection"));
  assert.ok(config.probes.some((probe) => probe.semantic === "readiness"));
});

test("environment evaluation reports only names and booleans, never secret values", async () => {
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const secret = "postgres://atlas:do-not-print@example.invalid/atlas";
  const inventory = { source: "test", names: new Set(["DATABASE_APP_URL"]), assertions: { DATABASE_APP_URL: secret } };
  const report = evaluateEnvironment(config, inventory);
  assert.doesNotMatch(JSON.stringify(report), /do-not-print|postgres:\/\//);
  assert.equal(report.groups.find((group) => group.group === "runtime").variables.find((item) => item.name === "DATABASE_APP_URL").configured, true);
});

test("production checker dry-run performs no network request or artifact write", () => {
  const cwd = new URL("..", import.meta.url);
  const output = execFileSync(process.execPath, ["scripts/check-production-deployment.mjs", "--dry-run"], { cwd, encoding: "utf8" });
  const plan = JSON.parse(output);
  assert.equal(plan.networkRequests, false);
  assert.equal(plan.writes, false);
  assert.ok(plan.probes.some((probe) => probe.id === "liveness"));
});

test("production checker restricts HTTP bypass to explicit localhost tests", () => {
  const options = parseArguments(["--allow-http", "--url", "http://127.0.0.1:3010"]);
  assert.equal(options.allowHttp, true);
  assert.equal(normalizeBaseUrl(options.baseUrl, options.allowHttp).origin, "http://127.0.0.1:3010");
  assert.throws(() => normalizeBaseUrl("http://example.com", true), /must use HTTPS/);
  assert.throws(() => normalizeBaseUrl("http://127.0.0.1:3010", false), /must use HTTPS/);
  assert.throws(() => parseArguments(["--env-source", "names-file"]), /--env-names-file/);
});

test("production checker accepts only a matching release with complete external evidence", async () => {
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const release = "a".repeat(40);
  const server = createServer((request, response) => {
    response.setHeader("content-security-policy", "default-src 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests");
    response.setHeader("strict-transport-security", "max-age=63072000; includeSubDomains");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "SAMEORIGIN");
    response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
    response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (request.url === "/admin/system") {
      response.writeHead(307, { location: "/admin/login" });
      response.end();
    } else if (request.url === "/api/health/live") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: { status: "alive", release } }));
    } else if (request.url === "/api/health/ready") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: { status: "ready", mode: "production-required", dependencies: [{ name: "database", required: true, status: "healthy" }] } }));
    } else if (request.url?.startsWith("/api/")) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: {} }));
    } else {
      response.end("思想星图 康德 管理员 对话");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "atlas-production-check-"));
  const inventoryPath = path.join(temporaryDirectory, "environment.json");
  const evidencePath = path.join(temporaryDirectory, "evidence.json");
  await writeFile(inventoryPath, JSON.stringify({ names: [...new Set(Object.values(config.environment).flat())], assertions: config.publicValueAssertions }));
  await writeFile(evidencePath, JSON.stringify({
    release,
    baseUrl: `http://127.0.0.1:${address.port}`,
    checks: Object.fromEntries(config.manualGates.map((gate) => [gate.id, { status: "passed", checkedAt: "2026-08-07T00:00:00.000Z", evidence: `ticket-${gate.id}` }])),
  }));
  try {
    const report = await buildReport(config, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      expectedRelease: release,
      envSource: "names-file",
      envNamesFile: inventoryPath,
      evidenceFile: evidencePath,
      allowHttp: true,
    });
    assert.equal(report.decision, "accepted");
    assert.equal(report.productionAcceptance, true);
    assert.doesNotMatch(JSON.stringify(report), /ticket-/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await unlink(inventoryPath);
    await unlink(evidencePath);
    await rmdir(temporaryDirectory);
  }
});
