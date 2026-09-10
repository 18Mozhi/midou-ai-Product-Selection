import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const output = "output/playwright/p36-read-states-review";
const design = "design-plans/ui-phase-2-2026-09-07/design/org-token-read-states";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const e = JSON.parse(await text(`${output}/evidence.json`));
const kinds = ["loading", "error", "forbidden", "expired", "conflict", "rate_limited", "blocked"];

test("P36 read-state source and original726 images are preserved", async () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(await text(file)), sha, file);
  let count = 0;
  for (const [dir, old] of Object.entries(e.retained)) {
    const raw = await text(`${dir}/evidence.json`);
    assert.equal(hash(raw), old.manifest, dir);
    const manifest = JSON.parse(raw);
    assert.equal(manifest.screenshots.length, old.pngCount);
    for (const image of manifest.screenshots)
      assert.equal(hash(await readFile(`${dir}/${image.file}`)), image.sha256);
    count += old.pngCount;
  }
  assert.equal(count, 726);
});

test("P36 read-region matrix covers14 phases and50 current images without extras", async () => {
  assert.deepEqual(
    e.scenes.map((s) => s.id).sort(),
    kinds.flatMap((k) => [`initial-${k}`, `background-${k}`]).sort(),
  );
  const names = [
    ...e.scenes.map((s) => `scene-${s.id}`),
    "panel-permission",
    ...["refresh", "retry"].flatMap((c) =>
      ["default", "hover", "focus", "pressed"].map((s) => `control-${c}-${s}`),
    ),
    "trace-focus",
    "trace-open",
  ];
  assert.deepEqual(
    e.screenshots.map((s) => s.file).sort(),
    [390, 1440].flatMap((w) => names.map((n) => `${n}-${w}.png`)).sort(),
  );
  assert.equal(e.screenshots.length, 50);
  for (const s of e.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    (await readdir(output)).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
});

test("P36 read bindings preserve real initial/background replacement distinction", () => {
  assert.equal(e.bindings.length, 14);
  for (const s of e.scenes) {
    const binding = e.bindings.find((b) => b.scene === s.id);
    const pending = s.kind === "loading",
      retained = s.phase === "background" && !["expired", "forbidden"].includes(s.kind);
    assert.equal(binding.retained, retained);
    assert.equal(
      binding.refresh,
      pending ? "OG-REFRESH:disabled" : "OG-REFRESH:load({background:true})",
    );
    assert.equal(binding.retry, !pending && !retained ? "OG-RETRY:load()" : null);
    assert.equal(binding.trace, pending ? null : "native details proposal only");
  }
});

test("P36442 browser checks cover actual keyboard/native states and inert read controls", () => {
  assert.equal(e.checks.length, 442);
  for (const width of [390, 1440]) {
    const names = new Set(e.checks.filter((c) => c.width === width).map((c) => c.name));
    assert.equal(names.size, 221);
    for (const scene of e.scenes) {
      assert.ok(names.has(`${scene.id} retained content follows actual parent`));
      assert.ok(names.has(`${scene.id} controls at least44`));
      assert.ok(names.has(`${scene.id} no duplicate alert`));
      assert.ok(
        names.has(
          `${scene.id} ${scene.kind === "loading" ? "disabled native click does nothing" : "exact read-only intentions"}`,
        ),
      );
    }
    for (const name of [
      "refresh native keyboard outline",
      "retry native keyboard outline",
      "trace open native details state",
      "zero external requests",
      "zero cookies",
      "zero storage",
      "zero browser errors",
    ])
      assert.ok(names.has(name), name);
  }
});

test("P36 new read designs remain proposals, never permission or whole-page approval", async () => {
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.browserClosed, true);
  assert.match(e.boundary, /No actual Vue implementation/);
  for (const s of e.screenshots) {
    assert.equal(s.approval, "pending-user-review");
    assert.match(s.scope, /not actual Vue or production acceptance/);
  }
  const js = await text(`${design}/read-states.js`),
    html = await text(`${output}/index.html`);
  assert.doesNotMatch(
    js,
    /\bfetch\s*\(|XMLHttpRequest|navigator\.clipboard|localStorage|sessionStorage/,
  );
  assert.match(js, /当前权限还不能读取这些内容/);
  assert.match(js, /本次不展示令牌列表、创建表单或令牌明文/);
  assert.match(html, /全部待审核，不是实际Vue或权限验收/);
  assert.equal((html.match(/<img /g) ?? []).length, 50);
});
