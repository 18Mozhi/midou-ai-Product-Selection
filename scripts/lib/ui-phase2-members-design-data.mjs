import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { assertOrganizationReasonContract } from "./ui-phase2-organization-reason-contract.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildMembersDesignData(repo) {
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
  const fixture = await read("tests/e2e/m06-01-organization-admin.spec.ts"),
    source = await read("apps/web/src/components/OrganizationAdminCenter.vue"),
    child = await read("apps/web/src/components/OrganizationMemberPanel.vue"),
    data = plain(
      run(
        `${["org", "ws", "memberAdmin", "memberBuyer", "members", "summary"].map((n) => `const ${n}=${extract(fixture, n)};`).join("\n")} export const result={members,summary};`,
      ).result,
    ),
    roles = plain(run(`export const roles=${extract(child, "roles")};`).roles),
    labels = run(
      `${["roleText", "scopeText", "statusText", "effectiveMemberStatus"].map((n) => `const ${n}=${extract(source, n)};`).join("\n")} export const h={roleText,scopeText,statusText,effectiveMemberStatus};`,
    ).h;
  class Failure extends Error {
    constructor(kind = "conflict") {
      super("synthetic");
      this.kind = kind;
      this.userMessage = "合成拒绝";
    }
  }
  async function invitation(mode = "partial") {
    const refs = {
        form: {
          value: {
            emails:
              mode === "unauthorized"
                ? "a@example.test;b@example.test;c@example.test"
                : " FIRST@example.test\nfirst@example.test;bad;second@example.test",
            role_code: "member",
            reason: " 合成邀请原因 ",
          },
        },
        busy: { value: false },
        invitationResults: { value: [] },
        notice: { value: "" },
        noticeKind: { value: "info" },
        requestId: { value: "" },
      },
      calls = [],
      failures = [];
    const h = run(
      `${extract(source, "inviteMembers", "function")} export const invite=inviteMembers;`,
      {
        ...refs,
        ApiClientError: Failure,
        api: async (url, options) => {
          calls.push({ url, ...options, body: JSON.parse(options.body) });
          if (mode === "unauthorized" || options.body.includes("second@"))
            throw new Failure(mode === "unauthorized" ? "forbidden" : "conflict");
          return { request_id: "synthetic-write" };
        },
        load: async () => {},
        applyFailure: (e, p) => failures.push({ kind: e.kind, page: p }),
        rethrowUnexpectedError: (e) => {
          if (!(e instanceof Failure)) throw e;
        },
      },
    );
    await h.invite();
    return plain({
      calls,
      results: refs.invitationResults.value,
      form: refs.form.value,
      notice: refs.notice.value,
      failures,
    });
  }
  const batch = await invitation(),
    unauthorized = await invitation("unauthorized");
  assert.deepEqual(
    batch.calls.map((v) => v.body),
    [
      { email: "first@example.test", role_code: "member", reason: "合成邀请原因" },
      { email: "second@example.test", role_code: "member", reason: "合成邀请原因" },
    ],
  );
  assert.equal(batch.results[0].email, "bad");
  assert.equal(batch.form.emails, "bad\nsecond@example.test");
  assert.match(batch.notice, /输入重复 1 条已合并/);
  assert.equal(unauthorized.calls.length, 1);
  assert.equal(unauthorized.form.emails, "a@example.test");
  assert.doesNotMatch(unauthorized.form.emails, /b@example/);
  assert.match(unauthorized.notice, /处理完成/);
  const calls = [],
    asks = [],
    roleSelections = { value: { [data.members.items[1].id]: "selection_manager" } };
  let answer = "核验成员变更";
  const actions = run(
    `${["auditedReason", "memberAction", "assignRole", "invitationAction"].map((n) => extract(source, n, "function")).join("\n")} export const h={memberAction,assignRole,invitationAction};`,
    {
      memberRoles: roleSelections,
      roleText: labels.roleText,
      askAuditedReason: async (v) => {
        asks.push(v);
        return answer;
      },
      submit: async (url, body, method, options) =>
        calls.push(plain({ url, method, body, options })),
    },
  ).h;
  await actions.memberAction(data.members.items[1]);
  await actions.memberAction({ ...data.members.items[2], status: "disabled" });
  await actions.assignRole(data.members.items[1]);
  await actions.invitationAction(data.members.invitations[0]);
  assert.equal(calls.length, 4);
  const contracts = Object.fromEntries(
    ["disable", "restore", "role", "revoke"].map((key, i) => [key, calls[i]]),
  );
  assert.equal(contracts.role.body.role_code, "selection_manager");
  assert.equal(contracts.restore.body.expected_version, 1);
  assert.equal(contracts.revoke.body.action, "revoke");
  assert.ok(calls.every((v) => v.options.preserveForm));
  answer = null;
  await actions.memberAction(data.members.items[0]);
  assert.equal(calls.length, 4);
  assert.equal(labels.effectiveMemberStatus(data.members.items[2]), "locked");
  assert.equal(
    labels.effectiveMemberStatus({ ...data.members.items[2], status: "disabled" }),
    "disabled",
  );
  const refs = {
    data: { value: plain(data.members) },
    memberQuery: { value: "" },
    memberStatus: { value: "" },
    memberRole: { value: "" },
    memberTeam: { value: "" },
    memberSort: { value: "name_asc" },
    memberPage: { value: 1 },
    invitationTab: { value: "pending" },
  };
  class FixedDate extends Date {
    static now() {
      return new Date("2026-09-08T00:00:00Z").valueOf();
    }
  }
  const computedNames = [
    "availableTeams",
    "filteredMembers",
    "sortedMembers",
    "memberPageSize",
    "memberPageCount",
    "currentMemberPage",
    "pagedMembers",
    "pendingInvitations",
    "expiredInvitations",
    "visibleInvitations",
  ];
  const filter = run(
    `${computedNames.map((n) => `const ${n}=${extract(source, n)};`).join("\n")} export const h={${computedNames.join(",")}};`,
    {
      ...refs,
      Date: FixedDate,
      effectiveMemberStatus: labels.effectiveMemberStatus,
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
    },
  ).h;
  refs.memberQuery.value = "陈";
  assert.equal(filter.filteredMembers.value[0].id, data.members.items[1].id);
  refs.memberQuery.value = "";
  refs.memberStatus.value = "locked";
  assert.equal(filter.filteredMembers.value.length, 1);
  refs.memberStatus.value = "";
  assert.equal(filter.memberPageSize, 10);
  assert.equal(filter.pendingInvitations.value.length, 1);
  assert.equal(filter.expiredInvitations.value.length, 1);
  refs.data.value.items = Array.from({ length: 11 }, (_, i) => ({
    ...data.members.items[1],
    id: `synthetic-${i}`,
  }));
  refs.memberPage.value = 2;
  assert.equal(filter.pagedMembers.value.length, 1);
  refs.memberPage.value = 90;
  assert.equal(filter.currentMemberPage.value, 2);
  const service = await read("apps/api/src/organization-admin-service.ts"),
    ast = ts.createSourceFile("service.ts", service, ts.ScriptTarget.Latest, true),
    Service = run(
      ast.statements
        .filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText(ast))
        .join("\n"),
      { randomUUID: () => "synthetic-id" },
    ).OrganizationAdminService;
  const results = [],
    server = new Service(
      Object.fromEntries(
        ["invite", "memberAction", "assignRole", "invitationAction"].map((n) => [
          n,
          (v) => {
            results.push(plain(v));
            return v;
          },
        ]),
      ),
    );
  server.invite({ value: { email: "NAME@EXAMPLE.TEST", role_code: "member", reason: "核验" } });
  assert.equal(
    results.at(-1).value.email,
    "name@example.test",
    "service also normalizes lowercase",
  );
  for (const [value, code] of [
    [{ email: "bad", role_code: "member", reason: "原因" }, "invitation_email_invalid"],
    [{ email: "x@example.test", role_code: "invented", reason: "原因" }, "role_invalid"],
    [{ email: "x@example.test", role_code: "member", reason: "因".repeat(501) }, "reason_invalid"],
  ])
    assert.throws(
      () => server.invite({ value }),
      (e) => e.code === code,
    );
  for (const [key, contract] of Object.entries(contracts)) {
    const method =
      key === "role" ? "assignRole" : key === "revoke" ? "invitationAction" : "memberAction";
    server[method]({
      value: contract.body,
      [key === "revoke" ? "invitationId" : "membershipId"]: contract.url.split("/").at(-2),
    });
  }
  const dialog = await read("apps/web/src/components/AuditedReasonDialog.vue");
  assert.match(dialog, /minimumLength \?\? 2/);
  await assertOrganizationReasonContract(dialog, source);
  return {
    provenance: "Original M06-01 E2E members/invitations; synthetic variants labeled separately",
    now: "2026-09-08T00:00:00Z",
    ...data,
    roles,
    roleLabels: Object.fromEntries(roles.map((r) => [r, labels.roleText(r)])),
    scopeLabels: Object.fromEntries(
      ["own", "team", "workspace", "organization"].map((s) => [s, labels.scopeText(s)]),
    ),
    contracts,
    batch,
    unauthorized,
    sourceChecks: [
      "Four source versioned action bodies and cancellation zero-write",
      "Source invite normalization/deduplication and partial-failure retained emails",
      "Source unauthorized interruption loses unprocessed emails and overwrites notice (OG-G02 reproduced)",
      "Source effective account/membership state, filters and ten-row pagination",
      "Actual service fixed roles/email/reason validation and lowercase normalization",
      "Source reason dialog minimum two and missing 500 maxlength preserved as proposal gap",
    ],
  };
}
