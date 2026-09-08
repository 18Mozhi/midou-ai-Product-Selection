window.USER_ADMIN_C_DATA = {
  overview: {
    summary: {
      organizations: 3,
      active_organizations: 2,
      users: 18,
      active_users: 16,
      platform_admins: 2,
    },
    organizations: [
      {
        id: "00000000-0000-4000-8000-000000000622",
        name: "米豆选品团队",
        slug: "midou-team",
        status: "active",
        timezone: "Asia/Shanghai",
        data_retention_days: 365,
        member_count: 8,
        workspace_count: 2,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-18T00:00:00Z",
      },
    ],
    users: [
      {
        id: "00000000-0000-4000-8000-000000000621",
        email: "buyer@example.test",
        status: "active",
        organization_names: "米豆选品团队",
        platform_roles: [],
        active_session_count: 1,
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-18T00:00:00Z",
      },
    ],
    admins: [
      {
        id: "00000000-0000-4000-8000-000000000624",
        email: "admin@example.test",
        status: "active",
        roles: ["platform_super_admin"],
        granted_at: "2026-08-01T00:00:00Z",
      },
    ],
  },
  platformRoles: [
    {
      code: "platform_operations_admin",
      name: "平台运营管理员",
      category: "platform",
      description: "管理平台运营，不可读取密钥明文。",
      capabilities: ["platform:operate", "collection:replay", "report:read"],
    },
    {
      code: "platform_security_admin",
      name: "平台安全管理员",
      category: "platform",
      description: "安全治理，对业务数据只读。",
      capabilities: ["platform:secure", "audit:read", "session:manage"],
    },
    {
      code: "platform_super_admin",
      name: "平台超级管理员",
      category: "platform",
      description: "初始化、授权和紧急处置，全部操作审计。",
      capabilities: [
        "platform:operate",
        "platform:secure",
        "platform:superadmin",
        "collection:replay",
        "report:read",
        "audit:read",
        "session:manage",
      ],
    },
  ],
  detail: {
    user: {
      id: "00000000-0000-4000-8000-000000000621",
      email: "buyer@example.test",
      status: "active",
      must_change_password: false,
      must_enroll_mfa: false,
    },
    memberships: [
      {
        id: "membership",
        organization_name: "米豆选品团队",
        roles: ["member"],
        status: "active",
      },
    ],
    sessions: [
      {
        id: "00000000-0000-4000-8000-000000000625",
        status: "active",
        device_label: "Chrome",
        last_seen_at: "2026-08-18T00:00:00Z",
      },
    ],
  },
  adminDetail: {
    user: {
      id: "00000000-0000-4000-8000-000000000624",
      email: "admin@example.test",
      status: "active",
      must_change_password: false,
      must_enroll_mfa: false,
    },
    memberships: [],
    sessions: [],
  },
  capabilityLabels: {
    "platform:operate": {
      label: "管理平台运营",
      group: "平台治理",
    },
    "collection:replay": {
      label: "重放采集任务",
      group: "采集治理",
    },
    "report:read": {
      label: "查看报表",
      group: "通知与报表",
    },
    "platform:secure": {
      label: "管理平台安全",
      group: "平台治理",
    },
    "audit:read": {
      label: "查看审计",
      group: "安全治理",
    },
    "session:manage": {
      label: "管理登录会话",
      group: "安全治理",
    },
    "platform:superadmin": {
      label: "管理平台角色与账号",
      group: "平台治理",
    },
  },
  organizationRoleCodes: [
    "member",
    "selection_manager",
    "procurement_member",
    "organization_admin",
    "auditor",
  ],
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
