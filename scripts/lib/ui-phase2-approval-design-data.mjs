import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildApprovalDesignData(repo) {
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
    const context = { exports: {}, URL, URLSearchParams, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const fixture = await read("tests/e2e/m05-02-approval-workflow.spec.ts"),
    callbacks = new Map();
  await run(
    `${["approvalId", "actor", "decisionId", "opportunityId", "env", "item"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} ${extract(fixture, "setup", "function")} export const result=setup(page);`,
    { page: { route: async (key, callback) => callbacks.set(key, callback) } },
  ).result;
  async function response(key) {
    let result;
    await callbacks.get(key)({
      request: () => ({ method: () => "GET" }),
      fulfill: (r) => {
        result = r.json;
      },
    });
    return plain(result);
  }
  const list = await response("**/api/v1/tasks/approvals?*"),
    detail = (await response(`**/api/v1/tasks/approvals/${list.data[0].id}`)).data,
    templates = (await response("**/api/v1/tasks/approval-templates")).data,
    members = (await response("**/api/v1/tasks/member-options")).data;
  assert.equal(detail.approval_template_version, 3);
  assert.equal(templates[0].current_version, 1);
  assert.equal(detail.nodes[0].escalated_at, null);
  assert.equal(detail.actions[0].action, "escalated");
  const source = await read("apps/web/src/components/ApprovalWorkspace.vue"),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
  const labels = {};
  for (const n of ["statusText", "resourceText", "actionText"]) labels[n] = extract(source, n);
  const filterInit = extract(source, "filter"),
    initialFilter = (query) =>
      run(`export const value=${filterInit};`, { ref: (v) => ({ value: v }), route: { query } })
        .value.value;
  assert.equal(initialFilter({}), "pending");
  assert.equal(initialFilter({ status: "" }), "");
  assert.equal(initialFilter({ status: "cancelled" }), "cancelled");
  const routeCases = {};
  for (const [fn, arg] of [
    ["setQueue", "requested"],
    ["setFilter", ""],
    ["setPage", 3],
    ["closeDetail"],
  ]) {
    const route = {
        query: {
          view: "requested",
          status: "approved",
          page: "2",
          approval: detail.id,
          from: "/notifications?unread=1",
          context: "review",
        },
      },
      navigation = [];
    await run(`${extract(source, fn, "function")} export const result=${fn}(arg);`, {
      arg,
      route,
      queue: { value: "decidable" },
      filter: { value: "pending" },
      page: { value: 1 },
      pageCount: { value: 4 },
      selected: { value: detail },
      load: async () => {},
      router: { replace: async (v) => navigation.push(plain(v)) },
    }).result;
    routeCases[fn] = navigation[0].query;
    assert.equal(routeCases[fn].context, "review");
  }
  assert.equal(routeCases.setFilter.status, undefined);
  assert.equal(initialFilter(routeCases.setFilter), "pending");
  assert.equal(routeCases.setPage.approval, detail.id);
  const returns = [
    "/notifications",
    "/notifications?unread=1",
    "//evil.invalid",
    "/notifications-extra",
    ["/notifications"],
  ].map(
    (from) =>
      run(`export const value=${extract(source, "notificationReturn")};`, {
        computed,
        route: { query: { from } },
      }).value.value,
  );
  assert.deepEqual(plain(returns), ["/notifications", "/notifications?unread=1", "", "", ""]);
  const forms = {
      template: {
        name: "采购确认审批",
        resource_type: "task",
        node_name: "运营复核",
        approver_id: members[0].id,
        sla_minutes: 60,
        escalation_assignee_id: members[1].id,
      },
      request: {
        template_id: templates[0].id,
        resource_type: templates[0].resource_type,
        resource_id: ` ${detail.resource_id} `,
        title: " 复核采纳决策 ",
      },
    },
    contracts = {},
    failures = {};
  for (const action of ["template", "request", "publish", "approve", "reject"]) {
    for (const fail of [false, true]) {
      const calls = [],
        b = { value: false },
        notice = { value: "" },
        decisionNotice = { value: "" },
        reason = { value: " 核验后记录判断 " },
        selected = { value: plain(detail) },
        showTemplate = { value: true },
        showRequest = { value: true },
        target = { value: templates[1] };
      const fn = {
        template: "createTemplate",
        request: "createRequest",
        publish: "publish",
        approve: "decide",
        reject: "decide",
      }[action];
      const bindings = {
        busy: b,
        notice,
        decisionNotice,
        reason,
        selected,
        showTemplate,
        showRequest,
        publishTarget: target,
        publishReason: { value: " 核验后发布 " },
        templateForm: { value: forms.template },
        requestForm: { value: forms.request },
        load: async () => {},
        closeDetail: async () => {
          selected.value = null;
        },
        rethrowUnexpectedError: () => {},
        api: async (url, options) => {
          calls.push(plain({ url, ...options }));
          if (fail) {
            notice.value = "审批版本已变化。";
            throw new Error("isolated failure");
          }
          return {};
        },
      };
      await run(
        `${extract(source, fn, "function")} export const result=${fn}('${action}');`,
        bindings,
      ).result;
      assert.equal(b.value, false);
      assert.equal(calls.length, 1);
      if (!fail) contracts[action] = calls[0];
      else {
        failures[action] = {
          selectedRetained: Boolean(selected.value),
          reason: reason.value,
          decisionNotice: decisionNotice.value,
          pageNotice: notice.value,
          templateOpen: showTemplate.value,
          requestOpen: showRequest.value,
          publishOpen: Boolean(target.value),
        };
      }
    }
  }
  assert.equal(contracts.approve.body.reason, " 核验后记录判断 ");
  assert.equal(contracts.publish.body.reason, "核验后发布");
  assert.equal(contracts.request.body.resource_id, detail.resource_id);
  assert.equal(contracts.template.body.nodes.length, 1);
  assert.equal(failures.approve.decisionNotice, failures.approve.pageNotice);
  assert.equal(failures.template.decisionNotice, "");
  // Run production validators without invoking its repository or random-ID producers.
  const service = await read("apps/api/src/approval-service.ts"),
    validators = run(
      service.replace(
        'import { randomUUID } from "node:crypto";',
        "const randomUUID=()=>{throw new Error('not used');};",
      ),
    );
  validators.validateTemplate(contracts.template.body);
  validators.validateRequest(contracts.request.body);
  validators.validateDecision(contracts.approve.body);
  for (const minutes of [0, 1.5, 43201])
    assert.throws(() =>
      validators.validateTemplate({
        ...contracts.template.body,
        nodes: [{ ...contracts.template.body.nodes[0], sla_minutes: minutes }],
      }),
    );
  assert.throws(() => validators.validateDecision({ ...contracts.approve.body, reason: " " }));
  assert.throws(() =>
    validators.validateDecision({ ...contracts.approve.body, expected_version: 0 }),
  );
  const repository = await read("apps/api/src/mysql-approval-repository.ts"),
    compare = run(
      `export const value=${extract(repository, "compareApprovalDecisionContexts")};`,
    ).value;
  const unchanged = plain(compare(detail.decision_context, detail.decision_context));
  assert.equal(unchanged.has_changes, false);
  const changedContext = plain(detail.decision_context);
  changedContext.rule_versions.scoring = null;
  changedContext.basis_items[1].value = null;
  changedContext.evidence.requirements.pop();
  const removed = plain(compare(detail.decision_context, changedContext));
  assert.equal(removed.requirement_changes[0].after_complete, null);
  assert.equal(removed.rule_version_changes[0].after, null);
  const scopeCases = {};
  for (const involvement of ["decidable", "requested"]) {
    const queries = [],
      method = extract(repository, "listRequests", "method").replace(
        "async listRequests(",
        "async function listRequests(",
      );
    await run(`${method} export const result=listRequests.call(receiver, input);`, {
      input: {
        organizationId: "org",
        workspaceId: "workspace",
        actorId: "actor",
        involvement,
        status: "pending",
        page: 2,
        pageSize: 20,
      },
      receiver: {
        request: (v) => v,
        pool: {
          query: async (query, args) => {
            queries.push({ query, args });
            return [query.startsWith("SELECT COUNT") ? [{ total: 0 }] : []];
          },
        },
      },
    }).result;
    assert.equal(queries.length, 2);
    assert.ok(queries[1].query.includes("LIMIT ? OFFSET ?"));
    assert.deepEqual(plain(queries[1].args), ["org", "workspace", "pending", "actor", 20, 20]);
    assert.ok(
      queries[1].query.includes(
        involvement === "requested" ? "r.requested_by=?" : "nr.active_approver_id=?",
      ),
    );
    scopeCases[involvement] = { queries: queries.length, args: queries[1].args };
  }
  return plain({
    version: "APPROVAL-C-r1",
    clock: "2026-08-10T00:00:00.000Z",
    list,
    detail,
    templates,
    members,
    forms,
    contracts,
    failures,
    routeCases,
    returns,
    unchanged,
    removed,
    scopeCases,
    boundary:
      "离线P25提案。原始夹具模板v1/详情锁v3、节点无升级/历史有升级及同ID不同展示名并不一致；保持各响应，不合成真实成功链。扩展状态明确合成。源函数/验证器/惰性SQL构造不代表真实Vue、MySQL、授权或生产。",
  });
}
