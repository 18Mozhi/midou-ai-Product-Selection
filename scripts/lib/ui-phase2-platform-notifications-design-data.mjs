import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildPlatformNotificationsDesignData(repo) {
  const proposalRevision = "05a5152fee9ce562579d5470de019c0fbce4bcb9";
  const sourcePaths = [
    "apps/web/src/components/use-platform-notification-list.ts",
    "apps/web/src/components/PlatformManagementCenter.vue",
    "apps/web/src/components/PlatformMessageEditor.vue",
    "apps/web/src/components/PlatformMessageWorkbench.vue",
    "apps/web/src/components/PlatformNotificationOperations.vue",
    "apps/web/src/components/PlatformNotificationManagement.vue",
    "apps/web/src/components/PlatformNotificationPagination.vue",
    "apps/web/src/components/PlatformManagementFilter.vue",
    "apps/web/src/components/platform-management-presentation.ts",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/use-audited-reason.ts",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/api/src/platform-dashboard-service.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "apps/api/src/platform-dashboard-routes.ts",
    "tests/unit/platform-notification-operations.test.mjs",
    "tests/e2e/platform-message-management.spec.ts",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
  ];
  const historicalSources = new Set(
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 18, 19, 20].map((index) => sourcePaths[index]),
  );
  const read = (p) =>
    historicalSources.has(p)
      ? Promise.resolve(
          execFileSync("git", ["show", `${proposalRevision}:${p}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        )
      : readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("input.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const strip = (s) =>
    parse(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const walk = (n, fn) => {
    fn(n);
    ts.forEachChild(n, (c) => walk(c, fn));
  };
  const messageId = "00000000-0000-4000-8000-000000000801";
  const messageAst = parse(await read(sourcePaths[19])),
    operationsAst = parse(await read(sourcePaths[20]));
  let messageFixture, bodyExpression, operationsFixture;
  walk(messageAst, (n) => {
    if (ts.isVariableDeclaration(n) && n.name.getText(messageAst) === "body")
      bodyExpression = n.initializer.getText(messageAst);
    if (
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.getText(messageAst) === "message_pagination") &&
      n.getText(messageAst).includes("长正文审核通知")
    )
      messageFixture = n.getText(messageAst);
  });
  walk(operationsAst, (n) => {
    if (
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.getText(operationsAst) === "subscriptions") &&
      n.getText(operationsAst).includes('id: "notice-1"')
    )
      operationsFixture = n.getText(operationsAst);
  });
  assert.ok(messageFixture && bodyExpression && operationsFixture);
  const originalMessages = {};
  for (const status of ["draft", "published", "cancelled"]) {
    const box = { status, messageId };
    vm.runInNewContext(
      compile(`const body=${bodyExpression};globalThis.result=${messageFixture};`),
      box,
    );
    originalMessages[status] = plain(box.result);
  }
  const opBox = {};
  vm.runInNewContext(compile(`globalThis.result=${operationsFixture};`), opBox);
  const originalOperations = plain(opBox.result);
  assert.equal(originalOperations.items[0].id, "notice-1");
  assert.equal(originalOperations.pagination, undefined);
  const parent = await read(sourcePaths[1]),
    parentAst = parse(parent.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const functions = ["openMessage", "saveMessage", "messageAction"]
    .map((key) => {
      const n = parentAst.statements.find(
        (n) => ts.isFunctionDeclaration(n) && n.name.text === key,
      );
      assert.ok(n);
      return n.getText(parentAst);
    })
    .join("\n");
  const listSource = strip(await read(sourcePaths[0])),
    reasonSource = strip(await read(sourcePaths[13]));
  const logic = `window.PN_SOURCE=(b)=>{const {ref,computed,window,URLSearchParams,AbortController,DOMException,Error,domain,messageEditor,messageForm,messageSaving,notificationList,message,busy,api,load,askActionReason}=b;${compile(listSource + "\n" + reasonSource + "\n" + functions)}\nreturn {usePlatformNotificationList,useAuditedReason,openMessage,saveMessage,messageAction};};`;
  const ref = (value) => ({ value });
  const ticks = async () => {
    for (let n = 0; n < 8; n++) await Promise.resolve();
  };
  function mount() {
    const calls = [],
      reasonCalls = [],
      timers = [],
      urls = [],
      box = { window: {} },
      data = ref(null),
      state = ref("loading"),
      query = ref(""),
      status = ref(""),
      refreshing = ref(false);
    vm.runInNewContext(logic, box);
    const scope = {
      ref,
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      window: {
        location: { search: "", pathname: "/platform-admin/notifications" },
        history: { replaceState: (_a, _b, url) => urls.push(url) },
        setTimeout: (fn, ms) => (timers.push({ fn, ms }), 1),
        clearTimeout: () => {},
      },
      URLSearchParams,
      AbortController,
      DOMException,
      Error,
      domain: ref("notifications"),
      messageEditor: ref(null),
      messageForm: ref({}),
      messageSaving: ref(false),
      notificationList: { showNewestMessages: () => list.showNewestMessages() },
      message: ref(""),
      busy: ref(""),
      api: (url, init) =>
        new Promise((resolve, reject) => calls.push({ url, init, resolve, reject })),
      load: () => list.load(),
      askActionReason: (v) => new Promise((resolve) => reasonCalls.push({ v, resolve })),
    };
    const api = box.window.PN_SOURCE(scope);
    const list = api.usePlatformNotificationList({
      domain: scope.domain,
      query,
      status,
      data,
      state,
      message: scope.message,
      refreshing,
      request: scope.api,
      reload: scope.load,
      fallbackApply: () => {},
      fallbackReset: () => {},
    });
    return {
      api,
      scope,
      list,
      calls,
      reasonCalls,
      timers,
      urls,
      data,
      state,
      query,
      status,
      refreshing,
    };
  }
  const checks = [];
  {
    const m = mount();
    m.list.messagePage.value = 3;
    m.query.value = " first ";
    const p = m.list.load();
    m.query.value = "unsubmitted";
    m.list.applyFilters();
    assert.equal(m.calls.length, 1);
    assert.equal(m.timers[0].ms, 15000);
    assert.ok(m.calls[0].url.includes("message_page=3"));
    m.calls[0].resolve(originalMessages.draft);
    await p;
    assert.ok(m.urls.at(-1).includes("query=unsubmitted"));
    const later = m.list.load();
    m.list.stop();
    m.calls[1].resolve({ ...originalMessages.draft, messages: [] });
    await later;
    assert.equal(m.state.value, "empty");
    m.list.page.value = 4;
    m.list.messagePage.value = 3;
    m.list.showNewestMessages();
    assert.equal(m.list.page.value, 4);
    assert.equal(m.list.messagePage.value, 1);
    const first = mount(),
      failed = first.list.load();
    first.calls[0].reject(new Error("first failure"));
    await failed;
    assert.ok(first.scope.message.value.includes("已保留上次成功数据"));
    checks.push(
      "Actual list: 15s/single-flight skips second request but mutable query reaches success URL; stop ignored-abort updates refs; creating resets message page only; first failure falsely claims retained data; both empty hides auxiliary panels in parent. Not production fixes.",
    );
  }
  {
    const m = mount();
    m.api.openMessage();
    assert.deepEqual(plain(m.scope.messageForm.value), {
      kind: "notification",
      title: "",
      body: "",
      category: "system",
      severity: "info",
      audience_type: "all_users",
      organization_id: "",
      user_id: "",
      in_app_enabled: true,
      email_enabled: false,
      reason: "创建平台消息草稿",
      expected_version: 1,
    });
    m.scope.messageForm.value.title = "标题";
    m.scope.messageForm.value.body = "正文";
    const p1 = m.api.saveMessage(),
      p2 = m.api.saveMessage();
    assert.equal(m.calls.length, 2);
    m.api.openMessage(originalMessages.draft.messages[0]);
    m.calls[0].resolve({});
    await ticks();
    assert.equal(m.scope.messageEditor.value, null);
    m.calls[2].reject(new Error("reload failed"));
    await p1;
    assert.equal(m.scope.message.value, "草稿已创建，可继续编辑或发布。");
    m.calls[1].reject(new Error("duplicate failed"));
    await p2;
    checks.push(
      "Actual parent defaults and create body; function-level save is not single-flight, earlier success closes a newer editor and overwrites failed reload with success. No HTTP.",
    );
  }
  {
    const m = mount(),
      item = plain(originalMessages.draft.messages[0]);
    const p = m.api.messageAction(item, "publish");
    item.version = 9;
    m.reasonCalls[0].resolve(" 发布依据 ");
    await ticks();
    assert.deepEqual(JSON.parse(m.calls[0].init.body), {
      action: "publish",
      expected_version: 9,
      reason: "发布依据",
    });
    m.calls[0].resolve({ recipient_count: 3, in_app_count: 3, email_count: 0 });
    await ticks();
    m.calls[1].reject(new Error("refresh failed"));
    await p;
    assert.ok(m.scope.message.value.includes("覆盖 3 人"));
    const cancel = m.api.messageAction(item, "cancel");
    m.reasonCalls[1].resolve(null);
    await cancel;
    assert.equal(m.calls.length, 2);
    const a = m.api.useAuditedReason();
    const old = a.ask({ title: "first" }),
      next = a.ask({ title: "second" });
    assert.equal(await old, null);
    a.cancel();
    assert.equal(await next, null);
    checks.push(
      "Actual publish confirmation reads item version after awaited reason (mutable target boundary); success counts overwrite reload error; cancelling reason yields no call, new shared reason cancels prior unresolved reason.",
    );
  }
  assert.ok(parent.includes('throw new Error(failure?.actionHint ?? "请求未完成")'));
  assert.ok(parent.includes("v-if=\"state !== 'ready'\""));
  const sb = {};
  vm.runInNewContext(
    compile(
      strip(await read(sourcePaths[15])) +
        "\nglobalThis.Service=PlatformDashboardService;globalThis.DashboardError=PlatformDashboardError;",
    ),
    sb,
  );
  const base = {
    kind: "notification",
    title: "标题",
    body: "正文",
    category: "system",
    severity: "info",
    audience_type: "all_users",
    organization_id: "",
    user_id: "",
    in_app_enabled: true,
    email_enabled: false,
  };
  {
    const calls = [],
      service = new sb.Service({
        createMessage: (v) => (calls.push(plain(v)), v),
        updateMessage: (v) => (calls.push(plain(v)), v),
        messageAction: (v) => (calls.push(plain(v)), v),
        readManagement: (v) => v,
      });
    for (const audience_type of ["all_users", "organization", "user"])
      for (const category of ["task", "approval", "competitor", "system"])
        for (const severity of ["info", "warning", "critical"])
          service.createMessage(
            {
              ...base,
              audience_type,
              category,
              severity,
              organization_id: messageId,
              user_id: messageId,
              reason: "x",
            },
            {},
          );
    assert.equal(calls.length, 36);
    assert.equal(calls[0].value.organization_id, null);
    assert.equal(calls[0].value.reason, undefined);
    service.createMessage({ ...base, title: "字".repeat(200), body: "字".repeat(2000) }, {});
    for (const v of [
      { title: "一" },
      { title: "字".repeat(201) },
      { body: "一" },
      { body: "字".repeat(2001) },
      { category: "invalid" },
      { severity: "invalid" },
      { audience_type: "invalid" },
      { audience_type: "organization" },
      { audience_type: "user" },
      { in_app_enabled: false },
      { email_enabled: true },
      { kind: "email" },
    ])
      assert.throws(() => service.createMessage({ ...base, ...v }, {}));
    for (const action of ["publish", "cancel"]) {
      service.messageAction(
        messageId,
        { action, expected_version: "2", reason: "字".repeat(300) },
        {},
      );
      assert.equal(calls.at(-1).expectedVersion, 2);
    }
    for (const reason of ["一", "字".repeat(301)]) {
      assert.throws(() =>
        service.updateMessage(messageId, { ...base, expected_version: 2, reason }, {}),
      );
      assert.throws(() =>
        service.messageAction(messageId, { action: "publish", expected_version: 2, reason }, {}),
      );
    }
    checks.push(
      "Actual service: 36 audience/category/severity combinations; create has no reason contract; title2-200/body2-2000, edit/action reason2-300, numeric version conversion, inactive selectors not preflight; mail/all-channels-off rejected. No invented recipient rules.",
    );
  }
  const ra = parse(await read(sourcePaths[16]));
  const methods = {},
    utils = ra.statements.find(
      (n) =>
        ts.isVariableStatement(n) && n.declarationList.declarations[0]?.name.getText(ra) === "n",
    );
  let branch, filters;
  walk(ra, (n) => {
    if (
      ts.isMethodDeclaration(n) &&
      [
        "messageManagement",
        "messageAction",
        "updateMessage",
        "createMessage",
        "replayOperation",
        "saveOperation",
        "auditMessage",
      ].includes(n.name.getText(ra))
    )
      methods[n.name.getText(ra)] = n;
    if (ts.isIfStatement(n) && n.expression.getText(ra) === 'i.domain === "notifications"')
      branch = n.thenStatement;
    if (ts.isVariableStatement(n) && n.declarationList.declarations[0]?.name.getText(ra) === "like")
      filters = n;
  });
  assert.ok(utils && branch && filters && Object.keys(methods).length === 7);
  const rb = { PlatformDashboardError: sb.DashboardError, randomUUID: () => "synthetic-id" };
  vm.runInNewContext(
    compile(
      `${utils.getText(ra)}\nglobalThis.read=async function(i){${filters.getText(ra)}${branch.getText(ra)}};${Object.entries(
        methods,
      )
        .map(
          ([k, n]) =>
            `globalThis.${k}=async function(${n.parameters.map((p) => p.getText(ra)).join(",")})${n.body.getText(ra)};`,
        )
        .join("\n")}`,
    ),
    rb,
  );
  const messages = originalMessages.draft.messages,
    delivery = originalOperations.items[0];
  async function readSynthetic(total = 1, messageTotal = 1, page = 1, messagePage = 1) {
    const calls = [],
      host = {
        now: () => new Date("2026-09-09T00:00:00Z"),
        messageManagement: rb.messageManagement,
        pool: {
          query: async (sql, args = []) => {
            calls.push({ sql, args });
            if (sql.startsWith("SELECT COUNT(*) total,SUM(n.read_at"))
              return [[{ total, unread: total, critical: 0 }]];
            if (sql.includes("FROM notification_preferences"))
              return [
                [
                  {
                    total: 3,
                    in_app_enabled: 3,
                    email_enabled: 0,
                    task_enabled: 2,
                    approval_enabled: 2,
                    competitor_enabled: 1,
                  },
                ],
              ];
            if (sql.startsWith("SELECT channel,status"))
              return [
                [
                  { channel: "in_app", status: "delivered", total: 21 },
                  { channel: "email", status: "failed", total: 2 },
                ],
              ];
            if (sql.includes("FROM automation_rules a"))
              return [
                [
                  {
                    id: "synthetic-route",
                    name: "合成竞品变化通知",
                    event_type: "competitor.changed",
                    action_type: "notify_owner",
                    status: "active",
                    version: 1,
                    organization_name: "合成组织",
                    workspace_name: "合成工作区",
                    updated_at: "2026-09-09T00:00:00Z",
                  },
                ],
              ];
            if (sql.includes("FROM competitor_monitor_rules r")) return [[]];
            if (sql.startsWith("SELECT COUNT(*) total FROM platform_messages"))
              return [[{ total: messageTotal }]];
            if (sql.startsWith("SELECT id,name FROM organizations"))
              return [[{ id: messageId, name: "合成组织" }]];
            if (sql.startsWith("SELECT id,email FROM users"))
              return [[{ id: messageId, email: "synthetic@example.test" }]];
            if (sql.startsWith("SELECT m.*"))
              return [
                Array.from(
                  { length: Math.max(0, Math.min(args[1], messageTotal - args[2])) },
                  (_, i) => ({
                    ...messages[0],
                    id: `00000000-0000-4000-8000-${String(801 + args[2] + i).padStart(12, "0")}`,
                    title: `合成消息 ${args[2] + i + 1}`,
                    created_at: "2026-09-09T00:00:00Z",
                  }),
                ),
              ];
            if (sql.startsWith("SELECT n.id"))
              return [
                Array.from(
                  { length: Math.max(0, Math.min(args.at(-2), total - args.at(-1))) },
                  (_, i) => ({
                    ...delivery,
                    id: `synthetic-delivery-${args.at(-1) + i + 1}`,
                    title: `合成投递 ${args.at(-1) + i + 1}`,
                  }),
                ),
              ];
            throw Error("Unexpected inert SQL: " + sql);
          },
        },
      };
    const data = await rb.read.call(host, {
      domain: "notifications",
      query: "x%_",
      status: "task",
      page,
      pageSize: 20,
      messagePage,
      messagePageSize: 10,
    });
    return { data: plain(data), calls };
  }
  const synthetic = (await readSynthetic()).data;
  {
    for (const total of [0, 1, 20, 21, 100])
      for (const messageTotal of [0, 1, 10, 11]) {
        const { data, calls } = await readSynthetic(total, messageTotal, 9999, 9999);
        assert.equal(data.pagination.page, Math.max(1, Math.ceil(total / 20)));
        assert.equal(data.message_pagination.page, Math.max(1, Math.ceil(messageTotal / 10)));
        const q = calls.find((c) => c.sql.startsWith("SELECT m.*"));
        assert.deepEqual(plain(q.args), [
          "notification",
          10,
          (data.message_pagination.page - 1) * 10,
        ]);
        assert.equal(calls[0].args[0], "%x\\%\\_%");
        assert.equal(data.templates.length, 4);
        assert.equal(data.channels[1].status, "pending_provider_selection");
      }
    checks.push(
      "Actual read repository: 20 combinations of independent 20-row deliveries/10-row messages, query/category excluded from message query; actual fixed templates, global subscriptions/channels, clamped pages and bounded active 200/500 audience options. Inert SQL strings, not MySQL execution.",
    );
  }
  {
    for (const mode of [
      "publish-all",
      "publish-organization",
      "publish-user",
      "cancel",
      "empty",
      "conflict",
      "published",
      "mail",
      "replay",
    ]) {
      const calls = [],
        message = {
          ...base,
          status: mode === "published" ? "published" : "draft",
          version: mode === "conflict" ? 3 : 2,
          audience_type:
            mode.replace("publish-", "") === "organization"
              ? "organization"
              : mode === "publish-user"
                ? "user"
                : "all_users",
          organization_id: messageId,
          user_id: messageId,
          email_enabled: mode === "mail",
        };
      const c = {
        beginTransaction: async () => calls.push({ sql: "begin" }),
        commit: async () => calls.push({ sql: "commit" }),
        rollback: async () => calls.push({ sql: "rollback" }),
        release: () => calls.push({ sql: "release" }),
        query: async (sql, args) => {
          calls.push({ sql, args });
          if (sql.startsWith("SELECT result_json"))
            return [
              mode === "replay"
                ? [{ result_json: JSON.stringify({ status: "published", recipient_count: 3 }) }]
                : [],
            ];
          if (sql.startsWith("SELECT * FROM platform_messages")) return [[message]];
          if (sql.startsWith("SELECT u.id user_id"))
            return [
              mode === "empty"
                ? []
                : [
                    { user_id: "one", organization_id: "org", workspace_id: "ws" },
                    { user_id: "two", organization_id: "org", workspace_id: "ws" },
                  ],
            ];
          return [[]];
        },
      };
      const host = {
        pool: { getConnection: async () => c },
        replayOperation: rb.replayOperation,
        saveOperation: rb.saveOperation,
        auditMessage: rb.auditMessage,
      };
      const p = rb.messageAction.call(host, {
        messageId,
        action: mode === "cancel" ? "cancel" : "publish",
        expectedVersion: 2,
        reason: "依据",
        now: new Date("2026-09-09T00:00:00Z"),
      });
      if (["empty", "conflict", "published", "mail"].includes(mode)) {
        await assert.rejects(p);
        assert.ok(calls.some((q) => q.sql === "rollback"));
        assert.ok(!calls.some((q) => q.sql.startsWith("INSERT")));
      } else {
        const result = await p;
        if (mode.startsWith("publish-")) {
          assert.equal(result.recipient_count, 2);
          assert.equal(result.in_app_count, 2);
          assert.equal(result.email_count, 0);
          const q = calls.find((q) => q.sql.startsWith("SELECT u.id"));
          assert.ok(q.sql.includes("earlier.created_at<m.created_at"));
          assert.ok(q.sql.includes("o.default_workspace_id IS NOT NULL"));
          assert.equal(q.args.length, mode === "publish-all" ? 0 : 1);
          assert.ok(!calls.some((q) => q.sql.includes("notification_preferences")));
          assert.equal(
            calls.filter((q) => q.sql.startsWith("INSERT INTO outbox_events")).length,
            2,
          );
        } else assert.ok(!calls.some((q) => q.sql.startsWith("INSERT INTO notifications")));
        assert.ok(calls.some((q) => q.sql === "commit"));
      }
      assert.equal(calls.at(-1).sql, "release");
    }
    checks.push(
      "Actual publish/cancel transaction: all/org/user target SQL and earlier-membership dedup predicate, two inert recipients yield 2 in-app and 0 mail; no preferences/Worker read, published outbox inserted synchronously. Empty/conflict/non-draft/mail rollback, cancel/replay no deliveries. Predicate inspected, not proven against real membership data.",
    );
  }
  {
    for (const mode of [
      "create",
      "create-fk",
      "update",
      "update-conflict",
      "update-published",
      "update-missing",
      "update-replay",
    ]) {
      const calls = [];
      const c = {
        beginTransaction: async () => calls.push("begin"),
        commit: async () => calls.push("commit"),
        rollback: async () => calls.push("rollback"),
        release: () => calls.push("release"),
        query: async (sql) => {
          calls.push(sql);
          if (sql.startsWith("SELECT result_json"))
            return [
              mode === "update-replay"
                ? [{ result_json: JSON.stringify({ status: "draft", version: 3 }) }]
                : [],
            ];
          if (sql.startsWith("SELECT status,version"))
            return [
              mode === "update-missing"
                ? []
                : [
                    {
                      status: mode === "update-published" ? "published" : "draft",
                      version: mode === "update-conflict" ? 5 : 2,
                    },
                  ],
            ];
          if (mode === "create-fk" && sql.startsWith("INSERT INTO platform_messages"))
            throw Object.assign(new Error("inert FK failure"), { code: "ER_NO_REFERENCED_ROW_2" });
          return [[]];
        },
      };
      const host = {
        pool: { getConnection: async () => c },
        replayOperation: rb.replayOperation,
        saveOperation: rb.saveOperation,
        auditMessage: rb.auditMessage,
      };
      const p = rb[mode.startsWith("create") ? "createMessage" : "updateMessage"].call(host, {
        messageId,
        expectedVersion: 2,
        reason: "修改依据",
        value: base,
        now: new Date("2026-09-09T00:00:00Z"),
      });
      if (["create-fk", "update-conflict", "update-published", "update-missing"].includes(mode)) {
        await assert.rejects(
          p,
          (e) => mode !== "create-fk" || e.code === "platform_message_target_not_found",
        );
        assert.ok(calls.includes("rollback"));
      } else {
        const result = await p;
        assert.equal(result.status, "draft");
        assert.equal(result.version, mode === "create" ? 1 : 3);
        assert.ok(calls.includes("commit"));
      }
      assert.ok(!calls.some((sql) => sql.startsWith("INSERT INTO notifications")));
      assert.equal(calls.at(-1), "release");
    }
    checks.push(
      "Actual create/update transaction in inert connection: draft-only save, version increments, invalid FK mapping, missing/non-draft/version conflicts rollback, idempotent replay, no notification delivery on save. No SQL execution.",
    );
  }
  const presentation = {};
  vm.runInNewContext(
    compile(strip(await read(sourcePaths[8])) + "\nglobalThis.name=platformManagementStateName;"),
    presentation,
  );
  const labels = Object.fromEntries(
    [
      "draft",
      "published",
      "cancelled",
      "task",
      "approval",
      "competitor",
      "system",
      "info",
      "warning",
      "critical",
      "delivered",
      "failed",
      "pending_placeholder",
      "system_fixed",
      "enabled",
      "active",
      "pending_provider_selection",
      "queued",
      "blocked_provider",
    ].map((k) => [k, presentation.name(k)]),
  );
  const pagination = (await readSynthetic(21, 11)).data;
  return {
    data: {
      sourcePaths,
      sourceChecks: checks,
      originalMessages,
      originalOperations,
      synthetic,
      pagination,
      labels,
    },
    logic,
  };
}
