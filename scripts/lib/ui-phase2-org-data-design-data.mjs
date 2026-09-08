import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOrgDataDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  function nodes(ast, predicate) {
    const found = [];
    function visit(n) {
      if (predicate(n)) found.push(n);
      ts.forEachChild(n, visit);
    }
    visit(ast);
    return found;
  }
  function run(s, bindings = {}) {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.__result;
  }
  const fixture = parse(await read("tests/e2e/m06-01-organization-admin.spec.ts"));
  const routes = nodes(
    fixture,
    (n) =>
      ts.isCallExpression(n) &&
      n.expression.getText(fixture) === "page.route" &&
      n.arguments[0]?.getText(fixture) === '"**/api/v1/org/admin/data"',
  );
  const payloads = routes.flatMap((r) =>
    nodes(r, (n) => ts.isCallExpression(n) && n.expression.getText(fixture) === "env").map((n) =>
      n.arguments[0].getText(fixture),
    ),
  );
  const baseline = payloads.filter((s) => s.includes("Array.from")),
    zero = payloads.filter((s) => s.includes("ui2-waiting"));
  assert.equal(baseline.length, 1);
  assert.equal(zero.length, 1);
  const ws = nodes(
    fixture,
    (n) => ts.isVariableDeclaration(n) && n.name.getText(fixture) === "ws",
  )[0].initializer.getText(fixture);
  const data = plain(run("const ws=" + ws + ";globalThis.__result=" + baseline[0])),
    zeroFixture = plain(run("globalThis.__result=" + zero[0]));
  assert.equal(data.comparisons.length, 12);
  assert.equal(data.exports.length, 23);
  const child = await read("apps/web/src/components/OrganizationDataPanel.vue");
  const ast = parse(child.split(/<script setup[^>]*>/)[1].split("</script>")[0]),
    script = ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast))
      .join("\n");
  const keys =
    "view workspaceQuery workspaceStatus workspaceSort workspacePage exportQuery exportWorkspace exportType exportStatus exportSort exportPage totals workspaceNames filteredWorkspaces visibleWorkspaces filteredExports visibleExports count time workspaceValue statusLabel typeLabel resetWorkspaces resetExports".split(
      " ",
    );
  function harness(query = {}, value = data) {
    const props = { data: plain(value) },
      route = { query },
      watches = [],
      replacements = [];
    const h = run(script + "\nglobalThis.__result={" + keys.join(",") + "};", {
      defineProps: () => props,
      useRoute: () => route,
      useRouter: () => ({
        replace: (v) => {
          replacements.push(plain(v));
          return Promise.resolve();
        },
      }),
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: (s, cb) => watches.push({ s, cb }),
    });
    return { h, props, route, watches, replacements };
  }
  const { h, route, watches, replacements } = harness();
  assert.deepEqual(plain(h.totals.value), {
    workspaces: 12,
    active: 11,
    archived: 1,
    trends: 390,
    opportunities: 210,
    tasks: 150,
    exports: 54,
  });
  assert.equal(h.visibleWorkspaces.value.length, 8);
  h.workspacePage.value = 2;
  assert.equal(h.visibleWorkspaces.value.length, 4);
  assert.equal(h.visibleExports.value.length, 10);
  h.exportPage.value = 3;
  assert.equal(h.visibleExports.value.length, 3);
  h.workspaceQuery.value = "历史归档";
  watches[0].cb();
  assert.equal(h.workspacePage.value, 1);
  assert.equal(h.filteredWorkspaces.value.length, 1);
  h.workspaceStatus.value = "active";
  assert.equal(h.filteredWorkspaces.value.length, 0);
  h.resetWorkspaces();
  h.exportQuery.value = "等待重试";
  watches[1].cb();
  assert.equal(h.exportPage.value, 1);
  assert.equal(h.filteredExports.value.length, 4);
  h.resetExports();
  h.exportWorkspace.value = "新品决策工作区";
  assert.equal(h.filteredExports.value.length, 12);
  h.exportType.value = "team";
  assert.equal(h.filteredExports.value.length, 4);
  h.exportStatus.value = "succeeded";
  assert.equal(h.filteredExports.value.length, 0);
  h.resetExports();
  const oracle = { workspace: {}, export: {} };
  for (const sort of [
    "name_asc",
    "total_desc",
    "trends_desc",
    "opportunities_desc",
    "tasks_desc",
    "exports_desc",
  ]) {
    h.workspaceSort.value = sort;
    oracle.workspace[sort] = plain(h.filteredWorkspaces.value.map((r) => r.id));
  }
  for (const sort of [
    "created_desc",
    "created_asc",
    "updated_desc",
    "rows_desc",
    "workspace_asc",
  ]) {
    h.exportSort.value = sort;
    oracle.export[sort] = plain(h.filteredExports.value.map((r) => r.id));
  }
  for (const value of [null, undefined, -1, "bad", Infinity]) assert.equal(h.count(value), 0);
  assert.equal(h.count("4"), 4);
  assert.equal(h.count(0), 0);
  assert.equal(h.time("not a date"), 0);
  h.workspacePage.value = 9;
  watches[2].cb(2);
  assert.equal(h.workspacePage.value, 2);
  h.exportPage.value = 9;
  watches[3].cb(3);
  assert.equal(h.exportPage.value, 3);
  h.view.value = "exports";
  h.resetWorkspaces();
  h.resetExports();
  h.workspacePage.value = 1;
  h.exportPage.value = 1;
  h.exportStatus.value = "queued";
  route.query.keep = "retained";
  watches[4].cb();
  assert.equal(replacements[0].query.org_data_view, "exports");
  assert.equal(replacements[0].query.org_data_export_status, "queued");
  assert.equal(replacements[0].query.keep, "retained");
  assert.equal(replacements[0].query.org_data_workspace_sort, undefined);
  route.query.org_data_view = "workspaces";
  assert.equal(h.view.value, "exports");
  const invalid = harness({
    org_data_view: "bad",
    org_data_workspace_query: "x".repeat(220),
    org_data_workspace_page: "2.5",
    org_data_export_status: ["queued"],
  }).h;
  assert.equal(invalid.view.value, "workspaces");
  assert.equal(invalid.workspaceQuery.value.length, 200);
  assert.equal(invalid.workspacePage.value, 1);
  assert.equal(invalid.exportStatus.value, "all");
  const repository = parse(await read("apps/api/src/mysql-organization-admin-repository.ts"));
  const method = nodes(
    repository,
    (n) => ts.isMethodDeclaration(n) && n.name.getText(repository) === "data",
  );
  assert.equal(method.length, 1);
  const iso = nodes(
    repository,
    (n) => ts.isVariableDeclaration(n) && n.name.getText(repository) === "iso",
  )[0].initializer.getText(repository);
  const sql = [],
    responses = [
      [
        {
          id: "synthetic-ws",
          name: "隔离计数",
          status: "active",
          trends: "2",
          opportunities: "3",
          tasks: "4",
          exports: "5",
        },
      ],
      plain(zeroFixture.exports),
    ];
  const result = await run(
    "const iso=" +
      iso +
      ";class Probe{" +
      method[0].getText(repository) +
      "} const p=new Probe();p.pool=pool;p.now=now;globalThis.__result=p.data({organizationId:'isolated-org'});",
    {
      pool: {
        query: async (q, args) => {
          sql.push({ query: q, args });
          return [responses.shift()];
        },
      },
      now: () => new Date("2026-09-08T00:00:00.000Z"),
    },
  );
  assert.equal(sql.length, 2);
  for (const call of sql) assert.deepEqual(plain(call.args), ["isolated-org"]);
  assert.match(sql[0].query, /k\.deleted_at IS NULL/);
  assert.match(sql[0].query, /WHERE w\.organization_id=\?/);
  assert.match(sql[1].query, /WHERE e\.organization_id=\?/);
  assert.match(sql[1].query, /ORDER BY e\.created_at DESC LIMIT 100/);
  assert.equal(result.comparisons[0].tasks, 4);
  assert.equal(result.exports[0].row_count, null);
  assert.equal(result.exports[1].row_count, 0);
  assert.equal(result.observed_at, "2026-09-08T00:00:00.000Z");
  return {
    ...data,
    zeroFixture,
    oracle,
    sourceChecks: [
      "Actual child computed and explicit watch callbacks: 8/10 pagination, all eleven sort ID sequences, filters, totals and page clamping",
      "Actual query readers/serializer: 200-character initial text, positive integer page, default elision and unrelated query; no reverse route restoration",
      "Actual count/time functions retain existing zero fallbacks; original UI2 null/zero fixture retained",
      "Actual repository data method with inert query responses: current organization query arguments, undeleted task predicate, latest 100 exports, numeric/null mapping and observed time; no SQL execution",
    ],
  };
}
