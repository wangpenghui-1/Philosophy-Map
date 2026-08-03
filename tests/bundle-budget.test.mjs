import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import test from "node:test";

const MAX_CLIENT_CHUNK_BYTES = 500 * 1024;

test("keeps every minified client JavaScript chunk under 500 KB", async () => {
  const assetDirectory = new URL("../.next/static/chunks/", import.meta.url);
  const files = [];
  const visit = async (directory, prefix = "") => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await visit(new URL(`${entry.name}/`, directory), `${relativePath}/`);
      else if (entry.name.endsWith(".js")) files.push(relativePath);
    }
  };
  await visit(assetDirectory);
  assert.ok(files.length > 0, "Expected built client JavaScript assets.");

  const sizes = await Promise.all(files.map(async (file) => ({
    file,
    bytes: (await stat(new URL(file, assetDirectory))).size,
  })));
  const oversized = sizes.filter(({ bytes }) => bytes > MAX_CLIENT_CHUNK_BYTES);
  assert.deepEqual(oversized, [], `Oversized client chunks: ${JSON.stringify(oversized)}`);
});
