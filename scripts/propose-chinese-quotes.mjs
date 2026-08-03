import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = process.argv[2] ?? "/private/tmp/philosophy-map-chinese-quote-proposals.json";

async function readJsonDirectory(directory) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

const [people, works] = await Promise.all([
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "people")),
  readJsonDirectory(path.join(projectRoot, "content", "knowledge", "works")),
]);
const workById = new Map(works.map((work) => [work.id, work]));
const targets = people.filter((person) => !person.representativeQuote && person.workIds.some((id) => workById.get(id)?.languages?.includes("zh")));

const responseSchema = {
  type: "object",
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          personId: { type: "string" },
          status: { enum: ["proposed", "needs-research"] },
          text: { type: ["string", "null"] },
          modernChinese: { type: ["string", "null"] },
          sourceTitle: { type: ["string", "null"] },
          locator: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: ["personId", "status", "text", "modernChinese", "sourceTitle", "locator", "reason"],
      },
    },
  },
  required: ["proposals"],
};

function buildData(batch) {
  return batch.map((person) => ({
  personId: person.id,
  name: person.names.display,
  startYear: person.chronology.startYear,
  thesis: person.thesis,
  works: person.workIds.map((id) => {
    const work = workById.get(id);
    return { id, title: work?.title, originalTitle: work?.originalTitle };
  }),
  }));
}

function buildPrompt(batch) {
  return `你是中国思想史引文研究助理。为每个人提出一条最能体现 thesis 的原句，供编辑随后到原典逐字核对。\n\n规则：\n1. 只能提出你能明确定位到真实古籍篇名、卷次或现代著作章节的原句；不确定就 needs-research。\n2. 1912 年以前人物必须给古文原句和通俗今译；现代人物必须给其本人中文原句，不得把后人的概括或译文冒充原句。\n3. 优先从 works 中选择，但可用其他明确命名的本人著作、文章、演讲或书信。\n4. text 不得拼接、润色或改写，locator 不得只写书名。\n5. 这些只是研究建议，不代表已经核实。\n\n每个人返回一项。\n\n数据：${JSON.stringify(buildData(batch))}`;
}

const proposals = [];
for (let index = 0; index < targets.length; index += 6) {
  const batch = targets.slice(index, index + 6);
  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "qwen3.5:9b",
      prompt: buildPrompt(batch),
      stream: false,
      think: false,
      format: responseSchema,
      options: { temperature: 0, num_ctx: 32768, num_predict: 3000 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  proposals.push(...JSON.parse(payload.response).proposals);
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), proposals }, null, 2)}\n`);
  console.log(`Proposed ${Math.min(index + batch.length, targets.length)}/${targets.length}.`);
}
console.log(JSON.stringify({ outputPath, targets: targets.length, proposed: proposals.filter((item) => item.status === "proposed").length }, null, 2));
