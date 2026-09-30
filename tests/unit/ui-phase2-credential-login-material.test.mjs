import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { credentialHistoricalCapture } from "../../scripts/lib/ui-phase2-credential-historical-capture.mjs";
import { previewCredentialLoginMaterial } from "../../scripts/lib/ui-phase2-credential-login-material-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/CredentialAssetCenter.vue",
  cssFile =
    "design-plans/ui-phase-2-2026-09-07/implementation/credential-login-material-preview.css",
  root = "output/playwright/p50-credential-login-material-review";

test("P50 material review wraps and compiles the lifecycle-safe login editor", () => {
  const source = read(component),
    review = previewCredentialLoginMaterial(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p50-login-material" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p50-login-material",
    }).errors,
    [],
  );
  assert.equal(source.includes("loginMaterialBusy"), true);
  assert.equal(source.includes("p50-login-material-scroll"), false);
  assert.ok(source.includes('class="login-material-scroll"'));
  assert.ok(source.includes(":data-tone="));
  for (const marker of [
    "loginMaterialBusy",
    "p50-login-material-scroll",
    ':aria-busy="writeBusy || loginMaterialBusy"',
    '{{ loginMaterialBusy ? "读取中…" : "从当前浏览器读取 Cookie" }}',
    "loginSaveStage === 'unknown'",
    ':data-tone="',
  ])
    assert.ok(review.includes(marker), marker);
  assert.ok(source.includes("generation !== loginMaterialGeneration"));
  assert.ok(source.includes("resetLoginMaterialContext"));
  assert.ok(source.includes("写入结果暂时无法确认"));
  assert.ok(review.includes("取消</button"));
});

test("P50 production login material wrapper keeps status inside the scroll area and footer outside", () => {
  const source = read(component),
    css = read("apps/web/src/credential-assets-page-c.css");
  const scrollStart = source.indexOf('<div class="login-material-scroll">'),
    status = source.indexOf(":data-tone=", scrollStart),
    scrollEnd = source.indexOf("</div>\n          <footer>", scrollStart),
    footer = source.indexOf("<footer>", scrollStart);
  assert.ok(scrollStart >= 0);
  assert.ok(status > scrollStart);
  assert.ok(scrollEnd > status);
  assert.ok(footer > scrollEnd);
  assert.ok(css.includes(".login-material-scroll"));
  assert.ok(css.includes('[data-tone="pending"]'));
  assert.ok(css.includes('[data-tone="ready"]'));
  assert.ok(css.includes('[data-tone="warning"]'));
  assert.equal(css.includes("p50-credential-material-review"), false);
  assert.equal(css.includes(".p50-login-material-scroll"), false);
});

test("P50 material feedback CSS is isolated, responsive and reduced-motion safe", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p50-credential-material-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(".p50-login-material-scroll"));
  assert.ok(text.includes("grid-template-rows: auto minmax(0, 1fr) auto"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (prefers-reduced-motion: reduce)"));
  assert.equal(text.includes("transition: all"), false);
  assert.equal(text.includes("outline: none"), false);
});

test("P50 material evidence binds six safe states at four widths", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-LOGIN-MATERIAL-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.deepEqual(evidence.states, [
    "cookie-ready",
    "cookie-invalid",
    "browser-pending",
    "browser-success",
    "browser-empty",
    "archive-ready",
  ]);
  assert.equal(evidence.runs.length, 24);
  assert.equal(evidence.screenshots.length, 24);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 50);
  const historical = credentialHistoricalCapture("login-material");
  assert.equal(historical.evidence.kind, evidence.kind);
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
    assert.equal(value("initial source identity"), "登录页来源");
    assert.equal(value("three credential data GETs"), 3);
    assert.equal(value("all network requests are GET without bodies"), true);
    assert.equal(value("material values never render"), true);
    assert.equal(value("no material persistence"), true);
    assert.equal(value("no browser cookies created"), 0);
    for (const control of ["source", "mode", "cancel", "save"])
      assert.equal(value(`target44 ${control}`), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("footer actions remain in viewport"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (["cookie-ready", "browser-success", "archive-ready"].includes(run.state))
      assert.equal(value("save enabled"), true);
    else assert.equal(value("save remains disabled"), true);
    if (run.state === "browser-pending") {
      assert.equal(value("source locked while reading"), true);
      assert.equal(value("mode locked while reading"), true);
      assert.equal(value("cancel remains available"), true);
    }
  }
});
