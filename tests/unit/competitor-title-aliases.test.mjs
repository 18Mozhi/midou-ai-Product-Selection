import test from "node:test";
import assert from "node:assert/strict";
import { OpenAiIntelligenceProductClassifier } from "../../apps/worker/dist/intelligence-product-association.js";

const input = {
  primary: {
    source_ref: "00000000-0000-4000-8000-000000000001",
    asin: "B000000001",
    title: "Handheld portable fan",
  },
  candidates: Array.from({ length: 15 }, (_, i) => ({
    source_ref: `00000000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`,
    asin: `B0TEST${String(i).padStart(4, "0")}`,
    title: `Portable handheld fan ${i}`,
  })),
};
const client = (respond) =>
  new OpenAiIntelligenceProductClassifier(
    "test",
    "https://model.invalid/v1",
    "",
    1000,
    async (_url, request) => {
      const body = JSON.parse(request.body),
        transported = JSON.parse(body.messages[1].content);
      const output = respond(transported, body);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }),
      );
    },
  );
const valid = (transported) => ({
  classifications: transported.candidates.map((c) => ({
    source_ref: c.source_ref,
    relation: "substitute",
    rationale: "Same handheld use",
  })),
});

test("15 short transport references bind reordered results to exact original evidence and titles", async () => {
  const before = structuredClone(input);
  const result = await client((transported, body) => {
    assert.equal(transported.primary.source_ref, "primary");
    assert.deepEqual(
      transported.candidates.map((c) => c.source_ref),
      Array.from({ length: 15 }, (_, i) => `c${i + 1}`),
    );
    assert.deepEqual(
      transported.candidates.map((c) => c.title),
      input.candidates.map((c) => c.title),
    );
    assert.equal(JSON.stringify(transported).includes("00000000-0000-4000-8000"), false);
    assert.match(body.messages[0].content, /never ASINs or primary/);
    const output = valid(transported);
    output.classifications.reverse();
    return output;
  }).classifyCompetitors(input);
  assert.deepEqual(
    result.map((r) => r.source_ref),
    input.candidates.map((c) => c.source_ref),
  );
  assert.deepEqual(
    result.map((r) => r.candidate_excerpt),
    input.candidates.map((c) => c.title),
  );
  assert.ok(result.every((r) => r.primary_excerpt === input.primary.title));
  assert.deepEqual(input, before);
});

for (const [name, mutate] of [
  [
    "unknown alias",
    (r) => {
      r[0].source_ref = "c999";
    },
  ],
  [
    "primary alias",
    (r) => {
      r[0].source_ref = "primary";
    },
  ],
  [
    "ASIN instead of alias",
    (r) => {
      r[0].source_ref = input.candidates[0].asin;
    },
  ],
  [
    "original UUID instead of alias",
    (r) => {
      r[0].source_ref = input.candidates[0].source_ref;
    },
  ],
  [
    "similar but inexact alias",
    (r) => {
      r[0].source_ref = "c01";
    },
  ],
  [
    "duplicate alias",
    (r) => {
      r[1].source_ref = "c1";
    },
  ],
  [
    "omitted candidate",
    (r) => {
      r.pop();
    },
  ],
  [
    "invented evidence",
    (r) => {
      r[0].candidate_excerpt = "model quote";
    },
  ],
  [
    "invented metric",
    (r) => {
      r[0].sales = 100;
    },
  ],
])
  test(`transport validation still rejects ${name}`, async () => {
    await assert.rejects(
      client((transported) => {
        const output = valid(transported);
        mutate(output.classifications);
        return output;
      }).classifyCompetitors(input),
      /competitor_classification_invalid/,
    );
  });
