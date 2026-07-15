import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import test from "node:test";

const MAX_CLIENT_CHUNK_BYTES = 500 * 1024;

test("keeps every minified client JavaScript chunk under 500 KB", async () => {
  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
  assert.ok(files.length > 0, "Expected built client JavaScript assets.");

  const sizes = await Promise.all(files.map(async (file) => ({
    file,
    bytes: (await stat(new URL(file, assetDirectory))).size,
  })));
  const oversized = sizes.filter(({ bytes }) => bytes > MAX_CLIENT_CHUNK_BYTES);
  assert.deepEqual(oversized, [], `Oversized client chunks: ${JSON.stringify(oversized)}`);
});
