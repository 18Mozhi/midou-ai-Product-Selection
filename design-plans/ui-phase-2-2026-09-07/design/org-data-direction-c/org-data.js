(() => {
  "use strict";
  const D = window.ORG_DATA_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const statuses = {
    active: "正常使用",
    archived: "已归档",
    queued: "等待处理",
    leased: "正在生成",
    retry_scheduled: "等待重试",
    succeeded: "已完成",
    dead_letter: "多次失败",
    expired: "已过期",
  };
  const types = { opportunity: "机会报表", trend: "热点报表", team: "团队报表" };
  const label = (v) => statuses[v] ?? "未知状态（" + (v || "空") + "）",
    type = (v) => types[v] ?? "未知类型（" + (v || "空") + "）";
  const count = (v) => (Number.isFinite(Number(v ?? 0)) && Number(v ?? 0) > 0 ? Number(v) : 0);
  const valid = (v) =>
    v !== null && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0;
  const stamp = (v) => (Number.isFinite(Date.parse(String(v ?? ""))) ? Date.parse(String(v)) : 0);
  const fmt = (v) =>
    v && stamp(v) ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未返回时间";
  const fields = { trends: "热点", opportunities: "机会", tasks: "未删除任务", exports: "导出" };
  const workspaceValue = (r, k) =>
    k === "total" ? Object.keys(fields).reduce((n, k) => n + count(r[k]), 0) : count(r[k]);
  const sorts = {
    workspace: [
      ["total_desc", "记录合计从高到低"],
      ["name_asc", "名称 A–Z"],
      ["trends_desc", "热点从高到低"],
      ["opportunities_desc", "机会从高到低"],
      ["tasks_desc", "任务从高到低"],
      ["exports_desc", "导出从高到低"],
    ],
    export: [
      ["created_desc", "创建时间从新到旧"],
      ["created_asc", "创建时间从旧到新"],
      ["updated_desc", "更新时间从新到旧"],
      ["rows_desc", "导出行数从高到低"],
      ["workspace_asc", "工作区 A–Z"],
    ],
  };
  const scenes = {
    normal: "原始工作区比较",
    exports: "原始导出履历",
    workspace_page_two: "工作区第二页",
    workspace_search: "名称搜索",
    workspace_active: "正常工作区",
    workspace_archived: "归档工作区",
    workspace_empty: "暂无工作区",
    workspace_filter_empty: "工作区筛选空",
    workspace_name_sort: "名称排序",
    workspace_trends_sort: "热点排序",
    workspace_opportunities_sort: "机会排序",
    workspace_tasks_sort: "任务排序",
    workspace_exports_sort: "导出排序",
    workspace_zero: "零记录工作区",
    workspace_missing: "缺失计数不冒充零",
    workspace_unknown: "未知工作区状态",
    export_page_two: "导出第二页",
    export_page_three: "导出第三页",
    export_search: "中文状态搜索",
    export_workspace: "导出工作区筛选",
    export_type: "报表类型筛选",
    export_queued: "等待处理",
    export_leased: "正在生成",
    export_retry_scheduled: "等待重试",
    export_succeeded: "已完成",
    export_dead_letter: "多次失败",
    export_expired: "已过期",
    export_empty: "暂无导出",
    export_filter_empty: "导出筛选空",
    export_zero_null: "原UI2零行与未生成",
    export_rows_sort: "导出行数排序",
    export_unknown: "未知类型与状态",
    technical: "导出技术详情",
    long_workspace: "长工作区名称",
    long_export: "长导出工作区名",
    missing_time: "观测时间未返回",
    loading: "首次读取",
    error: "服务错误",
    forbidden: "权限拒绝",
    expired: "登录失效",
    rate_limited: "请求频繁",
    refreshing: "后台刷新保留事实",
    refresh_error: "刷新失败保留事实",
    hover: "刷新按钮悬停",
    pressed: "刷新按钮按下",
    focus: "筛选输入焦点",
    controls: "非业务审核工具",
  };
  const defaults = (k) =>
    k === "workspace"
      ? { query: "", status: "all", sort: "total_desc", page: 1 }
      : { query: "", workspace: "all", type: "all", status: "all", sort: "created_desc", page: 1 };
  let state;
  function initial() {
    return {
      view: "workspaces",
      workspace: defaults("workspace"),
      export: defaults("export"),
      data: clone(D),
      filtersOpen: innerWidth > 760,
      tools: false,
      pageState: "ready",
      notice: "",
      intents: [],
      scene: "normal",
      provenance:
        "原m06-01夹具：12工作区、23条导出，非生产数据。观测时间早于部分导出时间，原差异保留；本页不推断实时一致性。",
    };
  }
  function readURL() {
    const q = new URLSearchParams(location.search),
      text = (k) => (q.get(k) || "").slice(0, 200),
      choice = (k, a, d) => (a.includes(text(k)) ? text(k) : d);
    state.view = choice("org_data_view", ["workspaces", "exports"], "workspaces");
    for (const k of ["workspace", "export"]) {
      const f = state[k],
        p = "org_data_" + k + "_";
      f.query = text(p + "query");
      f.status = choice(
        p + "status",
        ["all", ...(k === "workspace" ? ["active", "archived"] : Object.keys(statuses).slice(2))],
        "all",
      );
      f.sort = choice(
        p + "sort",
        sorts[k].map((v) => v[0]),
        f.sort,
      );
      const n = Number(text(p + "page"));
      f.page = Number.isSafeInteger(n) && n > 0 ? n : 1;
      if (k === "export") {
        f.workspace = text(p + "workspace") || "all";
        f.type = choice(p + "type", ["all", ...Object.keys(types)], "all");
      }
    }
  }
  function syncURL() {
    const q = new URLSearchParams(location.search),
      set = (k, v, d) => (v && String(v) !== String(d) ? q.set(k, String(v)) : q.delete(k));
    set("org_data_view", state.view, "workspaces");
    for (const k of ["workspace", "export"])
      for (const key of Object.keys(defaults(k)))
        set("org_data_" + k + "_" + key, state[k][key], defaults(k)[key]);
    history.replaceState(null, "", location.pathname + (q.size ? "?" + q.toString() : ""));
  }
  function filtered(k) {
    const f = state[k],
      query = f.query.trim().toLocaleLowerCase("zh-CN");
    return (k === "workspace" ? state.data.comparisons : state.data.exports)
      .filter((r) => {
        const values =
          k === "workspace" ? [r.name] : [r.workspace_name, type(r.report_type), label(r.status)];
        return (
          (!query ||
            values
              .filter(Boolean)
              .some((v) => String(v).toLocaleLowerCase("zh-CN").includes(query))) &&
          (f.status === "all" || r.status === f.status) &&
          (k === "workspace" ||
            ((f.workspace === "all" || r.workspace_name === f.workspace) &&
              (f.type === "all" || r.report_type === f.type)))
        );
      })
      .sort((a, b) => {
        if (k === "workspace") {
          if (f.sort === "name_asc") return String(a.name).localeCompare(String(b.name), "zh-CN");
          const key = f.sort.replace("_desc", "");
          return (
            workspaceValue(b, key) - workspaceValue(a, key) ||
            String(a.name).localeCompare(String(b.name), "zh-CN")
          );
        }
        if (f.sort === "created_asc") return stamp(a.created_at) - stamp(b.created_at);
        if (f.sort === "updated_desc") return stamp(b.updated_at) - stamp(a.updated_at);
        if (f.sort === "rows_desc") return count(b.row_count) - count(a.row_count);
        if (f.sort === "workspace_asc")
          return String(a.workspace_name).localeCompare(String(b.workspace_name), "zh-CN");
        return stamp(b.created_at) - stamp(a.created_at);
      });
  }
  const size = (k) => (k === "workspace" ? 8 : 10);
  function reconcile() {
    for (const k of ["workspace", "export"])
      state[k].page = Math.min(state[k].page, Math.max(1, Math.ceil(filtered(k).length / size(k))));
  }
  const badge = (s) =>
    '<span class="status" data-status="' + esc(s) + '">' + esc(label(s)) + "</span>";
  const options = (arr, v) =>
    arr
      .map(
        ([key, label]) =>
          '<option value="' +
          esc(key) +
          '" ' +
          (key === v ? "selected" : "") +
          ">" +
          esc(label) +
          "</option>",
      )
      .join("");
  function filters(k) {
    const f = state[k],
      select = (key, title, arr) =>
        '<label for="' +
        k +
        "-" +
        key +
        '">' +
        title +
        '<select id="' +
        k +
        "-" +
        key +
        '" data-filter="' +
        key +
        '">' +
        options(arr, f[key]) +
        "</select></label>";
    const workspaceNames = [
      ...new Set(state.data.exports.map((r) => String(r.workspace_name || "未命名工作区"))),
    ].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return (
      '<button class="filter-toggle" id="filters-toggle" aria-expanded="' +
      state.filtersOpen +
      '">' +
      (state.filtersOpen ? "收起" : "展开") +
      '筛选与排序</button><div class="filters ' +
      (k === "export" ? "exports " : "") +
      (state.filtersOpen ? "open" : "") +
      '"><label for="' +
      k +
      '-query">' +
      (k === "workspace" ? "搜索工作区" : "搜索导出") +
      '<input id="' +
      k +
      '-query" type="search" data-filter="query" value="' +
      esc(f.query) +
      '" placeholder="' +
      (k === "workspace" ? "工作区名称" : "工作区、类型或状态") +
      '"></label>' +
      (k === "export"
        ? select("workspace", "工作区", [
            ["all", "全部工作区"],
            ...workspaceNames.map((v) => [v, v]),
          ]) + select("type", "报表类型", [["all", "全部类型"], ...Object.entries(types)])
        : "") +
      select("status", k === "workspace" ? "工作区状态" : "生成状态", [
        ["all", "全部状态"],
        ...(k === "workspace" ? ["active", "archived"] : Object.keys(statuses).slice(2)).map(
          (v) => [v, label(v)],
        ),
      ]) +
      select("sort", "排序", sorts[k]) +
      '<button id="reset">重置筛选</button></div>'
    );
  }
  function totals() {
    return Object.fromEntries(
      Object.keys(fields).map((k) => [
        k,
        state.data.comparisons.reduce((s, r) => s + count(r[k]), 0),
      ]),
    );
  }
  function summary() {
    const t = totals(),
      n = state.data.comparisons.length,
      active = state.data.comparisons.filter((r) => r.status === "active").length,
      archived = state.data.comparisons.filter((r) => r.status === "archived").length;
    return (
      '<div class="summary" aria-label="组织数据汇总"><span>工作区<b>' +
      n +
      "</b><small>" +
      active +
      " 正常 / " +
      archived +
      " 归档</small></span>" +
      Object.entries(fields)
        .map(
          ([k, l]) => "<span>" + l + (k === "exports" ? "全量" : "") + "<b>" + t[k] + "</b></span>",
        )
        .join("") +
      "<span>最近导出<b>" +
      state.data.exports.length +
      "</b></span></div>"
    );
  }
  function pager(k) {
    const n = filtered(k).length,
      p = state[k].page,
      pages = Math.max(1, Math.ceil(n / size(k)));
    return (
      '<footer class="pager" aria-label="' +
      (k === "workspace" ? "工作区分页" : "导出分页") +
      '"><small>第 ' +
      p +
      " / " +
      pages +
      " 页，共 " +
      n +
      (k === "workspace" ? " 个工作区" : " 条导出") +
      '</small><div><button data-page="-1" ' +
      (p <= 1 ? "disabled" : "") +
      '>上一页</button><button data-page="1" ' +
      (p >= pages ? "disabled" : "") +
      ">下一页</button></div></footer>"
    );
  }
  function empty(k) {
    const exists = (k === "workspace" ? state.data.comparisons : state.data.exports).length;
    return (
      '<div class="empty" role="status"><h3>' +
      (exists
        ? "没有匹配的" + (k === "workspace" ? "工作区" : "导出记录")
        : "当前组织暂无" + (k === "workspace" ? "工作区数据" : "导出记录")) +
      "</h3><p>" +
      (exists
        ? "调整条件或清除筛选后再试。"
        : k === "workspace"
          ? "当前未返回可比较的记录。"
          : "新建与下载导出请前往报表工作台。") +
      "</p>" +
      (exists ? '<button id="clear-filter">清除筛选</button>' : "") +
      "</div>"
    );
  }
  function workspaceRows(rows) {
    return (
      '<table class="table" role="table" aria-label="跨工作区数据比较"><caption>合计仅用于排序，不是评分或业务优先级。</caption><thead role="rowgroup"><tr role="row">' +
      ["工作区", ...Object.values(fields), "合计"]
        .map((l) => '<th scope="col" role="columnheader">' + l + "</th>")
        .join("") +
      '</tr></thead><tbody role="rowgroup">' +
      rows
        .map(
          (r) =>
            '<tr role="row" data-workspace="' +
            esc(r.id) +
            '"><th scope="row" role="rowheader">' +
            esc(r.name) +
            badge(r.status) +
            "</th>" +
            Object.entries(fields)
              .map(
                ([k, l]) =>
                  '<td role="cell"><span class="cell-label" aria-hidden="true">' +
                  l +
                  "</span>" +
                  (valid(r[k]) ? count(r[k]) : '<span class="warning">数据不全</span>') +
                  "</td>",
              )
              .join("") +
            '<td role="cell"><span class="cell-label" aria-hidden="true">合计</span>' +
            workspaceValue(r, "total") +
            (Object.keys(fields).some((k) => !valid(r[k])) ? "<small>（含缺失回退）</small>" : "") +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table>"
    );
  }
  function exportRows(rows) {
    return (
      '<div class="history" aria-label="最近导出记录">' +
      rows
        .map(
          (r) =>
            '<article class="export-row" data-export="' +
            esc(r.id) +
            '"><div><small>' +
            esc(type(r.report_type)) +
            "</small><h3>" +
            esc(r.workspace_name || "未命名工作区") +
            "</h3>" +
            badge(r.status) +
            '</div><div class="rows-value"><small>导出行数</small><p>' +
            (r.row_count == null ? "尚未生成" : count(r.row_count) + " 行") +
            '</p></div><dl class="times"><div><dt>创建时间</dt><dd>' +
            esc(fmt(r.created_at)) +
            "</dd></div><div><dt>最近更新</dt><dd>" +
            esc(fmt(r.updated_at)) +
            '</dd></div></dl><details class="technical"><summary>技术详情</summary><code>导出记录 ID：' +
            esc(r.id) +
            "</code></details></article>",
        )
        .join("") +
      "</div>"
    );
  }
  function render() {
    reconcile();
    const k = state.view === "workspaces" ? "workspace" : "export",
      list = filtered(k),
      rows = list.slice((state[k].page - 1) * size(k), state[k].page * size(k)),
      terminal = {
        loading: ["正在读取组织数据", "等待接口返回，不展示占位数字。"],
        error: ["组织数据读取失败", "可重新加载；失败不代表没有记录。"],
        forbidden: ["无权读取组织数据", "需要当前组织对应的报表读取能力。"],
        expired: ["登录已失效", "请从正式登录入口恢复会话后再读取。"],
        rate_limited: ["请求过于频繁", "等待后再试，不自动重试。"],
      }[state.pageState];
    $("#app").innerHTML =
      '<div class="review"><p>P35 设计审核稿 · 非生产数据</p><button id="tools-toggle" aria-expanded="' +
      state.tools +
      '">审核场景</button></div><div class="tools" ' +
      (state.tools ? "" : "hidden") +
      '><label for="scene">切换审核场景<select id="scene">' +
      options(Object.entries(scenes), state.scene) +
      '</select></label><p class="muted">只读原型，无真实API或文件下载。</p><pre>' +
      esc(JSON.stringify(state.intents, null, 2)) +
      '</pre></div><div class="shell"><aside class="rail"><h2>组织数据</h2><nav aria-label="组织数据视图"><button data-view="workspaces" aria-pressed="' +
      (state.view === "workspaces") +
      '">工作区比较</button><button data-view="exports" aria-pressed="' +
      (state.view === "exports") +
      '">导出履历</button></nav><p>当前组织范围<br>数量与生成履历分开核对</p></aside><main class="main"><header class="heading"><div><h1>数据规模与履历</h1><p>观测时间：<time>' +
      esc(terminal ? "等待读取" : fmt(state.data.observed_at)) +
      '</time></p></div><button class="primary" id="refresh" ' +
      (["loading", "refreshing"].includes(state.pageState) ? "disabled" : "") +
      ">" +
      (state.pageState === "refreshing" ? "正在刷新" : "刷新数据") +
      "</button></header>" +
      (terminal
        ? '<section class="paper empty" role="status"><h2>' +
          terminal[0] +
          "</h2><p>" +
          terminal[1] +
          "</p>" +
          (state.pageState !== "loading" ? '<button id="retry">重新加载</button>' : "") +
          "</section>"
        : summary() +
          (state.notice
            ? '<p class="notice ' +
              (state.pageState === "refresh_error" ? "error" : "") +
              '" role="status">' +
              esc(state.notice) +
              "</p>"
            : "") +
          '<section class="paper"><div class="paper-head"><h2 id="list-title" tabindex="-1">' +
          (k === "workspace" ? "工作区比较" : "导出履历") +
          "</h2><small>" +
          (k === "workspace"
            ? "已删除任务不计入；筛选不改变顶部合计"
            : "最近最多100条；文件操作在报表工作台") +
          "</small></div>" +
          filters(k) +
          '<p class="count">筛选 ' +
          list.length +
          " / 已加载 " +
          (k === "workspace" ? state.data.comparisons.length : state.data.exports.length) +
          (k === "workspace" ? " 个工作区" : " 条导出") +
          "；每页" +
          size(k) +
          (k === "workspace" ? "个" : "条") +
          "</p>" +
          (list.length
            ? (k === "workspace" ? workspaceRows(rows) : exportRows(rows)) + pager(k)
            : empty(k)) +
          "</section>") +
      '<aside class="truth" aria-label="数据质量说明"><div><b>数量不等于数据质量</b><p>接口未返回质量规则、缺失率或异常结论。本页不生成质量评分，也不提供文件地址。</p></div><a href="/reports" id="reports">前往报表工作台</a></aside><p class="provenance">' +
      esc(state.provenance) +
      "</p></main></div>";
    bind(k);
  }
  function focus(id) {
    const el = $(id);
    el?.focus();
    if (innerWidth <= 760) el?.scrollIntoView({ block: "start" });
  }
  function bind(k) {
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
        { method: "GET", path: "/org/admin/data" },
      );
      state.notice = "已记录两项读取意图；未连接后端，不改变事实或观测时间。";
      if (!["ready", "refresh_error"].includes(state.pageState)) state.tools = true;
      render();
    };
    $("#refresh").onclick = refresh;
    if ($("#retry")) $("#retry").onclick = refresh;
    $("#reports").onclick = (e) => {
      e.preventDefault();
      state.intents.push({ navigation: "/reports" });
      state.notice = "导航意图：前往报表工作台。不携带文件地址或自动生成报表。";
      render();
    };
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
        state[k][el.dataset.filter] = el.value;
        state[k].page = 1;
        syncURL();
        render();
        const next = $("#" + id);
        next.focus();
        if (next.type === "search") next.setSelectionRange(pos, pos);
      }),
    );
    const reset = () => {
      state[k] = defaults(k);
      state.filtersOpen = true;
      syncURL();
      render();
      focus("#" + k + "-query");
    };
    if ($("#reset")) $("#reset").onclick = reset;
    if ($("#clear-filter")) $("#clear-filter").onclick = reset;
    document.querySelectorAll("[data-page]").forEach(
      (b) =>
        (b.onclick = () => {
          state[k].page += Number(b.dataset.page);
          syncURL();
          render();
          focus("#list-title");
        }),
    );
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown scene");
    state = initial();
    state.scene = name;
    if (!["normal", "exports"].includes(name))
      state.provenance =
        "合成审核状态，非生产数据。基础来自原m06-01夹具；不把故障、缺失或扩展文本当成实际响应。";
    if (
      name === "exports" ||
      name.startsWith("export_") ||
      ["technical", "long_export"].includes(name)
    )
      state.view = "exports";
    if (name === "workspace_page_two") state.workspace.page = 2;
    if (name === "workspace_search") state.workspace.query = "新品决策";
    if (name === "workspace_active") state.workspace.status = "active";
    if (name === "workspace_archived") state.workspace.status = "archived";
    if (name === "workspace_empty") state.data.comparisons = [];
    if (name === "workspace_filter_empty") state.workspace.query = "未返回工作区";
    for (const key of ["name", "trends", "opportunities", "tasks", "exports"])
      if (name === "workspace_" + key + "_sort")
        state.workspace.sort = key + (key === "name" ? "_asc" : "_desc");
    if (
      ["workspace_zero", "workspace_missing", "workspace_unknown", "long_workspace"].includes(name)
    )
      state.data.comparisons = [state.data.comparisons[0]];
    if (name === "workspace_zero")
      for (const key of Object.keys(fields)) state.data.comparisons[0][key] = 0;
    if (name === "workspace_missing") {
      state.data.comparisons[0].trends = null;
      state.notice = "热点计数未返回；顶部合计仍沿现有算法回退0，不是已验证的零记录。";
    }
    if (name === "workspace_unknown") state.data.comparisons[0].status = "unrecognized";
    if (name === "export_page_two") state.export.page = 2;
    if (name === "export_page_three") state.export.page = 3;
    if (name === "export_search") state.export.query = "等待重试";
    if (name === "export_workspace") state.export.workspace = "新品决策工作区";
    if (name === "export_type") state.export.type = "team";
    for (const key of Object.keys(statuses).slice(2))
      if (name === "export_" + key) state.export.status = key;
    if (name === "export_empty") state.data.exports = [];
    if (name === "export_filter_empty") state.export.query = "没有这项导出";
    if (name === "export_zero_null") {
      state.data = clone(D.zeroFixture);
      state.provenance = "原UI2-OG03独立夹具：等待项null与已完成0行，不与原23条履历拼接。";
    }
    if (name === "export_rows_sort") state.export.sort = "rows_desc";
    if (name === "export_unknown") {
      state.data.exports = [state.data.exports[0]];
      state.data.exports[0].status = "unrecognized";
      state.data.exports[0].report_type = "unrecognized";
    }
    if (name === "long_workspace")
      state.data.comparisons[0].name = "跨区域新品采购与合规评估协作工作区".repeat(7);
    if (name === "long_export") {
      state.data.exports = [state.data.exports[0]];
      state.data.exports[0].workspace_name = "跨区域新品采购与合规评估协作工作区".repeat(7);
    }
    if (name === "missing_time") state.data.observed_at = null;
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
    if (name === "refreshing") state.notice = "正在读取；以下仍是上次事实与观测时间。";
    if (name === "refresh_error")
      state.notice = "刷新失败；保留上次事实、观测时间与筛选，可重新尝试。";
    if (name === "controls") state.tools = true;
    syncURL();
    render();
    if (name === "technical") $(".technical").open = true;
    window.scrollTo(0, 0);
  }
  state = initial();
  readURL();
  render();
  window.ORG_DATA_C = {
    scenes,
    scene,
    state: () => clone(state),
    filtered: (k) => clone(filtered(k)),
  };
})();
