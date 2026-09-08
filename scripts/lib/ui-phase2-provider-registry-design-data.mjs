import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildProviderRegistryDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    plain = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const strip = (ast) =>
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast).replace(/^\s*export /, "\n"))
      .join("\n");
  const transpile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const script = (s) => s.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  const fixture = parse(await read("tests/e2e/m03-01-provider-registry.spec.ts"));
  const declarations = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const names = ["definition", "blockedDefinition", "definitions"];
  const fixtureBox = {};
  vm.runInNewContext(
    names
      .map((name) => {
        const n = declarations.find((n) => n.name.getText(fixture) === name);
        assert.ok(n);
        return `const ${name}=${n.initializer.getText(fixture)};`;
      })
      .join("\n") + "globalThis.result={definition,blockedDefinition,definitions};",
    fixtureBox,
  );
  const original = plain(fixtureBox.result);
  assert.equal(original.definitions.length, 25);
  const vue = parse(script(await read("apps/web/src/components/ProviderRegistry.vue")));
  const save = vue.statements.find((n) => ts.isFunctionDeclaration(n) && n.name.text === "save");
  const bodyDeclaration = save.body.statements.find(
    (n) =>
      ts.isVariableStatement(n) && n.declarationList.declarations[0].name.getText(vue) === "body",
  );
  assert.ok(bodyDeclaration);
  const exports =
    "state,items,requestId,loadMessage,refreshing,successMessage,editing,editorOpen,editorStep,saving,message,searchQuery,statusFilter,accessModeFilter,admissionFilter,sortOrder,page,pageSize,form,steps,stepForField,failure,accessModeText,providerStatusText,termsStatusText,admission,filteredItems,pageCount,visibleItems,enabledCount,blockedCount,inactiveCount,list,validHttpUrl,formErrors,currentStepErrors,load,edit,closeEditor,applyTemplate,nextStep,save,resetFilters";
  const sourceLogic = `// Generated from actual ProviderRegistry script; inert bridge, not mounted Vue. Do not hand-edit.\nwindow.PROVIDER_C_SOURCE = (bridge) => {\nconst {ref,computed,reactive,watch,nextTick,onMounted,onBeforeUnmount,ApiClientError,Date,window,document,HTMLElement,AbortController,URL}=bridge;\nconst defineProps=()=>({apiBaseUrl:""}),createApiClient=()=>bridge.request;\n${transpile(strip(vue))}\nfunction buildRequest(){${transpile(bodyDeclaration.getFullText(vue))}\nreturn {path,method:editing.value?"PUT":"POST",body};}\nreturn {${exports},buildRequest};\n};\n`;
  const box = { window: {} };
  vm.runInNewContext(sourceLogic, box);
  const reviewClock = "2026-09-09T01:20:00.000Z";
  class ReviewDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [reviewClock]));
    }
    static now() {
      return new Date(reviewClock).getTime();
    }
  }
  class ApiClientError extends Error {
    constructor(status, hint) {
      super(hint);
      this.status = status;
      this.actionHint = hint;
      this.requestId = "synthetic-request";
    }
  }
  function model() {
    const reads = [],
      watches = [],
      timers = [],
      hooks = [];
    const m = box.window.PROVIDER_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      reactive: (v) => v,
      watch: (source, cb) => watches.push(cb),
      nextTick: (cb) => Promise.resolve().then(() => cb?.()),
      onMounted() {},
      onBeforeUnmount: (cb) => hooks.push(cb),
      ApiClientError,
      Date: ReviewDate,
      URL,
      AbortController,
      HTMLElement: class {},
      document: { activeElement: null },
      window: {
        setTimeout: (cb, ms) => {
          timers.push({ cb, ms });
          return timers.length;
        },
        clearTimeout() {},
      },
      request: (url, options) =>
        new Promise((resolve, reject) => reads.push({ url, options, resolve, reject })),
    });
    return { m, reads, watches, timers, hooks };
  }
  const { m, watches } = model();
  m.items.value = original.definitions;
  assert.equal(m.enabledCount.value, 1);
  assert.equal(m.blockedCount.value, 1);
  assert.equal(m.inactiveCount.value, 24);
  const listCases = [];
  for (const order of ["name_asc", "updated_desc", "status"]) {
    m.sortOrder.value = order;
    listCases.push({ order, ids: plain(m.filteredItems.value.map((r) => r.id)) });
    assert.equal(m.visibleItems.value.length, 20);
    m.page.value = 2;
    assert.equal(m.visibleItems.value.length, 5);
    m.page.value = 1;
  }
  for (const q of ["PUBLIC_SIGNAL", "公开趋势", "CA", "en-US", "平台运营"]) {
    m.searchQuery.value = q;
    assert.ok(m.filteredItems.value.length > 0);
  }
  m.searchQuery.value = "example.test";
  assert.equal(m.filteredItems.value.length, 0); // Target URL is not a search field.
  m.resetFilters();
  m.admissionFilter.value = "blocked";
  assert.equal(m.filteredItems.value.length, 1);
  m.page.value = 2;
  watches[0]();
  assert.equal(m.page.value, 1);
  m.resetFilters();
  const admissionCases = [
    ["disabled", original.definition, "inactive"],
    ["pending", original.blockedDefinition, "blocked"],
    ["approved", { ...original.definition, status: "enabled" }, "compliant"],
    [
      "rejected",
      { ...original.definition, status: "enabled", terms_review_status: "rejected" },
      "blocked",
    ],
    ["missing", { ...original.definition, status: "enabled", terms_version: null }, "blocked"],
    [
      "expired",
      { ...original.definition, status: "enabled", terms_expires_at: "2026-01-01T00:00:00Z" },
      "blocked",
    ],
    [
      "browser",
      { ...original.definition, status: "enabled", access_mode: "authenticated_browser" },
      "runtime_gate",
    ],
    ["import", { ...original.definition, status: "enabled", access_mode: "import" }, "registered"],
    ["manual", { ...original.definition, status: "enabled", access_mode: "manual" }, "registered"],
  ].map(([key, item, state]) => {
    const result = plain(m.admission(item));
    assert.equal(result.state, state);
    return { key, item, result };
  });
  m.edit();
  const defaults = plain(m.form);
  assert.equal(Object.keys(defaults).length, 23);
  assert.equal(m.form.status, "disabled");
  assert.equal(Object.keys(m.formErrors.value).length, 3);
  m.nextStep();
  assert.equal(m.editorStep.value, 1);
  const validDraft = {
    ...defaults,
    code: "synthetic_source",
    name: "合成来源定义",
    target_url: "https://example.test/feed",
  };
  Object.assign(m.form, validDraft);
  assert.deepEqual(plain(m.formErrors.value), {});
  m.nextStep();
  assert.equal(m.editorStep.value, 2);
  const post = plain(m.buildRequest());
  assert.equal(post.method, "POST");
  assert.equal(post.body.healthcheck_url, null);
  assert.equal(post.body.terms_expires_at, null);
  const bounds = {
    schedule_minutes: [1, 10080],
    concurrency_limit: [1, 20],
    timeout_ms: [1000, 120000],
    retry_limit: [0, 10],
    circuit_failure_threshold: [1, 20],
    retention_days: [1, 3650],
  };
  for (const [field, [min, max]] of Object.entries(bounds)) {
    for (const v of [min, max]) {
      Object.assign(m.form, validDraft, { [field]: v });
      assert.equal(m.formErrors.value[field], undefined);
    }
    for (const v of [min - 1, max + 1, min + 0.5, ""]) {
      Object.assign(m.form, validDraft, { [field]: v });
      assert.ok(m.formErrors.value[field]);
    }
  }
  const invalidFields = {
    code: "Bad-Code",
    name: "a",
    target_url: "ftp://example.test",
    owner_label: "a",
    markets: "",
    languages: "",
    fields: "",
    dedupe_key: "",
    parser_version: "v 1",
    healthcheck_url: "ftp://example.test",
    failure_rules: "",
    terms_reference_url: "http://example.test",
    terms_version: "bad version",
    terms_expires_at: "not-a-date",
  };
  for (const [field, value] of Object.entries(invalidFields)) {
    Object.assign(m.form, validDraft, { [field]: value });
    assert.ok(m.formErrors.value[field], field);
  }
  for (const field of ["markets", "languages", "fields", "failure_rules"]) {
    Object.assign(m.form, validDraft, {
      [field]: Array.from({ length: 101 }, (_, i) => `item${i}`).join(","),
    });
    assert.ok(m.formErrors.value[field]);
  }
  Object.assign(m.form, validDraft, { status: "enabled" });
  assert.deepEqual(Object.keys(m.formErrors.value).sort(), [
    "terms_expires_at",
    "terms_reference_url",
    "terms_version",
  ]);
  const modes = ["public_page", "public_rss", "authenticated_browser", "import", "manual"],
    templates = {};
  for (const mode of modes) {
    Object.assign(m.form, validDraft, { access_mode: mode, schedule_minutes: 99 });
    m.applyTemplate();
    templates[mode] = plain(m.form);
    assert.equal(m.form.schedule_minutes, 30);
    assert.equal(m.form.name, validDraft.name);
    assert.equal(m.form.status, "disabled");
  }
  m.edit(original.definition);
  const put = plain(m.buildRequest());
  assert.equal(put.body.expected_version, 1);
  assert.equal(m.form.terms_expires_at, "2027-08-07T17:00");
  assert.equal(put.body.id, original.definition.id); // Actual spreading contract includes read-only fields.
  m.closeEditor();
  m.edit();
  Object.assign(m.form, validDraft);
  const editToCreate = plain(m.buildRequest());
  assert.equal(editToCreate.method, "POST");
  assert.equal(editToCreate.body.id, original.definition.id);
  assert.equal(editToCreate.body.version, 1);
  const saveCase = model();
  saveCase.m.items.value = original.definitions;
  saveCase.m.edit();
  Object.assign(saveCase.m.form, validDraft);
  const promise = saveCase.m.save();
  await saveCase.m.save();
  assert.equal(saveCase.reads.length, 1);
  saveCase.m.closeEditor();
  saveCase.m.edit(original.blockedDefinition); // New editor while old POST is pending.
  saveCase.reads[0].resolve({ request_id: "synthetic-save", data: {} });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(saveCase.m.editorOpen.value, false);
  assert.equal(saveCase.reads[1].url, "/platform/providers");
  saveCase.reads[1].reject(new ApiClientError(503, "读取失败"));
  await promise;
  assert.match(saveCase.m.loadMessage.value, /保留/);
  assert.match(saveCase.m.successMessage.value, /列表已刷新/);
  const race = model(),
    old = race.m.load(),
    newer = race.m.load();
  assert.equal(race.reads[0].options.signal.aborted, true);
  race.reads[1].resolve({ data: [original.blockedDefinition], request_id: "new" });
  await newer;
  race.reads[0].resolve({ data: [original.definition], request_id: "old" });
  await old;
  assert.equal(race.m.items.value[0].id, original.definition.id); // Request implementation that resolves after abort demonstrates missing success ownership check.
  assert.equal(race.timers[0].ms, 12000);
  const serviceBox = { URL, Date: ReviewDate, randomUUID: () => "synthetic-service-id" };
  vm.runInNewContext(
    transpile(strip(parse(await read("apps/api/src/provider-registry-service.ts")))) +
      "globalThis.Service=ProviderRegistryService;",
    serviceBox,
  );
  const writes = [],
    service = new serviceBox.Service(
      {
        list: async () => original.definitions,
        create: (v) => {
          writes.push(v);
          return v;
        },
        update: (v) => {
          writes.push(v);
          return v;
        },
      },
      () => new ReviewDate(),
    );
  const ctx = {
    actorId: "synthetic-actor",
    idempotencyKey: "synthetic-key",
    requestId: "synthetic-request",
    traceId: "synthetic-trace",
  };
  const normalized = service.create({ ...post.body, markets: [" US ", "US", "CA"] }, ctx);
  assert.deepEqual(plain(normalized.value.markets), ["US", "CA"]);
  assert.equal(normalized.value.terms_reviewed_at, null);
  assert.throws(
    () => service.update(original.definition.id, post.body, 0, ctx),
    (e) => e.code === "provider_version_invalid",
  );
  assert.throws(
    () => service.create({ ...post.body, status: "enabled" }, ctx),
    (e) => e.code === "public_source_compliance_required",
  );
  service.create(
    { ...post.body, target_url: "https://synthetic-user:synthetic-pass@example.test/feed" },
    ctx,
  );
  Object.assign(m.form, validDraft, {
    target_url: "https://synthetic-user:synthetic-pass@example.test/feed",
  });
  assert.ok(m.formErrors.value.target_url); // No real credentials; demonstrates validator difference without network.
  const fields = [
    ["code", "来源代码（技术标识）", 1],
    ["name", "名称", 1],
    ["target_url", "目标 URL", 1],
    ["owner_label", "负责人", 1],
    ["access_mode", "接入模式", 1],
    ["markets", "市场", 2],
    ["languages", "语言", 2],
    ["fields", "字段清单", 2],
    ["dedupe_key", "去重键", 2],
    ["parser_version", "解析器版本", 2],
    ["healthcheck_url", "健康检查 URL", 2],
    ["schedule_minutes", "频率（分钟）", 3],
    ["concurrency_limit", "并发", 3],
    ["timeout_ms", "超时 ms", 3],
    ["retry_limit", "重试", 3],
    ["circuit_failure_threshold", "熔断阈值", 3],
    ["retention_days", "保留天数", 3],
    ["failure_rules", "失败规则", 3],
    ["terms_review_status", "平台条款复核", 4],
    ["status", "发布状态", 4],
    ["terms_reference_url", "条款参考 URL", 4],
    ["terms_version", "条款版本", 4],
    ["terms_expires_at", "条款到期时间", 4],
  ].map(([key, label, step]) => ({ key, label, step }));
  assert.deepEqual(fields.map((f) => f.key).sort(), Object.keys(defaults).sort());
  const data = {
    ...original,
    reviewClock,
    modes,
    fields,
    bounds,
    defaults,
    validDraft,
    templates,
    post,
    put,
    editToCreate,
    listCases,
    admissionCases,
    checks: [
      "Original 25-row fixture: 20/5 pages, 25/1/1/24 global metrics; actual computed three full ID sort sequences and search excludes target URL",
      "Actual 23-field form errors, six numeric bounds, list limits, template five modes, step validation and source-built POST/PUT",
      "Actual save spreads read-only fields and edit-to-create retains id/version; expiry slices UTC text and reparses local time",
      "Actual inert save: duplicate suppressed, old success closes new editor, reload failure still produces list-refreshed message",
      "Actual inert load: a request resolving after abort can overwrite newer results; 12000ms configured timeout",
      "Actual service validates public enabled terms, expected_version, array deduplication; frontend/server URL differences preserved",
      "No mounted Vue, real API, MySQL, permission or production execution; blueprint admission discrepancy remains PR-G01",
    ],
    sourcePaths: [
      "apps/web/src/components/ProviderRegistry.vue",
      "apps/web/src/components/ProviderRuntimeSurface.vue",
      "apps/web/src/components/ResponsiveDataView.vue",
      "apps/web/src/components/TableViewControls.vue",
      "apps/web/src/components/UiStatePanel.vue",
      "apps/web/src/ui/state-contract.ts",
      "apps/api/src/provider-registry-service.ts",
      "apps/api/src/provider-registry-routes.ts",
      "apps/api/src/mysql-provider-registry-repository.ts",
      "tests/e2e/m03-01-provider-registry.spec.ts",
    ],
  };
  return { data, sourceLogic };
}
