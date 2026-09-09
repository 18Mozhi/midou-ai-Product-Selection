(() => {
  const themes = [
    { id: "deep-ocean", name: "目录蓝", caption: "蓝色范围，纯白工作面" },
    { id: "aurora-purple", name: "冷雾蓝", caption: "灰蓝范围，冷白工作面" },
    { id: "cloud-white", name: "净页白", caption: "浅色范围，蓝色主操作" },
  ];
  const scenes = [];
  for (const t of themes)
    for (const density of ["standard", "compact"])
      scenes.push({
        id: `${t.id}-${density}`,
        label: `${t.name} / ${density === "standard" ? "标准" : "紧凑"}`,
        theme: t.id,
        density,
        status: "ready",
        saved: t.id,
      });
  for (const [id, label, extra] of [
    ["default", "默认偏好，不冒充已保存", { source: "default", version: 0 }],
    ["dirty", "本地预览，服务器记录未变", { theme: "aurora-purple" }],
    ["density-only", "仅调整密度，不启用保存", { density: "compact" }],
    ["saving", "正在保存，锁定选择与撤销", { theme: "aurora-purple", status: "saving" }],
    [
      "saved",
      "服务器返回成功",
      { theme: "aurora-purple", saved: "aurora-purple", status: "saved", version: 2 },
    ],
    [
      "saved-different",
      "写入已返回，预览仍有差异",
      { theme: "deep-ocean", saved: "aurora-purple", status: "saved", version: 2 },
    ],
    ["loading", "读取中，不声称已同步", { status: "loading", saved: null }],
    ["read-error", "读取失败，无可确认的记录", { status: "error", saved: null }],
    ["read-invalid", "返回主题不可识别", { status: "invalid", saved: null }],
    ["expired", "登录已过期", { status: "expired", saved: null }],
    ["forbidden", "当前范围无权限", { status: "forbidden", saved: null }],
    ["scope", "明确返回 preference_scope_required", { status: "scope", saved: null }],
    ["conflict", "版本冲突，刷新再选", { status: "conflict", theme: "aurora-purple" }],
    [
      "rate-limited",
      "请求频繁，不推断无工作区",
      { status: "rate_limited", theme: "aurora-purple" },
    ],
    ["service-error", "保存服务受阻，结果未知", { status: "blocked", theme: "aurora-purple" }],
    ["save-error", "保存失败，保留预览", { status: "save-error", theme: "aurora-purple" }],
  ])
    scenes.push({
      id,
      label,
      theme: "deep-ocean",
      saved: "deep-ocean",
      density: "standard",
      status: "ready",
      ...extra,
    });
  let state,
    timer,
    events = [];
  const app = document.querySelector("#app"),
    picker = document.querySelector("#scene");
  const name = (id) => themes.find((t) => t.id === id)?.name || "尚未确认";
  const busy = () => ["loading", "saving"].includes(state.status);
  const dirty = () => state.theme !== (state.saved || "deep-ocean");
  const errors = [
    "error",
    "invalid",
    "expired",
    "forbidden",
    "scope",
    "conflict",
    "rate_limited",
    "blocked",
    "save-error",
  ];
  const button = (id, label, disabled = false, css = "") =>
    `<button data-action="${id}" class="${css}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const link = (id, label, route, current = false) =>
    `<a href="#" data-action="${id}" data-route="${route}" ${current ? 'aria-current="page"' : ""}>${label}</a>`;
  function notice() {
    const messages = {
      error: ["偏好读取失败", "没有取得有效记录，当前画面不能代表服务器偏好。"],
      invalid: ["无法识别返回的主题", "未将未知主题当作默认值保存，请刷新后再确认。"],
      expired: ["登录已过期", "重新登录后再读取当前组织与工作区偏好。"],
      forbidden: ["无权访问当前偏好范围", "请确认当前身份与范围，不尝试覆盖服务器记录。"],
      scope: [
        "尚未选择组织与工作区",
        "本场景明确对应 preference_scope_required；不是将所有网络错误解释为缺少范围。",
      ],
      conflict: ["偏好已在其他窗口更新", "刷新最新版本后重新选择，不自动覆盖他人的修改。"],
      rate_limited: ["请求过于频繁", "请稍后刷新偏好。不据此推断工作区尚未选择。"],
      blocked: [
        "保存结果尚不确定",
        "服务暂不可用。当前预览仍保留，但不能确认服务器是否接收本次写入；先刷新核对。",
      ],
      "save-error": ["主题未能保存", "预览不等于服务器记录。保留当前预览，刷新最新偏好后再选择。"],
    };
    if (state.status === "saved")
      return `<div class="notice success" role="status"><strong>${dirty() ? "写入已返回，但当前预览仍有差异" : "主题已保存"}</strong><p>${dirty() ? "服务器记录与当前选择不同，不显示为全部同步。" : `服务器返回版本 ${state.version}。本次保存仅包含主题，不包含页面密度。`}</p></div>`;
    if (!messages[state.status]) return "";
    const [title, copy] = messages[state.status];
    return `<div class="notice error" role="status"><strong>${title}</strong><p>${copy}</p><details><summary>查看关联信息</summary><small>请求标识：synthetic-preference-request<br />${state.status === "scope" ? "错误码：preference_scope_required" : state.status === "conflict" ? "错误码：preference_version_conflict" : "合成场景，不对应生产请求"}</small></details><div class="recovery">${state.status === "expired" ? link("AC-LOGIN", "重新登录", "/login") : state.status === "scope" ? link("AC-CONTEXT", "选择工作区", "/select-context") : button("TH-LOAD", "刷新偏好", false, "primary")}</div></div>`;
  }
  function main() {
    if (state.status === "loading")
      return '<section class="panel state-only" aria-live="polite"><h2>正在读取工作区偏好…</h2><p>确认服务器记录后，再展示来源、版本与可保存的变化。</p></section>';
    if (errors.includes(state.status) && !state.saved) return notice();
    const blocked = busy() || errors.includes(state.status);
    return `${notice()}<section class="panel"><div class="heading"><div><h2>界面主题</h2><p>选择后立即预览，点击保存才更新服务器偏好。</p></div><span class="badge">${state.status === "saving" ? "正在保存" : dirty() ? "有未保存的主题预览" : state.source === "default" ? "使用默认主题" : "与已读记录一致"}</span></div>
      <div class="theme-options" role="radiogroup" aria-label="界面主题">${themes.map((t) => `<button class="theme-option" role="radio" data-action="TH-PREVIEW" data-value="${t.id}" aria-checked="${state.theme === t.id}" tabindex="${state.theme === t.id ? 0 : -1}" ${blocked ? "disabled" : ""}><span class="swatch" data-id="${t.id}" aria-hidden="true"><i></i><span></span></span><strong>${t.name}</strong><small>${t.caption}</small><em>${state.theme === t.id ? "✓ 当前预览" : "选择预览"}</em></button>`).join("")}</div>
      <div class="record"><div><small>当前预览 · 本地显示</small><strong>${name(state.theme)}</strong><small>当前画面不等于已写入服务器。</small></div><div><small>服务器记录 · ${state.source === "default" ? "默认值" : "已读取"}</small><strong>${name(state.saved)}</strong><small>版本 ${state.version} · ${state.source === "default" ? "尚未创建保存记录" : "合成工作区记录"}</small></div></div>
      <div class="savebar"><small>${state.status === "saving" ? "等待返回时，请勿切换选择或撤销。" : "撤销只恢复主题，不重置密度。"}</small><div>${button("TH-RESTORE", "撤销预览", !dirty() || blocked)}${button("TH-SAVE", state.status === "saving" ? "正在保存…" : "保存主题", !dirty() || blocked, "primary")}</div></div></section>
      <section class="panel"><div class="preview-title"><h2>效果预览</h2><span class="meta">组件样例 · 非真实业务数据</span></div><div class="sample" aria-label="非交互主题样例"><aside class="sample-rail">当前范围<br /><small style="color:inherit">${name(state.theme)}</small></aside><div class="sample-body"><h3>状态始终有文字说明</h3><div class="sample-row"><b>证据完整</b><span class="ok">✓ 可用</span></div><div class="sample-row"><b>需要人工确认</b><span class="warn">! 待复核</span></div><div class="sample-row"><b>关键材料缺失</b><span class="bad">× 受阻</span></div></div></div><div class="shells"><div><strong>成员工作台</strong><span>当前主题与会话密度</span></div><div><strong>组织管理后台</strong><span>继承主题 · 行政紧凑布局</span></div><div><strong>平台管理后台</strong><span>继承主题 · 不推断保存范围</span></div></div></section>
      <section class="panel"><h2>页面密度</h2><p class="intro">只在当前会话即时生效，不写入主题保存请求。切换行政壳层时使用紧凑布局。</p><div class="density-options" role="radiogroup" aria-label="页面密度">${[
        ["standard", "标准", "舒适间距，适合日常浏览"],
        ["compact", "紧凑", "减少行距，控件热区保持44像素"],
      ]
        .map(
          ([id, label, text]) =>
            `<button class="density-option" role="radio" data-action="TH-DENSITY" data-value="${id}" aria-checked="${state.density === id}" tabindex="${state.density === id ? 0 : -1}" ${blocked ? "disabled" : ""}><strong>${label}${state.density === id ? " · 已应用" : ""}</strong><small>${text}</small></button>`,
        )
        .join("")}</div></section>`;
  }
  function render(focusAction, focusValue) {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.density = state.density;
    app.innerHTML = `<header class="top">${link("AC-ROOT", "<b>选</b>智能选品", "/").replace('href="#"', 'class="brand" href="#"')}<span class="meta">个人外观</span></header><div class="layout"><aside class="rail"><small>PERSONAL SETTINGS</small><h2>个人设置</h2><p class="rail-copy">外观改变呈现，不改变权限与业务结论。</p><nav aria-label="个人设置">${link("AC-PROFILE", "个人资料", "/me")}${link("AC-MFA", "安全设置", "/security/mfa")}${link("TH-ROUTE", "外观设置", "/settings/theme", true)}</nav><dl><dt>偏好范围</dt><dd>${state.saved ? "本人 / 合成组织 / 合成工作区" : "尚未确认"}</dd><dt>版本记录</dt><dd>${state.saved ? `版本 ${state.version} · 合成样例` : "待读取"}</dd></dl></aside><main class="main"><h1 id="title" tabindex="-1">让界面适合你的工作</h1><p class="intro">主题可以保存到当前范围；密度是本次会话的显示选择。</p>${main()}</main></div><footer class="footer"><span>P10 · APPEARANCE-C-r1 · 待审核</span><span>离线合成演示 · 不写入真实偏好</span></footer>`;
    if (focusAction)
      (
        app.querySelector(
          `[data-action="${focusAction}"]${focusValue ? `[data-value="${focusValue}"]` : ""}`,
        ) || document.querySelector("#title")
      ).focus({ preventScroll: true });
  }
  function choose(id) {
    clearTimeout(timer);
    const item = scenes.find((s) => s.id === id) || scenes[0];
    state = { version: 1, source: "saved", ...item };
    picker.value = item.id;
    render();
  }
  function act(el) {
    if (el.disabled) return;
    const id = el.dataset.action,
      value = el.dataset.value;
    if (el.dataset.route) {
      events.push({ action: id, route: el.dataset.route });
      document.querySelector("#navigation").textContent =
        `演示导航：${el.dataset.route}，未访问真实页面。`;
      return;
    }
    if (busy()) return;
    if (id === "TH-PREVIEW") {
      state.theme = value;
      if (state.status === "saved") state.status = "ready";
    } else if (id === "TH-DENSITY") state.density = value;
    else if (id === "TH-RESTORE") {
      state.theme = state.saved || "deep-ocean";
      state.status = "ready";
    } else if (id === "TH-LOAD") {
      events.push({ action: id, method: "GET", path: "/me/ui-preferences" });
      state.status = "loading";
      render();
      timer = setTimeout(() => {
        state.saved = "cloud-white";
        state.theme = "cloud-white";
        state.version = 2;
        state.source = "saved";
        state.status = "ready";
        render("TH-PREVIEW", state.theme);
      }, 180);
      return;
    } else if (id === "TH-SAVE" && dirty()) {
      events.push({
        action: id,
        method: "PUT",
        path: "/me/ui-preferences",
        body: { theme: state.theme, expected_version: state.version },
      });
      state.status = "saving";
      render();
      timer = setTimeout(() => {
        state.saved = state.theme;
        state.version += 1;
        state.status = "saved";
        state.source = "saved";
        render("TH-PREVIEW", state.theme);
      }, 180);
      return;
    }
    events.push({ action: id, value });
    render(id, value);
  }
  app.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (el) {
      event.preventDefault();
      act(el);
    }
  });
  app.addEventListener("keydown", (event) => {
    const el = event.target.closest('[role="radio"]');
    if (
      !el ||
      el.disabled ||
      !["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
    )
      return;
    event.preventDefault();
    const list = [...el.parentElement.querySelectorAll('[role="radio"]')],
      index = list.indexOf(el);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? list.length - 1
          : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + list.length) %
            list.length;
    act(list[next]);
  });
  picker.innerHTML = scenes.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  picker.addEventListener("change", () => choose(picker.value));
  window.appearanceReview = {
    choose,
    scenes,
    current: () => ({ ...state }),
    events: () => [...events],
    resetEvents: () => {
      events = [];
    },
  };
  choose(new URLSearchParams(location.search).get("scene") || "deep-ocean-standard");
})();
