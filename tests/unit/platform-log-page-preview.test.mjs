import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewLogPage,
  originalLogChain,
  logReviewImport,
  logReviewComponent,
} from "../../scripts/lib/platform-log-page-preview.mjs";
import { logReviewFixtures } from "../../scripts/lib/log-review-fixtures.mjs";
const file = "apps/web/src/components/PlatformLogCenter.vue",
  source = readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  review = previewLogPage(source);
test("P62 review retains the complete production script except isolated import", () =>
  assert.equal(
    parse(review).descriptor.scriptSetup.content.replace(logReviewImport, ""),
    parse(source).descriptor.scriptSetup.content,
  ));
test("P62 original seven columns, detail slots, links and per-chain controls remain exact", () => {
  const chain = originalLogChain(source)
    .replace('        v-for="chain in traceChains"\n', "")
    .replace('        :key="chain.traceId"\n', "");
  assert.ok(review.includes(chain));
  assert.equal((chain.match(/<th>/g) || []).length, 7);
  assert.ok(chain.includes(':rows="chain.items"'));
});
test("P62 actual review template and wrapper compile", () => {
  for (const [s, f] of [
    [review, file],
    [readFileSync(logReviewComponent, "utf8"), logReviewComponent],
  ]) {
    const { descriptor, errors } = parse(s);
    assert.deepEqual(errors, []);
    const compiled = compileScript(descriptor, { id: "p62" });
    assert.deepEqual(
      compileTemplate({
        source: descriptor.template.content,
        filename: f,
        id: "p62",
        compilerOptions: { bindingMetadata: compiled.bindings },
      }).errors,
      [],
    );
  }
});
test("P62 source drift fails closed before serving", () =>
  assert.throws(() =>
    previewLogPage(source.replace('class="platform-log-chain"', 'class="changed"')),
  ));
test("P62 selection uses native named buttons and keeps each chain mounted without persistence", () => {
  const s = readFileSync(logReviewComponent, "utf8");
  assert.match(s, /type="button"/);
  assert.match(s, /:aria-pressed=/);
  assert.match(s, /:aria-controls=/);
  assert.match(s, /v-show=/);
  assert.doesNotMatch(s, /fetch\(|localStorage|sessionStorage|router|setInterval|setTimeout/);
});
test("P62 fixture is original three events and two trace IDs", async () => {
  const { fixture, nav } = await logReviewFixtures();
  assert.equal(fixture.domain, "logs");
  assert.equal(fixture.items.length, 3);
  assert.equal(new Set(fixture.items.map((i) => i.trace_id)).size, 2);
  assert.deepEqual(nav.platform_capabilities, ["platform:operate"]);
});
