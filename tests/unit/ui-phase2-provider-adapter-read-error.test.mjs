import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewAdapterReadError,
  readErrorTitle,
  readErrorDescription,
} from "../../scripts/lib/ui-phase2-adapter-read-error-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const root = "output/playwright/p47-read-error-review";
const evidence = () => JSON.parse(read(`${root}/evidence.json`));

test("P47 read-error proposal only supplies two error-specific presentation props", () => {
  const original = read(component),
    review = previewAdapterReadError(original);
  const additions =
    `      :title="state === 'error' ? '${readErrorTitle}' : ''"\n` +
    `      :description="state === 'error' ? '${readErrorDescription}' : ''"\n`;
  assert.equal(review.replace(additions, ""), original);
  const parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  assert.equal(
    parsed.descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-read-error",
    }).errors,
    [],
  );
  assert.throws(() =>
    previewAdapterReadError(original.replace(':kind="state"', ':kind="changed"')),
  );
  assert.throws(() => previewAdapterReadError(original + '\n      :kind="state"\n'));
  assert.ok(!original.includes(readErrorTitle));
});

test("P47 read-error visual rules cannot target other state panels or production pages", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-read-error-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(selector.includes('.ui-state-panel[data-kind="error"]'));
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 read-error actual Vue review binds raw sources, all pictures and unchanged neighboring states", () => {
  const e = evidence();
  assert.equal(e.reviewOnly, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 30);
  assert.equal(e.screenshots.length, 30);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  assert.equal(e.comparisons.length, 6);
  for (const comparison of e.comparisons) {
    assert.equal(comparison.sameSize, true);
    assert.ok(comparison.changedPixels <= 8);
    assert.ok(comparison.maxChannelDelta <= 1);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((c) => c.name === name)?.actual;
    const initialReads = run.scene === "blocked-unchanged" ? 3 : 1;
    assert.equal(value("original initial GET attempt count"), initialReads);
    assert.equal(value("explicit retry alone adds one GET"), initialReads + 1);
    assert.equal(value("no probe writes"), 0);
    assert.equal(value("keyboard retry target fits"), true);
    assert.equal(value("no page or panel horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
  }
});
