import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

const westernCoreIds = [
  "heraclitus", "parmenides", "socrates", "plato", "aristotle", "epicurus", "zeno-citium", "seneca", "epictetus", "plotinus",
  "augustine", "anselm-canterbury", "aquinas", "william-ockham", "meister-eckhart",
  "machiavelli", "francis-bacon", "hobbes", "descartes", "blaise-pascal", "spinoza", "locke", "george-berkeley", "hume", "rousseau", "kant", "wollstonecraft",
  "jeremy-bentham", "hegel", "arthur-schopenhauer", "john-stuart-mill", "kierkegaard", "marx", "charles-sanders-peirce", "nietzsche", "william-james", "gottlob-frege",
  "husserl", "heidegger", "wittgenstein", "bertrand-russell", "rudolf-carnap", "arendt", "beauvoir", "foucault", "john-dewey", "w-v-o-quine", "john-rawls", "thomas-kuhn", "judith-butler",
];

async function readJsonDirectory(relativePath) {
  const directory = path.join(root, relativePath);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
}

test("the 50-person western core has complete, traceable representative quotes", async () => {
  const [people, sources] = await Promise.all([
    readJsonDirectory("content/knowledge/people"),
    readJsonDirectory("content/knowledge/sources"),
  ]);
  const personById = new Map(people.map((person) => [person.id, person]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  assert.equal(new Set(westernCoreIds).size, 50);

  for (const id of westernCoreIds) {
    const person = personById.get(id);
    assert.ok(person, `${id}: person record is missing`);
    const quote = person.representativeQuote;
    assert.ok(quote, `${id}: representative quote is missing`);
    assert.ok(quote.text.length >= 5, `${id}: quote text is too short`);
    assert.equal(quote.displayLanguage, "en", `${id}: western quote must display English text`);
    assert.ok(quote.chineseTranslation?.length, `${id}: Chinese translation is missing`);
    assert.ok(quote.annotation?.length >= 20, `${id}: annotation is missing or too short`);
    assert.ok(quote.locator?.length, `${id}: exact locator is missing`);
    assert.ok(person.sourceIds.includes(quote.sourceId), `${id}: quote source is not linked from person.sourceIds`);

    const source = sourceById.get(quote.sourceId);
    assert.ok(source, `${id}: source record ${quote.sourceId} is missing`);
    assert.equal(source.sourceType, quote.sourceType, `${id}: source types do not match`);
    assert.ok(source.publication?.length, `${id}: source publication is missing`);
    assert.ok(source.defaultLocator?.length || quote.locator?.length, `${id}: source locator is missing`);

    if (quote.textStatus === "translation") {
      assert.notEqual(quote.originalLanguage, "en", `${id}: translated quote is incorrectly labelled as English original`);
      assert.ok(quote.translator?.length, `${id}: English translator is missing`);
      assert.ok(quote.translationNote?.includes("英文译文"), `${id}: English-translation label is missing`);
    } else {
      assert.equal(quote.textStatus, "original", `${id}: unsupported text status`);
      assert.equal(quote.originalLanguage, "en", `${id}: original English label does not match language`);
    }

    if (quote.verificationStatus !== "primary-verified") {
      assert.ok(quote.attributionNote?.length, `${id}: attribution note is required for non-primary status`);
    }
  }
});
