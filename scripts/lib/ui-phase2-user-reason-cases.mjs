// Exact titles and triggers from PlatformAccountCenter/PlatformUserDetailDialog.
// Fixture mutations are explicit and are not production authorization evidence.
export const userReasonCases = [
  {
    id: "disable",
    title: "停用用户并撤销会话",
    trigger: "停用登录",
    status: "active",
    role: null,
    scope: "footer",
    color: "red",
  },
  {
    id: "restore",
    title: "恢复用户",
    trigger: "恢复登录",
    status: "disabled",
    role: null,
    scope: "footer",
    color: "blue",
  },
  ...[
    ["operations", "platform_operations_admin", "运营管理员"],
    ["security", "platform_security_admin", "安全管理员"],
    ["super", "platform_super_admin", "超级管理员"],
  ].flatMap(([id, code, name]) => [
    {
      id: "grant-" + id,
      title: "授予" + name,
      trigger: "授予" + name,
      status: "active",
      role: null,
      scope: "role",
      color: "blue",
    },
    {
      id: "revoke-" + id,
      title: "撤销" + name,
      trigger: "撤销" + name,
      status: "active",
      role: code,
      scope: "role",
      color: "red",
    },
  ]),
  {
    id: "session-one",
    title: "撤销该会话",
    trigger: "撤销",
    status: "active",
    role: null,
    scope: "session",
    color: "red",
  },
  {
    id: "session-all",
    title: "撤销全部活动会话",
    trigger: "撤销全部会话",
    status: "active",
    role: null,
    scope: "footer",
    color: "red",
  },
];
