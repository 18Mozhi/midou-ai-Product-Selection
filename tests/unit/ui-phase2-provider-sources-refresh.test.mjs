import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewProviderSourcesRefresh,
  refreshCopy,
} from "../../scripts/lib/ui-phase2-provider-sources-refresh-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  root = "output/playwright/p48-source-refresh-review";

test("P48 refresh review transforms the actual component and still compiles", () => {
  const source = read(component),
    review = previewProviderSourcesRefresh(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-source-refresh" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-source-refresh",
    }).errors,
    [],
  );
  for (const marker of [
    "refreshFeedback",
    "refreshFailureKind",
    "handleSourceRefresh",
    "p48-source-refresh-host",
    "p48-source-refresh-feedback",
    "p48-source-refresh-technical",
    "p48-source-refresh-primary",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
  assert.ok(review.includes('["expired", "forbidden"].includes(refreshFailureKind.value)'));
  assert.equal(review.includes('router.push("/login")'), false);
});

test("P48 refresh copy distinguishes progress, success, blocked, and error", () => {
  assert.deepEqual(Object.keys(refreshCopy), ["refreshing", "success", "blocked", "error"]);
  assert.equal(refreshCopy.refreshing.title, "正在更新来源目录");
  assert.equal(refreshCopy.success.title, "来源目录已更新");
  assert.equal(refreshCopy.blocked.title, "来源目录暂时未能更新");
  assert.equal(refreshCopy.error.title, "最新目录未能更新");
});

test("P48 refresh CSS is isolated and preserves keyboard visibility", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-refresh-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p48-source-refresh-review"), selector);
      assert.ok(selector.includes(".source-center"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 refresh evidence binds preserved data, retries, focus, and every image", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-REFRESH-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 20);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    328,
  );
  assert.equal(evidence.screenshots.length, 27);
  assert.equal(Object.keys(evidence.sourceHashes).length, 64);
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
    assert.equal(value("initial catalog GET"), 1);
    assert.equal(value("pending keeps20 records"), 20);
    assert.equal(value("pending keeps146 result count"), "找到 146 个来源");
    assert.equal(value("pending has no stale request ID"), 0);
    assert.equal(value("pending starts one refresh GET"), 2);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "success") {
      assert.equal(value("success hides duplicate global message"), 0);
      assert.equal(value("success uses one refresh GET"), 2);
      assert.equal(value("success keeps20 records"), 20);
    } else {
      assert.equal(value("failure keeps20 records"), 20);
      assert.equal(value("failure keeps146 result count"), "找到 146 个来源");
      assert.equal(value("failure hides duplicate global message"), 0);
      assert.equal(value("failure hides duplicate header refresh"), false);
      assert.equal(value("failure action44"), true);
      assert.equal(
        value("failure attempts follow current safe retry"),
        ["rate-limited", "dependency"].includes(run.scene) ? 5 : 3,
      );
      assert.equal(value("recovery restores146 result count"), "找到 146 个来源");
      if (run.scene === "timeout") assert.equal(value("timeout has no stale request ID"), 0);
    }
  }
});
