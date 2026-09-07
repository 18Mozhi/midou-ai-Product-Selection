/* Isolated design study: synthetic values only, no requests, storage or real mutations. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const organizations = [
    { id: "org-a", name: "山海选品研究室" },
    { id: "org-b", name: "青禾供应链" },
    { id: "org-c", name: "远帆跨境" },
  ];
  const roleNames = {
    platform_operations_admin: "运营管理员",
    platform_security_admin: "安全管理员",
    platform_super_admin: "超级管理员",
  };
  const statuses = { active: "正常使用", disabled: "已停用", pending_verification: "待验证" };
  const users = [
    ["lin.chen", "org-a", "active", ""],
    ["yu.zhou", "org-b", "active", "platform_operations_admin"],
    ["jia.xu", "org-a", "active", ""],
    ["ning.wang", "org-c", "active", "platform_security_admin"],
    ["qi.luo", "org-b", "disabled", ""],
    ["yan.li", "org-c", "active", ""],
    ["mo.shen", "", "pending_verification", ""],
    ["an.zhao", "org-a", "active", ""],
  ].map(([name, org, status, role], index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    email: `${name}@example.test`,
    organization_id: org,
    organization_names: organizations.find((item) => item.id === org)?.name ?? "尚未加入组织",
    platform_roles: role ? [role] : [],
    status,
    created_at: `2026-08-${String(index + 11).padStart(2, "0")}`,
  }));
  let selected = users[0];
  let filtered = users;
  const triggers = new WeakMap();
  const dialogs = [...document.querySelectorAll("dialog")];
  function show(dialog, focusId) {
    if (dialog.open) return;
    triggers.set(dialog, document.activeElement);
    dialog.showModal();
    if (focusId) $(focusId).focus();
  }
  function close(dialog) {
    if (!dialog.open) return;
    dialog.close();
    const trigger = triggers.get(dialog);
    if (trigger?.isConnected && !trigger.disabled) trigger.focus();
  }
  dialogs.forEach((dialog) =>
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(dialog);
    }),
  );
  dialogs.forEach((dialog) =>
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const targets = [
        ...dialog.querySelectorAll("button,input,select,textarea,summary,a[href]"),
      ].filter((element) => !element.disabled && element.checkVisibility());
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }),
  );
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => close($(button.dataset.close)));
  });
  function notice(text, inDetail = false) {
    const element = $(inDetail ? "detail-notice" : "notice");
    element.textContent = text;
    element.hidden = false;
  }
  function renderRows() {
    $("records").replaceChildren();
    for (const user of filtered) {
      const row = document.createElement("tr");
      row.innerHTML = `<td><div class="person"><span class="avatar" data-tone="${users.indexOf(user) % 3}" aria-hidden="true">${user.email.slice(0, 2).toUpperCase()}</span><div><strong>${user.email}</strong><small>注册于 ${user.created_at.replaceAll("-", "/")}</small></div></div></td><td>${user.organization_names}</td><td>${user.platform_roles.map((role) => roleNames[role]).join("、") || "普通用户"}</td><td><span class="badge" data-status="${user.status}">${statuses[user.status]}</span></td><td><button class="row-open" aria-label="查看 ${user.email} 的账号详情">详情 <span aria-hidden="true">↗</span></button></td>`;
      row.querySelector("button").addEventListener("click", () => openDetail(user));
      $("records").append(row);
    }
    $("empty").hidden = filtered.length > 0;
    $("result-count").textContent = `显示 ${filtered.length} 条用户记录`;
    $("filter-reset").disabled = !$("query").value.trim() && !$("status").value;
  }
  function filter() {
    const query = $("query").value.trim().toLowerCase();
    filtered = users.filter(
      (user) =>
        user.email.includes(query) && (!$("status").value || user.status === $("status").value),
    );
    renderRows();
  }
  function reset() {
    $("filter-form").reset();
    filter();
  }
  $("filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    filter();
  });
  $("query").addEventListener("input", () => {
    $("filter-reset").disabled = !$("query").value.trim() && !$("status").value;
  });
  $("status").addEventListener("change", () => {
    $("filter-reset").disabled = !$("query").value.trim() && !$("status").value;
  });
  $("filter-reset").addEventListener("click", reset);
  $("empty-reset").addEventListener("click", () => {
    reset();
    $("query").focus();
  });
  $("refresh").addEventListener("click", () => {
    filter();
    notice("演示刷新完成：仍显示本地合成记录，未读取服务器。");
  });
  function openDetail(user) {
    selected = user;
    $("detail-email").textContent = user.email;
    $("detail-avatar").textContent = user.email.slice(0, 2).toUpperCase();
    $("detail-status").textContent = statuses[user.status];
    $("detail-status").dataset.status = user.status;
    $("detail-date").textContent = user.created_at.replaceAll("-", "/");
    $("detail-id").textContent = user.id;
    $("detail-security").textContent = user.status === "pending_verification" ? "待完成" : "已完成";
    $("detail-notice").hidden = true;
    $("memberships").innerHTML = user.organization_id
      ? `<li><div><b>${user.organization_names}</b><small>普通成员 · 正常使用</small></div><span class="meta">组织角色</span></li>`
      : "<li>尚未加入组织。</li>";
    $("detail-role").textContent =
      user.platform_roles.map((role) => roleNames[role]).join("、") ||
      "普通用户，没有平台后台权限。";
    $("role-actions").replaceChildren();
    for (const [role, label] of Object.entries(roleNames)) {
      const button = document.createElement("button");
      button.textContent = `${user.platform_roles.includes(role) ? "撤销" : "授予"}${label}`;
      button.disabled = user.status !== "active";
      button.addEventListener("click", () =>
        openReason(button.textContent, "只调整此账号的平台角色，不改变组织角色。"),
      );
      $("role-actions").append(button);
    }
    $("role-disabled").hidden = user.status === "active";
    $("membership-open").disabled = user.status !== "active";
    $("membership-open").title = user.status !== "active" ? "账号须为正常使用状态" : "加入其他组织";
    const hasSession = user.status === "active";
    $("session-count").textContent = hasSession ? "1 个活动会话 · 演示" : "0 个活动会话 · 演示";
    $("sessions").innerHTML = hasSession
      ? '<li><div><b>桌面浏览器</b><small>正常使用 · 2026/09/08 09:30</small></div><button id="single-session">撤销会话</button></li>'
      : "<li>暂无会话。</li>";
    $("single-session")?.addEventListener("click", () =>
      openReason("撤销该会话", "仅撤销选中的登录会话。"),
    );
    $("toggle-user").textContent = user.status === "active" ? "停用登录" : "恢复登录";
    show($("detail-dialog"));
    [...$("detail-dialog").querySelectorAll("[data-close]")]
      .find((button) => button.checkVisibility())
      .focus();
    $("detail-dialog").scrollTop = 0;
  }
  function openCreate() {
    $("create-form").reset();
    $("create-error").hidden = true;
    $("create-email").removeAttribute("aria-invalid");
    $("create-org-role-label").hidden = true;
    show($("create-dialog"), "create-email");
  }
  $("create-open").addEventListener("click", openCreate);
  $("create-organization").addEventListener("change", () => {
    $("create-org-role-label").hidden = !$("create-organization").value;
  });
  $("create-email").addEventListener("input", () => {
    $("create-error").hidden = true;
    $("create-email").removeAttribute("aria-invalid");
  });
  $("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (users.some((user) => user.email === $("create-email").value.trim().toLowerCase())) {
      $("create-error").hidden = false;
      $("create-email").setAttribute("aria-invalid", "true");
      $("create-email").focus();
      return;
    }
    close($("create-dialog"));
    $("create-form").reset();
    notice("演示完成：没有创建账号、发送邮件或保存密码。实际请求须由现有 API 执行。");
  });
  function openReason(title, impact) {
    $("reason-title").textContent = title;
    $("reason-target").textContent = `操作对象：${selected.email}`;
    $("reason-impact").textContent = impact;
    $("reason").value = "平台管理员人工操作";
    $("reason").setCustomValidity("");
    show($("reason-dialog"), "reason");
  }
  $("toggle-user").addEventListener("click", () =>
    openReason(
      selected.status === "active" ? "停用用户并撤销会话" : "恢复用户",
      selected.status === "active"
        ? "该账号将无法登录，全部活动会话将被撤销。"
        : "恢复此账号的登录状态；原有权限仍由服务端判定。",
    ),
  );
  $("sessions-revoke").addEventListener("click", () =>
    openReason("撤销全部活动会话", "此账号当前活动会话将被撤销，需要重新登录。"),
  );
  $("password-open").addEventListener("click", () => {
    $("password-form").reset();
    show($("password-dialog"), "new-password");
  });
  $("password-form").addEventListener("submit", (event) => {
    event.preventDefault();
    openReason(
      "强制重置密码并撤销全部会话",
      "替换临时密码并撤销全部活动会话；首次登录必须修改密码。",
    );
  });
  $("reason-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("reason").value.trim().length < 2) {
      $("reason").setCustomValidity("填写至少 2 个非空白字符的操作原因。");
      $("reason").reportValidity();
      return;
    }
    close($("reason-dialog"));
    if ($("password-dialog").open) {
      close($("password-dialog"));
      $("password-form").reset();
    }
    notice("演示结束：没有修改账号、角色或会话。正式操作仍需服务端鉴权、幂等与审计。", true);
  });
  $("reason").addEventListener("input", () => $("reason").setCustomValidity(""));
  $("membership-open").addEventListener("click", () => {
    $("membership-form").reset();
    $("membership-org").replaceChildren(
      ...organizations
        .filter((org) => org.id !== selected.organization_id)
        .map((org) => new Option(org.name, org.id)),
    );
    show($("membership-dialog"), "membership-org");
  });
  $("membership-form").addEventListener("submit", (event) => {
    event.preventDefault();
    close($("membership-dialog"));
    notice("演示结束：没有新增组织关系或权限。", true);
  });
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener(
      "invalid",
      (event) => event.target.setAttribute("aria-invalid", "true"),
      true,
    );
    form.addEventListener("input", (event) => {
      if (event.target.validity?.valid) event.target.removeAttribute("aria-invalid");
    });
  });
  $("scene").addEventListener("change", () => {
    [...dialogs].reverse().forEach(close);
    reset();
    $("notice").hidden = true;
    const scene = $("scene").value;
    if (scene === "empty") {
      $("query").value = "nobody";
      filter();
    }
    if (["detail", "reason", "password", "membership"].includes(scene)) openDetail(users[0]);
    if (scene === "reason") $("toggle-user").click();
    if (scene === "password") $("password-open").click();
    if (scene === "membership") $("membership-open").click();
    if (scene === "create" || scene === "create-error") {
      openCreate();
      if (scene === "create-error") {
        $("create-email").value = users[0].email;
        $("create-password").value = "Study-only-12345";
        $("create-form").requestSubmit();
      }
    }
  });
  renderRows();
})();
