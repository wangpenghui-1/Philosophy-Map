import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultConfigPath = path.join(projectRoot, "infra/production-readiness.json");

export function parseArguments(argv) {
  const options = {
    baseUrl: null,
    expectedRelease: null,
    envSource: "none",
    envNamesFile: null,
    evidenceFile: null,
    outputDirectory: path.join(projectRoot, "artifacts/production"),
    reportOnly: false,
    dryRun: false,
    allowHttp: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--url") options.baseUrl = argv[++index];
    else if (value === "--expected-release") options.expectedRelease = argv[++index];
    else if (value === "--env-source") options.envSource = argv[++index];
    else if (value === "--env-names-file") options.envNamesFile = argv[++index];
    else if (value === "--evidence") options.evidenceFile = argv[++index];
    else if (value === "--output") options.outputDirectory = path.resolve(argv[++index]);
    else if (value === "--report-only") options.reportOnly = true;
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--allow-http") options.allowHttp = true;
    else if (value === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!["none", "process", "names-file"].includes(options.envSource)) {
    throw new Error("--env-source must be none, process, or names-file.");
  }
  if (options.envSource === "names-file" && !options.envNamesFile) {
    throw new Error("--env-names-file is required with --env-source names-file.");
  }
  return options;
}

function currentCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function normalizeBaseUrl(value, allowHttp) {
  const url = new URL(value);
  const localHttp = allowHttp && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("Production URL must use HTTPS. --allow-http is limited to localhost tests.");
  if (url.username || url.password || url.search || url.hash) throw new Error("Production URL must not contain credentials, query parameters, or fragments.");
  url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

async function loadEnvironmentNames(options) {
  if (options.envSource === "none") return { source: "not-supplied", names: null, assertions: {} };
  if (options.envSource === "process") {
    return {
      source: "current-process",
      names: new Set(Object.entries(process.env).filter(([, value]) => Boolean(value)).map(([name]) => name)),
      assertions: process.env,
    };
  }
  const raw = await readFile(path.resolve(options.envNamesFile), "utf8");
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
  if (Array.isArray(parsed)) return { source: "names-file", names: new Set(parsed), assertions: {} };
  if (!Array.isArray(parsed.names)) throw new Error("Environment inventory JSON must contain a names array.");
  return { source: "names-file", names: new Set(parsed.names), assertions: parsed.assertions ?? {} };
}

export function evaluateEnvironment(config, inventory) {
  const groups = Object.entries(config.environment).map(([group, requiredNames]) => ({
    group,
    variables: requiredNames.map((name) => ({ name, configured: inventory.names?.has(name) ?? null })),
  }));
  const assertions = Object.entries(config.publicValueAssertions).map(([name, expected]) => {
    const actual = inventory.assertions?.[name];
    return {
      name,
      expected,
      status: actual === undefined ? "unverified" : String(actual) === expected ? "passed" : "failed",
    };
  });
  const missing = groups.flatMap(({ group, variables }) => variables.filter((item) => item.configured === false).map((item) => `${group}:${item.name}`));
  return { source: inventory.source, groups, assertions, missing };
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function checkProbeSemantics(probe, response, text, expectedRelease) {
  const failures = [];
  if (!probe.expectedStatuses.includes(response.status)) failures.push(`HTTP ${response.status}, expected ${probe.expectedStatuses.join("/")}`);
  if (probe.bodyIncludes && !text.includes(probe.bodyIncludes)) failures.push(`response does not contain ${probe.bodyIncludes}`);
  if (probe.locationIncludes && !(response.headers.get("location") ?? "").includes(probe.locationIncludes)) failures.push(`Location does not contain ${probe.locationIncludes}`);
  const json = safeJson(text);
  if (probe.jsonDataRequired && (!json || typeof json !== "object" || !("data" in json))) failures.push("response is not an API data envelope");
  if (probe.semantic === "liveness") {
    if (json?.data?.status !== "alive") failures.push("liveness status is not alive");
    if (expectedRelease !== "unknown" && json?.data?.release !== expectedRelease) failures.push(`release is ${json?.data?.release ?? "missing"}, expected ${expectedRelease}`);
  }
  if (probe.semantic === "readiness") {
    if (json?.data?.status !== "ready") failures.push(`readiness status is ${json?.data?.status ?? "missing"}`);
    if (json?.data?.mode !== "production-required") failures.push(`readiness mode is ${json?.data?.mode ?? "missing"}`);
    const dependencyFailures = Array.isArray(json?.data?.dependencies)
      ? json.data.dependencies.filter((item) => item.required && !["healthy", "configured"].includes(item.status)).map((item) => item.name)
      : ["dependency-summary-missing"];
    if (dependencyFailures.length) failures.push(`required dependencies unavailable: ${dependencyFailures.join(", ")}`);
  }
  return failures;
}

async function runRemoteProbes(config, baseUrl, expectedRelease) {
  const results = [];
  for (const probe of config.probes) {
    const target = new URL(probe.path, baseUrl);
    const startedAt = Date.now();
    try {
      const response = await fetch(target, {
        redirect: probe.redirect ?? "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(config.requestTimeoutMs),
        headers: { "user-agent": "atlas-production-acceptance/1" },
      });
      const text = await response.text();
      const failures = checkProbeSemantics(probe, response, text, expectedRelease);
      results.push({ id: probe.id, label: probe.label, path: probe.path, status: failures.length ? "failed" : "passed", httpStatus: response.status, latencyMs: Date.now() - startedAt, failures });
    } catch (error) {
      results.push({ id: probe.id, label: probe.label, path: probe.path, status: "failed", httpStatus: null, latencyMs: Date.now() - startedAt, failures: [error instanceof Error ? error.message : "request failed"] });
    }
  }
  return results;
}

async function checkSecurityHeaders(config, baseUrl) {
  try {
    const response = await fetch(new URL("/", baseUrl), { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(config.requestTimeoutMs) });
    return Object.entries(config.securityHeaders).map(([name, requiredParts]) => {
      const value = response.headers.get(name) ?? "";
      const missing = requiredParts.filter((part) => !value.toLowerCase().includes(part.toLowerCase()));
      return { name, status: missing.length ? "failed" : "passed", missing };
    });
  } catch (error) {
    return Object.keys(config.securityHeaders).map((name) => ({ name, status: "failed", missing: [error instanceof Error ? error.message : "request failed"] }));
  }
}

async function evaluateManualGates(config, evidencePath, expectedRelease, baseUrl) {
  if (!evidencePath) return { source: "not-supplied", releaseMatches: null, baseUrlMatches: null, checks: config.manualGates.map((gate) => ({ ...gate, status: "unverified", checkedAt: null, evidenceRecorded: false })) };
  const evidence = JSON.parse(await readFile(path.resolve(evidencePath), "utf8"));
  const checks = config.manualGates.map((gate) => {
    const item = evidence.checks?.[gate.id];
    const validPass = item?.status === "passed" && Boolean(item.checkedAt) && Boolean(item.evidence?.trim());
    return { ...gate, status: validPass ? "passed" : item?.status === "failed" ? "failed" : "unverified", checkedAt: item?.checkedAt ?? null, evidenceRecorded: Boolean(item?.evidence?.trim()) };
  });
  return {
    source: path.basename(evidencePath),
    releaseMatches: evidence.release === expectedRelease,
    baseUrlMatches: evidence.baseUrl === baseUrl.origin,
    checks,
  };
}

function markdownReport(report) {
  const icon = (status) => status === "passed" ? "✅" : status === "failed" ? "❌" : "⏳";
  return [
    "# 思想星图生产部署验收报告",
    "",
    `- 结论：**${report.decision === "accepted" ? "生产验收通过" : "生产验收阻断"}**`,
    `- 地址：${report.baseUrl}`,
    `- 预期提交：\`${report.expectedRelease}\``,
    `- 生成时间：${report.generatedAt}`,
    "- 报告不包含密钥、连接串或环境变量值。",
    "",
    "## 自动线上探针",
    "",
    ...report.remoteProbes.map((item) => `- ${icon(item.status)} ${item.label}：${item.httpStatus ?? "无响应"}${item.failures.length ? `；${item.failures.join("；")}` : ""}`),
    "",
    "## 安全响应头",
    "",
    ...report.securityHeaders.map((item) => `- ${icon(item.status)} ${item.name}${item.missing.length ? `：缺少 ${item.missing.join("、")}` : ""}`),
    "",
    "## 生产环境变量名称",
    "",
    `- 来源：${report.environment.source}`,
    ...report.environment.groups.flatMap((group) => group.variables.map((item) => `- ${item.configured === true ? "✅" : item.configured === false ? "❌" : "⏳"} ${group.group} · ${item.name}`)),
    ...report.environment.assertions.map((item) => `- ${icon(item.status)} ${item.name} 应为公开值 \`${item.expected}\``),
    "",
    "## 人工证据门禁",
    "",
    ...report.manualEvidence.checks.map((item) => `- ${icon(item.status)} ${item.label}${item.checkedAt ? `（${item.checkedAt}）` : ""}`),
    "",
    "## 阻断项",
    "",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- 无"]),
    "",
  ].join("\n");
}

export async function buildReport(config, options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? config.defaultBaseUrl, options.allowHttp);
  const expectedRelease = options.expectedRelease ?? currentCommit();
  const inventory = await loadEnvironmentNames(options);
  const [remoteProbes, securityHeaders, manualEvidence] = await Promise.all([
    runRemoteProbes(config, baseUrl, expectedRelease),
    checkSecurityHeaders(config, baseUrl),
    evaluateManualGates(config, options.evidenceFile, expectedRelease, baseUrl),
  ]);
  const environment = evaluateEnvironment(config, inventory);
  const blockers = [
    ...remoteProbes.filter((item) => item.status !== "passed").map((item) => `线上探针失败：${item.label}`),
    ...securityHeaders.filter((item) => item.status !== "passed").map((item) => `安全响应头失败：${item.name}`),
  ];
  if (environment.source === "not-supplied") blockers.push("未提供生产环境变量名称清单");
  else if (environment.missing.length) blockers.push(`生产环境变量缺失：${environment.missing.join(", ")}`);
  const assertionFailures = environment.assertions.filter((item) => item.status !== "passed");
  if (assertionFailures.length) blockers.push(`生产公开配置值未验证：${assertionFailures.map((item) => item.name).join(", ")}`);
  if (manualEvidence.source === "not-supplied") blockers.push("未提供生产人工验收证据");
  else {
    if (!manualEvidence.releaseMatches) blockers.push("人工证据记录的 release 与预期提交不一致");
    if (!manualEvidence.baseUrlMatches) blockers.push("人工证据记录的 baseUrl 与验收地址不一致");
    for (const item of manualEvidence.checks.filter((check) => check.status !== "passed")) blockers.push(`人工门禁未通过：${item.label}`);
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.origin,
    expectedRelease,
    decision: blockers.length ? "blocked" : "accepted",
    productionAcceptance: blockers.length === 0,
    containsSecrets: false,
    remoteProbes,
    securityHeaders,
    environment,
    manualEvidence,
    blockers,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = JSON.parse(await readFile(defaultConfigPath, "utf8"));
  if (options.help) {
    console.log("Usage: node scripts/check-production-deployment.mjs [--url URL] [--expected-release SHA] [--env-source none|process|names-file] [--env-names-file FILE] [--evidence FILE] [--report-only] [--dry-run]");
    return;
  }
  if (options.dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", networkRequests: false, writes: false, defaultBaseUrl: config.defaultBaseUrl, probes: config.probes.map(({ id, path: probePath }) => ({ id, path: probePath })), requiredEnvironmentNames: [...new Set(Object.values(config.environment).flat())], manualGates: config.manualGates.map(({ id, label }) => ({ id, label })) }, null, 2));
    return;
  }
  const report = await buildReport(config, options);
  await mkdir(options.outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(options.outputDirectory, "deployment-acceptance.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
    writeFile(path.join(options.outputDirectory, "deployment-acceptance.md"), markdownReport(report), { mode: 0o600 }),
  ]);
  console.log(JSON.stringify({ decision: report.decision, baseUrl: report.baseUrl, expectedRelease: report.expectedRelease, blockers: report.blockers, reportDirectory: path.relative(projectRoot, options.outputDirectory) }, null, 2));
  if (report.decision !== "accepted" && !options.reportOnly) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
