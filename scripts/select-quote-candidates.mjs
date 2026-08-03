import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const candidatePath = process.argv[2];
const outputPath = process.argv[3] ?? path.join(projectRoot, ".tmp", "quote-selections.json");
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag >= 0 ? Number(process.argv[limitFlag + 1]) : Infinity;
if (!candidatePath) throw new Error("Usage: node scripts/select-quote-candidates.mjs <candidate-report.json> [output.json] [--limit N]");

async function readJsonDirectory(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

const [candidateReport, people, works] = await Promise.all([
  readFile(candidatePath, "utf8").then(JSON.parse),
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "people")),
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "works")),
]);
const personById = new Map(people.map((person) => [person.id, person]));
const workById = new Map(works.map((work) => [work.id, work]));
const candidates = candidateReport.people.filter((item) => item.candidates.length).slice(0, limit);

const responseSchema = {
  type: "object",
  properties: {
    selections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          personId: { type: "string" },
          status: { enum: ["accepted", "rejected"] },
          candidateIndex: { type: ["integer", "null"] },
          text: { type: ["string", "null"] },
          displayLanguage: { enum: ["zh-classical", "zh-modern", "en", null] },
          textStatus: { enum: ["original", "translation", null] },
          originalLanguage: { type: ["string", "null"] },
          chineseTranslation: { type: ["string", "null"] },
          annotation: { type: ["string", "null"] },
          workId: { type: ["string", "null"] },
          sourceTitle: { type: ["string", "null"] },
          sourceType: { enum: ["primary-text", "archival-source", null] },
          sourceCitation: { type: ["string", "null"] },
          translator: { type: ["string", "null"] },
          translationNote: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: ["personId", "status", "candidateIndex", "text", "displayLanguage", "textStatus", "originalLanguage", "chineseTranslation", "annotation", "workId", "sourceTitle", "sourceType", "sourceCitation", "translator", "translationNote", "reason"],
      },
    },
  },
  required: ["selections"],
};

function buildPrompt(batch) {
  const payload = batch.map((item) => {
    const person = personById.get(item.personId);
    return {
      personId: item.personId,
      name: person.names.display,
      englishName: person.names.english,
      startYear: person.chronology.startYear,
      thesis: person.thesis,
      works: person.workIds.map((id) => {
        const work = workById.get(id);
        return { id, title: work?.title, originalTitle: work?.originalTitle, languages: work?.languages ?? [] };
      }),
      candidates: item.candidates.slice(0, 8).map((candidate, candidateIndex) => ({ candidateIndex, ...candidate })),
    };
  });
  return `你是思想史引文编辑。请严格审核下列候选，只能从 candidates 原样选择 text 和 source，绝对不能自行补写、拼接或改写英文/古文原句。\n\n接受条件：\n1. 句子确为该人物本人或其传统归属文本中的话，不是别人对他的评价，不是误传、转述或网络格言。\n2. source 必须明确指出一部著作、文章、演讲、书信或访谈，并含卷章页码、日期或版本等可追溯信息。若对应 works 中的作品，workId 填该 works.id；若来自其他明确文本，workId 填 null。sourceTitle 填真实文本标题。\n3. sourceType：人物自己的著作、文章、演讲、书信或访谈填 primary-text；残篇、古代证言、权威历史汇编或他人记录的言论填 archival-source。\n4. 不接受只有“Ibid.”、“Quoted in”、“p. 13”或“Chapter 2”而没有文本标题的模糊来源。\n5. 句子应能代表 thesis 所述核心思想，不选无关的机智话、私人轶事或他人评论。\n6. 中文文本：text 原样保留；1912年前标 zh-classical，之后标 zh-modern；提供准确、通俗的现代汉语解释。\n7. 外文文本：只接受英文 text。若文本以英语写成，标 original；否则标 translation，并且 source 必须明确给出英文译者，translator 填译者姓名；没有译者则 rejected。\n8. sourceCitation 必须逐字复制所选 candidate.source。candidateIndex 必须对应所选候选。\n9. annotation 用中文写一至两句，说明该句如何体现人物核心思想，不夸大。\n10. 任何疑问都 rejected，不追求覆盖率。\n\n对每个人都返回一项。accepted 时填写全部字段；rejected 时除 personId、status、reason 外其余字段均为 null。\n\n数据：\n${JSON.stringify(payload)}`;
}

const vagueSourcePattern = /^(?:ibid\.?|quoted in\b|(?:page|p\.)\s*\d+\b|chapter\s+[\divxlc]+\b|section\s+[\divxlc]+\b)/i;

