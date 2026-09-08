import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOrgApprovalsDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const fixture = await read("tests/e2e/m06-01-organization-admin.spec.ts");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
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
    const box = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const ast = parse(fixture);
  const routes = nodes(
    ast,
    (n) =>
      ts.isCallExpression(n) &&
      n.expression.getText(ast) === "page.route" &&
      n.arguments[0]?.getText(ast) === '"**/api/v1/org/admin/approvals"',
  );
  assert.equal(routes.length, 1);
  const payloads = nodes(
    routes[0],
    (n) => ts.isCallExpression(n) && n.expression.getText(ast) === "env",
  );
  assert.equal(payloads.length, 1);
  const resource = nodes(
    ast,
    (n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === "approvalResource",
  );
  assert.equal(resource.length, 1);
  const data = plain(
    run(
      `const approvalResource=${resource[0].initializer.getText(ast)}; export const data=${payloads[0].arguments[0].getText(ast)};`,
    ).data,
  );
  assert.equal(data.items.length, 10);
  assert.equal(data.templates.length, 2);
  const child = await read("apps/web/src/components/OrganizationApprovalPanel.vue");
  const source = parse(child.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const script = source.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(source))
    .join("\n");
  const keys =
    "section requestQuery requestStatus requestWorkspace requestResource requestSort requestPage templateQuery templateStatus templateWorkspace templateResource templateSort templatePage selectedTemplateId requestTotal templateMetrics filteredRequests visibleRequests filteredTemplates visibleTemplates selectedTemplate workspaces resetRequests resetTemplates queryText queryPage queryChoice requestLabel templateLabel resourceLabel".split(
      " ",
    );
  function harness(query = {}, payload = data) {
    const props = {
        approvals: plain(payload.items),
        templates: plain(payload.templates),
        summary: plain(payload.summary),
      },
      route = { query },
      watches = [],
      replacements = [];
    const h = run(script + `\nexport const h={${keys.join(",")}};`, {
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
      watch: (s, cb, o) => {
        watches.push({ s, cb });
        if (o?.immediate) cb(s());
      },
    }).h;
    return { h, props, route, watches, replacements };
  }
  const { h, props, route, watches, replacements } = harness();
  assert.equal(h.requestTotal.value, 10);
  assert.equal(h.visibleRequests.value.length, 8);
  h.requestPage.value = 2;
  assert.equal(h.visibleRequests.value.length, 2);
  h.requestQuery.value = "厨房";
  watches[0].cb();
  assert.equal(h.requestPage.value, 1);
  assert.equal(h.filteredRequests.value.length, 1);
  h.resetRequests();
  h.requestWorkspace.value = "采购协作工作区";
  assert.equal(h.filteredRequests.value.length, 5);
  h.requestResource.value = "opportunity_decision";
  assert.equal(h.filteredRequests.value.length, 0);
  h.resetRequests();
  h.requestStatus.value = "pending";
  assert.equal(h.filteredRequests.value.length, 3);
  h.resetRequests();
  h.requestSort.value = "created_asc";
  assert.equal(h.visibleRequests.value[0].title, "审批记录 10");
  h.templateSort.value = "updated_desc";
  assert.equal(h.filteredTemplates.value[0].current_version, 3);
  h.selectedTemplateId.value = data.templates[0].id;
  h.templateStatus.value = "draft";
  assert.equal(h.selectedTemplate.value.id, data.templates[1].id);
  h.resetTemplates();
  h.templatePage.value = 2;
  assert.equal(h.visibleTemplates.value.length, 0);
  assert.equal(h.selectedTemplate.value.id, data.templates[0].id);
  watches[3].cb(1);
  assert.equal(h.templatePage.value, 1);
  props.templates.push({ ...props.templates[0], id: "synthetic-same-name" });
  assert.equal(h.workspaces.value.length, 2); // Workspace names, not IDs, are the real filter values.
  h.section.value = "templates";
  h.templateStatus.value = "draft";
  route.query.keep = "retained";
  watches[4].cb();
  assert.equal(replacements[0].query.keep, "retained");
  assert.equal(replacements[0].query.approval_view, "templates");
  assert.equal(replacements[0].query.approval_template_status, "draft");
  assert.equal(replacements[0].query.approval_template_page, undefined);
  route.query.approval_view = "requests";
  assert.equal(h.section.value, "templates"); // No reverse route watcher.
  const invalid = harness({
    approval_view: "bad",
    approval_request_query: "x".repeat(220),
    approval_request_page: "2.5",
    approval_template_status: ["draft"],
  }).h;
  assert.equal(invalid.section.value, "requests");
  assert.equal(invalid.requestQuery.value.length, 200);
  assert.equal(invalid.requestPage.value, 1);
  assert.equal(invalid.templateStatus.value, "all");
  const repoSource = parse(await read("apps/api/src/mysql-organization-admin-repository.ts"));
  const method = nodes(
    repoSource,
    (n) => ts.isMethodDeclaration(n) && n.name.getText(repoSource) === "templateVersionDiff",
  );
  assert.equal(method.length, 1);
  const diff = run(
    `class Probe { ${method[0].getText(repoSource)} } export const diff=(v,m)=>new Probe().templateVersionDiff(v,m);`,
  ).diff;
  const node = {
    ordinal: 1,
    name: "来源合成节点",
    approver_name: "甲",
    sla_minutes: 60,
    escalation_name: "乙",
  };
  const versions = new Map([
    [1, [node, { ...node, ordinal: 2, name: "移除节点" }]],
    [
      3,
      [
        { ...node, name: "当前节点", approver_name: "丙", sla_minutes: 0, escalation_name: "丁" },
        { ...node, ordinal: 3, name: "新增节点" },
      ],
    ],
    [7, [node]],
  ]);
  const multiDiff = plain(diff(3, versions));
  assert.equal(multiDiff.from_version, 1);
  assert.deepEqual(
    multiDiff.changes.map((v) => v.kind),
    ["changed", "removed", "added"],
  );
  assert.equal(multiDiff.changes[0].fields.length, 4);
  assert.equal(multiDiff.changes[0].fields[2].after, 0);
  assert.equal(diff(1, versions).from_version, null);
  const noDiff = plain(
    diff(
      3,
      new Map([
        [1, [node]],
        [3, [node]],
      ]),
    ),
  );
  assert.equal(noDiff.change_count, 0);
  return {
    ...data,
    multiDiff,
    noDiff,
    sourceChecks: [
      "Actual child computed and explicit watch callbacks: 8/6 pagination, filters, version sorting, filtered selection and name-based workspace options",
      "Actual URL readers and serializer: 200-char initial text, positive integer page, default elision and unrelated query preserved; route mutation does not restore refs",
      "Actual repository diff method: nearest lower persisted version, ordinal matching, four changed fields, removed/added, first version and no changes; no SQL execution",
    ],
  };
}
