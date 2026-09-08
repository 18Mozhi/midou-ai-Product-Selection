(() => {
  "use strict";
  const D = window.ORG_APPROVALS_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const statusLabels = {
    pending: "待处理",
    approved: "已通过",
    rejected: "已驳回",
    cancelled: "已取消",
    published: "已发布",
    draft: "草稿",
    archived: "已归档",
  };
  const label = (v) => statusLabels[v] ?? `未知状态（${v || "空"}）`;
  const resource = (v) =>
    ({ task: "业务任务", opportunity_decision: "机会决策" })[v] ?? `未知类型（${v || "空"}）`;
  const time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "尚未完成");
  const scenes = {
    normal: "原始审批记录",
    templates: "原始模板与版本差异",
    request_page_two: "审批第二页",
    request_search: "审批标题搜索",
    request_workspace: "工作区筛选",
    request_resource: "资源筛选",
    request_pending: "待处理筛选",
    request_approved: "已通过筛选",
    request_rejected: "已驳回筛选",
    request_cancelled: "已取消筛选",
    request_empty: "暂无审批记录",
    request_filter_empty: "审批筛选空",
    template_first: "首个持久化版本",
    template_no_diff: "有前版且无差异",
    template_multi_diff: "四字段变更及增删节点",
    template_empty: "暂无模板",
    template_filter_empty: "模板筛选空",
    template_archived: "归档模板",
    template_catalog: "合成八模板分页",
    template_page_two: "模板第二页保留详情",
    template_selected: "选中末页模板",
    template_search: "模板搜索",
    template_workspace: "模板工作区筛选",
    template_resource: "模板资源筛选",
    template_version_sort: "版本号降序",
    template_unknown: "未知模板状态",
    missing_template: "审批模板不可见",
    unknown_request: "未知审批状态与资源",
    summary_gap: "汇总与返回列表差异",
    long_request: "长标题和工作区",
    long_diff: "长节点与前后值",
    zero_sla: "零分钟不是未设置",
    technical_request: "审批技术详情",
    technical_template: "模板技术详情",
    loading: "首次读取",
    error: "服务错误",
    forbidden: "权限拒绝",
    expired: "登录失效",
    rate_limited: "请求频繁",
    refreshing: "刷新中保留事实",
    refresh_error: "刷新失败保留事实",
    hover: "刷新按钮悬停",
    pressed: "刷新按钮按下",
    focus: "筛选焦点",
    controls: "非业务审核工具",
  };
  let state;
  const defaults = (kind) => ({
    query: "",
    status: "all",
    workspace: "all",
    resource: "all",
    sort: kind === "request" ? "created_desc" : "name_asc",
    page: 1,
  });
  function initial() {
    return {
      view: "requests",
      request: defaults("request"),
      template: defaults("template"),
      selected: D.templates[0].id,
      items: clone(D.items),
      templates: clone(D.templates),
      summary: clone(D.summary),
      filtersOpen: innerWidth > 760,
      tools: false,
      pageState: "ready",
      notice: "",
      intents: [],
      scene: "normal",
      provenance:
        "原始 m06-01 夹具：10 条审批、2 个模板，非生产数据。审批阶段与当前模板节点数不强行对齐，历史审批不等于当前模板。",
    };
  }
  function fromURL() {
    const q = new URLSearchParams(location.search),
      text = (k) => (q.get(k) || "").slice(0, 200),
      choice = (k, a, d) => (a.includes(text(k)) ? text(k) : d);
    state.view = choice("approval_view", ["requests", "templates"], "requests");
    for (const k of ["request", "template"]) {
      const f = state[k],
        p = "approval_" + k + "_";
      f.query = text(p + "query");
      f.workspace = text(p + "workspace") || "all";
      f.status = choice(
        p + "status",
        [
          "all",
          ...(k === "request"
            ? ["pending", "approved", "rejected", "cancelled"]
            : ["published", "draft", "archived"]),
        ],
        "all",
      );
      f.resource = choice(p + "resource", ["all", "task", "opportunity_decision"], "all");
      f.sort = choice(
        p + "sort",
        k === "request"
          ? ["created_desc", "created_asc", "title_asc", "status_asc"]
          : ["name_asc", "updated_desc", "nodes_desc", "workspace_asc"],
        f.sort,
      );
      const n = Number(text(p + "page"));
      f.page = Number.isSafeInteger(n) && n > 0 ? n : 1;
    }
  }
  function syncURL() {
    const q = new URLSearchParams(location.search);
    const set = (k, v, d) => (v && String(v) !== String(d) ? q.set(k, String(v)) : q.delete(k));
    set("approval_view", state.view, "requests");
    for (const kind of ["request", "template"])
      for (const key of Object.keys(defaults(kind)))
        set("approval_" + kind + "_" + key, state[kind][key], defaults(kind)[key]);
    history.replaceState(null, "", location.pathname + (q.size ? "?" + q.toString() : ""));
  }
  const templateFor = (r) => state.templates.find((t) => String(t.id) === String(r.template_id));
  function filtered(kind) {
    const f = state[kind],
      q = f.query.trim().toLocaleLowerCase("zh-CN");
    return (kind === "request" ? state.items : state.templates)
      .filter((r) => {
        const t = kind === "request" ? templateFor(r) : r;
        return (
          (!q ||
            (kind === "request"
              ? [r.title, t?.name, t?.workspace_name]
              : [r.name, r.workspace_name]
            )
              .filter(Boolean)
              .some((v) => String(v).toLocaleLowerCase("zh-CN").includes(q))) &&
          (f.status === "all" || r.status === f.status) &&
          (f.workspace === "all" || t?.workspace_name === f.workspace) &&
          (f.resource === "all" || r.resource_type === f.resource)
        );
      })
      .sort((a, b) => {
        if (kind === "request") {
          if (f.sort === "created_asc") return Date.parse(a.created_at) - Date.parse(b.created_at);
          if (f.sort === "title_asc")
            return String(a.title).localeCompare(String(b.title), "zh-CN");
          if (f.sort === "status_asc")
            return label(a.status).localeCompare(label(b.status), "zh-CN");
          return Date.parse(b.created_at) - Date.parse(a.created_at);
        }
        if (f.sort === "updated_desc") return Number(b.current_version) - Number(a.current_version);
        if (f.sort === "nodes_desc") return Number(b.node_count) - Number(a.node_count);
        if (f.sort === "workspace_asc")
          return String(a.workspace_name).localeCompare(String(b.workspace_name), "zh-CN");
        return String(a.name).localeCompare(String(b.name), "zh-CN");
      });
  }
  const size = (k) => (k === "request" ? 8 : 6);
  function reconcile() {
    for (const k of ["request", "template"])
      state[k].page = Math.min(state[k].page, Math.max(1, Math.ceil(filtered(k).length / size(k))));
  }
  const selected = () =>
    filtered("template").find((t) => String(t.id) === state.selected) ?? filtered("template")[0];
  const badge = (s) => `<span class="status" data-status="${esc(s)}">${esc(label(s))}</span>`;
  const options = (items, value) =>
    items
      .map(
        ([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`,
      )
      .join("");
  function filters(kind) {
    const f = state[kind],
      isRequest = kind === "request",
      workspaces = [
        ...new Set(state.templates.map((t) => String(t.workspace_name || "未命名工作区"))),
      ].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const input = (key, title, choices) =>
      `<label for="${kind}-${key}">${title}<select id="${kind}-${key}" data-filter="${key}">${options(choices, f[key])}</select></label>`;
    return `<button class="filter-toggle" id="filters-toggle" aria-expanded="${state.filtersOpen}">${state.filtersOpen ? "收起" : "展开"}筛选与排序</button><div class="filters ${state.filtersOpen ? "open" : ""}"><label for="${kind}-query">${isRequest ? "搜索审批" : "搜索模板"}<input type="search" id="${kind}-query" data-filter="query" value="${esc(f.query)}" placeholder="${isRequest ? "标题、模板或工作区" : "模板名称或工作区"}"></label>${input("status", "状态", [["all", "全部状态"], ...(isRequest ? ["pending", "approved", "rejected", "cancelled"] : ["published", "draft", "archived"]).map((s) => [s, label(s)])])}${input("workspace", "工作区", [["all", "全部工作区"], ...workspaces.map((w) => [w, w])])}${input(
      "resource",
      "资源类型",
      [
        ["all", "全部类型"],
        ["task", "业务任务"],
        ["opportunity_decision", "机会决策"],
      ],
    )}${input(
      "sort",
      "排序",
      isRequest
        ? [
            ["created_desc", "最新提交优先"],
            ["created_asc", "最早提交优先"],
            ["title_asc", "标题 A–Z"],
            ["status_asc", "状态排序"],
          ]
        : [
            ["name_asc", "名称 A–Z"],
            ["updated_desc", "版本号从高到低"],
            ["nodes_desc", "节点数从多到少"],
            ["workspace_asc", "工作区排序"],
          ],
    )}<button id="reset">重置</button></div>`;
  }
  function pager(kind) {
    const f = state[kind],
      count = filtered(kind).length,
      pages = Math.max(1, Math.ceil(count / size(kind)));
    return `<footer class="pager"><small>第 ${f.page} / ${pages} 页</small><div><button data-page="-1" ${f.page <= 1 ? "disabled" : ""}>上一页</button><button data-page="1" ${f.page >= pages ? "disabled" : ""}>下一页</button></div></footer>`;
  }
  const fact = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  function technical(entries) {
    return `<details class="technical"><summary>技术详情</summary>${entries.map(([k, v]) => `<code>${k}：${esc(v)}</code>`).join("")}</details>`;
  }
  function empty(kind) {
    const exists = (kind === "request" ? state.items : state.templates).length;
    return `<div class="empty" role="status"><h3>${exists ? "没有符合条件的" + (kind === "request" ? "审批" : "模板") : kind === "request" ? "暂无组织级审批记录" : "暂无审批模板"}</h3><p>${exists ? "调整筛选条件或重置后再查看。" : kind === "request" ? "业务审批申请提交后显示在这里。" : "模板由对应工作区的审批流程统一维护。"}</p>${exists ? '<button id="clear-filter">清除筛选</button>' : ""}</div>`;
  }
  function requests() {
    const list = filtered("request"),
      visible = list.slice((state.request.page - 1) * 8, state.request.page * 8);
    return `<section class="paper"><div class="paper-head"><h2 tabindex="-1">审批记录</h2><small>当前列表最多最近100条，不代表全量</small></div>${filters("request")}<p class="count">筛选 ${list.length} / 已加载 ${state.items.length} 条；每页8条</p><div class="requests">${visible
      .map((r) => {
        const t = templateFor(r);
        return `<article class="request"><div class="identity"><small>${esc(t?.workspace_name || "未知工作区")} / ${esc(resource(r.resource_type))}</small><h3>${esc(r.title)}</h3>${badge(r.status)}</div><dl class="facts">${fact("使用模板", esc(t?.name || "模板已不可见"))}${fact("当前阶段", `第 ${esc(r.current_node_ordinal)} 阶段`)}</dl><dl class="facts times">${fact("提交时间", esc(time(r.created_at)))}${fact("完成时间", esc(time(r.completed_at)))}</dl>${technical(
          [
            ["审批记录 ID", r.id],
            ["业务资源 ID", r.resource_id],
            ["模板 ID", r.template_id],
          ],
        )}</article>`;
      })
      .join("")}</div>${list.length ? pager("request") : empty("request")}</section>`;
  }
  function diffMarkup(t) {
    const d = t.version_diff;
    if (!d) return '<div class="empty">版本差异数据未返回，不能推断为首版或没有变化。</div>';
    if (!d.from_version) return '<div class="empty">这是首个版本，没有上一持久化版本可比较。</div>';
    if (!d.changes.length)
      return '<div class="empty">节点顺序、审批人、处理时限和超时接收人均未变化。</div>';
    return d.changes
      .map(
        (c) =>
          `<article class="node" data-kind="${esc(c.kind)}"><header><div><span>第 ${esc(c.ordinal)} 节点</span><h4>${esc(c.node_name)}</h4></div><b class="node-kind">${c.kind === "added" ? "新增" : c.kind === "removed" ? "移除" : "变更"}</b></header>${c.kind !== "changed" ? `<p class="muted">当前版本${c.kind === "added" ? "新增" : "已移除"}了这个审批节点。接口未提供该节点的完整配置。</p>` : c.fields.map((f) => `<dl class="field"><dt>${esc(f.label)}</dt><dd><small>变更前</small>${esc(f.before ?? "未设置")}</dd><dd class="after"><small>变更后</small>${esc(f.after ?? "未设置")}</dd></dl>`).join("")}</article>`,
      )
      .join("");
  }
  function templates() {
    const list = filtered("template"),
      visible = list.slice((state.template.page - 1) * 6, state.template.page * 6),
      t = selected();
    return `<section class="paper"><div class="paper-head"><h2>模板版本</h2><small>当前版本与最近的上一持久化版本对照</small></div><p class="template-counts">${["published", "draft", "archived"].map((s) => `${label(s)} ${state.templates.filter((t) => t.status === s).length}`).join("　")}</p>${filters("template")}<p class="count">筛选 ${list.length} / 已返回 ${state.templates.length} 个模板；每页6个</p>${!list.length ? empty("template") : `<div class="browser"><div class="directory" id="directory" tabindex="-1"><ul class="template-list">${visible.map((r) => `<li><button data-select="${esc(r.id)}" aria-pressed="${r.id === t?.id}"><small>${esc(r.workspace_name || "未命名工作区")}</small><b>${esc(r.name)}</b><small>v${esc(r.current_version)} / ${esc(r.node_count)} 个节点 / ${esc(resource(r.resource_type))}</small>${badge(r.status)}</button></li>`).join("")}</ul>${pager("template")}</div><article class="detail" id="detail" tabindex="-1"><button class="back" id="back-directory">返回模板目录</button>${!visible.some((r) => r.id === t.id) ? '<p class="off-page">当前详情不在这一页目录，翻页不会自动切换所选模板。</p>' : ""}<header><div><small>${esc(t.workspace_name || "未命名工作区")}</small><h2>${esc(t.name)}</h2><small>${esc(resource(t.resource_type))}</small></div>${badge(t.status)}</header><dl class="facts">${fact("当前版本", `v${esc(t.current_version)}`)}${fact("模板修订", esc(t.revision))}${fact("当前节点", `${esc(t.node_count)} 个`)}${fact("对比范围", t.version_diff?.from_version ? `v${esc(t.version_diff.from_version)} → v${esc(t.version_diff.to_version)}` : t.version_diff ? "首个持久化版本" : "差异未返回")}</dl><div class="diff-head"><h3>版本变化</h3><small>${esc(t.version_diff?.change_count ?? "未返回")} 个节点变化</small></div>${diffMarkup(t)}${technical([["模板 ID", t.id]])}</article></div>`}</section>`;
  }
  function render() {
    reconcile();
    const kind = state.view === "requests" ? "request" : "template";
    const total = Object.values(state.summary).reduce((a, v) => a + Number(v || 0), 0);
    const terminal = {
      loading: ["正在读取审批治理", "等待接口返回，暂不展示夹具数字。"],
      error: ["审批治理读取失败", "可重新加载；尚未取得新事实。"],
      forbidden: ["无权读取审批治理", "需要对应组织的审批能力；菜单可见不是授权。"],
      expired: ["登录已失效", "请从正式登录入口恢复会话后再读取。"],
      rate_limited: ["请求过于频繁", "等待后再试，不自动重试。"],
    }[state.pageState];
    $("#app").innerHTML =
      `<div class="review"><p>P34 设计审核稿 · 非生产数据</p><button id="tools-toggle" aria-expanded="${state.tools}">审核场景</button></div><div class="review-tools" ${state.tools ? "" : "hidden"}><label for="scene">切换审核场景<select id="scene">${options(Object.entries(scenes), state.scene)}</select></label><p class="muted">只读原型：刷新只记读取意图，导航只记目标；无真实API或写入。</p><pre>${esc(JSON.stringify(state.intents, null, 2))}</pre></div><div class="shell"><aside class="rail"><h2>审批治理</h2><nav aria-label="审批治理视图"><button data-view="requests" aria-pressed="${state.view === "requests"}">审批记录</button><button data-view="templates" aria-pressed="${state.view === "templates"}">模板版本</button></nav><small>组织级只读观察<br>业务决定回到工作区处理</small></aside><main class="main"><header class="heading"><div><h1>审批模板</h1><p>观察流转，核对版本变化</p></div><button id="refresh" class="primary" ${state.pageState === "refreshing" || state.pageState === "loading" ? "disabled" : ""}>${state.pageState === "refreshing" ? "正在刷新" : "刷新数据"}</button></header>${terminal ? `<section class="paper empty" role="status"><h2>${terminal[0]}</h2><p>${terminal[1]}</p>${state.pageState !== "loading" ? '<button id="retry">重新加载</button>' : ""}</section>` : `<div class="summary" aria-label="审批汇总"><span>全量审批 <b>${total}</b></span>${["pending", "approved", "rejected", "cancelled"].map((s) => `<span>${label(s)} <b>${state.summary[s] ?? 0}</b></span>`).join("")}<span>已返回模板 <b>${state.templates.length}</b></span></div>${state.notice ? `<p class="notice ${state.pageState === "refresh_error" ? "error" : ""}" role="status">${esc(state.notice)}</p>` : ""}${kind === "request" ? requests() : templates()}`}<footer class="links"><p>本页不发布、不回退、不作审批决定。</p><a href="/tasks/approvals" data-nav>前往审批工作台</a><a href="/org-admin/audit" data-nav>查看组织审计</a></footer><p class="provenance">${esc(state.provenance)}</p></main></div>`;
    bind(kind);
  }
  function focus(id) {
    const el = $(id);
    el?.focus();
    if (innerWidth <= 760) el?.scrollIntoView({ block: "start" });
  }
  function bind(kind) {
    $("#tools-toggle").onclick = () => {
      state.tools = !state.tools;
      render();
      focus("#tools-toggle");
    };
    $("#scene").onchange = (e) => scene(e.target.value);
    document.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          state.view = b.dataset.view;
          syncURL();
          render();
          focus('[data-view="' + state.view + '"]');
        }),
    );
    const refresh = () => {
      state.intents.push(
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/approvals" },
      );
      state.notice = "已记录两项读取意图；尚未连接后端，保留当前事实与筛选。";
      if (["ready", "refresh_error"].includes(state.pageState)) render();
      else {
        state.tools = true;
        render();
      }
    };
    $("#refresh").onclick = refresh;
    if ($("#retry")) $("#retry").onclick = refresh;
    document.querySelectorAll("[data-nav]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          state.intents.push({ navigation: a.getAttribute("href") });
          state.notice = "导航意图：" + a.textContent + "；不自动切换工作区或指定审批。";
          render();
        }),
    );
    if ($("#filters-toggle"))
      $("#filters-toggle").onclick = () => {
        state.filtersOpen = !state.filtersOpen;
        render();
        focus("#filters-toggle");
      };
    document.querySelectorAll("[data-filter]").forEach((el) =>
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
        const id = el.id,
          pos = el.selectionStart;
        state[kind][el.dataset.filter] = el.value;
        state[kind].page = 1;
        syncURL();
        render();
        const next = $("#" + id);
        next.focus();
        if (next.type === "search") next.setSelectionRange(pos, pos);
      }),
    );
    const reset = () => {
      state.filtersOpen = true;
      state[kind] = defaults(kind);
      syncURL();
      render();
      focus("#" + kind + "-query");
    };
    if ($("#reset")) $("#reset").onclick = reset;
    if ($("#clear-filter")) $("#clear-filter").onclick = reset;
    document.querySelectorAll("[data-page]").forEach(
      (b) =>
        (b.onclick = () => {
          state[kind].page += Number(b.dataset.page);
          syncURL();
          render();
          focus(kind === "template" ? "#directory" : ".paper h2");
        }),
    );
    document.querySelectorAll("[data-select]").forEach(
      (b) =>
        (b.onclick = () => {
          state.selected = b.dataset.select;
          render();
          focus("#detail");
        }),
    );
    if ($("#back-directory")) $("#back-directory").onclick = () => focus("#directory");
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw new Error("Unknown scene");
    state = initial();
    state.scene = name;
    if (!["normal", "templates"].includes(name))
      state.provenance =
        "合成审核状态，非生产响应；基础内容来自原m06-01夹具。扩展模板、差异和故障仅用于设计验证。";
    if (
      name.startsWith("template") ||
      ["long_diff", "zero_sla", "technical_template"].includes(name)
    )
      state.view = "templates";
    if (name === "request_page_two") state.request.page = 2;
    if (name === "request_search") state.request.query = "厨房";
    if (name === "request_workspace") state.request.workspace = "采购协作工作区";
    if (name === "request_resource") state.request.resource = "task";
    for (const s of ["pending", "approved", "rejected", "cancelled"])
      if (name === "request_" + s) state.request.status = s;
    if (name === "request_empty") state.items = [];
    if (name === "request_filter_empty") state.request.query = "未返回的审批";
    if (name === "template_first") state.selected = D.templates[1].id;
    if (["template_no_diff"].includes(name)) state.templates[0].version_diff = clone(D.noDiff);
    if (["template_multi_diff", "long_diff", "zero_sla"].includes(name))
      state.templates[0].version_diff = clone(D.multiDiff);
    if (name === "template_empty") state.templates = [];
    if (name === "template_filter_empty") state.template.query = "未返回的模板";
    if (name === "template_archived") {
      state.templates[0].status = "archived";
      state.template.status = "archived";
    }
    if (
      [
        "template_catalog",
        "template_page_two",
        "template_selected",
        "template_version_sort",
      ].includes(name)
    ) {
      state.templates = Array.from({ length: 8 }, (_, i) => ({
        ...clone(D.templates[i % 2]),
        id: "synthetic-template-" + i,
        name: "治理模板 " + String(i + 1).padStart(2, "0"),
        current_version: i + 1,
        version_diff: { from_version: null, to_version: i + 1, change_count: 0, changes: [] },
      }));
      state.selected = state.templates[0].id;
      if (name === "template_page_two" || name === "template_selected") state.template.page = 2;
      if (name === "template_selected") state.selected = state.templates[7].id;
      if (name === "template_version_sort") state.template.sort = "updated_desc";
    }
    if (name === "template_search") state.template.query = "首次";
    if (name === "template_workspace") state.template.workspace = "采购协作工作区";
    if (name === "template_resource") state.template.resource = "opportunity_decision";
    if (name === "template_unknown") state.templates[0].status = "unrecognized";
    if (name === "missing_template") state.templates = [];
    if (name === "unknown_request") {
      state.items = [state.items[0]];
      state.items[0].status = "unrecognized";
      state.items[0].resource_type = "unrecognized";
    }
    if (name === "summary_gap") state.summary.pending = 123;
    if (name === "long_request") {
      state.items = [state.items[0]];
      state.items[0].title = "跨工作区采购方案与供应商资质的联合复核".repeat(5);
      state.templates[0].workspace_name = "跨区域新品采购协同工作区".repeat(4);
    }
    if (name === "long_diff") {
      state.templates[0].name = "跨工作区采购合规复核模板".repeat(4);
      state.templates[0].version_diff.changes[0].node_name = "长节点名称".repeat(18);
      state.templates[0].version_diff.changes[0].fields[0].before = "原始审核节点完整名称".repeat(
        12,
      );
      state.templates[0].version_diff.changes[0].fields[0].after = "修订审核节点完整名称".repeat(
        12,
      );
    }
    if (
      [
        "loading",
        "error",
        "forbidden",
        "expired",
        "rate_limited",
        "refreshing",
        "refresh_error",
      ].includes(name)
    )
      state.pageState = name;
    if (name === "refreshing") state.notice = "正在读取，以下仍是上次返回的事实。";
    if (name === "refresh_error")
      state.notice = "刷新失败，保留上次事实与筛选；可重试，不表示没有审批。";
    if (name === "controls") state.tools = true;
    syncURL();
    render();
    if (name.startsWith("technical_")) $(".technical").open = true;
    window.scrollTo(0, 0);
  }
  state = initial();
  fromURL();
  render();
  window.ORG_APPROVALS_C = {
    scenes,
    scene,
    state: () => clone(state),
    filtered: (k) => clone(filtered(k)),
    selected: () => clone(selected() ?? null),
  };
})();
