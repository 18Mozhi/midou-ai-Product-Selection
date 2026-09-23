import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";

export async function buildApiCoverageDesignData(repo) {
  const sourcePaths = [
    "apps/api/src/api-coverage-dashboard.ts",
    "apps/web/src/components/ApiCoverageDashboard.vue",
    "apps/web/src/components/PlatformManagementCenter.vue",
    "apps/web/src/components/PlatformManagementFilter.vue",
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "apps/web/src/components/use-platform-content-list.ts",
    "apps/web/src/components/use-platform-notification-list.ts",
    "apps/api/src/platform-dashboard-service.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "apps/api/src/platform-dashboard-routes.ts",
    "config/route-catalog.json",
    "config/api-coverage-metadata.json",
    "docs/openapi.yaml",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "tests/m06-02/api-coverage-dashboard.test.mjs",
  ];
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    plain = (v) => JSON.parse(JSON.stringify(v));
  const ast = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const strip = (s) =>
    ast(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const openapiSource = await read(sourcePaths[12]),
    routeCatalog = JSON.parse(await read(sourcePaths[10])),
    metadata = JSON.parse(await read(sourcePaths[11]));
  const now = new Date("2026-09-09T04:00:00.000Z"),
    source = await read(sourcePaths[0]);
  const box = {
    createHash,
    Date,
    readFile: async () => {
      throw new Error("No filesystem report access in isolated builder");
    },
  };
  vm.runInNewContext(
    compile(strip(source)) +
      "\nglobalThis.api={parseOpenApiCoverage,apiOperationId,apiCoverageFingerprint,buildApiCoverageDashboard,readApiCoverageDashboard};",
    box,
  );
  const api = box.api,
    parsed = api.parseOpenApiCoverage(openapiSource),
    fingerprint = api.apiCoverageFingerprint(openapiSource);
  const base = { openapiSource, routeCatalog, metadata, now };
  const build = (extra = {}) => plain(api.buildApiCoverageDashboard({ ...base, ...extra }));
  const dimensions = ["normal", "authorization", "parameters", "idempotency", "fault"];
  const outcomes = ["success", "empty", "unauthorized", "blocked", "unauthenticated"];
  const chosen = [
    ...parsed.operations.slice(0, 4),
    parsed.operations.find((o) => o.has_idempotency_key),
    parsed.operations.find((o) => o.has_request_body && o.required_capability),
  ];
  assert.equal(new Set(chosen.map(api.apiOperationId)).size, 6);
  const report = {
    schema_version: 3,
    operation_id_policy: "method_path_v1",
    path_count: parsed.paths.length,
    operation_count: parsed.operations.length,
    catalog_fingerprint: fingerprint,
    captured_at: "2026-09-09T03:00:00.000Z",
    build_sha: "synthetic-unverified-build",
    operations: chosen.map((o, i) => ({
      operation_id: api.apiOperationId(o),
      method: o.method,
      path_template: o.path,
      role: routeCatalog.productionAcceptance.roles[i].role,
      status: [200, 200, 403, 503, 401, null][i],
      outcome: outcomes[i] || "not_run",
      request_id: `synthetic-request-${i}`,
      trace_id: `synthetic-trace-${i}`,
      evidence: Object.fromEntries(
        dimensions.map((key, j) => {
          const applicable =
            key === "authorization"
              ? !o.is_public
              : key === "parameters"
                ? o.has_parameters || o.has_request_body
                : key === "idempotency"
                  ? o.has_idempotency_key
                  : true;
          return [
            key,
            {
              applicable,
              status: !applicable
                ? "not_applicable"
                : i === 5
                  ? "not_run"
                  : j === 0
                    ? i < 2
                      ? "passed"
                      : "failed"
                    : i === 4 && j === 3
                      ? "passed"
                      : "not_run",
              test_id: applicable && i !== 5 && j === 0 ? `synthetic-only-${key}-${i}` : null,
              latest_result:
                applicable && i !== 5 && j === 0
                  ? `示例回执 ${[200, 200, 403, 503, 401][i]}，未访问真实接口`
                  : null,
            },
          ];
        }),
      ),
    })),
  };
  const current = build({ report }),
    checks = [];
  assert.equal(current.summary.operations, parsed.operations.length);
  assert.equal(current.by_role.length, 6);
  assert.equal(current.summary.verified, 5);
  assert.equal(current.report_status, "current");
  assert.equal(current.age_seconds, 3600);
  assert.equal(
    current.by_role.reduce((n, r) => n + r.verified, 0),
    6,
  ); // A role recorded on not_run differs from outcome-based overall verified.
  checks.push(
    "Actual full catalog builder: current path/operation/unique IDs computed from YAML; five recorded outcomes include rejected/blocked; six role-associated operations include a not_run entry; overall and role verified are different measures; one-hour age is not expiry.",
  );
  const datasets = {
    current,
    missing: build(),
    invalid: build({ reportInvalid: true }),
    outdated: build({ report: { ...report, catalog_fingerprint: "0".repeat(64) } }),
  };
  {
    for (const change of [
      { schema_version: 2 },
      { operation_id_policy: "other" },
      { path_count: 0 },
      { operation_count: 0 },
      { catalog_fingerprint: "mismatch" },
    ]) {
      const r = build({ report: { ...report, ...change } });
      assert.equal(r.report_status, "outdated");
      assert.equal(r.summary.verified, 0);
    }
    const changed = plain(report);
    changed.operations[0].operation_id = "wrong";
    assert.equal(build({ report: changed }).operations[0].outcome, "not_run");
    const mismatch = plain(report);
    mismatch.operations[0].evidence.normal.applicable = false;
    assert.equal(build({ report: mismatch }).operations[0].evidence.normal.status, "not_run");
    assert.equal(
      build({ report: { ...report, build_sha: "another-build" } }).report_status,
      "current",
    );
    const meta = plain(metadata);
    meta.default.dataSource = "different-declaration";
    assert.equal(build({ metadata: meta, report }).catalog_fingerprint, fingerprint);
    const changedCapability = openapiSource.replace(
      /x-required-capability:\s*\S+/,
      "x-required-capability: synthetic:changed",
    );
    assert.equal(api.apiCoverageFingerprint(changedCapability), fingerprint);
    const future = build({ report: { ...report, captured_at: "2026-09-10T00:00:00Z" } });
    assert.equal(future.age_seconds, 0);
    datasets["wrong-operation-id"] = build({ report: changed });
    datasets["wrong-applicability"] = build({ report: mismatch });
    datasets["different-build"] = build({ report: { ...report, build_sha: "another-build" } });
    checks.push(
      "Actual builder: five header mismatches discard current evidence, operation-ID/applicability mismatch resets only relevant item; build SHA and same-method/path capability/metadata changes are not in catalog fingerprint; future age clamps to zero.",
    );
  }
  const filter = (data, q = "", status = "") =>
    data.operations.filter(
      (o) =>
        (!status || o.outcome === status) &&
        `${o.operation_id} ${o.method} ${o.path} ${o.required_capability ?? ""} ${o.data_source} ${o.ui_consumers.join(" ")} ${o.crawler_side_effect}`
          .toLocaleLowerCase()
          .includes(q.trim().toLocaleLowerCase()),
    );
  const queries = [
    "/health",
    "POST",
    "platform:superadmin",
    "runtime_health",
    "/platform-admin/status",
    "crawler_dispatch",
    "synthetic-only-normal-0",
    "示例回执",
    "no-such-operation",
  ];
  const queryExpected = {};
  for (const q of queries) {
    const result = build({ report, query: q });
    assert.deepEqual(result.summary, current.summary);
    assert.deepEqual(result.operations, filter(current, q));
    queryExpected[q] = result.operations.map((o) => o.operation_id);
  }
  assert.equal(queryExpected["synthetic-only-normal-0"].length, 0);
  assert.equal(queryExpected["示例回执"].length, 0);
  for (const s of [...outcomes, "not_run"]) {
    const r = build({ report, status: s });
    assert.deepEqual(r.summary, current.summary);
    assert.ok(r.operations.every((o) => o.outcome === s));
  }
  const manyOpenapi =
    "paths:\n" +
    Array.from({ length: 301 }, (_, i) => `  /synthetic/${i}:\n    get:\n      security: []`).join(
      "\n",
    );
  datasets.limit = build({ openapiSource: manyOpenapi });
  assert.equal(datasets.limit.total_filtered, 301);
  assert.equal(datasets.limit.operations.length, 300);
  const collision = "paths:\n  /synthetic-a:\n    get:\n  /synthetic_a:\n    get:\n";
  assert.throws(() => build({ openapiSource: collision }), /operation_id_collision/);
  const selectedRule = metadata.rules.find((r) => r.prefix === "/platform/crawler-runtime");
  const specific = current.operations.find((o) => o.path.startsWith(selectedRule.prefix));
  assert.ok(specific);
  assert.equal(specific.data_source, selectedRule.dataSource);
  checks.push(
    "Actual builder: query/status do not alter whole-catalog summaries, seven searchable fields exclude test ID/latest result, all six outcomes filter, longest metadata prefix wins, 301 synthetic operations return 300 without pagination, operation-ID collision fails.",
  );
  {
    const files = {
      openapi: openapiSource,
      catalog: JSON.stringify(routeCatalog),
      metadata: JSON.stringify(metadata),
      report: "",
    };
    box.readFile = async (p) => {
      if (p === "missing") throw new Error("unreadable");
      return files[p];
    };
    const args = {
      openapiFile: "openapi",
      routeCatalogFile: "catalog",
      metadataFile: "metadata",
      reportFile: "report",
      now,
    };
    assert.equal((await api.readApiCoverageDashboard(args)).report_status, "missing");
    files.report = "{";
    assert.equal((await api.readApiCoverageDashboard(args)).report_status, "invalid");
    assert.equal(
      (await api.readApiCoverageDashboard({ ...args, reportFile: "missing" })).report_status,
      "missing",
    );
    files.report = JSON.stringify(report);
    assert.equal((await api.readApiCoverageDashboard(args)).report_status, "current");
    files.metadata = "{";
    await assert.rejects(api.readApiCoverageDashboard(args));
    checks.push(
      "Actual read function with in-memory readFile: empty/unreadable report is missing, malformed JSON invalid, matching JSON current; invalid required metadata rejects. No production report path was accessed.",
    );
  }
  const parent = await read(sourcePaths[2]),
    parentAst = ast(parent.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const funcs = ["api", "load"]
    .map((name) =>
      parentAst.statements
        .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === name)
        .getText(parentAst),
    )
    .join("\n");
  class ApiClientError extends Error {
    constructor(status) {
      super("isolated");
      this.status = status;
      this.actionHint = "隔离读取被拒绝";
      this.requestId = "isolated-error";
    }
  }
  function mount() {
    const calls = [],
      bindings = {
        domain: { value: "api-coverage" },
        apiDomain: { value: "api_coverage" },
        state: { value: "ready" },
        refreshing: { value: false },
        message: { value: "" },
        query: { value: "" },
        status: { value: "" },
        requestId: { value: "" },
        data: { value: plain(current) },
        notificationList: { load: async () => false },
        loadContent: async () => false,
        loadStatus: async () => false,
        ApiClientError,
        DOMException,
        Error,
        URLSearchParams,
        request: (url, options) =>
          new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      };
    const b = { ...bindings };
    vm.runInNewContext(compile(funcs) + "\nglobalThis.f={api,load};", b);
    return { ...bindings, f: b.f, calls };
  }
  const tick = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  {
    const x = mount(),
      first = x.f.load();
    await tick();
    x.query.value = "new";
    const second = x.f.load();
    await tick();
    assert.equal(x.calls.length, 2);
    assert.equal(x.calls[0].options.signal, undefined);
    x.calls[1].resolve({ data: { ...current, marker: "new" }, request_id: "new" });
    await second;
    assert.equal(x.refreshing.value, false);
    x.calls[0].resolve({ data: { ...current, marker: "old" }, request_id: "old" });
    await first;
    assert.equal(x.data.value.marker, "old");
    assert.equal(x.query.value, "new");
    const denied = x.f.load();
    await tick();
    x.calls[2].reject(new ApiClientError(403));
    await denied;
    assert.equal(x.state.value, "error");
    assert.equal(x.data.value.marker, "old");
    assert.equal(x.requestId.value, "isolated-error");
    const y = mount();
    const pending = y.f.load();
    await tick();
    y.domain.value = "email";
    y.apiDomain.value = "email";
    y.calls[0].resolve({ data: plain(current), request_id: "cross" });
    await pending;
    assert.equal(y.data.value.domain, "api_coverage");
    assert.equal(y.domain.value, "email");
    checks.push(
      "Actual parent api/load extracted AST: concurrent reads, no signal/timeout, earlier completion clears busy while another is pending, old response overwrites newer query result, 403 reduced to generic error while old data hidden, late api_coverage data written after domain becomes email; isolated functions, not mounted Vue lifecycle.",
    );
  }
  {
    const serviceAst = ast(await read(sourcePaths[7])),
      cls = serviceAst.statements.find(
        (n) => ts.isClassDeclaration(n) && n.name.text === "PlatformDashboardService",
      ),
      method = cls.members.find((n) => n.name?.getText(serviceAst) === "management");
    class Failure extends Error {
      constructor(code, statusCode) {
        super(code);
        this.statusCode = statusCode;
      }
    }
    const b = { PlatformDashboardError: Failure };
    vm.runInNewContext(compile(`globalThis.Service=class {${method.getText(serviceAst)}}`), b);
    const svc = new b.Service();
    svc.repository = { readManagement: (i) => i };
    const r = svc.management({
      domain: "api_coverage",
      query: "  /health  ",
      status: "unauthenticated",
      page: 1000,
    });
    assert.equal(r.query, "/health");
    assert.equal(r.status, "unauthenticated");
    assert.throws(() => svc.management({ domain: "api_coverage", query: "x".repeat(121) }));
    assert.throws(() => svc.management({ domain: "api_coverage", status: "x".repeat(41) }));
    const route = routeCatalog.routes.find((r) => r.path === "/platform-admin/api-coverage");
    assert.deepEqual(route.capabilities, ["platform:superadmin"]);
    assert.equal(route.navigation, undefined);
    const filterVue = await read(sourcePaths[3]);
    const opts = filterVue.split("domain === 'api-coverage'\"")[1];
    assert.ok(opts);
    assert.ok(!opts.split("</template>")[0].includes('value="unauthenticated"'));
    assert.match(
      await read(sourcePaths[9]),
      /query\?\.domain === "api_coverage" \? "platform:superadmin"/,
    );
    const content = await read(sourcePaths[5]);
    assert.match(
      content,
      /function applyFilters\(\) \{\s*appliedQuery.value = options.query.value.trim\(\);\s*appliedStatus.value = options.status.value;\s*page.value = 1;\s*options.reload\(\)/,
    );
    assert.match(
      await read(sourcePaths[6]),
      /domain.value !== "notifications"\) return options.fallbackApply\?\.\(\)/,
    );
    checks.push(
      "Actual service management method: trimmed query/status 120/40 limits, status not allowlisted for this domain; static route has superadmin/no navigation, UI omits unauthenticated filter, shared apply/reset delegate without P63 URL persistence or pagination.",
    );
  }
  const component = await read(sourcePaths[1]);
  const script = component.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  const labelBox = { defineProps: () => {} };
  vm.runInNewContext(
    compile(strip(script)) + "\nglobalThis.labels={outcomeName,sourceName,dimensionName};",
    labelBox,
  );
  const logic =
    "window.COVERAGE_LABELS={" +
    Object.entries(labelBox.labels)
      .map(([k, v]) => `${k}:${v.toString()}`)
      .join(",") +
    "};\n";
  const testAst = ast(await read(sourcePaths[13]));
  let initializer, operationFixtureInitializer;
  function visit(n) {
    if (
      ts.isVariableDeclaration(n) &&
      n.name.getText(testAst) === "operationFixture" &&
      n.initializer
    )
      operationFixtureInitializer = n.initializer;
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(testAst) === "env" &&
      n.arguments[0] &&
      ts.isObjectLiteralExpression(n.arguments[0]) &&
      n.arguments[0].properties.some(
        (p) =>
          p.name?.getText(testAst) === "domain" &&
          p.initializer?.getText(testAst) === '"api_coverage"',
      )
    )
      initializer = n.arguments[0];
    ts.forEachChild(n, visit);
  }
  visit(testAst);
  assert.ok(initializer);
  assert.ok(operationFixtureInitializer);
  const originalBox = {};
  vm.runInNewContext(
    compile(
      "const operationFixture=" +
        operationFixtureInitializer.getText(testAst) +
        ";globalThis.fixture=" +
        initializer.getText(testAst),
    ),
    originalBox,
  );
  datasets.original = plain(originalBox.fixture);
  const long = plain(current);
  const chosenRecord = long.operations.find((o) => o.evidence.idempotency.applicable);
  chosenRecord.path = "/synthetic/" + "long-operation-path/".repeat(18);
  chosenRecord.operation_id = "synthetic_long_" + "identifier_".repeat(12);
  chosenRecord.evidence.normal.latest_result = "合成长证据文本。".repeat(100);
  datasets.long = long;
  const limitPool = [
    ...datasets.limit.operations,
    ...build({ openapiSource: manyOpenapi, query: "/synthetic/300" }).operations,
  ];
  return {
    data: {
      datasets,
      limitPool,
      queryExpected,
      sourcePaths,
      sourceChecks: checks,
      dimensions,
      chosenIds: chosen.map(api.apiOperationId),
      catalog: { paths: parsed.paths.length, operations: parsed.operations.length, fingerprint },
      longId: chosenRecord.operation_id,
    },
    logic,
  };
}
