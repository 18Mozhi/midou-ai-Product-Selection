import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { previewCommercialCreateWrite } from "../../scripts/lib/ui-phase2-commercial-create-write-preview.mjs";
import {
  previewCommercialCreateOutcome,
  outcomeState,
  outcomeTemplate,
} from "../../scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const component = "apps/web/src/components/CommercialOperationsCenter.vue",
  root = "output/playwright/p58-create-outcome-review";
const source = read(component),
  preview = previewCommercialCreateOutcome(source);
const ast = (vue) =>
  ts.createSourceFile(
    component,
    parse(vue).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
function functions(vue) {
  const s = ast(vue);
  return new Map(
    s.statements.filter(ts.isFunctionDeclaration).map((n) => [n.name.text, n.getText(s)]),
  );
}
function runTs(source, box) {
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    box,
  );
}

test("P58 outcome proposal compiles, keeps all unrelated functions/template/styles and the exact POST call", () => {
  const original = parse(source).descriptor,
    after = parse(preview).descriptor;
  compileScript(after, { id: "p58-outcome" });
  assert.deepEqual(
    compileTemplate({ source: after.template.content, filename: component, id: "p58-outcome" })
      .errors,
    [],
  );
  assert.equal(
    preview
      .replace(outcomeTemplate, "")
      .slice(preview.replace(outcomeTemplate, "").indexOf("<template>")),
    previewCommercialCreateWrite(source).slice(
      previewCommercialCreateWrite(source).indexOf("<template>"),
    ),
  );
  assert.deepEqual(
    after.styles.map(({ content, attrs }) => ({ content, attrs })),
    original.styles.map(({ content, attrs }) => ({ content, attrs })),
  );
  const beforeFunctions = functions(source),
    afterFunctions = functions(preview);
  for (const [name, text] of beforeFunctions)
    if (!["load", "createPlan"].includes(name)) assert.equal(afterFunctions.get(name), text, name);
  const callNode = (vue) => {
    const s = ast(vue),
      nodes = [];
    const visit = (n) => {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(s) === "call" &&
        n.arguments[0]?.getText(s) === '"/platform/commercial/plans"'
      )
        nodes.push(n.getText(s));
      ts.forEachChild(n, visit);
    };
    visit(s);
    assert.equal(nodes.length, 1);
    return nodes[0];
  };
  assert.equal(callNode(preview), callNode(source));
  assert.throws(() =>
    previewCommercialCreateOutcome(
      source.replace("async function load(", "async function unexpectedLoad("),
    ),
  );
});

