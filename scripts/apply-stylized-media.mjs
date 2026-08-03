import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const peopleRoot = path.join(projectRoot, "content", "knowledge", "people");
const catalogPath = path.join(projectRoot, "content", "knowledge", "coverage", "media-210.json");
const fullRoot = path.join(projectRoot, "public", "media", "thinkers", "full");
const thumbRoot = path.join(projectRoot, "public", "media", "thinkers", "thumb");

const sheets = [
  {
    path: process.argv[2],
    columns: 4,
    rows: 4,
    people: [
      "abhinavagupta", "achille-mbembe", "akshapada-gautama", "bhartrhari",
      "epeli-hauofa", "gangesha", "henry-odera-oruka", "ifi-amadiume",
      "jayanta-bhatta", "john-mbiti", "kumarila-bhatta", "kwasi-wiredu",
      "leila-ahmed", "mulla-sadra", "sophie-oluwole", "syed-hussein-alatas",
    ],
  },
  {
    path: process.argv[3],
    columns: 4,
    rows: 4,
    people: [
      "sylvia-wynter", "vine-deloria-jr", "xunzi", "ahmad-baba",
      "anibal-quijano", "anselm-canterbury", "badarayana", "fazlur-rahman",
      "huiyuan", "ibn-arabi", "kanada", "maitreyi",
      "mani", "mozi", "nezahualcoyotl", "rudolf-carnap",
    ],
  },
  {
    path: process.argv[4],
    columns: 3,
    rows: 2,
    people: ["saadia-gaon", "seneca", "steve-biko", "suhrawardi", "zera-yacob", "zoroaster"],
  },
];

if (sheets.some((sheet) => !sheet.path)) throw new Error("Usage: node scripts/apply-stylized-media.mjs <sheet-a> <sheet-b> <sheet-c>");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} exited ${code}: ${stderr.slice(-1000)}`)));
  });
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readPeople() {
  const files = (await readdir(peopleRoot)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(peopleRoot, file), "utf8"))));
}

for (const sheet of sheets) {
  const dimensions = (await run("magick", ["identify", "-format", "%w %h", sheet.path])).split(/\s+/u).map(Number);
  const [width, height] = dimensions;
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Cannot read ${sheet.path}`);
  for (const [index, personId] of sheet.people.entries()) {
    const column = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    const left = Math.round(column * width / sheet.columns);
    const right = Math.round((column + 1) * width / sheet.columns);
    const top = Math.round(row * height / sheet.rows);
    const bottom = Math.round((row + 1) * height / sheet.rows);
    const fullFile = path.join(fullRoot, `${personId}.webp`);
    const thumbFile = path.join(thumbRoot, `${personId}.webp`);
    await run("magick", [sheet.path, "-crop", `${right - left}x${bottom - top}+${left}+${top}`, "+repage", "-resize", "800x1000^", "-gravity", "center", "-extent", "800x1000", "-strip", "-quality", "80", fullFile]);
    await run("magick", [fullFile, "-resize", "200x250", "-strip", "-quality", "80", thumbFile]);
    const personPath = path.join(peopleRoot, `${personId}.json`);
    const person = JSON.parse(await readFile(personPath, "utf8"));
    person.media = {
      fullSrc: `/media/thinkers/full/${person.slug}.webp`,
      thumbSrc: `/media/thinkers/thumb/${person.slug}.webp`,
      alt: `${person.names.display}的艺术化人物形象`,
      objectPosition: "50% 50%",
      depictionNote: "AI辅助生成的艺术化人物形象，用于提供视觉入口；不是历史照片，也不应作为其真实相貌证据。",
      presentationType: "stylized",
      authenticity: "interpretive",
      rightsStatus: "project-commissioned",
      credit: "思想星图 AI 辅助艺术化人物形象",
    };
    await writeFile(personPath, jsonText(person));
    console.log(`[stylized-media] ${personId}`);
  }
}

const people = await readPeople();
const counts = {};
for (const person of people) counts[person.media.presentationType] = (counts[person.media.presentationType] ?? 0) + 1;
const catalog = {
  version: 1,
  releaseId: "media-public-210",
  status: (counts.placeholder ?? 0) === 0 ? "release-candidate" : "blocked",
  publicPeople: people.length,
  generatedAt: "2026-07-19",
  counts,
  policy: {
    openLicensesOnly: true,
    generatedImagesPresentedAsHistorical: false,
    traditionalDepictionsExplicitlyLabeled: true,
    fullImage: { width: 800, height: 1000, format: "webp", quality: 80 },
    thumbnail: { width: 200, height: 250, format: "webp", quality: 80 },
  },
  members: people.map((person) => ({ personId: person.id, slug: person.slug, media: person.media })),
};
await writeFile(catalogPath, jsonText(catalog));
console.log(`[stylized-media] catalog updated: ${JSON.stringify(counts)}`);
