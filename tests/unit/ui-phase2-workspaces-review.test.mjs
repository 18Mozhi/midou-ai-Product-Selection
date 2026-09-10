import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { validateActionReview } from "../../scripts/lib/ui-phase2-action-coverage.mjs";
import { validateReviewSurfaces } from "../../scripts/lib/ui-phase2-review-surfaces.mjs";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import {
  base,
  parentFile,
  childFile,
  dependencies,
  buildWorkspacesReview,
} from "../../scripts/build-ui-phase2-workspaces-review.mjs";

const sources = Object.fromEntries(
  dependencies.map((f) => [f, readFileSync(f, "utf8").replaceAll("\r\n", "\n")]),
);
const evidence = JSON.parse(
  readFileSync(`${base}/design/workspaces-direction-c/evidence.json`, "utf8"),
);
const review = () => buildWorkspacesReview(sources, evidence);
const plain = (v) => JSON.parse(JSON.stringify(v));
const packages = new Map([["workspaces-direction-c", evidence]]);
const context = {
  candidates: [parentFile, childFile].flatMap((f) => scanSource(sources[f], f).candidates),
  sourceHashes: Object.fromEntries(
    Object.entries(sources).map(([f, s]) => [f, createHash("sha256").update(s).digest("hex")]),
  ),
  contracts: runContractAudit().records,
  packages,
  files: new Set(["scripts/verify-ui-phase2-workspaces-c.mjs"]),
};
test("P32 explicitly covers 28 source sites and 18 actions without granting approval", () => {
  const r = review(),
    result = validateActionReview(r, context);
  assert.equal(result.sourceSites, 28);
  assert.equal(result.semanticGroups, 22);
  assert.equal(result.routeActions, 18);
  assert.equal(result.excludedGroups, 4);
  assert.equal(result.writeActions, 2);
  assert.equal(result.wiringGroups, 0);
  assert.equal(result.unmappedVisualSlots, 108);
  assert.equal(r.approval, "pending-user-review");
  assert.deepEqual(JSON.parse(readFileSync(`${base}/action-reviews/P32.json`, "utf8")), r);
});
test("P32 rejects omitted source, invented approval and a missing mobile scene", () => {
  const omitted = review();
  omitted.actions.pop();
  assert.throws(() => validateActionReview(omitted, context), /unmapped candidates/);
  const approved = review();
  approved.approval = "approved";
  assert.throws(() => validateActionReview(approved, context));
  const bad = plain(evidence);
  bad.screenshots = bad.screenshots.filter((s) => !(s.scene === "normal" && s.width === 390));
  assert.throws(
    () =>
      validateActionReview(review(), {
        ...context,
        packages: new Map([["workspaces-direction-c", bad]]),
      }),
    /missing scene/,
  );
});
test("P32 binds eleven local models and three caller containers, not three dialogs", () => {
  const result = validateReviewSurfaces(review().surfaceReview, { sources, packages });
  assert.equal(result.localModelBindings, 11);
  assert.equal(result.callerContainers, 3);
  assert.equal(result.consumerVariants, 16);
  const r = review();
  r.surfaceReview.inputs.pop();
  assert.throws(
    () => validateReviewSurfaces(r.surfaceReview, { sources, packages }),
    /input omissions/,
  );
  assert.equal(review().sharedReasonInput.maximumLength, null);
  assert.doesNotMatch(sources[dependencies[2]], /maxlength=/);
});
test("P32 rejects stale source or a forged source-to-scene claim", () => {
  assert.throws(
    () => buildWorkspacesReview({ ...sources, [childFile]: sources[childFile] + "\n" }, evidence),
    /stale workspace source/,
  );
  const r = review();
  r.actions[0].scenes = [{ package: "workspaces-direction-c", scene: "nonexistent" }];
  assert.throws(() => validateActionReview(r, context), /missing scene/);
});
function componentProps(source) {
  let found;
  const visit = (n) => {
    if (n.type === 1 && n.tag === "OrganizationWorkspacePanel") found = n;
    for (const c of n.children ?? []) visit(c);
  };
  visit(baseParse(parse(source).descriptor.template.content));
  assert.ok(found);
  return Object.fromEntries(
    found.props
      .filter((p) => p.type === 7 && p.name === "bind")
      .map((p) => [p.arg.content, p.exp.content]),
  );
}
function assertFunctionProps(r, source) {
  const actual = componentProps(source);
  assert.deepEqual(
    r.functionProps.map((p) => [p.attribute, p.handler]),
    [
      ["create-workspace", actual["create-workspace"]],
      ["perform-workspace-action", actual["perform-workspace-action"]],
    ],
  );
  for (const p of r.functionProps) assert.ok(sources[childFile].includes(p.consumer + "("));
}
test("P32 registers function props separately from emitted-event candidates", () => {
  assertFunctionProps(review(), sources[parentFile]);
  assert.throws(() =>
    assertFunctionProps(
      review(),
      sources[parentFile].replace(
        ':create-workspace="createWorkspace"',
        ':create-workspace="createTeam"',
      ),
    ),
  );
  const bindings = componentProps(sources[parentFile]);
  assert.equal(bindings.busy, "busy");
});
function run(code, bindings = {}) {
  const box = { exports: {}, ...bindings };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    box,
  );
  return box.exports;
}
function childHarness() {
  const props = {
    workspaces: [
      { id: "a", name: "北美", slug: "north", status: "active", version: 1, member_count: 3 },
      { id: "b", name: "欧洲", slug: "europe", status: "archived", version: 2, member_count: 4 },
    ],
    defaultWorkspaceId: "a",
    busy: false,
  };
  const watches = [],
    calls = [];
  let resolve;
  props.createWorkspace = (value) => {
    calls.push(plain(value));
    return new Promise((r) => {
      resolve = r;
    });
  };
  props.performWorkspaceAction = async (item) => {
    calls.push(plain(item));
    return true;
  };
  const ast = ts.createSourceFile(
    "child.ts",
    parse(sources[childFile]).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const code = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const h = run(
    code +
      "\nexport const h={query,statusFilter,sort,page,selectedWorkspaceId,selectedWorkspace,form,createOpen,createBusy,filteredWorkspaces,assignedMemberCount,openCreate,cancelCreate,submitCreate,performAction,resetFilters};",
    {
      defineProps: () => props,
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: (source, callback, options) => {
        watches.push({ source, callback });
        if (options?.immediate) callback(source());
      },
      window: { requestAnimationFrame: (fn) => fn() },
      document: { querySelector: () => ({ focus() {} }) },
    },
  ).h;
  return { h, props, watches, calls, resolve: (value) => resolve(value) };
}
test("P32 actual child searches only name and slug and retains filtered-out selection", () => {
  const { h, props, watches } = childHarness();
  h.query.value = " EUROPE ";
  watches[1].callback();
  assert.deepEqual(plain(h.filteredWorkspaces.value.map((i) => i.id)), ["b"]);
  assert.equal(h.selectedWorkspace.value.id, "a");
  h.query.value = "active";
  assert.equal(h.filteredWorkspaces.value.length, 0);
  h.query.value = "3";
  assert.equal(h.filteredWorkspaces.value.length, 0);
  h.form.value.name = "仍在编辑";
  h.resetFilters();
  assert.equal(h.form.value.name, "仍在编辑");
  assert.equal(h.assignedMemberCount.value, 7);
  props.workspaces = [];
  watches[0].callback([]);
  assert.equal(h.selectedWorkspaceId.value, "");
  assert.equal(h.createOpen.value, true);
});
test("P32 actual creation captures trimmed body, rejects repeat, retains failed draft", async () => {
  const { h, calls, resolve } = childHarness();
  h.openCreate();
  h.form.value = { name: " 北美 ", slug: " north ", reason: " 建立范围 " };
  const pending = h.submitCreate();
  h.form.value.name = "请求后继续编辑";
  await h.submitCreate();
  h.cancelCreate();
  assert.equal(h.createOpen.value, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { name: "北美", slug: "north", reason: "建立范围" });
  resolve(false);
  await pending;
  assert.equal(h.form.value.name, "请求后继续编辑");
  assert.equal(h.createBusy.value, false);
});
test("P32 characterization: success clears later draft while fields remain editable", async () => {
  const { h, resolve } = childHarness();
  h.openCreate();
  h.form.value = { name: "北美", slug: "north", reason: "建立范围" };
  const pending = h.submitCreate();
  h.form.value = { name: "后来草稿", slug: "later", reason: "另一目的" };
  resolve(true);
  await pending;
  assert.deepEqual(plain(h.form.value), { name: "", slug: "", reason: "" });
  assert.equal(h.createOpen.value, false);
  // Characterization only: do not call this a draft-preservation fix.
});
function parentAction(bindings) {
  const ast = ts.createSourceFile(
    "parent.ts",
    parse(sources[parentFile]).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "workspaceAction",
  );
  assert.ok(fn);
  return run(fn.getText(ast) + "\nexports.action=workspaceAction;", bindings).action;
}
test("P32 parent action captures status before reason and cancellation causes zero write", async () => {
  let answer;
  const writes = [],
    notice = { value: "" };
  const action = parentAction({
    auditedReason: () =>
      new Promise((r) => {
        answer = r;
      }),
    submit: async (...args) => {
      writes.push(plain(args));
      return true;
    },
    notice,
  });
  const item = { id: "workspace-a", status: "active", version: 1 };
  const pending = action(item);
  item.status = "archived";
  item.version = 2;
  answer("核对范围");
  await pending;
  assert.deepEqual(writes[0], [
    "/org/admin/workspaces/workspace-a/actions",
    { action: "archive", expected_version: 2, reason: "核对范围" },
    "POST",
    { preserveForm: true },
  ]);
  const cancelled = action(item);
  answer(null);
  assert.equal(await cancelled, false);
  assert.equal(writes.length, 1);
});
