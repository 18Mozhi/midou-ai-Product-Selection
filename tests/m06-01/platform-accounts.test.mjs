import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PlatformAccountService } from "../../apps/api/dist/platform-account-service.js";
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
test("M06-01 platform account delivery includes API, migration, novice UI, permissions and audit", async () => {
  const paths = [
      "database/migrations/0036_automatic_hotspot_sources.up.sql",
      "apps/api/src/platform-account-service.ts",
      "apps/api/src/mysql-platform-account-repository.ts",
      "apps/api/src/platform-account-routes.ts",
      "apps/web/src/components/PlatformAccountCenter.vue",
      "apps/web/src/components/OrganizationCreationWizard.vue",
      "apps/web/src/components/PlatformRoleComparison.vue",
      "apps/web/src/components/PlatformUserDetailDialog.vue",
      "apps/web/src/components/NavigationShell.vue",
      "scripts/verify-platform-accounts-live.mjs",
    ],
    values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      migration,
      service,
      repository,
      routes,
      accountShell,
      wizard,
      comparison,
      detailDialog,
      navigation,
      live,
    ] = values,
    web = [accountShell, wizard, comparison, detailDialog].join("\n");
  assert.match(migration, /platform_account_operations/);
  assert.match(service, /cannot_disable_self/);
  assert.match(repository, /platform_audit_events/);
  assert.match(repository, /UPDATE user_sessions SET status='revoked'/);
  assert.match(repository, /user.password.forced_reset/);
  assert.match(repository, /user.sessions.revoked/);
  assert.match(repository, /must_change_password=1/);
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
  assert.match(wizard, /formElement\.value\?\.reportValidity\(\)/);
  assert.match(web, /\/platform\/roles/);
  assert.match(web, /角色权限差异/);
  assert.match(comparison, /differencesOnly/);
  assert.match(web, /不以页面按钮推测权限/);
  for (const capability of CAPABILITIES)
    assert.match(web, new RegExp(capability.replace(":", "\\:")));
  assert.ok(accountShell.split(/\r?\n/).length < 1000);
  for (const component of [wizard, comparison, detailDialog])
    assert.ok(component.split(/\r?\n/).length < 300);
  assert.match(navigation, /账号与组织/);
  assert.doesNotMatch(navigation, /label: "Redis 韧性"|label: "MySQL 韧性"|label: "文件韧性"/);
  assert.match(live, /user_sessions/);
  assert.match(live, /organization_admin_scope_failed/);
  assert.match(live, /default_workspace_relationship_failed/);
  assert.match(live, /cannot_disable_self/);
  assert.match(live, /cannot_revoke_self_superadmin/);
  assert.match(live, /platform_audit_events/);
  assert.match(live, /assertCleanup/);
});
