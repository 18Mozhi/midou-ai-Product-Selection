/* P47 review-only prototype. No fetch, storage, credentials or business writes. */
(() => {
  const D = window.ADAPTER_C_DATA;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s],
    );
  const c = window.ADAPTER_C_SOURCE({
    ref: (value) => ({ value }),
    computed: (fn) => ({
      get value() {
        return fn();
      },
    }),
    watch: () => {},
    onMounted: () => {},
    defineProps: () => ({ apiBaseUrl: "" }),
    createApiClient: () => () => {
      throw new Error("No production request allowed");
    },
    ApiClientError: Error,
    window,
    AbortController,
    DOMException,
  });
  const app = document.querySelector("#app"),
    dialog = document.querySelector("#detail");
  let phase,
    scope,
    note,
    selected,
    returnId,
    intents,
    readPending,
    writePending,
    sequence = 0,
    revision = 0,
    unknown,
    visible,
    filtersExpanded,
    frozen,
    density,
    technical = false;
  const columns = ["程序与来源", "健康探针", "24 小时实际采集", "暂停与恢复", "操作"];
  const scenes = {
    filters: "移动筛选展开",
    default: "原始双来源",
    catalog: "原始45项目录",
    name: "名称排序",
    recent: "最近检查排序",
    "query-code": "代码搜索",
    "query-version": "版本搜索",
    "query-error": "错误码搜索",
    mode: "接入方式筛选",
    status: "来源状态筛选",
    registration: "未注册筛选",
    health: "健康筛选",
    combined: "组合筛选",
    "no-match": "无匹配结果",
    "page-two": "目录第二页",
    "page-three": "目录末页",
    loading: "首次读取中",
    empty: "无来源",
    expired: "会话过期",
    forbidden: "权限不足",
    blocked: "依赖受阻",
    error: "读取失败",
    refreshing: "刷新保留快照",
    "refresh-error": "刷新失败保留快照",
    "refresh-expired": "刷新会话过期",
    "refresh-forbidden": "刷新权限拒绝",
    detail: "来源诊断详情",
    "detail-technical": "技术详情展开",
    "detail-healthy": "健康但无采集样本",
    probing: "健康检查进行中",
    "detail-probing": "详情检查进行中",
    "probe-ready": "合成探针通过但仍暂停",
    "probe-blocked": "合成探针受阻",
    "probe-error": "合成请求拒绝",
    "probe-unknown": "合成结果未知",
    "detail-unknown": "详情结果未知",
    "filtered-away": "检查结果不再匹配筛选",
    runtime: "合成实际采集样本",
    "runtime-detail": "合成运行诊断",
    "zero-values": "零值不是缺失",
    "long-content": "合成长内容",
    columns: "列显隐工具",
    compact: "紧凑密度",
    "first-hidden": "冻结首个可见列",
    focus: "键盘焦点",
    hover: "悬停",
    pressed: "按下",
    "review-tools": "非业务审核工具",
  };
  const clockText = (v) => (v ? `${v.slice(0, 19).replace("T", " ")} UTC` : "尚未检查");
  const badge = (value, alert = false) =>
    `<span class="pill" data-alert="${alert}">${esc(value)}</span>`;
  const link = (text, route) => `<a class="route-link" href="#" data-route="${route}">${text}</a>`;
  const pair = (label, value) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`;
  const probeButton = (i, prefix) =>
    `<button type="button" id="${prefix}-probe-${i.id}" data-probe="${i.id}" class="primary" ${writePending || unknown ? "disabled" : ""}>${writePending?.providerId === i.id ? "检查中…" : "执行健康检查"}</button>`;
  const recovery = (i) =>
    i.runtime_circuit_state === "open" && i.runtime_recovery_gate_met
      ? link("前往采集调度解除暂停", "/platform-admin/crawler-scheduler")
      : "";
  const feedback = () =>
    note
      ? `<div class="notice" role="status">${esc(note)}<details><summary>反馈技术详情</summary><p>离线意图记录：${esc(intents.at(-1)?.id ?? "无")}；不是真实 request_id</p></details></div>`
      : "";
  function filters() {
    const select = (id, label, options) =>
      `<label class="${id}">${label}<select id="${id}" data-control="${id}">${options.map(([v, t]) => `<option value="${v}" ${c[id].value === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
    return `<section class="filters ${filtersExpanded ? "expanded" : ""}" aria-label="采集程序筛选"><label class="search">搜索来源<input id="query" data-control="query" type="search" autocomplete="off" value="${esc(c.query.value)}" placeholder="名称、代码、版本或错误码"></label><button type="button" id="filter-toggle" aria-expanded="${filtersExpanded}">${filtersExpanded ? "收起筛选" : "筛选与排序"}（${["mode", "providerStatus", "registration", "health"].filter((k) => c[k].value !== "all").length} 项筛选）</button>${select("mode", "接入模式", [["all", "全部模式"], ...["public_page", "public_rss", "authenticated_browser", "import", "manual"].map((v) => [v, c.accessModeText(v)])])}${select(
      "providerStatus",
      "来源状态",
      [
        ["all", "全部状态"],
        ["enabled", "已启用"],
        ["disabled", "未启用"],
        ["draft", "草稿"],
      ],
    )}${select("registration", "登记状态", [
      ["all", "全部状态"],
      ["registered", "已登记"],
      ["unregistered", "待登记"],
    ])}${select("health", "健康状态", [["all", "全部状态"], ...["unknown", "ready", "degraded", "blocked"].map((v) => [v, c.healthText(v)])])}${select(
      "sort",
      "排序",
      [
        ["attention", "需关注优先"],
        ["name", "名称顺序"],
        ["recent", "最近检查"],
      ],
    )}<button id="reset" type="button" data-reset>重置</button></section>`;
  }
  function tableCells(i) {
    return [
      `<strong>${esc(i.name)}</strong><small>${c.providerStatusText(i.provider_status)} / ${c.accessModeText(i.access_mode)}</small><small>${i.adapter_registered ? "程序已登记" : "程序待登记"}</small><small>${esc(i.adapter_version ?? "未提供实现版本")}</small>`,
      `${badge(c.healthText(i.health_status), ["blocked", "degraded"].includes(i.health_status))}<small>探针连续失败 ${i.consecutive_failures} 次</small><small>${esc(c.errorText(i.last_error_code))}</small><small>${clockText(i.last_checked_at)}</small><small>探针延迟 ${i.last_latency_ms === null ? "—" : `${i.last_latency_ms} ms`}</small>`,
      `<strong>${c.runtimeCategoryText(i.latest_runtime_category)}</strong><small>成功率 ${c.percentText(i.runtime_success_rate_basis_points_24h)} / ${i.runtime_sample_count_24h} 个样本</small><small>P95 ${i.runtime_duration_p95_ms_24h === null ? "—" : `${i.runtime_duration_p95_ms_24h} ms`}</small><small>网络 ${i.runtime_network_failure_count_24h}　解析 ${i.runtime_parser_failure_count_24h}<br>登录 ${i.runtime_login_failure_count_24h}　空结果 ${i.runtime_empty_success_count_24h}</small>`,
      `${badge(c.circuitText(i), i.runtime_circuit_state === "open")}<small>运行连续失败 ${i.runtime_consecutive_failures} / 阈值 ${i.runtime_failure_threshold}</small><small>错误预算剩余 ${i.runtime_error_budget_remaining}</small><small>${esc(c.recoveryText(i))}</small>${recovery(i)}`,
      `${probeButton(i, "table")}<button type="button" id="table-detail-${i.id}" data-detail="${i.id}">查看诊断</button>`,
    ];
  }
  function render() {
    let closedByFilter = false;
    const active = document.activeElement,
      focusId = active?.id,
      position = active?.selectionStart;
    if (selected && !c.pageItems.value.some((i) => i.id === selected)) {
      closedByFilter = true;
      selected = null;
      if (dialog.open) dialog.close();
      note = "刚才查看的来源已不在当前筛选或页码内，已返回列表。检查结果仍按来源 ID 归属。";
    }
    const ready = ["ready", "empty"].includes(phase);
    app.innerHTML = `<div class="workspace"><aside class="directory"><h2>ScoutOps</h2><nav aria-label="来源管理"><a href="#" data-route="/platform-admin/providers">来源设置</a><a href="#" aria-current="page">采集程序</a><a href="#" data-route="/platform-admin/providers/sources">来源渠道</a></nav><p>平台全局程序<br>不是组织连接</p><p>登记实现、探针与实际采集结果分别判断。</p></aside><main class="paper"><header class="page-head"><div><h1>采集程序</h1><p>先看运行异常，再执行健康检查。检查通过不代表采集成功，也不会自动解除暂停。</p></div><div class="actions"><button type="button" id="refresh" data-read ${readPending ? "disabled" : ""}>${readPending ? "刷新中…" : "刷新状态"}</button>${link("返回来源设置", "/platform-admin/providers")}</div></header><p class="prototype-label">P47 / C 方向待审稿 · ${esc(scope)} · 无生产连接</p><div id="feedback">${feedback()}</div>${
      ready
        ? `<div class="scope" aria-label="完整目录摘要"><span>全目录 <strong>${c.items.value.length}</strong></span><span>已登记 <strong>${c.registered.value}</strong></span><span>探针健康 <strong>${c.items.value.filter((i) => i.health_status === "ready").length}</strong></span><span>来源暂停 <strong>${c.items.value.filter((i) => i.runtime_circuit_state === "open").length}</strong></span></div>${filters()}<header class="results-head"><h2 id="result-count">${c.filtered.value.length} 个结果</h2><div class="list-tools"><details id="column-tools"><summary>显示列</summary>${columns.map((v, k) => `<label><input type="checkbox" data-column="${k}" ${visible[k] ? "checked" : ""} ${visible[k] && visible.filter(Boolean).length === 1 ? "disabled" : ""}>${v}</label>`).join("")}</details><label><input id="freeze" type="checkbox" ${frozen ? "checked" : ""}>冻结首列</label><select id="density" aria-label="列表密度"><option value="standard" ${density === "standard" ? "selected" : ""}>标准密度</option><option value="compact" ${density === "compact" ? "selected" : ""}>紧凑密度</option></select></div></header>${
            c.items.value.length === 0
              ? `<section class="empty"><h2>还没有来源可绑定程序</h2><p>先登记来源定义。本页不上传或创建采集程序。</p>${link("登记来源", "/platform-admin/providers")}</section>`
              : !c.filtered.value.length
                ? `<section class="empty"><h2>没有符合筛选条件的程序</h2><p>清除筛选后显示当前完整目录，不重新发送请求。</p><button type="button" data-reset>清除筛选</button></section>`
                : `<div class="desktop-list"><div class="table-scroll"><table class="${density}"><thead><tr>${columns.map((name, k) => (visible[k] ? `<th class="${frozen && k === visible.indexOf(true) ? "frozen" : ""}">${name}</th>` : "")).join("")}</tr></thead><tbody>${c.pageItems.value
                    .map(
                      (i) =>
                        `<tr data-row="${i.id}">${tableCells(i)
                          .map((cell, k) =>
                            visible[k]
                              ? `<td class="${frozen && k === visible.indexOf(true) ? "frozen" : ""}">${cell}</td>`
                              : "",
                          )
                          .join("")}</tr>`,
                    )
                    .join(
                      "",
                    )}</tbody></table></div></div><div class="mobile-records">${c.pageItems.value.map((i) => `<article class="record" data-mobile-row="${i.id}"><h3>${esc(i.name)}</h3><span>${badge(c.healthText(i.health_status))} ${badge(c.circuitText(i), i.runtime_circuit_state === "open")}</span><p>${c.accessModeText(i.access_mode)} / ${i.adapter_registered ? "已登记" : "待登记"}<br>实际采集：${c.runtimeCategoryText(i.latest_runtime_category)}<br>${c.percentText(i.runtime_success_rate_basis_points_24h)} / ${i.runtime_sample_count_24h} 个样本</p><button type="button" id="mobile-detail-${i.id}" data-detail="${i.id}">查看诊断与健康检查</button></article>`).join("")}</div><nav class="pager" aria-label="采集程序分页"><button type="button" id="prev" data-page="-1" ${c.page.value === 1 ? "disabled" : ""}>上一页</button><span>第 ${c.page.value} / ${c.totalPages.value} 页 · 每页 20 条</span><button type="button" id="next" data-page="1" ${c.page.value === c.totalPages.value ? "disabled" : ""}>下一页</button></nav>`
          }`
        : `<section class="empty"><h2>${{ loading: "正在读取程序状态", expired: "会话已过期", forbidden: "你没有此项权限", blocked: "依赖暂时受阻", error: "读取失败" }[phase]}</h2><p>${phase === "loading" ? "正在等待来源程序列表。" : "请先处理登录、权限或依赖问题，再重新读取。这里不会伪造登录或授权成功。"}</p><button type="button" id="retry" data-read ${readPending ? "disabled" : ""}>${readPending ? "读取中…" : "重新读取状态"}</button></section>`
    }<p class="snapshot">最近成功读取：${c.lastUpdatedAt.value ? clockText(c.lastUpdatedAt.value) : "尚无快照"}</p><aside class="boundary">健康检查可能访问来源网络并记录健康版本；本稿仅演示，不发请求。24 小时指标来自后端返回的已完成子查询样本，成功包含空结果；不是探针统计，也不承诺覆盖全部运行记录。时间在稿中明确标注 UTC。</aside></main></div>`;
    if (selected) renderDetail();
    const next = document.getElementById(closedByFilter ? "refresh" : focusId);
    if (next && !next.disabled) {
      next.focus({ preventScroll: true });
      if (position != null && next.type === "search") next.setSelectionRange?.(position, position);
    }
  }
  function renderDetail() {
    const i = c.items.value.find((i) => i.id === selected);
    if (!i) return;
    const scroll = dialog.scrollTop;
    dialog.innerHTML = `<header class="detail-head"><h2 id="detail-title">${esc(i.name)}</h2><button type="button" id="close-detail" data-close>关闭详情</button></header><div class="diagnosis"><aside class="identity"><dl>${pair("来源状态", c.providerStatusText(i.provider_status))}${pair("接入方式", c.accessModeText(i.access_mode))}${pair("程序登记", i.adapter_registered ? "已登记" : "待登记")}${pair("实现版本", i.adapter_version ?? "未提供")}</dl><p>健康检查是独立探针。实际采集、解析与调度状态请分别查看。</p></aside><div class="diagnosis-body"><div id="detail-feedback">${feedback()}</div><section><h3>健康探针</h3><dl>${pair("检查状态", c.healthText(i.health_status))}${pair("探针连续失败", `${i.consecutive_failures} 次`)}${pair("检查结果", c.errorText(i.last_error_code))}${pair("最近检查", clockText(i.last_checked_at))}${pair("探针延迟", i.last_latency_ms === null ? "—" : `${i.last_latency_ms} ms`)}</dl>${probeButton(i, "detail")}</section><section><h3>24 小时实际采集</h3><dl>${pair("最近运行类别", c.runtimeCategoryText(i.latest_runtime_category))}${pair("样本与成功率", `${i.runtime_sample_count_24h} 个样本 / ${c.percentText(i.runtime_success_rate_basis_points_24h)}`)}${pair("P95 耗时", i.runtime_duration_p95_ms_24h === null ? "—" : `${i.runtime_duration_p95_ms_24h} ms`)}${pair("网络 / 解析失败", `${i.runtime_network_failure_count_24h} / ${i.runtime_parser_failure_count_24h}`)}${pair("登录失败 / 空结果", `${i.runtime_login_failure_count_24h} / ${i.runtime_empty_success_count_24h}`)}</dl><p>成功率包含成功但无结果的样本；零样本时不显示 0% 假象。</p></section><section><h3>暂停与恢复</h3><dl>${pair("调度状态", c.circuitText(i))}${pair("运行连续失败", `${i.runtime_consecutive_failures} / 阈值 ${i.runtime_failure_threshold}`)}${pair("错误预算剩余", i.runtime_error_budget_remaining)}${pair("恢复条件", c.recoveryText(i))}</dl><div class="detail-actions">${recovery(i)}</div></section><details id="technical" ${technical ? "open" : ""}><summary>技术详情</summary><dl>${pair("来源 ID", i.id)}${pair("来源代码", i.code)}${pair("方式代码", i.access_mode)}${pair("探针错误码", i.last_error_code ?? "—")}${pair("运行错误码", i.runtime_last_error_code ?? "—")}${pair("健康记录版本", i.version)}${pair("暂停时间", i.runtime_circuit_opened_at ?? "—")}${pair("最近恢复时间", i.runtime_last_recovered_at ?? "—")}${pair("记录更新时间", i.updated_at)}</dl></details></div></div>`;
    dialog.scrollTop = scroll;
  }
  function openDetail(id, trigger) {
    selected = id;
    returnId = trigger;
    technical = false;
    renderDetail();
    dialog.showModal();
    document.querySelector("#close-detail").focus();
  }
  function closeDetail() {
    selected = null;
    dialog.close();
    (document.getElementById(returnId) || document.getElementById("refresh")).focus();
  }
  function read() {
    if (readPending) return null;
    const id = ++sequence;
    readPending = { id, revision };
    intents.push({ id, method: "GET", path: "/api/v1/platform/provider-adapters" });
    if (!c.items.value.length) phase = "loading";
    note = "正在刷新；已有快照仍可查看。";
    render();
    return id;
  }
  function completeRead(outcome, id = readPending?.id) {
    if (!readPending || id !== readPending.id) return false;
    const same = readPending.revision === revision;
    readPending = null;
    if (!same) {
      note = "较旧读取未覆盖新的检查结果，请重新刷新核对。";
      render();
      return false;
    }
    if (["success", "empty"].includes(outcome)) {
      if (outcome === "empty") c.items.value = [];
      else if (!c.items.value.length) c.items.value = clone(D.items);
      phase = c.items.value.length ? "ready" : "empty";
      c.lastUpdatedAt.value = "2026-09-09T01:21:00.000Z";
      unknown = false;
      note = "已读取本稿快照；不表示未知检查已被服务端取消或确认。";
    } else if (c.items.value.length) {
      phase = "ready";
      note = `${{ expired: "会话过期", forbidden: "权限拒绝", timeout: "刷新超时", error: "刷新失败" }[outcome] ?? "依赖受阻"}，已保留上一次快照，不是最新状态。`;
    } else {
      phase = outcome === "timeout" ? "blocked" : outcome;
      note = "";
    }
    c.page.value = Math.min(c.page.value, c.totalPages.value);
    render();
    return true;
  }
  function probe(id) {
    if (writePending || unknown) return null;
    const item = c.items.value.find((i) => i.id === id);
    if (!item) return null;
    const token = ++sequence;
    writePending = { id: token, providerId: id, name: item.name };
    intents.push({
      id: token,
      method: "POST",
      path: `/api/v1/platform/provider-adapters/${id}/health-check`,
    });
    note = `正在检查 ${item.name}。这不是采集任务，也不会自动解除暂停。`;
    render();
    return token;
  }
  function completeProbe(outcome, id = writePending?.id) {
    if (!writePending || id !== writePending.id) return false;
    const pending = writePending;
    writePending = null;
    revision++;
    if (["ready", "blocked"].includes(outcome)) {
      c.items.value = c.items.value.map((i) =>
        i.id === pending.providerId
          ? {
              ...i,
              health_status: outcome,
              last_checked_at: "2026-09-09T01:20:00.000Z",
              last_latency_ms: 0,
              last_error_code: outcome === "ready" ? null : "adapter_not_registered",
              consecutive_failures: outcome === "ready" ? 0 : i.consecutive_failures + 1,
              runtime_recovery_gate_met: outcome === "ready" && i.runtime_circuit_state === "open",
              version: i.version + 1,
            }
          : i,
      );
      scope = "合成检查响应；不是服务端或真实来源结果";
      note =
        outcome === "ready"
          ? `${pending.name} 的合成探针通过；采集样本与暂停状态没有因此改变。`
          : `${pending.name} 的合成受阻原因已展示；不要把 HTTP 成功理解为健康。`;
    } else if (outcome === "unknown") {
      unknown = true;
      note = `${pending.name} 的结果未知；可能已执行。先刷新核对，不自动重试，也不声称已取消。`;
    } else note = `${pending.name} 的合成请求被拒绝；保留原健康结果，未伪造新记录。`;
    c.page.value = Math.min(c.page.value, c.totalPages.value);
    render();
    return true;
  }
  function scene(key) {
    if (!scenes[key]) throw new Error(`Unknown scene ${key}`);
    if (dialog.open) dialog.close();
    document.activeElement?.blur();
    selected = null;
    technical = false;
    returnId = "refresh";
    phase = "ready";
    scope = "原始 2 项 E2E 夹具";
    note = "";
    intents = [];
    readPending = null;
    writePending = null;
    revision = 0;
    unknown = false;
    filtersExpanded = key === "filters";
    visible = columns.map(() => true);
    frozen = true;
    density = "standard";
    c.items.value = clone(D.items);
    c.lastUpdatedAt.value = "2026-09-09T01:20:00.000Z";
    c.resetFilters();
    c.page.value = 1;
    const test = D.cases.find((x) => x.key === key);
    if (test) {
      c.items.value = clone(test.scope === "catalog" ? D.catalog : D.items);
      if (test.scope === "catalog") scope = "原始 45 项 E2E 目录夹具";
      for (const [k, v] of Object.entries(test.controls)) c[k].value = v;
    }
    if (["page-two", "page-three"].includes(key)) {
      c.items.value = clone(D.catalog);
      scope = "原始 45 项 E2E 目录夹具";
      c.page.value = key === "page-two" ? 2 : 3;
    }
    if (["loading", "empty", "expired", "forbidden", "blocked", "error"].includes(key)) {
      phase = key;
      c.items.value = [];
      c.lastUpdatedAt.value = key === "empty" ? "2026-09-09T01:20:00.000Z" : null;
      scope = "合成首次读取状态";
    }
    if (key === "long-content") {
      c.items.value[1].name = "合成长名称来源：跨市场公开趋势与登录型商品证据诊断 ".repeat(5);
      c.items.value[1].adapter_version = "synthetic-long-version-".repeat(10);
      scope = "合成长内容，非生产事实";
    }
    if (["runtime", "runtime-detail", "zero-values"].includes(key)) {
      Object.assign(c.items.value[0], {
        latest_runtime_category: "parser",
        runtime_sample_count_24h: 8,
        runtime_success_rate_basis_points_24h: 6250,
        runtime_duration_p95_ms_24h: 840,
        runtime_network_failure_count_24h: 1,
        runtime_parser_failure_count_24h: 1,
        runtime_login_failure_count_24h: 1,
        runtime_empty_success_count_24h: 2,
      });
      scope = "合成运行边界样本";
      if (key === "zero-values")
        Object.assign(c.items.value[0], {
          runtime_success_rate_basis_points_24h: 0,
          runtime_duration_p95_ms_24h: 0,
          last_latency_ms: 0,
          runtime_empty_success_count_24h: 0,
        });
    }
    if (key === "compact") density = "compact";
    if (key === "first-hidden") visible[0] = false;
    render();
    if (key === "loading") read();
    if (key === "refreshing" || key.startsWith("refresh-")) {
      read();
      if (key !== "refreshing") completeRead(key.slice(8));
    }
    if (["probing", "detail-probing"].includes(key)) probe(D.items[1].id);
    if (key.startsWith("probe-") || key === "detail-unknown") {
      probe(D.items[1].id);
      completeProbe(key === "detail-unknown" ? "unknown" : key.slice(6));
    }
    if (key === "filtered-away") {
      c.health.value = "blocked";
      render();
      openDetail(D.items[1].id, "refresh");
      probe(D.items[1].id);
      completeProbe("ready");
    }
    if (
      [
        "detail",
        "detail-technical",
        "detail-healthy",
        "detail-probing",
        "detail-unknown",
        "runtime-detail",
      ].includes(key)
    ) {
      const id = ["detail-healthy", "runtime-detail"].includes(key) ? D.items[0].id : D.items[1].id;
      openDetail(id, "refresh");
      if (key === "detail-technical") {
        technical = true;
        renderDetail();
      }
    }
    if (key === "columns") document.querySelector("#column-tools").open = true;
    if (key === "focus") document.querySelector("#refresh").focus();
    const review = document.querySelector("#review");
    review.hidden = key !== "review-tools" && !new URL(location.href).searchParams.has("review");
    review.innerHTML = `<label>非业务审核场景<select id="scene">${Object.entries(scenes)
      .map(([v, t]) => `<option value="${v}" ${v === key ? "selected" : ""}>${t}</option>`)
      .join("")}</select></label>`;
  }
  document.addEventListener("input", (e) => {
    if (e.target.dataset.control !== "query") return;
    c.query.value = e.target.value;
    c.page.value = 1;
    render();
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.id === "scene") return scene(n.value);
    if (n.dataset.control && n.id !== "query") {
      c[n.dataset.control].value = n.value;
      c.page.value = 1;
      render();
    }
    if (n.dataset.column !== undefined) {
      visible[Number(n.dataset.column)] = n.checked;
      render();
      document.querySelector("#column-tools").open = true;
    }
    if (n.id === "freeze") {
      frozen = n.checked;
      render();
    }
    if (n.id === "density") {
      density = n.value;
      render();
    }
  });
  document.addEventListener("click", (e) => {
    const n = e.target.closest("button,a");
    if (!n || n.disabled) return;
    if (n.id === "filter-toggle") {
      filtersExpanded = !filtersExpanded;
      render();
    }
    if (n.matches("a")) {
      e.preventDefault();
      if (n.dataset.route) {
        intents.push({ id: ++sequence, method: "NAVIGATE", path: n.dataset.route });
        note = `将进入 ${n.dataset.route}。本稿不执行目的页动作。`;
        render();
      }
      return;
    }
    if (n.hasAttribute("data-reset")) {
      c.resetFilters();
      c.page.value = 1;
      render();
    }
    if (n.dataset.page) {
      c.page.value += Number(n.dataset.page);
      render();
    }
    if (n.dataset.detail) openDetail(n.dataset.detail, n.id);
    if (n.hasAttribute("data-close")) closeDetail();
    if (n.hasAttribute("data-read")) read();
    if (n.dataset.probe) probe(n.dataset.probe);
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDetail();
  });
  dialog.addEventListener("toggle", () => {}, false);
  dialog.addEventListener("click", (e) => {
    if (e.target.closest("#technical summary"))
      technical = !document.querySelector("#technical").open;
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...dialog.querySelectorAll("button:not(:disabled),a,summary")].filter(
      (n) => n.getClientRects().length,
    );
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  window.ADAPTER_C = {
    scenes,
    scene,
    read,
    completeRead,
    probe,
    completeProbe,
    openDetail,
    closeDetail,
    state: () => ({
      phase,
      scope,
      note,
      selected,
      readPending,
      writePending,
      unknown,
      intents: clone(intents),
      rows: clone(c.items.value),
      ids: c.sorted.value.map((i) => i.id),
      page: c.page.value,
      controls: Object.fromEntries(D.controls.map((k) => [k, c[k].value])),
    }),
  };
  scene("default");
})();
