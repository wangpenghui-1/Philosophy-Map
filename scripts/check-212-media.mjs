import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(projectRoot, "content", "knowledge");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readPeople() {
  const root = path.join(contentRoot, "people");
  const files = (await readdir(root)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map((file) => readJson(path.join(root, file))));
}

const [people, baseline, increment] = await Promise.all([
  readPeople(),
  readJson(path.join(contentRoot, "coverage", "media-210.json")),
  readJson(path.join(contentRoot, "coverage", "media-212-increment.json")),
]);

const failures = [];
const manifestMembers = [...baseline.members, ...increment.members];
const manifestById = new Map(manifestMembers.map((member) => [member.personId, member]));
const expectedPublicPeople = increment.baselinePeople + increment.addedPeople;

if (baseline.publicPeople !== increment.baselinePeople || baseline.members.length !== increment.baselinePeople) failures.push("historical media baseline is inconsistent");
if (increment.members.length !== increment.addedPeople) failures.push("increment media count is inconsistent");
if (manifestById.size !== expectedPublicPeople || people.length !== expectedPublicPeople) failures.push("combined media manifests do not match the public people count");

for (const person of people) {
  const member = manifestById.get(person.id);
  if (!member || member.slug !== person.slug || JSON.stringify(member.media) !== JSON.stringify(person.media)) failures.push(`${person.id}: media manifest drift`);
  if (person.media.presentationType === "placeholder" || !person.media.fullSrc || !person.media.thumbSrc) failures.push(`${person.id}: incomplete public media`);
  if (person.media.rightsStatus !== "project-commissioned" && (!person.media.sourceUrl || !person.media.sourceFile || !person.media.license || !person.media.retrievedAt)) failures.push(`${person.id}: external media provenance incomplete`);
  for (const source of [person.media.fullSrc, person.media.thumbSrc].filter(Boolean)) {
    try {
      await access(path.join(projectRoot, "public", source));
    } catch {
      failures.push(`${person.id}: missing ${source}`);
    }
  }
}

if (failures.length) throw new Error(`212-person media check failed (${failures.length}): ${failures.slice(0, 20).join("; ")}`);
console.log(`Media check passed: ${expectedPublicPeople} people have optimized assets and matching baseline or incremental provenance records.`);
