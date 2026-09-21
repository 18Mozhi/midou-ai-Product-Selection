import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import {
  previewCommercialConfirm,
  commercialConfirmScenarios,
  commercialConfirmSample,
} from "../../scripts/lib/ui-phase2-commercial-confirm-preview.mjs";

const component = "apps/web/src/components/CommercialOperationsCenter.vue",
  root = "output/playwright/p58-confirm-current-review";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (data) => createHash("sha256").update(data).digest("hex");
const source = read(component),
  preview = previewCommercialConfirm(source);
function directives(source) {
  const rows = [];
  function visit(node) {
    if (node.type === 1)
      for (const p of node.props.filter((p) => p.type === 7))
        rows.push([
          node.tag,
          p.name,
          p.arg?.content ?? null,
          p.exp?.content ?? null,
          p.modifiers.map((m) => m.content),
        ]);
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(source).descriptor.template.content));
  return rows;
}
test("P58 confirmation compiles with unchanged complete script/styles and original action directives", () => {
  const before = parse(source),
    after = parse(preview);
  assert.deepEqual(after.errors, []);
  assert.equal(after.descriptor.scriptSetup.content, before.descriptor.scriptSetup.content);
  const styles = (d) => d.styles.map(({ content, attrs }) => ({ content, attrs }));
  assert.deepEqual(styles(after.descriptor), styles(before.descriptor));
  compileScript(after.descriptor, { id: "p58-confirm" });
  assert.deepEqual(
    compileTemplate({
      source: after.descriptor.template.content,
      filename: component,
      id: "p58-confirm",
    }).errors,
    [],
  );
  const withoutNewReads = preview
    .replace(
      /<!-- P58 review submission facts start -->[\s\S]*?<!-- P58 review submission facts end -->/,
      "",
    )
    .replace(/<p v-if="!pending.impact.rows.length"[\s\S]*?<\/p>/, "");
  assert.deepEqual(directives(withoutNewReads), directives(source));
  const outside = (s) =>
    s.replace(
      /<dialog (?:class="p58-impact-c" )?ref="confirmDialogElement"[\s\S]*?<\/dialog>/,
      "CONFIRM_DIALOG",
    );
  assert.equal(outside(preview), outside(source));
  assert.throws(() =>
    previewCommercialConfirm(source.replace("{{ row.before }}", "{{ changed }}")),
  );
});
test("P58 confirmation read-only facts do not invent versions, comparison rows or submit controls", () => {
  const dialog = preview.match(/<dialog class="p58-impact-c"[\s\S]*?<\/dialog>/)[0];
  assert.equal((dialog.match(/<button\b/g) ?? []).length, 2);
  assert.doesNotMatch(dialog, /<input|<textarea|<select/);
  assert.match(
    dialog,
    /pending.body.expected_version !== undefined && pending.body.expected_version !== null/,
  );
  assert.match(dialog, /本次未提供逐项前后值/);
  assert.doesNotMatch(dialog, /没有变化|无变化|没有影响/);
  assert.match(dialog, /请求携带的版本/);
  assert.match(dialog, /pending.body.reason/);
  assert.match(dialog, /<small>变更前<\/small>{{ row.before }}/);
  assert.match(dialog, /<small>变更后<\/small>{{ row.after }}/);
  postcss
    .parse(read("design-plans/ui-phase-2-2026-09-07/implementation/commercial-confirm-preview.css"))
    .walkRules((rule) => {
      for (const selector of rule.selectors) {
        assert.ok(selector.replace(/\s+/g, " ").startsWith("body.p58-impact-review "));
        assert.ok(selector.includes(".p58-impact-c"));
      }
      assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
    });
});
test("P58 fixture variations are explicit, cloned and limited to three local display branches", () => {
  const sample = {
    plans: [{ status: "active", name: "original" }],
    summary: { total: 1, active: 1, draft: 0, retired: 0 },
    assignment: { status: "active" },
    adjustments: [{ id: "original" }],
    adjustment_pagination: { page: 1, total: 1, total_pages: 1 },
    usage: { a: 2 },
    effective_quotas: { a: 3 },
  };
  const serialized = JSON.stringify(sample);
  assert.equal(commercialConfirmScenarios.length, 10);
  for (const scenario of commercialConfirmScenarios) {
    const result = commercialConfirmSample(sample, scenario);
    assert.notEqual(result, sample);
    if (!["activate", "resume", "assign"].includes(scenario)) assert.deepEqual(result, sample);
    if (scenario === "activate") {
      assert.equal(result.plans[0].status, "draft");
      assert.equal(result.summary.draft, 1);
      assert.equal(result.summary.active, 0);
    }
    if (scenario === "resume") assert.equal(result.assignment.status, "suspended");
    if (scenario === "assign") {
      assert.equal(result.assignment, null);
      assert.deepEqual(result.adjustments, []);
      assert.deepEqual(result.usage, {});
      assert.deepEqual(result.effective_quotas, {});
    }
  }
  assert.equal(JSON.stringify(sample), serialized);
  assert.throws(() => commercialConfirmSample(sample, "unknown"));
});
test("P58 confirmation packet binds sixty current-source runs and every continuous image without write execution", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CONFIRM-CURRENT-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 60);
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    894,
  );
  assert.equal(e.screenshots.length, 76);
  assert.equal(Object.keys(e.sourceHashes).length, 163);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  for (const f of [
    component,
    "scripts/verify-ui-phase2-commercial-confirm.mjs",
    "scripts/lib/ui-phase2-commercial-confirm-preview.mjs",
    "apps/web/src/use-modal-dialog.ts",
  ])
    assert.ok(e.sourceHashes[f]);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
    assert.ok(
      shot.geometry.modal && shot.geometry.y >= 0 && shot.geometry.y + shot.geometry.height <= 901,
    );
  }
  for (const width of [390, 760, 1440])
    for (const scenario of commercialConfirmScenarios) {
      const pair = e.runs.filter((r) => r.width === width && r.scenario === scenario);
      assert.equal(pair.length, 2);
      assert.equal(pair[0].mode, "baseline");
      assert.equal(pair[1].mode, "review");
      for (const key of ["rows", "impact", "fixtureSha256", "backgroundSha256"])
        assert.deepEqual(pair[0][key], pair[1][key], `${scenario}:${key}`);
      for (const run of pair) {
        const v = (name) => run.checks.find((c) => c.name === name)?.actual;
        assert.equal(v("one native modal"), 1);
        assert.equal(v("two original confirmation controls"), 2);
        assert.equal(v("one commercial GET"), 1);
        for (const name of [
          "initial cancel focus",
          "no horizontal overflow",
          "cancel to execute native Tab",
          "execute to cancel native ShiftTab",
          "cancel or Escape returns original trigger",
          "zero writes and request bodies",
        ])
          assert.equal(v(name), true, name);
        assert.deepEqual(v("no unexpected network"), []);
        assert.deepEqual(v("no runtime errors"), []);
        if (run.mode === "review") {
          assert.equal(v("44px buttons"), true);
          assert.equal(v("no-row notice only without comparisons"), run.rows.length ? 0 : 1);
          assert.equal(v("before after labels on every row"), run.rows.length * 2);
          assert.deepEqual(run.facts, v("submission facts from actual pending body"));
          assert.equal(
            Object.hasOwn(run.facts, "请求携带的版本"),
            !["assign", "adjust"].includes(scenario),
          );
        }
        const frames = e.screenshots
          .filter((s) => s.mode === run.mode && s.width === width && s.scenario === scenario)
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
});
