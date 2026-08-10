import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = [
  "app/_generated/knowledge.json",
  "app/_generated/knowledge-index.json",
  "app/_generated/atlas.json",
  "app/_generated/search-index.json",
];

async function digest(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return { path: relativePath, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

const artifacts = await Promise.all(files.map(digest));
const knowledge = JSON.parse(await readFile(path.join(root, files[0]), "utf8"));
let commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
if (!commit) {
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
  catch { commit = "unknown"; }
}
const manifest = {
  schemaVersion: 1,
  release: commit,
  generatedAt: new Date().toISOString(),
  publicContentOnly: true,
  counts: {
    people: knowledge.people.length,
    concepts: knowledge.concepts.length,
    traditions: knowledge.traditions.length,
    works: knowledge.works.length,
    relations: knowledge.relations.length,
    sources: knowledge.sources.length,
  },
  artifacts,
};

if (process.argv.includes("--write")) {
  const output = path.join(root, "artifacts/production/release-manifest.json");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(`Release manifest written: ${path.relative(root, output)}`);
} else {
  console.log(JSON.stringify(manifest, null, 2));
}
