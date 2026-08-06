import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const policy = JSON.parse(await readFile(path.join(root, "infra/backup-policy.json"), "utf8"));
const failures = [];
if (policy.objectives.rpoHours > 24) failures.push("RPO must be no more than 24 hours.");
if (policy.objectives.rtoHours > 4) failures.push("RTO must be no more than 4 hours.");
if (!policy.postgres.encryptedAtRest || !policy.postgres.encryptedInTransit) failures.push("PostgreSQL backups must be encrypted.");
if (!policy.postgres.checksumRequired) failures.push("Backup checksums must be required.");
if (policy.postgres.logicalBackupRetentionDays < 30) failures.push("Logical backup retention must be at least 30 days.");
if (!policy.objectStorage.privateBucket || !policy.objectStorage.versioningRequired) failures.push("Object storage must be private and versioned.");
if (!policy.publicSnapshots.manifestRequired || policy.publicSnapshots.minimumRollbackDeployments < 3) failures.push("Static snapshot rollback policy is incomplete.");

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

if (process.argv.includes("--archive")) {
  const archive = process.env.BACKUP_ARCHIVE_PATH;
  if (!archive || !path.isAbsolute(archive)) failures.push("BACKUP_ARCHIVE_PATH must be an absolute path.");
  else {
    try {
      const metadata = await stat(archive);
      const ageHours = (Date.now() - metadata.mtimeMs) / 3_600_000;
      if (ageHours > policy.postgres.logicalBackupFrequencyHours + 2) failures.push(`Backup is too old: ${ageHours.toFixed(1)} hours.`);
      const sidecar = `${archive}.sha256`;
      const expected = (await readFile(sidecar, "utf8")).trim().split(/\s+/)[0];
      const actual = await sha256(archive);
      if (expected !== actual) failures.push("Backup SHA-256 does not match its sidecar.");
      try { execFileSync("pg_restore", ["--list", archive], { stdio: "ignore" }); }
      catch { failures.push("pg_restore could not read the backup archive."); }
    } catch (error) {
      failures.push(`Backup archive verification failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(process.argv.includes("--archive") ? "Backup archive and policy verified." : "Backup policy verified (no production connection attempted). ");
}
