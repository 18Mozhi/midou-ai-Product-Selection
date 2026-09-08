import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
export async function buildUserAdminDesignData(repo) {
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const run = (s, bindings = {}) => {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      box,
    );
    return box.result;
  };
  const find = (ast, predicate) => {
    const out = [];
    const visit = (n) => {
      if (predicate(n)) out.push(n);
      ts.forEachChild(n, visit);
    };
    visit(ast);
    return out;
  };
  const fixture = parse(await read("tests/e2e/m06-01-platform-accounts.spec.ts"));
  const declarations = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const declarationText = ["user", "org", "session", "overview", "platformRoles"]
    .map((name) => {
      const n = declarations.filter((n) => n.name.getText(fixture) === name);
      assert.equal(n.length, 1);
      return `const ${name}=${n[0].initializer.getText(fixture)};`;
    })
    .join("\n");
  const detailObject = find(
    fixture,
    (n) =>
      ts.isObjectLiteralExpression(n) &&
      ["user", "memberships", "sessions"].every((k) =>
        n.properties.some((p) => p.name?.getText(fixture) === k),
      ) &&
      n.getText(fixture).includes('device_label: "Chrome"'),
  );
  assert.equal(detailObject.length, 1);
  const adminDetailObject = find(
    fixture,
    (n) =>
      ts.isObjectLiteralExpression(n) &&
      ["user", "memberships", "sessions"].every((k) =>
        n.properties.some((p) => p.name?.getText(fixture) === k),
      ) &&
      n.getText(fixture).includes('email: "admin@example.test"'),
  );
  assert.equal(adminDetailObject.length, 1);
  const original = plain(
    run(
      declarationText +
        `const adminId=overview.admins[0].id; globalThis.result={overview,platformRoles,detail:${detailObject[0].getText(fixture)},adminDetail:${adminDetailObject[0].getText(fixture)}};`,
    ),
  );
  assert.equal(original.detail.memberships[0].organization_id, undefined);
  const script = (s) => s.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  const noImports = (ast) =>
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast).replace(/^\s*export /, "\n"))
      .join("\n");
  const ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
  const memberSource = parse(
    script(await read("apps/web/src/components/PlatformUserMembershipForm.vue")),
  );
  const props = {
    open: true,
    userId: original.detail.user.id,
    userStatus: "active",
    memberships: [{ organization_id: "joined", status: "disabled" }],
    organizations: [
      { id: "joined", status: "active" },
      { id: "archived", status: "archived" },
      { id: "available", status: "active" },
    ],
  };
  const membership = run(
    noImports(memberSource) + "globalThis.result={availableOrganizations,organizationRoleCodes};",
    {
      computed,
      reactive: (v) => v,
      defineProps: () => props,
      defineEmits: () => () => {},
      watch() {},
    },
  );
  assert.deepEqual(
    plain(membership.availableOrganizations.value).map((v) => v.id),
    ["available"],
  );
  assert.equal(membership.organizationRoleCodes.length, 5);
  const serviceAst = parse(await read("apps/api/src/platform-account-service.ts"));
  class ApiError extends Error {
    constructor(status, code, message, hint) {
      super(message);
      this.code = code;
      this.status = status;
      this.actionHint = hint;
    }
  }
  const Service = run(noImports(serviceAst) + "globalThis.result=PlatformAccountService;", {
    ApiError,
    createHmac,
  });
  const repoCalls = [],
    repository = Object.fromEntries(
      [
        "setUserStatus",
        "setPlatformRole",
        "addUserMembership",
        "revokeUserSessions",
        "resetUserPassword",
      ].map((key) => [
        key,
        (v) => {
          repoCalls.push({ key, ...plain(v) });
          return v;
        },
      ]),
    );
  const svc = new Service(
    repository,
    () => new Date("2026-09-09T00:00:00Z"),
    { hash: async () => "synthetic-hash" },
    12,
    128,
    "synthetic-inert-only",
  );
  const id = original.detail.user.id,
    ctx = {
      actorId: original.overview.admins[0].id,
      idempotencyKey: "synthetic",
      requestId: "synthetic",
      traceId: "synthetic",
    };
  for (const code of original.platformRoles.map((r) => r.code))
    for (const enabled of [true, false])
      assert.equal(
        svc.platformRole(id, { role_code: code, enabled, reason: " 核对授权 " }, ctx).enabled,
        enabled,
      );
  assert.throws(
    () =>
      svc.platformRole(
        ctx.actorId,
        { role_code: "platform_super_admin", enabled: false, reason: "核对授权" },
        ctx,
      ),
    (e) => e.code === "cannot_revoke_self_superadmin",
  );
  assert.throws(
    () => svc.userStatus(ctx.actorId, { status: "disabled", reason: "核对账号" }, ctx),
    (e) => e.code === "cannot_disable_self",
  );
  for (const status of ["active", "disabled"])
    assert.equal(svc.userStatus(id, { status, reason: " 核对账号 " }, ctx).reason, "核对账号");
  for (const role_code of membership.organizationRoleCodes)
    assert.equal(
      svc.addUserMembership(
        id,
        { organization_id: original.overview.organizations[0].id, role_code, reason: "加入团队" },
        ctx,
      ).roleCode,
      role_code,
    );
  assert.equal(
    svc.revokeUserSessions(id, { session_id: null, reason: "清理会话" }, ctx).sessionId,
    null,
  );
  assert.equal(
    svc.revokeUserSessions(
      id,
      { session_id: original.detail.sessions[0].id, reason: "清理会话" },
      ctx,
    ).sessionId,
    original.detail.sessions[0].id,
  );
  for (const length of [11, 129])
    await assert.rejects(
      svc.resetUserPassword(
        id,
        { temporary_password: "a".repeat(length), reason: "核对改密" },
        ctx,
      ),
    );
  for (const length of [12, 128])
    assert.equal(
      (
        await svc.resetUserPassword(
          id,
          { temporary_password: "a".repeat(length), reason: "核对改密" },
          ctx,
        )
      ).passwordHash,
      "synthetic-hash",
    );
  for (const reason of ["a", " ", "a".repeat(301)])
    assert.throws(() => svc.revokeUserSessions(id, { session_id: null, reason }, ctx));
  // Execute actual detail composable with inert lifecycle hooks and deferred requests.
  const callbacks = [],
    requests = [],
    selected = ref(null);
  let currentRoute = "/platform-admin/users";
  const useDetail = run(
    noImports(parse(await read("apps/web/src/use-platform-user-detail.ts"))) +
      "globalThis.result=usePlatformUserDetail;",
    {
      ref,
      watch: (fn, cb) => callbacks.push(cb),
      onBeforeUnmount: (cb) => callbacks.push(cb),
      onDeactivated: (cb) => callbacks.push(cb),
      ApiClientError: class extends Error {},
    },
  );
  const detail = useDetail(
    (url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
    selected,
    () => currentRoute,
  );
  const first = detail.openUserDetail(original.overview.users[0]);
  const secondAccount = { ...original.overview.users[0], id: "synthetic-second" };
  const second = detail.openUserDetail(secondAccount);
  requests[1].resolve({ data: { marker: "second" } });
  await second;
  requests[0].resolve({ data: { marker: "first" } });
  await first;
  assert.equal(detail.detail.value.marker, "second");
  const owns = detail.captureDetailAction();
  assert.equal(owns(), true);
  detail.closeUserDetail();
  assert.equal(owns(), false);
  const third = detail.openUserDetail(secondAccount);
  currentRoute = "/platform-admin/admins";
  callbacks[0]();
  requests[2].resolve({ data: { marker: "late" } });
  await third;
  assert.equal(detail.detailOpen.value, false);
  assert.equal(detail.detail.value, null);
  // Actual password callback lacks the four other user action ownership guards.
  const parent = parse(script(await read("apps/web/src/components/PlatformAccountCenter.vue")));
  const reset = parent.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "resetPassword",
  );
  let reasonAction;
  const passwordForm = { temporary_password: "SyntheticOnly-12" },
    writes = [];
  selected.value = { id };
  const resetPassword = run(reset.getFullText(parent) + "globalThis.result=resetPassword;", {
    selected,
    passwordForm,
    passwordError: ref(""),
    askReason: (_, cb) => {
      reasonAction = cb;
    },
    write: async (...args) => {
      writes.push(args.slice(0, 3));
      return null;
    },
  });
  await resetPassword();
  selected.value = { id: "synthetic-second" };
  passwordForm.temporary_password = "SyntheticChanged-12";
  await reasonAction("核对改密");
  assert.equal(writes[0][0], "/platform/accounts/users/synthetic-second/password");
  assert.equal(writes[0][1].temporary_password, "SyntheticChanged-12");
  // Reuse exact comparison computed functions and ensure embedded controls do not persist URL.
  const compareAst = parse(
    script(await read("apps/web/src/components/PlatformRoleComparison.vue")),
  );
  const watchers = [],
    replaces = [];
  const comparison = run(
    noImports(compareAst) +
      "globalThis.result={compareLeft,compareRight,differencesOnly,capabilityQuery,capabilityGroup,capabilityGroups,comparison,capabilityText,groupText};",
    {
      ref,
      computed,
      defineProps: () => ({ roles: original.platformRoles, persistSelection: false }),
      withDefaults: (v) => v,
      useRoute: () => ({ query: {} }),
      useRouter: () => ({ replace: (v) => replaces.push(v) }),
      watch: (source, cb, options) => {
        watchers.push(cb);
        if (options?.immediate) cb(source());
      },
    },
  );
  assert.equal(comparison.comparison.value.length, 6);
  comparison.compareRight.value = comparison.compareLeft.value;
  assert.equal(comparison.comparison.value.length, 0);
  comparison.differencesOnly.value = false;
  assert.equal(comparison.comparison.value.length, 3);
  watchers.at(-1)();
  assert.equal(replaces.length, 0);
  const capabilityLabels = Object.fromEntries(
    [...new Set(original.platformRoles.flatMap((r) => r.capabilities))].map((c) => [
      c,
      { label: comparison.capabilityText(c), group: comparison.groupText(c) },
    ]),
  );
  return {
    ...original,
    capabilityLabels,
    organizationRoleCodes: plain(membership.organizationRoleCodes),
    checks: [
      "Original overview and Chrome detail fixture extracted unchanged; original membership lacks organization_id",
      "Actual membership computed excludes active organizations with any existing relationship, including disabled; five role choices",
      "Actual service: six grant/revoke combinations, self-disable/self-super-revoke rejection, five membership roles, null/single session, password 12..128, reason 2..300",
      "Actual detail composable: old GET cannot overwrite new account; close/route change invalidates detail and action guard",
      "Actual resetPassword callback: target and password drift reproduced with inert refs; production not changed",
      "Actual role comparison: 6 differences, identical roles 0 differences/3 all; persistSelection=false emits no router writes",
      "No mounted Vue, real API, MySQL, permission grant, MFA, credential or audit execution",
    ],
    sourcePaths: [
      "apps/web/src/components/PlatformAccountCenter.vue",
      "apps/web/src/components/PlatformUserRecords.vue",
      "apps/web/src/components/PlatformAdminRecords.vue",
      "apps/web/src/components/PlatformUserDetailDialog.vue",
      "apps/web/src/components/PlatformUserMembershipForm.vue",
      "apps/web/src/components/PlatformAccountDialogs.vue",
      "apps/web/src/components/PlatformRoleComparison.vue",
      "apps/web/src/use-platform-user-detail.ts",
      "apps/web/src/use-modal-dialog.ts",
      "apps/api/src/platform-account-service.ts",
      "apps/api/src/platform-account-routes.ts",
      "apps/api/src/mysql-platform-account-repository.ts",
      "tests/e2e/m06-01-platform-accounts.spec.ts",
    ],
  };
}
