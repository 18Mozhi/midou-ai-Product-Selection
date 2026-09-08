import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildAutomationDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  function extract(source, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
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
  const fixture = await read("tests/e2e/m05-05-automation-rules.spec.ts"),
    routes = new Map();
  await run(
    `${["org", "ws", "ruleId", "user", "envelope", "rule"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} ${extract(fixture, "setup", "function")} export const result=setup(page);`,
    { page: { route: async (url, cb) => routes.set(url, cb) } },
  ).result;
  async function response(key) {
    let result;
    await routes.get(key)({
      fulfill: (v) => {
        result = v.json.data;
      },
    });
    return plain(result);
  }
  const list = await response("**/api/v1/automations"),
    members = await response("**/api/v1/tasks/member-options"),
    detail = await response(`**/api/v1/automations/${list[0].id}`),
    fixturePreview = plain(run(`export const value=${extract(fixture, "previewResult")};`).value),
    vue = await read("apps/web/src/components/AutomationRuleCenter.vue"),
    script = vue.split('<script setup lang="ts">')[1].split("</script>")[0],
    ast = ts.createSourceFile("component.ts", script, ts.ScriptTarget.Latest, true),
    source = ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n");
  class MockApiError extends Error {
    constructor() {
      super("controlled failure");
      this.kind = "conflict";
      this.actionHint = "合成版本冲突";
      this.requestId = "synthetic-request";
    }
  }
  function component(transport) {
    const calls = [],
      watches = [],
      navigation = [],
      route = { query: { context: "review" }, fullPath: "/automations?context=review" };
    const request = async (url, options = {}) => {
      calls.push(
        plain({ url, ...options, ...(options.body ? { body: JSON.parse(options.body) } : {}) }),
      );
      if (transport) return transport(url, options);
      return {
        data:
          url === "/automations"
            ? list
            : url === "/tasks/member-options"
              ? members
              : url.endsWith("/preview")
                ? fixturePreview
                : detail,
        request_id: "fixture",
      };
    };
    const api = run(
      `${source}\nexport const h={form,editing,editReason,showCreate,preview,previewing,selected,busy,state,notice,editorFormElement,templates,emptyForm,memberOptions,rules,create,status,runPreview,edit,openCreator,closeEditor,closeDetail,applyTemplate,clearRuleQuery,navigateToRule,applyRouteState,failureReason,executionStatus};`,
      {
        defineProps: () => ({ apiBaseUrl: "/api/v1" }),
        useRoute: () => route,
        useRouter: () => ({
          push: async (v) => navigation.push({ method: "push", ...plain(v) }),
          replace: async (v) => navigation.push({ method: "replace", ...plain(v) }),
        }),
        ref: (value) => ({ value }),
        watch: (...args) => watches.push(args),
        onMounted: () => {},
        createApiClient: () => request,
        ApiClientError: MockApiError,
        rethrowUnexpectedError: () => {},
        useModalDialog: () => ({ dialogElement: { value: null }, handleCancel: () => {} }),
      },
    ).h;
    api.rules.value = list;
    api.memberOptions.value = members;
    api.editorFormElement.value = { reportValidity: () => true };
    return { api, route, calls, navigation, invalidate: watches[0][1], cycle: watches[2][1] };
  }
  const base = component(),
    templates = plain(base.api.templates),
    emptyForm = plain(base.api.emptyForm()),
    contracts = {};
  assert.equal(list[0].latest_execution_status, "dead_letter");
  assert.equal(detail.executions[0].status, "succeeded");
  assert.match(base.api.failureReason("action_failed"), /将按策略重试/);
  assert.equal(fixturePreview.matched_30d, 17);
  assert.deepEqual(fixturePreview.samples, []);
  for (const key of ["preview", "create", "edit", "pause", "resume"]) {
    const c = component();
    if (key === "edit") {
      c.api.edit(list[0], false);
      c.api.editReason.value = "核验后调整频率";
    } else {
      await c.api.openCreator();
      c.api.applyTemplate(templates[0]);
      c.api.form.value.owner_id = members[0].id;
    }
    if (key === "preview") await c.api.runPreview();
    else if (["pause", "resume"].includes(key))
      await c.api.status({
        ...list[0],
        ...(key === "resume" ? { status: "paused", version: 2 } : {}),
      });
    else await c.api.create();
    contracts[key] = c.calls.find((v) => v.method);
    assert.ok(contracts[key]);
  }
  assert.equal(contracts.create.body.description, templates[0].description);
  assert.equal(contracts.create.body.action_assignee_id, null);
  assert.equal(contracts.edit.body.expected_version, 1);
  assert.equal(contracts.edit.body.reason, "核验后调整频率");
  assert.deepEqual(contracts.resume.body, {
    action: "resume",
    expected_version: 2,
    reason: "由规则管理页人工恢复",
  });
  base.api.applyTemplate(templates[1]);
  base.api.form.value.action_assignee_id = members[0].id;
  base.api.form.value.trigger_event_type = "task.created";
  base.cycle("task.created");
  assert.equal(base.api.form.value.action_type, "notify_owner");
  assert.equal(base.api.form.value.action_assignee_id, "");
  base.route.query = { rule: list[0].id, action: "edit", context: "review" };
  await base.api.clearRuleQuery();
  assert.deepEqual(base.navigation.at(-1), { method: "push", query: { context: "review" } });
  await base.api.navigateToRule(list[0], "edit");
  assert.equal(base.navigation.at(-1).query.action, "edit");
  const previewOwnership = [];
  for (const caseName of [
    "current_success",
    "input_success",
    "closed_success",
    "route_success",
    "input_error",
    "current_error",
  ]) {
    let resolve, reject;
    const held = new Promise((ok, fail) => {
        resolve = ok;
        reject = fail;
      }),
      c = component(() => held);
    c.api.showCreate.value = true;
    c.api.form.value = plain(contracts.create.body);
    const pending = c.api.runPreview();
    assert.equal(c.api.previewing.value, true);
    if (caseName.startsWith("input")) {
      c.api.form.value.rate_limit_count = 1;
      c.invalidate();
    }
    if (caseName.startsWith("closed")) {
      c.api.closeEditor();
      c.invalidate();
      c.api.showCreate.value = true;
    }
    if (caseName.startsWith("route")) c.route.fullPath = "/automations?changed=1";
    if (caseName.endsWith("error")) reject(new MockApiError());
    else resolve({ data: fixturePreview, request_id: "fixture" });
    await pending;
    assert.equal(Boolean(c.api.preview.value), caseName === "current_success");
    if (caseName === "input_error") assert.equal(c.api.notice.value, "");
    if (caseName === "current_error") assert.equal(c.api.state.value, "version_conflict");
    previewOwnership.push({
      caseName,
      accepted: Boolean(c.api.preview.value),
      notice: c.api.notice.value,
    });
  }
  const close = component();
  close.api.showCreate.value = true;
  close.api.busy.value = true;
  close.api.editReason.value = "草稿";
  close.api.closeEditor();
  assert.equal(close.api.showCreate.value, false);
  assert.equal(close.api.busy.value, true);
  assert.equal(close.api.editReason.value, "");
  const serviceSource = await read("apps/api/src/automation-service.ts"),
    service = run(
      serviceSource.replace(
        'import { randomUUID } from "node:crypto";',
        "const randomUUID=()=> 'inert-id';",
      ),
    );
  assert.equal(service.validateAutomationRule(contracts.create.body).description, undefined);
  for (const bad of [
    { rate_limit_count: 0 },
    { rate_limit_count: 1.5 },
    { rate_limit_count: 1001 },
    { rate_limit_window_minutes: 1441 },
    { trigger_event_type: "task.created", action_type: "create_task" },
    { owner_id: "" },
    { action_title: " " },
  ])
    assert.throws(() => service.validateAutomationRule({ ...contracts.create.body, ...bad }));
  let patched;
  new service.AutomationService({
    update: (v) => {
      patched = v;
    },
  }).update({ ruleId: list[0].id, value: { ...contracts.edit.body, reason: "测".repeat(501) } });
  assert.equal(
    patched.value.reason.length,
    501,
    "source service 1000 versus UI 500 remains explicit",
  );
  const repository = await read("apps/api/src/mysql-automation-repository.ts"),
    previewCases = {},
    sql = [],
    memberChecks = [];
  for (const actionType of ["notify_owner", "create_task", "empty"]) {
    let count = 0;
    const value = {
        ...contracts.create.body,
        action_type: actionType === "empty" ? "notify_owner" : actionType,
        action_assignee_id: actionType === "create_task" ? members[0].id : null,
      },
      samples =
        actionType === "empty"
          ? []
          : [
              {
                notification_id: detail.executions[0].notification_id,
                title: "合成旧通知样本（早于30天）",
                severity: "warning",
                event_type: value.trigger_event_type,
                created_at: "2026-06-01T00:00:00Z",
              },
            ];
    const result = await run(
      `const iso=${extract(repository, "iso")}; ${extract(repository, "preview", "method").replace("async preview(", "async function preview(")} export const result=preview.call(receiver,input);`,
      {
        receiver: {
          member: async (...args) => memberChecks.push(args),
          now: () => new Date("2026-08-08T12:00:00Z"),
          pool: {
            query: async (query, args) => {
              sql.push(plain({ actionType, query, args }));
              return [
                count++ === 0
                  ? [
                      {
                        matched_30d: actionType === "empty" ? 0 : 17,
                        matched_in_window: actionType === "empty" ? 0 : 3,
                      },
                    ]
                  : samples,
              ];
            },
          },
        },
        input: { organizationId: "org", workspaceId: "workspace", value },
      },
    ).result;
    previewCases[actionType] = plain(result);
  }
  assert.equal(memberChecks.length, 4);
  assert.equal(previewCases.create_task.projected_task_count, 3);
  assert.equal(previewCases.create_task.projected_notification_count, 0);
  assert.ok(
    sql.every(
      (v) => v.query.includes("e.id=n.source_event_id") && v.query.includes("workspace_id=?"),
    ),
  );
  assert.match(sql[0].query, /SUM\(n.created_at>=\?\)/);
  assert.doesNotMatch(sql[1].query, /n.created_at>=/);
  assert.match(sql[1].query, /LIMIT 5$/);
  const worker = await read("apps/worker/src/automation-worker.ts"),
    workerCases = [];
  for (const attempts of [1, 4]) {
    const writes = [];
    const result = await run(
      `${extract(worker, "processOnce", "method").replace("async processOnce(", "async function processOnce(")} export const result=processOnce.call(receiver);`,
      {
        receiver: {
          discover: async () => {},
          claim: async () => ({ id: "synthetic-job", attempt_count: attempts }),
          now: () => new Date("2026-08-08T12:00:00Z"),
          retryLimit: 4,
          pool: {
            query: async (query, args) => {
              if (query.startsWith("SELECT")) throw new Error("inert failure");
              writes.push(plain({ query, args }));
              return [];
            },
          },
        },
      },
    ).result;
    assert.equal(result.status, attempts === 4 ? "dead_letter" : "retry_scheduled");
    workerCases.push({ attempts, status: result.status });
  }
  assert.match(extract(worker, "claim", "method"), /status IN \('queued','retry_scheduled'\)/);
  return plain({
    version: "AUTOMATION-C-r1",
    list,
    members,
    detail,
    emptyForm,
    templates,
    fixturePreview,
    previewCases,
    contracts,
    previewOwnership,
    workerCases,
    boundary:
      "P27离线提案。列表最终失败、详情成功来自独立E2E响应，预览17条命中但样本空；不合并为真实一致快照。额外状态/样本显式合成，写入只记录意图。源Vue函数/验证器/SQL与Worker惰性适配器不是实际Vue、MySQL、Worker、通知投递或生产证据。",
  });
}
