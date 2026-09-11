import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const file = "apps/web/src/components/PlatformAccountCenter.vue";
const source = readFileSync(file, "utf8");
const baseline = execFileSync("git", ["show", `b93caa7f:${file}`], { encoding: "utf8" });
const detailSource = readFileSync("apps/web/src/use-platform-user-detail.ts", "utf8");
const a = { id: "fixture-a" },
  b = { id: "fixture-b" };
const plain = (value) => JSON.parse(JSON.stringify(value));
function functions(text) {
  const ast = ts.createSourceFile(
    "parent.ts",
    parse(text).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  return ast.statements
    .filter(ts.isFunctionDeclaration)
    .map((n) => ({ name: n.name.text, code: n.getText(ast) }));
}
function harness(parent = source) {
  const names = ["openPassword", "resetPassword", "askReason", "submitReason", "cancelReason"];
  const selected = functions(parent).filter((n) => names.includes(n.name));
  assert.equal(selected.length, names.length);
  let resolve;
  const held = new Promise((r) => {
    resolve = r;
  });
  const watchers = [],
    deactivated = [],
    unmounted = [],
    writes = [];
  const box = {
    props: { routePath: "/platform-admin/users" },
    selected: { value: null },
    passwordOpen: { value: false },
    passwordError: { value: "" },
    passwordForm: { temporary_password: "" },
    reasonOpen: { value: false },
    reasonTitle: { value: "" },
    reasonText: { value: "" },
    pendingReasonAction: { value: null },
    message: { value: "" },
    ref: (value) => ({ value }),
    watch: (getter, callback) => watchers.push(callback),
    onDeactivated: (callback) => deactivated.push(callback),
    onBeforeUnmount: (callback) => unmounted.push(callback),
    ApiClientError: class extends Error {},
    detailRequest: async () => ({ data: { user: { id: "fixture-detail" } } }),
    write: async (path, body, method, onError) => {
      writes.push({ path, body: plain(body), method });
      const reply = await held;
      if (!reply) onError("original password failure");
      return reply;
    },
  };
  const context = vm.createContext(box);
  const script =
    detailSource.replace(/^import .*\n/gm, "").replace("export function", "function") +
    "\nObject.assign(globalThis,usePlatformUserDetail(detailRequest,selected,()=>props.routePath));\n" +
    selected.map((n) => n.code).join("\n");
  vm.runInContext(
    ts.transpileModule(script, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
    context,
  );
  return { box, context, resolve, writes, watchers, deactivated, unmounted };
}
async function prepare(h) {
  await h.context.openUserDetail(a);
  h.context.openPassword(a);
  h.box.passwordForm.temporary_password = "SyntheticPasswordOnly-123";
  await h.context.resetPassword();
  h.box.reasonText.value = "隔离测试人工确认";
}
async function changeScope(h, kind) {
  if (kind === "closed") h.context.closeUserDetail();
  if (kind === "other-account" || kind === "same-account-reopened") {
    h.context.closeUserDetail();
    await h.context.openUserDetail(kind === "other-account" ? b : a);
  }
  if (kind === "route-return") {
    h.box.props.routePath = "/platform-admin/admins";
    h.watchers.forEach((fn) => fn());
    h.box.props.routePath = "/platform-admin/users";
    h.watchers.forEach((fn) => fn());
    await h.context.openUserDetail(a);
  }
  if (kind === "deactivated") h.deactivated.forEach((fn) => fn());
  if (kind === "unmounted") h.unmounted.forEach((fn) => fn());
  if (kind === "missing-selected") h.box.selected.value = null;
}

test("baseline success closes the replacement detail, current guard must prevent it", async () => {
  const h = harness(baseline);
  await prepare(h);
  const pending = h.context.submitReason();
  await changeScope(h, "other-account");
  h.resolve(true);
  await pending;
  assert.equal(h.box.detailOpen.value, false);
});
for (const kind of [
  "closed",
  "other-account",
  "same-account-reopened",
  "route-return",
  "deactivated",
  "unmounted",
  "missing-selected",
]) {
  test(`stale reason confirmation issues no password POST: ${kind}`, async () => {
    const h = harness();
    await prepare(h);
    await changeScope(h, kind);
    h.resolve(true);
    await h.context.submitReason();
    assert.equal(h.writes.length, 0);
    assert.equal(h.box.message.value, "");
  });
}
for (const kind of ["other-account", "same-account-reopened", "route-return", "deactivated"]) {
  for (const outcome of [true, false]) {
    test(`late ${outcome ? "success" : "failure"} cannot own ${kind}`, async () => {
      const h = harness();
      await prepare(h);
      const pending = h.context.submitReason();
      await changeScope(h, kind);
      const open = h.box.detailOpen.value;
      h.resolve(outcome);
      await pending;
      assert.equal(h.box.detailOpen.value, open);
      assert.equal(h.box.passwordError.value, "");
      assert.equal(h.writes.length, 1);
      assert.deepEqual(h.writes[0], {
        path: "/platform/accounts/users/fixture-a/password",
        method: "POST",
        body: { temporary_password: "SyntheticPasswordOnly-123", reason: "隔离测试人工确认" },
      });
      assert.equal(h.box.message.value.includes("临时密码已更新"), outcome);
    });
  }
}
for (const outcome of [true, false]) {
  test(`valid original scope preserves ${outcome ? "success" : "failure"} and draft behavior`, async () => {
    const h = harness();
    await prepare(h);
    const pending = h.context.submitReason();
    h.resolve(outcome);
    await pending;
    assert.equal(h.box.detailOpen.value, !outcome);
    assert.equal(h.box.passwordOpen.value, !outcome);
    assert.equal(h.box.passwordError.value, outcome ? "" : "original password failure");
    assert.equal(h.box.passwordForm.temporary_password, "SyntheticPasswordOnly-123");
  });
}
test("password fix leaves template and every other parent function unchanged", () => {
  assert.equal(
    parse(source).descriptor.template.content,
    parse(baseline).descriptor.template.content,
  );
  assert.deepEqual(
    functions(source).filter((n) => n.name !== "resetPassword"),
    functions(baseline).filter((n) => n.name !== "resetPassword"),
  );
});
