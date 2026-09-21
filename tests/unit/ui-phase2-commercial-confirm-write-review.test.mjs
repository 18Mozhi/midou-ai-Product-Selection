import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { previewCommercialConfirm } from "../../scripts/lib/ui-phase2-commercial-confirm-preview.mjs";
import { draftFocusBoundary } from "../../scripts/lib/ui-phase2-commercial-create-focus-preview.mjs";
import {
  previewCommercialConfirmWrite,
  confirmWriteUi,
  confirmWriteCatch,
  confirmFocusBoundary,
} from "../../scripts/lib/ui-phase2-commercial-confirm-write-preview.mjs";

const component = "apps/web/src/components/CommercialOperationsCenter.vue",
  root = "output/playwright/p58-confirm-write-review";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n"),
  hash = (data) => createHash("sha256").update(data).digest("hex");
const source = read(component),
  previous = previewCommercialConfirm(source),
  preview = previewCommercialConfirmWrite(source);
test("P58 confirm-write compiles and changes no business script except explicit local feedback and guards", () => {
  const before = parse(previous),
    after = parse(preview);
  assert.deepEqual(after.errors, []);
  const restored = after.descriptor.scriptSetup.content
    .replace(confirmFocusBoundary, "")
    .replace(confirmWriteUi, "")
    .replace(confirmWriteCatch, "");
  assert.equal(restored, before.descriptor.scriptSetup.content);
  assert.equal(
    confirmFocusBoundary.replace("keepConfirmFocus", "keepDraftFocus"),
    draftFocusBoundary,
  );
  const styles = (d) => d.styles.map(({ attrs, content }) => ({ attrs, content }));
  assert.deepEqual(styles(after.descriptor), styles(before.descriptor));
  compileScript(after.descriptor, { id: "p58-confirm-write" });
  assert.deepEqual(
    compileTemplate({
      source: after.descriptor.template.content,
      filename: component,
      id: "p58-confirm-write",
    }).errors,
    [],
  );
  const outside = (text) =>
    parse(text).descriptor.template.content.replace(
      /<dialog class="p58-impact-c"[\s\S]*?<\/dialog>/,
      "CONFIRM",
    );
  assert.equal(outside(preview), outside(previous));
  assert.doesNotMatch(after.descriptor.template.content, /<h3 tabindex/);
});
test("P58 confirmation busy close/cancel/submit guards preserve pending operation and initialize visible heading only on submit", async () => {
  const calls = [],
    pending = { value: { id: "one" } },
    mutating = { value: false };
  const heading = {
    focus: (options) => calls.push(["focus", options]),
    scrollIntoView: (options) => calls.push(["scroll", options]),
  };
  const box = {
    ref: (value) => ({ value }),
    pending,
    mutating,
    confirm: async () => calls.push(["confirm"]),
  };
  vm.runInNewContext(
    ts.transpileModule(
      confirmWriteUi +
        "\nglobalThis.api={closeConfirmReview,cancelConfirmReview,submitConfirmReview,confirmWriteFeedback};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  const api = box.api,
    feedback = { hint: "keep" };
  api.confirmWriteFeedback.value = feedback;
  const event = {
    currentTarget: { querySelector: () => heading },
    preventDefault: () => calls.push(["prevent"]),
  };
  mutating.value = true;
  api.closeConfirmReview();
  await api.submitConfirmReview(event);
  api.cancelConfirmReview(event);
  assert.equal(pending.value.id, "one");
  assert.equal(api.confirmWriteFeedback.value, feedback);
  assert.deepEqual(calls, [["prevent"]]);
  mutating.value = false;
  calls.length = 0;
  await api.submitConfirmReview(event);
  assert.equal(heading.tabIndex, -1);
  assert.equal(api.confirmWriteFeedback.value, null);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["focus", { preventScroll: true }],
    ["scroll", { block: "center", inline: "nearest" }],
    ["confirm"],
  ]);
  api.confirmWriteFeedback.value = feedback;
  api.closeConfirmReview();
  assert.equal(pending.value, null);
  assert.equal(api.confirmWriteFeedback.value, null);
  calls.length = 0;
  await api.submitConfirmReview(event);
  assert.deepEqual(calls, []);
});
test("P58 actual confirm catch associates error and request id with its original pending operation", async () => {
  const script = parse(preview).descriptor.scriptSetup.content,
    ast = ts.createSourceFile("P58.ts", script, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "confirm",
  );
  assert.ok(fn);
  class ApiClientError extends Error {
    constructor() {
      super("rejected");
      this.actionHint = "本地拒绝";
      this.requestId = "own-write-id";
    }
  }
  for (const replaced of [false, true]) {
    const operation = {
        path: "/local",
        method: "PATCH",
        body: { name: "a" },
        idempotencyKey: "original-key",
      },
      pending = { value: operation },
      mutating = { value: false },
      feedback = { value: null },
      notices = [];
    let calls = 0,
      loads = 0;
    const box = {
      pending,
      mutating,
      confirmWriteFeedback: feedback,
      ApiClientError,
      requestId: { value: "unrelated-read-id" },
      setNotice: (...args) => notices.push(args),
      load: async () => loads++,
      call: async (...args) => {
        calls++;
        assert.deepEqual(JSON.parse(JSON.stringify(args)), [
          "/local",
          "PATCH",
          { name: "a" },
          { idempotencyKey: "original-key" },
        ]);
        if (replaced) pending.value = { id: "new" };
        throw new ApiClientError();
      },
    };
    vm.runInNewContext(
      ts.transpileModule(fn.getText(ast) + "\nglobalThis.run=confirm;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    await box.run();
    assert.equal(calls, 1);
    assert.equal(loads, 0);
    assert.equal(mutating.value, false);
    assert.deepEqual(notices, [["本地拒绝", "error"]]);
    if (replaced) assert.equal(feedback.value, null);
    else {
      assert.equal(feedback.value.operation, operation);
      assert.equal(feedback.value.requestId, "own-write-id");
      assert.equal(feedback.value.hint, "本地拒绝");
    }
  }
});
test("P58 feedback CSS imports its existing C layer and only styles the confirmation region", () => {
  const css = read(
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-confirm-write-preview.css",
  );
  assert.match(css, /@import "\.\/commercial-confirm-preview.css"/);
  postcss.parse(css).walkRules((rule) => {
    for (const s of rule.selectors) {
      assert.ok(s.replace(/\s+/g, " ").startsWith("body.p58-impact-review "));
      assert.ok(s.includes(".p58-impact-c"));
    }
    assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
  });
});
test("P58 five-path rejection packet binds raw sources, retained requests and every region image", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CONFIRM-WRITE-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 60);
  assert.equal(
    e.runs.reduce((n, r) => n + r.checks.length, 0),
    2240,
  );
  assert.equal(e.screenshots.length, 210);
  assert.equal(Object.keys(e.sourceHashes).length, 170);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
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
  for (const width of [390, 760, 1440])
    for (const scenario of ["edit", "renew", "resume", "adjust", "revoke"])
      for (const errorCode of [409, 403]) {
        const pair = e.runs.filter(
          (r) => r.width === width && r.scenario === scenario && r.errorCode === errorCode,
        );
        assert.equal(pair.length, 2);
        assert.deepEqual(pair[0].facts, pair[1].facts);
        const firstWrites = pair.map((r) => r.requests.find((q) => !q.key.startsWith("GET ")));
        assert.equal(firstWrites[0].key, firstWrites[1].key);
        assert.equal(firstWrites[0].body, firstWrites[1].body);
        const initial = e.screenshots.filter(
          (s) =>
            s.width === width &&
            s.scenario === scenario &&
            s.errorCode === errorCode &&
            s.suffix === "initial-top",
        );
        assert.equal(initial.length, 2);
        assert.equal(initial[0].sha256, initial[1].sha256);
        for (const r of pair) {
          const v = (name) => r.checks.find((c) => c.name === name)?.actual;
          for (const name of [
            "original initial cancel focus",
            "original global feedback retained",
            "ready Escape returns trigger",
          ])
            assert.equal(v(name), true, name);
          assert.equal(v("two original buttons disabled"), 2);
          assert.equal(v("duplicate pending submit single flight"), 1);
          assert.equal(v("two local rejected writes"), 2);
          assert.equal(v("no post-rejection catalogue GET"), 1);
          assert.deepEqual(v("pending facts preserved after rejection"), r.facts);
          assert.deepEqual(v("no unexpected network"), []);
          assert.deepEqual(v("no runtime errors"), []);
          const writes = r.requests.filter((q) => !q.key.startsWith("GET "));
          assert.equal(writes.length, 2);
          assert.deepEqual(writes[0], writes[1]);
          assert.ok(writes[0].idempotencyKey);
          const suffixes = e.screenshots
            .filter(
              (s) =>
                s.mode === r.mode &&
                s.width === width &&
                s.scenario === scenario &&
                s.errorCode === errorCode,
            )
            .map((s) => s.suffix)
            .sort();
          assert.deepEqual(
            suffixes,
            (r.mode === "review"
              ? ["initial-top", "waiting-top", "rejected-collapsed", "rejected-expanded"]
              : ["initial-top", "waiting-top", "rejected-background-only"]
            ).sort(),
          );
          if (r.mode === "review") {
            for (const name of [
              "waiting heading visible before screenshot",
              "waiting Escape stays open",
              "folded request copy hidden",
              "request id belongs to rejected operation",
              "folded again removes copy",
            ])
              assert.equal(v(name), true, name);
            for (const [stage, count] of [
              ["initial", 2],
              ["rejected-collapsed", 3],
              ["rejected-expanded", 4],
            ])
              for (const direction of ["Tab", "Shift+Tab"])
                for (let step = 1; step <= count * 2; step++)
                  assert.equal(v(stage + " " + direction + " step" + step), true);
            assert.equal(v("waiting status visible only in review"), 1);
            assert.equal(v("rejection feedback inside dialog"), 1);
          } else {
            assert.equal(v("waiting status visible only in review"), 0);
            assert.equal(v("rejection feedback inside dialog"), 0);
          }
        }
      }
});
