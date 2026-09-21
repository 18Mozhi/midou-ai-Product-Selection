import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import {
  previewShellVue,
  shellReviewImport,
  shellReviewSetup,
  shellReviewCss,
} from "../../scripts/lib/ui-phase2-shell-vue-preview.mjs";

const file = "apps/web/src/components/NavigationShell.vue";
const source = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");

test("C shell preview retains every production script statement except two explicit preview additions", () => {
  const actual = parse(source).descriptor;
  const review = parse(previewShellVue(source)).descriptor;
  assert.equal(
    review.scriptSetup.content.replace(shellReviewImport, "").replace(shellReviewSetup, ""),
    actual.scriptSetup.content,
  );
  const styles = (descriptor) => descriptor.styles.map(({ loc, ...style }) => style);
  assert.deepEqual(styles(review), styles(actual));
  const script = compileScript(review, { id: "shell-preview" });
  assert.deepEqual(
    compileTemplate({
      source: review.template.content,
      filename: file,
      id: "shell-preview",
      compilerOptions: { bindingMetadata: script.bindings },
    }).errors,
    [],
  );
});

test("C shell preview does not grant capabilities, replace page surfaces or rename action targets", () => {
  const review = previewShellVue(source);
  for (const expression of [
    /:to="[\s\S]*?"/g,
    /\bto="[^"\n]+"/g,
    /v-(?:if|else-if|show)="[^"\n]+"/g,
  ]) {
    const before = source.match(expression) ?? [];
    const after = review.match(expression) ?? [];
    if (expression.source.includes("else-if")) {
      assert.deepEqual(
        after.filter((item) => item !== 'v-if="reviewCompact"'),
        before,
      );
    } else assert.deepEqual(after, before);
  }
  assert.equal(review.match(/<KeepAlive/g)?.length, 1);
  assert.equal(review.match(/id="role-navigation"/g)?.length, 1);
  assert.ok(!review.includes("SIGNAL LEDGER"));
  assert.ok(!review.includes("已连接 · 可复核"));
  assert.ok(review.includes('@cancel.prevent="menuOpen = false"'));
});

test("C shell review fails closed on anchor drift and is never loaded by production", async () => {
  assert.throws(() => previewShellVue(source.replace('class="role-shell"', 'class="renamed"')));
  assert.throws(() => previewShellVue(previewShellVue(source)));
  assert.ok(!source.includes("shell-review-navigation"));
  assert.ok(!source.includes("shell-vue-c-preview"));
  const css = await readFile(shellReviewCss, "utf8");
  assert.ok(css.startsWith("/* Review-only"));
  assert.ok(css.includes("html body.shell-vue-c:has(#app) #app .role-shell.role-shell--review"));
  assert.match(css, /\.role-navigation-frame:not\(\[open\]\)\s*\{\s*display: none;\s*\}/);
  assert.ok(!css.includes("!important"));
});

test("platform C r2 proof binds current sources, all images and baseline menu parity without approval", async () => {
  const root = "output/playwright/shell-vue-c-platform-r2";
  const evidence = JSON.parse(await readFile(`${root}/evidence.json`, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(evidence.kind, "SHELL-VUE-C-PLATFORM-r2");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.userReview, "pending");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 6);
  assert.equal(
    evidence.runs.reduce((total, run) => total + run.checks.length, 0),
    88,
  );
  assert.equal(evidence.screenshots.length, 18);
  assert.equal(Object.keys(evidence.sourceHashes).length, 177);
  for (const [file, sha] of Object.entries(evidence.sourceHashes)) {
    assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
  }
  for (const shot of evidence.screenshots) {
    const bytes = await readFile(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  const before = evidence.runs.find((run) => run.mode === "baseline").expectedMenu;
  for (const run of evidence.runs) {
    assert.deepEqual(run.expectedMenu, before);
    assert.ok(
      run.requests.every((request) => request.key.startsWith("GET ") && request.body === null),
    );
    if (run.mode === "review")
      assert.equal(
        run.checks.find(
          (check) => check.name === "content is beside navigation and visible in first viewport",
        )?.actual,
        true,
      );
  }
});
