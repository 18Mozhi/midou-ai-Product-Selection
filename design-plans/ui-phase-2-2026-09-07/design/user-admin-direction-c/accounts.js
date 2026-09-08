(() => {
  "use strict";
  const D = window.USER_ADMIN_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const roleNames = {
    platform_operations_admin: "运营管理员",
    platform_security_admin: "安全管理员",
    platform_super_admin: "超级管理员",
    member: "普通成员",
    organization_admin: "组织管理员",
    selection_manager: "选品经理",
    procurement_member: "采购成员",
    auditor: "审计员",
  };
  const statusNames = {
    active: "正常使用",
    disabled: "已停用",
    locked: "已锁定",
    revoked: "已撤销",
    expired: "已过期",
    pending_verification: "待验证",
  };
  const roleName = (r) => roleNames[r] ?? r,
    statusName = (v) => statusNames[v] ?? v;
  const codes = D.platformRoles.map((r) => r.code),
    titles = { users: "用户管理", admins: "平台管理员管理" };
  const variants = {
    list: "账号目录",
    many: "合成多记录",
    long: "长邮箱与多组织",
    empty: "返回为空",
    filtered_empty: "筛选无结果",
    disabled: "停用账号",
    loading: "首次读取中",
    error: "首次读取失败",
    timeout: "读取超时",
    refresh_error: "刷新失败保留事实",
    filter: "手机筛选",
    columns: "列与密度",
    compact: "紧凑目录",
    preview: "记录预览",
    technical: "预览技术详情",
    detail: "详情组织关系",
    detail_loading: "详情读取中",
    detail_error: "详情读取失败",
    memberships: "加入其他组织",
    no_memberships: "没有组织关系",
    membership_error: "组织授权失败",
    roles: "平台权限",
    disabled_roles: "非活动账号权限禁用",
    security: "登录安全",
    no_sessions: "没有登录会话",
    expired_session: "已结束会话",
    password: "强制改密表单",
    password_error: "改密失败",
    password_invalid: "临时密码校验",
    create: "创建账号",
    create_org: "创建并加入组织",
    create_error: "创建失败",
    create_busy: "创建中",
    write_busy: "权限写入中",
    write_error: "权限写入失败",
    write_read_error: "写成功回读失败",
    reason_invalid: "原因校验",
    self_refusal: "服务端自保拒绝",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
  };
  const reasons = {
    disable: "停用登录并撤销会话",
    restore: "恢复登录",
    grant_operations: "授予运营管理员",
    revoke_operations: "撤销运营管理员",
    grant_security: "授予安全管理员",
    revoke_security: "撤销安全管理员",
    grant_super: "授予超级管理员",
    revoke_super: "撤销超级管理员",
    session: "撤销该会话",
    sessions: "撤销全部活动会话",
    reset_password: "强制重置密码并撤销全部会话",
  };
  const scenes = {};
  for (const mode of ["users", "admins"])
    for (const [key, title] of Object.entries({
      ...variants,
      ...Object.fromEntries(Object.entries(reasons).map(([k, v]) => ["reason_" + k, v])),
    }))
      scenes[mode + "--" + key] = titles[mode] + " / " + title;
  for (const [key, title] of Object.entries({
    comparison: "角色差异",
    compare_all: "相同角色显示全部",
    compare_search: "权限搜索",
    compare_group: "能力分组",
    compare_empty: "没有匹配能力",
    roles_error: "目录失败保留矩阵",
    roles_empty: "角色目录为空",
  }))
    scenes["admins--" + key] = "管理员 / " + title;
  let s,
    epoch = 0,
    counter = 0;
  const button = (action, title, cls = "", disabled = false, extra = "") =>
    `<button type="button" data-action="${action}" class="${cls}" ${disabled ? "disabled" : ""} ${extra}>${title}</button>`;
  const input = (id, title, value, attrs = "") =>
    `<label for="${id}">${title}<input id="${id}" value="${esc(value)}" ${attrs}></label>`;
  const option = (v, n, current, disabled = false) =>
    `<option value="${esc(v)}" ${v === current ? "selected" : ""} ${disabled ? "disabled" : ""}>${esc(n)}</option>`;
  const select = (id, title, options) =>
    `<label for="${id}">${title}<select id="${id}">${options}</select></label>`;
  const notice = (text, error = false) =>
    text
      ? `<div class="notice ${error ? "error" : ""}" role="${error ? "alert" : "status"}">${esc(text)}</div>`
      : "";
  const textarea = (id, title, value) =>
    `<label for="${id}">${title}<textarea id="${id}" required minlength="2" maxlength="300">${esc(value)}</textarea></label>`;
  const rolesOf = (r) => r?.roles ?? r?.platform_roles ?? [];
  const formatDate = (v) =>
    !v || Number.isNaN(Date.parse(v))
      ? "未返回"
      : new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  const newUser = (mode) => ({
    email: "",
    temporary_password: "",
    platform_role_code: mode === "admins" ? codes[0] : "",
    organization_id: "",
    organization_role_code: "member",
  });
  const available = () =>
    s.organizations.filter(
      (o) => o.status === "active" && !s.detail.memberships.some((m) => m.organization_id === o.id),
    );
  function setRoute(mode) {
    s.mode = mode;
    s.route = "/platform-admin/" + mode;
    const u = new URL(location.href);
    u.searchParams.set("mode", mode);
    history.replaceState({}, "", u);
  }
  function reset(key = "users--list") {
    if (!(key in scenes)) key = "users--list";
    epoch++;
    const [mode, scene] = key.split("--");
    s = {
      key,
      mode,
      scene,
      source: "原测试夹具",
      rows: clone(D.overview[mode]),
      organizations: clone(D.overview.organizations),
      roles: clone(D.platformRoles),
      query: "",
      status: "",
      appliedQuery: "",
      appliedStatus: "",
      reading: "ready",
      note: "",
      readError: false,
      modal: "",
      section: "memberships",
      detailState: "ready",
      detail: null,
      selected: null,
      user: newUser(mode),
      member: { organization_id: "", role_code: "member", reason: "" },
      password: "",
      reason: null,
      error: "",
      success: "",
      pending: null,
      writes: [],
      compact: false,
      hidden: [],
      frozen: true,
      comparisonOpen: mode === "admins",
      comparisonError: "",
      left: codes[0],
      right: codes[1],
      differences: true,
      capabilityQuery: "",
      group: "",
    };
    setRoute(mode);
    if (scene === "many") {
      s.source = "合成12条布局样例";
      s.rows = Array.from({ length: 12 }, (_, i) => ({
        ...s.rows[0],
        id: "synthetic-user-" + i,
        email: `review-${i + 1}@example.test`,
        status: i % 4 === 0 ? "disabled" : "active",
        ...(mode === "admins" ? { roles: i % 3 ? [codes[i % 3]] : [] } : {}),
      }));
    }
    if (scene === "long") {
      s.source = "合成长文本";
      s.rows[0].email =
        "crossborder-procurement-and-research-team.".repeat(4) + "review@example.test";
      if (mode === "users") s.rows[0].organization_names = "采购研究与选品协同团队、".repeat(8);
    }
    if (["empty", "filtered_empty"].includes(scene)) {
      s.rows = [];
      s.source = "合成空结果";
    }
    if (scene === "filtered_empty") s.query = s.appliedQuery = "no-match@example.test";
    if (scene === "disabled") {
      s.source = "合成停用账号";
      s.rows[0].status = "disabled";
    }
    if (["loading", "error", "timeout"].includes(scene)) s.reading = scene;
    if (scene === "refresh_error") {
      s.note = "刷新失败；下方仍为上次读取的账号事实。";
      s.readError = true;
    }
    if (scene === "filter") s.modal = "filter";
    if (scene === "compact") s.compact = true;
    if (["preview", "technical"].includes(scene)) {
      s.modal = "preview";
      s.selected = clone(s.rows[0]);
    }
    const detailScenes = [
      "detail",
      "detail_loading",
      "detail_error",
      "memberships",
      "no_memberships",
      "membership_error",
      "roles",
      "disabled_roles",
      "security",
      "no_sessions",
      "expired_session",
      "password",
      "password_error",
      "password_invalid",
      "write_busy",
      "write_error",
      "write_read_error",
      "reason_invalid",
      "self_refusal",
    ];
    if (detailScenes.includes(scene) || scene.startsWith("reason_")) {
      s.modal = "detail";
      s.selected = clone(s.rows[0]);
      s.detail = clone(mode === "users" ? D.detail : D.adminDetail);
      if (["detail_loading", "detail_error"].includes(scene)) s.detailState = scene.slice(7);
      if (scene === "detail_error") s.error = "详情暂时无法读取，请重试。（合成失败）";
      if (["memberships", "membership_error"].includes(scene)) {
        s.source = "合成可授权关系";
        s.detail.memberships = [
          { ...D.detail.memberships[0], organization_id: D.overview.organizations[0].id },
        ];
        s.organizations.push({
          id: "00000000-0000-4000-8000-000000000628",
          name: "华南采购团队（合成）",
          status: "active",
        });
      }
      if (scene === "no_memberships") s.detail.memberships = [];
      s.member.organization_id = available()[0]?.id ?? "";
      if (scene === "membership_error") {
        s.member.reason = "加入采购团队";
        s.error = "加入未完成：请先完成邮箱验证。（合成后端拒绝）";
      }
      if (
        [
          "roles",
          "disabled_roles",
          "write_busy",
          "write_error",
          "write_read_error",
          "self_refusal",
        ].includes(scene)
      )
        s.section = "roles";
      if (scene === "disabled_roles") {
        s.selected.status = s.detail.user.status = "disabled";
        s.source = "合成非活动账号";
      }
      if (
        [
          "security",
          "no_sessions",
          "expired_session",
          "password",
          "password_error",
          "password_invalid",
        ].includes(scene)
      )
        s.section = "security";
      if (scene === "no_sessions") s.detail.sessions = [];
      if (scene === "expired_session") {
        s.detail.sessions = [{ ...D.detail.sessions[0], status: "expired" }];
        s.source = "合成已结束会话";
      }
      if (scene.startsWith("password")) {
        s.modal = "password";
        s.password = scene === "password_invalid" ? "short" : "";
      }
      if (scene === "password_error")
        s.error = "改密未完成。当前账号和密码未确认更新，请核对后重试。（合成错误）";
      if (scene === "password_invalid") s.error = "临时密码需 12–128 个字符。";
      if (scene === "write_error") s.error = "授权未完成，请稍后重试。（合成错误）";
      if (scene === "write_read_error")
        s.success = "写入返回成功，但重新读取失败；下方权限仍是旧快照。（离线模拟）";
      if (scene === "self_refusal")
        s.error = "不能撤销自己的超级管理员角色。请由另一位超级管理员处理。（合成服务端拒绝）";
      if (scene.startsWith("reason_") && scene !== "reason_invalid") {
        const kind = scene.slice(7);
        if (kind === "session") {
          s.detail.sessions = clone(D.detail.sessions);
          s.source = mode === "admins" ? "合成管理员单会话" : s.source;
        }
        if (kind === "restore") {
          s.selected.status = s.detail.user.status = "disabled";
          s.source = "合成待恢复账号";
        }
        if (kind.includes("operations") || kind.includes("security") || kind.includes("super")) {
          s.section = "roles";
          const code = kind.includes("operations")
            ? codes[0]
            : kind.includes("security")
              ? codes[1]
              : codes[2];
          const otherRoles = rolesOf(s.selected).filter((r) => r !== code);
          const currentRoles = kind.startsWith("revoke_") ? [...otherRoles, code] : otherRoles;
          if (mode === "admins") s.selected.roles = currentRoles;
          else s.selected.platform_roles = currentRoles;
          s.source = "合成授予或撤销前状态";
        } else s.section = "security";
        if (kind === "reset_password") {
          s.password = "SyntheticOnly-12";
          s.modal = "password";
        }
        openReason(kind);
      }
      if (scene === "reason_invalid") {
        openReason("disable");
        s.reason.value = " ";
        s.reason.error = "填写 2–300 字的操作原因。";
      }
    }
    if (scene.startsWith("create")) {
      s.modal = "create";
      if (scene !== "create") {
        s.user.email = "review-new@example.test";
        s.user.temporary_password = "SyntheticOnly-12";
        s.user.organization_id = s.organizations[0].id;
      }
      if (scene === "create_error")
        s.error = "邮箱已存在，请使用其他邮箱或进入现有账号详情。（合成错误）";
    }
    if (["create_busy", "write_busy"].includes(scene))
      s.pending = {
        id: ++counter,
        owner: epoch,
        kind: scene === "create_busy" ? "create" : "grant_operations",
        body: {},
        userId: s.selected?.id,
        path: "/platform/accounts/users",
      };
    if (scene === "compare_all") {
      s.left = s.right = codes[0];
      s.differences = false;
    }
    if (scene === "compare_search") s.capabilityQuery = "审计";
    if (scene === "compare_group") s.group = "安全治理";
    if (scene === "compare_empty") s.capabilityQuery = "没有此权限";
    if (scene === "roles_error")
      s.comparisonError = "角色目录读取失败，保留上次成功矩阵；账号记录仍可使用。";
    if (scene === "roles_empty") s.roles = [];
    render();
    if (scene === "columns") document.getElementById("columns").open = true;
    if (scene === "technical") document.getElementById("technical").open = true;
    if (scene === "focus") document.getElementById("create-trigger").focus();
    if (scene.startsWith("compare") || scene.startsWith("roles_"))
      document.getElementById("comparison")?.scrollIntoView();
  }
  function filterForm(prefix) {
    return `<form data-form="filter" class="${prefix === "desk" ? "filters desktop-filter" : "field-stack"}">${input(prefix + "-query", "邮箱", s.query, 'maxlength="120" placeholder="输入用户邮箱"')}${select(prefix + "-status", "账号状态", option("", "全部状态", s.status) + option("active", "正常使用", s.status) + option("disabled", "已停用", s.status))}<button class="primary">搜索</button>${button("reset-filter", "重置", "", !s.query.trim() && !s.status)}</form>`;
  }
  function comparisonRows() {
    const left = new Set(s.roles.find((r) => r.code === s.left)?.capabilities ?? []),
      right = new Set(s.roles.find((r) => r.code === s.right)?.capabilities ?? []);
    return [...new Set([...left, ...right])]
      .map((code) => ({
        code,
        ...D.capabilityLabels[code],
        left: left.has(code),
        right: right.has(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"))
      .filter(
        (r) =>
          (!s.differences || r.left !== r.right) &&
          (!s.group || r.group === s.group) &&
          (!s.capabilityQuery.trim() ||
            (r.label + " " + r.code)
              .toLocaleLowerCase("zh-CN")
              .includes(s.capabilityQuery.trim().toLocaleLowerCase("zh-CN"))),
      );
  }
  function comparison() {
    if (s.mode !== "admins") return "";
    const left = s.roles.find((r) => r.code === s.left),
      right = s.roles.find((r) => r.code === s.right),
      rows = comparisonRows();
    return `<section class="embedded-comparison" id="comparison"><div class="comparison-head"><div><h2>角色权限差异</h2><p class="muted">独立角色目录，不从账号按钮推算权限。</p></div><label class="check" for="differences"><input id="differences" type="checkbox" ${s.differences ? "checked" : ""}>只看差异</label></div>${notice(s.comparisonError, true)}${
      !s.roles.length
        ? '<p class="notice">当前没有角色目录可展示。账号列表不受影响。</p>'
        : `<div class="compare-controls">${select("left", "左侧角色", s.roles.map((r) => option(r.code, r.name, s.left)).join(""))}${select("right", "右侧角色", s.roles.map((r) => option(r.code, r.name, s.right)).join(""))}${input("capabilityQuery", "搜索权限", s.capabilityQuery, 'maxlength="80" placeholder="权限名称或编码"')}${select(
            "group",
            "能力分组",
            option("", "全部分组", s.group) +
              [...new Set(Object.values(D.capabilityLabels).map((r) => r.group))]
                .sort((a, b) => a.localeCompare(b, "zh-CN"))
                .map((g) => option(g, g, s.group))
                .join(""),
          )}</div>${button("reset-comparison", "重置对比", "", !s.capabilityQuery.trim() && !s.group)}<div class="compare-description"><p><strong>${esc(left?.name)}</strong>：${esc(left?.description)}（${left?.capabilities.length ?? 0} 项）</p><p><strong>${esc(right?.name)}</strong>：${esc(right?.description)}（${right?.capabilities.length ?? 0} 项）</p></div><p class="muted" aria-live="polite">当前显示 ${rows.length} 项能力；仅影响本次对比，不更改账号授权。</p>${rows.length ? rows.map((r) => `<article class="cap-row"><strong>${esc(r.label)}<span>${esc(r.group)}</span></strong><div><span>${esc(left?.name)}</span>${r.left ? "拥有" : "无"}</div><div><span>${esc(right?.name)}</span>${r.right ? "拥有" : "无"}</div></article>`).join("") : '<p class="notice">没有符合当前条件的权限差异。</p>'}`
    }</section>`;
  }
  function list() {
    const admin = s.mode === "admins",
      headings = admin
        ? ["可授权账号", "当前平台角色", "操作"]
        : ["用户", "所在组织", "平台角色", "状态", "操作"];
    const cells = (r, i) =>
      admin
        ? [
            `<strong class="email">${esc(r.email)}</strong><small>${esc(statusName(r.status))}</small>`,
            esc(rolesOf(r).map(roleName).join("、") || "尚未授予平台角色"),
            button("detail", "账号详情", "", false, `data-index="${i}" id="detail-${i}"`),
          ]
        : [
            `<strong class="email">${esc(r.email)}</strong><small>注册于 ${formatDate(r.created_at)}</small>`,
            esc(r.organization_names || "尚未加入组织"),
            esc(rolesOf(r).map(roleName).join("、") || "普通用户"),
            `<span class="badge ${esc(r.status)}">${esc(statusName(r.status))}</span>`,
            button("detail", "账号详情", "", false, `data-index="${i}" id="detail-${i}"`),
          ];
    let result = `<div class="table-scroll ${admin ? "admin-table" : ""}"><table class="${s.compact ? "compact" : ""} ${s.frozen ? "frozen" : ""}"><thead><tr>${headings.map((h, i) => (s.hidden.includes(i) ? "" : `<th scope="col">${h}</th>`)).join("")}</tr></thead><tbody>${s.rows
      .map(
        (r, i) =>
          `<tr>${cells(r, i)
            .map((c, n) => (s.hidden.includes(n) ? "" : `<td>${c}</td>`))
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="mobile-records">${s.rows.map((r, i) => `<article class="record"><h3 class="email">${esc(r.email)}</h3><p>${esc(statusName(r.status))} · ${esc(admin ? rolesOf(r).map(roleName).join("、") || "尚未授予平台角色" : r.organization_names || "尚未加入组织")}</p>${button("preview", "预览账号记录", "", false, `data-index="${i}" id="preview-${i}"`)}</article>`).join("")}</div>`;
    if (s.reading === "loading")
      result =
        '<div role="status"><div class="skeleton"></div><div class="skeleton"></div>正在读取组织与用户…</div>';
    else if (["error", "timeout"].includes(s.reading))
      result = `<section class="empty" role="alert"><h2>${s.reading === "timeout" ? "账号读取超时" : "账号暂未加载"}</h2><p>未取得可展示的账号结果，请重新加载。</p>${button("refresh", "重新加载", "primary")}</section>`;
    else if (!s.rows.length)
      result = `<section class="empty"><h2>${s.appliedQuery || s.appliedStatus ? "没有符合条件的账号" : admin ? "还没有可授权账号" : "没有用户记录"}</h2><p>当前返回为空，不等于全平台不存在用户。</p>${s.appliedQuery || s.appliedStatus ? button("reset-filter", "清除筛选", "primary") : admin ? button("create", "新建管理员", "primary") : ""}</section>`;
    return `<header class="brand"><strong>ScoutOps</strong><span>平台管理 · C 方向审核</span></header><div class="workspace"><aside class="directory"><h2>组织与用户</h2><nav><a href="../account-overview-direction-c/index.html">账号概览</a><a href="../platform-organizations-direction-c/index.html">组织管理</a><a href="?mode=users" data-action="users" ${!admin ? 'aria-current="page"' : ""}>用户管理</a><a href="?mode=admins" data-action="admins" ${admin ? 'aria-current="page"' : ""}>管理员管理</a></nav><dl><div><dt style="color:inherit">用户总数</dt><dd>${D.overview.summary.users}</dd></div><div><dt style="color:inherit">正常使用</dt><dd>${D.overview.summary.active_users}</dd></div><div><dt style="color:inherit">平台管理员</dt><dd>${D.overview.summary.platform_admins}</dd></div></dl><p>全局摘要，与筛选返回数量分开。</p></aside><main class="paper"><header class="page-head"><div><h1>${titles[s.mode]}</h1><p class="muted">${admin ? "查找可授权账号，核对平台角色与登录访问。" : "从账号身份出发，维护组织归属与登录访问。"}</p></div><div class="actions"><a href="../platform-organizations-direction-c/index.html?scene=create">新建组织</a>${button("create", admin ? "新建管理员" : "新建用户", "primary", false, 'id="create-trigger"')}</div></header>${filterForm("desk")}<div class="mobile-filter">${button("filter", s.appliedQuery || s.appliedStatus ? "账号筛选 · 已应用" : "账号筛选")}</div>${notice(s.note, s.readError)}<div class="list-meta"><div><strong>${admin ? "可授权账号" : "用户记录"}</strong><p class="muted">本次返回 ${s.rows.length} 条 · ${s.source}</p></div><div class="actions">${button("refresh", "刷新", "", !!s.pending)}<details class="tools" id="columns"><summary>显示设置</summary><section>${headings.map((h, i) => `<label for="col-${i}"><input id="col-${i}" type="checkbox" data-col="${i}" ${s.hidden.includes(i) ? "" : "checked"}>${h}</label>`).join("")}<label for="compact"><input id="compact" type="checkbox" ${s.compact ? "checked" : ""}>紧凑行距</label><label for="frozen"><input id="frozen" type="checkbox" ${s.frozen ? "checked" : ""}>冻结首列</label></section></details></div></div>${result}<p class="footnote">最多返回 200 条，无分页接口。${admin ? "包含尚未授予平台角色的账号；全局管理员数按已授权用户去重。" : "按最近更新时间返回。组织关系与平台角色是不同权限层。"}</p>${comparison()}</main></div>`;
  }
  function openReason(kind, sessionId = null) {
    const roleCode = kind.includes("operations")
      ? codes[0]
      : kind.includes("security")
        ? codes[1]
        : codes[2];
    const body =
      kind === "disable" || kind === "restore"
        ? { status: kind === "disable" ? "disabled" : "active" }
        : kind.startsWith("grant_") || kind.startsWith("revoke_")
          ? { role_code: roleCode, enabled: kind.startsWith("grant_") }
          : kind === "reset_password"
            ? { temporary_password: s.password }
            : { session_id: kind === "session" ? (sessionId ?? s.detail.sessions[0]?.id) : null };
    s.reason = {
      kind,
      title: reasons[kind],
      value: "平台管理员人工操作",
      body,
      user: clone(s.selected),
      owner: epoch,
      error: "",
    };
  }
  function reviewResults() {
    return s.pending
      ? `<details class="field-hint"><summary>离线模拟结果（审核工具）</summary><div class="review-result"><small>仅改变此稿内存，不调用真实接口。</small>${button("success", "模拟写入返回")}${button("failure", "模拟失败")}</div></details>`
      : "";
  }
  function detailBody() {
    if (s.detailState !== "ready")
      return `<section class="form-body"><div class="dialog-top"><h2>${s.detailState === "loading" ? "正在读取账号详情…" : "账号详情暂时无法读取"}</h2>${button("close-detail", "关闭")}</div>${notice(s.error, true)}${s.detailState === "error" ? button("retry-detail", "重试", "primary") : ""}<p class="footnote">${esc(s.selected.email)} · 不展示其他账号的旧详情。</p></section>`;
    const d = s.detail,
      inactive = s.selected.status !== "active",
      busy = !!s.pending;
    let body = "";
    if (s.section === "memberships") {
      const orgs = available();
      body = `<h2>组织关系</h2><p class="muted">现有组织角色只读；本页仅添加新的组织关系。</p><dl class="account-facts"><div><dt>已返回关系</dt><dd>${d.memberships.length}</dd></div><div><dt>首次安全设置</dt><dd>${d.user.must_change_password || d.user.must_enroll_mfa ? "待完成" : "已完成"}</dd></div></dl><ul class="records">${d.memberships.map((m) => `<li><strong>${esc(m.organization_name)}</strong><p>${esc(m.roles.map(roleName).join("、"))} · ${esc(statusName(m.status))}</p></li>`).join("") || '<li class="muted">尚未加入组织。</li>'}</ul>${d.memberships.some((m) => !m.organization_id) ? '<p class="notice">此原始测试夹具缺少关系的组织 ID，候选计算无法排除该关系；不据此判断现实账号可重复加入。</p>' : ""}${orgs.length ? `<form class="join-form" data-form="membership"><h3>加入其他组织</h3>${select("member-organization", "组织", orgs.map((o) => option(o.id, o.name, s.member.organization_id)).join(""))}${select("member-role", "组织角色", D.organizationRoleCodes.map((c) => option(c, roleName(c), s.member.role_code)).join(""))}${textarea("member-reason", "授权原因", s.member.reason)}<p class="muted">只列出已返回且启用、没有既有关系的组织。后端还会校验邮箱验证状态。</p><button class="primary" ${busy || inactive ? "disabled" : ""}>加入组织</button></form>` : '<p class="notice">当前返回范围内没有可加入的其他组织。</p>'}`;
    } else if (s.section === "roles") {
      body = `<h2>平台权限</h2><p class="muted">角色来自账号列表，不是组织角色；权限目录只用于对照。</p>${inactive ? notice("账号非正常使用状态，平台角色操作不可用。") : ""}${codes
        .map((code) => {
          const enabled = rolesOf(s.selected).includes(code);
          return `<div class="role-line"><div><strong>${roleName(code)}</strong><span class="muted">${enabled ? "当前已授予" : "当前未授予"}</span></div>${button("role", (enabled ? "撤销" : "授予") + roleName(code), enabled ? "danger" : "", busy || inactive, `data-code="${code}"`)}</div>`;
        })
        .join(
          "",
        )}<p class="footnote">不能撤销自己的超级管理员角色；最终允许/拒绝由后端判断，本稿不作真实授权。</p>`;
    } else {
      const active = d.sessions.filter((r) => r.status === "active").length;
      body = `<h2>登录安全</h2><dl class="account-facts"><div><dt>账号状态</dt><dd>${esc(statusName(d.user.status))}</dd></div><div><dt>返回会话中的 active</dt><dd>${active}</dd></div></dl><p class="muted">最多返回 100 条会话。此数未检查到期时间，不能与列表活动会话数强行对齐。</p><h3>登录会话</h3><ul class="records">${d.sessions.map((r, i) => `<li><div class="row"><strong>${esc(r.device_label)}</strong>${r.status === "active" ? button("session", "撤销", "danger", busy, `data-index="${i}"`) : ""}</div><p>${esc(statusName(r.status))} · 最近活动 ${formatDate(r.last_seen_at)}</p></li>`).join("") || '<li class="muted">暂无会话。</li>'}</ul><section class="safety-stack"><div class="row"><div><strong>账号登录</strong><p>停用时撤销活动会话。</p></div>${button("status", inactive ? "恢复登录" : "停用登录", inactive ? "" : "danger", busy)}</div><div class="row"><div><strong>强制改密</strong><p>设置临时密码，撤销活动会话并要求首次改密；后端同时恢复账号为正常状态。</p></div>${button("password", "强制改密", "", busy)}</div><div class="row"><div><strong>会话访问</strong><p>单独撤销，不更改账号密码。</p></div>${button("sessions", "撤销全部会话", "danger", busy)}</div></section>`;
    }
    return `<div class="detail-layout"><aside class="identity"><h2 class="email">${esc(d.user.email)}</h2><p>${esc(statusName(d.user.status))}</p><nav aria-label="账号详情分区">${[
      ["memberships", "组织关系"],
      ["roles", "平台权限"],
      ["security", "登录安全"],
    ]
      .map(([v, n]) =>
        button(
          "section",
          n,
          "",
          false,
          `data-section="${v}" ${s.section === v ? 'aria-current="page"' : ""}`,
        ),
      )
      .join(
        "",
      )}</nav><p class="status-note">${s.source}<br>正在维护此账号，关闭不会撤销已发出的请求。</p></aside><section class="detail-body"><div class="dialog-top"><span class="muted">账号详情</span>${button("close-detail", "关闭", "", false, 'aria-label="关闭账号详情" id="detail-close"')}</div>${notice(s.error, true)}${notice(s.success)}${busy ? notice("正在提交，结果尚未确认。") : ""}${body}${reviewResults()}<footer>${button("close-detail", "返回账号列表")}</footer></section></div>`;
  }
  function dialogs() {
    if (!s.modal) return "";
    let html = "";
    if (["detail", "password"].includes(s.modal))
      html += `<dialog id="detail-modal" aria-label="${esc(s.selected.email)}">${detailBody()}</dialog>`;
    if (s.modal === "preview") {
      const r = s.selected,
        admin = s.mode === "admins";
      html += `<dialog id="preview-modal" class="narrow" aria-label="账号记录预览"><section class="form-body"><div class="dialog-top"><h2 class="email">${esc(r.email)}</h2>${button("close-preview", "关闭")}</div><dl>${!admin ? `<div><dt>所在组织</dt><dd>${esc(r.organization_names || "尚未加入组织")}</dd></div>` : ""}<div><dt>平台角色</dt><dd>${esc(rolesOf(r).map(roleName).join("、") || (admin ? "尚未授予平台角色" : "普通用户"))}</dd></div><div><dt>状态</dt><dd>${esc(statusName(r.status))}</dd></div>${!admin ? `<div><dt>活动会话</dt><dd>${r.active_session_count ?? "未返回"}</dd></div><div><dt>注册时间</dt><dd>${formatDate(r.created_at)}</dd></div>` : ""}</dl><footer>${button("preview-detail", "打开账号详情", "primary")}</footer><details id="technical"><summary>技术详情</summary><p style="overflow-wrap:anywhere">${esc(r.id)}</p></details></section></dialog>`;
    }
    if (s.modal === "filter")
      html += `<dialog id="filter-modal" class="narrow" aria-label="账号筛选"><section class="form-body"><div class="dialog-top"><h2>账号筛选</h2>${button("close-filter", "关闭")}</div>${filterForm("mobile")}</section></dialog>`;
    if (s.modal === "create") {
      const u = s.user;
      html += `<dialog id="create-modal" class="narrow" aria-label="${s.mode === "admins" ? "新建平台管理员" : "新建用户"}"><form class="form-body" data-form="create"><div class="dialog-top"><h2>${s.mode === "admins" ? "新建平台管理员" : "新建用户"}</h2>${button("close-create", "关闭")}</div><p>首次登录必须修改临时密码；平台管理员还必须绑定 MFA。</p>${notice(s.error, true)}<div class="field-stack">${input("email", "邮箱", u.email, 'required type="email" maxlength="254"')}${input("temporary_password", "临时密码", u.temporary_password, 'required type="password" minlength="12" maxlength="128" autocomplete="new-password"')}${select("platform_role_code", "平台角色", option("", "普通用户", u.platform_role_code) + codes.map((c) => option(c, roleName(c), u.platform_role_code)).join(""))}${select("organization_id", "加入组织", option("", "暂不加入组织", u.organization_id) + s.organizations.map((o) => option(o.id, o.name, u.organization_id, o.status !== "active")).join(""))}${u.organization_id ? select("organization_role_code", "组织角色", option("member", "普通成员", u.organization_role_code) + option("organization_admin", "组织管理员", u.organization_role_code)) : ""}</div>${reviewResults()}<footer>${button("close-create", "取消")}<button class="primary" ${s.pending ? "disabled" : ""}>${s.pending ? "正在创建…" : "确认创建"}</button></footer></form></dialog>`;
    }
    if (s.modal === "password")
      html += `<dialog id="password-modal" class="narrow" aria-label="强制改密"><form class="form-body" data-form="password"><div class="dialog-top"><h2>强制改密</h2>${button("close-password", "关闭")}</div><p class="email">${esc(s.selected.email)}</p><p>提交后仍需填写原因。成功会撤销活动会话，要求首次改密，并恢复账号为正常状态。</p>${notice(s.error, true)}${input("new-password", "新临时密码", s.password, 'required type="password" minlength="12" maxlength="128" autocomplete="new-password"')}${reviewResults()}<footer>${button("close-password", "取消")}<button class="primary" ${s.pending ? "disabled" : ""}>下一步：填写原因</button></footer></form></dialog>`;
    if (s.reason)
      html += `<dialog id="reason-modal" class="narrow" aria-label="${esc(s.reason.title)}"><form class="form-body" data-form="reason"><div class="dialog-top"><h2>${esc(s.reason.title)}</h2>${button("cancel-reason", "关闭")}</div><div class="reason-target"><strong class="email">${esc(s.reason.user.email)}</strong><p class="muted">本次确认仅针对上方账号。</p></div><p>原因会写入平台审计记录。关闭窗口不等于撤销后台操作。</p>${notice(s.reason.error, true)}${textarea("reason", "操作原因", s.reason.value)}<footer>${button("cancel-reason", "取消")}<button class="primary">确认执行</button></footer></form></dialog>`;
    return html;
  }
  function render(focusId) {
    const scroll = document.querySelector("#detail-modal")?.scrollTop ?? 0;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    document.getElementById("app").innerHTML =
      list() +
      `<details class="review"><summary>离线审核场景</summary>${select(
        "scene",
        "选择场景",
        Object.entries(scenes)
          .map(([v, n]) => option(v, n, s.key))
          .join(""),
      )}<p>本页只使用测试夹具/明确合成变体；写入只记录内存意图。实际路由意图：${s.route}。</p></details>` +
      dialogs();
    document.querySelectorAll("dialog").forEach((d) => {
      d.showModal();
      d.addEventListener("cancel", (e) => {
        e.preventDefault();
        perform(
          d.id === "reason-modal"
            ? "cancel-reason"
            : d.id === "password-modal"
              ? "close-password"
              : d.id === "create-modal"
                ? "close-create"
                : d.id === "preview-modal"
                  ? "close-preview"
                  : d.id === "filter-modal"
                    ? "close-filter"
                    : "close-detail",
        );
      });
    });
    if (document.getElementById("detail-modal"))
      document.getElementById("detail-modal").scrollTop = scroll;
    if (focusId) document.getElementById(focusId)?.focus();
  }
  function openDetail(item) {
    epoch++;
    s.modal = "detail";
    s.section = "memberships";
    s.selected = clone(item);
    s.detailState = "ready";
    s.error = s.success = "";
    s.reason = null;
    s.detail = clone(s.mode === "admins" ? D.adminDetail : D.detail);
    if (
      s.detail.user.id !== item.id ||
      s.detail.user.email !== item.email ||
      s.detail.user.status !== item.status
    ) {
      s.detail.user = { ...s.detail.user, id: item.id, email: item.email, status: item.status };
      s.source = "合成账号详情布局";
    }
    s.member = { organization_id: available()[0]?.id ?? "", role_code: "member", reason: "" };
    render();
  }
  function send(kind, body, userId = s.selected?.id, owner = epoch) {
    if (s.pending || owner !== epoch) return;
    const suffix =
      kind === "membership"
        ? "/memberships"
        : kind === "reset_password"
          ? "/password"
          : ["disable", "restore"].includes(kind)
            ? "/status"
            : ["session", "sessions"].includes(kind)
              ? "/sessions/revoke"
              : "/platform-role";
    const p = {
      id: ++counter,
      owner,
      userId,
      kind,
      method: "POST",
      path:
        kind === "create"
          ? "/platform/accounts/users"
          : `/platform/accounts/users/${userId}${suffix}`,
      body: clone(body),
    };
    s.pending = p;
    // Password values are never copied into the persistent review log; pending is volatile only.
    s.writes.push({
      ...p,
      body: {
        ...p.body,
        ...(p.body.temporary_password
          ? { temporary_password: "[synthetic password omitted from log]" }
          : {}),
      },
    });
    s.reason = null;
    s.error = s.success = "";
    render();
  }
  function complete(result = "success", id = s.pending?.id) {
    const p = s.pending;
    if (!p || id !== p.id) return;
    s.pending = null;
    if (p.owner !== epoch) {
      render();
      return;
    }
    if (result === "error") {
      s.error = "操作未完成，当前草稿保留。请核对后重试。（离线模拟）";
      render();
      return;
    }
    if (p.kind === "create") {
      s.user = newUser(s.mode);
      s.modal = "";
      s.note = "创建返回成功，尚待重新读取账号列表。（离线模拟）";
    } else if (p.kind === "reset_password") {
      s.password = "";
      s.modal = "detail";
      s.success = "改密请求返回成功，账号与会话仍待重读确认。（离线模拟）";
    } else s.success = "写入返回成功，当前事实尚待重新读取。（离线模拟）";
    render();
  }
  function applyFilter() {
    s.appliedQuery = s.query.trim();
    s.appliedStatus = s.status;
    s.rows = clone(D.overview[s.mode]).filter(
      (r) =>
        (!s.appliedQuery || r.email.toLowerCase().includes(s.appliedQuery.toLowerCase())) &&
        (!s.appliedStatus || r.status === s.appliedStatus),
    );
    s.reading = "ready";
    const u = new URL(location.href);
    for (const [k, v] of [
      ["query", s.appliedQuery],
      ["status", s.appliedStatus],
    ]) {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    }
    history.replaceState({}, "", u);
  }
  function perform(action, target) {
    if (action === "users" || action === "admins") {
      reset(action + "--list");
      return;
    }
    if (action === "create") {
      epoch++;
      s.user = newUser(s.mode);
      s.modal = "create";
      s.error = "";
      render();
    }
    if (action === "close-create") {
      epoch++;
      s.modal = "";
      s.user.temporary_password = "";
      s.error = "";
      render("create-trigger");
    }
    if (action === "detail") openDetail(s.rows[Number(target?.dataset.index ?? 0)]);
    if (action === "preview") {
      s.selected = clone(s.rows[Number(target?.dataset.index ?? 0)]);
      s.modal = "preview";
      render();
    }
    if (action === "preview-detail") openDetail(s.selected);
    if (action === "close-preview") {
      s.modal = "";
      render("preview-0");
    }
    if (action === "close-detail") {
      epoch++;
      s.modal = "";
      s.reason = null;
      s.password = "";
      s.detail = null;
      s.error = s.success = "";
      render(innerWidth <= 760 ? "preview-0" : "detail-0");
    }
    if (action === "section") {
      s.section = target.dataset.section;
      render("detail-close");
      document.getElementById("detail-modal").scrollTop = 0;
    }
    if (action === "retry-detail") {
      s.detailState = "ready";
      s.error = "";
      render();
    }
    if (action === "filter") {
      s.modal = "filter";
      render();
    }
    if (action === "close-filter") {
      s.modal = "";
      render();
    }
    if (action === "reset-filter") {
      s.query = s.status = "";
      applyFilter();
      render();
    }
    if (action === "refresh") {
      applyFilter();
      s.note = "模拟读取完成，仍使用本地测试夹具。";
      s.readError = false;
      render();
    }
    if (action === "role") {
      const index = codes.indexOf(target.dataset.code),
        name = ["operations", "security", "super"][index];
      openReason((rolesOf(s.selected).includes(codes[index]) ? "revoke_" : "grant_") + name);
      render();
    }
    if (action === "status") {
      openReason(s.selected.status === "active" ? "disable" : "restore");
      render();
    }
    if (action === "session") {
      openReason("session", s.detail.sessions[Number(target.dataset.index)].id);
      render();
    }
    if (action === "sessions") {
      openReason("sessions");
      render();
    }
    if (action === "password") {
      s.password = "";
      s.error = "";
      s.modal = "password";
      render();
    }
    if (action === "close-password") {
      epoch++;
      s.password = "";
      s.modal = "detail";
      s.reason = null;
      s.error = "";
      render();
    }
    if (action === "cancel-reason") {
      s.reason = null;
      render();
    }
    if (action === "success") complete();
    if (action === "failure") complete("error");
    if (action === "reset-comparison") {
      s.left = codes[0];
      s.right = codes[1];
      s.differences = true;
      s.capabilityQuery = s.group = "";
      render();
      document.getElementById("comparison").scrollIntoView();
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    e.preventDefault();
    perform(b.dataset.action, b);
  });
  document.addEventListener("input", (e) => {
    const { id, value } = e.target;
    if (id.endsWith("-query")) s.query = value;
    if (id in s.user) s.user[id] = value;
    if (id === "member-organization") s.member.organization_id = value;
    if (id === "member-role") s.member.role_code = value;
    if (id === "member-reason") s.member.reason = value;
    if (id === "new-password") s.password = value;
    if (id === "reason" && s.reason) s.reason.value = value;
    if (id === "capabilityQuery") {
      s.capabilityQuery = value;
      const position = e.target.selectionStart;
      render("capabilityQuery");
      document.getElementById("capabilityQuery").setSelectionRange(position, position);
    }
  });
  document.addEventListener("change", (e) => {
    const { id, value } = e.target;
    if (id === "scene") return reset(value);
    if (id.endsWith("-status")) s.status = value;
    if (id === "organization_id") render("organization_id");
    if (["left", "right", "group"].includes(id)) {
      s[id] = value;
      render(id);
    }
    if (id === "differences") {
      s.differences = e.target.checked;
      render(id);
    }
    if (e.target.dataset.col != null) {
      const c = Number(e.target.dataset.col),
        max = s.mode === "admins" ? 3 : 5;
      if (e.target.checked) s.hidden = s.hidden.filter((v) => v !== c);
      else if (s.hidden.length < max - 1) s.hidden.push(c);
      render();
      document.getElementById("columns").open = true;
      document.getElementById(id).focus();
    }
    if (["compact", "frozen"].includes(id)) {
      s[id] = e.target.checked;
      render();
      document.getElementById("columns").open = true;
      document.getElementById(id).focus();
    }
  });
  document.addEventListener("submit", (e) => {
    const type = e.target.dataset.form;
    if (!type) return;
    e.preventDefault();
    if (type === "filter") {
      applyFilter();
      s.modal = "";
      render();
    }
    if (type === "create")
      send("create", {
        ...s.user,
        platform_role_code: s.user.platform_role_code || null,
        organization_id: s.user.organization_id || null,
      });
    if (type === "membership") {
      if (s.member.reason.trim().length < 2) {
        s.error = "填写 2–300 字的授权原因。";
        render("member-reason");
      } else send("membership", clone(s.member));
    }
    if (type === "password") {
      openReason("reset_password");
      render();
    }
    if (type === "reason") {
      const r = s.reason,
        reason = r.value.trim();
      if (reason.length < 2 || reason.length > 300) {
        r.error = "填写 2–300 字的操作原因。";
        render("reason");
      } else send(r.kind, { ...r.body, reason }, r.user.id, r.owner);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
    if (!modal) return;
    const nodes = [
      ...modal.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
      ),
    ].filter((n) => n.getClientRects().length);
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
      e.preventDefault();
      nodes[0]?.focus();
    }
  });
  window.USER_ADMIN_C = {
    scenes,
    reasons,
    scene: reset,
    state: () => clone(s),
    comparison: comparisonRows,
    complete,
    invalidate: () => {
      epoch++;
    },
    changeTargetForTest: () => {
      s.selected = { id: "synthetic-other", email: "other@example.test" };
      s.password = "SyntheticChanged-12";
    },
  };
  const params = new URLSearchParams(location.search);
  reset(params.get("scene") || (params.get("mode") === "admins" ? "admins--list" : "users--list"));
})();
