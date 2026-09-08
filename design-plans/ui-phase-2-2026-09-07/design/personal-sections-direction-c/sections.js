(() => {
  const data = window.PERSONAL_SECTIONS_DATA,
    $ = (id) => document.getElementById(id),
    clone = (value) => structuredClone(value);
  const scenes = [
    "permissions",
    "permissions-token",
    "permissions-empty",
    "permissions-loading",
    "permissions-error",
    "permissions-fallback",
    "security",
    "security-empty",
    "security-loading",
    "security-error",
    "security-mismatch",
    "security-password-busy",
    "security-password-failed",
    "security-password-success",
    "security-revoke-busy",
    "security-revoke-failed",
    "security-revoked-retry-failed",
    "security-expired-retry-failed",
    "security-revoked",
    "notifications",
    "notifications-loading",
    "notifications-error",
    "notifications-edited",
    "notifications-mail-blocked",
    "notifications-saving",
    "notifications-saved",
    "notifications-save-failed",
    "assets",
    "assets-empty",
    "assets-loading",
    "assets-error",
  ];
  const e = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const when = (value) =>
    value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未设置";
  const prefLabels = {
    in_app_enabled: "站内通知",
    email_enabled: "邮件通知",
    task_enabled: "任务通知",
    approval_enabled: "审批通知",
    competitor_enabled: "竞品通知",
  };
  let section = "permissions",
    readState = "ready",
    authorization,
    sessions,
    assets,
    preferences;
  let notice = "",
    failed = false,
    busy = "",
    outcome = "success",
    generation = 0,
    passwordError = "",
    lastIntent = null,
    lastRoute = "";
  let password = { current_password: "", new_password: "", confirm_password: "" };
  function showNotice(text, isError = false) {
    notice = text;
    failed = isError;
    $("notice").textContent = text;
    $("notice").hidden = !text;
    $("notice").dataset.error = String(isError);
  }
  function statePanel() {
    return `<section class="read-panel"><h3>${readState === "loading" ? "正在读取分区数据" : "当前分区暂不可用"}</h3><p>${readState === "loading" ? "个人资料已读取，等待分区返回；不展示旧结果。" : "读取失败不等于没有数据。请刷新个人中心后重试。"}</p>${readState === "error" ? "<button data-refresh>刷新个人中心</button>" : ""}</section>`;
  }
  function renderPermissions() {
    if (readState !== "ready") return statePanel();
    const tags = (items, fn) =>
      items.length
        ? `<div class="tag-list">${items.map((item) => `<span class="tag">${e(fn(item))}</span>`).join("")}</div>`
        : "<p>当前响应未返回条目。</p>";
    return `<div class="panel-grid"><section class="panel"><p class="eyebrow">01 / ROLE</p><h3>角色</h3>${tags(authorization.roles, (item) => data.labels.roleName[item] || "自定义角色")}</section><section class="panel"><p class="eyebrow">02 / SCOPE</p><h3>数据范围</h3>${tags(authorization.data_scopes, (item) => `${data.labels.scopeName[item.scope] || "指定范围"}${item.scope_key ? " · 指定范围" : ""}`)}</section><section class="panel wide"><p class="eyebrow">03 / CAPABILITY</p><h3>可执行动作</h3>${tags(authorization.capabilities, (item) => data.labels.capabilityName[item] || "其他已授权操作")}${authorization.capabilities.includes("organization_token:manage") ? '<a href="/org-admin/tokens">管理组织令牌 →</a>' : ""}<p class="quiet">只读查看，不在个人中心修改角色或授权。</p></section></div>`;
  }
  function renderSecurity() {
    const sessionList =
      readState !== "ready"
        ? statePanel()
        : `<section class="panel"><p class="eyebrow">DEVICE SESSIONS</p><h3>设备会话</h3>${sessions.length ? sessions.map((item) => `<div class="record"><div><b>${e(item.device_label)}</b><small>${e(data.labels.statusName[item.status] || item.status)} · ${e(when(item.last_seen_at))}</small></div><button class="danger" data-revoke="${e(item.id)}" ${busy ? "disabled" : ""}>${busy === item.id ? "正在撤销…" : "撤销会话"}</button></div>`).join("") : "<p>暂无活动会话。</p>"}</section>`;
    return `<div class="security-grid"><section class="panel security-top"><div><p class="eyebrow">AUTHENTICATION</p><h3>多因素认证</h3><p>认证器绑定、恢复码和停用由独立安全页面处理。</p></div><a href="/security/mfa">管理 MFA →</a></section><form id="password-form" class="panel password-layout"><div><p class="eyebrow">PASSWORD</p><h3>修改密码</h3><p>成功后撤销全部会话，并返回登录页。</p><p class="quiet">审核稿请勿输入真实密码；不会提交到服务端。</p></div><div class="password-fields"><label>当前密码<input name="current_password" type="password" autocomplete="current-password" required minlength="12" /></label><label>新密码<input name="new_password" type="password" autocomplete="new-password" required minlength="12" /></label><label>确认新密码<input name="confirm_password" type="password" autocomplete="new-password" required minlength="12" ${passwordError ? 'aria-invalid="true" aria-describedby="password-error"' : ""} /></label><p id="password-error" role="alert" ${passwordError ? "" : "hidden"}>${e(passwordError)}</p><button class="danger-primary" ${busy ? "disabled" : ""}>${busy === "password" ? "正在修改…" : "修改并撤销全部会话"}</button></div></form>${sessionList}</div>`;
  }
  function renderPreferences() {
    if (readState !== "ready") return statePanel();
    return `<form id="preferences-form" class="panel"><p class="eyebrow">NOTIFICATION PREFERENCES</p><h3>选择接收的通知</h3><p>仅调整当前账号与业务范围的五项偏好。</p>${Object.entries(
      prefLabels,
    )
      .map(
        ([key, label]) =>
          `<label class="switch-row"><span><b>${label}</b>${key === "email_enabled" ? "<small>当前后端未接入邮件服务，开启后保存将受阻。</small>" : ""}</span><input type="checkbox" name="${key}" ${preferences[key] ? "checked" : ""} ${busy ? "disabled" : ""} /></label>`,
      )
      .join(
        "",
      )}<div class="form-actions"><button class="primary" ${busy ? "disabled" : ""}>${busy ? "正在保存…" : "保存偏好"}</button><span class="quiet">版本 ${preferences.version} · 隔离样例</span></div></form>`;
  }
  function renderAssets() {
    if (readState !== "ready") return statePanel();
    const groups = [
      {
        title: "关注热点",
        items: assets.followed_trends,
        empty: "暂无关注热点。",
        route: (item) => `/trends?topic=${item.id}`,
        label: (item) => item.title,
        meta: (item) => `${item.market} · ${when(item.created_at)}`,
      },
      {
        title: "我的决策",
        items: assets.decisions,
        empty: "暂无人工决策。",
        route: (item) => `/opportunities/${item.opportunity_id}`,
        label: (item) => item.opportunity_name,
        meta: (item) =>
          `${data.labels.decisionName[item.action] || "已处理"} · ${when(item.created_at)}`,
      },
      {
        title: "我的任务",
        items: assets.tasks,
        empty: "暂无本人任务。",
        route: () => "/tasks",
        label: (item) => item.title,
        meta: (item) =>
          `${data.labels.statusName[item.status] || item.status} · ${data.labels.statusName[item.priority] || item.priority} · ${when(item.due_at)}`,
      },
    ];
    return `<div class="asset-directory">${groups.map((group) => `<section class="panel"><h3>${group.title}</h3>${group.items.length ? group.items.map((item) => `<div class="record"><div><a href="${e(group.route(item))}">${e(group.label(item))} →</a><small>${e(group.meta(item))}</small></div></div>`).join("") : `<p>${group.empty}</p>`}</section>`).join("")}</div>`;
  }
  function render() {
    $("heading").textContent = data.sections.find((item) => item.key === section).label;
    $("subtitle").textContent = {
      permissions: "角色、可见范围与操作能力分开核对。",
      security: "认证、密码和设备分别处理。",
      notifications: "通知渠道与事件偏好明确可见。",
      assets: "从关注、决策和任务返回原始对象。",
    }[section];
    $("sections")
      .querySelectorAll("[data-section]")
      .forEach((link) => {
        if (link.dataset.section === section) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    $("content").innerHTML =
      section === "permissions"
        ? renderPermissions()
        : section === "security"
          ? renderSecurity()
          : section === "notifications"
            ? renderPreferences()
            : renderAssets();
    showNotice(notice, failed);
    $("content")
      .querySelectorAll("[data-refresh]")
      .forEach((button) => button.addEventListener("click", refresh));
    $("content")
      .querySelectorAll("[data-revoke]")
      .forEach((button) => button.addEventListener("click", () => revoke(button.dataset.revoke)));
    if ($("password-form")) {
      for (const key of Object.keys(password)) {
        const input = $("password-form").elements.namedItem(key);
        input.value = password[key];
        input.addEventListener("input", () => {
          password[key] = input.value;
        });
      }
      $("password-form").addEventListener("submit", changePassword);
    }
    $("preferences-form")?.addEventListener("submit", savePreferences);
    $("preferences-form")
      ?.querySelectorAll("input")
      .forEach((input) =>
        input.addEventListener("change", () => {
          preferences[input.name] = input.checked;
        }),
      );
  }
  function complete(kind, finish) {
    const owned = generation;
    busy = kind;
    render();
    setTimeout(() => {
      if (owned !== generation) return;
      busy = "";
      finish();
      render();
    }, 450);
  }
  function savePreferences(event) {
    event.preventDefault();
    if (busy || readState !== "ready") return;
    const body = {
      expected_version: preferences.version,
      ...Object.fromEntries(Object.keys(prefLabels).map((key) => [key, preferences[key]])),
    };
    lastIntent = { method: "PUT", path: "/me/notification-preferences", body };
    complete("preferences", () => {
      if (body.email_enabled) showNotice(data.mailBlocked.actionHint, true);
      else if (outcome === "failure")
        showNotice("隔离模拟：保存失败，未写入偏好；请刷新后核对版本。", true);
      else {
        preferences = { ...preferences, ...body, version: preferences.version + 1 };
        showNotice("通知偏好已保存。（隔离演示，未真实写入）");
      }
    });
  }
  function changePassword(event) {
    event.preventDefault();
    if (busy) return;
    if (password.new_password !== password.confirm_password) {
      passwordError = "两次输入的新密码不一致。";
      render();
      $("password-form").elements.namedItem("confirm_password").focus();
      return;
    }
    passwordError = "";
    // Record shape only; never include password values in diagnostics or outputs.
    const payload = {
      current_password: password.current_password,
      new_password: password.new_password,
    };
    lastIntent = {
      method: "POST",
      path: "/me/password",
      bodyKeys: Object.keys(payload),
    };
    complete("password", () => {
      if (outcome === "failure") showNotice("检查当前密码后重试。", true);
      else {
        password = { current_password: "", new_password: "", confirm_password: "" };
        lastRoute = "/login";
        $("destination").textContent = "审核模拟 replace /login；没有修改密码或撤销真实会话。";
        showNotice("修改成功后返回登录页。（隔离流程演示）");
      }
    });
  }
  function revoke(id) {
    if (busy) return;
    lastIntent = { method: "DELETE", path: `/me/sessions/${id}` };
    const active = sessions.find((item) => item.id === id)?.status === "active";
    complete(id, () => {
      if (outcome === "failure" || !active) showNotice("刷新会话列表后重试。", true);
      else {
        sessions = sessions.filter((item) => item.id !== id);
        showNotice("设备会话已撤销。（隔离演示，未影响真实设备）");
      }
    });
  }
  function refresh() {
    generation++;
    readState = "loading";
    busy = "";
    showNotice("");
    lastIntent = {
      method: "GET",
      paths: [
        "/me/profile",
        "/me/authorization",
        "/me/sessions",
        "/me/notification-preferences",
        "/me/assets",
      ],
    };
    const owned = generation;
    render();
    setTimeout(() => {
      if (owned !== generation) return;
      readState = "ready";
      preferences = clone(data.preferences);
      render();
    }, 450);
  }
  function showScene(name) {
    generation++;
    section = name.split("-")[0];
    readState = name.endsWith("loading") ? "loading" : name.endsWith("error") ? "error" : "ready";
    authorization = clone(data.sample.authorization);
    sessions = clone(data.sample.sessions);
    assets = clone(data.sample.assets);
    preferences = clone(data.preferences);
    busy = "";
    passwordError = "";
    password = { current_password: "", new_password: "", confirm_password: "" };
    lastIntent = null;
    lastRoute = "";
    showNotice("");
    outcome = name.includes("failed") ? "failure" : "success";
    if (name === "permissions-token") authorization.capabilities.push("organization_token:manage");
    if (name === "permissions-empty")
      authorization = { roles: [], capabilities: [], data_scopes: [] };
    if (name === "permissions-fallback")
      authorization = {
        roles: ["custom"],
        capabilities: ["organization_token:manage"],
        data_scopes: [{ scope: "custom", scope_key: "example-scope" }],
      };
    if (name === "security-empty") sessions = [];
    if (name === "assets-empty") assets = { followed_trends: [], decisions: [], tasks: [] };
    if (name.includes("password") || name === "security-mismatch")
      password = {
        current_password: "Preview-only-123",
        new_password: "Preview-only-456",
        confirm_password: name.endsWith("mismatch") ? "Preview-only-789" : "Preview-only-456",
      };
    if (name === "security-mismatch") passwordError = "两次输入的新密码不一致。";
    if (name === "security-password-busy") busy = "password";
    if (name === "security-revoke-busy") busy = sessions[0].id;
    if (name === "security-revoked") {
      sessions = sessions.slice(1);
      showNotice("设备会话已撤销。（隔离演示，未影响真实设备）");
    }
    if (name === "security-password-failed") showNotice("检查当前密码后重试。", true);
    if (name === "security-revoke-failed") showNotice("刷新会话列表后重试。", true);
    if (name === "security-revoked-retry-failed" || name === "security-expired-retry-failed") {
      sessions = sessions.filter(
        (item) => item.status === (name.includes("expired") ? "expired" : "revoked"),
      );
      showNotice("刷新会话列表后重试。", true);
    }
    if (name === "security-password-success") {
      password = { current_password: "", new_password: "", confirm_password: "" };
      showNotice("修改成功后返回登录页。（隔离流程演示）");
    }
    if (name === "notifications-edited") preferences.task_enabled = false;
    if (name === "notifications-mail-blocked") {
      preferences.email_enabled = true;
      showNotice(data.mailBlocked.actionHint, true);
    }
    if (name === "notifications-saving") busy = "preferences";
    if (name === "notifications-saved") {
      preferences.version = 8;
      showNotice("通知偏好已保存。（隔离演示，未真实写入）");
    }
    if (name === "notifications-save-failed")
      showNotice("隔离模拟：保存失败，未写入偏好；请刷新后核对版本。", true);
    $("scene").value = name;
    render();
  }
  $("sections").innerHTML =
    data.sections
      .map(
        (item, index) =>
          `<a href="/me?section=${item.key}" data-section="${item.key}"><span class="nav-index" aria-hidden="true">0${index + 1}</span><span>${item.label}</span></a>`,
      )
      .join("") + '<a class="appearance" href="/settings/theme">外观偏好 →</a>';
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    event.preventDefault();
    lastRoute = link.getAttribute("href");
    $("destination").textContent = `审核目标：${lastRoute}；未执行真实路由。`;
    if (
      link.dataset.section &&
      link.dataset.section !== "profile" &&
      !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button)
    ) {
      section = link.dataset.section;
      render();
    }
  });
  $("scene").innerHTML = scenes.map((name) => `<option value="${name}">${name}</option>`).join("");
  $("scene").addEventListener("change", () => showScene($("scene").value));
  $("refresh").addEventListener("click", refresh);
  window.PERSONAL_SECTIONS_REVIEW = { scenes, showScene };
  window.PERSONAL_SECTIONS_DIAGNOSTICS = () => ({
    section,
    readState,
    busy,
    preferences: clone(preferences),
    sessionIds: sessions.map((item) => item.id),
    lastIntent: clone(lastIntent),
    lastRoute,
  });
  showScene("permissions");
})();
