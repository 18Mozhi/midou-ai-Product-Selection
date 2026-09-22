import { adminDirectoryHeading } from "../../scripts/lib/ui-phase2-admin-directory-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
const file = "apps/web/src/components/PlatformAccountCenter.vue";
const current = readFileSync(file, "utf8");
const controller = readFileSync("apps/web/src/use-platform-organization-actions.ts", "utf8");
const baseline = execFileSync("git", ["show", `aa611c40:${file}`], { encoding: "utf8" });
const currentHead = execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
const plain = (v) => JSON.parse(JSON.stringify(v));
function harness(source = current) {
  const ast = ts.createSourceFile(
    "parent.ts",
    source.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    ts.ScriptTarget.Latest,
    true,
  );
  const names = [
    "write",
    "askReason",
    "submitReason",
    "cancelReason",
    "invalidateOrganizationAction",
    "captureOrganizationAction",
    "closeOrganizationDetail",
    "clearOrganizationFeedback",
    "updateOrganization",
    "toggleOrganization",
    "showOrganization",
  ];
  const functions = ast.statements
    .filter(ts.isFunctionDeclaration)
    .filter((n) => names.includes(n.name.text));
  const ref = (value) => ({ value });
  let resolve, reject;
  const reply = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const item = {
    id: "original-org",
    name: "Original",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
    status: "active",
  };
  const box = {
    props: {
      routePath: "/platform-admin/organizations/original-org",
      organizationId: "original-org",
    },
    selected: ref(item),
    organizationForm: { name: "Edited", timezone: "UTC", data_retention_days: 30 },
    organizationDetailOpen: ref(true),
    organizationMissing: ref(false),
    organizationError: ref(""),
    organizationSuccess: ref(""),
    organizationRefreshWarning: ref(""),
    refreshWarning: ref(""),
    reasonOpen: ref(false),
    reasonTitle: ref(""),
    reasonText: ref(""),
    pendingReasonAction: ref(null),
    data: ref({ organizations: [item] }),
    busy: ref(""),
    message: ref(""),
    ApiClientError: class extends Error {},
    requests: [],
    loads: 0,
  };
  box.request = (path, options) => {
    box.requests.push({ path, ...options });
    return reply;
  };
  box.load = async () => {
    box.loads++;
    if (box.loadResult === false) box.message.value = "重新加载未成功。";
    return box.loadResult ?? true;
  };
  box.loadAccounts = box.load;
  box.showOrganization = (organization) => {
    box.selected.value = organization;
  };
  box.router = {
    replace: async (path) => {
      box.props.routePath = path;
    },
  };
  box.hooks = {};
  box.watch = (read, callback, options) => {
    box.hooks.watch = { read, callback, options };
  };
  box.onDeactivated = (callback) => {
    box.hooks.deactivate = callback;
  };
  box.onBeforeUnmount = (callback) => {
    box.hooks.unmount = callback;
  };
  const controllerCode =
    source === current
      ? controller.replace(/^import .*?;\s*/s, "").replace("export function", "function") +
        `
const {updateOrganization,toggleOrganization,invalidateOrganizationAction}=usePlatformOrganizationActions({
 selected,form:organizationForm,data,detailOpen:organizationDetailOpen,missing:organizationMissing,error:organizationError,success:organizationSuccess,refreshWarning:organizationRefreshWarning,message,pendingReasonAction,
routePath:()=>props.routePath,organizationId:()=>props.organizationId,clearFeedback:clearOrganizationFeedback,showOrganization,askReason,cancelReason,write});
`
      : "";
  vm.runInNewContext(
    ts.transpileModule(
      "let organizationActionSequence=0; let organizationReasonAction=null;\n" +
        functions.map((n) => n.getFullText(ast)).join("\n") +
        controllerCode +
        "\nglobalThis.api={" +
        [
          ...functions.map((n) => n.name.text),
          ...(source === current
            ? [
                "updateOrganization",
                "toggleOrganization",
                "invalidateOrganizationAction",
                "showOrganization",
              ]
            : []),
        ].join(",") +
        "};",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return { box, api: box.api, resolve: (value) => resolve({ data: value }), reject };
}
async function start(h, action) {
  await (action === "save"
    ? h.api.updateOrganization()
    : h.api.toggleOrganization(h.box.selected.value));
  return { run: h.api.submitReason() };
}
for (const action of ["save", "status"]) {
  test(`${action}: late success cannot reopen a closed organization`, async () => {
    const h = harness(),
      { run } = await start(h, action);
    await h.api.closeOrganizationDetail();
    h.resolve({ id: "original-org" });
    await run;
    assert.equal(h.box.organizationDetailOpen.value, false);
    assert.equal(h.box.organizationSuccess.value, "");
    assert.equal(h.box.loads, 0);
    assert.equal(h.box.requests.length, 1);
  });
  test(`${action}: late error cannot contaminate a new opening of the same id`, async () => {
    const h = harness(),
      { run } = await start(h, action);
    await h.api.closeOrganizationDetail();
    h.box.props.routePath = "/platform-admin/organizations/original-org";
    h.api.showOrganization(h.box.selected.value);
    h.box.organizationForm.name = "New opening draft";
    h.reject(new Error("fixture"));
    await run;
    assert.equal(h.box.organizationError.value, "");
    assert.equal(h.box.organizationForm.name, "New opening draft");
  });
  test(`${action}: closed unsubmitted reason cannot write even through a retained callback`, async () => {
    const h = harness();
    await (action === "save"
      ? h.api.updateOrganization()
      : h.api.toggleOrganization(h.box.selected.value));
    const old = h.box.pendingReasonAction.value;
    await h.api.closeOrganizationDetail();
    assert.equal(h.box.reasonOpen.value, false);
    assert.equal(h.box.pendingReasonAction.value, null);
    await old("confirmed later");
    assert.equal(h.box.requests.length, 0);
  });
  test(`${action}: current confirmation retains the original request and reread`, async () => {
    const h = harness(),
      { run } = await start(h, action);
    h.resolve({ id: "original-org" });
    await run;
    assert.equal(h.box.loads, 1);
    assert.equal(h.box.organizationDetailOpen.value, true);
    assert.equal(h.box.requests[0].method, action === "save" ? "PATCH" : "POST");
    assert.deepEqual(
      plain(h.box.requests[0].body),
      action === "save"
        ? { name: "Edited", timezone: "UTC", data_retention_days: 30, reason: "平台管理员人工操作" }
        : { status: "archived", reason: "平台管理员人工操作" },
    );
  });
}
test("baseline proves the same late-success assertion fails before the fix", async () => {
  const h = harness(baseline),
    { run } = await start(h, "save");
  await h.api.closeOrganizationDetail();
  h.resolve({ id: "original-org" });
  await run;
  assert.equal(h.box.organizationDetailOpen.value, true);
  assert.equal(h.box.loads, 1);
});
test("invalidation guards routes, lifecycle and does not cancel an unrelated reason", async () => {
  const h = harness();
  await h.api.updateOrganization();
  const old = h.box.pendingReasonAction.value;
  h.api.invalidateOrganizationAction();
  await old("after invalidation");
  assert.equal(h.box.requests.length, 0);
  await h.api.updateOrganization();
  const unrelated = async () => {};
  h.api.askReason("User action", unrelated);
  h.api.invalidateOrganizationAction();
  assert.equal(h.box.pendingReasonAction.value, unrelated);
  assert.equal(h.box.reasonOpen.value, true);
  assert.equal(h.box.hooks.deactivate, h.api.invalidateOrganizationAction);
  assert.equal(h.box.hooks.unmount, h.api.invalidateOrganizationAction);
  assert.equal(h.box.hooks.watch.callback, h.api.invalidateOrganizationAction);
  assert.equal(h.box.hooks.watch.options.flush, "sync");
  assert.deepEqual(plain(h.box.hooks.watch.read()), [
    h.box.props.routePath,
    h.box.props.organizationId,
  ]);
});
test("unscoped writes still reread and organization feedback is connected", async () => {
  const h = harness();
  const run = h.api.write("/unrelated", {});
  h.resolve({ ok: true });
  await run;
  assert.equal(h.box.loads, 1);
  const template = parse(current).descriptor.template.content;
  assert.match(template, /:refresh-warning="organizationRefreshWarning"/);
  assert.match(template, /:refreshing="refreshing"/);
  assert.match(template, /@retry="retryOrganizationRead"/);
  assert.ok(template.includes(adminDirectoryHeading));
});
test("current restore retains active target status and original reason", async () => {
  const h = harness();
  h.box.selected.value.status = "archived";
  const { run } = await start(h, "status");
  h.resolve({ id: "original-org" });
  await run;
  assert.equal(h.box.requests[0].body.status, "active");
  assert.equal(h.box.organizationSuccess.value, "组织已恢复。");
});
test("successful write receipt stays visible when overview reread fails", async () => {
  const h = harness();
  h.box.loadResult = false;
  const { run } = await start(h, "save");
  h.resolve({
    id: "original-org",
    name: "Saved organization",
    timezone: "UTC",
    data_retention_days: 30,
  });
  await run;
  assert.equal(h.box.selected.value.name, "Saved organization");
  assert.equal(h.box.selected.value.member_count, undefined);
  assert.equal(h.box.selected.value.workspace_count, undefined);
  assert.equal(
    h.box.organizationRefreshWarning.value,
    "组织资料已保存，但最新组织资料暂未读取。请重新加载核对。",
  );
  assert.equal(h.box.organizationSuccess.value, "组织资料已保存。");
});
for (const failure of [false, true])
  test(`owned reread ignores late ${failure ? "failure" : "success"} after scope invalidation`, async () => {
    const ast = ts.createSourceFile(
      "parent.ts",
      current.split(/<script setup[^>]*>/)[1].split("</script>")[0],
      ts.ScriptTarget.Latest,
      true,
    );
    const fn = ast.statements.find(
      (n) => ts.isFunctionDeclaration(n) && n.name.text === "loadAccounts",
    );
    let resolve,
      reject,
      owns = true;
    const ref = (value) => ({ value });
    const data = { organizations: [{ id: "new-current-view" }] };
    const box = {
      permissionsRoute: ref(false),
      refreshing: ref(false),
      data: ref(data),
      state: ref("ready"),
      message: ref(""),
      query: ref(""),
      status: ref(""),
      lastUpdatedAt: ref(null),
      tab: ref("organizations"),
      URLSearchParams,
      AbortController,
      DOMException,
      Date,
      ApiClientError: class extends Error {},
      syncs: 0,
      window: { setTimeout: () => 1, clearTimeout: () => {} },
      request: () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    };
    box.syncOrganizationRoute = () => {
      box.syncs++;
    };
    vm.runInNewContext(
      ts.transpileModule(fn.getFullText(ast) + "\nglobalThis.load=loadAccounts;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    const run = box.load(() => owns);
    owns = false;
    if (failure) reject(new Error("late read"));
    else resolve({ data: { organizations: [{ id: "old-response" }] } });
    await run;
    assert.equal(box.data.value, data);
    assert.equal(box.message.value, "");
    assert.equal(box.syncs, 0);
    assert.equal(box.refreshing.value, false);
  });
test("all unrelated parent functions remain textually unchanged", () => {
  const functions = (source) =>
    ts.createSourceFile(
      "parent.ts",
      source.split(/<script setup[^>]*>/)[1].split("</script>")[0],
      ts.ScriptTarget.Latest,
      true,
    );
  const old = functions(currentHead),
    now = functions(current);
  const excluded = new Set([
    // Independently covered against 01af0262 in platform-user-creation-owner.test.mjs.
    "openCreateUser",
    "createUser",
    "resetPassword", // Independently covered in platform-user-password-ownership.test.mjs.
    "load",
    "loadAccounts",
    "write",
    "closeOrganizationDetail",
    "clearOrganizationFeedback",
    "showOrganization",
    "syncOrganizationRoute",
    "updateOrganization",
    "toggleOrganization",
  ]);
  for (const fn of old.statements.filter(ts.isFunctionDeclaration)) {
    if (excluded.has(fn.name.text)) continue;
    const next = now.statements.find(
      (n) => ts.isFunctionDeclaration(n) && n.name.text === fn.name.text,
    );
    assert.equal(next?.getText(now), fn.getText(old), fn.name.text);
  }
});
