import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auditKnowledgeBase } from "./knowledge-review-audit.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const reportRoot = path.join(projectRoot, "artifacts", "review");
const full = process.argv.includes("--full");
const fix = process.argv.includes("--fix");
const stages = [];

function run(command, args, label, env = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    console.log(`\n[review] ${label}`);
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { output += chunk; process.stderr.write(chunk); });
    child.on("close", (code) => resolve({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      status: code === 0 ? "passed" : "failed",
      exitCode: code,
      durationMs: Date.now() - startedAt,
      output: output.slice(-12_000),
    }));
  });
}

async function gitValue(args) {
  const result = await run("git", args, `Git ${args.join(" ")}`);
  return result.output.trim().split("\n").at(-1) ?? "unknown";
}

if (fix) stages.push(await run(process.execPath, ["scripts/automated-editor.mjs", "--write"], "Automated editor fix"));
stages.push(await run(process.execPath, ["scripts/automated-editor.mjs"], "Automated editor check"));
stages.push(await run("npm", ["run", "content:release:check"], "210-person release integrity"));
stages.push(await run("npm", ["run", "content:media:check"], "210-person media integrity"));
stages.push(await run("npm", ["run", "content:batch:check"], "Content production scaffold"));
stages.push(await run("npm", ["run", "content:build"], "Knowledge schema and generation"));

let audit = { summary: {}, findings: [{ severity: "blocker", code: "audit-not-run", message: "内容审计未运行。", count: 0, samples: [] }] };
if (stages.at(-1).status === "passed") {
  try {
    const startedAt = Date.now();
    audit = await auditKnowledgeBase({
      contentRoot: path.join(projectRoot, "content", "knowledge"),
      generatedRoot: path.join(projectRoot, "app", "_generated"),
    });
    stages.push({ id: "editorial-evidence-audit", label: "Editorial and evidence audit", status: audit.findings.some((item) => item.severity === "blocker") ? "failed" : "passed", exitCode: 0, durationMs: Date.now() - startedAt, output: JSON.stringify(audit.summary) });
  } catch (error) {
    audit.findings = [{ severity: "blocker", code: "audit-crash", message: error instanceof Error ? error.message : String(error), count: 0, samples: [] }];
    stages.push({ id: "editorial-evidence-audit", label: "Editorial and evidence audit", status: "failed", exitCode: 1, durationMs: 0, output: audit.findings[0].message });
  }
}

stages.push(await run("npm", ["run", "lint"], "ESLint"));
stages.push(await run("npm", ["run", "typecheck"], "TypeScript"));
stages.push(await run("npm", ["test"], "Production build and data tests"));
if (full) stages.push(await run("npm", ["run", "test:e2e"], "Desktop and mobile browser regression", { CI: process.env.CI ?? "" }));
else stages.push({ id: "browser-regression", label: "Desktop and mobile browser regression", status: "not-run", exitCode: null, durationMs: 0, output: "Run npm run review:full before final approval." });

const [branch, commit] = await Promise.all([
  gitValue(["branch", "--show-current"]),
  gitValue(["rev-parse", "--short", "HEAD"]),
]);
const blockers = [
  ...stages.filter((stage) => stage.status === "failed").map((stage) => stage.label),
  ...audit.findings.filter((item) => item.severity === "blocker").map((item) => item.code),
];
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  branch,
  commit,
  mode: full ? "full" : "automated",
  decision: blockers.length ? "blocked" : "ready-for-final-approval",
  finalApprovalRequired: true,
  publicationAllowed: false,
  deploymentAllowed: false,
  summary: audit.summary,
  blockers: [...new Set(blockers)],
  findings: audit.findings,
  stages,
};

const markdown = [
  "# 自动编辑审核报告",
  "",
  `- 结论：**${report.decision === "blocked" ? "阻断" : "建议进入最终审核"}**`,
  `- 分支：\`${branch}\``,
  `- 提交：\`${commit}\``,
  `- 模式：${report.mode}`,
  "- 最终人工批准：必须",
  "- 自动发布／部署：禁止",
  "",
  "## 流水线阶段",
  "",
  ...stages.map((stage) => `- ${stage.status === "passed" ? "✅" : stage.status === "failed" ? "❌" : "⏭️"} ${stage.label}（${Math.round(stage.durationMs / 100) / 10}s）`),
  "",
  "## 内容审核发现",
  "",
  ...audit.findings.map((item) => `- **${item.severity.toUpperCase()} · ${item.code}**：${item.message}${item.count ? `（${item.count}项；示例：${item.samples.join("、")}）` : ""}`),
  "",
  "## 下一步",
  "",
  report.decision === "blocked"
    ? "自动流程必须修复全部阻断项并重新运行完整审核。"
    : "将本报告、代码差异、页面视觉与已知警告提交给用户作最终批准；批准前不得合并或部署。",
  "",
].join("\n");

await mkdir(reportRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(reportRoot, "latest.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(reportRoot, "latest.md"), markdown),
]);
console.log(`\n[review] ${report.decision}. Reports written to artifacts/review/.`);
if (blockers.length) process.exitCode = 1;
