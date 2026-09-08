import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildWorkDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  function extract(source, name, kind = "variable") {
    const code = source.includes("<script")
      ? source.split('<script setup lang="ts">')[1].split("</script>")[0]
      : source;
    const ast = ts.createSourceFile("source.ts", code, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        found.push(n.getText(ast));
      if (kind === "method" && ts.isMethodDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(code, bindings = {}) {
    const box = { exports: {}, URL, URLSearchParams, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/helpers/business-tasks.ts"),
    routes = new Map();
  await run(
    `${["taskId", "actor", "env", "task"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} ${extract(fixture, "setup", "function")} export const result=setup(page);`,
    {
      page: { route: async (url, callback) => routes.set(url, callback) },
    },
  ).result;
  async function response(key) {
    let result;
    await routes.get(key)({
      fulfill: (v) => {
        result = v.json;
      },
      request: () => ({ url: () => "https://fixture.invalid/api/v1/tasks?page=1" }),
    });
    return plain(result);
  }
  const list = await response("**/api/v1/tasks?*"),
    summary = (await response("**/api/v1/tasks/summary")).data,
    members = (await response("**/api/v1/tasks/member-options")).data,
    nav = (await response("**/api/v1/me/navigation?shell=member")).data;
  assert.equal(list.data.length, 2);
  assert.equal(list.meta.total, 2);
  assert.equal(
    Object.entries(summary)
      .filter(([k]) => k !== "overdue")
      .reduce((n, [, v]) => n + v, 0),
    7,
  );
  const source = await read("apps/web/src/components/TaskWorkspace.vue");
  const computed = (fn) => ({
    get value() {
      return fn();
    },
  });
  const actions = ["pause", "resume", "delay", "transfer", "cancel"],
    statuses = ["todo", "in_progress", "paused", "completed", "cancelled"];
  const eligibility = {};
  for (const action of actions) {
    eligibility[action] = plain(
      run(`export const value=${extract(source, "batchEligible")};`, {
        computed,
        batchAction: { value: action },
        batchTargets: { value: statuses.map((status) => ({ status })) },
      }).value.value.map((t) => t.status),
    );
  }
  assert.deepEqual(eligibility, {
    pause: ["in_progress"],
    resume: ["paused"],
    delay: statuses.slice(0, 3),
    transfer: statuses.slice(0, 3),
    cancel: statuses.slice(0, 3),
  });
  const routeCases = {};
  for (const [name, arg] of [
    ["setStatus", "paused"],
    ["applyFilters", { query: "证据", sort: "due_asc" }],
    ["resetFilters"],
    ["setPage", 8],
    ["clearQuickCreate"],
  ]) {
    const initial = {
        status: "todo",
        query: "报价",
        sort: "updated_desc",
        page: "2",
        context: "review",
        create: "1",
        title: "draft",
        description: "draft",
      },
      selectedIds = { value: ["old"] },
      navigation = [];
    await run(`${extract(source, name, "function")} export const result=${name}(arg);`, {
      arg,
      route: { query: initial },
      router: { replace: async (v) => navigation.push(plain(v)) },
      selectedIds,
      pageCount: { value: 3 },
    }).result;
    routeCases[name] = { navigation, selection: selectedIds.value };
    assert.equal(navigation[0].query.context, "review");
    if (name !== "clearQuickCreate") assert.deepEqual(plain(selectedIds.value), []);
  }
  assert.equal(routeCases.setPage.navigation[0].query.page, "3");
  assert.equal(routeCases.clearQuickCreate.navigation[0].query.query, "报价");
  assert.equal(routeCases.clearQuickCreate.navigation[0].query.title, undefined);
  const contracts = {};
  for (const name of ["create", "delete", ...actions]) {
    const task = list.data[0],
      calls = [],
      busy = { value: false },
      reason = "核验后调整",
      due = "2026-08-10T10:00:00.000Z";
    const bindings = {
      busy,
      canCreate: { value: true },
      canUpdate: { value: true },
      editing: { value: null },
      form: {
        value: {
          title: "复核供应商交期",
          description: "核对原始证据",
          priority: "normal",
          due_at: "",
        },
      },
      deleting: { value: task },
      deleteReason: { value: ` ${reason} ` },
      selected: { value: null },
      props: {},
      notice: { value: "" },
      selectedIds: { value: [task.id] },
      showBatchImpact: { value: true },
      batchAction: { value: name },
      batchReason: { value: ` ${reason} ` },
      batchDueAt: { value: due },
      batchAssigneeId: { value: members[0].id },
      batchTargets: { value: [task] },
      batchEligible: { value: [{ ...task, status: name === "resume" ? "paused" : task.status }] },
      api: async (url, options) => {
        calls.push(plain({ url, ...options }));
        return {};
      },
      load: async () => {},
      clearQuickCreate: async () => {},
      closeTaskEditor: () => {},
      rethrowUnexpectedError: (e) => {
        throw e;
      },
    };
    const fn = name === "create" ? "create" : name === "delete" ? "removeTask" : "confirmBatch";
    await run(`${extract(source, fn, "function")} export const result=${fn}();`, bindings).result;
    assert.equal(busy.value, false);
    assert.equal(calls.length, 1);
    contracts[name] = calls[0];
    if (actions.includes(name)) {
      assert.equal(calls[0].body.expected_version, task.version);
      assert.equal(calls[0].body.action, name);
      assert.equal(calls[0].body.reason, name === "resume" ? undefined : reason);
    }
  }
  assert.equal(contracts.create.body.due_at, null);
  assert.equal(contracts.create.body.assignee_id, undefined);
  assert.deepEqual(contracts.delete.body, { expected_version: 2, reason: "核验后调整" });
  const repository = await read("apps/api/src/mysql-business-task-repository.ts"),
    sql = [];
  const pool = {
    query: async (query, args) => {
      sql.push({ query, args });
      return [query.startsWith("SELECT COUNT") ? [{ total: 0 }] : []];
    },
  };
  for (const method of ["list", "summary"]) {
    const code = extract(repository, method, "method").replace(
      `async ${method}(`,
      `async function ${method}(`,
    );
    await run(`${code} export const result=${method}.call(receiver, input);`, {
      receiver: { pool, task: (v) => v },
      input: {
        organizationId: "org",
        workspaceId: "workspace",
        actorId: "actor",
        mine: true,
        status: "paused",
        query: "证据%_",
        sort: "due_asc",
        page: 2,
        pageSize: 10,
      },
    }).result;
  }
  assert.equal(sql.length, 3);
  assert.ok(
    sql.every((s) => s.query.includes("assignee_id=?") && s.query.includes("workspace_id=?")),
  );
  assert.ok(sql[1].query.includes("due_at IS NULL,due_at,created_at DESC LIMIT ? OFFSET ?"));
  assert.deepEqual(plain(sql[1].args), [
    "org",
    "workspace",
    "paused",
    "actor",
    "%证据\\%\\_%",
    "%证据\\%\\_%",
    10,
    10,
  ]);
  assert.deepEqual(plain(sql[2].args), ["org", "workspace", "actor"]);
  assert.ok(!sql[2].query.includes("title LIKE"));
  return plain({
    version: "WORK-C-r1",
    list,
    summary,
    members,
    workspace: nav.workspace_name,
    eligibility,
    contracts,
    routeCases,
    boundary:
      "离线P13设计；两条任务与汇总7来自独立测试响应，不是一致数据库快照。扩展状态为明确合成布局样例；写入只记录意图，未请求API。源码VM和SQL构造检查不等于Vue、真实数据库或生产验收。",
  });
}
