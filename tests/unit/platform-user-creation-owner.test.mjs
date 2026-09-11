import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const file = "apps/web/src/components/PlatformAccountCenter.vue";
const source = readFileSync(file, "utf8");
const baseline = execFileSync("git", ["show", `01af0262:${file}`], { encoding: "utf8" });
const owner = readFileSync("apps/web/src/use-user-creation-owner.ts", "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
function harness(original = source) {
  const ast = ts.createSourceFile(
    "parent.ts",
    parse(original).descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const names = ["openCreateUser", "closeCreateUser", "createUser"];
  const functions = ast.statements
    .filter(ts.isFunctionDeclaration)
    .filter((n) => names.includes(n.name.text))
    .map((n) => n.getText(ast));
  assert.equal(functions.length, 3);
  let resolve;
  const response = new Promise((r) => {
    resolve = r;
  });
  const watchers = [],
    deactivated = [],
    unmounted = [],
    writes = [];
  const box = {
    props: { routePath: "/platform-admin/users" },
    createUserOpen: { value: false },
    createUserError: { value: "" },
    message: { value: "" },
    userForm: {
      email: "",
      temporary_password: "",
      platform_role_code: "",
      organization_id: "",
      organization_role_code: "member",
    },
    watch: (getters, callback, options) => {
      assert.equal(options.flush, "sync");
      watchers.push(callback);
    },
    onDeactivated: (fn) => deactivated.push(fn),
    onBeforeUnmount: (fn) => unmounted.push(fn),
    write: async (path, body, method, error) => {
      writes.push({ path, body: plain(body), method });
      const result = await response;
      if (!result) error("old failure");
      return result;
    },
  };
  const context = vm.createContext(box);
  vm.runInContext(
    ts.transpileModule(
      owner.replace(/^import.*\n/, "").replace("export function", "function") +
        "\nconst createUserOwner = useUserCreationOwner(()=>createUserOpen.value,()=>props.routePath);\n" +
        functions.join("\n"),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
    ).outputText,
    context,
  );
  return { box, context, resolve, writes, watchers, deactivated, unmounted };
}
function start(h) {
  h.context.openCreateUser();
  Object.assign(h.box.userForm, {
    email: "submitted@example.test",
    temporary_password: "FixtureOnly-123",
  });
  return h.context.createUser();
}

for (const outcome of [true, false]) {
  test(`baseline reproduces replacement-form pollution: ${outcome ? "success" : "failure"}`, async () => {
    const h = harness(baseline),
      pending = start(h);
    h.context.closeCreateUser();
    h.context.openCreateUser();
    h.resolve(outcome);
    await pending;
    assert.equal(h.box.createUserOpen.value, !outcome);
    assert.equal(h.box.createUserError.value, outcome ? "" : "old failure");
  });
  test(`current reply cannot close or poison a replacement form: ${outcome ? "success" : "failure"}`, async () => {
    const h = harness(),
      pending = start(h);
    h.context.closeCreateUser();
    h.context.openCreateUser();
    Object.assign(h.box.userForm, {
      email: "new@example.test",
      temporary_password: "NewFixtureOnly-456",
    });
    h.resolve(outcome);
    await pending;
    assert.equal(h.box.createUserOpen.value, true);
    assert.equal(h.box.createUserError.value, "");
    assert.equal(h.box.userForm.email, "new@example.test");
    assert.equal(h.box.userForm.temporary_password, "NewFixtureOnly-456");
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.writes[0], {
      path: "/platform/accounts/users",
      method: "POST",
      body: {
        email: "submitted@example.test",
        temporary_password: "FixtureOnly-123",
        platform_role_code: null,
        organization_id: null,
        organization_role_code: "member",
      },
    });
    assert.equal(h.box.message.value.includes("账号已创建"), outcome);
  });
  test(`same form retains original completion behavior: ${outcome ? "success" : "failure"}`, async () => {
    const h = harness(),
      pending = start(h);
    h.resolve(outcome);
    await pending;
    assert.equal(h.box.createUserOpen.value, !outcome);
    assert.equal(h.box.createUserError.value, outcome ? "" : "old failure");
  });
}
for (const boundary of ["close", "route-return", "deactivate", "unmount"]) {
  test(`invalidated creation cannot update feedback after ${boundary}`, async () => {
    const h = harness(),
      pending = start(h);
    if (boundary === "close") h.context.closeCreateUser();
    if (boundary === "route-return") {
      h.box.props.routePath = "/platform-admin/admins";
      h.watchers.forEach((fn) => fn());
      h.box.props.routePath = "/platform-admin/users";
      h.watchers.forEach((fn) => fn());
    }
    if (boundary === "deactivate") h.deactivated.forEach((fn) => fn());
    if (boundary === "unmount") h.unmounted.forEach((fn) => fn());
    h.resolve(false);
    await pending;
    assert.equal(h.box.createUserError.value, "");
    assert.equal(h.box.userForm.temporary_password, "FixtureOnly-123");
  });
}
test("creation fix leaves template and unrelated parent functions intact", () => {
  assert.equal(
    parse(source).descriptor.template.content,
    parse(baseline).descriptor.template.content,
  );
  const functions = (s) => {
    const ast = ts.createSourceFile(
      "source.ts",
      parse(s).descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
    );
    return (
      ast.statements
        .filter(ts.isFunctionDeclaration)
        // Password ownership is independently compared against b93caa7f in its direct test.
        .filter((n) => !["openCreateUser", "createUser", "resetPassword"].includes(n.name.text))
        .map((n) => n.getText(ast))
    );
  };
  assert.deepEqual(functions(source), functions(baseline));
});
