/* Offline review proposal only. All I/O is recorded as intent, never transmitted. */
(() => {
  const D = window.CHANNEL_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s],
    );
  const route = { query: Object.fromEntries(new URL(location.href).searchParams) },
    reviewMode = new URL(location.href).searchParams.has("review");
  const c = window.CHANNEL_C_SOURCE({
    ref: (value) => ({ value }),
    computed: (fn) => ({
      get value() {
        return fn();
      },
    }),
    reactive: (v) => v,
    watch: () => {},
    onMounted: () => {},
    defineProps: () => ({ apiBaseUrl: "" }),
    useRoute: () => route,
    useRouter: () => ({
      replace: ({ query }) => {
        route.query = query;
        const url = new URL(location.href);
        url.search = "";
        for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, v);
        history.replaceState(null, "", url);
      },
    }),
    createApiClient: () => () => {
      throw Error("Real requests disabled");
    },
    ApiClientError: Error,
    window,
    document,
    AbortController,
    DOMException,
  });
  const app = document.querySelector("#app"),
    dialog = document.querySelector("#dialog");
  let phase,
    scope,
    note,
    selected,
    expanded,
    mobileDetail,
    modal,
    owner = 0,
    sequence = 0,
    revision = 0,
    intents = [],
    reads = {},
    write = null,
    unknown = false,
    returnId,
    modalData,
    modalNote,
    errors,
    reviewReasons = {},
    replayResult = null,
    technical = false;
  const scenes = {
    default: "原146项来源目录",
    filters: "移动筛选展开",
    name: "名称排序",
    attention: "待配置优先",
    recent: "最近成功排序",
    query: "搜索Amazon",
    category: "业务类型",
    availability: "手动来源",
    market: "市场",
    language: "语言",
    "access-mode": "接入模式",
    combined: "组合筛选",
    "no-match": "无匹配结果",
    "page-two": "第二页",
    "page-eight": "末页",
    linked: "provider_id精确定位",
    "linked-missing": "关联来源缺失",
    "detail-public": "公开页面详情",
    "detail-login": "登录来源详情",
    "detail-import": "导入来源详情",
    "detail-unregistered": "合成未登记来源",
    "long-content": "合成长来源",
    loading: "初次加载",
    empty: "空目录",
    expired: "登录过期",
    forbidden: "权限拒绝",
    blocked: "依赖受阻",
    error: "读取失败",
    refreshing: "刷新保留目录",
    "refresh-error": "刷新失败保留目录",
    config: "编辑登录来源",
    "config-missing": "原夹具缺配置字段",
    "config-smoke": "启用前烟测提示",
    "config-invalid": "配置字段错误",
    "config-saving": "停用配置保存中",
    "config-testing": "真实烟测进行中",
    "config-enabling": "启用写入中",
    "config-partial": "停用已保存烟测失败",
    "config-error": "配置冲突",
    "config-unknown": "配置结果未知",
    "config-success": "配置保存成功",
    "config-reload-error": "写成功目录重读失败",
    versions: "配置历史",
    "versions-loading": "历史加载",
    "versions-empty": "无历史版本",
    "versions-error": "历史读取失败",
    "rollback-busy": "回滚进行中",
    "rollback-conflict": "回滚版本冲突",
    "rollback-success": "回滚生成新版本",
    samples: "原审批样本",
    "samples-candidate": "合成候选作业",
    "samples-empty": "无固定样本",
    "samples-loading": "样本加载",
    "samples-error": "样本读取失败",
    "sample-create-busy": "固定候选中",
    "sample-create-success": "已固定待核对",
    "sample-replay-busy": "差异回放中",
    "sample-passed": "合成回放通过",
    "sample-changed": "合成回放差异",
    "sample-failed": "合成解析失败",
    "sample-self": "合成创建人不可自审",
    "sample-approved": "合成已批准",
    "sample-rejected": "合成已驳回",
    "sample-review-busy": "审批写入中",
    "sample-review-error": "审批冲突",
    "sample-technical": "样本技术详情",
    matrix: "原兼容观测",
    "matrix-loading": "矩阵加载",
    "matrix-empty": "无页面观测",
    "matrix-missing": "来源无适配器记录",
    "matrix-error": "矩阵请求失败",
    "matrix-states": "合成四种兼容状态",
    "matrix-technical": "完整页面指纹",
    probe: "匿名测试中",
    "probe-ready": "合成匿名探针通过",
    "probe-blocked": "合成匿名探针受阻",
    "probe-error": "匿名探针请求失败",
    focus: "键盘焦点",
    hover: "悬停",
    pressed: "按下",
    "review-tools": "非业务审核工具",
  };
  const pair = (label, value) => `<div><dt>${label}</dt><dd>${esc(value ?? "未提供")}</dd></div>`;
  const link = (text, path, external = false) =>
    `<a class="route-link" href="${external ? esc(path) : "#"}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""} data-route="${esc(path)}" data-external="${external}">${text}</a>`;
  const badge = (text, alert = false) =>
    `<span class="pill" data-alert="${alert}">${esc(text)}</span>`;
  const time = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }) + " UTC+8"
      : "未提供";
  const can = (i) => ({
    config: !!i.provisioned,
    versions: !!i.provisioned,
    matrix: !!i.provisioned && ["public_page", "authenticated_browser"].includes(i.access_mode),
    samples: !!i.provisioned && i.code === "1688_search",
    probe:
      !!i.provisioned &&
      i.availability === "automatic" &&
      ["public_page", "public_rss"].includes(i.access_mode),
  });
  const blockedWrite = () => !!write || unknown;
  const button = (text, action, extra = "", disabled = false) =>
    `<button type="button" data-action="${action}" ${extra} ${disabled ? "disabled" : ""}>${text}</button>`;
  function filters() {
    const options = {
      category: [
        ["news", "新闻"],
        ["ecommerce", "电商平台"],
        ["data", "趋势数据"],
        ["community", "论坛社区"],
        ["product_supply", "商品供应链"],
      ],
      availability: [
        ["automatic", "自动采集目录"],
        ["setup_required", "需要完成配置"],
        ["manual", "手动来源"],
      ],
      market: c.marketOptions.value.map((v) => [v, v]),
      language: c.languageOptions.value.map((v) => [v, v]),
      accessMode: [
        ["public_rss", "公开 RSS/Atom"],
        ["public_page", "公开页面"],
        ["authenticated_browser", "网页登录"],
        ["import", "文件导入"],
        ["manual", "人工录入"],
      ],
      sort: [
        ["business", "业务目录顺序"],
        ["attention", "待配置优先"],
        ["name", "名称顺序"],
        ["recent", "最近成功任务"],
      ],
    };
    return `<section class="filters ${expanded ? "expanded" : ""}" aria-label="来源筛选"><label class="query">搜索来源<input type="search" id="query" data-filter="query" value="${esc(c.query.value)}" placeholder="名称、代码、国家或来源网址"></label><button type="button" id="filter-toggle" data-action="filters" aria-expanded="${expanded}">${expanded ? "收起筛选" : "筛选与排序"}</button>${Object.entries(
      options,
    )
      .map(
        ([key, list]) =>
          `<label>${{ category: "业务类型", availability: "准备状态", market: "市场", language: "语言", accessMode: "接入模式", sort: "排序" }[key]}<select id="${key}" data-filter="${key}">${(key === "sort" ? list : [["", "全部"], ...list]).map(([v, t]) => `<option value="${v}" ${c[key].value === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`,
      )
      .join("")}<button type="button" id="reset" data-action="reset">重置筛选</button></section>`;
  }
  function detail() {
    const i = c.items.value.find((i) => i.code === selected);
    if (!i) return `<section class="source-detail"><p>选择一个来源查看详情。</p></section>`;
    const a = can(i),
      p = i.provisioned;
    return `<section class="source-detail" aria-label="当前来源详情"><button type="button" id="back-list" data-action="back-list">返回来源目录</button><h2>${esc(i.name)}</h2>${badge(c.statusText(i), c.effectiveAvailability(i) === "setup_required")}<p>目录准备状态不等于实时调度证明；最近成功记录单独列出。</p><dl>${pair("采集方式", c.modeText(i.access_mode))}${pair("来源状态", p?.status ?? "尚未登记")}${pair("采集频率", `${p?.schedule_minutes ?? i.schedule_minutes} 分钟`)}${pair("超时 / 重试", `${p?.timeout_ms ?? i.timeout_ms} ms / ${p?.retry_limit ?? i.retry_limit} 次`)}${pair("负责人", i.owner_label ?? "原始夹具未提供")}${pair("最近成功", c.successText(i))}${pair("更新目标", c.slaText(i))}</dl><p>更新目标沿用采集计划，不是实际测得的 SLA 或达标率。</p>${a.config ? button("编辑采集设置", "config", 'id="edit" class="primary"') : ""}<div class="secondary-actions">${a.probe ? button(write?.kind === "probe" ? "测试中…" : "匿名测试", "probe", 'id="probe"', blockedWrite()) : ""}${a.versions ? button("版本与回滚", "versions", 'id="versions"') : ""}${a.matrix ? button("解析兼容矩阵", "matrix", 'id="matrix"') : ""}${a.samples ? button("固定样本回放", "samples", 'id="samples"') : ""}</div><div class="secondary-actions">${i.access_mode === "authenticated_browser" ? link("配置网页登录", `/platform-admin/credentials?provider_code=${encodeURIComponent(i.code)}&mode=login`) : ""}${i.code === "1688_search" ? link("登录准备状态", "/platform-admin/providers/sources/1688-acceptance") : ""}${i.target_url.startsWith("https://") ? link("查看来源页面", i.target_url, true) : ""}</div>${!p && i.access_mode !== "authenticated_browser" ? "<p>等待系统登记；本页没有独立登记按钮。</p>" : ""}<details ${technical ? "open" : ""}><summary>范围、策略与技术详情</summary><dl>${pair("来源代码", i.code)}${pair("来源 ID", p?.id ?? "未登记")}${pair("市场 / 语言", `${i.markets.join(" / ")} / ${i.languages.join(" / ")}`)}${pair("字段", i.fields.join("、"))}${pair("目标", i.target_url)}${pair("配置版本", p?.version)}${pair("目录策略", c.policyText(i))}</dl><p>策略文案由源规则派生，不能独立证明网页登录验收或当前采集运行。</p></details></section>`;
  }
  function render() {
    const active = document.activeElement,
      id = active?.id,
      pos = active?.selectionStart;
    if (!c.pageItems.value.some((i) => i.code === selected)) {
      selected = c.pageItems.value[0]?.code ?? null;
      mobileDetail = false;
    }
    const ready = ["ready", "empty"].includes(phase),
      count = c.counts.value;
    app.innerHTML = `<div class="workspace"><aside class="directory"><h2>ScoutOps</h2><nav aria-label="来源管理"><a href="#" data-route="/platform-admin/providers">来源设置</a><a href="#" data-route="/platform-admin/providers/adapters">采集程序</a><a href="#" aria-current="page">来源频道</a></nav><p>平台来源目录<br>配置与证据分开核对</p></aside><main class="paper"><header class="page-head"><div><h1>来源频道</h1><p>定位来源，再检查配置与留存证据。登录、样本回放、审批和启用是不同结果。</p></div><div class="actions"><button type="button" id="refresh" data-action="refresh" ${Object.values(reads).some((r) => r.kind === "catalog") ? "disabled" : ""}>刷新来源</button>${link("管理来源规则", "/platform-admin/providers")}</div></header><p class="review-label">P48 / C 方向待审稿 · ${esc(scope)} · 无生产连接</p>${note ? `<div class="notice" role="status">${esc(note)}</div>` : ""}${c.linkedProviderId.value ? `<div class="notice">已限定来源 ID：${esc(c.linkedProviderId.value)}。重置筛选不会清除此关联。</div>` : ""}${ready ? `<div class="scope"><span>目录 <strong>${count.all}</strong></span><span>自动目录 <strong>${count.automatic}</strong></span><span>非谷歌自动目录 <strong>${count.nonGoogle}</strong></span><span>市场 <strong>${count.markets}</strong></span></div>${filters()}${c.filtered.value.length ? `<div id="source-results" class="source-workbench ${mobileDetail ? "mobile-detail" : ""}"><section class="source-index" aria-label="来源目录"><h2>${c.filtered.value.length} 个结果</h2>${c.groupedSources.value.map((g) => `<section class="source-group"><h3>${g.label}</h3><p>本页 ${g.items.length} / 筛选共 ${g.total}</p>${g.items.map((i) => `<button type="button" class="source-row" id="source-${i.code}" data-select="${i.code}" aria-pressed="${selected === i.code}"><strong>${esc(i.name)}</strong><small>${c.statusText(i)} / ${c.categoryText(i.category)}</small><small>${i.provisioned?.last_success ? c.successText(i) : "尚无成功任务"}</small></button>`).join("")}</section>`).join("")}</section>${detail()}</div><nav class="pager" aria-label="来源频道分页"><button type="button" id="prev" data-page="-1" ${c.page.value === 1 ? "disabled" : ""}>上一页</button><span>第 ${c.page.value} / ${c.totalPages.value} 页 · 当前 ${c.resultRange.value.start}–${c.resultRange.value.end}，共 ${c.filtered.value.length} 个来源</span><button type="button" id="next" data-page="1" ${c.page.value === c.totalPages.value ? "disabled" : ""}>下一页</button></nav>` : `<section class="empty"><h2>${c.items.value.length ? "没有符合筛选条件的来源" : "还没有来源目录"}</h2><p>${c.linkedProviderId.value ? "关联 ID 仍然保留；来源也可能不在当前目录中。" : "目录读取与启动采集是两个不同动作。"}</p>${c.items.value.length ? button("重置筛选", "reset") : button("重新读取目录", "refresh")}</section>`}` : `<section class="empty"><h2>${{ loading: "正在读取来源目录", expired: "登录已过期", forbidden: "当前账号不能管理平台来源", blocked: "来源依赖受阻", error: "来源目录读取失败" }[phase]}</h2><p>本稿只演示状态，不执行登录或权限变更。</p>${!["expired", "forbidden", "loading"].includes(phase) ? button("重新读取目录", "refresh") : ""}</section>`}<p class="boundary">完整目录统计不随筛选改变；分组总数与本页行数分开。当前操作只记录离线意图，不发送 GET、POST 或 PUT，不访问来源页面。</p></main></div>`;
    if (modal) renderDialog();
    const next = document.getElementById(id);
    if (next && !next.disabled) {
      next.focus({ preventScroll: true });
      if (next.type === "search" && pos != null) next.setSelectionRange(pos, pos);
    }
  }
  const requiresSmoke = () =>
    c.editing.value?.provisioned?.status !== "enabled" &&
    c.form.status === "enabled" &&
    ["public_page", "public_rss"].includes(c.editing.value?.access_mode);
  function preview() {
    const p = c.configurationPreview.value;
    return p
      ? `<div class="preview"><strong>同频预估 ${p.same_interval_enabled_count} 个来源</strong><p>${c.editing.value.provisioned.concurrency_snapshot ? `并发快照 ${p.active_count} / ${p.configured_limit}，剩余 ${p.available_count}` : `缺少并发快照；源计算回退为 ${p.active_count} / ${p.configured_limit}，不代表实测空闲。`}</p><p>同频不等于必然冲突；没有独立相位，不预测未来任务量。</p></div>`
      : "";
  }
  function diffTable(rows, field = "field") {
    return `<table class="diff"><thead><tr><th>字段 / 路径</th><th>之前</th><th>之后</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[field])}</td><td>${esc(display(r.before))}</td><td>${esc(display(r.after))}</td></tr>`).join("")}</tbody></table>`;
  }
  const display = (v) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s == null ? "未提供" : s.length > 240 ? s.slice(0, 240) + "…" : s;
  };
  function renderDialog() {
    if (!modal) return;
    const focusId = dialog.contains(document.activeElement) ? document.activeElement.id : null;
    const scroll = dialog.scrollTop,
      i = modal.item,
      busy = blockedWrite();
    const loading = Object.values(reads).some(
      (r) => r.owner === modal.owner && r.kind === modal.type,
    );
    let content = "";
    if (modal.type === "config") {
      content = `<div id="form-errors" class="form-errors" role="alert">${errors.map(esc).join("<br>")}</div><div class="field-grid">${[
        ["schedule_minutes", "采集频率（分钟）", 1, 10080],
        ["timeout_ms", "单次超时（毫秒）", 1000, 120000],
        ["retry_limit", "失败重试次数", 0, 10],
      ]
        .map(
          ([key, label, min, max]) =>
            `<label>${label}<input id="${key}" data-form="${key}" type="number" min="${min}" max="${max}" step="1" value="${esc(c.form[key])}" required aria-describedby="form-errors" ${busy ? "disabled" : ""}></label>`,
        )
        .join(
          "",
        )}<label>运行状态<select id="status" data-form="status" ${busy ? "disabled" : ""}><option value="enabled" ${c.form.status === "enabled" ? "selected" : ""}>启用</option><option value="disabled" ${c.form.status === "disabled" ? "selected" : ""}>停用</option></select></label></div><div id="smoke-hint">${requiresSmoke() ? '<p class="notice">先保存停用配置，再访问真实来源烟测；通过后用新版本锁启用。烟测失败时，停用配置可能已经保存。</p>' : ""}</div><div id="preview">${preview()}</div><label class="reason-field">变更原因<textarea id="reason" data-form="reason" minlength="2" maxlength="500" required aria-describedby="form-errors" ${busy ? "disabled" : ""}>${esc(c.form.reason)}</textarea></label><div class="dialog-actions">${button("取消", "close")}${button(write ? "处理中…" : requiresSmoke() ? "烟测并启用" : "保存配置", "save", 'id="save" class="primary"', busy)}</div>`;
    } else if (loading) content = '<p class="empty">正在读取，尚未获得结果…</p>';
    else if (modalData?.error)
      content = `<section class="empty"><p>${esc(modalData.error)}</p>${button("重新读取", "modal-read")}</section>`;
    else if (modal.type === "versions") {
      content = `<p>历史响应当前版本 ${modalData.current_version}；左侧为目录记录版本，两份原始夹具不合并成同一实时快照。</p><p>恢复旧设置会生成新当前版本；不会覆盖历史，也不能绕过来源启用校验。</p><label class="reason-field">回滚原因<textarea id="rollback-reason" minlength="2" maxlength="500" ${busy ? "disabled" : ""}>${esc(c.rollbackReason.value)}</textarea></label>${modalData.versions.length ? modalData.versions.map((v) => `<article class="version"><header><h3>第 ${v.version} 版</h3>${v.current ? badge("当前版本") : v.rollback_available ? button("恢复此版本", "rollback", `data-version="${v.version}"`, busy) : badge("不可恢复")}</header><p>${esc(v.action)} / ${time(v.created_at)}</p>${v.changes.length ? diffTable(v.changes) : "<p>可见采集设置与前版一致。</p>"}</article>`).join("") : "<p class='empty'>还没有可用配置版本。</p>"}`;
    } else if (modal.type === "matrix") {
      content = `<p>只比较仍在保留期内的 DOM/HTML 指纹与解析版本，不显示页面内容，不写入来源状态。</p><p>采集程序：${esc(modalData.adapter_version ?? "未提供")}</p>${modalData.compatibility_matrix.length ? modalData.compatibility_matrix.map((r) => `<article class="matrix-row"><header><h3>sha256:${esc(r.page_version_sha256.slice(0, 12))}</h3>${badge({ compatible: "已兼容", incompatible: "解析不兼容", mixed: "结果不一致", unverified: "待验证" }[r.status], r.status !== "compatible")}</header><dl>${pair("解析器版本", r.parser_version)}${pair("观测次数", r.observation_count)}${pair("成功 / 解析失败", `${r.succeeded_count} / ${r.parser_failure_count}`)}${pair("最近观测", time(r.last_observed_at))}</dl><details ${technical ? "open" : ""}><summary>完整页面指纹</summary><code>${esc(r.page_version_sha256)}</code></details></article>`).join("") : "<p class='empty'>尚无可比较的真实页面版本；缺证据不等于不兼容。</p>"}`;
    } else {
      const replayText = (v) =>
        ({ never: "尚未回放", passed: "一致通过", changed: "发现差异", failed: "解析失败" })[v];
      content = `<p>候选必须同时留存截图、DOM 与结构化快照。回放已存样本不是浏览器重新采集；审批通过不会自动启用。</p><h3>可固定作业</h3>${modalData.candidates.length ? modalData.candidates.map((v) => `<article class="candidate"><header><strong>${time(v.captured_at)}</strong>${button("固定为样本", "sample-create", `data-candidate="${v.browser_job_id}"`, busy)}</header><p>${v.item_count} 条结果</p><details ${technical ? "open" : ""}><summary>候选技术详情</summary><code>${esc(v.browser_job_id)}<br>${esc(v.parser_version)}</code></details></article>`).join("") : "<p>暂无合格候选；先完成真实登录采集。</p>"}<h3>已固定样本</h3>${modalData.samples.length ? modalData.samples.map((s) => `<article class="sample"><header><h3>${esc(s.name)}</h3>${badge(replayText(s.last_replay_status))}</header><p>${{ pending: "待另一管理员审批", approved: "审批通过", rejected: "已驳回" }[s.review_status]}</p>${s.review_reason ? `<p>审批结论：${esc(s.review_reason)}</p>` : ""}${s.review_status === "pending" ? `<label class="reason-field">审批原因<input class="review-reason" id="review-${s.id}" data-review="${s.id}" value="${esc(reviewReasons[s.id] ?? "")}" minlength="2" maxlength="1000" placeholder="${s.can_review ? "填写通过或驳回依据" : "创建人不能审批自己的样本"}" ${!s.can_review || busy ? "disabled" : ""}></label>${s.can_review ? `<div class="secondary-actions">${button("审批通过", "approve", `data-sample="${s.id}"`, busy || (reviewReasons[s.id] ?? "").trim().length < 2)}${button("驳回样本", "reject", `data-sample="${s.id}"`, busy || (reviewReasons[s.id] ?? "").trim().length < 2)}</div>` : ""}` : ""}<div class="secondary-actions">${button("运行差异回放", "sample-replay", `data-sample="${s.id}"`, busy)}</div><details ${technical ? "open" : ""}><summary>样本技术详情</summary><dl>${pair("样本 ID", s.id)}${pair("基线解析版本", s.baseline_parser_version)}${pair("审批版本", s.review_version)}${pair("最后回放", time(s.last_replay_at))}</dl></details></article>`).join("") : "<p>还没有固定样本。</p>"}${replayResult ? `<section class="preview"><h3>本次回放：${replayText(replayResult.status)}</h3><p>目标样本：${esc(replayResult.sampleName)}</p>${replayResult.error_code ? `<p>解析失败：${esc(replayResult.error_code)}。没有自动改变来源启用状态。</p>` : replayResult.diff.length ? diffTable(replayResult.diff, "path") : "<p>字段、路径与结果顺序均与基线一致；仍须核对当前解析版本和第二人审批。</p>"}</section>` : ""}`;
    }
    dialog.innerHTML = `<header class="dialog-head"><h2 id="dialog-title">${{ config: "采集设置", versions: "版本与回滚", samples: "固定样本回放", matrix: "解析兼容矩阵" }[modal.type]}</h2>${button("关闭", "close", 'id="close-dialog"')}</header><div class="dialog-layout"><aside class="identity"><h3>${esc(i.name)}</h3><p>${c.modeText(i.access_mode)}</p><p>目录记录版本 ${i.provisioned?.version ?? "未提供"}</p>${modal.type === "config" ? "<ol><li>保存当前设置</li><li>需要时执行烟测</li><li>使用新版本锁启用</li></ol>" : "<p>结果按当前来源和对象归属。此稿仅供审核，不操作真实来源。</p>"}</aside><div class="dialog-body">${modalNote ? `<div class="notice" role="status">${esc(modalNote)}</div>` : ""}${content}</div></div>`;
    dialog.scrollTop = scroll;
    if (dialog.open && focusId)
      (document.getElementById(focusId)?.disabled
        ? document.querySelector("#close-dialog")
        : document.getElementById(focusId) || document.querySelector("#close-dialog")
      ).focus({ preventScroll: true });
  }
  function open(type, code = selected, trigger = document.activeElement?.id) {
    const item = c.items.value.find((i) => i.code === code);
    if (!item || !can(item)[type]) return false;
    if (dialog.open) dialog.close();
    modal = { type, item: clone(item), owner: ++owner };
    returnId = trigger || "refresh";
    modalNote = "";
    errors = [];
    technical = false;
    replayResult = null;
    if (type === "config") c.beginEdit(modal.item);
    else {
      modalData =
        type === "versions"
          ? clone(D.versions)
          : type === "samples"
            ? clone(D.samples)
            : clone(D.matrix[0]);
      startRead(type);
    }
    renderDialog();
    dialog.showModal();
    document.querySelector("#close-dialog").focus({ preventScroll: true });
    dialog.scrollTop = 0;
    return true;
  }
  function close() {
    modal = null;
    ++owner;
    dialog.close();
    (document.getElementById(returnId) || document.getElementById("refresh")).focus();
  }
  function intent(method, path, body) {
    const value = {
      id: ++sequence,
      method,
      path,
      ...(body === undefined ? {} : { body: clone(body) }),
    };
    intents.push(value);
    return value.id;
  }
  function startRead(kind = "catalog") {
    if (kind === "catalog" && Object.values(reads).some((r) => r.kind === kind)) return null;
    if (kind !== "catalog" && !modal) return null;
    const path =
      kind === "catalog"
        ? "/api/v1/platform/provider-sources"
        : kind === "matrix"
          ? "/api/v1/platform/provider-adapters"
          : `/api/v1/platform/provider-sources/${modal.item.provisioned.id}/${kind === "versions" ? "configuration/versions" : "parser-samples"}`;
    const id = intent("GET", path);
    reads[id] = { id, kind, owner: modal?.owner, revision };
    if (kind === "catalog" && !c.items.value.length) phase = "loading";
    if (kind === "catalog") note = "正在读取目录；已有数据仍可查看。";
    render();
    return id;
  }
  function completeRead(outcome = "success", id = Number(Object.keys(reads).at(-1))) {
    const r = reads[id];
    if (!r) return false;
    delete reads[id];
    if (r.kind !== "catalog" && r.owner !== modal?.owner) return false;
    if (r.kind === "catalog") {
      if (r.revision !== revision) {
        note = "旧目录响应未覆盖新操作结果，请重新刷新核对。";
        render();
        return false;
      }
      if (["success", "empty"].includes(outcome)) {
        if (outcome === "empty") c.items.value = [];
        else if (!c.items.value.length) c.items.value = clone(D.sources);
        phase = c.items.value.length ? "ready" : "empty";
        unknown = false;
        note = "已读取离线目录快照；不代表未知写入已被服务端确认。";
      } else if (c.items.value.length) {
        phase = "ready";
        note = `目录读取${outcome}；保留旧目录，不是最新状态。`;
      } else phase = outcome === "timeout" ? "blocked" : outcome;
      c.page.value = Math.min(c.page.value, c.totalPages.value);
      render();
      return true;
    }
    if (!["success", "empty", "missing"].includes(outcome)) {
      modalData = { error: `读取失败（${outcome}），请重新读取。` };
      modalNote = "保留当前窗口便于恢复，这是提案行为。";
    } else if (r.kind === "versions")
      modalData =
        outcome === "empty"
          ? { current_version: 3, versions: [] }
          : modal.item.provisioned.id === D.versions.provider_id
            ? clone(D.versions)
            : { error: "原夹具没有当前来源的历史响应，不能代用另一来源的版本。" };
    else if (r.kind === "samples")
      modalData = outcome === "empty" ? { candidates: [], samples: [] } : clone(D.samples);
    else
      modalData =
        outcome === "missing" || !D.matrix.some((row) => row.id === modal.item.provisioned.id)
          ? { error: "当前来源没有对应的采集程序观测。" }
          : outcome === "empty"
            ? { adapter_version: null, compatibility_matrix: [] }
            : clone(D.matrix.find((row) => row.id === modal.item.provisioned.id));
    renderDialog();
    return true;
  }
  function validate() {
    const out = [];
    for (const [k, min, max, label] of [
      ["schedule_minutes", 1, 10080, "采集频率"],
      ["timeout_ms", 1000, 120000, "单次超时"],
      ["retry_limit", 0, 10, "失败重试"],
    ])
      if (!Number.isInteger(c.form[k]) || c.form[k] < min || c.form[k] > max)
        out.push(`${label}须为 ${min}–${max} 的整数`);
    if (c.form.reason.trim().length < 2 || c.form.reason.trim().length > 500)
      out.push("变更原因须为 2–500 字");
    return out;
  }
  function save() {
    if (!modal || modal.type !== "config" || blockedWrite()) return null;
    errors = validate();
    if (errors.length) {
      renderDialog();
      return null;
    }
    const snapshot = clone(c.form),
      item = clone(modal.item),
      smoke = requiresSmoke();
    const id = intent(
      "PUT",
      `/api/v1/platform/provider-sources/${item.provisioned.id}/configuration`,
      {
        ...snapshot,
        status: smoke ? "disabled" : snapshot.status,
        expected_version: item.provisioned.version,
      },
    );
    write = {
      id,
      kind: "config",
      stage: smoke ? "save-disabled" : "save",
      owner: modal.owner,
      item,
      snapshot,
      smoke,
      partial: false,
    };
    modalNote = "正在保存；提交内容已冻结。关闭窗口不代表取消写入。";
    render();
    return id;
  }
  function actionWrite(kind, target) {
    if (blockedWrite()) return null;
    const i = kind === "probe" ? c.items.value.find((i) => i.code === selected) : modal?.item;
    if (!i?.provisioned) return null;
    let path, body;
    if (kind === "probe") {
      if (!can(i).probe) return null;
      path = `/api/v1/platform/provider-adapters/${i.provisioned.id}/health-check`;
    } else if (kind === "rollback") {
      const v = modalData.versions.find((v) => v.version === target);
      if (
        !v?.rollback_available ||
        c.rollbackReason.value.trim().length < 2 ||
        c.rollbackReason.value.trim().length > 500
      )
        return null;
      path = `/api/v1/platform/provider-sources/${i.provisioned.id}/configuration/rollbacks`;
      body = {
        target_version: v.version,
        expected_version: modalData.current_version,
        reason: c.rollbackReason.value,
      };
    } else if (kind === "sample-create") {
      const v = modalData.candidates.find((v) => v.browser_job_id === target);
      if (!v) return null;
      path = `/api/v1/platform/provider-sources/${i.provisioned.id}/parser-samples`;
      body = {
        browser_job_id: v.browser_job_id,
        name: `真实登录样本 ${new Date(v.captured_at).toLocaleString("zh-CN")}`,
      };
    } else {
      const s = modalData.samples.find((s) => s.id === target);
      if (!s) return null;
      path = `/api/v1/platform/provider-sources/${i.provisioned.id}/parser-samples/${s.id}/${kind === "sample-replay" ? "replays" : "reviews"}`;
      if (kind !== "sample-replay") {
        const reason = (reviewReasons[s.id] ?? "").trim();
        if (
          !s.can_review ||
          s.review_status !== "pending" ||
          reason.length < 2 ||
          reason.length > 1000
        )
          return null;
        body = {
          decision: kind === "approve" ? "approved" : "rejected",
          reason,
          expected_version: s.review_version,
        };
      }
    }
    const id = intent("POST", path, body);
    write = { id, kind, target, owner: modal?.owner, item: clone(i), body };
    modalNote = "操作进行中；只演示离线请求意图。";
    note = kind === "probe" ? "正在执行匿名探针；不改变来源配置。" : note;
    render();
    return id;
  }
  function complete(outcome = "success", id = write?.id) {
    if (!write || id !== write.id) return false;
    const w = write,
      same = w.owner === modal?.owner;
    if (w.kind === "config" && ["success", "ready"].includes(outcome)) {
      if (w.stage === "save-disabled") {
        w.partial = true;
        w.stage = "smoke";
        w.savedVersion = w.item.provisioned.version + 1;
        if (same)
          Object.assign(modal.item.provisioned, { status: "disabled", version: w.savedVersion });
        const i = c.items.value.find((i) => i.code === w.item.code);
        if (i)
          Object.assign(i.provisioned, w.snapshot, { status: "disabled", version: w.savedVersion });
        intent("POST", `/api/v1/platform/provider-adapters/${w.item.provisioned.id}/health-check`);
        if (same) modalNote = "停用配置已保存。正在执行真实烟测；尚未启用。";
        render();
        return true;
      }
      if (w.stage === "smoke") {
        w.stage = "enable";
        intent("PUT", `/api/v1/platform/provider-sources/${w.item.provisioned.id}/configuration`, {
          ...w.snapshot,
          expected_version: w.savedVersion,
        });
        if (same) modalNote = "合成烟测通过，正在用新版本锁写入启用状态。";
        render();
        return true;
      }
      const i = c.items.value.find((i) => i.code === w.item.code);
      if (i)
        Object.assign(i.provisioned, w.snapshot, {
          version: (w.savedVersion ?? w.item.provisioned.version) + 1,
        });
      if (same)
        Object.assign(modal.item.provisioned, w.snapshot, {
          version: (w.savedVersion ?? w.item.provisioned.version) + 1,
        });
    }
    write = null;
    revision++;
    let text;
    if (outcome === "unknown") {
      unknown = true;
      text = `结果未知，可能已有写入；${w.partial ? "停用配置已保存，启用结果仍须核对。" : "请先刷新核对，不自动重试。"}`;
    } else if (["error", "conflict", "blocked", "forbidden"].includes(outcome))
      text = `${w.partial ? "停用配置已保存；" : ""}${{ error: "请求失败", conflict: "版本冲突", blocked: "检查受阻", forbidden: "权限拒绝" }[outcome]}；${w.kind === "config" ? "未证明启用成功。" : "未获得本次操作成功确认。"}保留提交内容供核对。`;
    else if (w.kind === "probe") text = "合成匿名探针通过；不是完整采集成功，也没有修改来源配置。";
    else if (w.kind === "rollback")
      text = "合成回滚请求成功，将生成新的当前版本；历史不改，需重新读取核对。";
    else if (w.kind === "sample-create")
      text = "合成固定样本请求成功；仍须重新读取、回放与第二人审批。";
    else if (w.kind === "sample-replay") {
      text = "合成回放结果已展示；不自动启用来源。";
      if (same) {
        replayResult = {
          status: outcome === "success" ? "passed" : outcome,
          sampleName: modalData.samples.find((s) => s.id === w.target)?.name ?? w.target,
          error_code: outcome === "failed" ? "synthetic_parse_failed" : null,
          diff:
            outcome === "changed"
              ? [{ path: "$[0].fields.title", before: "合成基线标题", after: "合成变化标题" }]
              : [],
        };
      }
    } else if (["approve", "reject"].includes(w.kind)) {
      text = "合成审批写入成功；没有启用来源。";
      if (same)
        modalData.samples = modalData.samples.map((s) =>
          s.id === w.target
            ? {
                ...s,
                review_status: w.body.decision,
                review_reason: w.body.reason,
                review_version: s.review_version + 1,
                can_review: false,
              }
            : s,
        );
    } else text = "合成配置写入成功；目录读取结果单独核对。";
    note = `${w.item.name}：${text}`;
    if (same) modalNote = text;
    if (w.kind === "config" && w.partial && same && !["success", "ready"].includes(outcome))
      Object.assign(modal.item.provisioned, { status: "disabled", version: w.savedVersion });
    render();
    return true;
  }
  function scene(key, initial = false) {
    if (!scenes[key]) throw Error(`Unknown scene ${key}`);
    if (dialog.open) dialog.close();
    document.activeElement?.blur();
    modal = null;
    ++owner;
    write = null;
    reads = {};
    intents = [];
    revision = 0;
    unknown = false;
    note = "";
    modalNote = "";
    errors = [];
    reviewReasons = {};
    replayResult = null;
    technical = false;
    expanded = key === "filters";
    mobileDetail = false;
    phase = "ready";
    scope = "原始 146 项 E2E 目录";
    c.items.value = clone(D.sources);
    const initialQuery = clone(route.query);
    c.resetFilters();
    c.page.value = 1;
    route.query = initial ? initialQuery : {};
    if (initial) {
      for (const [k, url] of Object.entries({
        query: "q",
        category: "category",
        availability: "availability",
        market: "market",
        language: "language",
        accessMode: "access_mode",
        sort: "sort",
      }))
        if (route.query[url]) c[k].value = route.query[url];
      c.page.value = Math.max(1, parseInt(route.query.page) || 1);
    }
    const test = D.cases.find((t) => t.key === key);
    if (test && !initial) for (const [k, v] of Object.entries(test.controls)) c[k].value = v;
    if (["page-two", "page-eight"].includes(key)) c.page.value = key === "page-two" ? 2 : 8;
    if (key.startsWith("linked")) {
      route.query.provider_id = key === "linked" ? D.provider.provisioned.id : "missing-provider";
    }
    if (["loading", "empty", "expired", "forbidden", "blocked", "error"].includes(key)) {
      c.items.value = [];
      phase = key;
      scope = "合成读取状态";
    }
    if (key === "detail-unregistered") {
      c.items.value = [{ ...clone(D.sources[0]), provisioned: null }];
      scope = "合成未登记边界";
    }
    if (key === "long-content") {
      c.items.value = [
        {
          ...clone(D.sources[0]),
          name: "合成长来源名称与跨市场信息目录 ".repeat(10),
          policy_note: "合成策略说明 ".repeat(50),
        },
      ];
      scope = "合成长内容";
    }
    const configScene = key.startsWith("config"),
      sampleScene = key.startsWith("sample"),
      matrixScene = key.startsWith("matrix"),
      versionScene = key.startsWith("version") || key.startsWith("rollback");
    if (configScene) {
      c.items.value = [
        clone(
          [
            "config",
            "config-success",
            "config-reload-error",
            "config-error",
            "config-unknown",
            "config-invalid",
          ].includes(key)
            ? D.sources[138]
            : key === "config-missing"
              ? D.sources[0]
              : D.smokeSource,
        ),
      ];
      scope = key === "config-missing" ? "原自动目录夹具缺字段" : "原单来源夹具";
    }
    if (sampleScene) {
      c.items.value = [clone(D.provider)];
      scope = "原独立1688审批夹具";
    }
    if (matrixScene || key === "detail-public") c.query.value = D.sources[136].code;
    if (versionScene || key === "detail-login") c.query.value = D.sources[138].code;
    if (key === "detail-import") c.query.value = "manual_product_supply_csv";
    c.page.value = Math.min(c.page.value, c.totalPages.value);
    c.syncUrlState();
    selected = c.pageItems.value[0]?.code ?? null;
    render();
    if (key.startsWith("detail") || key === "long-content") {
      mobileDetail = true;
      render();
    }
    if (configScene) {
      open("config");
      if (!["config", "config-missing"].includes(key)) c.form.status = "enabled";
      renderDialog();
    }
    if (versionScene) {
      open("versions");
      if (key !== "versions-loading")
        completeRead(
          key === "versions-empty" ? "empty" : key === "versions-error" ? "error" : "success",
        );
    }
    if (sampleScene) {
      open("samples");
      if (key !== "samples-loading")
        completeRead(
          key === "samples-empty" ? "empty" : key === "samples-error" ? "error" : "success",
        );
    }
    if (matrixScene) {
      open("matrix");
      if (key !== "matrix-loading")
        completeRead(
          key === "matrix-empty"
            ? "empty"
            : key === "matrix-missing"
              ? "missing"
              : key === "matrix-error"
                ? "error"
                : "success",
        );
    }
    if (key === "config-invalid") {
      c.form.schedule_minutes = 0;
      c.form.reason = "";
      save();
    }
    if (
      [
        "config-smoke",
        "config-saving",
        "config-testing",
        "config-enabling",
        "config-partial",
      ].includes(key)
    ) {
      if (key !== "config-smoke") save();
      if (["config-testing", "config-enabling", "config-partial"].includes(key))
        complete("success");
      if (key === "config-enabling") complete("ready");
      if (key === "config-partial") complete("blocked");
    }
    if (["config-error", "config-unknown", "config-success", "config-reload-error"].includes(key)) {
      save();
      complete(
        key === "config-error" ? "conflict" : key === "config-unknown" ? "unknown" : "success",
      );
      if (key === "config-reload-error") {
        startRead();
        completeRead("error");
        modalNote = "写入成功，但目录重读失败；当前窗口不是新目录证明。";
        renderDialog();
      }
    }
    if (key.startsWith("rollback")) {
      c.rollbackReason.value = "恢复已核对版本";
      actionWrite("rollback", 1);
      if (key !== "rollback-busy") complete(key === "rollback-conflict" ? "conflict" : "success");
    }
    if (["samples-candidate", "sample-create-busy", "sample-create-success"].includes(key)) {
      modalData.candidates = [clone(D.candidate)];
      scope = "合成候选，不是真实合格作业";
      if (key !== "samples-candidate") {
        actionWrite("sample-create", D.candidate.browser_job_id);
        if (key === "sample-create-success") complete("success");
      }
      render();
    }
    if (["sample-replay-busy", "sample-passed", "sample-changed", "sample-failed"].includes(key)) {
      actionWrite("sample-replay", D.samples.samples[0].id);
      if (key !== "sample-replay-busy") complete(key.slice(7));
    }
    if (key === "sample-self") {
      modalData.samples[0].can_review = false;
      modalNote = "合成创建人视角；不可自审。";
      renderDialog();
    }
    if (
      ["sample-approved", "sample-rejected", "sample-review-busy", "sample-review-error"].includes(
        key,
      )
    ) {
      reviewReasons[D.samples.samples[0].id] = "合成复核结论";
      actionWrite(key === "sample-rejected" ? "reject" : "approve", D.samples.samples[0].id);
      if (key !== "sample-review-busy")
        complete(key === "sample-review-error" ? "conflict" : "success");
    }
    if (key === "matrix-states") {
      modalData.compatibility_matrix = ["compatible", "incompatible", "mixed", "unverified"].map(
        (status, k) => ({
          ...clone(D.matrix[0].compatibility_matrix[0]),
          status,
          page_version_sha256: String(k + 1).repeat(64),
          observation_count: 3,
          succeeded_count: [3, 0, 1, 0][k],
          parser_failure_count: [0, 3, 1, 0][k],
        }),
      );
      modalNote = "合成四状态，不是真实页面观测。";
      renderDialog();
    }
    if (["matrix-technical", "sample-technical"].includes(key)) {
      technical = true;
      renderDialog();
    }
    if (key === "loading") startRead();
    if (key === "refreshing" || key === "refresh-error") {
      startRead();
      if (key === "refresh-error") completeRead("error");
    }
    if (key.startsWith("probe")) {
      actionWrite("probe");
      if (key !== "probe") complete(key === "probe-ready" ? "success" : key.slice(6));
    }
    if (dialog.open) dialog.scrollTop = 0;
    if (key === "focus") document.querySelector("#refresh").focus();
    const review = document.querySelector("#review");
    review.hidden = key !== "review-tools" && !reviewMode;
    review.innerHTML = `<label>非业务审核场景<select id="scene">${Object.entries(scenes)
      .map(([v, t]) => `<option value="${v}" ${v === key ? "selected" : ""}>${t}</option>`)
      .join("")}</select></label>`;
  }
  document.addEventListener("input", (e) => {
    const n = e.target;
    if (n.dataset.filter === "query") {
      c.query.value = n.value;
      c.page.value = 1;
      c.syncUrlState();
      render();
    }
    if (n.dataset.form) {
      c.form[n.dataset.form] = n.type === "number" ? Number(n.value) : n.value;
      document.querySelector("#preview").innerHTML = preview();
    }
    if (n.id === "rollback-reason") c.rollbackReason.value = n.value;
    if (n.dataset.review) {
      reviewReasons[n.dataset.review] = n.value;
      for (const b of dialog.querySelectorAll(`[data-sample="${n.dataset.review}"]`))
        if (["approve", "reject"].includes(b.dataset.action))
          b.disabled = blockedWrite() || n.value.trim().length < 2;
    }
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.id === "scene") return scene(n.value);
    if (n.dataset.filter && n.id !== "query") {
      c[n.dataset.filter].value = n.value;
      c.page.value = 1;
      c.syncUrlState();
      render();
    }
    if (n.dataset.form === "status") {
      c.form.status = n.value;
      renderDialog();
      document.querySelector("#status").focus();
    }
  });
  document.addEventListener("click", (e) => {
    const n = e.target.closest("button,a");
    if (!n || n.disabled) return;
    if (n.matches("a")) {
      e.preventDefault();
      if (n.dataset.route) {
        intent(n.dataset.external === "true" ? "EXTERNAL" : "NAVIGATE", n.dataset.route);
        note = "仅登记跳转意图，没有执行目标页面操作。";
        render();
      }
      return;
    }
    if (n.dataset.select) {
      selected = n.dataset.select;
      mobileDetail = true;
      render();
      if (innerWidth <= 760) document.querySelector("#back-list").focus();
    }
    if (n.dataset.page) {
      c.changePage(c.page.value + Number(n.dataset.page));
      c.syncUrlState();
      render();
    }
    const a = n.dataset.action;
    if (a === "filters") {
      expanded = !expanded;
      render();
    }
    if (a === "reset") {
      c.resetFilters();
      c.page.value = 1;
      c.syncUrlState();
      render();
    }
    if (a === "back-list") {
      mobileDetail = false;
      render();
      document.getElementById(`source-${selected}`)?.focus();
    }
    if (["config", "versions", "samples", "matrix"].includes(a)) open(a);
    if (a === "close") close();
    if (a === "refresh") startRead();
    if (a === "modal-read") startRead(modal.type);
    if (a === "save") save();
    if (a === "probe") actionWrite(a);
    if (a === "rollback") actionWrite(a, Number(n.dataset.version));
    if (a === "sample-create") actionWrite(a, n.dataset.candidate);
    if (["sample-replay", "approve", "reject"].includes(a)) actionWrite(a, n.dataset.sample);
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
        ...dialog.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a",
        ),
      ].filter((n) => n.getClientRects().length),
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
  window.CHANNEL_C = {
    scenes,
    scene,
    open,
    close,
    startRead,
    completeRead,
    save,
    actionWrite,
    complete,
    state: () => ({
      phase,
      scope,
      note,
      selected,
      modal: modal ? { type: modal.type, owner: modal.owner, code: modal.item.code } : null,
      modalNote,
      modalData: clone(modalData ?? {}),
      write: clone(write),
      reads: clone(reads),
      intents: clone(intents),
      unknown,
      form: clone(c.form),
      controls: Object.fromEntries(D.controls.map((k) => [k, c[k].value])),
      rows: clone(c.items.value),
      ids: c.sorted.value.map((i) => i.code),
      groups: c.groupedSources.value.map((g) => ({
        key: g.key,
        count: g.items.length,
        total: g.total,
      })),
      page: c.page.value,
      url: clone(route.query),
      errors,
    }),
  };
  scene("default", true);
})();