function normalizedTitle(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function candidateContextTitle(candidate) {
  return [candidate.subsectionTitle, candidate.sectionTitle]
    .find((title) => title && !/^(?:quotes?|语录|名言|\d{4}s?)$/i.test(title));
}

function citedTranslator(source) {
  return source.match(/\b(?:translated by|translation by|trans\.?\s+(?:by\s+)?)\s*([^,;·()]+)/i)?.[1]?.trim() ?? null;
}

function normalizeSelection(selection, item) {
  if (selection.status !== "accepted") return selection;
  const candidate = Number.isInteger(selection.candidateIndex) ? item.candidates.slice(0, 8)[selection.candidateIndex] : null;
  const reject = (reason) => ({
    personId: item.personId,
    status: "rejected",
    candidateIndex: null,
    text: null,
    displayLanguage: null,
    textStatus: null,
    originalLanguage: null,
    chineseTranslation: null,
    annotation: null,
    workId: null,
    sourceTitle: null,
    sourceType: null,
    sourceCitation: null,
    translator: null,
    translationNote: null,
    reason: `确定性校验未通过：${reason}`,
  });
  if (!candidate) return reject("candidateIndex 无效");
  selection.text = candidate.text;
  selection.sourceCitation = candidate.source;
  if (vagueSourcePattern.test(candidate.source.trim())) return reject("来源缺少可独立识别的文本标题");

  if (!selection.workId) {
    const contextTitle = candidateContextTitle(candidate);
    if (contextTitle) {
      const normalizedContext = normalizedTitle(contextTitle);
      const matchingWorkIds = personById.get(item.personId).workIds.filter((workId) => {
        const candidateWork = workById.get(workId);
        return [candidateWork?.title, candidateWork?.originalTitle].filter(Boolean).some((title) => {
          const normalizedWorkTitle = normalizedTitle(title);
          return normalizedWorkTitle.length >= 4 && (normalizedContext.includes(normalizedWorkTitle) || normalizedWorkTitle.includes(normalizedContext));
        });
      });
      if (matchingWorkIds.length === 1) selection.workId = matchingWorkIds[0];
    }
  }

  let work = null;
  if (selection.workId) {
    if (!personById.get(item.personId)?.workIds.includes(selection.workId)) return reject("workId 不属于该人物");
    work = workById.get(selection.workId);
    if (!work) return reject("workId 不存在");
    const citedTitle = candidateContextTitle(candidate) ?? candidate.source;
    const knownTitles = [work.title, work.originalTitle].filter(Boolean).map(normalizedTitle);
    const normalizedCitation = normalizedTitle(citedTitle);
    if (!knownTitles.some((title) => title.length >= 4 && (normalizedCitation.includes(title) || title.includes(normalizedCitation)))) {
      return reject("候选出处与 workId 对应的作品标题不一致");
    }
    if (!selection.sourceType) {
      const authorRef = work.authorRefs.find((reference) => reference.personId === item.personId);
      selection.sourceType = authorRef?.role === "author" ? "primary-text" : "archival-source";
    }
  }
  if (!selection.sourceType) return reject("缺少 sourceType");
  selection.sourceTitle = candidateContextTitle(candidate) || selection.sourceTitle?.trim() || work?.originalTitle || work?.title || null;
  if (!selection.sourceTitle) return reject("缺少可识别的 sourceTitle");

  const hasChinese = /[\u3400-\u9fff]/u.test(selection.text);
  if (hasChinese) {
    selection.displayLanguage = personById.get(item.personId).chronology.startYear < 1912 ? "zh-classical" : "zh-modern";
    selection.textStatus = "original";
    selection.originalLanguage = selection.displayLanguage;
    selection.translator = null;
  } else {
    selection.displayLanguage = "en";
    const knownLanguages = work?.languages ?? [];
    if (knownLanguages.includes("en")) {
      selection.textStatus = "original";
      selection.originalLanguage = "en";
      selection.translator = null;
    } else if (knownLanguages.length) {
      selection.textStatus = "translation";
      selection.originalLanguage = knownLanguages[0];
    } else {
      selection.textStatus = selection.originalLanguage === "en" ? "original" : "translation";
    }
    if (selection.textStatus === "translation") {
      selection.translator = citedTranslator(candidate.source) || selection.translator?.trim();
      if (!selection.translator?.trim()) return reject("非英语文本的英文译文缺少译者");
      if (!candidate.source.toLowerCase().includes(selection.translator.trim().toLowerCase())) return reject("译者姓名未出现在候选来源中");
    }
  }
  if (!selection.chineseTranslation?.trim()) return reject("缺少中文翻译或今译");
  return selection;
}

async function selectBatch(batch) {
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5:9b",
      prompt: buildPrompt(batch),
      stream: false,
      think: false,
      format: responseSchema,
      options: { temperature: 0, num_ctx: 65536, num_predict: 7000 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  return JSON.parse(payload.response).selections;
}

let selections = [];
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8"));
  const previousIds = previous.selections?.map((item) => item.personId) ?? [];
  const expectedIds = candidates.slice(0, previousIds.length).map((item) => item.personId);
  if (JSON.stringify(previousIds) === JSON.stringify(expectedIds)) selections = previous.selections;
} catch {
  // A missing or incomplete output simply starts a fresh run.
}

const batchSize = 6;
for (let index = selections.length; index < candidates.length; index += batchSize) {
  const batch = candidates.slice(index, index + batchSize);
  const rawResult = await selectBatch(batch);
  const resultByPerson = new Map(rawResult.map((item) => [item.personId, item]));
  const result = batch.map((item) => normalizeSelection(resultByPerson.get(item.personId) ?? { personId: item.personId, status: "rejected", reason: "模型未返回该人物" }, item));
  selections.push(...result);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), selections }, null, 2)}\n`);
  console.log(`Selected ${Math.min(index + batch.length, candidates.length)}/${candidates.length}; accepted ${selections.filter((item) => item.status === "accepted").length}.`);
}
