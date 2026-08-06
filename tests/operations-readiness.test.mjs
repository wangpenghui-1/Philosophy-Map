import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("backup policy enforces recoverability objectives", async () => {
  const policy = JSON.parse(await readFile(new URL("../infra/backup-policy.json", import.meta.url), "utf8"));
  assert.ok(policy.objectives.rpoHours <= 24);
  assert.ok(policy.objectives.rtoHours <= 4);
  assert.ok(policy.postgres.logicalBackupRetentionDays >= 30);
  assert.equal(policy.postgres.checksumRequired, true);
  assert.equal(policy.postgres.encryptedAtRest, true);
  assert.equal(policy.objectStorage.versioningRequired, true);
  assert.ok(policy.publicSnapshots.minimumRollbackDeployments >= 3);
});

test("backup policy and restore drill dry-run execute without external services", () => {
  const cwd = new URL("..", import.meta.url);
  const backup = execFileSync(process.execPath, ["scripts/verify-backup.mjs", "--policy-only"], { cwd, encoding: "utf8" });
  assert.match(backup, /Backup policy verified/);
  const drill = JSON.parse(execFileSync(process.execPath, ["scripts/restore-drill.mjs", "--dry-run"], { cwd, encoding: "utf8" }));
  assert.equal(drill.destructiveActions, false);
  assert.equal(drill.objectives.rpoHours, 24);
});

test("restore execution refuses production and non-temporary targets", async () => {
  const source = await readFile(new URL("../scripts/restore-drill.mjs", import.meta.url), "utf8");
  assert.match(source, /target === production/);
  assert.match(source, /temporaryDatabasePrefix/);
  assert.match(source, /existingTables !== 0/);
  assert.match(source, /will not clean or overwrite/);
});

test("release manifest hashes only generated public projections", async () => {
  const source = await readFile(new URL("../scripts/generate-release-manifest.mjs", import.meta.url), "utf8");
  assert.match(source, /publicContentOnly: true/);
  assert.match(source, /knowledge\.json/);
  assert.match(source, /atlas\.json/);
  assert.doesNotMatch(source, /DATABASE_URL|memory_items|conversations/);
});
