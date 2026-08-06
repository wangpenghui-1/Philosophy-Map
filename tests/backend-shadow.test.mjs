import assert from "node:assert/strict";
import test from "node:test";
import knowledgeRaw from "../app/_generated/knowledge.json" with { type: "json" };
import indexRaw from "../app/_generated/knowledge-index.json" with { type: "json" };
import {
  createStaticKnowledgeRepository,
} from "../packages/knowledge/src/index.ts";
import {
  canTransitionEditorialStatus,
  hasPermission,
} from "../packages/domain/src/index.ts";
import {
  GroundedConversationService,
  validateEvidenceMarkers,
} from "../packages/ai/src/index.ts";
import {
  hashPassword,
  isLocalAdminPreviewRequest,
  verifyPassword,
} from "../packages/auth/src/index.ts";

const repository = createStaticKnowledgeRepository(knowledgeRaw, indexRaw);

test("published static repository preserves generated catalog counts", () => {
  assert.deepEqual(repository.catalog(), {
    people: knowledgeRaw.people.length,
    concepts: knowledgeRaw.concepts.length,
    traditions: knowledgeRaw.traditions.length,
    works: knowledgeRaw.works.length,
    contexts: knowledgeRaw.contexts.length,
    places: knowledgeRaw.places.length,
    sources: knowledgeRaw.sources.length,
    relations: knowledgeRaw.relations.length,
  });
  assert.ok(Object.values(knowledgeRaw).flat().every((record) => record.editorialStatus === "published"));
});

test("repository search paginates without exposing non-index entities", () => {
  const first = repository.search({ query: "", limit: 10 });
  const second = repository.search({ query: "", offset: first.nextOffset, limit: 10 });
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 10);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.ok(first.items.every((item) => ["person", "concept", "tradition", "work"].includes(item.entityType)));
});

test("graph endpoint semantics preserve thematic resonance direction", () => {
  const graph = repository.graph("kant", 1);
  assert.ok(graph);
  assert.ok(graph.entities.some((entity) => entity.id === "kant"));
  assert.ok(graph.relations.every((relation) => relation.relationType !== "thematic-resonance" || relation.directed === false));
});

test("editorial transition and role separation are enforced", () => {
  assert.equal(canTransitionEditorialStatus("candidate", "edited"), true);
  assert.equal(canTransitionEditorialStatus("candidate", "published"), false);
  assert.equal(hasPermission("reviewer", "knowledge:review:complete"), true);
  assert.equal(hasPermission("reviewer", "knowledge:publish"), false);
  assert.equal(hasPermission("publisher", "knowledge:publish"), true);
});

test("grounded assistant abstains or returns only traceable evidence", async () => {
  const service = new GroundedConversationService(repository);
  const answer = await service.answer("康德的认识论为什么需要批判？");
  assert.equal(answer.abstained, false);
  assert.ok(answer.citations.length > 0);
  assert.equal(validateEvidenceMarkers(answer.text, answer.evidence), true);

  const missing = await service.answer("思想星图里完全不存在的虚构哲学家阿特拉斯九号说了什么？");
  assert.equal(missing.abstained, true);
  assert.equal(missing.citations.length, 0);
});

test("admin password hashes verify without storing plaintext", async () => {
  const encoded = await hashPassword("a-long-local-test-password");
  assert.match(encoded, /^scrypt\$/);
  assert.equal(encoded.includes("a-long-local-test-password"), false);
  assert.equal(await verifyPassword("a-long-local-test-password", encoded), true);
  assert.equal(await verifyPassword("a-wrong-local-test-password", encoded), false);
});

test("local admin preview is limited to loopback admin routes", () => {
  const headers = { cookie: "atlas_admin_preview=1" };
  assert.equal(isLocalAdminPreviewRequest(new Request("http://127.0.0.1:3010/admin", { headers })), true);
  assert.equal(isLocalAdminPreviewRequest(new Request("http://127.0.0.1:3010/api/admin/v1/auth/session", { headers })), true);
  assert.equal(isLocalAdminPreviewRequest(new Request("http://127.0.0.1:3010/api/v1/me", { headers })), false);
  assert.equal(isLocalAdminPreviewRequest(new Request("https://example.com/admin", { headers })), false);
});
