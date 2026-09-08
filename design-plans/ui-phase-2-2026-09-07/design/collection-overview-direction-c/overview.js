(() => {
  const D = window.OVERVIEW_C_DATA,
    O = D.original;
  const $ = (id) => document.getElementById(id),
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const C = window.OVERVIEW_C_SOURCE({
    ref: (value) => ({ value }),
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    nextTick: async () => {},
    onMounted: () => {},
    onBeforeUnmount: () => {},
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: async () => {} }),
    defineProps: () => ({ apiBaseUrl: "inert" }),
    createApiClient: () => () => Promise.reject(new Error("No real request")),
    ApiClientError: class extends Error {},
    window: { setTimeout: () => 0, clearTimeout: () => {} },
    AbortController,
    URLSearchParams,
    crypto,
  });
  const scenes = {
    default: "原始总览",
    loading: "首次读取",
    empty: "全空响应",
    expired: "登录失效",
    forbidden: "无权访问",
    blocked: "依赖受阻",
    rate_limited: "请求限流",
    refreshing: "刷新进行中",
    "refresh-error": "刷新失败保留快照",
    "refresh-timeout": "刷新超时",
    scope: "范围弹窗",
    "scope-invalid": "无效范围",
    "scope-filled": "已填范围尚未应用",
    "scope-applied": "应用范围",
    "root-selected": "精确根因下钻",
    "roots-categories": "错误分类",
    "attempt-only": "仅尝试返回提案",
    "source-0": "零来源",
    "source-8": "八来源",
    "source-9": "九来源折叠",
    "source-all": "全部九来源",
    "source-14": "原始14来源异常优先",
    "source-detail": "来源详情",
    "source-technical": "来源技术详情",
    "attempt-detail": "尝试详情",
    "attempt-technical": "尝试技术详情",
    paged: "原始独立分页元数据",
    "attempt-page2": "尝试第二页合成响应",
    "dead-page2": "死信第二页合成响应",
    "dead-closed": "非开放死信",
    "batch-empty": "未选择",
    "batch-selected": "两个组织影响",
    "reason-empty": "原因空",
    "reason-one": "原因不足",
    "reason-limit": "500字原因",
    "selection-limit": "20条上限",
    confirm: "影响确认",
    "confirm-ack": "仅勾选",
    "confirm-typed": "勾选与短语齐备",
    "confirm-long": "500字原因影响确认",
    "batch-running": "串行重放中",
    "batch-partial": "逐条部分成功",
    "batch-failed": "全部明确失败",
    "batch-unknown": "结果未知",
    "batch-success": "新任务已创建",
    "batch-refresh-error": "写成功读取失败",
    "failures-expanded": "失败条目展开",
    "long-content": "长来源错误与标识",
    "columns-source": "来源列设置",
    "columns-attempt": "尝试列设置",
    compact: "紧凑表格",
    focus: "按钮焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    tools: "审核工具",
  };
  for (const health of ["healthy", "warning", "degraded", "blocked", "critical", "unknown"])
    scenes["health-" + health] = "来源健康 / " + C.healthLabel(health);
  const sourceHeads = ["来源 / 负责人", "运行状态", "健康", "连续失败", "最近检查", "技术详情"];
  const attemptHeads = ["尝试", "任务处理器", "状态", "错误", "技术详情"];
  let s,
    serial = 0,
    generation = 0,
    pending = null,
    batchSnapshot = null,
    returnFocus = "";
  function derive() {
    C.data.value = s.data;
    C.sourcesExpanded.value = s.sourcesExpanded;
    C.selectedDeadLetterIds.value = s.selected;
    C.org.value = s.org;
    C.workspace.value = s.workspace;
    C.provider.value = s.provider;
    C.timeWindow.value = s.window;
    C.errorCode.value = s.error;
    return C;
  }
  const time = (v) => C.when(v),
    label = (v) => C.statusLabel(v),
    errorLabel = (v) => C.errorLabel(v);
  const note = (v) => (v ? `<div class="notice">${esc(v)}</div>` : "");
  function scopeText(filters) {
    return `${filters.window || "24h"}；组织 ${filters.organization_id || "全部"}；工作区 ${filters.workspace_id || "全部"}；来源 ${filters.provider_id || "全部"}；精确错误 ${filters.error_code || "未选"}`;
  }
  function syncURL() {
    const url = new URL(location.href),
      root = url.searchParams.get("root_cause") === "1";
    url.search = "";
    for (const [key, value] of [
      ["organization_id", s.org.trim()],
      ["workspace_id", s.workspace.trim()],
      ["provider_id", s.provider],
      ["window", s.window === "24h" ? "" : s.window],
      ["error_code", s.error],
      ["attempt_page", s.ap > 1 ? s.ap : ""],
      ["dead_letter_page", s.dp > 1 ? s.dp : ""],
      ["root_cause", root ? "1" : ""],
    ])
      if (value) url.searchParams.set(key, value);
    history.replaceState({}, "", url);
  }
  function tools(kind, heads) {
    const settings = s.tables[kind];
    return `<div class="table-tools"><details id="columns-${kind}"><summary>列设置</summary><div class="column-list">${heads.map((h, i) => `<label><input id="column-${kind}-${i}" type="checkbox" data-column="${kind}:${i}" ${settings.hidden.includes(i) ? "" : "checked"} ${!settings.hidden.includes(i) && settings.hidden.length === heads.length - 1 ? "disabled" : ""}/>${h}</label>`).join("")}</div></details><button id="freeze-${kind}" data-freeze="${kind}">${settings.freeze ? "首列已冻结" : "冻结首列"}</button><label>密度 <select id="density-${kind}" data-density="${kind}"><option value="standard" ${settings.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${settings.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div>`;
  }
  function table(kind, heads, rows) {
    const settings = s.tables[kind],
      visible = (i) => !settings.hidden.includes(i);
    return (
      tools(kind, heads) +
      `<div class="table-wrap"><table id="${kind}-table" class="${settings.freeze ? "frozen" : ""} ${settings.density}"><thead><tr>${heads
        .filter((_, i) => visible(i))
        .map((h) => `<th>${h}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (row) =>
            `<tr>${row
              .filter((_, i) => visible(i))
              .map((cell) => `<td>${cell}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`
    );
  }
  function pagination(kind) {
    const m = s.data.pagination[kind];
    if (m.total_pages <= 1) return "";
    return `<nav class="pagination" aria-label="${kind === "attempts" ? "尝试" : "死信"}分页"><button data-page="${kind}:-1" ${s.busy || s.batchBusy || m.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${m.page} / ${m.total_pages} 页</span><button data-page="${kind}:1" ${s.busy || s.batchBusy || m.page >= m.total_pages ? "disabled" : ""}>下一页</button></nav>`;
  }
  function render() {
    const focused = document.activeElement?.id;
    const opened = [...$("content").querySelectorAll("details[open][id]")].map((n) => n.id);
    const c = derive(),
      d = s.data,
      disabled = s.busy || s.batchBusy;
    for (const id of ["org", "workspace", "provider", "window"]) {
      $(id).value = s[id];
      $(id).disabled = disabled;
      $(id).setAttribute("aria-describedby", "scope-error");
      const fieldName = { org: "组织", workspace: "工作区", provider: "来源" }[id];
      $(id).setAttribute(
        "aria-invalid",
        String(Boolean(fieldName && s.scopeError.includes(fieldName))),
      );
    }
    $("apply").disabled = disabled;
    $("reset").disabled = disabled || !c.scopeFilterCount.value;
    $("scope-error").textContent = s.scopeError;
    $("refresh").disabled = disabled;
    $("refresh").textContent = s.busy ? "正在刷新" : "刷新数据";
    $("provenance").textContent = s.synthetic
      ? "合成状态或独立夹具；不是实时运行与真实重放结果。"
      : "原始采集总览 E2E 夹具，不是实时数据。";
    $("observed").textContent = d ? `已读快照 ${time(d.observed_at)}` : "尚未取得观测快照";
    $("read-notice").innerHTML = note(s.readNotice);
    const firstStates = {
      loading: "正在读取采集事实",
      empty: "当前范围没有采集事实",
      expired: "登录已失效",
      forbidden: "没有总览读取权限",
      blocked: "采集控制台依赖受阻",
      rate_limited: "请求过于频繁",
    };
    if (s.first !== "ready") {
      $("content").innerHTML =
        `<section class="fact-section empty"><h3>${firstStates[s.first]}</h3><p>可核对观测范围；失败不是正常零值，原型不创建登录或申请权限接口。</p>${["loading", "expired", "forbidden"].includes(s.first) ? "" : '<button id="retry-read">重新读取</button>'}<details><summary>请求标识</summary><code>合成响应 / m06-03-e2e</code></details></section>`;
    } else {
      const sources = c.visibleSources.value;
      const sourceRows = sources.map((r) => [
        `<strong>${esc(r.name)}</strong><small>${esc(r.owner_label)}</small>`,
        esc(label(r.status)),
        esc(c.healthLabel(r.health_status)),
        r.consecutive_failures,
        esc(time(r.last_checked_at)),
        `<details id="source-tech-${esc(r.id)}"><summary>查看</summary><code>${esc(r.code)}</code></details>`,
      ]);
      const attemptRows = d.attempts.map((r) => [
        `第 ${r.attempt_number} 次`,
        esc(r.worker_id),
        esc(label(r.status)),
        esc(errorLabel(r.error_code)),
        `<details id="attempt-tech-${esc(r.id)}"><summary>查看</summary><code>任务 ${esc(r.task_id)}<br/>链路 ${esc(r.trace_id)}<br/>错误 ${esc(r.error_code || "无")}</code></details>`,
      ]);
      $("content").innerHTML =
        `<div class="scope-stamp"><strong>已返回数据范围（不是输入草稿）</strong>${esc(scopeText(d.filters))}</div>` +
        `<section id="roots" class="fact-section" tabindex="-1"><header><div><h3>死信根因</h3><p>只聚合已进入死信的任务；选择后精确下钻尝试与死信，根因集合不受当前错误筛选影响。</p></div>${s.error ? `<button id="clear-root" ${disabled ? "disabled" : ""}>清除根因</button>` : ""}</header><div class="root-list">${d.root_causes.map((r, i) => `<article class="root-row"><button id="root-${i}" data-root="${esc(r.error_code)}" aria-pressed="${s.error === r.error_code}" ${disabled ? "disabled" : ""}><strong>${esc(errorLabel(r.error_code))}<small>告警类别：${esc(c.errorCategory(r.error_code))}</small></strong><span>${r.total} 条死信</span><span>最近 ${esc(time(r.latest_at))}</span></button><details id="root-tech-${i}"><summary>技术详情</summary><code>${esc(r.error_code)}</code></details></article>`).join("") || '<p class="empty">未返回死信根因，不等于没有失败尝试。</p>'}</div></section>` +
        `<section id="attempts" class="fact-section"><header><div><h3>最近尝试</h3><p>${esc(c.rangeLabel(d.pagination.attempts))} · 本响应返回 ${d.attempts.length} 条</p></div></header>${d.attempts.length ? table("attempts", attemptHeads, attemptRows) + `<div class="records-mobile">${d.attempts.map((r, i) => `<button id="attempt-record-${i}" data-record="attempt:${i}" aria-haspopup="dialog"><strong>第 ${r.attempt_number} 次尝试 · ${esc(label(r.status))}</strong><span>${esc(errorLabel(r.error_code))}</span><small>${esc(r.worker_id)} · ${esc(time(r.started_at))}</small><span>查看详情</span></button>`).join("")}</div>` : '<p class="empty">当前页没有尝试。</p>'}${pagination("attempts")}</section>` +
        `<section id="dead" class="fact-section"><header><div><h3>死信与受控重放</h3><p>${esc(c.rangeLabel(d.pagination.dead_letters))} · 本响应返回 ${d.dead_letters.length} 条</p></div></header><div aria-live="polite">${note(s.batchNotice)}</div>${s.failures.length ? `<details id="failures"><summary>查看失败或未知条目（${s.failures.length}）</summary>${s.failures.map((r) => `<p>任务 ${esc(r.task)}：${esc(r.reason)}</p>`).join("")}</details>` : ""}<details id="batch-panel" class="batch-panel"><summary>批量安全重放</summary><p>仅选择当前页开放死信；每批最多20条。逐条独立事务，不整批回滚。</p><p id="selection-count">已选择 ${s.selected.length} / 20 条</p>${d.dead_letters.map((r, i) => `<label class="choose"><input id="choose-${i}" type="checkbox" data-dead="${esc(r.id)}" ${s.selected.includes(r.id) ? "checked" : ""} ${r.status !== "open" || disabled ? "disabled" : ""}/><span>${esc(errorLabel(r.error_code))} · 任务 ${esc(r.task_id.slice(-6))}<small> ${esc(label(r.status))}</small></span></label>`).join("")}<label>批量重放原因<textarea id="reason" maxlength="500" aria-describedby="reason-help" ${disabled || s.unknown ? "disabled" : ""}>${esc(s.reason)}</textarea></label><small id="reason-help">原始长度≤500，去除首尾空白后至少2字；${s.reason.length} / 500</small><button id="preview" ${disabled || s.unknown ? "disabled" : ""}>${s.batchBusy ? "正在逐条重放" : "预览批量重放"}</button>${s.unknown ? "<p>已有结果未知，请先到对应任务核查；此原型不提供自动重发。</p>" : ""}</details>${d.dead_letters.map((r) => `<article class="dead-row"><div><strong>${esc(errorLabel(r.error_code))}</strong><p>${esc(label(r.status))} · ${esc(time(r.created_at))}</p></div><a href="/platform-admin/collection?task=${esc(r.task_id)}">查看并受控重放</a><details id="dead-tech-${esc(r.id)}"><summary>技术详情</summary><code>错误 ${esc(r.error_code)}</code><code>任务 ${esc(r.task_id)}</code><code>组织 ${esc(r.organization_id)}</code><code>工作区 ${esc(r.workspace_id)}</code></details></article>`).join("") || '<p class="empty">当前页没有死信记录。</p>'}${pagination("dead_letters")}</section>` +
        `<section id="sources" class="fact-section"><header><div><h3>平台来源健康</h3><p>共 ${d.sources.length} 个，异常优先；只按来源筛选，不随组织与观测时间改变。</p></div></header>${sources.length ? table("sources", sourceHeads, sourceRows) + `<div class="records-mobile">${sources.map((r, i) => `<button id="source-record-${i}" data-record="source:${i}" aria-haspopup="dialog"><strong>${esc(r.name)}</strong><span>${esc(label(r.status))} · ${esc(c.healthLabel(r.health_status))}</span><small>${esc(r.owner_label)} · ${esc(time(r.last_checked_at))}</small><span>查看详情</span></button>`).join("")}</div>` : '<p class="empty">未返回来源健康记录。</p>'}${d.sources.length > 8 ? `<button id="expand-sources" aria-expanded="${s.sourcesExpanded}">${s.sourcesExpanded ? "收起，仅看前8个来源" : `查看全部${d.sources.length}个来源（还有${c.hiddenSourceCount.value}个）`}</button>` : ""}</section>` +
        `<div class="secondary-grid"><section class="fact-section"><h3>任务状态</h3><p>按任务更新时间筛选，不随精确错误码下钻。</p><div class="stat-lines">${d.task_states.map((r) => `<div><span>${esc(label(r.status))}</span><strong>${r.total}</strong></div>`).join("") || "<p>未返回任务状态。</p>"}</div></section><section class="fact-section"><h3>质量问题</h3><p>按质量更新时间筛选；不代表该页死信数量。</p><div class="stat-lines">${d.quality.map((r) => `<div><span>${esc(label(r.status))} / ${r.severity === "critical" ? "严重" : "警告"}</span><strong>${r.total}</strong></div>`).join("") || "<p>未返回质量问题。</p>"}</div></section></div>` +
        `<nav class="management-links" aria-label="相关管理页面">${Object.entries(d.links)
          .map(([k, v]) => `<a href="${esc(v)}">${esc(c.linkLabels[k] || "相关管理页面")}</a>`)
          .join(
            "",
          )}</nav><details><summary>请求标识</summary><code>m06-03-e2e / 原始夹具或合成场景</code></details>`;
    }
    for (const id of opened) if ($(id)) $(id).open = true;
    if (focused && $(focused) && !$(focused).disabled) $(focused).focus({ preventScroll: true });
    $("intents").textContent = JSON.stringify(s.intents, null, 2);
  }
  function closeModal() {
    const d = document.querySelector("dialog[open]");
    if (!d) return;
    d.close();
    if (d.id === "scope-dialog") $("scope-home").append($("scope-form"));
    if (d.id === "confirm-dialog") batchSnapshot = null;
    $(returnFocus)?.focus({ preventScroll: true });
  }
  function openModal(id, trigger) {
    closeModal();
    returnFocus = trigger;
    $(id).showModal();
    $(id).scrollTop = 0;
    $(id).querySelector("[data-close]")?.focus({ preventScroll: true });
  }
  function scopeModal() {
    openModal("scope-dialog", "open-scope");
    $("scope-slot").append($("scope-form"));
  }
  function record(kind, index, trigger) {
    const row = kind === "source" ? derive().visibleSources.value[index] : s.data.attempts[index];
    const fields =
      kind === "source"
        ? [
            ["负责人", row.owner_label],
            ["运行状态", label(row.status)],
            ["健康状态", C.healthLabel(row.health_status)],
            ["连续失败", row.consecutive_failures],
            ["最近检查", time(row.last_checked_at)],
          ]
        : [
            ["任务处理器", row.worker_id],
            ["状态", label(row.status)],
            ["错误", errorLabel(row.error_code)],
            ["开始时间", time(row.started_at)],
            ["结束时间", time(row.finished_at)],
          ];
    $("record-dialog").innerHTML =
      `<header class="dialog-header"><div><h2 id="record-title">${kind === "source" ? esc(row.name) : `第${row.attempt_number}次尝试`}详情</h2><p id="record-description">只展示当前响应中的事实；不推断未返回状态。</p></div><button data-close>关闭</button></header><div class="dialog-body"><dl>${fields.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl><details id="record-tech"><summary>技术详情</summary><code>${kind === "source" ? esc(row.code) : `任务 ${esc(row.task_id)}<br/>链路 ${esc(row.trace_id)}<br/>错误 ${esc(row.error_code || "无")}`}</code></details></div>`;
    openModal("record-dialog", trigger);
  }
  function preview() {
    if (s.batchBusy || s.busy || s.unknown) return false;
    const c = derive();
    s.failures = [];
    s.batchNotice = "";
    if (!c.selectedDeadLetters.value.length) s.batchNotice = "请先选择当前页开放死信。";
    else if (s.reason.trim().length < 2 || s.reason.length > 500)
      s.batchNotice = "原因需要2–500字符。";
    if (s.batchNotice) {
      render();
      return false;
    }
    batchSnapshot = {
      generation,
      id: crypto.randomUUID(),
      items: clone(c.selectedDeadLetters.value),
      reason: s.reason.trim(),
      impact: c.batchImpact.value,
    };
    $("confirm-dialog").innerHTML =
      `<header class="dialog-header"><div><h2 id="confirm-title">确认批量重放开放死信？</h2><p id="confirm-description">逐条创建新任务，保留原任务历史；并发状态变化可能使某条失败，不整批回滚。</p></div></header><div class="dialog-body"><div class="impact"><strong>固定影响范围（提案）</strong><p>${esc(batchSnapshot.impact)}</p>${batchSnapshot.items.map((r) => `<code>任务 ${esc(r.task_id)}</code>`).join("")}</div><strong>本批原因</strong><p id="confirm-reason">${esc(batchSnapshot.reason)}</p><label class="ack"><input id="ack" type="checkbox"/>我已阅读影响范围，并确认只处理上述对象</label><label>输入“确认重放”继续<input id="typed" autocomplete="off"/></label></div><footer class="dialog-footer"><div class="actions"><button data-close id="cancel-batch">取消</button><button id="confirm-batch" class="primary danger" disabled>确认批量重放</button></div></footer>`;
    openModal("confirm-dialog", "preview");
    return true;
  }
  function submitBatch() {
    if (
      s.batchBusy ||
      pending ||
      !batchSnapshot ||
      batchSnapshot.generation !== generation ||
      !$("ack").checked ||
      $("typed").value.trim() !== "确认重放"
    )
      return false;
    $("confirm-dialog").close();
    s.batchBusy = true;
    s.failures = [];
    s.successes = [];
    s.batchNotice = "正在逐条创建新任务；关闭图稿不等于取消已发请求。";
    nextReplay();
    return true;
  }
  function nextReplay() {
    const index = s.successes.length + s.failures.length;
    if (index >= batchSnapshot.items.length) {
      s.batchBusy = false;
      s.selected = s.selected.filter((id) => !s.successes.includes(id));
      s.batchNotice = `本批请求已结束：创建新任务 ${s.successes.length} 条，明确失败 ${s.failures.filter((v) => !v.unknown).length} 条，结果未知 ${s.failures.filter((v) => v.unknown).length} 条。不是采集执行成功。`;
      batchSnapshot = null;
      pending = null;
      render();
      read(false);
      return;
    }
    const row = batchSnapshot.items[index];
    pending = { id: ++serial, generation, kind: "replay", row, index };
    s.intents.push({
      method: "POST",
      path: `/platform/collection/tasks/${row.task_id}/replay`,
      idempotencyKey: `dead-batch:${batchSnapshot.id}:${row.task_id}`,
      body: { reason: batchSnapshot.reason },
    });
    render();
  }
  function read(update = true) {
    if (s.busy || s.batchBusy || pending) return false;
    const validation = derive().scopeValidation();
    s.scopeError = validation;
    if (validation) {
      render();
      return false;
    }
    s.busy = true;
    s.readNotice = "";
    const filters = {
      organization_id: s.org.trim() || null,
      workspace_id: s.workspace.trim() || null,
      provider_id: s.provider || null,
      window: s.window,
      error_code: s.error || null,
    };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    q.set("attempt_page", s.ap);
    q.set("dead_letter_page", s.dp);
    if (update) syncURL();
    pending = { id: ++serial, generation, kind: "read", filters, ap: s.ap, dp: s.dp };
    s.intents.push({ method: "GET", path: "/platform/collection/console?" + q });
    render();
    return true;
  }
  function complete(outcome, id = pending?.id) {
    if (!pending || pending.id !== id || pending.generation !== generation) return false;
    const op = pending;
    pending = null;
    if (op.kind === "replay") {
      if (outcome === "success") s.successes.push(op.row.id);
      else {
        const unknown = outcome === "unknown";
        s.unknown ||= unknown;
        s.failures.push({
          task: op.row.task_id,
          reason: unknown
            ? "结果未知，先核查任务，不自动重发"
            : "合成明确拒绝：请核对任务状态及权限",
          unknown,
        });
      }
      nextReplay();
      return true;
    }
    s.busy = false;
    if (outcome !== "success") {
      s.readNotice =
        outcome === "timeout"
          ? "读取超过15秒，保留上一份快照及观测时间。"
          : "重新读取失败；保留旧快照，未验证当前状态。";
      if (!s.data) s.first = "blocked";
    } else {
      s.data = clone(s.fixture || O);
      s.data.filters = clone(op.filters);
      if (op.filters.provider_id)
        s.data.sources = s.data.sources.filter((r) => r.id === op.filters.provider_id);
      for (const [kind, page] of [
        ["attempts", op.ap],
        ["dead_letters", op.dp],
      ])
        s.data.pagination[kind].page = page;
      if (op.filters.error_code) {
        s.data.attempts = s.data.attempts.filter((r) => r.error_code === op.filters.error_code);
        s.data.dead_letters = s.data.dead_letters.filter(
          (r) => r.error_code === op.filters.error_code,
        );
      }
      const open = new Set(s.data.dead_letters.filter((r) => r.status === "open").map((r) => r.id));
      s.selected = s.selected.filter((v) => open.has(v));
      s.first = "ready";
      s.synthetic = true;
      s.readNotice = "模拟响应已应用；统计/分页沿用独立夹具，非后端重新聚合证据。";
    }
    render();
    return true;
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene");
    closeModal();
    generation++;
    pending = null;
    batchSnapshot = null;
    $("content").replaceChildren();
    s = {
      data: clone(O),
      org: "",
      workspace: "",
      provider: "",
      window: "24h",
      error: "",
      ap: 1,
      dp: 1,
      first: "ready",
      busy: false,
      readNotice: "",
      scopeError: "",
      sourcesExpanded: false,
      selected: [],
      reason: "",
      batchBusy: false,
      batchNotice: "",
      failures: [],
      successes: [],
      unknown: false,
      synthetic: key !== "default",
      intents: [],
      tables: {
        sources: { hidden: [], density: "standard", freeze: true },
        attempts: { hidden: [], density: "standard", freeze: true },
      },
    };
    const url = new URL(location.href);
    url.search = "";
    history.replaceState({}, "", url);
    $("provider").innerHTML =
      '<option value="">全部来源</option>' +
      O.source_options.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("");
    if (["loading", "empty", "expired", "forbidden", "blocked", "rate_limited"].includes(key)) {
      s.first = key;
      s.data = null;
      s.busy = key === "loading";
    }
    if (key.startsWith("source-") && /^source-\d+$/.test(key)) {
      const n = Number(key.split("-")[1]);
      s.data.sources =
        n === 14
          ? clone(D.catalog)
          : Array.from({ length: n }, (_, i) => ({
              ...clone(O.sources[0]),
              id: `source-synthetic-${i}`,
              name: `合成来源${i + 1}`,
            }));
    }
    if (key === "source-all") {
      s.data.sources = clone(D.catalog.slice(0, 9));
      s.sourcesExpanded = true;
    }
    if (key.startsWith("health-")) s.data.sources[0].health_status = key.slice(7);
    if (key === "roots-categories")
      s.data.root_causes = [
        "network_error",
        "login_required",
        "captcha",
        "parser_failed",
        "synthetic_unmapped",
      ].map((error_code, i) => ({ error_code, total: i + 1, latest_at: O.observed_at }));
    if (key === "attempt-only") {
      for (const k of ["sources", "task_states", "quality", "dead_letters", "root_causes"])
        s.data[k] = [];
      s.readNotice = "仅尝试响应合成边界：旧ready判定会隐藏尝试，本稿展示它作为待审提案。";
    }
    if (["paged", "attempt-page2", "dead-page2"].includes(key)) {
      s.data = clone(D.paged);
      s.window = "all";
      s.data.filters.window = "all";
      if (key === "attempt-page2") {
        s.ap = 2;
        s.data.pagination.attempts.page = 2;
      }
      if (key === "dead-page2") {
        s.dp = 2;
        s.data.pagination.dead_letters.page = 2;
      }
      syncURL();
    }
    if (key === "dead-closed") s.data.dead_letters[0].status = "replayed";
    if (
      key.startsWith("batch-") ||
      key.startsWith("reason-") ||
      key.startsWith("confirm") ||
      key === "failures-expanded"
    ) {
      s.data = clone(D.batch);
      s.selected = ["d1", "d2"];
      s.reason = "解析器已完成固定样本回放";
    }
    if (key === "batch-empty") s.selected = [];
    if (key === "reason-empty") s.reason = "";
    if (key === "reason-one") s.reason = "修";
    if (key === "reason-limit" || key === "confirm-long") s.reason = "已".repeat(500);
    if (key === "selection-limit") {
      s.data.dead_letters = Array.from({ length: 21 }, (_, i) => ({
        ...clone(O.dead_letters[0]),
        id: `synthetic-${i}`,
        task_id: `00000000-0000-4000-8000-${String(800 + i).padStart(12, "0")}`,
      }));
      s.selected = s.data.dead_letters.slice(0, 20).map((v) => v.id);
      s.batchNotice = "每批最多选择20条；第21条已拒绝。";
    }
    if (key === "root-selected") {
      s.error = "parser_failed";
      s.data.filters.error_code = s.error;
      syncURL();
    }
    if (["scope-filled", "scope-applied"].includes(key)) {
      s.org = O.dead_letters[0].organization_id;
      s.workspace = O.dead_letters[0].workspace_id;
      s.provider = O.sources[0].id;
      s.window = "7d";
    }
    if (key === "scope-invalid") {
      s.org = "错误组织编号";
      s.scopeError = "请输入有效的组织 ID。";
    }
    if (key === "scope-applied") {
      s.data.filters = {
        organization_id: s.org,
        workspace_id: s.workspace,
        provider_id: s.provider,
        window: "7d",
        error_code: null,
      };
      syncURL();
    }
    if (key === "refreshing") s.busy = true;
    if (key === "refresh-error" || key === "refresh-timeout")
      s.readNotice =
        key === "refresh-timeout"
          ? "读取超过15秒；保留旧快照及观测时间。"
          : "读取失败；此处保留旧快照，不代表当前状态。";
    if (key === "compact") {
      s.tables.sources.density = "compact";
      s.tables.attempts.density = "compact";
    }
    if (key === "long-content") {
      s.data.sources[0].name = "长名称采集来源与跨市场公开趋势".repeat(7);
      s.data.attempts[0].worker_id = "worker-long-unbroken-".repeat(10);
      s.data.root_causes[0].error_code = "unmapped_long_code_".repeat(8);
    }
    s.fixture = clone(s.data);
    render();
    if (
      key.startsWith("batch-") ||
      key.startsWith("reason-") ||
      key.startsWith("confirm") ||
      key === "selection-limit" ||
      key === "failures-expanded"
    )
      $("batch-panel").open = true;
    if (["reason-empty", "reason-one", "batch-empty"].includes(key)) preview();
    if (key.startsWith("confirm")) {
      preview();
      if (key !== "confirm") $("ack").checked = true;
      if (key === "confirm-typed") $("typed").value = "确认重放";
      updateConfirm();
    }
    if (key === "batch-running") {
      preview();
      $("ack").checked = true;
      $("typed").value = "确认重放";
      submitBatch();
    }
    if (
      [
        "batch-partial",
        "batch-failed",
        "batch-unknown",
        "batch-success",
        "batch-refresh-error",
        "failures-expanded",
      ].includes(key)
    ) {
      preview();
      $("ack").checked = true;
      $("typed").value = "确认重放";
      submitBatch();
      complete(key === "batch-failed" ? "error" : "success");
      complete(
        key === "batch-unknown"
          ? "unknown"
          : ["batch-success", "batch-refresh-error"].includes(key)
            ? "success"
            : "error",
      );
      complete(key === "batch-refresh-error" ? "error" : "success");
      if (key === "failures-expanded") $("failures").open = true;
    }
    if (key === "source-detail" || key === "source-technical") {
      record("source", 0, "source-record-0");
      if (key.endsWith("technical")) $("record-tech").open = true;
    }
    if (key === "attempt-detail" || key === "attempt-technical") {
      record("attempt", 0, "attempt-record-0");
      if (key.endsWith("technical")) $("record-tech").open = true;
    }
    if (["scope", "scope-invalid", "scope-filled"].includes(key)) scopeModal();
    if (key === "columns-source") $("columns-sources").open = true;
    if (key === "columns-attempt") $("columns-attempts").open = true;
    $("review-tools").open = key === "tools";
    $("scene-picker").value = key;
    $("simulation-note").textContent = "";
    window.scrollTo(0, 0);
    if (key === "focus") $("refresh").focus({ preventScroll: true });
  }
  function updateConfirm() {
    if ($("confirm-batch"))
      $("confirm-batch").disabled = !$("ack").checked || $("typed").value.trim() !== "确认重放";
  }
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link && link.getAttribute("href").startsWith("/")) {
      e.preventDefault();
      s.intents.push({ method: "NAVIGATE", path: link.getAttribute("href") });
      $("intents").textContent = JSON.stringify(s.intents, null, 2);
      return;
    }
    const n = e.target.closest("button");
    if (!n || n.disabled) return;
    if (n.hasAttribute("data-close")) return closeModal();
    if (n.dataset.result) {
      $("simulation-note").textContent = complete(n.dataset.result)
        ? "模拟结果已应用"
        : "没有等待中的请求";
      return;
    }
    if (n.id === "open-scope") return scopeModal();
    if (n.id === "refresh" || n.id === "retry-read") return read();
    if (n.id === "preview") return preview();
    if (n.id === "confirm-batch") return submitBatch();
    if (n.id === "expand-sources") {
      s.sourcesExpanded = !s.sourcesExpanded;
      render();
      return;
    }
    if (n.dataset.record) {
      const [kind, i] = n.dataset.record.split(":");
      return record(kind, Number(i), n.id);
    }
    if (n.dataset.freeze) {
      s.tables[n.dataset.freeze].freeze = !s.tables[n.dataset.freeze].freeze;
      render();
      return;
    }
    if (n.dataset.root || n.id === "clear-root") {
      if (s.busy || s.batchBusy) return;
      s.error = n.id === "clear-root" || s.error === n.dataset.root ? "" : n.dataset.root;
      s.ap = 1;
      s.dp = 1;
      read();
    }
    if (n.dataset.page) {
      const [kind, delta] = n.dataset.page.split(":");
      if (kind === "attempts") s.ap = s.data.pagination.attempts.page + Number(delta);
      else s.dp = s.data.pagination.dead_letters.page + Number(delta);
      read();
    }
    if (n.id === "reset") {
      s.org = "";
      s.workspace = "";
      s.provider = "";
      s.window = "24h";
      s.error = "";
      s.ap = 1;
      s.dp = 1;
      read();
    }
  });
  $("scope-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (s.busy || s.batchBusy) return;
    s.ap = 1;
    s.dp = 1;
    if (read()) closeModal();
  });
  document.addEventListener("input", (e) => {
    const n = e.target;
    if (["org", "workspace", "provider", "window"].includes(n.id)) {
      s[n.id] = n.value;
      $("reset").disabled = s.busy || s.batchBusy || !derive().scopeFilterCount.value;
    }
    if (n.id === "reason") {
      s.reason = n.value;
      $("reason-help").textContent =
        `原始长度≤500，去除首尾空白后至少2字；${s.reason.length} / 500`;
    }
    if (n.id === "typed") updateConfirm();
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.id === "ack") updateConfirm();
    if (n.id === "scene-picker") return scene(n.value);
    if (n.dataset.dead) {
      if (s.busy || s.batchBusy) return;
      if (!n.checked) s.selected = s.selected.filter((v) => v !== n.dataset.dead);
      else if (s.selected.length >= 20) {
        n.checked = false;
        s.batchNotice = "每批最多选择20条开放死信。";
      } else s.selected.push(n.dataset.dead);
      render();
    }
    if (n.dataset.column) {
      const [kind, i] = n.dataset.column.split(":");
      const t = s.tables[kind];
      t.hidden = n.checked ? t.hidden.filter((v) => v !== Number(i)) : [...t.hidden, Number(i)];
      render();
    }
    if (n.dataset.density) {
      s.tables[n.dataset.density].density = n.value;
      render();
    }
  });
  for (const d of document.querySelectorAll("dialog")) {
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeModal();
    });
    d.addEventListener("click", (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeModal();
    });
    d.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...d.querySelectorAll(
          "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,a[href]",
        ),
      ].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
      const target =
        e.shiftKey && document.activeElement === nodes[0]
          ? nodes.at(-1)
          : !e.shiftKey && document.activeElement === nodes.at(-1)
            ? nodes[0]
            : null;
      if (target) {
        e.preventDefault();
        target.focus();
      }
    });
  }
  $("scene-picker").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  window.OVERVIEW_C = {
    scenes,
    scene,
    read,
    complete,
    preview,
    submitBatch,
    state: () =>
      clone({
        ...s,
        pending: pending ? { id: pending.id, kind: pending.kind } : null,
        batchSnapshot,
      }),
  };
  scene("default");
})();
