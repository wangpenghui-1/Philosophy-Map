import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  epistemologyJourney,
  formatJourneyDuration,
  formatJourneyRemaining,
  journeyCatalog,
  journeyRemainingMs,
  validateJourneyCatalog,
  validateJourneyReferences,
} from "../app/_data/journeys.ts";

const atlas = JSON.parse(readFileSync(new URL("../app/_generated/atlas.json", import.meta.url), "utf8"));

test("epistemology journey keeps the approved seven-node route and reading pace", () => {
  assert.deepEqual(
    epistemologyJourney.nodes.map((node) => node.thinkerId),
    ["plato", "akshapada-gautama", "descartes", "locke", "hume", "kant", "thomas-kuhn"],
  );
  assert.equal(epistemologyJourney.estimatedDurationMs, 69_000);
  assert.deepEqual(
    epistemologyJourney.nodes.map((node) => node.durationMs),
    [9_000, 9_000, 9_000, 9_000, 11_000, 12_000, 10_000],
  );
});

test("all eight journeys are available, valid, and form one recommendation loop", () => {
  assert.equal(journeyCatalog.length, 8);
  assert.equal(journeyCatalog.filter((journey) => journey.availability === "available").length, journeyCatalog.length);
  assert.equal(journeyCatalog.filter((journey) => journey.recommended).length, 1);
  assert.equal(validateJourneyCatalog(), true);
  assert.equal(validateJourneyReferences(
    journeyCatalog,
    new Set(atlas.thinkers.map((thinker) => thinker.id)),
    new Set(atlas.relations.map((relation) => relation.id)),
  ), true);

  const durationById = Object.fromEntries(journeyCatalog.map((journey) => [journey.id, journey.estimatedDurationMs]));
  assert.deepEqual(durationById, {
    "free-will": 69_000,
    "knowledge-world": 60_000,
    happiness: 68_000,
    justice: 70_000,
    epistemology: 69_000,
    ontology: 61_000,
    existentialism: 62_000,
    phenomenology: 70_000,
  });

  const recommended = journeyCatalog.find((journey) => journey.recommended);
  const visited = new Set();
  let current = recommended;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    current = journeyCatalog.find((journey) => journey.id === current.relatedJourneyId);
  }
  assert.equal(visited.size, journeyCatalog.length);
  assert.equal(current?.id, recommended.id);
});

test("journey transitions keep evidence relations separate from curated comparisons", () => {
  const evidenceRelationIds = new Set(atlas.relations.map((relation) => relation.id));
  const transitions = journeyCatalog.flatMap((journey) => journey.nodes.map((node) => node.incomingTransition).filter(Boolean));
  const thematicLabels = new Set(["平行回答", "问题转向", "概念重构", "批判推进"]);

  for (const transition of transitions) {
    if (transition.kind === "evidence-relation") assert.ok(evidenceRelationIds.has(transition.relationId));
    else {
      assert.ok(thematicLabels.has(transition.label));
      assert.ok(!evidenceRelationIds.has(`${transition.from}-${transition.to}`));
    }
  }
});

test("journey remaining-time and duration helpers are deterministic", () => {
  assert.equal(journeyRemainingMs(epistemologyJourney, 0), 69_000);
  assert.equal(journeyRemainingMs(epistemologyJourney, 6), 10_000);
  assert.equal(formatJourneyRemaining(100_000), "约剩1分40秒");
  assert.equal(formatJourneyRemaining(9_500), "约剩10秒");
  assert.equal(formatJourneyDuration(epistemologyJourney.estimatedDurationMs), "约70秒");
});
