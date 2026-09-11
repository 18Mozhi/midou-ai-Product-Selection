import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewProviderSourcesStates,
  sourceStateCopy,
} from "../../scripts/lib/ui-phase2-provider-sources-states-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  root = "output/playwright/p48-source-states-review";

test("P48 source-state review transforms the actual component and still compiles", () => {
  const source = read(component),
    review = previewProviderSourcesStates(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-source-states" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-source-states",
    }).errors,
    [],
  );
  for (const marker of [
    "p48-source-state-host",
    "p48-source-state-panel",
    "p48-source-state-eyebrow",
    "p48-source-state-description",
    "p48-source-state-technical",
    "p48-source-state-primary",
    "handleSourceStatePrimary",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
  assert.ok(review.includes("v-if=\"message && state === 'ready'\""));
  assert.ok(review.includes("v-if=\"state === 'ready'\""));
  assert.ok(review.includes('void router.push("/login")'));
});

test("P48 source-state copy stays factual, actionable, and gentle", () => {
  assert.deepEqual(Object.keys(sourceStateCopy), [
    "loading",
    "empty",
    "expired",
    "forbidden",
    "blocked",
    "error",
  ]);
  assert.equal(sourceStateCopy.loading.description.includes("进度"), false);
  assert.equal(sourceStateCopy.empty.description.includes("成功读取"), true);
  assert.equal(sourceStateCopy.expired.description.includes("重新登录"), true);
  assert.equal(
    sourceStateCopy.forbidden.description,
    "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
  );
  assert.equal(sourceStateCopy.blocked.title, "来源目录暂时不可用");
  assert.equal(sourceStateCopy.error.title, "来源目录未能读取");
});

test("P48 source-state CSS is isolated and preserves keyboard visibility", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-states-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p48-source-state-review"), selector);
      assert.ok(selector.includes(".source-center"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 source-state evidence binds seven states, recovery, and every image", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-STATES-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 28);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    388,
  );
  assert.equal(evidence.screenshots.length, 34);
  assert.equal(Object.keys(evidence.sourceHashes).length, 65);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, shot.file);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, shot.file);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(
      value("safe initial attempts"),
      ["rate-limited", "dependency"].includes(run.scene) ? 3 : 1,
    );
    assert.equal(value("state hides irrelevant directory chrome"), 0);
    assert.equal(value("no duplicated global message"), 0);
    assert.equal(value("one state heading"), 1);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "loading") {
      assert.equal(value("loading has no fabricated action"), 0);
      assert.equal(value("loading completes with original GET"), 1);
    } else if (run.scene === "expired") {
      assert.equal(value("expired reaches verified login route"), "/login");
      assert.equal(value("expired adds no source GET"), 1);
    } else {
      assert.equal(value("one visible recovery action"), 1);
      assert.equal(value("recovery action44"), true);
      assert.equal(
        value("one explicit recovery GET"),
        ["rate-limited", "dependency"].includes(run.scene) ? 4 : 2,
      );
      assert.equal(value("recovery restores full result count"), "找到 146 个来源");
    }
  }
});
