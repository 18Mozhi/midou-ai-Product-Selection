(() => {
  "use strict";
  const D = window.WORKSPACES_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    fmt = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "暂无记录"),
    label = (v) => (v === "active" ? "正常使用" : "已归档");
  const scenes = {
    normal: "单条原始夹具",
    catalog: "10条原始治理夹具",
    active: "正常使用筛选",
    archived: "归档筛选",
    search: "名称搜索",
    filter_empty: "筛选无结果仍保留选择",
    empty: "空目录自动展开创建",
    page_two: "第二页",
    selected: "选择非默认工作区",
    restore: "选择已归档工作区",
    missing_default: "默认记录缺失",
    no_default: "没有默认设置",
    long_name: "长名称与标识",
    zero_count: "范围分配数为零",
    missing_count: "成员计数缺失",
    create: "新建工作区",
    create_draft: "创建草稿",
    create_invalid: "非法英文标识",
    create_required: "缺少必填字段",
    create_long: "长度边界",
    create_busy: "创建处理中",
    create_conflict: "标识冲突",
    create_failure: "创建失败留草稿",
    create_success: "合成创建已确认",
    create_read_failed: "写后读取失败",
    create_unknown: "写入结果未确认",
    reason_archive: "归档原因窗",
    reason_restore: "恢复原因窗",
    reason_short: "原因过短",
    reason_long: "长原因",
    action_busy: "原因窗关闭后处理中",
    action_conflict: "状态版本冲突",
    default_conflict: "后端拒绝默认项归档",
    loading: "首次读取",
    error: "服务错误",
    blocked: "服务不可用",
    expired: "登录失效",
    forbidden: "无权限",
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
    returnFocus,
    generation = 0;
  const cleanForm = () => ({ name: "", slug: "", reason: "" });
  function selected() {
    return state.items.find((r) => r.id === state.selectedId);
  }
  function filtered() {
    const q = state.query.trim().toLowerCase();
    return state.items
      .filter(
        (r) =>
          (state.status === "all" || r.status === state.status) &&
          (!q || r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)),
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
    if (!selected())
      state.selectedId =
        state.items.find((r) => r.id === state.defaultId)?.id || state.items[0]?.id || "";
    if (openEmpty && !state.items.length) state.createOpen = true;
    state.page = Math.min(state.page, Math.max(1, Math.ceil(filtered().length / 8)));
  }
  function log(url, method = "GET", body) {
    state.intents.push({ url, method, ...(body === undefined ? {} : { body }) });
    $("#intent-log").textContent = JSON.stringify(state.intents, null, 2);
  }
  function feedback() {
    return state.notice
      ? `<div id="feedback" class="notice" tabindex="-1" data-kind="${state.noticeKind}" role="${state.noticeKind === "error" ? "alert" : "status"}">${esc(state.notice)}</div>`
      : "";
  }
  const badge = (r) =>
    `<span class="badge ${r.status === "archived" ? "archived" : ""}">${label(r.status)}</span>${r.id === state.defaultId ? '<span class="badge default">默认</span>' : ""}`;
  function catalog() {
    const rows = filtered(),
      pages = Math.max(1, Math.ceil(rows.length / 8)),
      active = state.items.filter((r) => r.status === "active").length;
    return `<section id="catalog" class="catalog" tabindex="-1"><h3>选择工作区</h3><div class="tabs" role="group" aria-label="工作区状态">${[
      ["all", "全部", state.items.length],
      ["active", "正常", active],
      ["archived", "归档", state.items.length - active],
    ]
      .map(
        ([key, text, count]) =>
          `<button data-status="${key}" aria-pressed="${state.status === key}">${text} ${count}</button>`,
      )
      .join(
        "",
      )}</div><div class="filter-fields"><label for="query">搜索工作区<input id="query" type="search" value="${esc(state.query)}" placeholder="名称或英文标识" data-filter="query"></label><label for="sort">排序<select id="sort" data-filter="sort">${[
      ["name_asc", "名称升序"],
      ["members_desc", "明确范围成员最多"],
      ["updated_desc", "最近更新"],
    ]
      .map(([k, v]) => `<option value="${k}" ${k === state.sort ? "selected" : ""}>${v}</option>`)
      .join(
        "",
      )}</select></label><button data-reset>重置筛选</button></div><p class="count-note">筛选 ${rows.length} / ${state.items.length} 个；每页8条</p>${
      rows.length
        ? `<ul class="workspace-list">${rows
            .slice((state.page - 1) * 8, state.page * 8)
            .map(
              (r) =>
                `<li><button data-select="${r.id}" aria-pressed="${r.id === state.selectedId}" aria-label="选择工作区 ${esc(r.name)}"><strong>${esc(r.name)}</strong><small>${r.member_count ?? "未提供"} 名明确范围成员；第 ${r.version} 版</small>${badge(r)}</button></li>`,
            )
            .join("")}</ul>`
        : `<div class="empty"><h3>${state.items.length ? "没有符合条件的工作区" : "当前组织还没有工作区"}</h3><p>${state.items.length ? "当前选择仍保留，清除筛选可重新定位。" : "创建首个工作区，为业务数据建立明确边界。"}</p><button ${state.items.length ? "data-reset" : "data-create"}>${state.items.length ? "清除筛选" : "创建工作区"}</button></div>`
    }${pages > 1 ? `<nav class="pagination" aria-label="工作区分页"><button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一页</button><span>${state.page} / ${pages}</span><button data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一页</button></nav>` : ""}</section>`;
  }
  function createForm() {
    const f = state.form,
      lock = state.busy === "create" || state.unresolved;
    return `<form id="create-form" class="create-form" novalidate><header class="create-head"><h2>新建工作区</h2><button id="cancel-create" type="button" ${state.busy === "create" ? "disabled" : ""}>取消</button></header><p class="create-intro">名称用于识别，英文标识用于稳定引用。创建后为正常使用；团队与成员在团队管理中配置。</p>${state.formNotice ? `<div id="form-feedback" class="notice" data-kind="error" tabindex="-1" role="alert">${esc(state.formNotice)}</div>` : ""}<label for="workspace-name">工作区名称</label><input id="workspace-name" name="name" maxlength="120" value="${esc(f.name)}" required ${lock ? "disabled" : ""} aria-invalid="${!!state.errors.name}" aria-describedby="name-error"><small id="name-error" class="field-error">${esc(state.errors.name || "")}</small><label for="workspace-slug">英文标识</label><input id="workspace-slug" name="slug" maxlength="63" pattern="^[a-z0-9](?:[a-z0-9&#92;-]{0,61}[a-z0-9])?$" value="${esc(f.slug)}" required autocomplete="off" autocapitalize="none" spellcheck="false" ${lock ? "disabled" : ""} aria-invalid="${!!state.errors.slug}" aria-describedby="slug-help slug-error"><small id="slug-help">1–63位小写字母、数字或连字符；首尾不能是连字符。</small><small id="slug-error" class="field-error">${esc(state.errors.slug || "")}</small><label for="workspace-reason">创建原因</label><textarea id="workspace-reason" name="reason" maxlength="500" required ${lock ? "disabled" : ""} aria-invalid="${!!state.errors.reason}" aria-describedby="reason-error">${esc(f.reason)}</textarea><small id="reason-error" class="field-error">${esc(state.errors.reason || "")}</small><footer><button id="create-submit" class="primary" ${state.busy || state.unresolved ? "disabled" : ""}>${state.busy === "create" ? "正在创建…" : "创建并写入审计"}</button><p>本审核稿只记录意图，不创建真实工作区或审计记录。</p></footer></form>`;
  }
  function detail() {
    const r = selected();
    return `<section id="detail" class="detail" tabindex="-1"><a class="mobile-return" href="#catalog">返回目录</a>${state.createOpen ? createForm() : r ? `<header class="detail-head"><h2>${esc(r.name)}</h2>${badge(r)}</header>${!filtered().some((i) => i.id === r.id) ? '<p class="notice">当前选择不在筛选结果中，以下仍是所选工作区的事实。</p>' : ""}${r.id === state.defaultId ? '<section class="default-note"><h3>组织默认工作区</h3><p>先在组织资料更换默认项，才能归档当前工作区。</p></section>' : ""}<dl><div><dt>明确范围成员</dt><dd>${r.member_count ?? "未提供"}${r.member_count == null ? "" : " 人"}</dd></div><div><dt>当前版本</dt><dd>第 ${r.version} 版</dd></div><div><dt>创建时间</dt><dd>${fmt(r.created_at)}</dd></div><div><dt>最近更新</dt><dd>${fmt(r.updated_at)}</dd></div></dl><section class="impact"><h3>${r.status === "active" ? "归档会发生什么" : "恢复会发生什么"}</h3><ul>${r.status === "active" ? "<li>停止将该工作区作为新的业务上下文。</li><li>历史任务、证据、审计与导出不会删除。</li><li>需要原因与当前版本校验。</li>" : "<li>成员可在授权范围内重新选择该工作区。</li><li>不会自动恢复已移除的成员或团队关系。</li><li>恢复原因和新版本进入组织审计。</li>"}</ul></section><div class="detail-actions"><button id="state-action" class="${r.status === "active" ? "danger" : ""}" ${state.busy || (r.status === "active" && r.id === state.defaultId) ? "disabled" : ""}>${r.status === "active" ? (r.id === state.defaultId ? "默认工作区不可归档" : "归档工作区") : "恢复工作区"}</button><a href="/org-admin/teams" data-route>管理团队与成员</a><a href="/org-admin" data-route>修改默认工作区</a></div><details id="technical"><summary>技术详情</summary><code>工作区 ID：${esc(r.id)}\n英文标识：${esc(r.slug)}</code></details>` : '<div class="empty"><h3>选择一个工作区查看治理详情</h3></div>'}</section>`;
  }
  function render() {
    reconcile();
    const titles = {
      loading: "正在读取工作区…",
      error: "工作区读取失败",
      blocked: "服务暂不可用",
      expired: "登录已失效",
      forbidden: "无权管理当前组织工作区",
      rate_limited: "请求过于频繁",
    };
    $("#workspace").innerHTML =
      `<header class="page-head"><div><h2>工作区治理</h2><p>核对数据范围，再创建或调整工作区状态。</p></div><div class="head-actions"><button id="refresh" ${state.busy || state.pageState === "loading" ? "disabled" : ""}>${state.busy === "refresh" ? "正在刷新…" : "刷新数据"}</button>${state.pageState === "ready" ? `<button class="primary" data-create ${state.busy ? "disabled" : ""}>新建工作区</button>` : ""}</div></header>${feedback()}${state.pageState === "ready" ? `<div class="summary-strip"><span>已加载 <b>${state.items.length}</b> 个</span><span>正常 <b>${state.items.filter((r) => r.status === "active").length}</b> 个</span><span>归档 <b>${state.items.filter((r) => r.status === "archived").length}</b> 个</span><span>明确范围分配 <b>${state.items.some((r) => r.member_count == null) ? "数据不全" : state.items.reduce((n, r) => n + Number(r.member_count ?? 0), 0)}</b>${state.items.some((r) => r.member_count == null) ? "" : " 次"}</span></div><div class="governance">${catalog()}${detail()}</div><p class="provenance">${esc(state.provenance)} 范围分配合计不是组织去重人数。</p>` : `<div class="empty"><h3>${titles[state.pageState]}</h3>${state.pageState === "loading" ? "" : '<button id="retry">重新加载</button>'}</div>`}`;
    $("#scene-picker").value = state.scene;
    $("#create-form")?.addEventListener("submit", submitCreate);
    $("#create-form")?.addEventListener("input", (e) => {
      if (e.target.name) state.form[e.target.name] = e.target.value;
    });
  }
  function focus(target) {
    $(target)?.focus();
  }
  function openCreate() {
    if (state.busy) return;
    state.createOpen = true;
    render();
    focus("#workspace-name");
  }
  function cancelCreate() {
    if (state.busy === "create") return;
    state.createOpen = false;
    state.form = cleanForm();
    state.errors = {};
    state.formNotice = "";
    state.unresolved = false;
    render();
    focus("[data-create]");
  }
  function submitCreate(e) {
    e.preventDefault();
    if (state.busy || state.unresolved) return;
    const f = Object.fromEntries(Object.entries(state.form).map(([k, v]) => [k, v.trim()]));
    state.errors = {};
    if (!f.name || f.name.length > 120) state.errors.name = "填写1–120个字符的工作区名称。";
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(state.form.slug))
      state.errors.slug = "使用小写字母、数字或连字符，首尾不能是连字符。";
    if (!f.reason || f.reason.length > 500) state.errors.reason = "填写1–500个字符的创建原因。";
    if (Object.keys(state.errors).length) {
      render();
      focus("#workspace-" + Object.keys(state.errors)[0]);
      return;
    }
    log("/org/admin/workspaces", "POST", f);
    if (state.mode === "hold") {
      state.pending = { kind: "create", form: f, token: ++generation };
      state.busy = "create";
    } else state.formNotice = "仅记录创建意图，尚未创建工作区。";
    render();
    focus("#form-feedback");
  }
  function openReason() {
    const r = selected();
    if (!r || state.busy || (r.id === state.defaultId && r.status === "active")) return;
    returnFocus = document.activeElement;
    state.dialog = clone(r);
    const title = r.status === "active" ? "归档工作区" : "恢复工作区";
    $("#reason-title").textContent = title + "原因";
    $("#reason-target").innerHTML =
      `<strong>${esc(r.name)}</strong><p>${r.status === "active" ? "停止新的业务使用，保留历史任务、证据、审计与导出。" : "恢复授权范围内的使用，不自动恢复已移除的成员或团队。"}</p><p>第 ${r.version} 版；明确范围成员 ${r.member_count ?? "未提供"}。</p>`;
    $("#reason-input").value = title;
    $("#reason-confirm").disabled = false;
    $("#reason-dialog").showModal();
    $("#reason-dialog").scrollTop = 0;
    focus("#reason-input");
  }
  function closeReason() {
    state.dialog = null;
    $("#reason-dialog").close();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  function submitReason(e) {
    e.preventDefault();
    const reason = $("#reason-input").value.trim();
    if (!state.dialog || reason.length < 2 || reason.length > 500) return;
    const r = clone(state.dialog),
      action = r.status === "active" ? "archive" : "restore";
    closeReason();
    log(`/org/admin/workspaces/${r.id}/actions`, "POST", {
      action,
      expected_version: r.version,
      reason,
    });
    if (state.mode === "hold") {
      state.pending = { kind: "action", token: ++generation };
      state.busy = "action";
    } else state.notice = "仅记录状态变更意图；原工作区事实保持不变。";
    render();
    focus("#feedback");
  }
  function complete(outcome, token = state.pending?.token) {
    const p = state.pending;
    if (!p || p.token !== token) return false;
    state.pending = null;
    state.busy = "";
    if (p.kind === "create") {
      if (outcome === "success") {
        state.form = cleanForm();
        state.createOpen = false;
        state.notice = "合成创建响应已确认；列表尚未重读，仍显示原始工作区。";
      } else {
        state.form = clone(p.form);
        state.formNotice =
          outcome === "read_failed"
            ? "合成写响应已确认，但列表重读失败；先刷新核验，不重复创建。"
            : outcome === "unknown"
              ? "合成写入结果未确认；先刷新核验，不重复创建。"
              : "合成创建失败：核对名称与英文标识后再试。";
        state.unresolved = ["read_failed", "unknown"].includes(outcome);
      }
    } else
      state.notice =
        outcome === "success"
          ? "合成状态写响应已确认；列表尚未重读，仍显示原状态。"
          : "合成操作失败：请刷新核验当前版本。重新开窗回到默认原因。";
    if (outcome === "forbidden") {
      state.pageState = "forbidden";
      state.notice = "合成403：当前组织访问被拒绝，不能以按钮存在当作权限。";
    }
    state.noticeKind = outcome === "success" ? "info" : "error";
    render();
    focus(state.createOpen && state.pageState === "ready" ? "#form-feedback" : "#feedback");
    return true;
  }
  function scene(name) {
    if (!(name in scenes)) throw Error("Unknown scene");
    if ($("#reason-dialog").open) $("#reason-dialog").close();
    generation++;
    state = {
      items: clone(D.workspaces),
      defaultId: D.summary.organization.default_workspace_id,
      selectedId: "",
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
      busy: "",
      pending: null,
      dialog: null,
      unresolved: false,
      mode: "intent",
      pageState: "ready",
      scene: name,
      intents: [],
      provenance: "原始单条夹具；摘要8工作区与列表1条差异保留，缺失时间不补造。",
    };
    if (
      [
        "catalog",
        "active",
        "archived",
        "search",
        "filter_empty",
        "page_two",
        "selected",
        "restore",
        "reason_archive",
        "reason_restore",
        "reason_short",
        "reason_long",
        "action_busy",
        "action_conflict",
      ].includes(name)
    ) {
      state.items = clone(D.workspaceRows);
      state.provenance = "原E2E十条治理夹具，与单条基线独立，不是生产当前数据。";
    }
    if (!["normal", "catalog", "technical", "controls"].includes(name))
      state.provenance = "合成审核场景；不代表真实工作区、权限或写入结果。";
    if (name === "active") state.status = "active";
    if (name === "archived") state.status = "archived";
    if (name === "search") state.query = "区域工作区 9";
    if (name === "filter_empty") state.query = "不存在";
    if (name === "empty") {
      state.items = [];
      state.createOpen = true;
    }
    if (name === "page_two") state.page = 2;
    if (
      [
        "selected",
        "reason_archive",
        "reason_short",
        "reason_long",
        "action_busy",
        "action_conflict",
      ].includes(name)
    )
      state.selectedId = D.workspaceRows[1].id;
    if (["restore", "reason_restore"].includes(name)) state.selectedId = D.workspaceRows[9].id;
    if (name === "missing_default") {
      state.defaultId = "missing-id";
      state.notice = "默认工作区记录不在本次列表中；请在组织资料核验。";
    }
    if (name === "no_default") state.defaultId = null;
    if (name === "long_name") {
      state.items[0].name = "跨境新品数据证据核验与采购协作工作区".repeat(4);
      state.items[0].slug = "long-workspace";
    }
    if (name === "zero_count") state.items[0].member_count = 0;
    if (name === "missing_count") delete state.items[0].member_count;
    if (name.startsWith("create") || ["hover", "pressed", "focus"].includes(name)) {
      state.createOpen = true;
      state.form = clone(D.contracts.create.body);
    }
    if (name === "create") state.form = cleanForm();
    if (name === "create_invalid") {
      state.form.slug = "Invalid Slug";
      state.errors.slug = "使用小写字母、数字或连字符，首尾不能是连字符。";
    }
    if (name === "create_required") {
      state.form = cleanForm();
      state.errors = { name: "填写工作区名称。", slug: "填写英文标识。", reason: "填写创建原因。" };
    }
    if (name === "create_long") {
      state.form = {
        name: "名称".repeat(60),
        slug: "a".repeat(63),
        reason: "核验创建边界。".repeat(50),
      };
    }
    if (name === "create_busy") state.busy = "create";
    if (
      ["create_conflict", "create_failure", "create_read_failed", "create_unknown"].includes(name)
    ) {
      state.formNotice = {
        create_conflict: "合成409：英文标识已存在，请更换标识。",
        create_failure: "合成创建失败，草稿保留。",
        create_read_failed: "合成写响应已确认，但列表重读失败；先刷新核验，不重复创建。",
        create_unknown: "合成写入结果未确认；先刷新核验，不重复创建。",
      }[name];
      state.unresolved = ["create_read_failed", "create_unknown"].includes(name);
    }
    if (name === "create_success") {
      state.createOpen = false;
      state.form = cleanForm();
      state.notice = "合成创建已确认；列表尚未重读，不补造新记录。";
    }
    if (name === "action_busy") state.busy = "action";
    if (name === "action_conflict") {
      state.notice = "合成409：工作区版本已变化，请刷新后重新核验。";
      state.noticeKind = "error";
    }
    if (name === "default_conflict") {
      state.notice = "合成409：默认工作区不可归档，请先在组织资料更换。";
      state.noticeKind = "error";
    }
    if (["loading", "error", "blocked", "expired", "forbidden", "rate_limited"].includes(name))
      state.pageState = name;
    if (name === "refreshing") state.busy = "refresh";
    if (name === "refresh_error") {
      state.notice = "合成刷新失败；上次工作区和创建草稿保持不变。";
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
      openReason();
      if (name === "reason_short") {
        $("#reason-input").value = "短";
        $("#reason-confirm").disabled = true;
      }
      if (name === "reason_long")
        $("#reason-input").value = "归档前核验数据范围，保留历史业务事实。".repeat(20);
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
    state[n.dataset.filter] = n.value;
    state.page = 1;
    render();
    focus("#" + n.id);
    if (pos != null) $("#" + n.id).setSelectionRange(pos, pos);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-create")) openCreate();
    if (b.id === "cancel-create") cancelCreate();
    if (b.id === "state-action") openReason();
    if (b.dataset.select) {
      state.selectedId = b.dataset.select;
      render();
      focus("#detail");
    }
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
      log("/org/admin/summary");
      log("/org/admin/workspaces");
      state.notice = "仅记录读取意图；未访问服务，工作区与草稿保持不变。";
      render();
      focus("#feedback");
    }
    if (b.hasAttribute("data-route")) {
      e.preventDefault();
      log(b.getAttribute("href"), "NAVIGATE");
      state.notice = "导航意图已记录，本稿不冒充目标页面已实现。";
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
  window.WORKSPACES_C = {
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
  };
})();
