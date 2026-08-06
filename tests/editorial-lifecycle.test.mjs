import assert from "node:assert/strict";
import test from "node:test";
import { publicationActionSchema } from "../packages/api-contracts/src/index.ts";
import { auditPayloadCitations, evaluateEditorialQuality } from "../packages/domain/src/index.ts";

test("publication gate blocks standard content without sections or sources", () => {
  const report = evaluateEditorialQuality({
    entityType: "concept",
    title: "测试概念",
    slug: "test-concept",
    summary: "这是一段长度足够用于验证发布门禁行为的测试摘要，它不代表正式内容，只用于确认阻断项能够稳定返回。",
    contentTier: "standard",
    payload: { sections: [] },
  }, "2026-08-07T00:00:00.000Z");

  assert.equal(report.readyToPublish, false);
  assert.deepEqual(
    report.findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.code),
    ["sections.missing", "sources.missing"],
  );
});

test("publication gate accepts traceable structured content", () => {
  const report = evaluateEditorialQuality({
    entityType: "concept",
    title: "测试概念",
    slug: "test-concept",
    summary: "这是一段长度足够用于验证发布门禁行为的测试摘要，它包含正文结构和可以追溯到来源的段落引用。",
    contentTier: "standard",
    payload: {
      sections: [{
        id: "overview",
        paragraphs: [{ text: "测试正文", citations: [{ sourceId: "source-a", locator: "1" }] }],
      }],
    },
  }, "2026-08-07T00:00:00.000Z");

  assert.equal(report.readyToPublish, true);
  assert.deepEqual(report.findings, []);
});

test("deep thinker content keeps recommendations non-blocking", () => {
  const report = evaluateEditorialQuality({
    entityType: "person",
    title: "测试人物",
    slug: "test-person",
    summary: "这是一段长度足够用于验证深入人物内容提醒逻辑的测试摘要，正文已有引用但来源数量和代表引文仍需补充。",
    contentTier: "deep",
    payload: {
      sections: [{ paragraphs: [{ citations: [{ sourceId: "source-a" }] }] }],
    },
  }, "2026-08-07T00:00:00.000Z");

  assert.equal(report.readyToPublish, true);
  assert.deepEqual(report.findings.map((finding) => finding.code), [
    "sources.too-few-for-deep",
    "person.quote-missing",
  ]);
  assert.ok(report.findings.every((finding) => finding.severity === "warning"));
});

test("publication action contract requires a reason and concurrency pointer", () => {
  assert.equal(publicationActionSchema.safeParse({ action: "rollback", reason: "回滚到经过复核的稳定版本" }).success, false);
  assert.equal(publicationActionSchema.safeParse({
    action: "rollback",
    reason: "回滚到经过复核的稳定版本",
    expectedCurrentVersionId: "9e188f0f-5fd5-4fe9-af30-655d76929e4f",
  }).success, true);
});

test("paragraph citation audit rejects malformed evidence and reports coverage", () => {
  const payload = {
    sections: [{ paragraphs: [
      { text: "第一段", citations: [{ sourceId: "source-a", locator: "第一章", claim: "支持第一段主张" }] },
      { text: "第二段", citations: [] },
      { text: "第三段", citations: [{ sourceId: "source-b", locator: "", claim: "" }] },
    ] }],
  };
  const audit = auditPayloadCitations(payload);
  assert.equal(audit.paragraphCount, 3);
  assert.equal(audit.citedParagraphCount, 2);
  assert.deepEqual(audit.sourceIds, ["source-a", "source-b"]);
  assert.equal(audit.errors.length, 2);

  const quality = evaluateEditorialQuality({
    entityType: "concept",
    title: "引用测试",
    slug: "citation-test",
    summary: "这是一段长度足够用于验证逐段引用覆盖率门禁逻辑的测试摘要，其中一个正文段落故意没有绑定任何来源。",
    contentTier: "standard",
    payload,
  }, "2026-08-07T00:00:00.000Z");
  assert.ok(quality.findings.some((finding) => finding.code === "citations.paragraph-coverage" && finding.severity === "blocker"));
});
