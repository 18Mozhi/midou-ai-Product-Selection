(() => {
  "use strict";
  const D = window.PLATFORM_OVERVIEW_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const names = {
    normal: "默认 · 原始三来源夹具",
    superadmin: "超级管理员入口",
    trend: "三点趋势 · 独立夹具",
    trend_single: "单点趋势 · 合成",
    trend_zero: "全零趋势 · 合成",
    null_rate: "成功率无样本",
    zero_rate: "成功率为零",
    empty: "空平台",
    only_trend: "仅趋势被判空 · 源边界",
    loading: "首次读取中",
    blocked: "首次读取失败",
    timeout: "首次读取超时",
    offline: "离线失败",
    forbidden: "无权访问",
    expired: "登录过期",
    rate_limited: "读取受限流",
    refreshing: "刷新中保留快照",
    refresh_failed: "切窗失败 · 旧快照",
    refresh_timeout: "刷新超时",
    refresh_forbidden: "刷新权限撤回 · 源边界",
    refresh_expired: "刷新登录过期 · 源边界",
    window15m: "15分钟 · 合成范围",
    window7d: "7天 · 合成范围",
    window30d: "30天 · 合成范围",
    many_providers: "15来源 · 默认8项",
    all_providers: "15来源 · 全部展开",
    no_providers: "暂无启用来源",
    unknown_provider: "未知状态 · 原值披露",
    long_fields: "长名称与编号 · 合成",
    no_alerts: "无近期告警",
    no_queues: "无队列记录",
    technical: "请求编号展开",
    alert_details: "告警关联信息展开",
    copy_success: "请求编号复制成功",
    copy_failed: "请求编号复制失败",
    columns: "桌面列设置",
    one_column: "仅一列 · 禁止全部隐藏",
    compact: "桌面紧凑密度",
    unfrozen: "取消首可见列冻结",
    hover: "刷新悬停",
    focus: "刷新焦点",
    pressed: "刷新按下",
    controls: "控件六态 · 非业务工具",
  };
  const windows = { "15m": "最近15分钟", "24h": "最近24小时", "7d": "最近7天", "30d": "最近30天" };
  const routes = {
    tasks: "/platform-admin/collection",
    root: "/platform-admin/collection/overview?root_cause=1",
    progress: "/platform-admin/collection/overview",
    sources: "/platform-admin/providers/sources",
    data: "/platform-admin/data",
    orgs: "/platform-admin/organizations",
    users: "/platform-admin/users",
    login: "/login",
  };
  const status = (v) =>
    ({ healthy: "健康", degraded: "降级", warning: "需关注", critical: "严重", unknown: "未知" })[
      v
    ] ?? "未知";
  const providerStatus = (v) => ({ healthy: "健康", degraded: "降级" })[v] ?? "未知";
  const time = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "无样本";
  const bytes = (v) =>
    v < 1024
      ? `${v} B`
      : v < 1048576
        ? `${(v / 1024).toFixed(1)} KB`
        : v < 1073741824
          ? `${(v / 1048576).toFixed(1)} MB`
          : `${(v / 1073741824).toFixed(1)} GB`;
  const badge = (v, label = status(v)) =>
    `<span class="badge ${["healthy", "degraded", "warning", "critical"].includes(v) ? v : "unknown"}">${esc(label)}</span>`;
  const link = (key, label) =>
    `<a class="action" href="${routes[key]}" data-route="${routes[key]}">${esc(label)} <span aria-hidden="true">↗</span></a>`;
  let s,
    generation = 0,
    readSerial = 0,
    copySerial = 0,
    copyTimer,
    trigger;
  function sorted() {
    const p = (v) =>
      v.status === "degraded" || v.status === "critical" || Number(v.failed_count) > 0
        ? 0
        : v.status === "healthy"
          ? 1
          : 2;
    return [...s.data.provider_health].sort((a, b) => p(a) - p(b));
  }
  function visible() {
    return s.expanded ? sorted() : sorted().slice(0, 8);
  }
  function scene(name = "normal") {
    clearTimeout(copyTimer);
    generation++;
    copySerial++;
    s = {
      name,
      data: clone(D.dashboard),
      window: "24h",
      state: "ready",
      pending: null,
      mode: "success",
      error: "",
      expanded: false,
      superadmin: false,
      hidden: [],
      freeze: true,
      density: "standard",
      copy: "",
      requestId: "m06-02-e2e",
      intents: [],
      nav: [],
      active: true,
    };
    if (name === "superadmin") s.superadmin = true;
    if (["trend", "trend_single", "trend_zero", "only_trend"].includes(name))
      s.data.task_trend = clone(D.trend);
    if (name === "trend_single") s.data.task_trend = [clone(D.trend[0])];
    if (name === "trend_zero")
      s.data.task_trend.forEach((p) => {
        p.succeeded = 0;
        p.failed = 0;
      });
    if (name === "null_rate") s.data.summary.task_success_rate = null;
    if (name === "zero_rate") s.data.summary.task_success_rate = 0;
    if (["empty", "only_trend"].includes(name)) {
      s.state = "empty";
      s.data.summary = {};
      s.data.queues = [];
      s.data.alerts = [];
      s.data.provider_health = [];
    }
    if (
      ["loading", "blocked", "timeout", "offline", "forbidden", "expired", "rate_limited"].includes(
        name,
      )
    )
      s.state = name;
    if (name === "loading") s.requestId = "";
    if (name === "refreshing") s.pending = { id: ++readSerial, generation, window: s.window };
    if (name.startsWith("refresh_") && name !== "refreshing") {
      s.error = name;
      if (name === "refresh_failed") s.window = "7d";
    }
    if (name.startsWith("window")) {
      s.window = name.slice(6);
      s.data.window = s.window;
    }
    if (["many_providers", "all_providers"].includes(name)) {
      s.data.provider_health = clone(D.providers15);
      s.data.summary.enabled_providers = 15;
      s.expanded = name === "all_providers";
    }
    if (name === "no_providers") {
      s.data.provider_health = [];
      s.data.summary.enabled_providers = 0;
    }
    if (name === "unknown_provider") s.data.provider_health[1].status = "critical";
    if (name === "long_fields") {
      s.data.provider_health[1].name =
        "供应商公开页 · 跨境消费品行业动态与新品资料观察来源（长名称合成可读性测试）";
      s.data.provider_health[1].id = "synthetic-provider-" + "abcdef0123456789".repeat(5);
      s.requestId = "synthetic-request-" + "abcdef0123456789".repeat(5);
    }
    if (name === "no_alerts") s.data.alerts = [];
    if (name === "no_queues") s.data.queues = [];
    if (name === "one_column") s.hidden = [1, 2, 3];
    if (name === "compact") s.density = "compact";
    if (name === "unfrozen") s.freeze = false;
    if (name === "copy_success") s.copy = "copied";
    if (name === "copy_failed") s.copy = "failed";
    window.PLATFORM_OVERVIEW_C_CLIPBOARD = async () => {
      if (s.name === "copy_failed") throw new Error("synthetic denied");
    };
    const url = new URL(location.href);
    url.searchParams.set("window", s.window);
    history.replaceState({}, "", url);
    render();
  }
  function technical() {
    return `<details class="technical-footer" ${["technical", "copy_success", "copy_failed", "long_fields"].includes(s.name) ? "open" : ""}><summary>技术详情 · 请求编号</summary>${s.requestId ? `<dl><dt>本次请求编号</dt><dd><code>${esc(s.requestId)}</code><button id="copy">${s.copy === "copied" ? "已复制" : "复制"}</button></dd></dl><p id="copy-result" class="sub" role="status">${s.copy === "failed" ? "复制失败，请手动选取编号。" : s.copy === "copied" ? "已写入合成剪贴板适配器。" : "审核工具只使用合成编号，不读取系统剪贴板。"}</p>` : '<p class="sub">尚无请求编号。</p>'}</details>`;
  }
  function trendView() {
    const rows = s.data.task_trend,
      total = (key) => rows.reduce((v, p) => v + (Number(p[key]) || 0), 0),
      max = Math.max(1, ...rows.flatMap((r) => [r.succeeded, r.failed]));
    const points = (key) =>
      rows
        .map(
          (r, i) =>
            `${rows.length < 2 ? 0 : (i * 600) / (rows.length - 1)},${170 - ((Number(r[key]) || 0) * 150) / max}`,
        )
        .join(" ");
    const dots = (key, color) =>
      rows
        .map(
          (r, i) =>
            `<circle cx="${rows.length < 2 ? 0 : (i * 600) / (rows.length - 1)}" cy="${170 - ((Number(r[key]) || 0) * 150) / max}" r="4" fill="${color}"/>`,
        )
        .join("");
    const rate = s.data.summary.task_success_rate;
    return `<section class="surface" id="trend"><header class="section-head"><div><p class="eyebrow">02 / WINDOW</p><h2>任务结果趋势</h2></div>${link("tasks", "查看任务")}</header><div class="pad"><span class="label">窗内终态成功率</span> <b id="success-rate">${rate === null || rate === undefined ? "暂无样本" : Number(rate).toFixed(1) + "%"}</b></div>${rows.length ? `<div class="trend-totals"><span>成功<b>${total("succeeded")}</b></span><span>失败<b>${total("failed")}</b></span></div><div class="chart"><svg viewBox="-6 0 612 184" role="img" aria-label="趋势样本成功${total("succeeded")}、失败${total("failed")}；下方可展开逐点数据"><path d="M0 20H600M0 95H600M0 170H600" stroke="#dbe1e9" fill="none"/><polyline data-trend="succeeded" points="${points("succeeded")}" fill="none" stroke="#254a9c" stroke-width="3"/><polyline data-trend="failed" points="${points("failed")}" fill="none" stroke="#8c3c32" stroke-dasharray="6 5" stroke-width="3"/>${dots("succeeded", "#254a9c")}${dots("failed", "#8c3c32")}</svg><div class="trend-times"><span>${time(rows[0].bucket)}</span><span>${rows.length > 1 ? time(rows.at(-1).bucket) : "单个观测桶"}</span></div><details id="trend-text"><summary>逐点数据 · 文本替代</summary><dl>${rows.map((r) => `<dt>${time(r.bucket)}</dt><dd>成功 ${r.succeeded} / 失败 ${r.failed}</dd>`).join("")}</dl></details></div>` : `<div class="empty"><h3>所选范围暂无趋势样本</h3><p class="sub">暂无曲线不等于成功率为零，也不代表后台已停止。</p>${link("sources", "查看热点来源")} ${link("progress", "查看采集进度")}</div>`}<div class="pad"><p class="scope">任务按更新时间入窗。成功率直接展示后端值；趋势和来源数据不可用来替算。</p></div></section>`;
  }
  function providersView() {
    const rows = visible(),
      columns = ["来源", "状态", "成功 / 失败", "最近观测"],
      first = columns.findIndex((_, i) => !s.hidden.includes(i));
    const cell = (html, i, tag = "td") =>
      `<${tag} ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === first ? "frozen" : ""}">${html}</${tag}>`;
    return `<section class="surface" id="providers"><header class="section-head"><div><p class="eyebrow">03 / SOURCES</p><h2>来源健康</h2><p class="sub">先异常，再健康与待观测；窗内观测</p></div>${link("sources", "管理来源")}</header>${rows.length ? `<div class="table-tools"><details id="columns" ${["columns", "one_column"].includes(s.name) ? "open" : ""}><summary>列设置</summary><div class="column-options">${columns.map((label, i) => `<label for="col-${i}"><input id="col-${i}" data-column="${i}" type="checkbox" ${s.hidden.includes(i) ? "" : "checked"} ${!s.hidden.includes(i) && s.hidden.length === 3 ? "disabled" : ""}>${label}</label>`).join("")}</div></details><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "首列已冻结" : "首列未冻结"}</button><label for="density">表格密度 <select id="density"><option value="standard" ${s.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-scroll"><table class="${s.density}" id="provider-table"><thead><tr>${columns.map((v, i) => cell(v, i, "th")).join("")}</tr></thead><tbody>${rows.map((r) => `<tr data-provider="${esc(r.id)}">${[esc(r.name), badge(r.status, providerStatus(r.status)), `${r.success_count} / ${r.failed_count}`, time(r.last_observed_at)].map((v, i) => cell(v, i)).join("")}</tr>`).join("")}</tbody></table></div><div class="mobile-records">${rows.map((r) => `<button class="provider-card" data-preview="${esc(r.id)}" aria-haspopup="dialog"><b class="name">${esc(r.name)}</b><span class="line">${badge(r.status, providerStatus(r.status))}<span>成功 ${r.success_count} / 失败 ${r.failed_count}</span><span>查看详情 →</span></span></button>`).join("")}</div><div class="provider-end"><p class="sub">显示 ${rows.length} / ${sorted().length} 个来源 · 本地展开</p>${sorted().length > 8 ? `<button id="expand" aria-expanded="${s.expanded}">${s.expanded ? "收起至8个" : "查看全部15个来源"}</button>` : ""}</div>` : '<div class="empty"><h3>尚无启用来源</h3><p class="sub">当前列表为空，不假设来源已停用或发生故障。</p></div>'}</section>`;
  }
  function content() {
    const d = s.data,
      sum = d.summary;
    const alertLabels = {
      title_accuracy: "标题准确性需要检查",
      parser_changed: "页面解析规则可能变化",
    };
    const signals = {
      mysql: "数据库",
      queue: "任务队列",
      expired_leases: "过期任务租约",
      data_quality: "数据质量",
    };
    const queueLabels = { queued: "等待处理", retry_scheduled: "稍后重试" };
    return `<div class="observation"><span>快照范围：<b id="observed-window">${windows[d.window]}</b></span><span>观测 ${time(d.observed_at)} CST</span><span>审核夹具，不是线上数据</span></div>${s.error ? `<div class="notice error" role="alert"><div><b>${s.error === "refresh_timeout" ? "刷新超过12秒" : "刷新失败"}，仍显示旧快照</b><p>已选 ${windows[s.window]}；数据来自 ${windows[d.window]}。${["refresh_forbidden", "refresh_expired"].includes(s.error) ? "权限或登录错误仍保留旧数据是源码边界，处置方案待审。" : "未取得新的观测结果。"}</p></div><button id="retry">重新刷新</button></div>` : ""}<section class="surface" id="attention"><div class="response"><div class="response-main"><p class="eyebrow">01 / NEEDS ATTENTION</p><h2>先处理需要关注的问题</h2><div class="number">${sum.open_alerts}<span>需要关注</span></div><p class="sub">未解决质量问题 + 窗内失败任务与过期租约</p>${link("root", "按错误根因查看异常")}</div><div class="response-side"><span class="label">窗内更新的待处理任务</span><strong class="queue-value">${sum.queue_backlog}</strong><p class="sub">包含排队、领取、运行、解析、校验和重试。</p>${link("tasks", "进入采集任务")}</div></div><div class="pad"><header class="section-head"><h3>近期告警</h3><span class="sub">本次返回 ${d.alerts.length} 条 · 非总量</span></header>${d.alerts.length ? `<ul class="row-list">${d.alerts.map((a) => `<li class="alert-row"><div class="line"><b>${esc(alertLabels[a.code] ?? "未分类问题")}</b>${badge(a.severity)}</div><p class="sub">${time(a.observed_at)}</p><details ${s.name === "alert_details" ? "open" : ""}><summary>关联组织与工作区</summary><dl><dt>告警编号</dt><dd>${esc(a.id)}</dd><dt>组织编号</dt><dd>${esc(a.organization_id ?? "未提供")}</dd><dt>工作区编号</dt><dd>${esc(a.workspace_id ?? "未提供")}</dd></dl></details></li>`).join("")}</ul>` : '<p class="scope">本次没有返回近期告警；不能据此将需要关注总量改为零。</p>'}</div></section><div class="two-cols">${trendView()}<section class="surface" id="health"><header class="section-head"><div><p class="eyebrow">SYSTEM / SNAPSHOT</p><h2>系统观测与文件</h2></div></header><div class="pad"><div class="health-list">${d.health_signals.map((v) => `<div class="line"><span>${signals[v.code] ?? "系统检查"}</span><span>${badge(v.status)} ${typeof v.value === "number" ? v.value + " 个" : "正常"}</span></div>`).join("")}</div><div class="storage"><div><span class="label">当前有效文件</span><b>${bytes(sum.storage_bytes)}</b></div><div><span class="label">窗内文件增长</span><b>+${bytes(sum.file_growth_bytes)}</b></div></div>${link("data", "查看数据")}<p class="scope">这是已记录文件大小，不是磁盘使用率；没有容量上限或剩余空间数据。</p></div></section></div>${providersView()}<div class="two-cols"><section class="surface" id="queues"><header class="section-head"><div><p class="eyebrow">CURRENT / QUEUE</p><h2>当前队列状态</h2></div></header><div class="pad">${d.queues.length ? d.queues.map((q) => `<div class="queue-row"><span>${queueLabels[q.status] ?? "其他状态"}</span><div class="bar" aria-hidden="true"><span style="width:${Math.max(4, Math.min(100, q.total * 10))}%"></span></div><b>${q.total}</b></div>`).join("") : "<p>当前没有返回积压或失败队列记录。</p>"}<p class="scope">全部当前状态，不受本页时间窗过滤。条宽只辅助比较，不表示容量占比；不与窗内待处理数量强行相等。</p></div></section><section class="surface" id="scale"><header class="section-head"><div><p class="eyebrow">CURRENT / SCALE</p><h2>平台规模</h2></div></header><div class="facts">${[
      ["活跃组织", sum.active_organizations, "orgs", "查看组织"],
      ["活跃用户", sum.active_users, "users", "查看用户"],
      ["启用来源", sum.enabled_providers, "sources", "查看来源"],
    ]
      .map(
        ([label, v, key, l]) =>
          `<div class="fact"><span class="label">${label}</span><b>${v}</b>${s.superadmin || key === "sources" ? link(key, l) : "<small>仅超管可看明细</small>"}</div>`,
      )
      .join(
        "",
      )}</div><div class="pad"><p class="scope">当前规模，不是所选时间窗内新增数量。</p></div></section></div><div class="utility-links">${s.superadmin ? link("orgs", "管理组织和用户") : ""}${link("sources", "查看热点来源")}${link("progress", "查看采集进度")}</div>${technical()}`;
  }
  function terminal() {
    const labels = {
      loading: ["正在准备平台观测", "正在读取组织、用户、来源与采集结果。"],
      empty: [
        "平台还没有可展示的业务事实",
        "请先核对来源与组织配置；后台自动获取不依赖此页保持打开。",
      ],
      blocked: ["平台观测暂时不可用", "请稍后重试；持续失败时检查统一后端。"],
      timeout: ["请求超过12秒", "请检查API与数据库状态，再重新读取。"],
      offline: ["无法连接到服务", "连接恢复后可重新读取；没有取得当前快照。"],
      forbidden: ["当前账号无平台管理权限", "请联系超级管理员分配平台管理权限。"],
      expired: ["登录已失效", "重新登录后再进入平台运行概览，不承诺自动返回。"],
      rate_limited: ["刷新太频繁", "稍等片刻再读取，不影响后台采集。"],
    };
    const [title, body] = labels[s.state];
    return `<section class="terminal" role="status"><p class="eyebrow">PLATFORM / ${esc(s.state.toUpperCase())}</p><h2>${title}</h2><p>${body}</p>${s.name === "only_trend" ? '<p class="scope">源边界：响应含3个趋势桶，但现有空态判定未计入趋势。本稿不擅自改变业务判定。</p>' : ""}<div class="actions">${!["loading", "expired", "forbidden"].includes(s.state) ? '<button id="retry" class="primary">重新读取</button>' : ""}${s.state === "expired" ? link("login", "重新登录") : ""}</div>${technical()}</section>`;
  }
  function render() {
    const oldDialog = document.querySelector("dialog");
    if (oldDialog?.open) oldDialog.close();
    document.querySelector("#app").innerHTML =
      `<div class="review-bar"><span>P38 · PLATFORM-OVERVIEW-C-r1 · 独立审核稿 / 未上线</span><div class="review-picker"><label for="scene">审核场景</label><select id="scene">${Object.entries(
        names,
      )
        .map(
          ([key, label]) =>
            `<option value="${key}" ${s.name === key ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></div></div><div class="shell"><aside class="rail"><div class="brand">ScoutOps <span class="sub" style="color:#d4e0fb">/ 平台</span></div><p class="eyebrow">运行观察目录</p><nav aria-label="本页目录">${[
        ["attention", "01 需要关注"],
        ["trend", "02 任务结果"],
        ["providers", "03 来源健康"],
        ["queues", "04 当前队列"],
        ["scale", "05 平台规模"],
      ]
        .map(([id, label]) => `<a href="#${id}">${label}</a>`)
        .join(
          "",
        )}</nav><div class="rail-note"><b>观察 → 判断 → 进入控制台</b><p>本页不直接重放任务、启停来源或处理告警。</p></div></aside><main class="workspace"><header class="page-head"><div><p class="eyebrow">PLATFORM OPERATIONS</p><h1>平台运行概览</h1><p class="intro">先看异常，再进入对应控制台。</p></div><div class="read-controls"><label for="window"><span class="label">观察时间窗</span><select id="window" ${s.pending || s.state === "loading" ? "disabled" : ""}>${Object.entries(
        windows,
      )
        .map(
          ([v, label]) =>
            `<option value="${v}" ${s.window === v ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></label><button id="refresh" class="primary" ${s.pending || s.state === "loading" ? "disabled" : ""}>${s.pending || s.state === "loading" ? "读取中…" : "刷新"}</button></div></header>${s.name === "controls" ? `<section class="surface"><header class="section-head"><h2>公共按钮六态 · 审核工具</h2></header><div class="tool-board"><button>默认</button><button class="forced-hover">悬停</button><button class="forced-focus">聚焦</button><button class="forced-pressed">按下</button><button disabled>禁用</button><button disabled>读取中…</button></div></section>` : ""}${s.state === "ready" ? content() : terminal()}<p class="review-outcome" role="status" id="navigation-result">${s.nav.length ? "跳转意图：" + esc(s.nav.at(-1)) : "审核工具拦截控制台跳转，不调用真实接口。"}</p></main></div><dialog class="preview" aria-labelledby="preview-title"><header class="preview-head"><h2 id="preview-title">来源预览</h2><button id="preview-close">关闭</button></header><div class="preview-body"></div></dialog>`;
    if (s.state !== "ready")
      document.querySelector(".rail nav").innerHTML = "<p>读取成功后显示观察目录</p>";
    document.querySelector("#scene").onchange = (e) => scene(e.target.value);
    document.querySelector("#window").onchange = (e) => {
      s.window = e.target.value;
      const u = new URL(location.href);
      u.searchParams.set("window", s.window);
      history.replaceState({}, "", u);
      read();
    };
    document.querySelector("#refresh").onclick = read;
    document.querySelector("#retry")?.addEventListener("click", read);
    document.querySelector("#expand")?.addEventListener("click", () => {
      s.expanded = !s.expanded;
      render();
      document.querySelector("#expand")?.focus();
    });
    document.querySelector("#freeze")?.addEventListener("click", () => {
      s.freeze = !s.freeze;
      render();
      document.querySelector("#freeze")?.focus();
    });
    document.querySelector("#density")?.addEventListener("change", (e) => {
      s.density = e.target.value;
      render();
      document.querySelector("#density")?.focus();
    });
    document.querySelectorAll("[data-column]").forEach(
      (n) =>
        (n.onchange = () => {
          const i = Number(n.dataset.column);
          if (s.hidden.includes(i)) s.hidden = s.hidden.filter((x) => x !== i);
          else if (s.hidden.length < 3) s.hidden.push(i);
          render();
          document.querySelector("#columns").open = true;
          document.querySelector("#col-" + i).focus();
        }),
    );
    document.querySelectorAll("[data-route]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          s.nav.push(a.dataset.route);
          document.querySelector("#navigation-result").textContent = "跳转意图：" + a.dataset.route;
        }),
    );
    document
      .querySelectorAll("[data-preview]")
      .forEach((n) => (n.onclick = () => preview(n.dataset.preview, n)));
    document.querySelector("#copy")?.addEventListener("click", copy);
  }
  function read() {
    if (s.pending || !s.active) return;
    s.pending = { id: ++readSerial, generation, window: s.window };
    s.error = "";
    s.intents.push({ method: "GET", path: D.windows[s.window] });
    if (s.state !== "ready") {
      s.state = "loading";
      s.requestId = "";
    }
    render();
    if (s.mode !== "hold") complete(s.mode);
  }
  function complete(result = "success", id = s.pending?.id) {
    const pending = s.pending;
    if (!pending || id !== pending.id || pending.generation !== generation || !s.active)
      return false;
    s.pending = null;
    s.requestId = result === "success" ? "synthetic-refresh-request" : "synthetic-failure-request";
    copySerial++;
    s.copy = "";
    if (result === "success") {
      s.data = clone(D.dashboard);
      s.data.window = pending.window;
      s.state = "ready";
      s.error = "";
    } else if (s.state === "ready")
      s.error =
        result === "timeout"
          ? "refresh_timeout"
          : result === "forbidden"
            ? "refresh_forbidden"
            : result === "expired"
              ? "refresh_expired"
              : "refresh_failed";
    else
      s.state = ["expired", "forbidden", "rate_limited", "timeout", "offline"].includes(result)
        ? result
        : "blocked";
    render();
    return true;
  }
  async function copy() {
    clearTimeout(copyTimer);
    const owner = generation,
      serial = ++copySerial,
      value = s.requestId;
    try {
      await window.PLATFORM_OVERVIEW_C_CLIPBOARD(value);
      if (owner === generation && serial === copySerial && value === s.requestId && s.active)
        s.copy = "copied";
    } catch {
      if (owner === generation && serial === copySerial && value === s.requestId && s.active)
        s.copy = "failed";
    }
    if (owner !== generation || serial !== copySerial || !s.active) return;
    const details = document.querySelector(".technical-footer");
    if (details) {
      const open = details.open;
      details.outerHTML = technical();
      document.querySelector(".technical-footer").open = open;
      document.querySelector("#copy")?.addEventListener("click", copy);
      document.querySelector("#copy")?.focus();
    }
    if (s.copy === "copied")
      copyTimer = setTimeout(() => {
        if (owner !== generation || serial !== copySerial || value !== s.requestId || !s.active)
          return;
        s.copy = "";
        const button = document.querySelector("#copy"),
          result = document.querySelector("#copy-result");
        if (button) button.textContent = "复制";
        if (result) result.textContent = "审核工具只使用合成编号，不读取系统剪贴板。";
      }, 1500);
  }
  function preview(id, element) {
    const row = s.data.provider_health.find((p) => p.id === id);
    if (!row) return;
    trigger = element;
    const dialog = document.querySelector("dialog");
    dialog.querySelector(".preview-body").innerHTML =
      `<p class="eyebrow">READ ONLY / ${windows[s.data.window]}</p><h3>${esc(row.name)}</h3>${badge(row.status, providerStatus(row.status))}<dl><dt>成功</dt><dd>${row.success_count}</dd><dt>失败</dt><dd>${row.failed_count}</dd><dt>观测次数</dt><dd>${row.observed_count}</dd><dt>最近观测</dt><dd>${time(row.last_observed_at)}</dd></dl><details id="provider-technical"><summary>来源技术详情</summary><dl><dt>来源编号</dt><dd>${esc(row.id)}</dd><dt>来源编码</dt><dd>${esc(row.code)}</dd><dt>原始状态</dt><dd>${esc(row.status)}</dd></dl></details><p class="scope">只读预览，不包含启停或来源测试。关闭后返回原记录。</p>`;
    dialog.showModal();
    dialog.querySelector("#preview-close").focus();
    dialog.onkeydown = (e) => {
      if (e.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll("button,summary,a[href],input,select")].filter(
        (n) => !n.disabled && n.getClientRects().length,
      );
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.onclose = () => trigger?.isConnected && trigger.focus();
    dialog.querySelector("#preview-close").onclick = () => dialog.close();
    dialog.onclick = (e) => {
      const r = dialog.getBoundingClientRect();
      if (
        e.target === dialog &&
        (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      )
        dialog.close();
    };
  }
  window.PLATFORM_OVERVIEW_C = {
    scenes: names,
    scene,
    state: () => clone(s),
    visible,
    read,
    complete,
    setMode: (m) => {
      s.mode = m;
    },
    leave: () => {
      clearTimeout(copyTimer);
      generation++;
      copySerial++;
      s.active = false;
      s.pending = null;
      document.querySelector("dialog")?.close();
    },
    activate: () => {
      s.active = true;
    },
    preview,
  };
  scene();
})();
