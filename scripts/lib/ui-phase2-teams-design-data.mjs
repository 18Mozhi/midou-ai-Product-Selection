import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildTeamsDesignData(repo) {
  const read = (f) => readFile(path.join(repo, f), "utf8");
  function extract(source, name, type = "variable") {
    const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true),
      found = [];
    function visit(n) {
      if (type === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        found.push(n.initializer.getText(ast));
      if (type === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        found.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(source, bindings = {}) {
    const box = { exports: {}, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText,
      box,
    );
    return box.exports;
  }
  const fixture = await read("tests/e2e/m06-01-organization-admin.spec.ts"),
    child = await read("apps/web/src/components/OrganizationTeamPanel.vue"),
    parent = await read("apps/web/src/components/OrganizationAdminCenter.vue"),
    ast = ts.createSourceFile("fixture.ts", fixture, ts.ScriptTarget.Latest, true),
    arrays = [];
  function visit(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(ast) === "page.route" &&
      n.arguments[0]?.getText(ast) === '"**/api/v1/org/admin/teams"'
    ) {
      function env(k) {
        if (
          ts.isCallExpression(k) &&
          k.expression.getText(ast) === "env" &&
          ts.isArrayLiteralExpression(k.arguments[0]) &&
          k.arguments[0].elements.length > 0
        )
          arrays.push(k.arguments[0].getText(ast));
        ts.forEachChild(k, env);
      }
      env(n);
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert.equal(arrays.length, 1);
  const data = plain(
      run(
        `${["org", "ws", "memberAdmin", "memberBuyer", "members", "summary", "teamRows"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")}export const result={members,summary,teamRows,teams:${arrays[0]}};`,
      ).result,
    ),
    props = { teams: plain(data.teamRows), members: plain(data.members.items), busy: false },
    calls = [],
    watches = [],
    focus = [];
  let resolveCreate, resolveMember;
  props.createTeam = (v) => {
    calls.push({ kind: "create", value: plain(v) });
    return new Promise((r) => {
      resolveCreate = r;
    });
  };
  props.performMemberAction = (team, action, id) => {
    calls.push({ kind: "member", team: plain(team), action, id });
    return new Promise((r) => {
      resolveMember = r;
    });
  };
  const script = child.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    childAst = ts.createSourceFile("child.ts", script, ts.ScriptTarget.Latest, true),
    h = run(
      childAst.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(childAst))
        .join("\n") +
        "\nexport const h={query,statusFilter,sort,page,pageSize,selectedTeamId,selectedMembershipId,createOpen,createBusy,memberBusy,memberFeedback,form,activeMembers,activeCount,archivedCount,assignedCount,leadCount,workflowCount,filteredTeams,pageCount,pageItems,selectedTeam,selectedMember,openCreate,cancelCreate,submitCreate,performMemberAction,resetFilters};",
      {
        defineProps: () => props,
        ref: (value) => ({ value }),
        computed: (fn) => ({
          get value() {
            return fn();
          },
        }),
        watch: (source, callback, options) => {
          watches.push({ source, callback });
          if (options?.immediate) callback(source());
        },
        window: { requestAnimationFrame: (fn) => fn() },
        document: { querySelector: (s) => ({ focus: () => focus.push(s) }) },
      },
    ).h;
  assert.equal(h.pageSize, 8);
  assert.equal(h.pageItems.value.length, 8);
  assert.equal(h.assignedCount.value, 13);
  assert.equal(h.leadCount.value, 5);
  assert.equal(h.workflowCount.value, 4);
  assert.equal(h.activeMembers.value.length, 3);
  assert.ok(h.activeMembers.value.some((m) => m.account_status === "locked"));
  h.page.value = 2;
  assert.equal(h.pageItems.value.length, 2);
  h.query.value = "workflow-10";
  watches[1].callback();
  assert.equal(h.page.value, 1);
  assert.equal(h.filteredTeams.value[0].id, data.teamRows[9].id);
  assert.equal(h.selectedTeam.value.id, data.teamRows[0].id);
  h.resetFilters();
  h.sort.value = "members_desc";
  assert.equal(h.filteredTeams.value[0].member_count, 3);
  h.sort.value = "updated_desc";
  assert.equal(h.filteredTeams.value[0].id, data.teamRows[9].id);
  h.selectedMembershipId.value = data.members.items[1].id;
  h.memberFeedback.value = "old";
  h.selectedTeamId.value = data.teamRows[1].id;
  watches[3].callback();
  assert.equal(h.selectedMembershipId.value, "");
  assert.equal(h.memberFeedback.value, "");
  await h.performMemberAction("assign");
  assert.equal(calls.length, 0);
  assert.match(h.memberFeedback.value, /请先选择/);
  h.openCreate();
  assert.deepEqual(focus, ["#team-name"]);
  h.form.value = {
    name: " 亚太新品采购组 ",
    lead_membership_id: data.members.items[1].id,
    default_workflow_key: " opportunity-review ",
    reason: " 建立亚太新品采购协作边界 ",
  };
  const create = h.submitCreate();
  h.cancelCreate();
  assert.equal(h.createOpen.value, true);
  await h.submitCreate();
  assert.equal(calls.length, 1);
  resolveCreate(false);
  await create;
  assert.equal(h.form.value.name, " 亚太新品采购组 ");
  const body = plain(calls[0].value);
  const success = h.submitCreate();
  resolveCreate(true);
  await success;
  assert.equal(h.form.value.name, "");
  assert.equal(h.createOpen.value, false);
  h.selectedMembershipId.value = data.members.items[1].id;
  const member = h.performMemberAction("assign");
  assert.equal(h.memberBusy.value, true);
  await h.performMemberAction("remove");
  assert.equal(calls.filter((c) => c.kind === "member").length, 1);
  resolveMember(false);
  await member;
  assert.equal(h.memberBusy.value, false);
  h.selectedMembershipId.value = data.members.items[1].id;
  const race = h.performMemberAction("assign");
  h.selectedTeamId.value = data.teamRows[2].id;
  watches[3].callback();
  resolveMember(true);
  await assert.rejects(race, /display_name/);
  assert.equal(h.memberBusy.value, false);
  h.selectedTeamId.value = data.teamRows[1].id;
  h.selectedMembershipId.value = data.members.items[1].id;
  const wrong = h.performMemberAction("assign");
  h.selectedTeamId.value = data.teamRows[2].id;
  watches[3].callback();
  h.selectedMembershipId.value = data.members.items[0].id;
  resolveMember(true);
  await wrong;
  assert.match(h.memberFeedback.value, /林管理员/);
  assert.match(h.memberFeedback.value, /团队治理样本 03/);
  const raceFeedback = h.memberFeedback.value;
  h.page.value = 4;
  watches[2].callback(2);
  assert.equal(h.page.value, 2);
  props.teams = [];
  watches[0].callback([]);
  assert.equal(h.createOpen.value, true);
  assert.equal(h.selectedTeamId.value, "");
  h.cancelCreate();
  assert.equal(h.createOpen.value, false);
  const writes = [];
  let answer = "核验团队成员关系";
  const actions = run(
    `${["createTeam", "teamMemberAction"].map((n) => extract(parent, n, "function")).join("\n")}export const h={createTeam,teamMemberAction};`,
    {
      submit: async (url, body, method, options) => {
        writes.push(plain({ url, body, method, options }));
        return true;
      },
      auditedReason: async () => answer,
      notice: { value: "" },
    },
  ).h;
  await actions.createTeam(body);
  await actions.teamMemberAction(data.teamRows[1], "assign", data.members.items[1].id);
  await actions.teamMemberAction(data.teamRows[1], "remove", data.members.items[1].id);
  answer = null;
  await actions.teamMemberAction(data.teamRows[1], "assign", data.members.items[1].id);
  assert.equal(writes.length, 3);
  assert.equal("expected_version" in writes[1].body, false);
  const contracts = Object.fromEntries(
    ["create", "assign", "remove"].map((k, i) => [k, writes[i]]),
  );
  const service = await read("apps/api/src/organization-admin-service.ts"),
    sa = ts.createSourceFile("service.ts", service, ts.ScriptTarget.Latest, true),
    Service = run(
      sa.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(sa))
        .join("\n"),
      { randomUUID: () => "synthetic-id" },
    ).OrganizationAdminService,
    server = new Service({ createTeam: (v) => v, teamMemberAction: (v) => v });
  const empty = server.createTeam({
    value: { ...body, lead_membership_id: "", default_workflow_key: "" },
  });
  assert.equal(empty.value.lead_membership_id, null);
  assert.equal(empty.value.default_workflow_key, null);
  assert.equal(
    server.createTeam({ value: { ...body, default_workflow_key: "arbitrary-key" } }).value
      .default_workflow_key,
    "arbitrary-key",
  );
  for (const [value, code] of [
    [{ ...body, name: "名".repeat(121) }, "team_name_invalid"],
    [{ ...body, default_workflow_key: "k".repeat(81) }, "workflow_key_invalid"],
    [{ ...body, reason: "因".repeat(501) }, "reason_invalid"],
  ])
    assert.throws(
      () => server.createTeam({ value }),
      (e) => e.code === code,
    );
  for (const action of ["assign", "remove"])
    server.teamMemberAction({ teamId: data.teamRows[1].id, value: contracts[action].body });
  assert.throws(
    () =>
      server.teamMemberAction({
        teamId: data.teamRows[1].id,
        value: { ...contracts.assign.body, action: "delete" },
      }),
    (e) => e.code === "team_member_action_invalid",
  );
  return {
    ...data,
    contracts,
    raceFeedback,
    sourceChecks: [
      "Actual child computed/watch callbacks: eight-row pagination, search, selected-team reset and active membership includes locked accounts",
      "Actual create trim/focus/busy/failure/success and member no-selection/busy guards",
      "OG-G02 source pending member result after team switch throws with no new member, or labels old write as new team/member",
      "Actual parent create/assign/remove bodies and reason cancellation; no expected_version on relationship writes",
      "Actual service optional fields to null, free workflow key and name/workflow/reason/action bounds",
    ],
  };
}
