import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import { previewCommercialCreate } from "../../scripts/lib/ui-phase2-commercial-create-preview.mjs";

const component = "apps/web/src/components/CommercialOperationsCenter.vue";
const root = "output/playwright/p58-create-current-review";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = read(component),
  preview = previewCommercialCreate(source);
function directives(text) {
  const entries = [];
  function visit(node) {
    if (node.type === 1) {
      for (const p of node.props.filter((p) => p.type === 7))
        entries.push([
          node.tag,
          p.name,
          p.arg?.content ?? null,
          p.exp?.content ?? null,
          p.modifiers.map((m) => m.content),
        ]);
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(text).descriptor.template.content));
  return entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
test("P58 creation review compiles and preserves full script, styles and all existing directive contracts", () => {
  const before = parse(source),
    after = parse(preview);
  assert.deepEqual(after.errors, []);
  assert.equal(after.descriptor.scriptSetup.content, before.descriptor.scriptSetup.content);
  const styles = (descriptor) =>
    descriptor.styles.map(({ content, attrs }) => ({ content, attrs }));
  assert.deepEqual(styles(after.descriptor), styles(before.descriptor));
  assert.deepEqual(directives(preview), directives(source));
  compileScript(after.descriptor, { id: "p58" });
  assert.deepEqual(
    compileTemplate({ source: after.descriptor.template.content, filename: component, id: "p58" })
      .errors,
    [],
  );
});
test("P58 only the create dialog changes; code alphabet encoding changes without broadening its intended pattern", () => {
  const exclude = (text) =>
    text.replace(
      /<dialog (?:class="p58-draft-c" )?ref="createDialogElement"[\s\S]*?<\/dialog>/,
      "CREATE_DIALOG",
    );
  assert.equal(exclude(preview), exclude(source));
  assert.equal((preview.match(/v-model(?:\.number)?="plan\./g) ?? []).length, 7);
  assert.ok(preview.includes('pattern="[a-z0-9][a-z0-9_\\-]{0,79}"'));
  const legacy = /^[a-z0-9][a-z0-9_-]{0,79}$/;
  const htmlV = new RegExp("^(?:[a-z0-9][a-z0-9_\\-]{0,79})$", "v");
  for (const value of [
    "a",
    "basic_2026",
    "basic-2026",
    "A",
    "bad code",
    "_bad",
    "",
    "a".repeat(80),
    "a".repeat(81),
    "中文",
    "a/b",
  ])
    assert.equal(htmlV.test(value), legacy.test(value), value);
  assert.throws(() =>
    previewCommercialCreate(source.replace('v-model="plan.reason"', 'v-model="other.reason"')),
  );
});
test("P58 creation CSS is restricted to the local review dialog", () => {
  postcss
    .parse(read("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css"))
    .walkRules((rule) => {
      for (const selector of rule.selectors) {
        assert.ok(selector.replace(/\s+/g, " ").startsWith("body.p58-draft-review "));
        assert.ok(selector.includes(".p58-draft-c"));
      }
      assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
    });
});
test("P58 actual Vue creation evidence binds raw sources and complete continuous dialog images", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CREATE-CURRENT-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 6);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    114,
  );
  assert.equal(e.screenshots.length, 24);
  assert.equal(Object.keys(e.sourceHashes).length, 162);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(value("seven original fields"), 7);
    assert.equal(value("three original buttons"), 3);
    for (const name of [
      "native modal open",
      "forward returns within three native stops",
      "reverse returns within three native stops",
      "escape returns focus",
      "cancel returns focus",
      "no dialog horizontal overflow",
    ])
      assert.equal(value(name), true, name);
    assert.equal(value("one commercial GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.deepEqual(
      value("native forward focus path"),
      run.mode === "review" ? ["BODY", "DIALOG", "BUTTON"] : ["BODY", "BUTTON"],
    );
    assert.deepEqual(
      value("native reverse focus path"),
      run.mode === "review" ? ["DIALOG", "BODY", "BUTTON"] : ["BODY", "BUTTON"],
    );
    if (run.mode === "review")
      assert.deepEqual(value("intended code alphabet enforced"), [
        false,
        false,
        false,
        true,
        true,
        true,
      ]);
    for (const prefix of ["empty-part", "filled-part", "submit-focus"])
      assert.ok(
        e.screenshots.some(
          (s) => s.mode === run.mode && s.width === run.width && s.suffix.startsWith(prefix),
        ),
      );
  }
  for (const width of [390, 760, 1440]) {
    const pair = e.runs.filter((run) => run.width === width);
    assert.equal(
      pair[0].backgroundSha256,
      pair[1].backgroundSha256,
      `unchanged background ${width}`,
    );
  }
});
