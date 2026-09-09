import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildNotificationDesignData(repo) {
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
    const box = { exports: {}, URLSearchParams, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/m05-03-notifications.spec.ts"),
    routes = new Map();
  await run(
    `${["id", "env", "item"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} ${extract(fixture, "setup", "function")} export const result=setup(page);`,
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
      request: () => ({ url: () => "https://fixture.invalid/api/v1/notifications?page=1" }),
    });
    return plain(result);
  }
  const list = await response("**/api/v1/notifications?*"),
    item = list.data[0],
    summary = (await response("**/api/v1/notifications/summary")).data,
    preferences = (await response("**/api/v1/me/notification-preferences")).data,
    source = await read("apps/web/src/components/NotificationCenter.vue");
  assert.equal(list.meta.page_size, 100);
  assert.equal(list.meta.total, 1);
  assert.equal(item.group_count, 3);
  assert.equal(summary.task, 1);
  assert.equal(summary.approval, 2);
  const contracts = {},
    results = {};
  for (const action of [
    "read",
    "already_read",
    "start",
    "close",
    "reopen",
    "markAll",
    "preferences",
  ]) {
    const calls = [],
      busy = { value: false },
      selected = { value: plain(item) },
      items = { value: [plain(item)] },
      sum = { value: { ...summary, unread: 1 } },
      pref = { value: { ...preferences, email_enabled: true } },
      navigation = [];
    const bindings = {
      disposed: false,
      detailGeneration: 0,
      preferenceGeneration: 0,
      preferenceRevision: 0,
      busy,
      selected,
      items,
      summary: sum,
      preferences: pref,
      showPreferences: { value: true },
      notice: { value: "" },
      route: { query: { category: "approval", notification_id: item.id } },
      router: { replace: async (v) => navigation.push(plain(v)) },
      load: async () => {},
      rethrowUnexpectedError: (e) => {
        throw e;
      },
      api: async (url, options = {}) => {
        calls.push(plain({ url, ...options }));
        if (!options.method) return { ...item, read_at: action === "read" ? null : item.read_at };
        return {
          read_at: item.read_at,
          workflow_status:
            action === "start" ? "in_progress" : action === "close" ? "closed" : "open",
          version: 2,
        };
      },
    };
    const fn =
      action === "read" || action === "already_read"
        ? "openById"
        : action === "markAll"
          ? "markAll"
          : action === "preferences"
            ? "savePreferences"
            : "updateWorkflow";
    const arg = fn === "openById" ? item.id : action;
    await run(`${extract(source, fn, "function")} export const result=${fn}(arg);`, {
      ...bindings,
      arg,
    }).result;
    assert.equal(busy.value, false);
    if (action === "already_read") assert.equal(calls.length, 1);
    else contracts[action] = calls.at(-1);
    results[action] = { selected: selected.value, unread: sum.value.unread, navigation };
  }
  assert.deepEqual(contracts.read.body, { action: "read", expected_version: 1 });
  assert.equal(results.read.unread, 0);
  assert.equal(results.already_read.unread, 1);
  assert.deepEqual(contracts.markAll, { url: "/notifications/actions", method: "POST" });
  assert.equal(contracts.preferences.body.email_enabled, false);
  for (const a of ["start", "close", "reopen"])
    assert.equal(results[a].selected.read_at, item.read_at);
  const routeCases = {};
  for (const [key, arg] of [
    ["category", { category: "task" }],
    ["workflow", { status: "in_progress" }],
    ["unread", { unread: true }],
    ["page", { page: 8 }],
  ]) {
    let destination;
    await run(`${extract(source, "setFilters", "function")} export const result=setFilters(arg);`, {
      arg,
      pageCount: { value: 3 },
      route: {
        query: {
          category: "approval",
          status: "open",
          page: "2",
          notification: item.id,
          context: "review",
        },
      },
      router: {
        replace: async (v) => {
          destination = plain(v);
        },
      },
    }).result;
    routeCases[key] = destination.query;
    assert.equal(destination.query.notification, undefined);
    assert.equal(destination.query.context, "review");
  }
  assert.equal(routeCases.page.page, "3");
  assert.equal(routeCases.unread.unread, "1");
  for (const pending of [true, false]) {
    const selected = { value: item },
      calls = [];
    await run(`${extract(source, "closeDetail", "function")} export const result=closeDetail();`, {
      disposed: false,
      detailGeneration: 0,
      busy: { value: pending },
      selected,
      route: { query: { status: "open", notification: item.id } },
      router: { replace: async (v) => calls.push(plain(v)) },
    }).result;
    assert.equal(calls.length, pending ? 0 : 1);
    assert.equal(Boolean(selected.value), pending);
  }
  const computed = (fn) => ({
      get value() {
        return fn();
      },
    }),
    sourceRoutes = [];
  for (const target of [
    item.action_route,
    "/tasks/example",
    "",
    "//outside.invalid",
    "https://outside.invalid",
  ]) {
    const result = run(
      `export const allowed=${extract(source, "hasSourceRoute")}; export const route=${extract(source, "sourceRoute")};`,
      {
        computed,
        selected: { value: { action_route: target } },
        route: { fullPath: "/notifications?category=approval&notification=sample" },
      },
    );
    sourceRoutes.push({ target, allowed: result.allowed.value, route: result.route.value });
  }
  assert.deepEqual(
    sourceRoutes.map((r) => r.allowed),
    [true, true, false, false, false],
  );
  const labels = run(
    ["displayBody", "severityLabel", "resourceLabel"]
      .map((n) => `export const ${n}=${extract(source, n)};`)
      .join("\n"),
  );
  assert.equal(labels.displayBody(item), "审批状态已变化，请查看关联记录。");
  assert.equal(labels.severityLabel("unknown"), "待确认");
  assert.equal(labels.resourceLabel("unknown"), "系统记录");
  const service = run(await read("apps/api/src/notification-service.ts"));
  for (const a of ["read", "unread", "start", "close", "reopen"])
    assert.equal(service.validateNotificationAction({ action: a, expected_version: 1 }).action, a);
  for (const version of [0, -1, 1.5, null])
    assert.throws(() =>
      service.validateNotificationAction({ action: "read", expected_version: version }),
    );
  assert.throws(
    () => service.validatePreferences({ ...preferences, email_enabled: true, expected_version: 1 }),
    (e) => e.statusCode === 503,
  );
  const normalized = [];
  new service.NotificationService({ list: (v) => normalized.push(plain(v)) }).list({
    page: 0,
    pageSize: 999,
    category: "approval",
    unread: "true",
    workflowStatus: "open",
  });
  assert.equal(normalized[0].pageSize, 200);
  assert.equal(normalized[0].unread, true);
  const repository = await read("apps/api/src/mysql-notification-repository.ts"),
    sql = [];
  for (const method of ["list", "summary", "markAll"]) {
    const connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (query, args) => {
        sql.push(plain({ method, query, args }));
        return [{ affectedRows: 0 }];
      },
    };
    await run(
      `const notificationGroupKeySql=${extract(repository, "notificationGroupKeySql")}; ${extract(repository, method, "method").replace(`async ${method}(`, `async function ${method}(`)} export const result=${method}.call(receiver, input);`,
      {
        receiver: {
          pool: {
            query: async (query, args) => {
              sql.push(plain({ method, query, args }));
              return [[]];
            },
            getConnection: async () => connection,
          },
          operation: async () => null,
          now: () => new Date("2026-08-08T10:00:00Z"),
          audit: async () => {},
          save: async () => {},
        },
        input: {
          organizationId: "org",
          workspaceId: "workspace",
          actorId: "recipient",
          category: "approval",
          workflowStatus: "open",
          unread: true,
          page: 2,
          pageSize: 20,
        },
      },
    ).result;
  }
  assert.equal(sql.length, 4);
  assert.ok(
    sql.every((s) => s.query.includes("recipient_id=?") && s.query.includes("'delivered'")),
  );
  assert.match(sql[1].query, /GROUP BY group_key[\s\S]*LIMIT \? OFFSET \?/);
  assert.deepEqual(sql[1].args, ["org", "workspace", "recipient", "open", "approval", 20, 20]);
  assert.deepEqual(sql[2].args, ["org", "workspace", "recipient"]);
  assert.equal(sql[3].query.includes("workflow_status="), false);
  assert.equal(sql[3].query.includes("category=?"), false);
  const realtime = { opens: 0, fallback: 0, loads: 0, cursor: null };
  let stream;
  const state = { value: "connecting" };
  run(`let stream; ${extract(source, "connectRealtime", "function")} connectRealtime();`, {
    props: { apiBaseUrl: "/api/v1" },
    sessionStorage: {
      getItem: () => "42",
      setItem: (_k, v) => {
        realtime.cursor = v;
      },
    },
    EventSource: class {
      constructor(url, options) {
        assert.match(url, /last_event_id=42$/);
        assert.equal(options.withCredentials, true);
        stream = this;
      }
      addEventListener(name, callback) {
        assert.equal(name, "notification.changed");
        this.changed = callback;
      }
    },
    recordRealtimeOpen: () => {
      realtime.opens++;
    },
    beginRealtimeReconnect: () => realtime.fallback === 0,
    recordRealtimeFallbackPoll: () => {
      realtime.fallback++;
    },
    load: () => {
      realtime.loads++;
    },
    realtimeState: state,
  });
  stream.onopen();
  stream.onerror();
  stream.onerror();
  stream.changed({ lastEventId: "43" });
  assert.deepEqual(realtime, { opens: 1, fallback: 1, loads: 2, cursor: "43" });
  return plain({
    version: "NOTIFICATION-C-r1",
    list,
    summary,
    preferences,
    contracts,
    routeCases,
    sourceRoutes,
    displayBody: labels.displayBody(item),
    realtime,
    boundary:
      "P26离线设计。原始夹具为列表1组/同根因3条，汇总任务1审批2，分页meta为100而Vue请求20；不把独立响应拼成真实数据库快照。扩展状态明确标合成，写入只记意图。源码VM、SQL构造和原型检查不代表真实Vue/API/MySQL/SSE或生产验收。",
  });
}
