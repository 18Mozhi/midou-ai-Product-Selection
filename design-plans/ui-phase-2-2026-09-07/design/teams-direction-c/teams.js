(() => {
  "use strict";
  const D = window.TEAMS_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    fmt = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "暂无记录"),
    label = (m) => (m.display_name ? `${m.display_name} · ${m.email}` : m.email);
  const scenes = {
    normal: "原始团队",
    catalog: "十条治理夹具",
    page_two: "第二页",
    search_email: "负责人邮箱搜索",
    search_workflow: "流程键搜索",
    archived: "归档团队仍有成员动作",
    filter_empty: "筛选空仍保留选择",
    empty: "空团队自动创建",
    no_members: "无活动成员",
    locked_member: "账号锁定但组织关系活动",
    member_missing: "未选择成员",
    lead_missing: "负责人未设置",
    workflow_missing: "流程未设置",
    long_content: "长名称邮箱流程键",
    zero_count: "零成员关系",
    missing_count: "缺失关系计数",
    create: "新建空表单",
    create_draft: "四字段草稿",
    create_optional_empty: "可选字段留空",
    create_required: "必填字段错误",
    create_long: "长度边界",
    create_busy: "创建处理中",
    create_failure: "创建失败保留草稿",
    create_success: "合成创建已确认",
    create_read_failed: "写后读取失败",
    create_unknown: "写入结果未知",
    reason_assign: "分配原因窗",
    reason_remove: "移除原因窗",
    reason_short: "原因过短",
    reason_long: "长原因",
    member_busy: "关系变更处理中",
    member_failure: "关系变更失败",
    member_success: "合成关系写响应",
    switched_pending: "切团队后的旧请求反馈",
    selected: "选择第二团队",
    loading: "首次读取",
    error: "服务错误",
    blocked: "服务不可用",
    expired: "登录失效",
    forbidden: "无权访问",
    rate_limited: "请求频繁",
    refreshing: "后台刷新",
    refresh_error: "刷新失败保留事实",
    technical: "技术详情",
    hover: "创建按钮悬停",
    pressed: "创建按钮按下",
    focus: "创建按钮焦点",
    controls: "非业务审核工具",
  };
  let state,
    generation = 0,
    returnAction = "assign";
  const cleanForm = () => ({
      name: "",
      lead_membership_id: "",
      default_workflow_key: "",
      reason: "",
    }),
    team = () => state.items.find((r) => r.id === state.selectedId),
    active = () => state.members.filter((m) => m.status === "active"),
    member = () => active().find((m) => m.id === state.memberId);
  function filtered() {
    const q = state.query.trim().toLowerCase();
    return state.items
      .filter(
        (r) =>
          (state.status === "all" || r.status === state.status) &&
          (!q ||
            [r.name, r.lead_email, r.default_workflow_key].some((v) =>
              String(v ?? "")
                .toLowerCase()
                .includes(q),
            )),
      )
      .sort((a, b) =>
        state.sort === "members_desc"
          ? Number(b.member_count ?? 0) - Number(a.member_count ?? 0) ||
            a.name.localeCompare(b.name, "zh-CN")
          : state.sort === "updated_desc"
            ? new Date(b.updated_at) - new Date(a.updated_at) ||
              a.name.localeCompare(b.name, "zh-CN")
            : a.name.localeCompare(b.name, "zh-CN"),
      );
  }
  function reconcile(openEmpty = false) {
    if (!team()) {
      state.selectedId =
        state.items.find((r) => r.status === "active")?.id || state.items[0]?.id || "";
      state.memberId = "";
      state.memberFeedback = "";
    }
    if (openEmpty && !state.items.length) state.createOpen = true;
    state.page = Math.min(state.page, Math.max(1, Math.ceil(filtered().length / 8)));
  }
  function focus(s) {
    $(s)?.focus();
  }
  function log(url, method = "GET", body) {
    state.intents.push({ url, method, ...(body === undefined ? {} : { body }) });
    $("#intent-log").textContent = JSON.stringify(state.intents, null, 2);
  }
  const badge = (r) =>
      `<span class="badge ${r.status === "active" ? "" : "archived"}">${r.status === "active" ? "正常使用" : "已归档"}</span>`,
    feedback = (id, text) =>
      text
        ? `<div id="${id}" class="notice" data-kind="${state.noticeKind}" role="${state.noticeKind === "error" ? "alert" : "status"}" tabindex="-1">${esc(text)}</div>`
        : "";
  function options(value, empty) {
    return `<option value="">${empty}</option>${active()
      .map(
        (m) =>
          `<option value="${m.id}" ${m.id === value ? "selected" : ""}>${esc(label(m))}</option>`,
      )
      .join("")}`;
  }
  function catalog() {
    const rows = filtered(),
      pages = Math.max(1, Math.ceil(rows.length / 8));
    return `<section id="catalog" class="paper" tabindex="-1"><header class="section-head"><h3>选择团队</h3><div class="tabs" role="group" aria-label="团队状态">${[
      ["all", "全部", state.items.length],
      ["active", "正常", state.items.filter((r) => r.status === "active").length],
      ["archived", "归档", state.items.filter((r) => r.status === "archived").length],
    ]
      .map(
        ([k, l, n]) =>
          `<button data-status="${k}" aria-pressed="${state.status === k}">${l} ${n}</button>`,
      )
      .join(
        "",
      )}</div></header><details id="filters" ${state.filtersOpen ? "open" : ""}><summary>筛选与排序</summary><div class="filter-fields"><label for="query">搜索团队<input id="query" data-filter="query" value="${esc(state.query)}" type="search" placeholder="名称、负责人邮箱或流程键"></label><label for="sort">排序<select id="sort" data-filter="sort">${[
      ["name_asc", "名称升序"],
      ["members_desc", "成员最多"],
      ["updated_desc", "最近更新"],
    ]
      .map(([k, l]) => `<option value="${k}" ${state.sort === k ? "selected" : ""}>${l}</option>`)
      .join(
        "",
      )}</select></label><button data-reset>重置筛选</button></div></details><p class="filter-summary">筛选 ${rows.length} / ${state.items.length} 个${state.query ? "；搜索：" + esc(state.query) : ""}；每页8条</p>${
      rows.length
        ? `<ul class="team-list">${rows
            .slice((state.page - 1) * 8, state.page * 8)
            .map(
              (r) =>
                `<li><button class="team-row" data-select="${r.id}" aria-pressed="${r.id === state.selectedId}" aria-label="选择团队 ${esc(r.name)}"><span><strong>${esc(r.name)}</strong>${badge(r)}</span><span class="cell"><small>负责人</small>${esc(r.lead_email || (r.lead_membership_id ? "邮箱未返回" : "未设置"))}</span><span class="cell"><small>默认流程键</small>${esc(r.default_workflow_key || "未设置")}</span><span class="cell"><small>成员关系</small>${r.member_count ?? "未提供"}${r.member_count == null ? "" : " 人"}</span></button></li>`,
            )
            .join("")}</ul>`
        : `<div class="empty"><h3>${state.items.length ? "没有符合条件的团队" : "当前组织还没有团队"}</h3><p>${state.items.length ? "已选择团队仍保留，清除筛选可重新定位。" : "创建团队后可设置负责人并分配活动成员。"}</p><button ${state.items.length ? "data-reset" : "data-create"}>${state.items.length ? "清除筛选" : "创建团队"}</button></div>`
    }${pages > 1 ? `<nav class="pagination" aria-label="团队分页"><button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一页</button><span>${state.page} / ${pages}</span><button data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一页</button></nav>` : ""}</section>`;
  }
  function relationship() {
    const r = team(),
      m = member();
    if (!r)
      return '<section id="relationship" class="paper empty" tabindex="-1"><h3>选择团队查看协作关系</h3></section>';
    return `<section id="relationship" class="paper" tabindex="-1"><a class="mobile-return" href="#catalog">返回团队目录</a>${!filtered().some((i) => i.id === r.id) ? '<p class="notice">当前选择不在筛选结果中，以下仍是所选团队的事实。</p>' : ""}<div class="relationship-grid"><section class="facts"><h2>${esc(r.name)}</h2>${badge(r)}<dl><div class="wide"><dt>负责人</dt><dd>${esc(r.lead_email || (r.lead_membership_id ? "邮箱未返回" : "尚未设置"))}</dd></div><div class="wide"><dt>默认工作流程键</dt><dd>${esc(r.default_workflow_key || "尚未设置")}</dd></div><div><dt>成员关系</dt><dd>${r.member_count ?? "未提供"}${r.member_count == null ? "" : " 人"}</dd></div><div><dt>当前版本</dt><dd>第 ${r.version} 版</dd></div><div><dt>创建时间</dt><dd>${fmt(r.created_at)}</dd></div><div><dt>最近更新</dt><dd>${fmt(r.updated_at)}</dd></div></dl><details id="technical"><summary>技术详情</summary><code>团队 ID：${esc(r.id)}${r.lead_membership_id ? "\n负责人成员关系 ID：" + esc(r.lead_membership_id) : ""}</code></details><div class="facts-links"><a href="/org-admin/members" data-route>查看组织成员</a><a href="/org-admin/workspaces" data-route>查看工作区边界</a></div></section><section class="membership"><h3>分配或移除活动成员</h3><p>${active().length} 位当前组织活动成员可选；不代表均未锁定账号。</p>${feedback("member-feedback", state.memberFeedback)}<label for="team-member-select">当前组织成员</label><select id="team-member-select">${options(state.memberId, "请选择成员")}</select>${m ? `<p class="member-identity">${esc(label(m))}${m.account_status === "locked" ? "；账号已锁定，组织成员关系仍为活动。" : ""}</p>` : ""}<div class="member-actions"><button data-member-action="assign" class="primary" ${state.busy || state.memberBusy ? "disabled" : ""}>分配成员</button><button data-member-action="remove" class="danger" ${state.busy || state.memberBusy ? "disabled" : ""}>移除成员</button></div><p>仅返回团队成员数量，未返回成员名单。这里选择的是操作对象，不表示此人当前属于该团队。</p><p>移除只调整团队关系，不删除账号，也不更改负责人字段。</p></section></div><p class="boundary">负责人和默认流程键仅在创建时配置；本页没有后续编辑或团队归档入口。</p></section>`;
  }
  function createForm() {
    if (!state.createOpen) return "";
    const f = state.form,
      disabled = state.busy === "create" || state.unresolved;
    return `<form id="create-form" class="paper create-form" novalidate><header class="create-head"><h2>新建团队</h2><button id="cancel-create" type="button" ${state.busy === "create" ? "disabled" : ""}>取消</button></header><p class="create-intro">负责人可暂不设置；设置后会同时建立团队成员关系。</p>${feedback("form-feedback", state.formNotice)}<div class="create-grid"><div><label for="team-name">团队名称</label><input id="team-name" name="name" required maxlength="120" value="${esc(f.name)}" ${disabled ? "disabled" : ""} aria-invalid="${!!state.errors.name}" aria-describedby="name-error"><small id="name-error" class="field-error">${esc(state.errors.name || "最多120个字符")}</small></div><div><label for="team-lead">负责人（可选）</label><select id="team-lead" name="lead_membership_id" ${disabled ? "disabled" : ""} aria-invalid="${!!state.errors.lead_membership_id}" aria-describedby="lead-error">${options(f.lead_membership_id, "暂不设置")}</select><small id="lead-error" class="field-error">${esc(state.errors.lead_membership_id || "仅当前组织活动成员，不额外过滤锁定账号")}</small></div><div class="full"><label for="team-workflow">默认工作流程（可选）</label><input id="team-workflow" name="default_workflow_key" maxlength="80" value="${esc(f.default_workflow_key)}" ${disabled ? "disabled" : ""} aria-describedby="workflow-error"><small id="workflow-error">保存流程键，最多80字符；不校验是否存在对应流程。</small></div><div class="full"><label for="team-reason">创建原因</label><textarea id="team-reason" name="reason" required maxlength="500" ${disabled ? "disabled" : ""} aria-invalid="${!!state.errors.reason}" aria-describedby="create-reason-error">${esc(f.reason)}</textarea><small id="create-reason-error" class="field-error">${esc(state.errors.reason || "最多500个字符")}</small></div></div><footer><p>创建后为正常使用；原型不创建真实团队或审计记录。</p><button id="create-submit" class="primary" ${state.busy || state.unresolved ? "disabled" : ""}>${state.busy === "create" ? "正在创建…" : "创建并写入审计"}</button></footer></form>`;
  }
  function render() {
    reconcile();
    const titles = {
      loading: "正在读取团队与组织成员…",
      error: "团队数据读取失败",
      blocked: "服务暂不可用",
      expired: "登录已失效",
      forbidden: "无权管理当前组织团队",
      rate_limited: "请求过于频繁",
    };
    $("#workspace").innerHTML =
      `<header class="page-head"><div><h2>团队治理</h2><p>先选团队，再核对成员关系的操作对象。</p></div><div class="head-actions"><button id="refresh" ${state.busy || state.pageState === "loading" ? "disabled" : ""}>${state.busy === "refresh" ? "正在刷新…" : "刷新数据"}</button>${state.pageState === "ready" ? `<button data-create class="primary" ${state.busy ? "disabled" : ""}>新建团队</button>` : ""}</div></header>${feedback("feedback", state.notice)}${state.pageState === "ready" ? `<div class="summary-strip"><span>已加载 <b>${state.items.length}</b> 个团队</span><span>成员关系 <b>${state.items.some((r) => r.member_count == null) ? "数据不全" : state.items.reduce((s, r) => s + Number(r.member_count ?? 0), 0)}</b> 次</span><span>有负责人 <b>${state.items.filter((r) => r.lead_membership_id).length}</b> 个</span><span>有流程键 <b>${state.items.filter((r) => r.default_workflow_key).length}</b> 个</span></div>${catalog()}${relationship()}${createForm()}<p class="provenance">${esc(state.provenance)} 成员关系合计不是组织去重人数；流程键不证明流程有效。</p>` : `<div class="empty"><h3>${titles[state.pageState]}</h3>${state.pageState === "loading" ? "" : '<button id="retry">重新加载</button>'}</div>`}`;
    $("#scene-picker").value = state.scene;
    $("#filters")?.addEventListener("toggle", (e) => {
      if (e.target.isConnected) state.filtersOpen = e.target.open;
    });
    $("#create-form")?.addEventListener("submit", submitCreate);
    for (const type of ["input", "change"])
      $("#create-form")?.addEventListener(type, (e) => {
        if (e.target.name) state.form[e.target.name] = e.target.value;
      });
  }
  function openCreate() {
    if (state.busy) return;
    state.createOpen = true;
    render();
    focus("#team-name");
  }
  function cancelCreate() {
    if (state.busy === "create") return;
    state.form = cleanForm();
    state.createOpen = false;
    state.formNotice = "";
    state.errors = {};
    state.unresolved = false;
    render();
    focus("[data-create]");
  }
  function submitCreate(e) {
    e.preventDefault();
    if (state.busy || state.unresolved) return;
    const f = {
      ...state.form,
      name: state.form.name.trim(),
      default_workflow_key: state.form.default_workflow_key.trim(),
      reason: state.form.reason.trim(),
    };
    state.errors = {};
    if (!f.name || f.name.length > 120) state.errors.name = "填写1–120个字符的团队名称。";
    if (f.lead_membership_id && !active().some((m) => m.id === f.lead_membership_id))
      state.errors.lead_membership_id = "负责人已不在活动成员选项中，请重新选择。";
    if (f.default_workflow_key.length > 80)
      state.errors.default_workflow_key = "流程键最多80字符。";
    if (!f.reason || f.reason.length > 500) state.errors.reason = "填写1–500个字符的创建原因。";
    if (Object.keys(state.errors).length) {
      render();
      focus(
        {
          name: "#team-name",
          lead_membership_id: "#team-lead",
          default_workflow_key: "#team-workflow",
          reason: "#team-reason",
        }[Object.keys(state.errors)[0]],
      );
      return;
    }
    log("/org/admin/teams", "POST", f);
    if (state.mode === "hold") {
      state.pending = { kind: "create", form: clone(f), token: ++generation };
      state.busy = "create";
    } else state.formNotice = "仅记录创建意图，未创建真实团队。";
    render();
    focus("#form-feedback");
  }
  function openReason(action) {
    if (state.busy || state.memberBusy || !team()) return;
    if (!member()) {
      state.memberFeedback = "请先选择一位当前组织的活动成员。";
      state.noticeKind = "error";
      render();
      focus("#member-feedback");
      return;
    }
    state.dialog = { team: clone(team()), member: clone(member()), action };
    state.memberBusy = true;
    state.memberFeedback = "";
    returnAction = action;
    render();
    $("#reason-title").textContent = (action === "assign" ? "分配" : "移除") + "团队成员原因";
    $("#reason-target").innerHTML =
      `<strong>${esc(state.dialog.team.name)}</strong><p>操作对象：${esc(label(state.dialog.member))}</p><p>${action === "assign" ? "建立该团队与成员的关系；不更改其组织角色。" : "移除该团队成员关系；不删除账号、不清空负责人字段。"}</p>`;
    $("#reason-input").value = action === "assign" ? "分配团队成员" : "移除团队成员";
    $("#reason-confirm").disabled = false;
    $("#reason-dialog").showModal();
    $("#reason-dialog").scrollTop = 0;
    focus("#reason-input");
  }
  function closeReason() {
    state.dialog = null;
    state.memberBusy = false;
    $("#reason-dialog").close();
    render();
    focus(`[data-member-action="${returnAction}"]`);
  }
  function submitReason(e) {
    e.preventDefault();
    const reason = $("#reason-input").value.trim();
    if (!state.dialog || reason.length < 2 || reason.length > 500) return;
    const d = clone(state.dialog);
    closeReason();
    log(`/org/admin/teams/${d.team.id}/members`, "POST", {
      action: d.action,
      membership_id: d.member.id,
      reason,
    });
    if (state.mode === "hold") {
      state.pending = { kind: "member", target: d, token: ++generation };
      state.memberBusy = true;
    } else
      state.memberFeedback = `仅记录${d.team.name} / ${label(d.member)}的关系变更意图，事实未改变。`;
    render();
    focus("#member-feedback");
  }
  function complete(outcome, token = state.pending?.token) {
    const p = state.pending;
    if (!p || p.token !== token) return false;
    state.pending = null;
    state.busy = "";
    state.memberBusy = false;
    state.noticeKind = outcome === "success" ? "info" : "error";
    let target = "#feedback";
    if (p.kind === "create") {
      if (outcome === "success") {
        state.form = cleanForm();
        state.createOpen = false;
        state.notice = "合成创建响应已确认；列表未重读，不补造团队记录。";
      } else {
        state.form = clone(p.form);
        state.formNotice =
          outcome === "read_failed"
            ? "合成写响应已确认，但列表重读失败；先刷新核验。"
            : outcome === "unknown"
              ? "合成结果未确认；先刷新核验，不重复创建。"
              : "合成创建失败，草稿保留。";
        state.unresolved = ["read_failed", "unknown"].includes(outcome);
        target = "#form-feedback";
      }
    } else {
      const d = p.target,
        text = `${d.team.name} / ${label(d.member)}：${outcome === "success" ? "合成关系写响应已确认，未重读数量或成员明细。" : "合成关系变更失败；未确认成员关系改变。"}`;
      if (state.selectedId === d.team.id && state.memberId === d.member.id) {
        state.memberFeedback = text;
        target = "#member-feedback";
      } else {
        state.notice = text;
        target = null;
      }
    }
    if (outcome === "forbidden") {
      state.pageState = "forbidden";
      state.notice = "合成403：当前组织访问被拒绝，不能继续操作。";
      target = "#feedback";
    }
    render();
    if (target) focus(target);
    return true;
  }
  function selectTeam(id) {
    if (state.selectedId !== id) {
      state.selectedId = id;
      state.memberId = "";
      state.memberFeedback = "";
    }
    render();
    focus("#relationship");
  }
  function scene(name) {
    if (!(name in scenes)) throw Error("Unknown scene");
    if ($("#reason-dialog").open) $("#reason-dialog").close();
    generation++;
    state = {
      items: clone(D.teams),
      members: clone(D.members.items),
      selectedId: "",
      memberId: "",
      query: "",
      status: "all",
      sort: "name_asc",
      page: 1,
      createOpen: false,
      form: cleanForm(),
      errors: {},
      formNotice: "",
      notice: "",
      noticeKind: "info",
      memberFeedback: "",
      memberBusy: false,
      busy: "",
      pending: null,
      dialog: null,
      mode: "intent",
      unresolved: false,
      filtersOpen: innerWidth > 650,
      pageState: "ready",
      scene: name,
      intents: [],
      provenance: "原始单团队夹具；摘要24团队与列表1条差异保留，非生产数据。",
    };
    if (
      [
        "catalog",
        "page_two",
        "search_email",
        "search_workflow",
        "archived",
        "filter_empty",
        "reason_assign",
        "reason_remove",
        "reason_short",
        "reason_long",
        "member_busy",
        "member_failure",
        "member_success",
        "switched_pending",
        "selected",
      ].includes(name)
    ) {
      state.items = clone(D.teamRows);
      state.provenance = "原始十条治理夹具，独立于单团队基线。";
    }
    if (!["normal", "catalog", "technical", "controls"].includes(name))
      state.provenance = "合成审核状态；不是实际团队、权限或写入结果。";
    if (name === "page_two") state.page = 2;
    if (name === "search_email") state.query = "buyer@example.test";
    if (name === "search_workflow") state.query = "workflow-10";
    if (name === "archived") {
      state.status = "archived";
      state.selectedId = D.teamRows[9].id;
    }
    if (name === "filter_empty") state.query = "不存在";
    if (name === "empty") {
      state.items = [];
      state.createOpen = true;
    }
    if (name === "no_members") state.members = [];
    if (name === "locked_member") state.memberId = D.members.items[2].id;
    if (name === "lead_missing") {
      state.items[0].lead_email = null;
      state.items[0].lead_membership_id = null;
    }
    if (name === "workflow_missing") state.items[0].default_workflow_key = null;
    if (name === "long_content") {
      state.items[0].name = "跨境新品证据采购协作团队".repeat(6);
      state.items[0].lead_email = "long-member-".repeat(10) + "@example.test";
      state.items[0].default_workflow_key = "workflow-".repeat(8);
    }
    if (name === "zero_count") state.items[0].member_count = 0;
    if (name === "missing_count") delete state.items[0].member_count;
    if (name.startsWith("create") || ["hover", "pressed", "focus"].includes(name)) {
      state.createOpen = true;
      state.form = clone(D.contracts.create.body);
    }
    if (name === "create") state.form = cleanForm();
    if (name === "create_optional_empty") {
      state.form.lead_membership_id = "";
      state.form.default_workflow_key = "";
    }
    if (name === "create_required") {
      state.form = cleanForm();
      state.errors = { name: "填写团队名称。", reason: "填写创建原因。" };
    }
    if (name === "create_long") {
      state.form.name = "名称".repeat(60);
      state.form.default_workflow_key = "k".repeat(80);
      state.form.reason = "核验创建边界。".repeat(50);
    }
    if (name === "create_busy") state.busy = "create";
    if (["create_failure", "create_read_failed", "create_unknown"].includes(name)) {
      state.formNotice = {
        create_failure: "合成创建失败，草稿保留。",
        create_read_failed: "合成写响应已确认，列表重读失败，请刷新核验。",
        create_unknown: "合成写入结果未知，请先刷新核验，不重复创建。",
      }[name];
      state.unresolved = name !== "create_failure";
    }
    if (name === "create_success") {
      state.createOpen = false;
      state.form = cleanForm();
      state.notice = "合成创建响应已确认；列表未重读，不补造新团队。";
    }
    if (
      name.startsWith("reason_") ||
      ["selected", "member_busy", "member_failure", "member_success"].includes(name)
    )
      state.selectedId = D.teamRows[1].id;
    reconcile();
    if (name === "member_missing") state.memberFeedback = "请先选择一位当前组织的活动成员。";
    if (
      name.startsWith("reason_") ||
      ["member_busy", "member_failure", "member_success"].includes(name)
    )
      state.memberId = D.members.items[1].id;
    if (name === "locked_member") state.memberId = D.members.items[2].id;
    if (name === "member_busy") state.memberBusy = true;
    if (name === "member_failure")
      state.memberFeedback = "合成变更失败：团队治理样本 02 / 陈采购，成员关系未确认改变。";
    if (name === "member_success")
      state.memberFeedback = "合成写响应已确认：团队治理样本 02 / 陈采购；未重读事实。";
    if (name === "switched_pending") {
      state.selectedId = D.teamRows[2].id;
      state.notice = "合成旧请求结果：团队治理样本 02 / 陈采购，未归属于当前选择的团队03。";
    }
    if (["loading", "error", "blocked", "expired", "forbidden", "rate_limited"].includes(name))
      state.pageState = name;
    if (name === "refreshing") state.busy = "refresh";
    if (name === "refresh_error") {
      state.notice = "合成刷新失败，原团队及成员选项保留。";
      state.noticeKind = "error";
    }
    $("#review-tools").hidden = name !== "controls";
    $("#review-toggle").setAttribute("aria-expanded", String(name === "controls"));
    $("#intent-log").textContent = "仅记录意图，不访问服务。";
    for (const a of document.querySelectorAll(".blue-directory a"))
      a.setAttribute("aria-current", String(a.hash === "#catalog"));
    render();
    window.scrollTo(0, 0);
    if (name.startsWith("reason_")) {
      openReason(name === "reason_remove" ? "remove" : "assign");
      if (name === "reason_short") {
        $("#reason-input").value = "短";
        $("#reason-confirm").disabled = true;
      }
      if (name === "reason_long")
        $("#reason-input").value = "核验团队协作关系和业务范围，记录本次调整依据。".repeat(18);
    }
    if (name === "technical") $("#technical").open = true;
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  $("#scene-picker").addEventListener("change", (e) => scene(e.target.value));
  $("#review-toggle").addEventListener("click", () => {
    $("#review-tools").hidden = !$("#review-tools").hidden;
    $("#review-toggle").setAttribute("aria-expanded", String(!$("#review-tools").hidden));
  });
  $("#reason-form").addEventListener("submit", submitReason);
  $("#reason-close").addEventListener("click", closeReason);
  $("#reason-cancel").addEventListener("click", closeReason);
  $("#reason-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeReason();
  });
  $("#reason-input").addEventListener("input", () => {
    $("#reason-confirm").disabled = $("#reason-input").value.trim().length < 2;
  });
  $("#reason-dialog").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...e.currentTarget.querySelectorAll("button,textarea")].filter(
        (n) => !n.disabled,
      ),
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("input", (e) => {
    const n = e.target;
    if (!n.dataset.filter) return;
    const pos = n.selectionStart;
    state.filtersOpen = $("#filters").open;
    state[n.dataset.filter] = n.value;
    state.page = 1;
    render();
    focus("#" + n.id);
    if (pos != null) $("#" + n.id).setSelectionRange(pos, pos);
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "team-member-select") {
      state.memberId = e.target.value;
      state.memberFeedback = "";
      render();
      focus("#team-member-select");
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-create")) openCreate();
    if (b.id === "cancel-create") cancelCreate();
    if (b.dataset.memberAction) openReason(b.dataset.memberAction);
    if (b.dataset.select) selectTeam(b.dataset.select);
    if (b.dataset.status) {
      state.status = b.dataset.status;
      state.page = 1;
      render();
    }
    if (b.hasAttribute("data-reset")) {
      state.query = "";
      state.status = "all";
      state.sort = "name_asc";
      state.page = 1;
      render();
    }
    if (b.dataset.page) {
      state.page = Number(b.dataset.page);
      render();
    }
    if (["refresh", "retry"].includes(b.id)) {
      for (const p of ["summary", "teams", "members"]) log("/org/admin/" + p);
      state.notice = "仅记录读取意图，未访问服务，团队与草稿不变。";
      render();
      focus("#feedback");
    }
    if (b.hasAttribute("data-route")) {
      e.preventDefault();
      log(b.getAttribute("href"), "NAVIGATE");
      state.notice = "仅记录导航意图，目标页面不在本批原型中。";
      render();
      focus("#feedback");
    }
    if (b.tagName === "A" && b.hash) {
      e.preventDefault();
      const target = $(b.hash);
      if (target) {
        for (const a of document.querySelectorAll(".blue-directory a"))
          a.setAttribute("aria-current", String(a.hash === b.hash));
        target.scrollIntoView({ block: "start", behavior: "instant" });
        target.focus({ preventScroll: true });
      }
    }
  });
  scene("normal");
  window.TEAMS_C = {
    scenes,
    scene,
    state: () => clone(state),
    setMode: (mode) => {
      if (!["hold", "intent"].includes(mode)) throw Error("Invalid mode");
      state.mode = mode;
    },
    complete,
    setRows: (rows) => {
      state.items = clone(rows);
      reconcile(true);
      render();
    },
    setMembers: (rows) => {
      state.members = clone(rows);
      render();
    },
  };
})();
