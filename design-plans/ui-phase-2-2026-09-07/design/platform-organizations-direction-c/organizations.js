(() => {
  "use strict";
  const D = window.ORGANIZATIONS_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const base = "/platform-admin/organizations",
    path = "/platform/accounts/organizations";
  const names = {
    list: "组织列表",
    many: "合成长列表",
    long: "长名称与标识",
    zero: "零成员与工作区",
    empty: "没有组织",
    filtered_empty: "筛选无结果",
    archived: "停用筛选",
    loading: "首次读取中",
    error: "首次读取失败",
    timeout: "读取超时",
    refreshing: "保留事实刷新",
    refresh_error: "刷新失败保留事实",
    filter: "移动筛选",
    columns: "列与密度控制",
    compact: "紧凑行距",
    preview: "移动记录预览",
    preview_technical: "预览技术详情",
    create: "新建组织第一步",
    create_filled: "已填组织资料",
    create_confirm: "管理员与影响确认",
    create_admin: "指定管理员",
    create_inactive: "停用管理员不可选",
    create_invalid: "组织标识校验",
    create_error: "创建失败保留草稿",
    create_busy: "创建进行中",
    create_minimal: "创建成功但列表未刷新",
    detail: "组织详情",
    detail_archived: "已停用组织详情",
    detail_unknown: "缺失数量",
    detail_technical: "详情技术字段",
    detail_missing: "列表未含目标组织",
    detail_invalid: "保留天数校验",
    save_reason: "保存资料原因",
    disable_reason: "停用组织原因",
    restore_reason: "恢复组织原因",
    reason_invalid: "原因校验",
    update_busy: "保存进行中",
    update_error: "保存失败",
    update_success: "保存后回读成功",
    user: "新建用户",
    user_org: "用户加入组织",
    user_error: "用户创建失败",
    user_busy: "用户创建进行中",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
  };
  let s,
    epoch = 0,
    sequence = 0;
  const freshForm = () => ({ name: "", slug: "", initial_admin_user_id: "" });
  const count = (v, unit) => (v == null ? "未返回" : `${v} ${unit}`);
  const statusText = (v) => ({ active: "启用", archived: "停用" })[v] ?? v;
  const button = (action, title, cls = "", disabled = false, extra = "") =>
    `<button type="button" data-action="${action}" class="${cls}" ${disabled ? "disabled" : ""} ${extra}>${title}</button>`;
  const notice = (msg, error = false) =>
    msg
      ? `<div class="notice ${error ? "error" : ""}" role="${error ? "alert" : "status"}">${esc(msg)}</div>`
      : "";
  const input = (key, title, value, attrs = "") =>
    `<label for="${key}">${title}<input id="${key}" name="${key}" value="${esc(value)}" ${attrs}></label>`;
  const option = (value, label, selected, disabled = false) =>
    `<option value="${esc(value)}" ${value === selected ? "selected" : ""} ${disabled ? "disabled" : ""}>${esc(label)}</option>`;
  const select = (key, title, options) =>
    `<label for="${key}">${title}<select id="${key}" name="${key}">${options}</select></label>`;
  function route(to, mode = "push") {
    s.route = to;
    const url = new URL(location.href);
    url.searchParams.set("route", to);
    if (to === base) {
      url.searchParams.delete("query");
      url.searchParams.delete("status");
    }
    history[mode === "replace" ? "replaceState" : "pushState"]({}, "", url);
  }
  function reset(name = "list") {
    epoch++;
    s = {
      scene: name,
      rows: clone(D.overview.organizations),
      users: clone(D.overview.users),
      query: "",
      status: "",
      appliedQuery: "",
      appliedStatus: "",
      mode: "ready",
      note: "",
      error: false,
      modal: "",
      selected: null,
      step: 1,
      form: freshForm(),
      edit: {},
      user: {
        email: "",
        temporary_password: "",
        platform_role_code: "",
        organization_id: "",
        organization_role_code: "member",
      },
      formError: "",
      reason: null,
      pending: null,
      writes: [],
      result: "success",
      compact: false,
      frozen: true,
      hidden: [],
      synthetic: false,
    };
    route(base, "replace");
    if (name === "many") {
      s.synthetic = true;
      s.rows = Array.from({ length: 12 }, (_, i) => ({
        ...s.rows[0],
        id: `synthetic-${i}`,
        name: `审核示例组织 ${i + 1}`,
        slug: `review-${i + 1}`,
        status: i % 4 === 0 ? "archived" : "active",
      }));
    }
    if (name === "long") {
      s.synthetic = true;
      s.rows[0].name = "跨境选品与供应链协同研究团队".repeat(7);
      s.rows[0].slug = "long-".repeat(12);
    }
    if (name === "zero") {
      s.synthetic = true;
      s.rows[0].member_count = 0;
      s.rows[0].workspace_count = 0;
    }
    if (name === "empty" || name === "filtered_empty") s.rows = [];
    if (name === "filtered_empty") s.query = s.appliedQuery = "不存在的组织";
    if (name === "archived") {
      s.synthetic = true;
      s.rows[0].status = "archived";
      s.status = s.appliedStatus = "archived";
    }
    if (["loading", "error", "timeout", "refreshing"].includes(name)) s.mode = name;
    if (name === "refresh_error") {
      s.note = "刷新失败。下面仍是上次读取的组织，请重试。";
      s.error = true;
    }
    if (name === "compact") s.compact = true;
    if (name === "filter") s.modal = "filter";
    if (name.startsWith("preview")) {
      s.selected = clone(s.rows[0]);
      s.modal = "preview";
    }
    if (name.startsWith("create") && name !== "create_minimal") {
      s.modal = "create";
      route(base + "/new", "replace");
      if (name !== "create")
        s.form = { name: "南方选品团队", slug: "south-team-", initial_admin_user_id: "" };
      if (!["create", "create_filled", "create_invalid"].includes(name)) s.step = 2;
      if (name === "create_admin") s.form.initial_admin_user_id = s.users[0].id;
      if (name === "create_inactive") {
        s.synthetic = true;
        s.users[0].status = "disabled";
      }
      if (name === "create_invalid") {
        s.form.slug = "-wrong";
        s.formError = "组织标识以小写字母或数字开头，长度为 2–63 位。";
      }
      if (name === "create_error")
        s.formError = "创建未完成：组织标识已被使用。请修改后重试。（合成错误）";
    }
    if (
      name.startsWith("detail") ||
      name.startsWith("update") ||
      [
        "create_minimal",
        "save_reason",
        "disable_reason",
        "restore_reason",
        "reason_invalid",
      ].includes(name)
    ) {
      s.selected = clone(s.rows[0]);
      if (["detail_archived", "restore_reason"].includes(name)) s.selected.status = "archived";
      if (["detail_unknown", "create_minimal"].includes(name)) {
        delete s.selected.member_count;
        delete s.selected.workspace_count;
      }
      s.modal = "detail";
      s.edit = {
        name: s.selected.name,
        timezone: s.selected.timezone || "Asia/Shanghai",
        data_retention_days: Number(s.selected.data_retention_days || 365),
      };
      route(base + "/" + s.selected.id, "replace");
      if (name === "detail_missing") {
        s.selected = null;
        s.modal = "missing";
      }
      if (name === "detail_invalid") {
        s.edit.data_retention_days = 29;
        s.formError = "数据保留天数需为 30–3650 的整数。";
      }
      if (name === "update_error")
        s.formError = "保存未完成。组织资料草稿仍在，请核对后重试。（合成错误）";
      if (name === "update_success") s.note = "组织资料已更新，列表回读成功。（离线模拟）";
      if (name === "create_minimal")
        s.note = "组织创建返回成功，列表刷新失败；数量尚未返回。（离线模拟）";
      if (name.endsWith("reason") || name === "reason_invalid")
        setReason(
          name === "disable_reason" ? "disable" : name === "restore_reason" ? "restore" : "save",
        );
      if (name === "reason_invalid") {
        s.reason.value = " ";
        s.reason.error = "填写 2–300 字的操作原因。";
      }
    }
    if (name.startsWith("user")) {
      s.modal = "user";
      if (name !== "user")
        s.user = {
          email: "review@example.test",
          temporary_password: "SyntheticOnly-12",
          platform_role_code: "",
          organization_id: s.rows[0].id,
          organization_role_code: "member",
        };
      if (name === "user_error") s.formError = "创建未完成：邮箱已被使用。（合成错误）";
    }
    if (name.endsWith("busy"))
      s.pending = { id: ++sequence, owner: epoch, kind: name.split("_")[0], body: {}, path };
    render();
    if (name === "columns") document.getElementById("columns").open = true;
    if (name.endsWith("technical")) document.getElementById("technical").open = true;
    if (name === "focus") document.getElementById("new-org").focus();
  }
  function filters(prefix) {
    return `<form data-form="filter" class="${prefix === "desk" ? "filters desktop-filter" : "field-stack"}">${input(prefix + "-query", "组织名称或标识", s.query, 'maxlength="120" placeholder="搜索名称或 slug"')}${select(prefix + "-status", "组织状态", option("", "全部状态", s.status) + option("active", "启用", s.status) + option("archived", "停用", s.status))}<button class="primary">应用筛选</button>${button("reset-filter", "清空条件")}</form>`;
  }
  function table() {
    const headings = ["组织", "成员", "工作区", "状态", "操作"];
    const cells = (r, i) => [
      `<strong>${esc(r.name)}</strong><small>${esc(r.slug)}</small>`,
      count(r.member_count, "人"),
      count(r.workspace_count, "个"),
      `<span class="badge ${r.status === "archived" ? "archived" : ""}">${esc(statusText(r.status))}</span>`,
      button("detail", "查看详情", "", !!s.pending, `data-index="${i}" id="detail-${i}"`),
    ];
    return `<div class="table-scroll"><table class="${s.compact ? "compact" : ""} ${s.frozen ? "frozen" : ""}"><thead><tr>${headings.map((h, i) => (s.hidden.includes(i) ? "" : `<th scope="col">${h}</th>`)).join("")}</tr></thead><tbody>${s.rows
      .map(
        (r, i) =>
          `<tr>${cells(r, i)
            .map((c, n) => (s.hidden.includes(n) ? "" : `<td>${c}</td>`))
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="mobile-records">${s.rows.map((r, i) => `<article class="record"><h3>${esc(r.name)}</h3><p>${esc(statusText(r.status))} · ${count(r.member_count, "人")} · ${count(r.workspace_count, "个工作区")}</p>${button("preview", "预览组织记录", "", false, `data-index="${i}" id="preview-${i}"`)}</article>`).join("")}</div>`;
  }
  function list() {
    let content = table();
    if (s.mode === "loading")
      content = `<div role="status" aria-label="正在读取组织"><div class="skeleton"></div><div class="skeleton"></div><p>正在读取组织记录…</p></div>`;
    if (["error", "timeout"].includes(s.mode))
      content = `<section class="empty" role="alert"><h2>${s.mode === "timeout" ? "组织读取超时" : "组织暂未加载"}</h2><p>尚无可展示的组织记录，请重新加载。</p>${button("refresh", "重新加载", "primary")}</section>`;
    if (!s.rows.length && s.mode === "ready")
      content = `<section class="empty"><h2>${s.appliedQuery || s.appliedStatus ? "没有符合条件的组织" : "尚无组织记录"}</h2><p>${s.appliedQuery || s.appliedStatus ? "清空筛选条件后，再查看组织。" : "创建组织时，会一并建立默认工作区。"}</p>${s.appliedQuery || s.appliedStatus ? button("reset-filter", "清空条件", "primary") : button("create", "新建组织", "primary")}</section>`;
    return `<header class="brand"><strong>ScoutOps</strong><span>平台管理 · C 方向审核</span></header><div class="workspace"><aside class="directory"><h2>组织与用户</h2><nav><a href="../account-overview-direction-c/index.html">账号概览</a><a href="?scene=list" aria-current="page" data-action="list">组织管理</a><a href="../../page-specs/P43.md">用户管理（待审稿）</a><a href="../../page-specs/P44.md">管理员管理（待审稿）</a></nav><dl><div><dt style="color:inherit">全部组织</dt><dd>${D.overview.summary.organizations}</dd></div><div><dt style="color:inherit">启用组织</dt><dd>${D.overview.summary.active_organizations}</dd></div></dl><p>全局摘要，不随右侧筛选改变。</p></aside><main class="paper"><header class="page-head"><div><h1>组织管理</h1><p class="muted">查看组织，维护资料与启停状态。</p></div><div class="actions">${button("user", "新建用户")}${button("create", "新建组织", "primary", false, 'id="new-org"')}</div></header>${filters("desk")}<div class="mobile-filter">${button("filter", s.appliedQuery || s.appliedStatus ? "筛选条件 · 已应用" : "筛选组织")}</div>${notice(s.note, s.error)}${s.mode === "refreshing" ? notice("正在刷新，以下仍为上次读取的事实。") : ""}<div class="list-meta"><div><strong>组织记录</strong><p class="muted">本次返回 ${s.rows.length} 条${s.synthetic ? "（合成布局样例）" : "（原测试夹具）"}</p></div><div class="actions">${button("refresh", s.mode === "refreshing" ? "刷新中…" : "刷新", "", ["refreshing", "loading"].includes(s.mode))}<details class="tools" id="columns"><summary>显示设置</summary><section>${["组织", "成员", "工作区", "状态", "操作"].map((h, i) => `<label for="col-${i}"><input id="col-${i}" type="checkbox" data-col="${i}" ${s.hidden.includes(i) ? "" : "checked"}>${h}</label>`).join("")}<label for="compact"><input id="compact" type="checkbox" ${s.compact ? "checked" : ""}>紧凑行距</label><label for="frozen"><input id="frozen" type="checkbox" ${s.frozen ? "checked" : ""}>冻结首列</label></section></details></div></div>${content}<p class="footnote">按最近更新时间返回，最多 200 条；没有分页和排序接口。成员与工作区数量不等于当前活动数量。摘要与列表范围不同，不以本页行数替代组织总数。</p></main></div>`;
  }
  function setReason(kind) {
    s.reason = {
      kind,
      title: { save: "保存组织资料", disable: "停用组织", restore: "恢复组织" }[kind],
      value: "平台管理员人工操作",
      target: clone(s.selected),
      edit: clone(s.edit),
      error: "",
    };
  }
  function dialogs() {
    if (!s.modal) return "";
    const busy = !!s.pending,
      close = button("close", "关闭", "", false, 'aria-label="关闭当前窗口"');
    let content = "",
      narrow = false,
      label = "组织详情";
    if (s.modal === "create") {
      label = "新建组织";
      content = `<div class="dialog-layout"><aside class="identity"><h2>新建组织</h2><p>为团队建立独立的协作空间。</p><ol aria-label="创建组织步骤"><li ${s.step === 1 ? 'aria-current="step"' : ""}>1　组织资料</li><li ${s.step === 2 ? 'aria-current="step"' : ""}>2　管理员与确认</li></ol></aside><form class="form-body" data-form="create"><div class="dialog-top"><h2>${s.step === 1 ? "填写组织资料" : "核对创建内容"}</h2>${close}</div>${notice(s.formError, true)}${s.step === 1 ? `<div class="field-stack">${input("name", "组织名称", s.form.name, 'required minlength="2" maxlength="120" placeholder="例如：南方选品团队"')}${input("slug", "组织标识", s.form.slug, 'required minlength="2" maxlength="63" pattern="[a-z0-9](?:[a-z0-9]|-){1,62}" autocapitalize="none" autocomplete="off" aria-describedby="slug-help"')}<p class="muted" id="slug-help">2–63 位小写字母、数字或连字符；以字母或数字开头。</p></div>` : `${select("initial_admin_user_id", "首位组织管理员", option("", "当前超级管理员", s.form.initial_admin_user_id) + s.users.map((u) => option(u.id, u.email + (u.status !== "active" ? "（已停用）" : ""), s.form.initial_admin_user_id, u.status !== "active")).join(""))}<p class="footnote">这里只显示当前账号概览返回的用户，不是全量用户搜索。未指定时使用当前超级管理员。</p><dl><div><dt>组织名称</dt><dd>${esc(s.form.name)}</dd></div><div><dt>组织标识</dt><dd>${esc(s.form.slug)}</dd></div></dl><section class="impact"><h3>本次会同时建立</h3><p>组织、默认工作区、首位组织管理员关系及组织级数据范围。</p></section>`}<footer>${button("close", "取消")}${s.step === 2 ? button("back", "上一步", "", busy) : ""}<button class="primary" ${busy ? "disabled" : ""}>${busy ? "正在创建…" : s.step === 1 ? "下一步：选择管理员" : "确认创建"}</button></footer></form></div>`;
    } else if (s.modal === "detail") {
      const r = s.selected;
      label = r.name;
      content = `<div class="dialog-layout"><aside class="identity"><h2>${esc(r.name)}</h2><p>${esc(statusText(r.status))}</p><dl><div><dt>成员</dt><dd>${count(r.member_count, "人")}</dd></div><div><dt>工作区</dt><dd>${count(r.workspace_count, "个")}</dd></div></dl><p>数量来自最近一次返回，不限定活动状态。未返回的字段不补数。</p></aside><form data-form="detail" class="form-body"><div class="dialog-top"><h2>组织资料</h2>${close}</div>${notice(s.formError, true)}${notice(s.note)}${busy ? notice("正在提交操作；尚未确认结果。") : ""}<div class="field-stack">${input("edit-name", "组织名称", s.edit.name, 'required minlength="2" maxlength="120"')}${input("timezone", "时区", s.edit.timezone, 'required maxlength="64"')}${input("data_retention_days", "数据保留天数", s.edit.data_retention_days, 'type="number" required min="30" max="3650" step="1"')}<p class="muted">允许 30–3650 天。保存时需要填写操作原因。</p></div><details id="technical"><summary>技术详情</summary><dl><div><dt>组织标识</dt><dd>${esc(r.slug)}</dd></div><div><dt>组织 UUID</dt><dd>${esc(r.id)}</dd></div></dl></details><footer>${button("close", "返回组织列表")}<button class="primary" ${busy ? "disabled" : ""}>保存组织资料</button></footer><section class="safety"><div><h3>组织状态</h3><p>状态变更单独确认并记录原因。</p></div>${button("toggle", r.status === "active" ? "停用组织" : "恢复组织", r.status === "active" ? "danger" : "", busy)}</section></form></div>`;
    } else if (s.modal === "missing") {
      narrow = true;
      label = "当前结果未包含该组织";
      content = `<section class="form-body"><h2>${label}</h2><p class="notice">组织详情来自当前返回列表。筛选条件或最多 200 条的返回范围可能排除了它，不能据此断言已删除或无权限。</p><footer>${button("retry-detail", "重新加载", "primary")}${button("close", "返回组织列表")}</footer></section>`;
    } else if (s.modal === "preview") {
      narrow = true;
      label = "组织记录预览";
      const r = s.selected;
      content = `<section class="form-body"><div class="dialog-top"><h2>${esc(r.name)}</h2>${close}</div><p>${esc(r.slug)}</p><div class="preview-stats"><div><span class="muted">成员</span><b>${count(r.member_count, "人")}</b></div><div><span class="muted">工作区</span><b>${count(r.workspace_count, "个")}</b></div></div><span class="badge ${r.status === "archived" ? "archived" : ""}">${esc(statusText(r.status))}</span><footer>${button("preview-detail", "打开组织详情", "primary", busy)}</footer><details id="technical"><summary>技术详情</summary><p style="overflow-wrap:anywhere">${esc(r.id)}</p></details></section>`;
    } else if (s.modal === "filter") {
      narrow = true;
      label = "筛选组织";
      content = `<section class="form-body"><div class="dialog-top"><h2>筛选组织</h2>${close}</div>${filters("mobile")}</section>`;
    } else if (s.modal === "user") {
      narrow = true;
      label = "新建用户";
      const u = s.user;
      content = `<form class="form-body" data-form="user"><div class="dialog-top"><h2>新建用户</h2>${close}</div><p>首次登录必须修改临时密码；平台管理员还需绑定 MFA。</p>${notice(s.formError, true)}<div class="field-stack">${input("email", "邮箱", u.email, 'type="email" required maxlength="254"')}${input("temporary_password", "临时密码", u.temporary_password, 'type="password" required minlength="12" maxlength="128" autocomplete="new-password"')}${select(
        "platform_role_code",
        "平台角色",
        [
          ["", "普通用户"],
          ["platform_operations_admin", "运营管理员"],
          ["platform_security_admin", "安全管理员"],
          ["platform_super_admin", "超级管理员"],
        ]
          .map(([v, n]) => option(v, n, u.platform_role_code))
          .join(""),
      )}${select("organization_id", "加入组织", option("", "暂不加入组织", u.organization_id) + s.rows.map((r) => option(r.id, r.name, u.organization_id, r.status !== "active")).join(""))}${u.organization_id ? select("organization_role_code", "组织角色", option("member", "普通成员", u.organization_role_code) + option("organization_admin", "组织管理员", u.organization_role_code)) : ""}</div><footer>${button("close", "取消")}<button class="primary" ${busy ? "disabled" : ""}>${busy ? "正在创建…" : "确认创建"}</button></footer></form>`;
    }
    let html = `<dialog id="modal" class="${narrow ? "narrow" : ""}" aria-label="${esc(label)}">${content}</dialog>`;
    if (s.reason) {
      const r = s.reason;
      html += `<dialog id="reason-modal" class="narrow" aria-label="${r.title}"><form data-form="reason" class="form-body"><div class="dialog-top"><h2>${r.title}</h2>${button("cancel-reason", "关闭", "", false, 'aria-label="关闭原因确认"')}</div><div class="reason-target"><strong>${esc(r.target.name)}</strong><p class="muted">${esc(r.target.slug)}</p></div><p>原因会写入平台审计记录。此次确认仅针对上方组织。</p>${notice(r.error, true)}<label for="reason">操作原因<textarea id="reason" required minlength="2" maxlength="300">${esc(r.value)}</textarea></label><footer>${button("cancel-reason", "取消")}<button class="${r.kind === "disable" ? "danger" : "primary"}">确认执行</button></footer></form></dialog>`;
    }
    return html;
  }
  function render(focusId) {
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    document.getElementById("app").innerHTML =
      list() +
      `<details class="review"><summary>审核场景（离线工具）</summary>${select(
        "scene",
        "选择场景",
        Object.entries(names)
          .map(([v, n]) => option(v, n, s.scene))
          .join(""),
      )}<p>原始夹具和合成变体均非客户数据。写入只生成内存意图，不访问 API；模拟结果不代表生产成功。</p><div class="actions">${button("simulate-success", "模拟完成")}${button("simulate-error", "模拟失败")}</div><p id="route-readout">路由意图：${esc(s.route)}</p></details>` +
      dialogs();
    document.querySelectorAll("dialog").forEach((d) => {
      d.showModal();
      d.addEventListener("cancel", (e) => {
        e.preventDefault();
        if (d.id === "reason-modal") {
          s.reason = null;
          render("save-trigger");
        } else close();
      });
    });
    if (focusId) document.getElementById(focusId)?.focus();
  }
  function close() {
    const old = s.modal;
    epoch++;
    s.reason = null;
    s.modal = "";
    s.formError = "";
    if (["create", "detail", "missing"].includes(old)) {
      route(base, "replace");
      s.query = s.status = s.appliedQuery = s.appliedStatus = "";
      s.rows = clone(D.overview.organizations);
    }
    render(old === "create" ? "new-org" : old === "preview" ? "preview-0" : "detail-0");
  }
  function openDetail(r) {
    epoch++;
    s.modal = "detail";
    s.reason = null;
    s.selected = clone(r);
    s.formError = "";
    s.note = "";
    s.edit = {
      name: r.name,
      timezone: r.timezone || "Asia/Shanghai",
      data_retention_days: Number(r.data_retention_days || 365),
    };
    route(base + "/" + r.id);
    render();
  }
  function submit(kind, body, target = s.selected?.id) {
    if (s.pending) return;
    const url =
      kind === "user"
        ? "/platform/accounts/users"
        : kind === "create"
          ? path
          : kind === "save"
            ? `${path}/${target}`
            : `${path}/${target}/status`;
    const p = {
      id: ++sequence,
      owner: epoch,
      kind,
      body: clone(body),
      path: url,
      method: kind === "save" ? "PATCH" : "POST",
      target,
    };
    s.pending = p;
    s.writes.push(clone(p));
    s.reason = null;
    s.formError = "";
    render();
    // Intentionally pending until the review tool supplies a synthetic result.
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
      s.formError = "操作未完成，请核对后重试。草稿已保留。（离线模拟）";
      render();
      return;
    }
    if (p.kind === "create") {
      s.form = freshForm();
      const r = {
        id: "00000000-0000-4000-8000-000000000626",
        name: p.body.name,
        slug: p.body.slug,
        status: "active",
      };
      openDetail(r);
      route(base + "/" + r.id, "replace");
      s.note = "创建返回成功；仅收到最小组织信息，数量待列表回读。（离线模拟）";
    } else if (p.kind === "user") {
      close();
      s.note = "账号创建返回成功；首次登录要求仍须真实环境验证。（离线模拟）";
    } else {
      s.note = "写入返回成功，尚待刷新确认组织事实。（离线模拟）";
    }
    render();
  }
  document.addEventListener("input", (e) => {
    const { id, value } = e.target;
    if (id.endsWith("-query")) s.query = value;
    if (["name", "slug", "initial_admin_user_id"].includes(id)) s.form[id] = value;
    if (id === "edit-name") s.edit.name = value;
    if (id === "timezone") s.edit.timezone = value;
    if (id === "data_retention_days") s.edit.data_retention_days = Number(value);
    if (id in s.user) s.user[id] = value;
    if (id === "reason" && s.reason) s.reason.value = value;
  });
  document.addEventListener("change", (e) => {
    const { id, value } = e.target;
    if (id === "scene") return reset(value);
    if (id.endsWith("-status")) s.status = value;
    if (id === "organization_id") render("organization_id");
    if (e.target.dataset.col != null) {
      const col = Number(e.target.dataset.col);
      if (e.target.checked) s.hidden = s.hidden.filter((i) => i !== col);
      else if (s.hidden.length < 4) s.hidden.push(col);
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
      s.appliedQuery = s.query.trim();
      s.appliedStatus = s.status;
      s.rows = clone(D.overview.organizations).filter(
        (r) =>
          (!s.appliedStatus || r.status === s.appliedStatus) &&
          (!s.appliedQuery ||
            (r.name + " " + r.slug).toLowerCase().includes(s.appliedQuery.toLowerCase())),
      );
      s.modal = "";
      s.mode = "ready";
      const url = new URL(location.href);
      for (const [k, v] of [
        ["query", s.appliedQuery],
        ["status", s.appliedStatus],
      ]) {
        if (v) url.searchParams.set(k, v);
        else url.searchParams.delete(k);
      }
      history.replaceState({}, "", url);
      render();
    }
    if (type === "create") {
      if (s.step === 1) {
        s.step = 2;
        s.formError = "";
        render();
      } else
        submit("create", {
          name: s.form.name,
          slug: s.form.slug,
          ...(s.form.initial_admin_user_id
            ? { initial_admin_user_id: s.form.initial_admin_user_id }
            : {}),
        });
    }
    if (type === "detail") {
      setReason("save");
      render();
    }
    if (type === "reason") {
      const r = s.reason,
        reason = r.value.trim();
      if (reason.length < 2 || reason.length > 300) {
        r.error = "填写 2–300 字的操作原因。";
        render("reason");
        return;
      }
      submit(
        r.kind,
        r.kind === "save"
          ? { ...r.edit, reason }
          : { status: r.kind === "disable" ? "archived" : "active", reason },
        r.target.id,
      );
    }
    if (type === "user")
      submit("user", {
        ...s.user,
        platform_role_code: s.user.platform_role_code || null,
        organization_id: s.user.organization_id || null,
      });
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    e.preventDefault();
    const action = b.dataset.action,
      i = Number(b.dataset.index ?? 0);
    if (action === "list") reset();
    if (action === "create") {
      epoch++;
      s.modal = "create";
      s.step = 1;
      s.formError = "";
      route(base + "/new");
      render();
    }
    if (action === "user") {
      epoch++;
      s.modal = "user";
      s.user = {
        email: "",
        temporary_password: "",
        platform_role_code: "",
        organization_id: "",
        organization_role_code: "member",
      };
      s.formError = "";
      render();
    }
    if (action === "close") close();
    if (action === "back") {
      s.step = 1;
      s.formError = "";
      render();
    }
    if (action === "detail") openDetail(s.rows[i]);
    if (action === "preview") {
      s.selected = clone(s.rows[i]);
      s.modal = "preview";
      render();
    }
    if (action === "preview-detail") openDetail(s.selected);
    if (action === "filter") {
      s.modal = "filter";
      render();
    }
    if (action === "reset-filter") {
      const keepModal = s.modal === "filter";
      s.query = s.status = s.appliedQuery = s.appliedStatus = "";
      s.rows = clone(D.overview.organizations);
      const u = new URL(location.href);
      u.searchParams.delete("query");
      u.searchParams.delete("status");
      history.replaceState({}, "", u);
      render();
      if (keepModal) document.getElementById("mobile-query").focus();
    }
    if (action === "refresh" || action === "retry-detail") {
      s.mode = "ready";
      s.note = "模拟重新读取完成；当前仍使用原测试夹具。";
      s.error = false;
      s.rows = clone(D.overview.organizations).filter(
        (r) =>
          (!s.appliedStatus || r.status === s.appliedStatus) &&
          (!s.appliedQuery ||
            (r.name + " " + r.slug).toLowerCase().includes(s.appliedQuery.toLowerCase())),
      );
      render();
    }
    if (action === "toggle") {
      setReason(s.selected.status === "active" ? "disable" : "restore");
      render();
    }
    if (action === "cancel-reason") {
      s.reason = null;
      render();
    }
    if (action === "simulate-success") complete();
    if (action === "simulate-error") complete("error");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const modal = [...document.querySelectorAll("dialog[open]")].at(-1);
    if (!modal) return;
    const nodes = [
      ...modal.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary",
      ),
    ].filter((n) => n.getClientRects().length);
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes.at(-1)?.focus();
    }
    if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
      e.preventDefault();
      nodes[0]?.focus();
    }
  });
  window.ORGANIZATIONS_C = {
    scenes: names,
    scene: reset,
    state: () => clone(s),
    complete,
    mutateSelectionForTest: (id) => {
      s.selected.id = id;
      s.edit.name = "切换后的草稿";
    },
  };
  reset(
    new URLSearchParams(location.search).get("scene") in names
      ? new URLSearchParams(location.search).get("scene")
      : "list",
  );
})();
