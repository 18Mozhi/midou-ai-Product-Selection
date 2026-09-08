import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildWorkspacesDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  function extract(source, name, type = "variable") {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(n) {
      if (type === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.initializer.getText(ast));
      if (type === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(source, bindings = {}) {
    const box = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/m06-01-organization-admin.spec.ts"),
    child = await read("apps/web/src/components/OrganizationWorkspacePanel.vue"),
    parent = await read("apps/web/src/components/OrganizationAdminCenter.vue"),
    data = plain(
      run(
        `${["org", "ws", "summary", "workspaces", "workspaceRows"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} export const result={summary,workspaces,workspaceRows};`,
      ).result,
    ),
    watches = [],
    calls = [],
    focus = [],
    props = {
      workspaces: plain(data.workspaceRows),
      defaultWorkspaceId: data.summary.organization.default_workspace_id,
      busy: false,
    };
  let result = false,
    resolveCreate;
  props.createWorkspace = (v) => {
    calls.push(plain(v));
    return new Promise((resolve) => {
      resolveCreate = resolve;
    });
  };
  props.performWorkspaceAction = async (v) => {
    calls.push(plain(v));
    return result;
  };
  const script = child.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    ast = ts.createSourceFile("child.ts", script, ts.ScriptTarget.Latest, true),
    h = run(
      ast.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(ast))
        .join("\n") +
        "\nexport const h={query,statusFilter,sort,page,pageSize,selectedWorkspaceId,createOpen,createBusy,form,activeCount,archivedCount,assignedMemberCount,filteredWorkspaces,pageCount,pageItems,selectedWorkspace,selectedIsDefault,openCreate,cancelCreate,submitCreate,performAction,resetFilters};",
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
        document: { querySelector: (s) => ({ focus: () => focus.push(s) }) },
      },
    ).h;
  assert.equal(h.pageSize, 8);
  assert.equal(h.pageItems.value.length, 8);
  assert.equal(h.selectedWorkspaceId.value, props.defaultWorkspaceId);
  assert.equal(h.assignedMemberCount.value, 55);
  assert.equal(h.activeCount.value, 9);
  h.page.value = 2;
  assert.equal(h.pageItems.value.length, 2);
  h.query.value = "区域工作区 9";
  watches[1].callback();
  assert.equal(h.page.value, 1);
  assert.equal(h.filteredWorkspaces.value.length, 1);
  assert.equal(
    h.selectedWorkspace.value.id,
    props.defaultWorkspaceId,
    "selection remains outside filter",
  );
  h.statusFilter.value = "archived";
  assert.equal(h.filteredWorkspaces.value[0].status, "archived");
  h.resetFilters();
  h.sort.value = "members_desc";
  assert.equal(h.filteredWorkspaces.value[0].member_count, 10);
  h.sort.value = "updated_desc";
  assert.equal(h.filteredWorkspaces.value[0].slug, "region-9");
  h.selectedWorkspaceId.value = "removed";
  watches[0].callback(props.workspaces);
  assert.equal(h.selectedWorkspaceId.value, props.defaultWorkspaceId);
  h.page.value = 4;
  watches[2].callback(2);
  assert.equal(h.page.value, 2);
  h.openCreate();
  assert.deepEqual(focus, ["#workspace-name"]);
  h.form.value = {
    name: " 亚太增长验证 ",
    slug: " apac-growth ",
    reason: " 建立亚太市场数据边界 ",
  };
  const creating = h.submitCreate();
  assert.equal(h.createBusy.value, true);
  h.cancelCreate();
  assert.equal(h.createOpen.value, true);
  await h.submitCreate();
  assert.equal(calls.length, 1);
  resolveCreate(false);
  await creating;
  assert.equal(h.form.value.name, " 亚太增长验证 ");
  const createBody = plain(calls[0]);
  const success = h.submitCreate();
  resolveCreate(true);
  await success;
  assert.equal(h.createOpen.value, false);
  assert.equal(h.form.value.name, "");
  h.openCreate();
  h.form.value.reason = "未保存";
  h.cancelCreate();
  assert.equal(h.form.value.reason, "");
  props.workspaces = [];
  watches[0].callback([]);
  assert.equal(h.createOpen.value, true);
  assert.equal(h.selectedWorkspaceId.value, "");
  const writes = [],
    notices = { value: "" };
  let answer = "核验工作区状态";
  const actions = run(
    `${["workspaceAction", "createWorkspace"].map((n) => extract(parent, n, "function")).join("\n")} export const h={workspaceAction,createWorkspace};`,
    {
      auditedReason: async () => answer,
      submit: async (url, body, method, options) => {
        writes.push(plain({ url, body, method, options }));
        return true;
      },
      notice: notices,
    },
  ).h;
  await actions.createWorkspace(createBody);
  await actions.workspaceAction(data.workspaceRows[1]);
  await actions.workspaceAction(data.workspaceRows[9]);
  answer = null;
  await actions.workspaceAction(data.workspaceRows[1]);
  assert.equal(writes.length, 3);
  const contracts = Object.fromEntries(
    ["create", "archive", "restore"].map((k, i) => [k, writes[i]]),
  );
  assert.equal(contracts.archive.body.expected_version, 1);
  assert.equal(contracts.restore.body.action, "restore");
  const service = await read("apps/api/src/organization-admin-service.ts"),
    serviceAst = ts.createSourceFile("service.ts", service, ts.ScriptTarget.Latest, true),
    Service = run(
      serviceAst.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(serviceAst))
        .join("\n"),
      { randomUUID: () => "synthetic-id" },
    ).OrganizationAdminService,
    server = new Service({ createWorkspace: (v) => v, workspaceAction: (v) => v });
  assert.equal(
    server.createWorkspace({ value: { ...createBody, slug: "UPPER" } }).value.slug,
    "upper",
    "service lowercases while source UI pattern rejects uppercase",
  );
  for (const slug of ["a", "a".repeat(63), "apac-growth"])
    assert.equal(server.createWorkspace({ value: { ...createBody, slug } }).value.slug, slug);
  for (const slug of ["-a", "a-", "a b", "a".repeat(64)])
    assert.throws(
      () => server.createWorkspace({ value: { ...createBody, slug } }),
      (e) => e.code === "slug_invalid",
    );
  assert.throws(
    () => server.createWorkspace({ value: { ...createBody, reason: "因".repeat(501) } }),
    (e) => e.code === "reason_invalid",
  );
  for (const kind of ["archive", "restore"])
    server.workspaceAction({ workspaceId: data.workspaceRows[1].id, value: contracts[kind].body });
  assert.throws(
    () =>
      server.workspaceAction({
        workspaceId: data.workspaceRows[1].id,
        value: { ...contracts.archive.body, action: "delete" },
      }),
    (e) => e.code === "workspace_action_invalid",
  );
  assert.match(child, /role="listitem"/);
  assert.match(child, /selectedWorkspace\.status === 'active' && selectedIsDefault/);
  return {
    ...data,
    contracts,
    sourceChecks: [
      "Actual child computed/watch callbacks: filters, eight-row pagination, retained selection, fallback and empty auto-create",
      "Actual child creation: trim, focus, busy guard, failed draft retained, success/cancel cleared",
      "Actual parent exact create/archive/restore bodies and cancellation zero-write",
      "Actual service slug/name/reason/action validation; uppercase normalized by service but rejected by source UI",
      "Original one-row and ten-row E2E fixtures retained separately; no fabricated production facts",
    ],
  };
}
