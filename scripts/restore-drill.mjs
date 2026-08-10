import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const policy = JSON.parse(await readFile(path.join(root, "infra/backup-policy.json"), "utf8"));
const execute = process.argv.includes("--execute");
const checklist = [
  "Select a verified logical backup and its SHA-256 sidecar.",
  `Provision an empty disposable database named ${policy.postgres.temporaryDatabasePrefix}<timestamp>.`,
  "Keep RESTORE_DATABASE_URL different from DATABASE_URL and confirm the temporary target.",
  "Restore without owners or provider-specific privileges.",
  "Verify core tables, published content, RLS flags, and application smoke tests.",
  "Record timings and destroy the disposable database manually after evidence is retained.",
];

if (!execute) {
  console.log(JSON.stringify({ mode: "dry-run", destructiveActions: false, objectives: policy.objectives, checklist }, null, 2));
  process.exit(0);
}

const archive = process.env.BACKUP_ARCHIVE_PATH;
const target = process.env.RESTORE_DATABASE_URL;
const production = process.env.DATABASE_URL;
if (!archive || !path.isAbsolute(archive)) throw new Error("BACKUP_ARCHIVE_PATH must be an absolute path.");
if (!target) throw new Error("RESTORE_DATABASE_URL is required.");
if (target === production) throw new Error("Restore drill target must never equal DATABASE_URL.");
if (process.env.RESTORE_DRILL_CONFIRM !== "atlas-temporary-database") throw new Error("Set RESTORE_DRILL_CONFIRM=atlas-temporary-database for an intentional drill.");

const databaseName = execFileSync("psql", [target, "-At", "-v", "ON_ERROR_STOP=1", "-c", "select current_database()"], { encoding: "utf8" }).trim();
if (!databaseName.startsWith(policy.postgres.temporaryDatabasePrefix)) throw new Error("Restore target name does not use the required temporary prefix.");
const existingTables = Number(execFileSync("psql", [target, "-At", "-v", "ON_ERROR_STOP=1", "-c", "select count(*) from pg_tables where schemaname = 'public'"], { encoding: "utf8" }).trim());
if (existingTables !== 0) throw new Error("Restore target must be empty; this script will not clean or overwrite a database.");

const startedAt = Date.now();
execFileSync("pg_restore", ["--exit-on-error", "--no-owner", "--no-privileges", "--dbname", target, archive], { stdio: "inherit" });
const verification = execFileSync("psql", [target, "-At", "-v", "ON_ERROR_STOP=1", "-c", "select json_build_object('entities', (select count(*) from entities), 'published', (select count(*) from entity_versions where editorial_status = 'published'), 'rls_tables', (select count(*) from pg_class where relrowsecurity))"], { encoding: "utf8" }).trim();
const report = {
  schemaVersion: 1,
  completedAt: new Date().toISOString(),
  durationSeconds: Math.round((Date.now() - startedAt) / 1000),
  targetClass: "disposable-prefixed-database",
  objectives: policy.objectives,
  verification: JSON.parse(verification),
  cleanup: "Destroy the temporary database manually after the report is reviewed.",
};
await mkdir(path.join(root, "artifacts/production"), { recursive: true });
await writeFile(path.join(root, "artifacts/production/restore-drill-report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
