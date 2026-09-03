import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PlatformAccountService } from "../../apps/api/dist/platform-account-service.js";
import { MySqlPlatformAccountRepository } from "../../apps/api/dist/mysql-platform-account-repository.js";
import { CAPABILITIES } from "../../packages/authorization/dist/index.js";
const actor = "00000000-0000-4000-8000-000000000601",
  other = "00000000-0000-4000-8000-000000000602",
  context = {
    actorId: actor,
    idempotencyKey: "key",
    requestId: "request",
    traceId: "trace",
  };
test("M06-01 platform account service validates novice organization and account operations", async () => {
  const calls = [],
    repository = {
      overview: async (input) => ({ input }),
      createOrganization: async (input) => (calls.push(input), input),
      updateOrganization: async (input) => (calls.push(input), input),
      createUser: async (input) => (calls.push(input), input),
      userDetail: async (input) => ({ input, sessions: [] }),
      resetUserPassword: async (input) => (calls.push(input), input),
      revokeUserSessions: async (input) => (calls.push(input), input),
      setOrganizationStatus: async (input) => (calls.push(input), input),
      setUserStatus: async (input) => (calls.push(input), input),
      setPlatformRole: async (input) => (calls.push(input), input),
    },
    service = new PlatformAccountService(
      repository,
      () => new Date("2026-08-18T00:00:00Z"),
      { hash: async (value) => `argon2:${value}`, verify: async () => true },
      12,
      256,
      "m06-01-platform-account-idempotency-test-key",
    );
  await service.createOrganization({ name: "米豆选品团队", slug: "midou-team" }, context);
  await service.organizationStatus(
    other,
    { status: "archived", reason: "停止该组织继续使用" },
    context,
  );
  await service.userStatus(other, { status: "disabled", reason: "员工已经离职" }, context);
  await service.platformRole(
    other,
    {
      role_code: "platform_operations_admin",
      enabled: true,
      reason: "负责热点来源运营",
    },
    context,
  );
  await service.updateOrganization(
    other,
    {
      name: "米豆新团队",
      timezone: "Asia/Shanghai",
      data_retention_days: 730,
      reason: "更新组织资料",
    },
    context,
  );
  await service.createUser(
    {
      email: "new-admin@example.test",
      temporary_password: "temporary-password",
      platform_role_code: "platform_operations_admin",
      organization_id: other,
      organization_role_code: "organization_admin",
    },
    context,
  );
  await service.resetUserPassword(
    other,
    { temporary_password: "next-temporary-password", reason: "管理员强制改密" },
    context,
  );
  await service.revokeUserSessions(
    other,
    { session_id: null, reason: "撤销全部登录会话" },
    context,
  );
  assert.equal(calls.length, 8);
  assert.equal(calls[5].passwordHash, "argon2:temporary-password");
  assert.equal("temporary_password" in calls[5], false);
  for (const call of calls) {
    assert.match(call.requestHash, /^[a-f0-9]{64}$/);
    assert.equal("temporary_password" in call, false);
  }
  assert.throws(
    () => service.userStatus(actor, { status: "disabled", reason: "停用自己" }, context),
    (error) => error.code === "cannot_disable_self",
  );
  assert.throws(
    () =>
      service.platformRole(
        actor,
        {
          role_code: "platform_super_admin",
          enabled: false,
          reason: "撤销自己",
        },
        context,
      ),
    (error) => error.code === "cannot_revoke_self_superadmin",
  );
});
test("M06-01 concurrent idempotency collision replays the committed platform operation", async () => {
  const expected = { id: other, status: "active" },
    requestHash = "a".repeat(64),
    operationContext = { ...context, requestHash };
  let connectionQueryCount = 0;
  const connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async () => {
        connectionQueryCount += 1;
        if (connectionQueryCount === 1) return [[], []];
        throw Object.assign(new Error("duplicate operation"), { code: "ER_DUP_ENTRY" });
      },
    },
    pool = {
      getConnection: async () => connection,
      query: async () => [
        [
          {
            result_json: JSON.stringify({
              schema_version: 2,
              request_hash: requestHash,
              result: expected,
            }),
          },
        ],
        [],
      ],
    },
    repository = new MySqlPlatformAccountRepository(pool);
  const result = await repository.write(operationContext, async () => expected);
  assert.deepEqual(result, expected);
  assert.equal(connectionQueryCount, 2);
});
test("M06-01 rejects an idempotency key reused with a different request body", async () => {
  const stored = { id: other, status: "active" },
    connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async () => [
        [
          {
            result_json: JSON.stringify({
              schema_version: 2,
              request_hash: "a".repeat(64),
              result: stored,
            }),
          },
        ],
        [],
      ],
    },
    repository = new MySqlPlatformAccountRepository({
      getConnection: async () => connection,
    });
  await assert.rejects(
    repository.write({ ...context, requestHash: "b".repeat(64) }, async () => stored),
    (error) => error.code === "idempotency_key_reused" && error.statusCode === 409,
  );
});
test("M06-01 granting a platform role enforces MFA policy for existing accounts", async () => {
  const statements = [],
    connection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql) => {
        statements.push(sql);
        if (sql.startsWith("SELECT result_json")) return [[], []];
        if (sql.startsWith("SELECT id FROM users")) return [[{ id: other }], []];
        return [[], []];
      },
    },
    repository = new MySqlPlatformAccountRepository({
      getConnection: async () => connection,
    });
  await repository.setPlatformRole({
    ...context,
    userId: other,
    roleCode: "platform_operations_admin",
    enabled: true,
    reason: "负责平台运营",
    requestHash: "c".repeat(64),
    now: new Date("2026-09-03T00:00:00.000Z"),
  });
  assert.ok(statements.some((sql) => sql.includes("INSERT IGNORE INTO platform_role_assignments")));
  assert.ok(statements.some((sql) => sql.includes("must_enroll_mfa=CASE WHEN EXISTS")));
  assert.ok(statements.some((sql) => sql.includes("f.status='enabled'")));
});
test("M06-01 platform account delivery includes API, migration, novice UI, permissions and audit", async () => {
  const paths = [
      "database/migrations/0036_automatic_hotspot_sources.up.sql",
      "apps/api/src/platform-account-service.ts",
      "apps/api/src/mysql-platform-account-repository.ts",
      "apps/api/src/platform-account-routes.ts",
      "apps/web/src/components/PlatformAccountCenter.vue",
      "apps/web/src/components/PlatformOrganizationRecords.vue",
      "apps/web/src/components/PlatformUserRecords.vue",
      "apps/web/src/components/OrganizationCreationWizard.vue",
      "apps/web/src/components/PlatformOrganizationDetailDialog.vue",
      "apps/web/src/components/PlatformAdminRecords.vue",
      "apps/web/src/components/PlatformRoleComparison.vue",
      "apps/web/src/components/PlatformUserDetailDialog.vue",
      "apps/web/src/use-modal-dialog.ts",
      "apps/web/src/components/NavigationShell.vue",
      "config/route-catalog.json",
      "scripts/verify-platform-accounts-live.mjs",
    ],
    values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      migration,
      service,
      repository,
      routes,
      accountShell,
      organizationRecords,
      userRecords,
      wizard,
      organizationDetail,
      adminRecords,
      comparison,
      detailDialog,
      modalDialog,
      navigation,
      routeCatalog,
      live,
    ] = values,
    web = [
      accountShell,
      organizationRecords,
      userRecords,
      wizard,
      organizationDetail,
      adminRecords,
      comparison,
      detailDialog,
    ].join("\n");
  assert.match(migration, /platform_account_operations/);
  assert.match(service, /cannot_disable_self/);
  assert.match(repository, /platform_audit_events/);
  assert.match(repository, /findOperation<T>/);
  assert.match(repository, /idempotency_key_reused/);
  assert.match(repository, /request_hash/);
  assert.match(repository, /CONVERT\(o\.slug USING utf8mb4\) COLLATE utf8mb4_unicode_ci LIKE/);
  assert.match(repository, /UPDATE user_sessions SET status='revoked'/);
  assert.match(repository, /user.password.forced_reset/);
  assert.match(repository, /user.sessions.revoked/);
  assert.match(repository, /must_change_password=1/);
  assert.match(repository, /must_enroll_mfa=CASE WHEN EXISTS/);
  assert.match(repository, /user_mfa_factors f[\s\S]*f\.status='enabled'/);
  assert.match(repository, /INSERT INTO membership_role_assignments/);
  assert.match(repository, /INSERT INTO membership_data_scopes.*'organization'/s);
  assert.match(repository, /default_workspace_id,created_by.*NULL/s);
  assert.doesNotMatch(repository, /UPDATE sessions SET|INSERT INTO membership_roles/);
  assert.match(routes, /platform:superadmin/);
  assert.match(routes, /users\/:userId\/password/);
  assert.match(routes, /users\/:userId\/sessions\/revoke/);
  assert.match(web, /组织管理.*用户管理.*管理员管理/s);
  assert.match(web, /创建组织步骤/);
  assert.match(web, /下一步：选择管理员/);
  assert.match(web, /同时创建默认工作区和组织级数据范围/);
  assert.match(accountShell, /已进入组织详情/);
  assert.match(organizationDetail, /组织详情[\s\S]*停用组织[\s\S]*保存组织资料/);
  assert.match(organizationDetail, /未找到该组织/);
  assert.match(organizationDetail, /操作未完成/);
  assert.doesNotMatch(accountShell, /@click="toggleOrganization\(item\)"/);
  assert.doesNotMatch(accountShell, /@click="toggleUser\(item\)"/);
  assert.doesNotMatch(adminRecords, /emit\('role'/);
  assert.match(wizard, /formElement\.value\?\.reportValidity\(\)/);
  assert.match(modalDialog, /showModal\(\)/);
  assert.match(modalDialog, /handleCancel/);
  assert.match(modalDialog, /returnFocus\?\.focus\(\)/);
  assert.match(web, /\/platform\/roles/);
  assert.match(accountShell, /if \(tab\.value === "admins"\) await loadPlatformRoles\(\)/);
  assert.match(accountShell, /已保留上次成功读取的数据/);
  assert.match(accountShell, /if \(refreshing\.value\) return/);
  assert.match(accountShell, /没有符合当前条件的组织/);
  assert.match(accountShell, /organizationListRoute[\s\S]*管理组织状态与隔离边界/);
  assert.match(accountShell, /搜索组织名称或标识/);
  assert.match(accountShell, /organizationEmptyState/);
  assert.match(accountShell, /清除筛选/);
  assert.match(accountShell, /搜索管理员邮箱/);
  assert.match(accountShell, /没有符合当前条件的管理员/);
  assert.match(accountShell, /adminEmptyState/);
  assert.match(accountShell, /createUserError/);
  assert.match(accountShell, /passwordError/);
  assert.match(accountShell, /route\.query\.query/);
  assert.match(accountShell, /createError/);
  assert.match(accountShell, /@clear-error="createError = ''"/);
  assert.match(wizard, /\[a-z0-9\]\(\?:\[a-z0-9\]\|-\)\{1,62\}/);
  assert.match(wizard, /organization-wizard__error/);
  assert.match(wizard, /创建未完成/);
  assert.match(web, /角色权限差异/);
  assert.match(comparison, /differencesOnly/);
  assert.match(comparison, /capabilityQuery/);
  assert.match(comparison, /capabilityGroup/);
  assert.match(comparison, /router\.replace/);
  assert.match(accountShell, /permissionsRoute\.value/);
  assert.match(accountShell, /正在读取真实平台角色目录/);
  assert.match(accountShell, /已保留上次成功读取的权限矩阵/);
  assert.match(accountShell, /:persist-selection="true"/);
  assert.match(adminRecords, /overflow-wrap: anywhere/);
  assert.match(adminRecords, /min-width: 0/);
  assert.match(detailDialog, /errorMessage/);
  assert.match(detailDialog, /successMessage/);
  assert.match(detailDialog, /\$emit\('retry'\)/);
  assert.match(detailDialog, /:disabled="busy"/);
  assert.match(web, /不以页面按钮推测权限/);
  for (const capability of CAPABILITIES)
    assert.match(web, new RegExp(capability.replace(":", "\\:")));
  assert.ok(accountShell.split(/\r?\n/).length < 1000);
  for (const component of [
    organizationRecords,
    userRecords,
    wizard,
    organizationDetail,
    adminRecords,
    comparison,
    detailDialog,
  ])
    assert.ok(component.split(/\r?\n/).length < 300);
  assert.match(routeCatalog, /账号与组织/);
  assert.match(routeCatalog, /"title": "角色权限"/);
  assert.match(routeCatalog, /"label": "角色权限"/);
  assert.doesNotMatch(navigation, /label: "Redis 韧性"|label: "MySQL 韧性"|label: "文件韧性"/);
  assert.match(live, /user_sessions/);
  assert.match(live, /organization_admin_scope_failed/);
  assert.match(live, /default_workspace_relationship_failed/);
  assert.match(live, /cannot_disable_self/);
  assert.match(live, /cannot_revoke_self_superadmin/);
  assert.match(live, /platform_audit_events/);
  assert.match(live, /BUILTIN_ROLES/);
  assert.match(live, /platform_role_catalog_drift/);
  assert.match(live, /for \(const capability of CAPABILITIES\)/);
  assert.match(live, /platform_capability_unexpected_allow/);
  assert.match(live, /authorization_decisions/);
  assert.match(live, /platform_permission_decision_audit_failed/);
  assert.match(live, /assertCleanup/);
});
