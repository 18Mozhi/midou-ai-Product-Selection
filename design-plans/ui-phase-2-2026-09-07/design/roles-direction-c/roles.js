(() => {
  const $ = (id) => document.getElementById(id),
    data = window.SCOUTOPS_ROLE_DESIGN;
  const actions = {
    task: ["task:read", "task:update"],
    opportunity: ["opportunity:read", "opportunity:decide"],
    competitor: ["competitor:read"],
    sourcing: ["sourcing:read", "supplier_quote:manage", "cost:confirm"],
  };
  const labels = {
    "organization:manage": "管理组织",
    "membership:manage": "管理成员",
    "audit:read": "查看审计",
    "task:read": "查看任务",
    "task:update": "更新任务",
    "opportunity:read": "查看选品",
    "opportunity:decide": "提交选品决定",
    "competitor:read": "查看竞品",
    "sourcing:read": "查看供应链",
    "supplier_quote:manage": "维护供应商报价",
    "cost:confirm": "确认成本",
  };
  const roleNames = {
    organization_admin: "组织管理员",
    procurement_member: "采购成员",
    member: "普通成员",
    auditor: "审计员",
  };
  const scopes = [
    ["own", "本人范围", "只允许处理本人拥有、负责或被分配的记录。"],
    ["team", "团队范围", "只允许访问明确加入团队且属于该团队的业务记录。"],
    ["workspace", "工作区范围", "只允许访问明确授权工作区内的记录。"],
    ["organization", "组织范围", "可访问当前组织内满足能力要求的记录，不包含平台全局数据。"],
  ];
  const scopeName = (code) => scopes.find(([value]) => value === code)?.[1] ?? code;
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s],
    );
  const includes = (value, query) => value.toLowerCase().includes(query.trim().toLowerCase());
  const group = (code) => (code.startsWith("audit:") ? "安全审计" : "组织治理");
  const clock = Date.parse(data.reviewNow);
  const localTime = (value) => new Date(value + 8 * 3600000).toISOString().slice(0, 16);
  const scenes = {
    roles: "角色目录与矩阵",
    "role-auditor": "审计员详情",
    "role-technical": "技术能力展开",
    "role-query-empty": "角色搜索无结果",
    "roles-empty": "角色目录为空",
    "matrix-empty": "能力筛选无结果",
    scopes: "成员数据范围",
    "scopes-empty": "成员筛选无结果",
    grants: "指定资源授权",
    "grant-technical": "授权技术标识",
    "grants-filter-empty": "授权状态无结果",
    "grants-search-empty": "当前页搜索无结果",
    "grants-none": "无指定资源授权",
    "roles-no-grants": "无授权但仍有角色",
    "grants-readonly": "只读授权详情",
    "create-task": "创建任务授权",
    "create-opportunity": "创建机会授权",
    "create-competitor": "创建竞品授权",
    "create-sourcing": "创建供应链授权",
    "create-invalid-expiry": "创建期限错误",
    "create-busy": "创建中（模拟）",
    "extend-busy": "延期保存中（模拟）",
    revoke: "撤销原因弹窗",
    "revoke-invalid": "撤销原因不足",
  };
  for (const [value, label] of Object.entries(scenes)) $("scene").add(new Option(label, value));
  for (const [value, label] of scopes) $("scope-filter").add(new Option(label, value));
  $("workspace").add(new Option(data.workspace.name, data.workspace.id));
  for (const id of data.grantTargets) {
    const member = data.members.find((item) => item.id === id);
    $("member-target").add(new Option(`${member.display_name} · ${member.email}`, id));
  }
  for (const id of ["expires-at", "extend-expiry"]) {
    $(id).min = localTime(clock + 60000);
    $(id).max = localTime(clock + 30 * 86400000);
    $(id).value = localTime(clock + 7 * 86400000);
  }
  let roles = data.roles,
    busy = false,
    hasGrant = true,
    canManage = true,
    selectedRole = "organization_admin",
    grantStatus = "all",
    opener;
  function renderRoles() {
    const filtered = roles.filter((role) =>
      includes(
        `${role.name} ${role.description} ${role.capabilities.map((code) => labels[code]).join(" ")}`,
        $("role-query").value,
      ),
    );
    const selected = filtered.find((role) => role.code === selectedRole) ?? filtered[0];
    $("role-count").textContent = `${filtered.length} / ${roles.length} 个角色`;
    $("role-list").innerHTML =
      filtered
        .map(
          (role) =>
            `<button type="button" data-role="${role.code}" aria-pressed="${selected?.code === role.code}"><strong>${role.name}</strong><small>${role.description}</small><small>${role.capabilities.length} 项能力</small></button>`,
        )
        .join("") ||
      `<p class="empty-note">${roles.length ? "没有匹配的角色或能力。" : "暂无活动角色；目录未初始化。"}</p>`;
    $("role-detail").hidden = !selected;
    if (selected)
      $("role-detail").innerHTML =
        `<p class="eyebrow">固定角色模板 · 只读</p><h3>${selected.name}</h3><p>${selected.description}</p><div class="capability-pills">${selected.capabilities.map((code) => `<span>${labels[code]}</span>`).join("")}</div><details id="role-technical"><summary>查看技术能力名称</summary>${selected.capabilities.map((code) => `<code>${esc(code)}</code>`).join("")}</details><p class="help">角色分配在“成员与邀请”页完成；此处不创建自定义角色或绕过后端策略。</p>`;
    $("matrix-section").hidden = !roles.length;
    const capabilities = [...new Set(roles.flatMap((role) => role.capabilities))].filter(
      (code) =>
        (!$("capability-group").value || group(code) === $("capability-group").value) &&
        includes(`${labels[code]} ${code}`, $("capability-query").value),
    );
    $("matrix").innerHTML =
      `<thead><tr><th scope="col">业务能力</th>${roles.map((role) => `<th scope="col">${role.name}</th>`).join("")}</tr></thead><tbody>${capabilities.map((code) => `<tr><td><strong>${labels[code]}</strong><small class="help"> · ${group(code)}</small></td>${roles.map((role) => `<td>${role.capabilities.includes(code) ? "具备" : "未授予"}</td>`).join("")}</tr>`).join("")}</tbody>`;
    $("matrix-empty").hidden = Boolean(capabilities.length);
    $("reset-capabilities").disabled = !$("capability-query").value && !$("capability-group").value;
  }
  function renderScopes() {
    $("scope-definitions").innerHTML = scopes
      .map(
        ([code, title, description]) =>
          `<article><h3>${title}</h3><b>${data.members.filter((member) => member.scopes.includes(code)).length} 名成员</b><small>${description}</small></article>`,
      )
      .join("");
    const members = data.members.filter(
      (member) =>
        (!$("scope-filter").value || member.scopes.includes($("scope-filter").value)) &&
        includes(
          `${member.display_name} ${member.email} ${member.teams.join(" ")}`,
          $("member-query").value,
        ),
    );
    $("member-count").textContent = `${members.length} / ${data.members.length} 名成员`;
    $("member-list").innerHTML =
      members
        .map(
          (member) =>
            `<article class="member-row"><div><strong>${member.display_name}</strong><small>${member.email}</small></div><div><p>${member.roles.map((code) => roleNames[code]).join("、")}</p><p>${member.scopes.map(scopeName).join("、")}</p><small>${member.teams.join("、") || "未加入团队"}</small></div></article>`,
        )
        .join("") || '<p class="empty-note">当前筛选没有成员。</p>';
    $("reset-scopes").disabled = !$("member-query").value && !$("scope-filter").value;
  }
  function renderActions() {
    $("grant-actions").innerHTML = actions[$("resource-type").value]
      .map(
        (code, index) =>
          `<label><input type="checkbox" name="actions" value="${code}" ${index === 0 ? "checked" : ""} />${labels[code]}</label>`,
      )
      .join("");
    $("create-submit").disabled = busy;
    $("create-submit").textContent = busy ? "正在创建…" : "创建并写入审计";
  }
  function toggleCreate(force) {
    if (!canManage) return;
    $("create-form").hidden = force === undefined ? !$("create-form").hidden : !force;
    $("toggle-create").textContent = $("create-form").hidden ? "创建授权" : "取消创建";
  }
  function renderGrants() {
    $("extend-submit").disabled = busy;
    $("extend-submit").textContent = busy ? "正在保存…" : "延长授权";
    $("revoke").disabled = busy;
    $("toggle-create").hidden = !canManage;
    if (!canManage) $("create-form").hidden = true;
    $("extend-form").hidden = !canManage;
    $("grant-statuses").innerHTML = [
      ["all", `全部 ${Number(hasGrant)}`],
      ["active", `生效中 ${Number(hasGrant)}`],
      ["expired", "已到期 0"],
      ["revoked", "已撤销 0"],
    ]
      .map(
        ([value, label]) =>
          `<button type="button" data-status="${value}" aria-pressed="${grantStatus === value}">${label}</button>`,
      )
      .join("");
    $("grant-statuses")
      .querySelectorAll("button")
      .forEach((button) => {
        button.disabled = busy;
      });
    const hasStatus = hasGrant && ["all", "active"].includes(grantStatus);
    const grant = data.grant;
    const hasMatch =
      hasStatus &&
      includes(
        `陈采购 buyer@example.test ${data.workspace.name} 机会 ${grant.actions.map((code) => labels[code]).join(" ")}`,
        $("grant-query").value,
      );
    $("grant-detail").hidden = !hasMatch;
    $("pagination").hidden = !hasStatus;
    $("grant-list").innerHTML = hasMatch
      ? `<button class="grant-pick" type="button" id="select-grant" aria-pressed="true"><small>生效中 · 历史样本</small><strong>机会 · 陈采购</strong><small>${data.workspace.name} · 到期2026-09-01 18:00</small></button>`
      : `<div class="empty-note"><h3>${!hasGrant ? "暂无指定资源授权" : !hasStatus ? "当前状态没有资源授权" : "当前筛选没有资源授权"}</h3><p>${!hasGrant ? "RBAC与数据范围继续生效，不代表没有角色权限。" : !hasStatus ? "组织内仍有其他状态授权，可以返回全部查看。" : "这里只搜索当前页，不代表全组织没有匹配授权。"}</p>${!hasGrant && canManage ? '<button type="button" id="first-grant">创建首条授权</button>' : !hasStatus && hasGrant ? '<button type="button" id="all-grants">查看全部授权</button>' : ""}</div>`;
    if ($("first-grant")) $("first-grant").onclick = () => toggleCreate(true);
    if ($("all-grants"))
      $("all-grants").onclick = () => {
        grantStatus = "all";
        renderGrants();
      };
    $("grant-facts").innerHTML = [
      ["工作区", data.workspace.name],
      ["授权原因", grant.reason],
      ["有效期", "2026-09-01 18:00 · 北京时间"],
      ["版本", `第${grant.version}版`],
    ]
      .map(([key, value]) => `<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`)
      .join("");
    $("granted-actions").innerHTML = grant.actions
      .map((code) => `<span>${labels[code]}</span>`)
      .join("");
    $("resource-code").textContent = `资源 ${grant.resource_id}`;
    $("grant-code").textContent = `授权 ${grant.id}`;
  }
  function section(value) {
    for (const name of ["roles", "scopes", "grants"]) $(`${name}-view`).hidden = name !== value;
    document
      .querySelectorAll("[data-section]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.section === value)),
      );
    $("page-title").textContent = {
      roles: "角色模板与能力",
      scopes: "数据范围",
      grants: "指定资源授权",
    }[value];
    $("eyebrow").textContent = {
      roles: "FIXED ROLE CATALOG",
      scopes: "DATA SCOPES",
      grants: "RESOURCE EXCEPTIONS",
    }[value];
    renderRoles();
    renderScopes();
    renderGrants();
  }
  function validExpiry(value) {
    const remaining = Date.parse(value + "+08:00") - clock;
    return Number.isFinite(remaining) && remaining > 0 && remaining <= 30 * 86400000;
  }
  function finish(label) {
    $("review-note").textContent =
      `${label}输入演示已核对；未请求API、未写审计、不改变任何角色或授权。`;
  }
  $("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("create-submit").disabled) return;
    const error = !$("create-reason").value.trim()
      ? "请填写业务原因。"
      : !validExpiry($("expires-at").value)
        ? "授权到期时间必须晚于校验时钟，且不得超过30天。"
        : "";
    $("create-error").textContent = error;
    $("create-error").hidden = !error;
    if (!error) finish("创建授权");
  });
  $("extend-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("extend-submit").disabled) return;
    const error = !$("extend-reason").value.trim()
      ? "请填写变更原因。"
      : !validExpiry($("extend-expiry").value)
        ? "授权到期时间必须晚于校验时钟，且不得超过30天。"
        : "";
    $("extend-error").textContent = error;
    $("extend-error").hidden = !error;
    if (!error) finish("延长授权");
  });
  function openRevoke(trigger) {
    if (!canManage) return;
    opener = trigger;
    $("revoke-reason").value = "撤销指定资源授权";
    $("confirm-revoke").disabled = false;
    $("revoke-dialog").showModal();
    $("revoke-reason").focus({ preventScroll: true });
  }
  function closeRevoke() {
    $("revoke-dialog").close();
    opener?.focus({ preventScroll: true });
  }
  $("revoke").onclick = (event) => openRevoke(event.currentTarget);
  $("close-revoke").onclick = closeRevoke;
  $("cancel-revoke").onclick = closeRevoke;
  $("revoke-dialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRevoke();
  });
  $("revoke-reason").oninput = () => {
    $("confirm-revoke").disabled = $("revoke-reason").value.trim().length < 2;
  };
  $("revoke-form").onsubmit = (event) => {
    event.preventDefault();
    if ($("revoke-reason").value.trim().length < 2) return;
    closeRevoke();
    finish("撤销原因");
  };
  $("revoke-dialog").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...$("revoke-dialog").querySelectorAll("button,textarea")].filter(
      (node) => !node.disabled,
    );
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      event.preventDefault();
      controls[0].focus();
    }
  });
  $("sections").onclick = (event) => {
    const button = event.target.closest("button[data-section]");
    if (button) section(button.dataset.section);
  };
  $("role-list").onclick = (event) => {
    const button = event.target.closest("button[data-role]");
    if (button) {
      selectedRole = button.dataset.role;
      renderRoles();
      document.querySelector(`[data-role="${selectedRole}"]`).focus({ preventScroll: true });
    }
  };
  for (const id of ["role-query", "capability-query"]) $(id).oninput = renderRoles;
  $("capability-group").onchange = renderRoles;
  $("reset-capabilities").onclick = () => {
    $("capability-query").value = "";
    $("capability-group").value = "";
    renderRoles();
  };
  $("member-query").oninput = renderScopes;
  $("scope-filter").onchange = renderScopes;
  $("reset-scopes").onclick = () => {
    $("member-query").value = "";
    $("scope-filter").value = "";
    renderScopes();
  };
  $("grant-query").oninput = renderGrants;
  $("grant-statuses").onclick = (event) => {
    const button = event.target.closest("button[data-status]");
    if (button) {
      grantStatus = button.dataset.status;
      renderGrants();
      document.querySelector(`[data-status="${grantStatus}"]`).focus({ preventScroll: true });
    }
  };
  $("toggle-create").onclick = () => toggleCreate();
  $("resource-type").onchange = renderActions;
  $("grant-actions").onchange = () => {
    $("create-submit").disabled = busy || !$("grant-actions").querySelector(":checked");
  };
  $("scene").onchange = () => {
    if ($("revoke-dialog").open) closeRevoke();
    const scene = $("scene").value;
    busy = ["create-busy", "extend-busy"].includes(scene);
    roles = scene === "roles-empty" ? [] : data.roles;
    hasGrant = !["grants-none", "roles-no-grants"].includes(scene);
    canManage = scene !== "grants-readonly";
    selectedRole = scene === "role-auditor" ? "auditor" : "organization_admin";
    grantStatus = scene === "grants-filter-empty" ? "revoked" : "all";
    for (const id of [
      "role-query",
      "capability-query",
      "capability-group",
      "member-query",
      "scope-filter",
      "grant-query",
    ])
      $(id).value = "";
    $("create-form").reset();
    $("extend-form").reset();
    $("create-form").hidden = true;
    $("toggle-create").textContent = "创建授权";
    for (const id of ["expires-at", "extend-expiry"]) $(id).value = localTime(clock + 7 * 86400000);
    $("create-error").hidden = true;
    $("extend-error").hidden = true;
    $("extend-submit").disabled = false;
    $("extend-submit").textContent = "延长授权";
    $("revoke").disabled = false;
    $("create-submit").textContent = "创建并写入审计";
    $("grant-technical").open = false;
    if (scene === "role-query-empty") $("role-query").value = "不存在";
    if (scene === "matrix-empty") $("capability-query").value = "不存在";
    if (scene === "scopes-empty") $("member-query").value = "不存在";
    if (scene === "grants-search-empty") $("grant-query").value = "不存在";
    const target = scene.startsWith("scopes")
      ? "scopes"
      : scene.startsWith("grant") ||
          scene.startsWith("create") ||
          scene.startsWith("extend") ||
          scene.startsWith("revoke")
        ? "grants"
        : "roles";
    section(target);
    renderActions();
    if (scene === "role-technical") $("role-technical").open = true;
    if (scene === "grant-technical") $("grant-technical").open = true;
    if (scene.startsWith("create-")) {
      toggleCreate(true);
      $("resource-type").value = actions[scene.slice(7)] ? scene.slice(7) : "opportunity";
      renderActions();
      if (scene === "create-busy") {
        $("create-submit").disabled = true;
        $("create-submit").textContent = "正在创建…";
      }
      if (scene === "create-invalid-expiry") {
        $("expires-at").value = localTime(clock + 31 * 86400000);
        $("create-error").hidden = false;
        $("create-error").textContent =
          "授权到期时间必须晚于校验时钟，且不得超过30天。（设计校验示例）";
      }
    }
    if (scene === "extend-busy") {
      $("extend-submit").disabled = true;
      $("revoke").disabled = true;
      $("extend-submit").textContent = "正在保存…";
    }
    if (scene.startsWith("revoke")) {
      openRevoke($("scene"));
      if (scene === "revoke-invalid") {
        $("revoke-reason").value = "无";
        $("confirm-revoke").disabled = true;
      }
    }
  };
  renderActions();
  section("roles");
})();
