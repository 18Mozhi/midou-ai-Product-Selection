window.MEMBERS_C_DATA = {
  provenance: "Original M06-01 E2E members/invitations; synthetic variants labeled separately",
  now: "2026-09-08T00:00:00Z",
  members: {
    items: [
      {
        id: "00000000-0000-4000-8000-000000000611",
        display_name: "林管理员",
        email: "admin@example.test",
        account_status: "active",
        status: "active",
        roles: ["organization_admin"],
        scopes: ["organization"],
        teams: ["治理组"],
        version: 2,
        joined_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000612",
        display_name: "陈采购",
        email: "buyer@example.test",
        account_status: "active",
        status: "active",
        roles: ["procurement_member"],
        scopes: ["workspace"],
        teams: ["采购协作组"],
        version: 1,
        joined_at: "2026-08-02T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000621",
        display_name: "钱锁定",
        email: "locked@example.test",
        account_status: "locked",
        status: "active",
        roles: ["member"],
        scopes: ["organization"],
        teams: [],
        version: 1,
        joined_at: "2026-08-03T00:00:00.000Z",
      },
    ],
    invitations: [
      {
        id: "00000000-0000-4000-8000-000000000613",
        email: "new@example.test",
        role_code: "member",
        status: "pending_delivery",
        expires_at: "2026-09-11T00:00:00.000Z",
        version: 1,
      },
      {
        id: "00000000-0000-4000-8000-000000000617",
        email: "expired@example.test",
        role_code: "member",
        status: "expired",
        expires_at: "2026-08-11T00:00:00.000Z",
        version: 2,
      },
    ],
  },
  summary: {
    organization: {
      id: "00000000-0000-4000-8000-000000000601",
      name: "Global Goods Co.",
      timezone: "Asia/Shanghai",
      data_retention_days: 365,
      default_workspace_id: "00000000-0000-4000-8000-000000000602",
      version: 3,
    },
    members: {
      total: 128,
      active: 96,
    },
    workspaces: {
      total: 8,
      active: 8,
    },
    teams: {
      total: 24,
      active: 24,
    },
    pending_approvals: 7,
    active_tokens: 18,
    recent_audit_events: 1238,
    observed_at: "2026-08-08T12:00:00.000Z",
  },
  roles: ["member", "selection_manager", "procurement_member", "organization_admin", "auditor"],
  roleLabels: {
    member: "普通成员",
    selection_manager: "选品经理",
    procurement_member: "采购成员",
    organization_admin: "组织管理员",
    auditor: "审计员",
  },
  scopeLabels: {
    own: "本人范围",
    team: "团队范围",
    workspace: "工作区范围",
    organization: "组织范围",
  },
  contracts: {
    disable: {
      url: "/org/admin/members/00000000-0000-4000-8000-000000000612/actions",
      method: "POST",
      body: {
        action: "disable",
        expected_version: 1,
        reason: "核验成员变更",
      },
      options: {
        preserveForm: true,
      },
    },
    restore: {
      url: "/org/admin/members/00000000-0000-4000-8000-000000000621/actions",
      method: "POST",
      body: {
        action: "restore",
        expected_version: 1,
        reason: "核验成员变更",
      },
      options: {
        preserveForm: true,
      },
    },
    role: {
      url: "/org/admin/members/00000000-0000-4000-8000-000000000612/roles",
      method: "POST",
      body: {
        role_code: "selection_manager",
        expected_version: 1,
        reason: "核验成员变更",
      },
      options: {
        preserveForm: true,
      },
    },
    revoke: {
      url: "/org/admin/invitations/00000000-0000-4000-8000-000000000613/actions",
      method: "POST",
      body: {
        action: "revoke",
        expected_version: 1,
        reason: "核验成员变更",
      },
      options: {
        preserveForm: true,
      },
    },
  },
  batch: {
    calls: [
      {
        url: "/org/admin/invitations",
        method: "POST",
        body: {
          email: "first@example.test",
          role_code: "member",
          reason: "合成邀请原因",
        },
      },
      {
        url: "/org/admin/invitations",
        method: "POST",
        body: {
          email: "second@example.test",
          role_code: "member",
          reason: "合成邀请原因",
        },
      },
    ],
    results: [
      {
        email: "bad",
        status: "error",
        message: "邮箱格式无效",
      },
      {
        email: "first@example.test",
        status: "success",
        message: "已创建待投递邀请",
      },
      {
        email: "second@example.test",
        status: "error",
        message: "合成拒绝",
      },
    ],
    form: {
      emails: "bad\nsecond@example.test",
      role_code: "member",
      reason: "合成邀请原因",
    },
    notice: "邀请处理完成：成功 1，失败 2，输入重复 1 条已合并。",
    failures: [],
  },
  unauthorized: {
    calls: [
      {
        url: "/org/admin/invitations",
        method: "POST",
        body: {
          email: "a@example.test",
          role_code: "member",
          reason: "合成邀请原因",
        },
      },
    ],
    results: [
      {
        email: "a@example.test",
        status: "error",
        message: "合成拒绝",
      },
    ],
    form: {
      emails: "a@example.test",
      role_code: "member",
      reason: "合成邀请原因",
    },
    notice: "邀请处理完成：成功 0，失败 1。",
    failures: [
      {
        kind: "forbidden",
        page: true,
      },
    ],
  },
  sourceChecks: [
    "Four source versioned action bodies and cancellation zero-write",
    "Source invite normalization/deduplication and partial-failure retained emails",
    "Source unauthorized interruption loses unprocessed emails and overwrites notice (OG-G02 reproduced)",
    "Source effective account/membership state, filters and ten-row pagination",
    "Actual service fixed roles/email/reason validation and lowercase normalization",
    "Source reason dialog minimum two and missing 500 maxlength preserved as proposal gap",
  ],
};
