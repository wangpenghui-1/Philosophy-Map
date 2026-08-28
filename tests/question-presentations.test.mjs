import assert from "node:assert/strict";
import { statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { journeyById } from "../app/_data/journeys.ts";
import {
  featuredQuestionPresentations,
  questionPresentations,
} from "../app/_data/question-presentations.ts";

test("six question presentations are complete, unique, and map to valid journeys", () => {
  assert.equal(questionPresentations.length, 6);
  assert.equal(featuredQuestionPresentations.length, 3);
  assert.deepEqual(featuredQuestionPresentations.map((item) => item.questionId), ["reality", "knowledge", "good-life"]);
  assert.equal(new Set(questionPresentations.map((item) => item.questionId)).size, 6);

  const resources = questionPresentations.flatMap((item) => Object.values(item.artwork));
  assert.equal(new Set(resources).size, 24);
  for (const presentation of questionPresentations) {
    assert.ok(presentation.title.length > 0);
    assert.ok(presentation.subtitle.length > 0);
    assert.ok(presentation.thinkerIds.length > 0);
    assert.ok(journeyById.has(presentation.primaryJourneyId));
    for (const relatedId of presentation.relatedJourneyIds ?? []) assert.ok(journeyById.has(relatedId));
    for (const resource of Object.values(presentation.artwork)) {
      const file = fileURLToPath(new URL(`../public${resource}`, import.meta.url));
      assert.ok(statSync(file).size > 0, `${resource} is empty`);
    }
  }
});

test("featured AVIF artwork stays below the 300KB first-screen budget", () => {
  const totalBytes = featuredQuestionPresentations.reduce((sum, presentation) => {
    const file = fileURLToPath(new URL(`../public${presentation.artwork.avif1280}`, import.meta.url));
    return sum + statSync(file).size;
  }, 0);
  assert.ok(totalBytes <= 300_000, `featured artwork is ${totalBytes} bytes`);
});
