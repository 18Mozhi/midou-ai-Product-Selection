import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildReportDesignData(repo) {
  const read = (f) => readFile(path.join(repo, f), "utf8");
  function extract(source, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(code, bindings = {}) {
    const box = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/m05-06-reports.spec.ts"),
    routes = new Map();
  await run(
    `${["org", "ws", "envelope", "reports"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} ${extract(fixture, "setup", "function")} export const result=setup(page);`,
    { page: { route: async (key, fn) => routes.set(key, fn) } },
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
  const reports = Object.fromEntries(
      await Promise.all(
        ["opportunity", "trend", "team"].map(async (t) => [
          t,
          await response(`**/api/v1/reports/${t}`),
        ]),
      ),
    ),
    exports = await response("**/api/v1/report-exports"),
    replacement = await response("**/api/v1/report-exports/00000000-0000-4000-8000-000000000566"),
    vue = await read("apps/web/src/components/ReportCenter.vue"),
    script = vue.split('<script setup lang="ts">')[1].split("</script>")[0],
    ast = ts.createSourceFile("component.ts", script, ts.ScriptTarget.Latest, true),
    source = ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n");
  class FixedDate extends Date {
    static now() {
      return new Date("2026-09-08T00:00:00Z").valueOf();
    }
  }
  const calls = [],
    navigation = [],
    route = { query: { context: "review" } };
  const h = run(
    `export const h=(()=>{${source}\nreturn {type,report,exports,labels,metricLabel,seriesLabel,statusLabel,isExpired,canRegenerate,format,choose,createExport,regenerate,closeDetail,selectedExport,setDetailQuery};})();`,
    {
      Date: FixedDate,
      defineProps: () => ({ apiBaseUrl: "/api/v1" }),
      useRoute: () => route,
      useRouter: () => ({
        push: async (v) => navigation.push({ method: "push", ...plain(v) }),
        replace: async (v) => navigation.push({ method: "replace", ...plain(v) }),
      }),
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: () => {},
      onMounted: () => {},
      onUnmounted: () => {},
      useModalDialog: () => ({ dialogElement: { value: null }, handleCancel: () => {} }),
      createApiClient:
        () =>
        async (url, options = {}) => {
          calls.push(plain({ url, ...options }));
          return {
            request_id: "source-fixture",
            data:
              options.method === "POST"
                ? replacement
                : url === "/report-exports"
                  ? exports
                  : reports[url.split("/").at(-1)],
          };
        },
      createApiResponseClient: () => () => {
        throw new Error("raw download is not invoked by data builder");
      },
      ApiClientError: class extends Error {},
      rethrowUnexpectedError: (e) => {
        throw e;
      },
    },
  ).h;
  const contracts = {};
  for (const type of Object.keys(reports)) {
    h.type.value = type;
    await h.createExport();
    contracts[type] = calls.filter((v) => v.method === "POST").at(-1);
    assert.deepEqual(contracts[type], {
      url: "/report-exports",
      method: "POST",
      body: { report_type: type, format: "csv" },
    });
  }
  await h.regenerate(exports[2]);
  contracts.regenerate = calls.filter((v) => v.method === "POST").at(-1);
  assert.deepEqual(contracts.regenerate, {
    url: `/report-exports/${exports[2].id}/regenerate`,
    method: "POST",
  });
  assert.equal(navigation.at(-1).query.export, replacement.id);
  assert.equal(navigation.at(-1).method, "replace");
  route.query.export = exports[0].id;
  await h.closeDetail();
  assert.deepEqual(navigation.at(-1).query, { context: "review" });
  h.type.value = "trend";
  await h.choose("opportunity");
  assert.equal(navigation.at(-1).query.report, undefined);
  assert.equal(h.format(null), "数据不足");
  assert.equal(h.format(0), "0");
  assert.equal(h.isExpired(exports[0]), false);
  assert.equal(h.isExpired({ ...exports[0], expires_at: "2026-09-08T00:00:00Z" }), true);
  assert.equal(h.canRegenerate({ ...exports[0], status: "dead_letter" }), true);
  assert.equal(h.canRegenerate({ ...exports[0], status: "expired" }), true);
  const labels = plain(h.labels),
    metricLabels = {},
    seriesLabels = {};
  for (const type of Object.keys(reports)) {
    h.type.value = type;
    metricLabels[type] = Object.fromEntries(
      Object.keys(reports[type].summary).map((k) => [k, h.metricLabel(k)]),
    );
    seriesLabels[type] = Object.fromEntries(
      reports[type].series.map((r) => [r.label, h.seriesLabel(r.label)]),
    );
  }
  const repository = await read("apps/api/src/mysql-report-repository.ts"),
    sqlCalls = [];
  const repoAst = ts.createSourceFile("repo.ts", repository, ts.ScriptTarget.Latest, true);
  const repoSource = repoAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(repoAst))
    .join("\n");
  const Repo = run(repoSource, {
    ReportServiceError: class extends Error {},
  }).MySqlReportRepository;
  const adapter = new Repo(
    {
      query: async (sql, params) => {
        sqlCalls.push({ sql, params });
        return [[]];
      },
    },
    () => new Date("2026-09-08T00:00:00Z"),
  );
  const emptyTeam = await adapter.report({
    reportType: "team",
    organizationId: "org-fixture",
    workspaceId: "ws-fixture",
  });
  assert.deepEqual(plain(emptyTeam.summary), { members: 0, total: 0, completed: 0, overdue: 0 });
  assert.match(
    sqlCalls[0].sql,
    /LEFT JOIN tasks.*t.workspace_id=\?.*t.deleted_at IS NULL.*m.status='active'/,
  );
  assert.deepEqual(plain(sqlCalls[0].params.slice(1)), ["ws-fixture", "org-fixture"]);
  assert.doesNotMatch(sqlCalls[0].sql, /m.workspace_id/);
  const service = await read("apps/api/src/report-service.ts"),
    serviceAst = ts.createSourceFile("service.ts", service, ts.ScriptTarget.Latest, true);
  const Service = run(
    serviceAst.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(serviceAst))
      .join("\n"),
    {
      randomUUID: () => replacement.id,
      buildScopedFilePath: () => "synthetic-memory-path",
      readFile: async () => {
        throw new Error("synthetic missing file");
      },
    },
  ).ReportService;
  let selected = exports[0];
  const server = new Service(
    { detail: async () => selected, createExport: async (i) => i },
    "/synthetic",
    24,
    () => new Date("2026-09-08T00:00:00Z"),
  );
  const input = { exportId: exports[0].id };
  for (const [status, date, downloadCode, regenerateCode] of [
    [
      "succeeded",
      "2026-09-09T00:00:00Z",
      "report_export_file_missing",
      "report_export_still_available",
    ],
    ["succeeded", "2026-09-08T00:00:00Z", "report_export_expired", null],
    ["queued", "2026-09-09T00:00:00Z", "report_export_not_ready", "report_export_still_available"],
    ["expired", "2026-09-09T00:00:00Z", "report_export_not_ready", "report_export_still_available"],
    ["dead_letter", "2026-09-09T00:00:00Z", "report_export_not_ready", null],
  ]) {
    selected = { ...exports[0], status, expires_at: date };
    await assert.rejects(server.download(input), (e) => e.code === downloadCode);
    if (regenerateCode)
      await assert.rejects(server.regenerate(input), (e) => e.code === regenerateCode);
    else {
      const result = await server.regenerate(input);
      assert.equal(result.regeneratedFromExportId, exports[0].id);
      assert.equal(result.id, replacement.id);
    }
  }
  return {
    provenance:
      "Existing M05-06 E2E fixtures; not live data. Synthetic variants are labeled separately.",
    now: "2026-09-08T00:00:00Z",
    reports,
    exports,
    replacement,
    labels,
    metricLabels,
    seriesLabels,
    contracts,
    sourceChecks: [
      "Vue three exact CSV bodies and bodyless regeneration",
      "Vue default report query, close context, replacement ID",
      "Vue null/zero and inclusive expiry",
      "SQL organization active members with current workspace tasks via inert pool",
      "Service download state-before-expiry, missing file and regeneration via inert repository; status-only expired mismatch preserved",
    ],
  };
}
