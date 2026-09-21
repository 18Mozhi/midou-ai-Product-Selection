import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import postcss from "postcss";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { previewCommercialCreate } from "../../scripts/lib/ui-phase2-commercial-create-preview.mjs";
import {
  previewCommercialCreateWrite,
  draftWriteUi,
  draftCatch,
} from "../../scripts/lib/ui-phase2-commercial-create-write-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/CommercialOperationsCenter.vue";
const source = read(component),
  preview = previewCommercialCreateWrite(source);
const root = "output/playwright/p58-create-write-review";
test("P58 write proposal compiles and preserves production script except explicit local feedback additions", () => {
  const original = parse(source).descriptor,
    next = parse(preview).descriptor;
  assert.equal(
    next.scriptSetup.content.replace(draftWriteUi, "").replace(draftCatch, ""),
    original.scriptSetup.content,
  );
  assert.deepEqual(
    next.styles.map(({ content, attrs }) => ({ content, attrs })),
    original.styles.map(({ content, attrs }) => ({ content, attrs })),
  );
  const excludeDialog = (text) =>
    text.replace(/<dialog class="p58-draft-c"[\s\S]*?<\/dialog>/, "CREATE_DIALOG");
  assert.equal(
    excludeDialog(preview.replace(draftWriteUi, "").replace(draftCatch, "")),
    excludeDialog(previewCommercialCreate(source)),
  );
  assert.equal((preview.match(/<(?:input|textarea) :disabled="mutating"/g) ?? []).length, 7);
  compileScript(next, { id: "p58-write" });
  assert.deepEqual(
    compileTemplate({ source: next.template.content, filename: component, id: "p58-write" }).errors,
    [],
  );
  assert.throws(() =>
    previewCommercialCreateWrite(
      source.replace('@cancel="handleCreateCancel"', '@cancel="otherHandler"'),
    ),
  );
});
test("P58 review busy guards close and duplicate submit, clearing only its own feedback on an allowed action", async () => {
  let calls = 0,
    focused = 0,
    prevented = 0;
  const box = {
    ref: (value) => ({ value }),
    mutating: { value: true },
    creatingPlan: { value: true },
    createPlan: async () => {
      calls++;
    },
  };
  const js = ts.transpileModule(
    draftWriteUi +
      "\nglobalThis.review = {closeDraftReview,cancelDraftReview,submitDraftReview,draftFeedback};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(js, box);
  const r = box.review;
  r.draftFeedback.value = "existing";
  r.closeDraftReview();
  r.cancelDraftReview({
    preventDefault() {
      prevented++;
    },
  });
  await r.submitDraftReview({
    currentTarget: {
      querySelector() {
        throw Error("busy submit moved focus");
      },
    },
  });
  assert.equal(box.creatingPlan.value, true);
  assert.equal(r.draftFeedback.value, "existing");
  assert.equal(calls, 0);
  assert.equal(prevented, 1);
  box.mutating.value = false;
  await r.submitDraftReview({
    currentTarget: {
      querySelector(selector) {
        assert.equal(selector, "h3");
        return {
          focus(options) {
            assert.equal(options.preventScroll, true);
            focused++;
          },
        };
      },
    },
  });
  assert.equal(calls, 1);
  assert.equal(focused, 1);
  assert.equal(r.draftFeedback.value, "");
  r.draftFeedback.value = "rejected";
  r.closeDraftReview();
  assert.equal(box.creatingPlan.value, false);
  assert.equal(r.draftFeedback.value, "");
});
test("P58 write CSS stays within the review and imports the immutable layout layer", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-write-preview.css"),
  );
  const imports = [];
  css.walkAtRules("import", (rule) => imports.push(rule.params));
  assert.deepEqual(imports, ['"./commercial-create-preview.css"']);
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.replace(/\s+/g, " ").startsWith("body.p58-draft-review "));
      assert.ok(selector.includes(".p58-draft-c"));
    }
    assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
  });
});
test("P58 rejected-write evidence binds current raw sources, every screenshot and explicit local requests", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CREATE-WRITE-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 12);
  assert.equal(new Set(e.runs.map((run) => `${run.mode}/${run.width}/${run.scene}`)).size, 12);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    216,
  );
  assert.equal(e.screenshots.length, 42);
  assert.equal(Object.keys(e.sourceHashes).length, 165);
  for (const file of [
    component,
    "scripts/verify-ui-phase2-commercial-create-write.mjs",
    "scripts/lib/ui-phase2-commercial-create-write-preview.mjs",
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-write-preview.css",
  ])
    assert.ok(e.sourceHashes[file], file);
  for (const [file, digest] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), digest, file);
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
    const isReview = run.mode === "review";
    assert.equal(value("pending disabled fields"), isReview ? 7 : 0);
    assert.equal(value("pending close disabled"), isReview);
    assert.equal(value("pending Escape keeps dialog open"), isReview);
    assert.equal(value("error inside dialog"), isReview ? 1 : 0);
    assert.equal(value("error restores fields"), 0);
    assert.equal(value("duplicate submit blocked"), 1);
    assert.equal(value("one commercial GET"), 1);
    assert.equal(value("exact two explicit local POSTs"), 2);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    const posts = run.requests.filter((r) => r.key.startsWith("POST "));
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[0], posts[1]);
    assert.ok(posts[0].idempotencyKey);
    if (isReview) assert.equal(value("owned error request ID"), "p58-create-" + run.scene);
    for (const prefix of ["pending-part", "error-part", ...(isReview ? ["error-feedback"] : [])])
      assert.ok(
        e.screenshots.some(
          (s) =>
            s.mode === run.mode &&
            s.width === run.width &&
            s.scene === run.scene &&
            s.suffix.startsWith(prefix),
        ),
      );
  }
});
