/* Offline proposal only. No API, storage, passwords in diagnostics, or production mutations. */
(() => {
  const data = window.PERSONAL_SECTIONS_DATA;
  const $ = (selector) => document.querySelector(selector);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const sectionKeys = data.sections.map((s) => s.key);
  const profileFields = [
    "username",
    "display_name",
    "avatar_url",
    "phone",
    "locale",
    "timezone",
    "reason",
  ];
  const prefLabels = {
    in_app_enabled: "站内通知",
    email_enabled: "邮件通知",
    task_enabled: "任务动态",
    approval_enabled: "审批动态",
    competitor_enabled: "竞品动态",
  };
  let state,
    sequence = 0;
  const notice = (section, text, kind = "") => {
    const node = $(`#${section}-notice`);
    node.textContent = text;
    node.className = `notice ${kind}`;
  };
  function field(name, label, attributes = "", value = "") {
    return `<label>${label}<input name="${name}" ${attributes} value="${escape(value)}" /></label>`;
  }
  function panel(key, html) {
    return `<section data-panel="${key}" aria-label="${data.sections.find((s) => s.key === key).label}"><p id="${key}-notice" class="notice" role="status" aria-live="polite"></p>${html}</section>`;
  }
  function profile() {
    return panel(
      "profile",
      `<div class="card"><div class="intro"><div class="avatar" aria-hidden="true">个</div><div><h3>${escape(data.profile.display_name)}</h3><div>${escape(data.profile.email)}</div><small>邮箱已验证 · 手机未验证 · 固定隔离样本</small></div></div>
      <form id="profile-form"><div class="fields">
      ${field("username", "用户名", 'minlength="2" maxlength="32" autocomplete="username"', data.profile.username)}
      ${field("display_name", "显示名称 *", 'required maxlength="120"', data.profile.display_name)}
      ${field("avatar_url", "头像地址", 'type="url" placeholder="https://…"')}
      ${field("phone", "手机号码", 'inputmode="tel"')}
      <label>语言<select name="locale"><option value="zh-CN">简体中文</option></select></label>
      ${field("timezone", "时区 *", "required", data.profile.timezone)}
      ${field("email", "邮箱（只读）", "disabled", data.profile.email)}
      ${field("reason", "修改原因 *", 'required maxlength="300"', "更新个人资料")}
      </div><div class="actions"><button class="primary" type="submit">保存资料</button><small>资料属于个人账号，不依赖当前组织。</small></div></form></div>`,
    );
  }
  function permissions() {
    const auth = data.sample.authorization;
    return panel(
      "permissions",
      `<div class="card"><h3>当前授权</h3><p class="muted">只读查看。角色名称不代表拥有全部权限。</p>
      <div class="row"><div>角色<div>${auth.roles.map((r) => `<span class="chip">${escape(data.labels.roleName[r])}</span>`).join("")}</div></div></div>
      <div class="row"><div>已授权操作<div>${auth.capabilities.map((c) => `<span class="chip">${escape(data.labels.capabilityName[c])}</span>`).join("")}</div></div></div>
      <div class="row"><div>数据范围<div>${auth.data_scopes.map((s) => escape(data.labels.scopeName[s.scope])).join("、")}</div></div></div>
      <a data-route href="/org-admin/tokens" id="token-link" hidden>组织令牌管理 ↗</a></div>`,
    );
  }
  function sessions() {
    return (
      state.sessions
        .map(
          (
            session,
          ) => `<div class="row"><div><strong>${escape(session.device_label)}</strong><small>${escape(data.labels.statusName[session.status])} · 固定样本状态</small>
      <small>最近活动 ${escape(session.last_seen_at)}<br />创建 ${escape(session.created_at)}<br />到期 ${escape(session.expires_at)}</small></div>
      <button type="button" class="danger" data-revoke="${session.id}">撤销会话</button></div>`,
        )
        .join("") || '<p class="muted">暂无会话记录。</p>'
    );
  }
  function security() {
    return panel(
      "security",
      `<div class="card"><div class="row"><div><h3>多因素认证</h3><p class="muted">进入安全验证页面管理，不在此推定启用状态。</p></div><a data-route href="/security/mfa">管理 MFA ↗</a></div></div>
      <div class="card"><h3>修改密码</h3><p class="muted">至少12个字符。修改成功后重新登录；演示不发送密码。</p><form id="password-form"><div class="fields">
      ${field("current_password", "当前密码 *", 'type="password" required minlength="12" autocomplete="current-password"')}
      ${field("new_password", "新密码 *", 'type="password" required minlength="12" autocomplete="new-password"')}
      ${field("confirm_password", "确认新密码 *", 'type="password" required minlength="12" autocomplete="new-password"')}
      </div><div class="actions"><button class="primary" type="submit">修改密码</button></div></form></div>
      <div class="card"><h3>登录会话</h3><p class="muted">以下为隔离记录，不代表当前设备在线。原入口仍允许对已结束会话尝试撤销。</p><div id="sessions">${sessions()}</div></div>`,
    );
  }
  function preferences() {
    return panel(
      "notifications",
      `<div class="card"><h3>接收渠道与关注动态</h3><p class="muted">渠道和事件分别设置。邮件服务尚未接入，开启邮件会被拒绝。</p><form id="preferences-form">
      ${Object.entries(prefLabels)
        .map(
          ([key, label]) =>
            `<label class="switch"><input type="checkbox" name="${key}" ${data.preferences[key] ? "checked" : ""} /><span>${label}${key === "email_enabled" ? '<small class="muted"> · 暂不可用，保存时反馈原因</small>' : ""}</span></label>`,
        )
        .join("")}
      <div class="actions"><button class="primary" type="submit">保存通知偏好</button><small>以返回版本为准，不自动重试。</small></div></form></div>`,
    );
  }
  function assets() {
    const sample = data.sample.assets;
    const groups = [
      [
        "关注的热点",
        sample.followed_trends.map((x) => [
          x.title,
          `${x.market} · ${x.created_at}`,
          `/trends?topic=${x.id}`,
        ]),
      ],
      [
        "我的决策",
        sample.decisions.map((x) => [
          x.opportunity_name,
          `${data.labels.decisionName[x.action]} · ${x.created_at}`,
          `/opportunities/${x.opportunity_id}`,
        ]),
      ],
      [
        "我的任务",
        sample.tasks.map((x) => [
          x.title,
          `${data.labels.statusName[x.status]} · ${data.labels.statusName[x.priority]} · 到期 ${x.due_at ?? "未设置"}`,
          "/tasks",
        ]),
      ],
    ];
    return panel(
      "assets",
      groups
        .map(
          ([title, rows]) =>
            `<div class="card"><h3>${title}</h3>${rows.map(([label, detail, href]) => `<div class="row"><div><strong>${escape(label)}</strong><small>${escape(detail)}</small></div><a data-route href="${escape(href)}">查看 ↗</a></div>`).join("")}</div>`,
        )
        .join(""),
    );
  }
  function select(section) {
    state.section = sectionKeys.includes(section) ? section : "profile";
    $("#title").textContent = data.sections.find((s) => s.key === state.section).label;
    document.querySelectorAll("[data-panel]").forEach((node) => {
      node.hidden = node.dataset.panel !== state.section;
    });
    document.querySelectorAll("[data-section]").forEach((node) => {
      if (node.dataset.section === state.section) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
  }
  function reset(section = "profile") {
    sequence += 1;
    state = {
      section,
      pending: null,
      intent: null,
      route: "",
      profileVersion: data.profile.version,
      preferencesVersion: data.preferences.version,
      sessions: clone(data.sample.sessions),
    };
    $("#panels").innerHTML = profile() + permissions() + security() + preferences() + assets();
    $("#route-notice").textContent = "";
    $("#refresh").disabled = false;
    $("#outcome").value = "success";
    select(section);
  }
  function begin(section, button, intent, effect, forcedError = "") {
    if (state.pending) {
      notice(section, "另一项操作仍在处理中，请等待后再提交。");
      return;
    }
    const token = ++sequence;
    state.intent = intent;
    const controls = button.closest("form") ? [...button.closest("form").elements] : [button];
    const disabled = controls.map((node) => node.disabled);
    const label = button.textContent;
    controls.forEach((node) => {
      node.disabled = true;
    });
    button.textContent = "处理中…";
    button.setAttribute("aria-busy", "true");
    $("#refresh").disabled = true;
    state.pending = { token, section, button, controls, disabled, label, effect, forcedError };
    notice(section, "正在处理，请勿重复提交。可以切换分区，结果仍归属于此处。");
    const outcome = $("#outcome").value;
    if (outcome !== "hold") setTimeout(() => finish(token, outcome), 300);
  }
  function finish(token, outcome = "success") {
    const pending = state.pending;
    if (!pending || pending.token !== token) return false;
    pending.controls.forEach((node, i) => {
      node.disabled = pending.disabled[i];
    });
    pending.button.textContent = pending.label;
    pending.button.removeAttribute("aria-busy");
    $("#refresh").disabled = false;
    state.pending = null;
    const error =
      pending.forcedError || (outcome === "error" ? "操作未成功，草稿已保留。请核对后重试。" : "");
    if (error) notice(pending.section, error, "error");
    else {
      pending.effect();
      notice(pending.section, "操作成功（隔离模拟）。", "success");
    }
    return true;
  }
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.matches("#profile-form,#password-form,#preferences-form") || !form.reportValidity())
      return;
    const button = form.querySelector("button");
    if (form.id === "profile-form") {
      const body = Object.fromEntries(profileFields.map((key) => [key, form.elements[key].value]));
      body.expected_version = state.profileVersion;
      begin("profile", button, { method: "PATCH", path: "/me/profile", body }, () => {
        state.profileVersion += 1;
      });
    } else if (form.id === "preferences-form") {
      const body = Object.fromEntries(
        Object.keys(prefLabels).map((key) => [key, form.elements[key].checked]),
      );
      body.expected_version = state.preferencesVersion;
      begin(
        "notifications",
        button,
        { method: "PUT", path: "/me/notification-preferences", body },
        () => {
          state.preferencesVersion += 1;
        },
        body.email_enabled ? data.mailBlocked.actionHint : "",
      );
    } else {
      const confirm = form.elements.confirm_password;
      const mismatch = confirm.value !== form.elements.new_password.value;
      confirm.setAttribute("aria-invalid", String(mismatch));
      if (mismatch) {
        notice("security", "两次输入的新密码不一致。", "error");
        confirm.focus();
        return;
      }
      begin(
        "security",
        button,
        { method: "POST", path: "/me/password", bodyKeys: ["current_password", "new_password"] },
        () => {
          form.reset();
          state.route = "/login";
        },
      );
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link?.dataset.section) {
      event.preventDefault();
      select(link.dataset.section);
      return;
    }
    if (link?.hasAttribute("data-route")) {
      event.preventDefault();
      state.route = link.getAttribute("href");
      $("#route-notice").textContent = `离线导航意图：${state.route}`;
      return;
    }
    const revoke = event.target.closest("[data-revoke]");
    if (revoke) {
      const session = state.sessions.find((s) => s.id === revoke.dataset.revoke);
      begin(
        "security",
        revoke,
        { method: "DELETE", path: `/me/sessions/${session.id}` },
        () => {
          state.sessions = state.sessions.filter((s) => s.id !== session.id);
          $("#sessions").innerHTML = sessions();
        },
        session.status === "active" ? "" : "刷新会话列表后重试。",
      );
    }
  });
  $("#refresh").onclick = () => {
    if (state.pending) return;
    const section = state.section;
    const intent = {
      method: "GET",
      paths: [
        "/me/profile",
        "/me/authorization",
        "/me/sessions",
        "/me/notification-preferences",
        "/me/assets",
      ],
    };
    begin(section, $("#refresh"), intent, () => {
      const active = state.section;
      reset(active);
      state.intent = intent;
    });
  };
  $("#directory").innerHTML = data.sections
    .map(
      (s) =>
        `<a href="/me?section=${s.key}" data-section="${s.key}">${s.label}<span aria-hidden="true">›</span></a>`,
    )
    .join("");
  const scenes = [
    ...sectionKeys,
    ...sectionKeys.flatMap((s) => [`${s}-loading`, `${s}-error`]),
    "profile-busy",
    "profile-refresh-busy",
    "profile-failed",
    "profile-saved",
    "permissions-token",
    "security-empty",
    "security-busy",
    "security-password-busy",
    "notifications-busy",
    "notifications-mail-blocked",
    "assets-empty",
    "controls",
  ];
  function showScene(name) {
    if (!scenes.includes(name)) throw new Error(`Unknown scene ${name}`);
    const section = name === "controls" ? "profile" : name.split("-")[0];
    reset(section);
    $("#scene").value = name;
    const node = $(`[data-panel="${section}"]`);
    if (name.endsWith("loading") || name.endsWith("error")) {
      node.querySelectorAll(".card").forEach((card) => {
        card.hidden = true;
      });
      const loading = name.endsWith("loading");
      node.insertAdjacentHTML(
        "beforeend",
        `<div class="read-state" role="status"><h3>${loading ? "正在读取" : "未能读取此分区"}</h3><p>${loading ? "数据尚未返回，不将未知内容显示为零或默认值。" : "当前信息未知。可使用上方“刷新资料”重试完整读取。"}</p></div>`,
      );
    }
    if (name.endsWith("busy")) {
      $("#outcome").value = "hold";
      if (name === "profile-refresh-busy") $("#refresh").click();
      else if (section === "profile") $("#profile-form").requestSubmit();
      if (section === "notifications") $("#preferences-form").requestSubmit();
      if (name === "security-password-busy") {
        for (const key of ["current_password", "new_password", "confirm_password"])
          $(`[name="${key}"]`).value = "Preview-only-123";
        $("#password-form").requestSubmit();
      } else if (section === "security") $("[data-revoke]").click();
    }
    if (name === "profile-failed") notice("profile", "保存失败，资料草稿已保留。请重试。", "error");
    if (name === "profile-saved") notice("profile", "资料已保存（隔离模拟）。", "success");
    if (name === "permissions-token") $("#token-link").hidden = false;
    if (name === "security-empty") $("#sessions").innerHTML = '<p class="muted">暂无会话记录。</p>';
    if (name === "notifications-mail-blocked") {
      $('[name="email_enabled"]').checked = true;
      notice("notifications", data.mailBlocked.actionHint, "error");
    }
    if (name === "assets-empty")
      node.querySelectorAll(".row").forEach((row) => {
        row.innerHTML = '<p class="muted">暂无记录。</p>';
      });
    if (name === "controls") {
      const samples = ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => {
        const disabled = ["disabled", "busy"].includes(s) ? "disabled" : "";
        return `<div><strong>${s}</strong>
          <button type="button" class="primary" data-state="${s}" ${disabled} ${s === "busy" ? 'aria-busy="true"' : ""}>${s === "busy" ? "处理中…" : "保存资料"}</button>
          <button type="button" data-state="${s}" ${disabled}>刷新资料</button>
          <button type="button" class="danger" data-state="${s}" ${disabled}>撤销会话</button></div>`;
      });
      node.innerHTML += `<div class="card"><h3>控件六态 · 视觉样本</h3>
        <p class="muted">样本不是业务动作验收。导航不适用禁用/忙碌；输入忙碌时锁定。</p>
        <div class="state-grid">${samples.join("")}</div></div>`;
    }
  }
  $("#scene").innerHTML = scenes.map((s) => `<option>${s}</option>`).join("");
  $("#scene").onchange = (event) => showScene(event.target.value);
  $("#theme").onchange = (event) => {
    document.documentElement.dataset.theme = event.target.value;
  };
  $("#density").onchange = (event) => {
    document.documentElement.dataset.density = event.target.value;
  };
  $("#finish").onclick = () => finish(state.pending?.token);
  window.PERSONAL_COMPOSED_REVIEW = { scenes, showScene, select, finish };
  window.PERSONAL_COMPOSED_DIAGNOSTICS = () => ({
    section: state.section,
    token: state.pending?.token ?? null,
    intent: clone(state.intent),
    route: state.route,
    profileVersion: state.profileVersion,
    preferencesVersion: state.preferencesVersion,
    sessionIds: state.sessions.map((s) => s.id),
  });
  reset(new URLSearchParams(location.search).get("section") || "profile");
})();
