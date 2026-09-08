(() => {
  "use strict";
  const D = window.ORG_AUDIT_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    action = (v) => D.actionLabels[v] ?? "组织审计操作",
    resource = (v) => D.resourceLabels[v] ?? `其他对象（${v || "未标识"}）`,
    outcome = (v) => D.outcomeLabels[v] ?? `未知结果（${v || "未标识"}）`,
    fmt = (v) =>
      Number.isFinite(Date.parse(v))
        ? new Date(v).toLocaleString("zh-CN", { hour12: false })
        : "未返回有效时间",
    defaults = () => ({
      action: "",
      outcome: "",
      resource_type: "",
      request_id: "",
      trace_id: "",
      occurred_from: "",
      occurred_to: "",
    }),
    keys = {
      action: "action",
      outcome: "outcome",
      resource_type: "resource",
      request_id: "request",
      trace_id: "trace",
      occurred_from: "from",
      occurred_to: "to",
    },
    scenes = {
      normal: "原始首批50条",
      selected: "选中失败记录",
      loaded_all: "原始55条已加载",
      local_failed: "已加载失败搜索",
      local_trace: "已加载追踪搜索",
      local_empty: "页内无匹配",
      local_space: "空格搜索",
      exact_draft: "精确条件未应用",
      exact_applied: "精确条件合成响应",
      advanced: "高级追踪与时间",
      range_error: "时间范围错误",
      filter_busy: "查询处理中",
      filter_failure: "查询失败保留旧事实",
      filter_empty: "精确查询空",
      more_busy: "加载更多处理中",
      more_failure: "加载更多失败",
      system_collapsed: "40连接与10业务独立夹具",
      system_expanded: "连接记录展开",
      system_search: "搜索直接展示连接",
      system_exact: "精确动作展示连接",
      system_only: "只有连接记录",
      empty: "暂无记录",
      unknown: "未知动作对象结果",
      metadata_nested: "嵌套键名脱敏",
      metadata_deep: "层级过深截断",
      metadata_array: "数组100项上限",
      metadata_limit: "非敏感键值检测边界",
      metadata_missing: "上下文未返回",
      long_ids: "长请求与追踪号",
      missing_ids: "请求追踪未返回",
      technical: "技术详情",
      request_copied: "请求ID复制成功",
      trace_copied: "追踪ID复制成功",
      copy_failed: "复制被拒绝",
      late_copy: "旧复制结果被隔离",
      late_page: "旧页响应被隔离",
      auditor: "审计员只读范围",
      loading: "首次读取",
      error: "服务错误",
      offline: "网络不可用",
      timeout: "请求超时",
      forbidden: "权限拒绝",
      expired: "登录失效",
      rate_limited: "请求频繁",
      refreshing: "后台刷新保留事实",
      refresh_error: "后台刷新失败",
      hover: "应用按钮悬停",
      pressed: "应用按钮按下",
      focus: "页内搜索焦点",
      controls: "非业务审核工具",
    };
  let state,
    generation = 0,
    serial = 0,
    copySerial = 0;
  function local(v) {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(+d)
      ? ""
      : new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function iso(v) {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(+d) ? "" : d.toISOString();
  }
  function sanitize(v, depth = 0) {
    if (depth > 8) return "[层级过深]";
    if (Array.isArray(v)) return v.slice(0, 100).map((n) => sanitize(n, depth + 1));
    if (!v || typeof v !== "object") return v ?? {};
    return Object.fromEntries(
      Object.entries(v).map(([k, n]) => [
        k,
        /(password|secret|token|cookie|authorization|credential|private.?key)/i.test(k)
          ? "[已脱敏]"
          : sanitize(n, depth + 1),
      ]),
    );
  }
  function initial() {
    return {
      scene: "normal",
      dataset: clone(D.events),
      events: clone(D.events.slice(0, 50)),
      nextCursor: D.events[49].id,
      draft: defaults(),
      requested: defaults(),
      facts: defaults(),
      query: "",
      selected: D.events[0].id,
      systemOpen: false,
      filtersOpen: innerWidth > 760,
      advanced: false,
      tools: false,
      busy: false,
      pending: null,
      mode: "intent",
      pageState: "ready",
      validation: "",
      notice: "",
      noticeKind: "info",
      copy: {},
      intents: [],
      active: true,
      provenance: "原始m06-01的55条审计夹具，首批50条；非生产记录，不是全库总数。",
    };
  }
  function searched() {
    const q = state.query.trim().toLocaleLowerCase("zh-CN");
    return state.events.filter(
      (e) =>
        !q ||
        [
          action(e.action),
          e.action,
          resource(e.resource_type),
          e.resource_type,
          outcome(e.outcome),
          e.request_id,
          e.trace_id,
        ].some((v) =>
          String(v ?? "")
            .toLocaleLowerCase("zh-CN")
            .includes(q),
        ),
    );
  }
  function visible() {
    return searched().filter(
      (e) =>
        state.systemOpen ||
        state.query.trim() ||
        state.facts.action.trim() ||
        e.action !== "realtime.connected",
    );
  }
  function selected() {
    const v = visible();
    return v.find((e) => e.id === state.selected) ?? v[0] ?? null;
  }
  function reconcile() {
    state.selected = selected()?.id ?? "";
  }
  function pathFor(filters, cursor = "") {
    const q = new URLSearchParams({ limit: "50" });
    for (const [k, v] of Object.entries(filters)) {
      if (String(v).trim()) q.set(k, String(v).trim());
    }
    if (cursor) q.set("cursor", cursor);
    return `/organizations/${D.events[0].organization_id}/audit-events?${q}`;
  }
  function syncURL() {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(state.requested)) {
      if (v) q.set("org_audit_" + keys[k], v);
      else q.delete("org_audit_" + keys[k]);
    }
    for (const [k, v] of [
      ["query", state.query],
      ["selected", state.selected],
    ]) {
      if (v) q.set("org_audit_" + k, v);
      else q.delete("org_audit_" + k);
    }
    history.replaceState(null, "", location.pathname + (q.size ? "?" + q.toString() : ""));
  }
  function focus(s) {
    const n = $(s);
    n?.focus({ preventScroll: true });
    if (innerWidth <= 760) n?.scrollIntoView({ block: "start" });
  }
  function invalidate() {
    generation++;
    resetCopy();
  }
  function resetCopy() {
    copySerial++;
    state.copy = {};
  }
  function filteredDataset(f) {
    return state.dataset.filter((e) =>
      Object.entries(f).every(
        ([k, v]) =>
          !v ||
          (k === "occurred_from"
            ? Date.parse(e.occurred_at) >= Date.parse(v)
            : k === "occurred_to"
              ? Date.parse(e.occurred_at) <= Date.parse(v)
              : String(e[k]) === v),
      ),
    );
  }
  const stale = () => JSON.stringify(state.requested) !== JSON.stringify(state.facts);
  function begin(kind, filters = state.requested) {
    if (state.busy) return false;
    if (kind === "more" && (stale() || !state.nextCursor || state.query)) {
      state.notice = "先完成当前查询并清空页内搜索，再加载后续记录。";
      render();
      return false;
    }
    const cursor = kind === "more" ? state.nextCursor : "";
    state.requested = clone(filters);
    if (kind !== "more") {
      invalidate();
      state.selected = "";
    }
    state.intents.push({ method: "GET", path: pathFor(filters, cursor) });
    state.notice = "仅记录读取意图，未连接API；列表仍为上次已读取事实。";
    state.noticeKind = "info";
    if (state.mode === "hold") {
      state.busy = true;
      state.pending = { id: ++serial, generation, kind, filters: clone(filters), cursor };
    }
    syncURL();
    render();
    return true;
  }
  function complete(result, id = state.pending?.id) {
    const p = state.pending;
    if (!p || p.id !== id) return false;
    state.pending = null;
    state.busy = false;
    if (p.generation !== generation || !state.active) return false;
    if (result === "success") {
      const filtered = filteredDataset(p.filters),
        start = p.cursor ? filtered.findIndex((e) => e.id === p.cursor) + 1 : 0;
      if (p.cursor && start === 0) {
        state.notice = "游标不属于当前合成结果，请重新读取第一页。";
        state.noticeKind = "error";
        render();
        return true;
      }
      const items = filtered.slice(start, start + 50);
      state.events = p.kind === "more" ? [...state.events, ...clone(items)] : clone(items);
      state.nextCursor = filtered.length > start + 50 ? items.at(-1).id : null;
      state.facts = clone(p.filters);
      state.pageState = "ready";
      state.notice = "合成读取响应已展示；不代表生产审计结果。";
      state.noticeKind = "info";
      reconcile();
      syncURL();
    } else {
      state.notice = "读取失败，保留上次列表与查询范围；不把失败当作无记录。";
      state.noticeKind = "error";
    }
    render();
    return true;
  }
  function apply() {
    if (state.busy) return;
    state.validation = "";
    const f = Object.fromEntries(
      Object.entries(state.draft).map(([k, v]) => [
        k,
        k.startsWith("occurred_") ? iso(v) : String(v).trim(),
      ]),
    );
    if (
      f.occurred_from &&
      f.occurred_to &&
      Date.parse(f.occurred_from) > Date.parse(f.occurred_to)
    ) {
      state.validation = "开始时间不能晚于结束时间。";
      state.advanced = true;
      state.filtersOpen = true;
      render();
      focus("#filter-occurred_from");
      return;
    }
    begin("apply", f);
  }
  function choose(id) {
    resetCopy();
    state.selected = id;
    reconcile();
    syncURL();
    render();
    focus("#detail-title");
  }
  function badge(e) {
    return (
      '<span class="badge" data-outcome="' +
      esc(e.outcome) +
      '">' +
      esc(outcome(e.outcome)) +
      "</span>"
    );
  }
  function serverForm() {
    if (!["ready", "refreshing", "refresh_error"].includes(state.pageState))
      return '<aside class="rail"><h2>组织审计</h2><p>当前组织只读追踪。恢复读取后再显示筛选与记录。</p></aside>';
    const f = state.draft,
      disabled = state.busy ? "disabled" : "",
      input = (k, label, max = 128, type = "text") =>
        '<label for="filter-' +
        k +
        '">' +
        label +
        '<input id="filter-' +
        k +
        '" data-filter="' +
        k +
        '" type="' +
        type +
        '" ' +
        (type === "text" ? 'maxlength="' + max + '"' : "") +
        ' value="' +
        esc(f[k]) +
        '" ' +
        (state.validation && k.startsWith("occurred_")
          ? 'aria-invalid="true" aria-describedby="range-error"'
          : "") +
        "></label>";
    return (
      '<aside class="rail"><h2>组织审计</h2><p>精确查询当前组织的操作记录</p><button class="filter-toggle" id="filters-toggle" aria-expanded="' +
      state.filtersOpen +
      '" aria-controls="server-form">' +
      (state.filtersOpen ? "收起" : "展开") +
      '服务端筛选</button><form id="server-form" class="server-form ' +
      (state.filtersOpen ? "open" : "") +
      '" novalidate>' +
      input("action", "操作代码（精确）") +
      '<label for="filter-outcome">执行结果<select id="filter-outcome" data-filter="outcome">' +
      [["", "全部结果"], ...Object.entries(D.outcomeLabels)]
        .map(
          ([k, v]) =>
            '<option value="' +
            k +
            '" ' +
            (f.outcome === k ? "selected" : "") +
            ">" +
            v +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      input("resource_type", "对象类型（精确）", 80) +
      '<details id="advanced" ' +
      (state.advanced ? "open" : "") +
      '><summary>高级追踪与时间</summary><div class="advanced-fields">' +
      input("request_id", "请求 ID（精确）") +
      input("trace_id", "追踪 ID（精确）") +
      input("occurred_from", "开始时间", 0, "datetime-local") +
      input("occurred_to", "结束时间", 0, "datetime-local") +
      "</div></details>" +
      (state.validation
        ? '<p id="range-error" class="validation" role="alert">' + state.validation + "</p>"
        : "") +
      '<footer><button class="apply" id="apply" ' +
      disabled +
      ">" +
      (state.busy ? "正在查询…" : "应用筛选") +
      '</button><button type="button" id="reset" ' +
      disabled +
      ">重置全部筛选</button></footer><p>固定按发生时间从新到旧。筛选不会修改或删除审计事实。</p></form></aside>"
    );
  }
  function timeline() {
    const list = visible(),
      hidden = searched().filter((e) => e.action === "realtime.connected").length;
    return (
      '<section class="timeline" aria-labelledby="timeline-title"><header class="timeline-header"><h2 id="timeline-title" tabindex="-1">操作时间线</h2><small>当前可见 ' +
      list.length +
      " / 已加载 " +
      state.events.length +
      ' 条</small><div class="loaded-search"><label for="loaded-query">仅搜索已加载记录<input id="loaded-query" type="search" maxlength="160" value="' +
      esc(state.query) +
      '" placeholder="操作、对象类型、请求或追踪号"></label>' +
      (state.query
        ? '<div class="actions"><button id="clear-query">清空页内搜索</button></div>'
        : "") +
      '</div></header><div class="scroll-list" id="event-scroll">' +
      (hidden && !state.query.trim() && !state.facts.action.trim()
        ? '<button id="system" class="system" aria-expanded="' +
          state.systemOpen +
          '" aria-controls="event-list"><span>系统连接记录 ' +
          hidden +
          " 条</span><b>" +
          (state.systemOpen ? "收起" : "展开") +
          "</b></button>"
        : "") +
      '<ul id="event-list" class="event-list">' +
      list
        .map(
          (e) =>
            '<li><button class="event-row" data-event="' +
            esc(e.id) +
            '" aria-pressed="' +
            (selected()?.id === e.id) +
            '"><span class="event-top"><strong>' +
            esc(action(e.action)) +
            "</strong>" +
            badge(e) +
            "</span><small>" +
            esc(resource(e.resource_type)) +
            " · " +
            esc(fmt(e.occurred_at)) +
            "</small><code>" +
            esc(e.action) +
            "</code></button></li>",
        )
        .join("") +
      "</ul>" +
      (!list.length
        ? '<div class="empty"><h3>' +
          (state.events.length
            ? hidden
              ? "业务记录为空，连接事实仍保留"
              : "当前已加载记录中无匹配"
            : Object.values(state.facts).some(Boolean)
              ? "当前精确条件没有记录"
              : "当前组织暂无审计记录") +
          "</h3><p>" +
          (hidden
            ? "展开系统连接记录查看，不代表需要处理或可以删除。"
            : "页内搜索不查询数据库；可清空搜索或调整精确条件。") +
          "</p></div>"
        : "") +
      '</div><footer class="timeline-footer"><small>' +
      (state.nextCursor ? "仍有后续记录，游标不存入URL。" : "已到当前响应结果末尾。") +
      "</small>" +
      (state.nextCursor && !state.query
        ? '<button id="more" ' +
          (state.busy || stale() ? "disabled" : "") +
          ">" +
          (state.busy ? "正在加载…" : "加载更多记录") +
          "</button>"
        : "") +
      (state.query && state.nextCursor
        ? "<small>页内搜索期间不加载更多；清空后继续。</small>"
        : "") +
      (stale() ? "<small>新条件尚未读成功，暂停旧游标，避免混合不同查询。</small>" : "") +
      "</footer></section>"
    );
  }
  function detail() {
    const e = selected();
    if (!e)
      return '<aside class="detail empty"><h2>选择一条记录查看详情</h2><p>没有可见记录时不保留旧详情。</p></aside>';
    return (
      '<aside class="detail" aria-labelledby="detail-title"><header><div><p>所选记录</p><h2 id="detail-title" tabindex="-1">' +
      esc(action(e.action)) +
      "</h2></div>" +
      badge(e) +
      '</header><p class="when">' +
      esc(fmt(e.occurred_at)) +
      "</p><dl><div><dt>操作代码</dt><dd><code>" +
      esc(e.action) +
      "</code></dd></div><div><dt>对象类型</dt><dd>" +
      esc(resource(e.resource_type)) +
      '</dd></div></dl><section class="context"><h3>脱敏上下文</h3><pre id="metadata">' +
      esc(JSON.stringify(sanitize(e.metadata), null, 2)) +
      '</pre><small>按敏感键名脱敏；数组最多100项，深度超过8层截断。不能据此确认任意文本值均无秘密。</small></section><section class="correlation"><h3>请求关联</h3>' +
      [
        ["request_id", "请求 ID", "request"],
        ["trace_id", "追踪 ID", "trace"],
      ]
        .map(
          ([key, label, field]) =>
            '<div class="field"><small>' +
            label +
            "</small><code>" +
            esc(e[key] || "未记录") +
            '</code><button data-copy="' +
            field +
            '" ' +
            (!e[key] ? "disabled" : "") +
            ">复制" +
            label +
            '</button><p class="copy-feedback" id="copy-' +
            field +
            '" role="status">' +
            (state.copy[field] === "copied"
              ? label + "合成复制已确认"
              : state.copy[field] === "failed"
                ? label + "复制被拒绝，可手动选择文本"
                : "") +
            "</p></div>",
        )
        .join("") +
      '</section><details class="technical"><summary>技术详情</summary>' +
      [
        ["事件 ID", e.id],
        ["对象 ID", e.resource_id || "未记录"],
        ["操作者 ID", e.actor_id || "系统"],
        ["工作区 ID", e.workspace_id || "组织级"],
        ["Schema 版本", e.schema_version],
      ]
        .map(([k, v]) => "<code>" + k + "：" + esc(v) + "</code>")
        .join("") +
      '</details><button class="mobile-back" id="back-to-list">返回时间线</button></aside>'
    );
  }
  function render() {
    reconcile();
    const terminal = {
      loading: ["正在读取审计记录", "等待接口响应，不预填数量。"],
      error: ["审计查询暂不可用", "核对服务后重试，错误不等于没有记录。"],
      offline: ["网络连接暂不可用", "恢复网络后重新读取。"],
      timeout: ["审计查询超时", "既有父请求上限12秒，本图未执行真实计时。"],
      forbidden: ["无权读取当前组织审计", "需要当前组织audit:read，隐藏控件不是权限边界。"],
      expired: ["登录已失效", "从正式登录入口恢复会话后重读。"],
      rate_limited: ["请求过于频繁", "等待后再查询，不自动循环请求。"],
    }[state.pageState];
    $("#app").innerHTML =
      '<div class="review"><p>P37 C方向审核稿 · 隔离夹具</p><button id="tools-toggle" aria-expanded="' +
      state.tools +
      '">审核场景</button></div><div class="tools" ' +
      (state.tools ? "" : "hidden") +
      '><label for="scene">切换场景<select id="scene">' +
      Object.entries(scenes)
        .map(
          ([k, v]) =>
            '<option value="' +
            k +
            '" ' +
            (k === state.scene ? "selected" : "") +
            ">" +
            v +
            "</option>",
        )
        .join("") +
      "</select></label><small>只记录GET意图；复制走内存适配器，不写系统剪贴板。</small><pre>" +
      esc(JSON.stringify(state.intents, null, 2)) +
      '</pre></div><div class="shell">' +
      serverForm() +
      '<main class="main"><header class="heading"><div><h1>组织操作追踪</h1><p>审计员可独立读取，不请求组织治理摘要</p></div><button id="refresh" ' +
      (state.busy || state.pageState === "loading" ? "disabled" : "") +
      ">刷新第一页</button></header>" +
      (terminal
        ? '<section class="terminal" role="status"><h2>' +
          terminal[0] +
          "</h2><p>" +
          terminal[1] +
          "</p>" +
          (state.pageState !== "loading" ? '<button id="retry">重新加载</button>' : "") +
          "</section>"
        : '<div class="counts"><span>已加载<b>' +
          state.events.length +
          "</b></span>" +
          Object.entries(D.outcomeLabels)
            .map(
              ([k, v]) =>
                "<span>" +
                v +
                "<b>" +
                state.events.filter((e) => e.outcome === k).length +
                "</b></span>",
            )
            .join("") +
          '<small>不是全库总数</small></div><div class="query-facts">当前列表来源：' +
          esc(
            Object.entries(state.facts)
              .filter(([, v]) => v)
              .map(([k, v]) => k + "=" + v)
              .join("；") || "全部精确条件为空",
          ) +
          "。草稿只有应用后才查询。</div>" +
          (state.notice
            ? '<p class="notice ' +
              (state.noticeKind === "error" ? "error" : "") +
              '" role="status">' +
              esc(state.notice) +
              "</p>"
            : "") +
          '<div class="browser">' +
          timeline() +
          detail() +
          "</div>") +
      '<p class="provenance">' +
      esc(state.provenance) +
      "</p></main></div>";
    bind();
  }
  function bind() {
    $("#tools-toggle").onclick = () => {
      state.tools = !state.tools;
      render();
      focus("#tools-toggle");
    };
    $("#scene").onchange = (e) => scene(e.target.value);
    if ($("#filters-toggle"))
      $("#filters-toggle").onclick = () => {
        state.filtersOpen = !state.filtersOpen;
        render();
        focus("#filters-toggle");
      };
    if ($("#advanced")) $("#advanced").ontoggle = (e) => (state.advanced = e.target.open);
    document
      .querySelectorAll("[data-filter]")
      .forEach((n) =>
        n.addEventListener(
          n.tagName === "SELECT" ? "change" : "input",
          () => (state.draft[n.dataset.filter] = n.value),
        ),
      );
    if ($("#server-form"))
      $("#server-form").onsubmit = (e) => {
        e.preventDefault();
        apply();
      };
    if ($("#reset"))
      $("#reset").onclick = () => {
        if (state.busy) return;
        state.draft = defaults();
        state.query = "";
        state.validation = "";
        state.advanced = false;
        begin("apply", defaults());
      };
    $("#refresh").onclick = () => begin("refresh");
    if ($("#retry")) $("#retry").onclick = () => begin("refresh");
    if ($("#loaded-query"))
      $("#loaded-query").oninput = (e) => {
        const pos = e.target.selectionStart;
        state.query = e.target.value;
        resetCopy();
        reconcile();
        syncURL();
        render();
        $("#loaded-query").focus({ preventScroll: true });
        $("#loaded-query").setSelectionRange(pos, pos);
      };
    if ($("#clear-query"))
      $("#clear-query").onclick = () => {
        state.query = "";
        resetCopy();
        reconcile();
        syncURL();
        render();
        focus("#loaded-query");
      };
    if ($("#system"))
      $("#system").onclick = () => {
        state.systemOpen = !state.systemOpen;
        resetCopy();
        reconcile();
        syncURL();
        render();
        focus("#system");
      };
    document
      .querySelectorAll("[data-event]")
      .forEach((b) => (b.onclick = () => choose(b.dataset.event)));
    if ($("#more")) $("#more").onclick = () => begin("more");
    if ($("#back-to-list")) $("#back-to-list").onclick = () => focus("#timeline-title");
    document.querySelectorAll("[data-copy]").forEach(
      (b) =>
        (b.onclick = async () => {
          const field = b.dataset.copy,
            e = selected(),
            value = e?.[field + "_id"],
            id = e?.id,
            stamp = ++copySerial,
            gen = generation;
          if (!value) return;
          let result;
          try {
            await window.ORG_AUDIT_C_CLIPBOARD(value);
            result = "copied";
          } catch {
            result = "failed";
          }
          if (stamp !== copySerial || gen !== generation || !state.active || selected()?.id !== id)
            return;
          state.copy[field] = result;
          $("#copy-" + field).textContent =
            (field === "request" ? "请求 ID" : "追踪 ID") +
            (result === "copied" ? "合成复制已确认" : "复制被拒绝，可手动选择文本");
        }),
    );
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown scene");
    invalidate();
    state = initial();
    state.scene = name;
    window.ORG_AUDIT_C_CLIPBOARD = async () => {};
    if (name !== "normal")
      state.provenance =
        "合成审核状态或独立原测试夹具，非生产响应；不执行授权、数据库读取或审计写入。";
    if (name === "selected") state.selected = D.events[1].id;
    if (name === "loaded_all") {
      state.events = clone(D.events);
      state.nextCursor = null;
    }
    if (name === "local_failed") state.query = "失败";
    if (name === "local_trace") state.query = D.events[0].trace_id;
    if (name === "local_empty") state.query = "没有这个记录";
    if (name === "local_space") state.query = " ";
    if (
      ["exact_draft", "exact_applied", "filter_busy", "filter_failure", "filter_empty"].includes(
        name,
      )
    )
      state.draft = {
        ...defaults(),
        action: "organization.member.invited",
        outcome: "succeeded",
        resource_type: "membership",
      };
    if (name === "advanced") {
      state.draft = {
        ...D.filters,
        occurred_from: local(D.filters.occurred_from),
        occurred_to: local(D.filters.occurred_to),
      };
      state.advanced = true;
      state.filtersOpen = true;
    }
    if (name === "range_error") {
      state.draft.occurred_from = "2026-08-28T12:00";
      state.draft.occurred_to = "2026-08-27T12:00";
      apply();
    }
    if (["exact_applied", "filter_busy", "filter_failure", "filter_empty"].includes(name)) {
      state.mode = "hold";
      if (name === "filter_empty") state.draft.action = "synthetic.no-match";
      apply();
      if (name !== "filter_busy") complete(name === "filter_failure" ? "failure" : "success");
    }
    if (["more_busy", "more_failure"].includes(name)) {
      state.mode = "hold";
      begin("more");
      if (name === "more_failure") complete("failure");
    }
    if (name.startsWith("system_")) {
      state.events = [...clone(D.realtime), ...clone(D.events.slice(0, 10))];
      state.dataset = clone(state.events);
      state.nextCursor = null;
      if (name === "system_expanded") state.systemOpen = true;
      if (name === "system_search") state.query = "实时连接";
      if (name === "system_exact") {
        state.facts.action = "realtime.connected";
        state.requested = clone(state.facts);
        state.draft = clone(state.facts);
        state.events = clone(D.realtime);
      }
      if (name === "system_only") state.events = clone(D.realtime);
    }
    if (name === "empty") {
      state.events = [];
      state.nextCursor = null;
    }
    if (
      [
        "unknown",
        "metadata_nested",
        "metadata_deep",
        "metadata_array",
        "metadata_limit",
        "metadata_missing",
        "long_ids",
        "missing_ids",
      ].includes(name)
    ) {
      state.events = [clone(D.events[0])];
      state.nextCursor = null;
      const e = state.events[0];
      if (name === "unknown") {
        e.action = "synthetic.unknown.action";
        e.resource_type = "synthetic-object";
        e.outcome = "unrecognized";
      }
      if (name === "metadata_nested")
        e.metadata = {
          reason: "合成嵌套样例",
          authorization: "SYNTHETIC",
          nested: { cookie: "SYNTHETIC", private_key: "SYNTHETIC", ordinary: "非秘密说明" },
        };
      if (name === "metadata_deep") {
        let v = { leaf: "合成深层值" };
        for (let i = 0; i < 10; i++) v = { nested: v };
        e.metadata = v;
      }
      if (name === "metadata_array")
        e.metadata = {
          items: Array.from({ length: 103 }, (_, i) => ({ sequence: i + 1, token: "SYNTHETIC" })),
        };
      if (name === "metadata_limit")
        e.metadata = {
          ordinary: "SYNTHETIC_VALUE_WITH_NO_SENSITIVE_KEY",
          explanation: "无效测试值，键名算法不会识别普通键下的内容",
        };
      if (name === "metadata_missing") {
        e.metadata = null;
        state.notice = "原metadata未返回；按源算法展示{}，不等同于确认没有上下文。";
      }
      if (name === "long_ids") {
        e.request_id = "synthetic-request-".repeat(8);
        e.trace_id = "synthetic-trace-".repeat(9);
      }
      if (name === "missing_ids") {
        e.request_id = "";
        e.trace_id = "";
      }
    }
    if (name === "request_copied") state.copy.request = "copied";
    if (name === "trace_copied") state.copy.trace = "copied";
    if (name === "copy_failed") {
      state.copy.request = "failed";
      window.ORG_AUDIT_C_CLIPBOARD = async () => {
        throw Error("synthetic-denied");
      };
    }
    if (name === "late_copy") {
      state.selected = D.events[1].id;
      state.notice = "旧记录的复制完成，不归属新选中记录；未改变任何审计事实。";
    }
    if (name === "late_page") {
      state.notice = "旧游标响应已失去查询归属，未追加到当前列表。";
    }
    if (name === "auditor")
      state.notice = "只需当前组织audit:read，不读取组织治理摘要；实际授权仍由服务器校验。";
    if (
      [
        "loading",
        "error",
        "offline",
        "timeout",
        "forbidden",
        "expired",
        "rate_limited",
        "refreshing",
        "refresh_error",
      ].includes(name)
    )
      state.pageState = name;
    if (name === "refreshing") {
      state.mode = "hold";
      begin("refresh");
      state.notice = "正在读取第一页，暂保留上次事实。";
    }
    if (name === "refresh_error") {
      state.notice = "刷新失败，保留上次事实与范围。";
      state.noticeKind = "error";
    }
    if (["hover", "pressed"].includes(name)) state.filtersOpen = true;
    if (name === "controls") state.tools = true;
    reconcile();
    syncURL();
    render();
    if (name === "technical") $(".technical").open = true;
    window.scrollTo(0, 0);
  }
  state = initial();
  const q = new URLSearchParams(location.search);
  state.query = (q.get("org_audit_query") || "").slice(0, 160);
  state.selected = (q.get("org_audit_selected") || "").slice(0, 36);
  for (const k of Object.keys(keys)) state.requested[k] = q.get("org_audit_" + keys[k]) || "";
  state.facts = clone(state.requested);
  state.draft = {
    ...state.requested,
    occurred_from: local(state.requested.occurred_from),
    occurred_to: local(state.requested.occurred_to),
  };
  const restored = filteredDataset(state.requested);
  state.events = clone(restored.slice(0, 50));
  state.nextCursor = restored.length > 50 ? restored[49].id : null;
  state.advanced = Boolean(
    state.draft.request_id ||
    state.draft.trace_id ||
    state.draft.occurred_from ||
    state.draft.occurred_to,
  );
  window.ORG_AUDIT_C_CLIPBOARD = async () => {};
  render();
  window.ORG_AUDIT_C = {
    scenes,
    scene,
    state: () => clone(state),
    visible: () => clone(visible()),
    sanitize,
    setMode: (m) => (state.mode = m),
    complete,
    begin,
    leave: () => {
      invalidate();
      state.active = false;
      state.pending = null;
      state.busy = false;
      render();
    },
    activate: () => {
      state.active = true;
      render();
    },
    replaceWithRefresh: () => {
      invalidate();
      state.busy = false;
      state.pending = null;
      begin("refresh");
    },
  };
})();