function createHarness(vue, failed) {
  const calls = [];
  class Failure extends Error {
    status = 409;
    requestId = "read-error-id";
    actionHint = "目录未能读取";
  }
  const ref = (value) => ({ value });
  const box = {
    ref,
    ApiClientError: Failure,
    AbortController,
    DOMException,
    URLSearchParams,
    window: { setTimeout, clearTimeout },
    crypto: { randomUUID: () => "next-create-key" },
    refreshing: ref(false),
    loadedOnce: ref(true),
    mutating: ref(false),
    creatingPlan: ref(true),
    state: ref("ready"),
    data: ref({ old: true }),
    requestId: ref("initial"),
    notice: ref(""),
    noticeKind: ref("info"),
    page: ref(1),
    adjustmentPage: ref(1),
    organizationId: ref("o1"),
    query: ref(""),
    status: ref(""),
    assignment: ref({}),
    plan: ref({
      code: "new_plan",
      name: "草稿样例",
      description: "",
      collection_tasks: 100,
      open_api_requests: 1000,
      report_exports: 20,
      reason: "验证",
    }),
    draftFeedback: ref(""),
    loadSequence: 0,
    loadController: null,
    createPlanIdempotencyKey: "old-create-key",
    normalizedData: (next) => next,
    localDate: (v) => v,
    syncLocation: () => {},
  };
  box.call = async (path, method, body, options) => {
    calls.push({
      path,
      method,
      body: body && JSON.parse(JSON.stringify(body)),
      key: options?.idempotencyKey,
    });
    if (method === "POST") {
      box.requestId.value = "write-success-id";
      return { id: "new-id", status: "draft", version: 1 };
    }
    box.requestId.value = failed ? "read-error-id" : "read-success-id";
    if (failed) throw new Failure();
    return {
      summary: { total: 1 },
      pagination: { page: 1 },
      adjustment_pagination: { page: 1 },
      assignment: null,
      plans: [{ id: "new-id" }],
    };
  };
  const f = functions(vue);
  runTs(
    (vue === preview ? outcomeState : "") +
      f.get("setNotice") +
      "\n" +
      f.get("load") +
      "\n" +
      f.get("createPlan") +
      '\nglobalThis.execute=createPlan;globalThis.receipt=()=>typeof draftReceipt === "undefined" ? null : draftReceipt.value;',
    box,
  );
  return { box, calls };
}
test("actual create/load reproduce masked refresh failure; proposal retains write success plus failed read", async () => {
  for (const failed of [false, true])
    for (const vue of [source, preview]) {
      const { box, calls } = createHarness(vue, failed);
      await box.execute();
      assert.equal(calls.filter((c) => c.method === "POST").length, 1);
      assert.equal(calls.filter((c) => c.method === "GET").length, 1);
      assert.equal(box.noticeKind.value, failed && vue === preview ? "error" : "success");
      assert.equal(
        box.requestId.value,
        failed && vue === preview ? "read-error-id" : "write-success-id",
      );
      assert.equal(box.creatingPlan.value, false);
      assert.equal(box.mutating.value, false);
      assert.equal(box.createPlanIdempotencyKey, "next-create-key");
      if (vue === preview) {
        const receipt = box.receipt();
        assert.equal(receipt.writeId, "write-success-id");
        assert.equal(receipt.readState, failed ? "failed" : "ready");
        assert.equal(receipt.readId, failed ? "read-error-id" : "read-success-id");
        assert.equal(receipt.name, "草稿样例");
        assert.equal(receipt.code, "new_plan");
      }
      if (failed) assert.equal(box.data.value.old, true);
    }
});
test("review reread guards pending work, marks skipped read unsettled, and does not settle a replaced receipt", async () => {
  let resolve,
    calls = 0,
    focus = 0;
  const box = {
    ref: (value) => ({ value }),
    refreshing: { value: false },
    mutating: { value: false },
    setNotice: () => {},
    load: () => {
      calls++;
      return new Promise((r) => {
        resolve = r;
      });
    },
  };
  runTs(outcomeState + "\nglobalThis.ui={draftReceipt,rereadDraftCatalog,settleDraftRead};", box);
  const ui = box.ui,
    receipt = {
      name: "saved",
      code: "saved",
      writeId: "write-id",
      readState: "failed",
      readId: "old",
      hint: "old",
    };
  ui.draftReceipt.value = receipt;
  const event = {
    currentTarget: {
      closest: () => ({
        querySelector: () => ({
          focus: (opts) => {
            assert.equal(opts.preventScroll, true);
            focus++;
          },
        }),
      }),
    },
  };
  box.mutating.value = true;
  await ui.rereadDraftCatalog(event);
  assert.equal(calls, 0);
  box.mutating.value = false;
  box.refreshing.value = true;
  await ui.rereadDraftCatalog(event);
  assert.equal(calls, 0);
  box.refreshing.value = false;
  const pending = ui.rereadDraftCatalog(event);
  assert.equal(calls, 1);
  assert.equal(focus, 1);
  assert.equal(receipt.readState, "pending");
  const newer = { ...receipt, name: "other", readState: "failed" };
  ui.draftReceipt.value = newer;
  resolve({ kind: "ready", requestId: "old-ready", hint: "" });
  await pending;
  assert.equal(newer.readState, "failed");
  assert.equal(newer.readId, "");
  ui.settleDraftRead(newer, undefined);
  assert.equal(newer.readState, "unsettled");
  assert.equal(newer.writeId, "write-id");
});
test("outcome CSS is scoped to the new review region and explicit prior stylesheet", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-outcome-preview.css"),
  );
  const imports = [];
  css.walkAtRules("import", (r) => imports.push(r.params));
  assert.deepEqual(imports, ['"./commercial-create-write-preview.css"']);
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(
        selector.replace(/\s+/g, " ").startsWith("body.p58-draft-review .p58-draft-result"),
      );
    assert.ok(rule.nodes.filter((n) => n.type === "decl").every((n) => !n.important));
  });
});
test("outcome evidence binds current raw files, complete images, original retry policy and no POST on recovery", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.kind, "P58-CREATE-OUTCOME-REVIEW-r1");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.userReview, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 24);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    444,
  );
  assert.equal(e.screenshots.length, 66);
  assert.equal(Object.keys(e.sourceHashes).length, 167);
  assert.equal(new Set(e.runs.map((r) => `${r.mode}/${r.width}/${r.scene}`)).size, 24);
  for (const file of [
    component,
    "scripts/verify-ui-phase2-commercial-create-outcome.mjs",
    "scripts/lib/ui-phase2-commercial-create-outcome-preview.mjs",
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-write-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-outcome-preview.css",
  ])
    assert.ok(e.sourceHashes[file], file);
  for (const [file, digest] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), digest, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const b = readFileSync(`${root}/${s.file}`);
    assert.equal(hash(b), s.sha256);
    assert.equal(b.readUInt32BE(16), s.pixelWidth);
    assert.equal(b.readUInt32BE(20), s.pixelHeight);
  }
  for (const r of e.runs) {
    const val = (name) => r.checks.find((c) => c.name === name)?.actual;
    assert.equal(val("final local POST count"), 1);
    assert.deepEqual(val("no unexpected network"), []);
    assert.deepEqual(val("no runtime errors"), []);
    assert.equal(
      val("original GET retry count"),
      r.scene === "ready" ? 0 : r.scene === "blocked" ? 3 : 1,
    );
    if (r.scene !== "ready") {
      assert.equal(val("read error remains visible"), r.mode === "review" ? "error" : "success");
      assert.equal(
        val("global notice matches outcome request"),
        r.mode === "review"
          ? "p58-read-failed-" + (r.scene === "blocked" ? 3 : 1)
          : "p58-create-receipt",
      );
    }
    const posts = r.requests.filter((q) => q.key.startsWith("POST "));
    assert.equal(posts.length, 1);
    assert.ok(posts[0].idempotencyKey);
    if (r.mode === "review") {
      assert.equal(val("write success visible before read settles"), true);
      assert.equal(val("no result horizontal overflow"), true);
      assert.equal(val("result controls44px"), true);
      if (r.scene !== "ready")
        assert.equal(val("retry completion retains persistent heading focus"), true);
    }
    for (const suffix of r.mode === "baseline"
      ? ["result"]
      : r.scene === "ready"
        ? ["read-pending", "result", "traces"]
        : ["read-pending", "result", "traces", "retry-pending", "retry-ready"])
      assert.ok(
        e.screenshots.some(
          (s) =>
            s.mode === r.mode && s.width === r.width && s.scene === r.scene && s.suffix === suffix,
        ),
      );
    for (const shot of e.screenshots.filter(
      (s) => s.mode === r.mode && s.width === r.width && s.scene === r.scene,
    ))
      assert.equal(val("unobscured capture " + shot.suffix), true);
  }
});
