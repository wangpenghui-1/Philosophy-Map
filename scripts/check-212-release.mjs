import { readFile, readdir } from "node:fs/promises";
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

const [people, coverage, legacyRelease, legacyMedia, increment] = await Promise.all([
  readPeople(),
  readJson(path.join(contentRoot, "coverage", "people.json")),
  readJson(path.join(contentRoot, "coverage", "release-210.json")),
  readJson(path.join(contentRoot, "coverage", "media-210.json")),
  readJson(path.join(contentRoot, "coverage", "release-213-increment.json")),
]);

const failures = [];
const currentIds = new Set(people.map((person) => person.id));
const baselineIds = new Set(legacyMedia.members.map((member) => member.personId));
const incrementIds = new Set(increment.members.map((member) => member.personId));
const expectedPublicPeople = increment.baselinePeople + increment.addedPeople;

if (legacyRelease.publicPeople !== increment.baselinePeople) failures.push("increment baseline does not match release-210");
if (legacyMedia.publicPeople !== increment.baselinePeople || legacyMedia.members.length !== increment.baselinePeople) failures.push("media-210 baseline is inconsistent");
if (increment.members.length !== increment.addedPeople || incrementIds.size !== increment.addedPeople) failures.push("increment member count is inconsistent");
if ([...incrementIds].some((id) => baselineIds.has(id))) failures.push("increment overlaps the historical baseline");
if (people.length !== expectedPublicPeople || currentIds.size !== expectedPublicPeople) failures.push("current people count does not match baseline plus increment");
if ([...baselineIds, ...incrementIds].some((id) => !currentIds.has(id))) failures.push("release manifests reference missing people");
if ([...currentIds].some((id) => !baselineIds.has(id) && !incrementIds.has(id))) failures.push("a published person is absent from both release manifests");
if (increment.members.some((member) => {
  const person = people.find((candidate) => candidate.id === member.personId);
  return !person || person.slug !== member.slug || person.editorialStatus !== "published" || member.sourceIds.some((id) => !person.sourceIds.includes(id));
})) failures.push("increment member metadata has drifted from person records");
if (coverage.publishedBaseline !== expectedPublicPeople || coverage.targetTotal !== expectedPublicPeople || coverage.candidateCount !== coverage.candidates.length) failures.push("coverage totals do not match the current release");
if (Object.values(coverage.regionTargets).reduce((sum, value) => sum + value, 0) !== expectedPublicPeople) failures.push("coverage region totals are inconsistent");
if (Object.values(coverage.eraTargets).reduce((sum, value) => sum + value, 0) !== expectedPublicPeople) failures.push("coverage era totals are inconsistent");

if (failures.length) throw new Error(`Current release check failed: ${failures.join("; ")}`);
console.log(`Release check passed: ${increment.baselinePeople}-person historical baseline + ${increment.addedPeople}-person increment = ${expectedPublicPeople} published people.`);
