(() => {
  const scenes = [];
  function add(pageId, id, mode, state, label, extra = {}) {
    scenes.push({ pageId, id, mode, state, label, ...extra });
  }
  add("P01", "p01-loading", "landing", "loading", "根入口 / 正在确定入口");
  add("P01", "p01-blocked", "landing", "blocked", "根入口 / 无法确定入口");
  for (const [pageId, mode, label] of [
    ["P02", "login", "登录"],
    ["P03", "register", "注册"],
    ["P04", "forgot", "找回密码"],
    ["P06", "reset", "重置密码"],
  ]) {
    const prefix = pageId.toLowerCase();
    for (const [state, word] of [
      ["idle", "初始"],
      ["loading", "处理中"],
      ["invalid", "字段错误"],
      ["error", "服务端拒绝"],
      ["rate_limited", "请求频繁"],
      ["blocked", "连接受阻"],
    ])
      add(pageId, `${prefix}-${state}`, mode, state, `${label} / ${word}`);
  }
  add("P02", "p02-expired", "login", "expired", "登录 / 挑战失效，重新登录");
  add("P02", "p02-required", "login", "required", "登录 / 安全入口要求登录");
  add("P02", "p02-routing", "login", "routing", "登录 / 正在确认落点");
  add(
    "P02",
    "p02-success-no-route",
    "login",
    "success-no-route",
    "登录 / 结果未提供落点，保留范围入口",
  );
  add("P02", "p02-challenge", "challenge", "idle", "登录 / 验证码或恢复码");
  add("P02", "p02-challenge-loading", "challenge", "loading", "登录 / 正在验证挑战");
  add("P02", "p02-challenge-error", "challenge", "error", "登录 / 挑战未通过");
  add("P02", "p02-seed", "seed", "idle", "首次设置 / 修改密码");
  add("P02", "p02-seed-loading", "seed", "loading", "首次设置 / 改密处理中");
  add("P02", "p02-seed-error", "seed", "error", "首次设置 / 改密失败");
  add("P02", "p02-seed-relogin", "login", "seed-relogin", "首次设置 / 改密后重新登录");
  add("P02", "p02-seed-enroll", "enroll", "idle", "首次设置 / 绑定认证器", { seed: true });
  add("P02", "p02-seed-secret", "secret", "idle", "首次设置 / 手动绑定材料", { seed: true });
  add("P02", "p02-seed-recovery", "recovery", "success", "首次设置 / 保存恢复码后重新登录", {
    seed: true,
  });
  add("P03", "p03-mismatch", "register", "mismatch", "注册 / 两次密码不一致");
  add("P03", "p03-queued", "verify", "queued", "注册 / 邮件进入队列，未登录");
  add("P04", "p04-accepted", "forgot", "success", "找回 / 通用受理结果");
  add("P05", "p05-missing", "verify", "missing", "验证邮箱 / 无链接材料");
  add("P05", "p05-loading", "verify", "loading", "验证邮箱 / 自动确认中");
  add("P05", "p05-success", "verify", "success", "验证邮箱 / 验证完成");
  add("P05", "p05-error", "verify", "error", "验证邮箱 / 失败或链接无效");
  add("P05", "p05-limited", "verify", "rate_limited", "验证邮箱 / 请求频繁");
  add("P05", "p05-blocked", "verify", "blocked", "验证邮箱 / 服务受阻");
  add("P06", "p06-success", "reset", "success", "重置 / 已更新，尚未登录");
  add("P06", "p06-link-invalid", "reset", "link-invalid", "重置 / 缺失或无效链接");
  add("P07", "p07-loading", "mfa-read", "loading", "MFA / 读取中，状态未知");
  add("P07", "p07-read-error", "mfa-read", "blocked", "MFA / 读取失败，不显示未启用");
  add("P07", "p07-enroll", "enroll", "idle", "MFA / 未启用，验证当前密码");
  add("P07", "p07-enroll-loading", "enroll", "loading", "MFA / 开始绑定处理中");
  add("P07", "p07-enroll-error", "enroll", "error", "MFA / 开始绑定失败");
  add("P07", "p07-secret", "secret", "idle", "MFA / 手动密钥与验证码");
  add("P07", "p07-confirm-loading", "secret", "loading", "MFA / 确认启用处理中");
  add("P07", "p07-confirm-error", "secret", "error", "MFA / 确认启用失败");
  add("P07", "p07-recovery", "recovery", "success", "MFA / 本次恢复码");
  add("P07", "p07-enabled", "enabled", "idle", "MFA / 已启用与停用区");
  add("P07", "p07-disable-loading", "enabled", "loading", "MFA / 停用处理中");
  add("P07", "p07-disable-error", "enabled", "error", "MFA / 停用失败");
  add("P07", "p07-disabled", "disabled", "success", "MFA / 已停用，需重新登录");
  add("P07", "p07-expired", "mfa-read", "expired", "MFA / 会话失效");
  for (const [id, mode, state, label] of [
    ["loading", "organizations", "loading", "读取组织"],
    ["organizations", "organizations", "idle", "组织目录"],
    ["search-empty", "organizations", "search-empty", "搜索无匹配"],
    ["empty", "organizations", "empty", "没有组织，可创建本人空间"],
    ["provisioning", "organizations", "provisioning", "创建本人空间中"],
    ["error", "organizations", "error", "读取失败"],
    ["forbidden", "organizations", "forbidden", "成员资格受限"],
    ["expired", "organizations", "expired", "登录过期"],
    ["workspaces", "workspaces", "idle", "工作区目录"],
    ["workspaces-loading", "workspaces", "loading", "读取工作区与团队"],
    ["workspaces-empty", "workspaces", "empty", "没有工作区，不显示创建组织"],
    ["selecting", "workspaces", "selecting", "正在设置会话范围"],
    ["selected", "workspaces", "selected", "范围已就绪，待继续"],
    ["return", "workspaces", "selected", "范围已就绪，返回原页面"],
  ])
    add("P08", `p08-${id}`, mode, state, `范围选择 / ${label}`, {
      returnTo: id === "return" ? "/tasks" : "/onboarding",
    });
  for (let step = 1; step <= 3; step++)
    add("P09", `p09-step-${step}`, "guide", "idle", `引导 / 第${step}步`, { step });
  window.IDENTITY_CASES = scenes;
})();
