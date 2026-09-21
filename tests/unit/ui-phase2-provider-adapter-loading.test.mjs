import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewAdapterLoading,
  loadingTitle,
  loadingDescription,
} from "../../scripts/lib/ui-phase2-adapter-loading-preview.mjs";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const root = "output/playwright/p47-loading-review";
const captured = (file) =>
  execFileSync("git", ["show", `255f03f949ebbb27b7714818ee1ce0c458513877:${file}`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");

test("P47 loading proposal adds only two loading-specific props without changing runtime", () => {
  const original = read(component),
    review = previewAdapterLoading(original);
  const additions =
    `      :title="state === 'loading' ? '${loadingTitle}' : ''"\n` +
    `      :description="state === 'loading' ? '${loadingDescription}' : ''"\n`;
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
      id: "p47-loading",
    }).errors,
    [],
  );
  assert.throws(() => previewAdapterLoading(original.replace(':kind="state"', ':kind="other"')));
  assert.throws(() => previewAdapterLoading(original + '\n      :kind="state"\n'));
  assert.ok(!original.includes(loadingTitle));
});

test("P47 loading rules remain scoped to review body, active P47 and loading only", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-loading-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-loading-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(selector.includes('.ui-state-panel[data-kind="loading"]'));
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 archived loading evidence binds its complete captured manifest, sources and images", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.deepEqual(e, JSON.parse(captured(`${root}/evidence.json`)));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 24);
  assert.equal(e.screenshots.length, 48);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(captured(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${root}/${s.file}`);
    assert.equal(hash(bytes), s.sha256);
    assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
  }
  for (const r of e.runs) {
    const value = (name) => r.checks.find((c) => c.name === name)?.actual;
    assert.equal(value("pending disables duplicate refresh"), true);
    assert.equal(value("settlement preserves chosen focus"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("no automatic extra read"), r.scene === "initial" ? 1 : 2);
    assert.equal(value("no write requests"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (r.scene === "initial") {
      assert.equal(value("busy announcement"), "true");
      assert.equal(value("polite announcement"), "polite");
      assert.equal(value("no invented data while initial read pending"), 0);
    } else {
      assert.equal(value("refresh retains filtered snapshot"), "1 个结果");
      assert.equal(value("settlement retains query"), "公开趋势");
      if (r.outcome === "error")
        assert.equal(value("refresh failure does not discard snapshot"), 0);
    }
  }
});
