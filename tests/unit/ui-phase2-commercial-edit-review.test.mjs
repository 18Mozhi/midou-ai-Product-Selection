import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import { previewCommercialEdit } from "../../scripts/lib/ui-phase2-commercial-edit-preview.mjs";

const component = "apps/web/src/components/CommercialOperationsCenter.vue";
const root = "output/playwright/p58-edit-current-review";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const source = read(component),
  preview = previewCommercialEdit(source);
function contracts(text) {
  const directives = [],
    fields = [];
  function walk(node) {
    if (node.type === 1) {
      for (const p of node.props.filter((p) => p.type === 7))
        directives.push([
          node.tag,
          p.name,
          p.arg?.content ?? null,
          p.exp?.content ?? null,
          p.modifiers.map((m) => m.content),
        ]);
      if (["input", "textarea", "select", "option", "button"].includes(node.tag))
        fields.push([
          node.tag,
          node.props
            .filter((p) => p.type === 6 && !p.name.startsWith("aria-"))
            .map((p) => [p.name, p.value?.content ?? null]),
        ]);
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(baseParse(parse(text).descriptor.template.content));
  return { directives, fields };
}
test("P58 edit proposal compiles, preserves whole script/styles/directives and original field constraints", () => {
  const before = parse(source),
    after = parse(preview);
  assert.deepEqual(after.errors, []);
  assert.equal(after.descriptor.scriptSetup.content, before.descriptor.scriptSetup.content);
  const styles = (d) => d.styles.map(({ content, attrs }) => ({ content, attrs }));
  assert.deepEqual(styles(after.descriptor), styles(before.descriptor));
  assert.deepEqual(contracts(preview), contracts(source));
  compileScript(after.descriptor, { id: "p58-edit" });
  assert.deepEqual(
    compileTemplate({
      source: after.descriptor.template.content,
      filename: component,
      id: "p58-edit",
    }).errors,
    [],
  );
  const exclude = (text) =>
    text.replace(
      /<dialog (?:class="p58-revise-c" )?ref="planDialogElement"[\s\S]*?<\/dialog>/,
      "EDIT_DIALOG",
    );
  assert.equal(exclude(preview), exclude(source));
  assert.throws(() =>
    previewCommercialEdit(source.replace("保存新版本</button>", "different</button>")),
  );
});
test("P58 edit help is associated but not included in existing field names; C CSS is locally scoped", () => {
  const dialog = preview.match(/<dialog class="p58-revise-c"[\s\S]*?<\/dialog>/)[0];
  assert.match(dialog, /基于版本 {{ editingPlan.expected_version }}/);
  assert.match(dialog, /确认执行后才会保存/);
  assert.match(dialog, /取消影响预览会关闭本次修改，不会返回编辑窗/);
  assert.match(dialog, /预览修改影响<\/button>/);
  for (const id of ["name", "description", "quota", "reason"]) {
    assert.ok(dialog.includes(`aria-describedby="p58-revise-${id}-help"`));
    assert.equal(dialog.split(`id="p58-revise-${id}-help"`).length, 2);
  }
  assert.doesNotMatch(dialog.match(/<label>名称[\s\S]*?<\/label>/)[0], /<small/);
  assert.equal((dialog.match(/<button\b/g) ?? []).length, 2);
  postcss
    .parse(read("design-plans/ui-phase-2-2026-09-07/implementation/commercial-edit-preview.css"))
    .walkRules((rule) => {
      for (const selector of rule.selectors) {
        assert.ok(selector.replace(/\s+/g, " ").startsWith("body.p58-revise-review "));
        assert.ok(selector.includes(".p58-revise-c"));
      }
      assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
    });
});
test("P58 edit browser packet binds current raw sources, untouched background, continuous images and no writes", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-EDIT-CURRENT-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 6);
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    168,
  );
  assert.equal(e.screenshots.length, 33);
  assert.equal(Object.keys(e.sourceHashes).length, 163);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  for (const file of [
    component,
    "scripts/verify-ui-phase2-commercial-edit.mjs",
    "scripts/lib/ui-phase2-commercial-edit-preview.mjs",
    "apps/web/src/use-modal-dialog.ts",
  ])
    assert.ok(e.sourceHashes[file], file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
    assert.equal(shot.geometry.modal, true);
    assert.ok(shot.geometry.y >= 0 && shot.geometry.y + shot.geometry.height <= 901);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(value("seven original fields"), 7);
    assert.equal(value("two original buttons"), 2);
    assert.equal(value("one commercial GET"), 1);
    for (const name of [
      "native modal open",
      "initial name focus unchanged",
      "no dialog horizontal overflow",
      "original reason2 native restriction",
      "quota native rangeUnderflow",
      "quota native rangeOverflow",
      "quota native stepMismatch",
      "edited form remains valid",
      "existing impacted organization count retained",
      "reopen restores persisted sample not canceled edits",
      "edit Escape returns trigger",
      "edit cancel returns trigger",
      "no writes or bodies",
    ]) {
      if (name === "reopen restores persisted sample not canceled edits")
        assert.deepEqual(value(name), value("original field values"));
      else assert.equal(value(name), true, name);
    }
    assert.equal(value("cancel preview closes both dialogs"), 0);
    assert.equal(value("preview has no write"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    for (const suffix of ["initial", "reason-invalid", "filled", "original-impact"]) {
      const frames = e.screenshots
        .filter((s) => s.mode === run.mode && s.width === run.width && s.suffix === suffix)
        .sort((a, b) => a.part - b.part);
      assert.ok(frames.length > 0);
      assert.equal(frames[0].geometry.scrollTop, 0);
      let bottom = 0;
      for (const frame of frames) {
        assert.ok(frame.geometry.scrollTop <= bottom);
        bottom = frame.geometry.scrollTop + frame.geometry.clientHeight;
      }
      assert.ok(bottom >= frames.at(-1).geometry.scrollHeight - 1);
    }
  }
  for (const width of [390, 760, 1440]) {
    const pair = e.runs.filter((r) => r.width === width);
    assert.equal(pair.length, 2);
    assert.ok(pair.every((run) => /^[a-f0-9]{64}$/.test(run.backgroundSha256)));
  }
});
