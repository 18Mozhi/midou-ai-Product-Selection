// Source-derived personal profile fixture, form defaults and AccountShell sections.
window.PERSONAL_DESIGN_DATA = {
  sections: [
    { key: "profile", label: "基本资料", icon: "person" },
    { key: "permissions", label: "我的权限", icon: "shield" },
    { key: "security", label: "安全与设备", icon: "key" },
    { key: "notifications", label: "通知偏好", icon: "bell" },
    { key: "assets", label: "我的资产", icon: "diamond" },
  ],
  profile: {
    email: "member@example.test",
    email_verified_at: "2026-09-07T00:00:00.000Z",
    username: "member.test",
    display_name: "隔离成员",
    avatar_url: null,
    phone: null,
    phone_verified_at: null,
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    version: 3,
  },
  form: {
    username: "",
    display_name: "",
    avatar_url: "",
    phone: "",
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    reason: "更新个人资料",
  },
  sessionRequired: true,
};
