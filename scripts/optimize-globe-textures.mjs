#!/usr/bin/env node
// Check the five runtime maps; --write converts available original maps to
// WebP without deleting source files. Dimensions and transparency stay intact.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const directory = new URL("../public/media/globe/", import.meta.url);
const textures = [
  { name: "day", source: "jpg", width: 2048, height: 1024, alpha: false },
  { name: "night", source: "png", width: 2048, height: 1024, alpha: false },
  { name: "normal", source: "jpg", width: 2048, height: 1024, alpha: false },
  { name: "specular", source: "jpg", width: 2048, height: 1024, alpha: false },
  { name: "clouds", source: "png", width: 1024, height: 512, alpha: true },
];
const write = process.argv.includes("--write");
let totalBytes = 0;

async function validate(buffer, texture) {
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, "webp", `${texture.name}: expected WebP`);
  assert.equal(metadata.width, texture.width, `${texture.name}: unexpected width`);
  assert.equal(metadata.height, texture.height, `${texture.name}: unexpected height`);
  assert.equal(metadata.hasAlpha, texture.alpha, `${texture.name}: unexpected alpha channel`);
  await sharp(buffer).raw().toBuffer();
}

for (const texture of textures) {
  const filename = `earth-${texture.name}.webp`;
  const target = new URL(filename, directory);
  if (write) {
    let source;
    try {
      source = await readFile(new URL(`earth-${texture.name}.${texture.source}`, directory));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (source) {
      const converted = await sharp(source).webp({ quality: 82, alphaQuality: 80, effort: 6 }).toBuffer();
      await validate(converted, texture);
      await writeFile(target, converted);
      console.log(`${filename}: converted; original retained.`);
    }
  }
  const buffer = await readFile(target);
  await validate(buffer, texture);
  totalBytes += buffer.byteLength;
  console.log(`${filename}: ${texture.width}x${texture.height}, ${Math.round(buffer.byteLength / 1024)} KB, decoded successfully`);
}
assert.ok(totalBytes <= 850_000, `Globe texture budget exceeded: ${totalBytes} > 850000 bytes`);
console.log(`All five globe textures verified: ${Math.round(totalBytes / 1024)} KB total.`);
