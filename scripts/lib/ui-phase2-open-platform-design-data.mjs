import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID, randomBytes, createHash } from "node:crypto";

export async function buildOpenPlatformDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/OpenPlatformCenter.vue",
    "apps/api/src/open-platform-service.ts",
    "apps/api/src/mysql-open-platform-repository.ts",
    "apps/api/src/open-platform-routes.ts",
    "apps/worker/src/webhook-delivery-worker.ts",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/components/ConfirmDialog.vue",
    "apps/web/src/api-client.ts",
    "config/route-catalog.json",
    "tests/e2e/m06-05-open-platform.spec.ts",
    "tests/m06-05/open-platform.test.mjs",
  ];
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const strip = (s) =>
    parse(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const ast = parse(await read(sourcePaths[10]));
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations]);
  const originalBox = {};
  for (const key of ["orgId", "data"]) {
    const n = declarations.find((n) => n.name.getText(ast) === key);
    assert.ok(n, key);
    vm.runInNewContext(compile(`globalThis.${key}=${n.initializer.getText(ast)};`), originalBox);
  }
  const original = plain(originalBox.data),
    org = originalBox.orgId;
  const vue = await read(sourcePaths[0]);
  const script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const exposed =
    "activeView,organizationId,state,refreshing,actionBusy,hasSnapshot,notice,requestId,secret,pending,fieldErrors,form,filters,data,currentRows,currentPagination,currentSummary,statusOptions,sortOptions,apiQuery,syncUrl,load,switchView,applyFilters,resetFilters,goToPage,call,prepare,confirm,validate,createClient,createWebhook,clientAction,webhookUpdate,webhookAction,replay,copySecret,toggleEvent,statusText,scopeText,eventText,rangeLabel";
  const logic = `window.OPEN_SOURCE=(b)=>{const {computed,ref,reactive,nextTick,onMounted,onBeforeUnmount,defineProps,createApiClient,ApiClientError,location,history,innerWidth,document,navigator,window,URLSearchParams,AbortController}=b;${compile(script)}\nreturn {${exposed}};};`;
  class ApiClientError extends Error {
    constructor(status = 503) {
      super("inert");
      this.status = status;
      this.actionHint = "隔离读取失败";
      this.requestId = "inert-error";
    }
  }
  const tick = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  function mount(search = "") {
    const box = { window: {}, URL },
      calls = [],
      timers = [],
      unmount = [],
      urls = [],
      mounted = [];
    vm.runInNewContext(logic, box);
    const s = box.window.OPEN_SOURCE({
      ref: (value) => ({ value }),
      reactive: (v) => v,
      computed: (f) => ({
        get value() {
          return f();
        },
      }),
      nextTick: async () => {},
      onMounted: (f) => mounted.push(f),
      onBeforeUnmount: (f) => unmount.push(f),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (url, options = {}) =>
          new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      location: { search, pathname: "/platform-admin/open-platform" },
      history: { state: null, replaceState: (_s, _t, url) => urls.push(url) },
      innerWidth: 1440,
      document: {},
      navigator: {
        clipboard: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      },
      window: {
        setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
        clearTimeout: () => {},
      },
      URLSearchParams,
      AbortController,
    });
    return { s, calls, timers, unmount, urls, mounted };
  }
  const response = (d = original) => ({ data: plain(d), request_id: "inert-response" });
  const checks = [];
  {
    const x = mount();
    const p = x.s.load();
    x.s.organizationId.value = org;
    x.s.filters.clients.query = "draft";
    await x.s.load();
    assert.equal(x.calls.length, 1);
    assert.equal(x.timers[0].ms, 15000);
    x.calls[0].resolve(response());
    await p;
    assert.equal(x.s.organizationId.value, org);
    assert.equal(x.s.data.value.scope.organization_id, null);
    x.s.switchView("deliveries");
    await tick();
    assert.equal(x.calls.length, 1);
    assert.match(x.urls.at(-1), /organization_id=/);
    const q = new URLSearchParams(x.s.apiQuery());
    assert.equal(q.get("client_query"), "draft");
    assert.equal(q.get("webhook_page_size"), "20");
    const late = x.s.load();
    x.unmount[0]();
    x.calls[1].resolve(response({ ...original, observed_at: "late-unmount" }));
    await late;
    assert.equal(x.s.data.value.observed_at, "late-unmount");
    const y = mount("?view=webhooks&query=selected&page_size=50");
    assert.equal(y.s.filters.webhooks.query, "selected");
    assert.equal(y.s.filters.clients.query, "");
    assert.equal(y.s.filters.webhooks.pageSize, 50);
    checks.push(
      "Actual Vue: 15s single-flight drops second organization/filter read, mutable URL differs from snapshot, three-view switch sends no GET, current-view-only URL initialization, abort-ignoring late write after unmount.",
    );
  }
  {
    for (const [code, expected] of [
      [401, "expired"],
      [403, "forbidden"],
      [429, "rate_limited"],
      [503, "blocked"],
      [400, "error"],
    ]) {
      const x = mount();
      const p = x.s.load();
      x.calls[0].reject(new ApiClientError(code));
      await p;
      assert.equal(x.s.state.value, expected);
    }
    const x = mount();
    const p = x.s.load();
    x.timers[0].fn();
    x.calls[0].reject(new Error("abort"));
    await p;
    assert.equal(x.s.hasSnapshot.value, false);
    assert.match(x.s.notice.value, /仍保留/);
    const y = mount();
    y.s.hasSnapshot.value = true;
    y.s.data.value = plain(original);
    y.s.state.value = "ready";
    const p2 = y.s.load();
    y.calls[0].reject(new ApiClientError(403));
    await p2;
    assert.equal(y.s.data.value.clients.length, 1);
    assert.equal(y.s.state.value, "ready");
    checks.push(
      "Actual Vue: five first-error states, first-timeout incorrectly claims retained result, retained 403 snapshot remains ready.",
    );
  }
  {
    const x = mount();
    x.s.organizationId.value = org;
    Object.assign(x.s.form, { name: " 新账号 ", reason: " 一 ", quota_per_minute: 60 });
    x.s.createClient();
    assert.deepEqual(plain(x.s.pending.value.body), {
      organization_id: org,
      name: "新账号",
      scopes: ["status:read"],
      quota_per_minute: 60,
      reason: "一",
    });
    x.s.form.reason = "changed";
    assert.equal(x.s.pending.value.body.reason, "一");
    x.s.clientAction(original.clients[0], "revoke");
    assert.equal(x.s.pending.value.destructive, true);
    assert.equal(x.s.pending.value.body.expected_version, 1);
    x.s.webhookUpdate(original.webhooks[0]);
    assert.equal(x.s.pending.value.method, "PATCH");
    assert.equal(x.s.pending.value.body.status, "disabled");
    x.s.webhookAction(original.webhooks[0], "test");
    assert.deepEqual(Object.keys(x.s.pending.value.body), ["reason"]);
    x.s.replay(original.deliveries[0]);
    assert.match(x.s.pending.value.path, /d1\/replay$/);
    x.s.form.quota_per_minute = 1001;
    assert.equal(x.s.validate("client"), false);
    for (const url of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com:444/",
      "https://example.com/#x",
    ]) {
      x.s.form.target_url = url;
      assert.equal(x.s.validate("webhook"), false);
    }
    x.s.form.target_url = "https://example.com:443/hook";
    x.s.form.events = ["scoutops.test"];
    assert.equal(x.s.validate("webhook"), true);
    x.s.form.events = [];
    assert.equal(x.s.validate("webhook"), false);
    x.s.form.reason = "x".repeat(501);
    assert.equal(x.s.validate("client"), false);
    checks.push(
      "Actual Vue: create payload, frozen reason at prepare, revoke-only impact acknowledgement, full PATCH passthrough, test/replay reason body, quota/url/event/reason validation.",
    );
  }
  {
    const x = mount();
    const p = x.s.call("/platform/open/clients", "POST", { name: "synthetic" });
    await x.s.call("/platform/open/clients", "POST", {});
    assert.equal(x.calls.length, 1);
    x.s.organizationId.value = org;
    x.calls[0].resolve(response({ secret: "DESIGN-ONLY-NOT-A-KEY" }));
    await tick();
    assert.equal(x.calls.length, 2);
    assert.match(x.calls[1].url, /organization_id=/);
    x.calls[1].reject(new ApiClientError(503));
    await p;
    assert.match(x.s.notice.value, /操作成功/);
    assert.equal(x.s.secret.value.value, "DESIGN-ONLY-NOT-A-KEY");
    x.s.switchView("deliveries");
    assert.ok(x.s.secret.value);
    x.unmount[0]();
    assert.ok(x.s.secret.value);
    await x.s.copySecret();
    assert.match(x.s.notice.value, /手动保存/);
    assert.equal(x.calls[0].options.idempotencyKey, undefined);
    assert.match(await read(sourcePaths[8]), /options.idempotencyKey \?\? crypto.randomUUID\(\)/);
    checks.push(
      "Actual Vue: write single-flight, mutable post-write organization read, write success hides read failure, one-time secret persists across view/unmount, copy denial fallback; api-client allocates new key per manual invocation (static).",
    );
  }
  const svcBox = {
    URL,
    Date,
    randomUUID,
    randomBytes,
    createHash,
    sealCredential: () => ({
      ciphertext: "inert",
      nonce: "inert",
      authTag: "inert",
      fingerprint: "inert",
    }),
  };
  vm.runInNewContext(
    compile(strip(await read(sourcePaths[1]))) +
      "\nglobalThis.Service=OpenPlatformService;globalThis.Failure=OpenPlatformError;",
    svcBox,
  );
  {
    const inputs = [];
    const adapter = new Proxy(
      {},
      {
        get: (_t, method) => (i) => {
          inputs.push({ method, i });
          return i;
        },
      },
    );
    const service = new svcBox.Service(
      adapter,
      "inert",
      "inert",
      {
        clientTtlDays: 90,
        defaultQuota: 60,
        maxQuota: 500,
        timestampToleranceSeconds: 300,
        nonceTtlSeconds: 600,
      },
      () => new Date(original.observed_at),
    );
    for (const [key, statuses, sorts] of [
      [
        "client",
        ["all", "active", "expired", "revoked", "rotated"],
        ["updated_desc", "updated_asc", "name_asc", "name_desc"],
      ],
      [
        "webhook",
        ["all", "active", "disabled"],
        ["updated_desc", "updated_asc", "name_asc", "name_desc"],
      ],
      [
        "delivery",
        ["all", "queued", "leased", "retry_scheduled", "succeeded", "dead_letter"],
        ["updated_desc", "updated_asc", "attempts_desc"],
      ],
    ]) {
      for (const status of statuses)
        for (const sort of sorts)
          await service.overview({
            query: { [`${key}_status`]: status, [`${key}_sort`]: sort, [`${key}_page_size`]: 50 },
          });
    }
    for (const query of [
      { client_query: "x".repeat(121) },
      { client_page_size: 51 },
      { webhook_sort: "invented" },
      { delivery_status: "failed" },
      { organization_id: "bad" },
    ])
      await assert.rejects(service.overview({ query }), (e) => e.statusCode === 400);
    const value = {
      organization_id: org,
      name: "synthetic",
      reason: "一",
      scopes: ["status:read"],
      quota_per_minute: 501,
    };
    assert.throws(
      () => service.createClient({ value }),
      (e) => e.code === "client_quota_invalid",
    );
    value.quota_per_minute = 60;
    value.scopes = ["report:read"];
    assert.throws(
      () => service.createClient({ value }),
      (e) => e.code === "client_scope_invalid",
    );
    for (const events of [[], ["not.available"]])
      assert.throws(
        () =>
          service.createWebhook({
            value: { ...value, target_url: "https://example.com/hook", events },
          }),
        (e) => e.code === "webhook_events_invalid",
      );
    const hook = service.createWebhook({
      value: {
        ...value,
        target_url: "https://example.com:443/hook",
        events: ["scoutops.test", "scoutops.test"],
      },
    });
    assert.deepEqual(plain(hook.value.events), ["scoutops.test"]);
    assert.equal(hook.value.target_url, "https://example.com/hook");
    inputs.length = 0; // Do not retain generated test-only secret values in artifacts.
    checks.push(
      "Actual service: 50 valid status/sort combinations, 120-char query/50-page limit, UUID and invalid selection rejection, runtime maxQuota differs from UI 1000, status:read only and event deduplication/HTTPS normalization; inert sealing, no key persistence.",
    );
  }
  const repoBox = { Date, randomUUID, OpenPlatformError: svcBox.Failure };
  vm.runInNewContext(
    compile(strip(await read(sourcePaths[2]))) +
      "\nglobalThis.Repository=MySqlOpenPlatformRepository;",
    repoBox,
  );
  {
    const sql = [],
      filter = { query: "_%\\", status: "all", sort: "updated_desc", page: 3, pageSize: 20 };
    const r = new repoBox.Repository(
      {
        query: async (q, p) => {
          sql.push({ q, p });
          if (q.startsWith("SELECT COUNT"))
            return [[{ total: 1, active: 1, expired: 0, dead_letter: 1, retry_scheduled: 0 }]];
          return [[]];
        },
      },
      () => new Date(original.observed_at),
    );
    const result = await r.overview({
      organizationId: org,
      clients: filter,
      webhooks: { ...filter, page: 1 },
      deliveries: { ...filter, page: 2 },
    });
    assert.equal(result.pagination.clients.page, 3);
    assert.equal(result.pagination.clients.total_pages, 1);
    assert.equal(sql.length, 9);
    assert.equal(sql[0].p.at(-1), 40);
    assert.equal(sql[2].p.at(-1), 20);
    assert.ok(sql[0].p.includes("%\\_\\%\\\\%"));
    assert.ok(sql[2].p.includes("_%\\"));
    assert.ok(sql.slice(6).every((x) => !x.q.includes("LIKE")));
    assert.ok(!sql[0].q.includes("secret_hash"));
    assert.ok(!sql[1].q.includes("secret_ciphertext"));
    assert.match(sql[0].q, /ORDER BY c.updated_at DESC LIMIT/);
    checks.push(
      "Actual repository overview with inert SQL: nine reads, organization-only summaries, escaped substring versus full delivery ID, independent offsets, requested page beyond last preserved, explicit secret-free projections and non-ID updated sort; no SQL engine proof.",
    );
  }
  {
    const log = [];
    let replay = false;
    const c = {
      beginTransaction: async () => log.push("begin"),
      commit: async () => log.push("commit"),
      rollback: async () => log.push("rollback"),
      release: () => log.push("release"),
      query: async (q, p) => {
        log.push({ q, p });
        if (q.startsWith("SELECT result_json"))
          return [
            replay
              ? [{ result_json: JSON.stringify({ id: "synthetic", secret_visible_once: false }) }]
              : [],
          ];
        return [[]];
      },
    };
    const r = new repoBox.Repository(
      { getConnection: async () => c },
      () => new Date(original.observed_at),
    );
    const i = {
      id: "synthetic",
      actorId: org,
      route: "inert",
      idempotencyKey: "synthetic",
      value: {
        organization_id: org,
        scopes: ["status:read"],
        name: "synthetic",
        quota_per_minute: 60,
        secret: "DESIGN-ONLY",
        secret_hash: "inert",
        expires_at: new Date(original.observed_at),
      },
    };
    const first = await r.createClient(i);
    assert.equal(first.secret_visible_once, true);
    const stored = log.find((x) => x.q?.startsWith("UPDATE open_platform_operations"));
    assert.equal(JSON.parse(stored.p[0]).secret, undefined);
    assert.ok(log.some((x) => x.q?.includes("INSERT INTO outbox_events")));
    replay = true;
    log.length = 0;
    const second = await r.createClient(i);
    assert.equal(second.secret, undefined);
    assert.equal(second.idempotent_replay, true);
    assert.equal(log.filter((x) => x.q?.startsWith("INSERT")).length, 0);
    assert.equal(log.at(-1), "release");
    const route = await read(sourcePaths[3]);
    assert.match(route, /platform_token:manage/);
    assert.match(route, /requireIdempotencyKey\(r\)/);
    assert.match(route, /r.headers.origin !== o.webOrigin/);
    assert.equal((route.match(/reply.code\(202\)/g) || []).length, 2);
    const worker = await read(sourcePaths[4]);
    assert.match(worker, /response >= 200 && response < 300/);
    assert.match(worker, /Number\(row.attempt_count\) >= 4/);
    assert.equal((vue.match(/v-model(?:\.[\w]+)?=/g) || []).length, 9);
    checks.push(
      "Actual create repository first secret response versus secret-free idempotent replay, audit/outbox intent and connection release using inert transaction; nine Vue models and route origin/capability/202/Worker 2xx/fourth-failure boundaries static only.",
    );
  }
  const labels = mount().s;
  const labelLogic =
    "\nwindow.OPEN_LABELS={" +
    ["statusText", "scopeText", "eventText"].map((k) => `${k}:${labels[k].toString()}`).join(",") +
    "};\n";
  const sample = plain(original);
  const statuses = {
    clients: ["active", "expired", "revoked", "rotated"],
    webhooks: ["active", "disabled"],
    deliveries: ["dead_letter", "succeeded", "queued", "leased", "retry_scheduled"],
  };
  for (const key of Object.keys(statuses))
    sample[key] = statuses[key].map((status, index) => ({
      ...plain(original[key][0]),
      id: `00000000-0000-4000-8000-${String(6000 + index + (key === "clients" ? 0 : key === "webhooks" ? 100 : 200)).padStart(12, "0")}`,
      status,
      ...(key === "clients"
        ? {
            name: ["系统状态读取", "已到期接入", "已撤销接入", "已轮换旧账号"][index],
            expires_at: index === 1 ? "2026-08-01T00:00:00Z" : "2026-11-01T00:00:00Z",
          }
        : key === "webhooks"
          ? {
              name: index ? "已停用的审批回调" : "任务协同事件回调",
              events: ["scoutops.test", "task.updated", "approval.updated", "competitor.changed"],
            }
          : {
              endpoint_name: "任务协同事件回调",
              attempt_count: [4, 1, 0, 1, 2][index],
              response_status: index === 1 ? 204 : index === 4 ? 503 : null,
              last_error_code: index === 0 ? "webhook_timeout" : index === 4 ? "http_503" : null,
            }),
    }));
  sample.summary = {
    clients: { total: 4, active: 1, expired: 1 },
    webhooks: { total: 2, active: 1 },
    deliveries: { total: 5, dead_letter: 1, retry_scheduled: 1 },
  };
  sample.observed_at = "2026-09-09T04:00:00Z";
  for (const k of Object.keys(statuses))
    sample.pagination[k] = { page: 1, page_size: 20, total: sample[k].length, total_pages: 1 };
  return {
    data: { original, sample, org, statuses, sourcePaths, sourceChecks: checks },
    logic: logic + labelLogic,
  };
}
