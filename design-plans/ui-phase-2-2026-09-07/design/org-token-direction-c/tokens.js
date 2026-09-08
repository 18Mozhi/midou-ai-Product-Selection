(() => {
  "use strict";
  const D = window.ORG_TOKEN_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    now = Date.parse(D.fixedTime);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const statuses = { active: "正常使用", revoked: "已撤销", rotated: "已轮换", expired: "已过期" },
    status = (v) => statuses[v] ?? "未知状态（" + (v || "空") + "）",
    scope = (v) => D.scopeOptions.find((s) => s.value === v)?.label ?? "未知 scope（" + v + "）";
  const time = (v) => (Number.isFinite(Date.parse(String(v ?? ""))) ? Date.parse(String(v)) : 0),
    fmt = (v) => (time(v) ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未返回时间");
  const days = (v) => (time(v) ? Math.ceil((time(v) - now) / 86400000) : null),
    expiring = (r) =>
      r.status === "active" &&
      days(r.expires_at) !== null &&
      days(r.expires_at) >= 0 &&
      days(r.expires_at) <= 7;
  const expiry = (r) =>
    r.status !== "active" || !time(r.expires_at)
      ? ""
      : time(r.expires_at) < now
        ? "已到期，等待刷新核验"
        : days(r.expires_at) === 0
          ? "今天到期"
          : days(r.expires_at) <= 7
            ? days(r.expires_at) + " 天内到期"
            : "";
  const secretValue = "SYNTHETIC_UI_REVIEW_ONLY_NOT_A_REAL_TOKEN";
  const defaults = () => ({
      query: "",
      status: "all",
      scope: "all",
      sort: "created_desc",
      page: 1,
    }),
    form = () => ({ name: "", scopes: [], ttl_days: 90, reason: "" });
  const scenes = {
    normal: "原始生命周期目录",
    page_two: "第二页",
    search: "名称搜索",
    scope_search: "中文读取范围搜索",
    scope_filter: "读取范围筛选",
    active: "正常使用筛选",
    expiring: "七天内到期",
    never_used: "从未调用",
    revoked: "已撤销",
    rotated: "已轮换",
    expired: "已过期",
    empty: "暂无令牌",
    filter_empty: "筛选空",
    unknown: "未知状态和scope",
    long_name: "长名称",
    past_expiry: "已过期但列表仍active",
    technical: "技术详情",
    create: "创建空表单",
    create_draft: "最小权限草稿",
    create_all_scopes: "四只读scope",
    create_required: "必填错误",
    create_scope_error: "未选择scope",
    create_ttl_error: "期限越界",
    create_long: "长度边界",
    create_busy: "创建处理中",
    create_failure: "创建失败留草稿",
    create_limit: "活动数量上限",
    create_unknown: "创建结果未知",
    secret: "一次性合成明文",
    copy_success: "合成复制成功",
    copy_failure: "浏览器拒绝复制",
    secret_dismissed: "主动清除明文",
    reason_rotate: "轮换原因窗",
    reason_revoke: "撤销原因窗",
    reason_short: "原因过短",
    reason_long: "长原因",
    action_busy: "动作处理中",
    action_failure: "动作失败",
    action_conflict: "版本冲突",
    rotate_success: "合成轮换响应",
    revoke_success: "合成撤销响应",
    write_read_failed: "写后重读失败",
    late_response: "离开后迟到响应",
    loading: "首次读取",
    error: "服务错误",
    forbidden: "权限拒绝",
    session_expired: "登录失效",
    rate_limited: "请求频繁",
    refreshing: "后台刷新",
    refresh_error: "刷新失败",
    hover: "创建按钮悬停",
    pressed: "创建按钮按下",
    focus: "创建按钮焦点",
    controls: "非业务审核工具",
  };
  let state,
    generation = 0,
    copyGeneration = 0,
    requestSerial = 0;
  const writesLocked = () => state.busy || state.unresolved || state.pageState === "refreshing";
  function initial() {
    return {
      tokens: clone(D.tokens),
      filter: defaults(),
      form: form(),
      errors: {},
      filtersOpen: innerWidth > 760,
      tools: false,
      scene: "normal",
      pageState: "ready",
      notice: "",
      noticeKind: "info",
      secret: "",
      copyState: "",
      busy: false,
      unresolved: false,
      pending: null,
      dialog: null,
      mode: "intent",
      active: true,
      intents: [],
      provenance:
        "原始8条令牌夹具，非生产凭据。审核固定时钟为2026-08-26 18:00（上海），用于复验到期边界，不是当前时间。",
    };
  }
  function filtered() {
    const f = state.filter,
      q = f.query.trim().toLocaleLowerCase("zh-CN"),
      name = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-CN");
    return state.tokens
      .filter((r) => {
        const scopes = Array.isArray(r.scopes) ? r.scopes : [];
        return (
          (!q ||
            [r.name, r.token_prefix, status(r.status), ...scopes.map(scope)].some((v) =>
              String(v ?? "")
                .toLocaleLowerCase("zh-CN")
                .includes(q),
            )) &&
          (f.scope === "all" || scopes.includes(f.scope)) &&
          (f.status === "all" ||
            (f.status === "expiring" && expiring(r)) ||
            (f.status === "never_used" && r.status === "active" && !r.last_used_at) ||
            r.status === f.status)
        );
      })
      .sort((a, b) =>
        f.sort === "expires_asc"
          ? time(a.expires_at) - time(b.expires_at) || name(a, b)
          : f.sort === "last_used_desc"
            ? time(b.last_used_at) - time(a.last_used_at) || name(a, b)
            : f.sort === "name_asc"
              ? name(a, b)
              : f.sort === "status_asc"
                ? status(a.status).localeCompare(status(b.status), "zh-CN") || name(a, b)
                : time(b.created_at) - time(a.created_at) || name(a, b),
      );
  }
  function readURL() {
    const q = new URLSearchParams(location.search),
      txt = (k) => (q.get("org_token_" + k) || "").slice(0, 200),
      choice = (k, a, d) => (a.includes(txt(k)) ? txt(k) : d);
    state.filter.query = txt("query");
    state.filter.status = choice(
      "status",
      ["all", "active", "expiring", "never_used", "revoked", "rotated", "expired"],
      "all",
    );
    state.filter.scope = choice("scope", ["all", ...D.scopeOptions.map((s) => s.value)], "all");
    state.filter.sort = choice(
      "sort",
      ["created_desc", "expires_asc", "last_used_desc", "name_asc", "status_asc"],
      "created_desc",
    );
    const n = Number(txt("page"));
    state.filter.page = Number.isSafeInteger(n) && n > 0 ? n : 1;
  }
  function syncURL() {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(state.filter))
      if (v && String(v) !== String(defaults()[k])) q.set("org_token_" + k, String(v));
      else q.delete("org_token_" + k);
    history.replaceState(null, "", location.pathname + (q.size ? "?" + q.toString() : ""));
  }
  const options = (arr, v) =>
    arr
      .map(
        ([k, l]) =>
          '<option value="' +
          esc(k) +
          '" ' +
          (k === v ? "selected" : "") +
          ">" +
          esc(l) +
          "</option>",
      )
      .join("");
  function focus(s) {
    const n = $(s);
    n?.focus();
    if (innerWidth <= 760) n?.scrollIntoView({ block: "start" });
  }
  function dismiss() {
    generation++;
    copyGeneration++;
    state.secret = "";
    state.copyState = "";
  }
  function begin(kind, path, body, target) {
    if (writesLocked()) return false;
    if (kind === "create") {
      dismiss();
      state.errors = {};
    }
    const intent = { method: "POST", path, body: clone(body) };
    state.intents.push(intent);
    state.notice =
      "已记录" +
      (kind === "create" ? "创建" : kind === "rotate" ? "轮换" : "撤销") +
      "意图；未向后端发送。";
    state.noticeKind = "info";
    if (state.mode === "hold") {
      state.busy = true;
      state.pending = {
        id: ++requestSerial,
        generation,
        kind,
        target: clone(target ?? {}),
        body: clone(body),
      };
    }
    render();
    return true;
  }
  function complete(outcome, id = state.pending?.id) {
    const p = state.pending;
    if (!p || p.id !== id) return false;
    state.pending = null;
    state.busy = false;
    if (p.generation !== generation || !state.active) {
      render();
      return true;
    }
    state.noticeKind = "error";
    if (["success", "read_failed"].includes(outcome)) {
      state.noticeKind = outcome === "success" ? "success" : "error";
      state.notice = "合成写响应已确认；尚未重新读取，不补造列表状态或新记录。";
      if (p.kind === "create") {
        state.form = form();
        state.secret = secretValue;
        copyGeneration++;
      }
      if (p.kind === "rotate") {
        state.secret = secretValue;
        copyGeneration++;
        state.notice = "合成轮换已确认；新明文独立展示，列表仍是上次读取。新期限由后端配置决定。";
      }
      if (p.kind === "revoke") {
        dismiss();
        state.notice = "合成撤销已确认；旧记录状态需重新读取，不能恢复访问。";
      }
      if (outcome === "read_failed") state.notice += " 后续读取失败，请核对事实，不要重复写入。";
    } else if (outcome === "unknown") {
      state.unresolved = true;
      state.notice = "写入结果未知；已暂停本页重复提交，请核对后端记录。";
    } else
      state.notice =
        outcome === "conflict"
          ? "版本冲突，未确认本次操作成功，请刷新核对后重新操作。"
          : outcome === "limit"
            ? "活动令牌数量达到上限，请核对并撤销不用的令牌后再试。"
            : "请求失败，未确认写入；创建草稿保留。";
    render();
    return true;
  }
  function validateCreate() {
    const f = state.form,
      e = {};
    if (!f.name.trim() || f.name.trim().length > 120) e.name = "填写1–120字符的用途名称。";
    if (!f.scopes.length) e.scopes = "至少选择一个只读权限范围。";
    if (!Number.isInteger(Number(f.ttl_days)) || Number(f.ttl_days) < 1 || Number(f.ttl_days) > 365)
      e.ttl_days = "有效期需为1–365整数天。";
    if (!f.reason.trim() || f.reason.trim().length > 500) e.reason = "填写1–500字符的创建原因。";
    state.errors = e;
    return !Object.keys(e).length;
  }
  function openReason(id, action) {
    if (writesLocked()) return;
    const item = state.tokens.find((r) => r.id === id);
    if (!item || item.status !== "active") return;
    state.dialog = { item: clone(item), action, reason: "" };
    render();
    $("#reason").showModal();
    $("#reason-input").focus();
  }
  function closeReason() {
    if (!state.dialog) return;
    const d = state.dialog;
    state.dialog = null;
    render();
    focus('[data-action="' + d.action + '"][data-id="' + d.item.id + '"]');
  }
  const badge = (r) =>
    '<span class="status" data-status="' + esc(r.status) + '">' + esc(status(r.status)) + "</span>";
  function catalog() {
    const f = state.filter,
      list = filtered(),
      pages = Math.max(1, Math.ceil(list.length / 6));
    f.page = Math.min(f.page, pages);
    const select = (k, title, arr) =>
      '<label for="filter-' +
      k +
      '">' +
      title +
      '<select id="filter-' +
      k +
      '" data-filter="' +
      k +
      '">' +
      options(arr, f[k]) +
      "</select></label>";
    return (
      '<section class="paper" id="catalog"><div class="paper-head"><h2 id="catalog-title" tabindex="-1">令牌生命周期</h2><small>仅active记录提供轮换与撤销；状态以最新响应为准</small></div><button id="filters-toggle" class="filter-toggle" aria-expanded="' +
      state.filtersOpen +
      '">' +
      (state.filtersOpen ? "收起" : "展开") +
      '筛选与排序</button><div class="filters ' +
      (state.filtersOpen ? "open" : "") +
      '"><label for="filter-query">搜索令牌<input id="filter-query" type="search" data-filter="query" value="' +
      esc(f.query) +
      '" placeholder="名称、前缀、scope或状态"></label>' +
      select("status", "生命周期", [
        ["all", "全部状态"],
        ["active", "正常使用"],
        ["expiring", "7天内到期"],
        ["never_used", "从未调用"],
        ["revoked", "已撤销"],
        ["rotated", "已轮换"],
        ["expired", "已过期"],
      ]) +
      select("scope", "读取范围", [
        ["all", "全部scope"],
        ...D.scopeOptions.map((s) => [s.value, s.label]),
      ]) +
      select("sort", "排序", [
        ["created_desc", "创建时间从新到旧"],
        ["expires_asc", "到期时间从近到远"],
        ["last_used_desc", "最近调用优先"],
        ["name_asc", "名称 A–Z"],
        ["status_asc", "状态排序"],
      ]) +
      '<button id="reset">重置筛选</button></div><p class="count">筛选 ' +
      list.length +
      " / 已加载 " +
      state.tokens.length +
      " 条；每页6条</p>" +
      (list.length
        ? '<div class="token-list">' +
          list
            .slice((f.page - 1) * 6, f.page * 6)
            .map(
              (r) =>
                '<article class="token" data-token="' +
                esc(r.id) +
                '"><div>' +
                badge(r) +
                '<span class="expiry">' +
                esc(expiry(r)) +
                "</span><h3>" +
                esc(r.name) +
                '</h3><code class="prefix">' +
                esc(r.token_prefix) +
                '…</code><div class="scopes">' +
                (r.scopes || []).map((s) => "<span>" + esc(scope(s)) + "</span>").join("") +
                '</div></div><dl class="facts">' +
                [
                  ["到期时间", fmt(r.expires_at)],
                  ["最近调用", r.last_used_at ? fmt(r.last_used_at) : "从未调用"],
                  ["创建时间", fmt(r.created_at)],
                ]
                  .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>")
                  .join("") +
                '</dl><footer><details class="technical"><summary>技术详情</summary><code>令牌记录 ID：' +
                esc(r.id) +
                "</code><small>版本 " +
                esc(r.version) +
                " / 更新于 " +
                esc(fmt(r.updated_at)) +
                "</small></details>" +
                (r.status === "active"
                  ? '<div class="actions"><button data-action="rotate" data-id="' +
                    esc(r.id) +
                    '" ' +
                    (writesLocked() ? "disabled" : "") +
                    '>轮换密钥</button><button class="danger" data-action="revoke" data-id="' +
                    esc(r.id) +
                    '" ' +
                    (writesLocked() ? "disabled" : "") +
                    ">撤销访问</button></div>"
                  : "") +
                "</footer></article>",
            )
            .join("") +
          '</div><footer class="pager"><small>第 ' +
          f.page +
          " / " +
          pages +
          ' 页</small><div class="actions"><button data-page="-1" ' +
          (f.page <= 1 ? "disabled" : "") +
          '>上一页</button><button data-page="1" ' +
          (f.page >= pages ? "disabled" : "") +
          ">下一页</button></div></footer>"
        : '<div class="empty" role="status"><h3>' +
          (state.tokens.length ? "没有匹配的组织令牌" : "当前组织尚未创建令牌") +
          "</h3><p>" +
          (state.tokens.length
            ? "调整或清除筛选后再试。"
            : "仅在有明确接入需求时创建最小只读令牌。") +
          "</p>" +
          (state.tokens.length ? '<button id="clear-filter">清除筛选</button>' : "") +
          "</div>") +
      "</section>"
    );
  }
  function creation() {
    const f = state.form,
      disabled = writesLocked() ? "disabled" : "",
      err = (k) =>
        state.errors[k]
          ? '<span class="field-error" id="error-' +
            k +
            '" role="alert">' +
            state.errors[k] +
            "</span>"
          : "",
      preview =
        Number.isInteger(Number(f.ttl_days)) && Number(f.ttl_days) >= 1 && Number(f.ttl_days) <= 365
          ? new Date(now + Number(f.ttl_days) * 86400000).toLocaleDateString("zh-CN")
          : "有效期需为1–365天";
    return (
      '<section class="paper" id="create"><div class="paper-head"><h2>创建组织令牌</h2><small>先明确用途，再选择必要读取范围</small></div><form id="create-form" novalidate class="create-grid"><div class="form-fields"><label for="create-name">令牌名称<input id="create-name" data-form="name" maxlength="120" autocomplete="off" value="' +
      esc(f.name) +
      '" ' +
      disabled +
      ">" +
      err("name") +
      '<small>不要填写密钥、密码或个人隐私。</small></label><fieldset class="scope-group" aria-describedby="scope-help' +
      (state.errors.scopes ? " error-scopes" : "") +
      '"><legend>允许读取的内容</legend><p class="muted" id="scope-help">必须明确选择，不默认授权。</p><div class="scope-options">' +
      D.scopeOptions
        .map(
          (s, i) =>
            '<label for="scope-' +
            i +
            '"><input id="scope-' +
            i +
            '" data-scope="' +
            s.value +
            '" type="checkbox" ' +
            (f.scopes.includes(s.value) ? "checked" : "") +
            " " +
            disabled +
            "><span><b>" +
            s.label +
            "</b><small>" +
            s.description +
            "</small></span></label>",
        )
        .join("") +
      "</div>" +
      err("scopes") +
      '</fieldset><div class="duration"><label for="create-ttl">有效天数<input id="create-ttl" data-form="ttl_days" type="number" min="1" max="365" step="1" value="' +
      esc(f.ttl_days) +
      '" ' +
      disabled +
      ">" +
      err("ttl_days") +
      '</label><div class="actions" aria-label="常用有效期">' +
      [30, 90, 180, 365]
        .map(
          (n) =>
            '<button type="button" data-ttl="' +
            n +
            '" aria-pressed="' +
            (Number(f.ttl_days) === n) +
            '" ' +
            disabled +
            ">" +
            n +
            " 天</button>",
        )
        .join("") +
      '</div></div><label for="create-reason">创建原因<textarea id="create-reason" data-form="reason" maxlength="500" rows="3" ' +
      disabled +
      ">" +
      esc(f.reason) +
      "</textarea>" +
      err("reason") +
      '<small>原因会写入审计，最多500字符。</small></label><button class="primary create-submit" id="create-submit" ' +
      disabled +
      ">" +
      (state.busy ? "正在处理…" : "创建并显示一次明文") +
      '</button></div><aside class="preview" aria-label="令牌创建预览"><h3>提交前核对</h3><dl><div><dt>数据边界</dt><dd>仅当前组织</dd></div><div><dt>读取范围</dt><dd id="preview-scopes">' +
      esc(f.scopes.map(scope).join("、") || "尚未选择") +
      '</dd></div><div><dt>预计到期</dt><dd id="preview-expiry">' +
      preview +
      "</dd></div><div><dt>实际期限</dt><dd>以成功响应expires_at为准；轮换期限另由后端配置决定。</dd></div></dl></aside></form></section>"
    );
  }
  function reasonMarkup() {
    const d = state.dialog;
    if (!d) return "";
    return (
      '<dialog id="reason" aria-labelledby="reason-title"><form class="reason-form" id="reason-form"><header><h2 id="reason-title">' +
      (d.action === "rotate" ? "轮换密钥" : "撤销访问") +
      '</h2><button type="button" id="reason-close" aria-label="关闭原因填写">×</button></header><div class="reason-body"><div class="reason-target"><small>目标令牌 / 版本 ' +
      esc(d.item.version) +
      "</small><b>" +
      esc(d.item.name) +
      "</b><code>" +
      esc(d.item.token_prefix) +
      "…</code></div><p>" +
      (d.action === "rotate"
        ? "成功后旧令牌立即失效，创建新记录，新明文只展示一次。新期限来自后端配置。"
        : "成功后该令牌立即失效且不能恢复。不会删除成员账号。") +
      '</p><label for="reason-input">审计原因（2–500字）<textarea id="reason-input" minlength="2" maxlength="500" required>' +
      esc(d.reason) +
      '</textarea></label><small>原因与操作者、时间和目标一起记录。取消不提交。</small></div><footer><button type="button" id="reason-cancel">取消</button><button class="primary ' +
      (d.action === "revoke" ? "danger" : "") +
      '" id="reason-submit" ' +
      (d.reason.trim().length < 2 ? "disabled" : "") +
      ">确认提交</button></footer></form></dialog>"
    );
  }
  function render() {
    const a = state.tokens.filter((r) => r.status === "active"),
      terminal = {
        loading: ["正在读取令牌", "等待返回，不显示占位数字。"],
        error: ["令牌读取失败", "可重试，失败不等于没有令牌。"],
        forbidden: ["无权访问组织令牌", "请核对当前组织和所需管理能力。"],
        session_expired: ["登录已失效", "从正式登录入口恢复会话后再读取。"],
        rate_limited: ["请求过于频繁", "等待后再试，不自动重放写入。"],
      }[state.pageState];
    $("#app").innerHTML =
      '<div class="review"><p>P36 设计审核稿 · 仅合成数据</p><button id="tools-toggle" aria-expanded="' +
      state.tools +
      '">审核场景</button></div><div class="tools" ' +
      (state.tools ? "" : "hidden") +
      '><label for="scene">切换审核场景<select id="scene">' +
      options(Object.entries(scenes), state.scene) +
      '</select></label><p class="muted">所有明文是无效合成字符串；复制使用演示适配器，不写系统剪贴板。</p><pre>' +
      esc(JSON.stringify(state.intents, null, 2)) +
      '</pre></div><div class="shell"><aside class="rail"><h2>组织令牌</h2><nav><a href="#catalog" data-anchor="catalog-title">生命周期</a><a href="#create" data-anchor="create-name">创建令牌</a></nav><p>四种固定只读范围<br>不提供明文找回</p></aside><main class="main"><header class="heading"><div><h1>只读访问凭据</h1><p>用途、期限与凭据保管分开核对</p></div><div class="actions"><button id="refresh" ' +
      (state.busy || ["loading", "refreshing"].includes(state.pageState) ? "disabled" : "") +
      '>刷新数据</button><button class="primary" id="new-token">创建令牌</button></div></header>' +
      (terminal
        ? '<section class="paper empty" role="status"><h2>' +
          terminal[0] +
          "</h2><p>" +
          terminal[1] +
          "</p>" +
          (state.pageState === "loading" ? "" : '<button id="retry">重新加载</button>') +
          "</section>"
        : '<div class="summary"><span>全部<b>' +
          state.tokens.length +
          "</b></span><span>状态active<b>" +
          a.length +
          "</b></span><span>7天内到期<b>" +
          a.filter(expiring).length +
          "</b></span><span>从未调用<b>" +
          a.filter((r) => !r.last_used_at).length +
          "</b></span><span>历史记录<b>" +
          state.tokens.filter((r) => r.status !== "active").length +
          '</b></span></div><p class="boundary">令牌不是成员账号，仅当前组织固定只读范围。列表刷新会由后端更新到期状态。</p>' +
          (state.notice
            ? '<p class="notice ' +
              (state.noticeKind === "error" ? "error" : "") +
              '" role="status">' +
              esc(state.notice) +
              "</p>"
            : "") +
          (state.secret
            ? '<section class="secret" id="secret-panel" aria-labelledby="secret-title"><header><h2 id="secret-title">仅本次响应可见的明文</h2><small>离开或主动清除后不再展示</small></header><code>' +
              esc(state.secret) +
              '</code><footer><p id="copy-feedback" role="status">' +
              (state.copyState === "copied"
                ? "合成复制已确认，请保管于受限位置。"
                : state.copyState === "failed"
                  ? "浏览器拒绝复制，请手动选择并保存。"
                  : "这是无效演示值，不可用于认证；不进入URL、日志或存储。") +
              '</p><div class="actions"><button id="copy">复制明文</button><button class="primary" id="dismiss">我已安全保存</button></div></footer></section>'
            : "") +
          catalog() +
          creation()) +
      '<p class="provenance">' +
      esc(state.provenance) +
      "</p></main></div>" +
      reasonMarkup();
    bind();
  }
  function bind() {
    $("#tools-toggle").onclick = () => {
      state.tools = !state.tools;
      render();
      focus("#tools-toggle");
    };
    $("#scene").onchange = (e) => scene(e.target.value);
    document.querySelectorAll("[data-anchor]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          focus("#" + a.dataset.anchor);
        }),
    );
    $("#new-token").onclick = () => focus("#create-name");
    const refresh = () => {
      state.intents.push(
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/tokens" },
      );
      state.notice = "仅记录读取意图。真实GET会更新到期状态；原型没有访问数据库。";
      if (!["ready", "refresh_error"].includes(state.pageState)) state.tools = true;
      render();
    };
    $("#refresh").onclick = refresh;
    if ($("#retry")) $("#retry").onclick = refresh;
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
        state.filter[el.dataset.filter] = el.value;
        state.filter.page = 1;
        syncURL();
        render();
        $("#" + id).focus();
        if (el.type === "search") $("#" + id).setSelectionRange(pos, pos);
      }),
    );
    const reset = () => {
      state.filter = defaults();
      state.filtersOpen = true;
      syncURL();
      render();
      focus("#filter-query");
    };
    if ($("#reset")) $("#reset").onclick = reset;
    if ($("#clear-filter")) $("#clear-filter").onclick = reset;
    document.querySelectorAll("[data-page]").forEach(
      (b) =>
        (b.onclick = () => {
          state.filter.page += Number(b.dataset.page);
          syncURL();
          render();
          focus("#catalog-title");
        }),
    );
    document
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.onclick = () => openReason(b.dataset.id, b.dataset.action)));
    document.querySelectorAll("[data-form]").forEach((el) =>
      el.addEventListener("input", () => {
        state.form[el.dataset.form] = el.value;
        if (el.dataset.form === "ttl_days")
          $("#preview-expiry").textContent =
            Number.isInteger(Number(el.value)) && Number(el.value) >= 1 && Number(el.value) <= 365
              ? new Date(now + Number(el.value) * 86400000).toLocaleDateString("zh-CN")
              : "有效期需为1–365天";
      }),
    );
    document.querySelectorAll("[data-scope]").forEach(
      (el) =>
        (el.onchange = () => {
          const f = state.form.scopes;
          state.form.scopes = el.checked
            ? [...f, el.dataset.scope]
            : f.filter((v) => v !== el.dataset.scope);
          delete state.errors.scopes;
          render();
          focus("#" + el.id);
        }),
    );
    document.querySelectorAll("[data-ttl]").forEach(
      (b) =>
        (b.onclick = () => {
          state.form.ttl_days = Number(b.dataset.ttl);
          render();
          focus('[data-ttl="' + b.dataset.ttl + '"]');
        }),
    );
    if ($("#create-form"))
      $("#create-form").onsubmit = (e) => {
        e.preventDefault();
        if (writesLocked()) return;
        if (!validateCreate()) {
          render();
          focus(
            state.errors.name
              ? "#create-name"
              : state.errors.scopes
                ? "#scope-0"
                : state.errors.ttl_days
                  ? "#create-ttl"
                  : "#create-reason",
          );
          return;
        }
        const f = state.form;
        begin("create", "/org/admin/tokens", {
          name: f.name.trim(),
          scopes: [...f.scopes],
          ttl_days: Number(f.ttl_days),
          reason: f.reason.trim(),
        });
      };
    if ($("#dismiss"))
      $("#dismiss").onclick = () => {
        dismiss();
        render();
        focus("#catalog-title");
      };
    if ($("#copy"))
      $("#copy").onclick = async () => {
        const stamp = copyGeneration,
          value = state.secret,
          ownsFeedback = () => stamp === copyGeneration && state.secret === value && state.active;
        try {
          await window.ORG_TOKEN_C_CLIPBOARD(value);
          if (!ownsFeedback()) return;
          state.copyState = "copied";
        } catch {
          if (!ownsFeedback()) return;
          state.copyState = "failed";
        }
        render();
      };
    if (state.dialog) {
      $("#reason-close").onclick = closeReason;
      $("#reason-cancel").onclick = closeReason;
      $("#reason").oncancel = (e) => {
        e.preventDefault();
        closeReason();
      };
      $("#reason-input").oninput = (e) => {
        state.dialog.reason = e.target.value;
        $("#reason-submit").disabled = e.target.value.trim().length < 2;
      };
      $("#reason-form").onsubmit = (e) => {
        e.preventDefault();
        const d = state.dialog,
          r = d.reason.trim();
        if (r.length < 2 || r.length > 500) return;
        state.dialog = null;
        begin(
          d.action,
          "/org/admin/tokens/" + d.item.id + "/actions",
          { action: d.action, expected_version: d.item.version, reason: r },
          d.item,
        );
      };
      $("#reason").onkeydown = (e) => {
        if (e.key !== "Tab") return;
        const all = [...$("#reason").querySelectorAll("button,textarea")].filter(
            (n) => !n.disabled,
          ),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
    }
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown scene");
    generation++;
    copyGeneration++;
    state = initial();
    state.scene = name;
    window.ORG_TOKEN_C_CLIPBOARD = async () => {};
    if (name !== "normal")
      state.provenance = "合成审核场景，固定时钟2026-08-26 18:00（上海）；非生产响应、非有效凭据。";
    if (name === "page_two") state.filter.page = 2;
    if (name === "search") state.filter.query = "月度";
    if (name === "scope_search") state.filter.query = "报表只读";
    if (name === "scope_filter") state.filter.scope = "task:read";
    if (["active", "expiring", "never_used", "revoked", "rotated"].includes(name))
      state.filter.status = name;
    if (name === "expired") {
      state.tokens[0].status = "expired";
      state.filter.status = "expired";
    }
    if (name === "empty") state.tokens = [];
    if (name === "filter_empty") state.filter.query = "未返回令牌";
    if (name === "unknown") {
      state.tokens = [state.tokens[0]];
      state.tokens[0].status = "unknown";
      state.tokens[0].scopes = ["unrecognized:read"];
    }
    if (name === "long_name") {
      state.tokens = [state.tokens[0]];
      state.tokens[0].name = "跨组织禁止共享的采购报告读取凭据".repeat(7);
    }
    if (name === "past_expiry") {
      state.tokens = [state.tokens[0]];
      state.tokens[0].expires_at = "2026-08-26T09:00:00.000Z";
      state.notice =
        "列表仍为active；现有ceil算法会纳入临期计数。以服务器刷新后的事实为准，不自行改状态。";
    }
    if (name.startsWith("create_") || ["hover", "pressed", "focus"].includes(name))
      state.form = clone(D.createBody);
    if (name === "create_all_scopes") state.form.scopes = D.scopeOptions.map((s) => s.value);
    if (name === "create_required") {
      state.form = form();
      validateCreate();
    }
    if (name === "create_scope_error") {
      state.form.scopes = [];
      validateCreate();
    }
    if (name === "create_ttl_error") {
      state.form.ttl_days = 366;
      validateCreate();
    }
    if (name === "create_long") {
      state.form.name = "合成用途".repeat(30);
      state.form.reason = "原因".repeat(250);
    }
    if (["create_busy", "create_failure", "create_limit", "create_unknown"].includes(name)) {
      state.mode = "hold";
      begin("create", "/org/admin/tokens", state.form);
      if (name !== "create_busy")
        complete(
          name === "create_limit" ? "limit" : name === "create_unknown" ? "unknown" : "failure",
        );
    }
    if (["secret", "copy_success", "copy_failure", "secret_dismissed"].includes(name)) {
      state.secret = secretValue;
      if (name === "copy_success") state.copyState = "copied";
      if (name === "copy_failure") {
        state.copyState = "failed";
        window.ORG_TOKEN_C_CLIPBOARD = async () => {
          throw Error("Synthetic clipboard denied");
        };
      }
      if (name === "secret_dismissed") {
        dismiss();
        state.notice = "已清除本次明文，不能重新找回。";
      }
    }
    if (["reason_rotate", "reason_revoke", "reason_short", "reason_long"].includes(name)) {
      state.filter.query = state.tokens[0].name;
      state.dialog = {
        item: clone(state.tokens[0]),
        action: name === "reason_revoke" ? "revoke" : "rotate",
        reason:
          name === "reason_short" ? "字" : name === "reason_long" ? "隔离原因".repeat(125) : "",
      };
    }
    if (
      [
        "action_busy",
        "action_failure",
        "action_conflict",
        "rotate_success",
        "revoke_success",
        "write_read_failed",
        "late_response",
      ].includes(name)
    ) {
      state.mode = "hold";
      const action = name === "revoke_success" ? "revoke" : "rotate";
      begin(
        action,
        "/org/admin/tokens/" + state.tokens[0].id + "/actions",
        { action, expected_version: 1, reason: "隔离操作原因" },
        state.tokens[0],
      );
      if (name === "late_response") {
        dismiss();
        complete("success");
        state.notice = "离开后旧响应已到达，未重新展示明文。";
      } else if (name !== "action_busy")
        complete(
          name === "action_conflict"
            ? "conflict"
            : name === "action_failure"
              ? "failure"
              : name === "write_read_failed"
                ? "read_failed"
                : "success",
        );
    }
    if (
      [
        "loading",
        "error",
        "forbidden",
        "session_expired",
        "rate_limited",
        "refreshing",
        "refresh_error",
      ].includes(name)
    )
      state.pageState = name;
    if (name === "refreshing") state.notice = "正在读取，以下仍为上次返回的生命周期事实。";
    if (name === "refresh_error") state.notice = "读取失败，保留已有列表；不表示已撤销或没有令牌。";
    if (name === "controls") state.tools = true;
    syncURL();
    render();
    if (state.dialog) {
      $("#reason").showModal();
      $("#reason-input").focus();
    }
    if (name === "technical") $(".technical").open = true;
    if (
      name === "create" ||
      name.startsWith("create_") ||
      ["hover", "pressed", "focus"].includes(name)
    )
      $("#create").scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }
  state = initial();
  readURL();
  window.ORG_TOKEN_C_CLIPBOARD = async () => {};
  render();
  window.ORG_TOKEN_C = {
    scenes,
    scene,
    state: () => clone(state),
    filtered: () => clone(filtered()),
    setMode: (m) => (state.mode = m),
    complete,
    leave: () => {
      state.active = false;
      dismiss();
      state.dialog = null;
      render();
    },
    activate: () => {
      state.active = true;
      render();
    },
    replaceSyntheticSecret: () => {
      copyGeneration++;
      state.secret = secretValue + "_REPLACEMENT";
      state.copyState = "";
      render();
    },
  };
})();
