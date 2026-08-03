import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const selectionPath = process.argv[2];
const candidatePath = process.argv[3];
const outputPath = process.argv[4] ?? path.join(projectRoot, ".tmp", "quote-selection-audit.json");
if (!selectionPath || !candidatePath) {
  throw new Error("Usage: node scripts/audit-quote-selections.mjs <selections.json> <candidate-report.json> [output.json]");
}

async function readJsonDirectory(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

const [selectionReport, candidateReport, people, works] = await Promise.all([
  readFile(selectionPath, "utf8").then(JSON.parse),
  readFile(candidatePath, "utf8").then(JSON.parse),
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "people")),
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "works")),
]);

const personById = new Map(people.map((person) => [person.id, person]));
const workById = new Map(works.map((work) => [work.id, work]));
const candidatesByPerson = new Map(candidateReport.people.map((item) => [item.personId, item.candidates]));
const indirectPattern = /\b(?:cited in|as quoted in|quoted in|as quoted by|according to)\b/i;

function auditSelection(selection) {
  if (selection.status !== "accepted") return { ...selection, auditStatus: "rejected", blockers: [], cautions: [] };
  const blockers = [];
  const cautions = [];
  const person = personById.get(selection.personId);
  const candidate = candidatesByPerson.get(selection.personId)?.[selection.candidateIndex];
  const work = selection.workId ? workById.get(selection.workId) : null;

  if (!person) blockers.push("person-not-found");
  if (!candidate) blockers.push("candidate-not-found");
  if (candidate && selection.text !== candidate.text) blockers.push("text-mismatch");
  if (candidate && selection.sourceCitation !== candidate.source) blockers.push("source-mismatch");
  if (selection.workId && !person?.workIds.includes(selection.workId)) blockers.push("work-not-owned");
  if (selection.workId && !work) blockers.push("work-not-found");
  if (selection.textStatus === "translation" && !selection.translator) blockers.push("translator-missing");
  if (selection.displayLanguage === "en" && !selection.chineseTranslation) blockers.push("chinese-translation-missing");

  const languages = work?.languages ?? [];
  if (
    person?.chronology.startYear < 1500
    && selection.displayLanguage === "en"
    && selection.textStatus === "original"
    && !languages.includes("en")
  ) {
    blockers.push("historical-language-unverified");
  }
  if (indirectPattern.test(selection.sourceCitation ?? "")) cautions.push("indirect-citation");
  if (!selection.workId) cautions.push("source-outside-current-work-index");
  cautions.push("primary-or-edition-check-required");

  return {
    ...selection,
    auditStatus: blockers.length ? "needs-correction" : "ready-for-source-review",
    blockers,
    cautions,
  };
}

const audited = selectionReport.selections.map(auditSelection);
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: audited.length,
    modelAccepted: audited.filter((item) => item.status === "accepted").length,
    readyForSourceReview: audited.filter((item) => item.auditStatus === "ready-for-source-review").length,
    needsCorrection: audited.filter((item) => item.auditStatus === "needs-correction").length,
    rejected: audited.filter((item) => item.auditStatus === "rejected").length,
  },
  selections: audited,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
