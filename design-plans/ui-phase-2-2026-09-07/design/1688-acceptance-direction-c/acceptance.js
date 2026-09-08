(() => {
  const D = window.ACCEPTANCE_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (v) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v],
    );
  const app = document.querySelector("#app"),
    review = document.querySelector("#review");
  let c,
    generation = 0,
    sequence = 0,
    pending = new Map(),
    intents = [],
    readNotice = "",
    resultNotice = "",
    unknown = false,
    label = "",
    expanded = false,
    technical = false,
    taskOpen = false,
    gateOpen = {},
    submittedScope = "";
  const sceneNames = {
    default: "原始2/3门禁与12/3/1覆盖",
    pending: "原始全部待验收",
    context: "手机结论与下一步展开",
    gates: "三项证据全部展开",
    technical: "技术详情",
    loading: "初次读取",
    expired: "登录过期",
    forbidden: "权限拒绝",
    error: "首次读取失败",
    refreshing: "刷新保留原证据",
    "refresh-error": "刷新失败",
    "refresh-timeout": "刷新超时",
    "refresh-expired": "刷新登录失效",
    "refresh-forbidden": "刷新权限拒绝",
    "scope-loading": "组织读取中",
    "scope-error": "组织读取失败",
    "scope-empty": "无活动组织",
    "workspace-loading": "工作区读取中",
    "workspace-empty": "无活动工作区",
    "workspace-error": "工作区读取失败",
    "query-filled": "已填写运行范围",
    "query-limit": "200字关键词",
    submitting: "提交进行中",
    scheduled: "已排队未完成",
    "scheduled-read-error": "已排队但重读失败",
    "submit-error": "提交失败保留输入",
    "submit-unknown": "提交结果未知",
    "task-detail": "已创建任务编号",
    "coverage-invalid": "合成覆盖合同异常",
    "long-content": "合成长原因",
    focus: "键盘焦点",
    hover: "悬停",
    pressed: "按下",
    "review-tools": "非业务审核工具",
  };
  for (const key of Object.keys(D.variants)) sceneNames[key] = `合成门禁组合 ${key}`;
  for (const key of [
    "scheduled",
    "leased",
    "running",
    "succeeded",
    "succeeded_empty",
    "failed",
    "blocked",
    "cancelled",
    "dead_letter",
  ])
    sceneNames[`run-${key}`] = `合成最近运行 ${key}`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.kind = status === 401 ? "expired" : status === 403 ? "forbidden" : "error";
      this.actionHint = `合成请求拒绝 ${status}`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function createModel() {
    const owner = ++generation;
    return window.ACCEPTANCE_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: () => {},
      defineProps: () => ({ apiBaseUrl: "offline" }),
      createApiClient:
        () =>
        (path, options = {}) =>
          new Promise((resolve, reject) => {
            const id = ++sequence,
              method = options.method ?? "GET";
            intents.push({
              id,
              method,
              path,
              ...(options.body === undefined ? {} : { body: clone(options.body) }),
            });
            pending.set(id, { id, owner, path, method, resolve, reject });
          }),
      ApiClientError,
      AbortController,
      DOMException,
      window: { setTimeout: () => 1, clearTimeout: () => {} },
    });
  }
  const tag = (state, text) => `<span class="tag" data-state="${esc(state)}">${esc(text)}</span>`;
  const link = (text, path) => `<a href="#" data-route="${esc(path)}">${esc(text)}</a>`;
  const notice = (text, error = false) =>
    text ? `<p class="notice" data-error="${error}" role="status">${esc(text)}</p>` : "";
  function render() {
    if (app.dataset.generation === String(generation)) {
      for (const details of app.querySelectorAll("details[data-gate]"))
        gateOpen[details.dataset.gate] = details.open;
      const technicalNode = app.querySelector("#technical");
      const taskNode = app.querySelector("#task-detail");
      if (technicalNode) technical = technicalNode.open;
      if (taskNode) taskOpen = taskNode.open;
    }
    app.dataset.generation = String(generation);
    const id = document.activeElement?.id,
      position = document.activeElement?.selectionStart;
    const d = c.data.value,
      ready = c.state.value === "ready" && d;
    const context = ready
      ? `<h2>${esc(c.title.value)}</h2><dl><div><dt>来源状态</dt><dd>${esc(c.sourceState[d.source_status])}</dd></div><div><dt>证据通过</dt><dd>${c.passedGateCount.value} / 3</dd></div><div><dt>负责人</dt><dd>${esc(d.owner_label)}</dd></div></dl><p class="description">结论来自服务端检查；来源启停以返回状态为准，不由当前门禁数推断。</p><div class="next">${link("配置或续期登录档案", c.credentialsLink.value)}${link("定位 1688 固定样本", c.sampleLink.value)}</div><button type="button" id="context" class="mobile-context" aria-expanded="${expanded}">${expanded ? "收起" : "查看"}说明与下一步</button>`
      : "<h2>等待检查结果</h2><p>读取状态不代表来源是否可用。</p>";
    app.innerHTML = `<div class="frame"><aside class="verdict ${expanded ? "expanded" : ""}"><nav><strong>ScoutOps</strong>${link("来源频道", "/platform-admin/providers/sources")}</nav><p>1688 登录来源</p>${context}</aside><main class="paper"><header class="page-head"><div><h1>1688 启用检查</h1><p>先核对证据，再发起受控运行。提交任务不会自动启用来源。</p></div><div class="refresh"><button type="button" id="refresh" ${c.refreshing.value ? "disabled" : ""}>${c.refreshing.value ? "刷新中…" : "刷新检查结果"}</button><small>最近读取 ${esc(c.lastUpdatedLabel.value)}</small></div></header><p class="review-label">P49 / C 方向待审稿 · ${esc(label)} · 无生产连接</p>${notice(readNotice, /失败|超时|失效|拒绝/.test(readNotice))}${ready ? readyContent(d) : `<section class="empty"><h2>${esc(c.stateTitle.value)}</h2><p>${esc(c.message.value || "正在核对登录、验证码与字段解析证据。")}</p>${c.state.value === "expired" ? link("重新登录", "/login") : c.state.value === "forbidden" ? link("返回平台概览", "/platform-admin") : c.state.value !== "loading" ? '<button type="button" id="retry">重新读取</button>' : ""}${c.requestId.value ? `<details class="technical"><summary>故障详情</summary><code>${esc(c.requestId.value)}</code></details>` : ""}</section>`}<p class="footnote">审核原型只记录离线意图，不调用真实来源、创建任务或读取登录秘密。</p></main></div>`;
    const next = document.getElementById(id);
    if (next && !next.disabled) {
      next.focus({ preventScroll: true });
      if (next.tagName === "INPUT" && position != null) next.setSelectionRange(position, position);
    }
  }
  function readyContent(d) {
    return `<section class="section" aria-labelledby="gates-title"><h2 id="gates-title">还需要哪些启用证据</h2><p>登录态、验证码、当前解析器分别核验；覆盖记录不计入这三项。</p>${d.gates.map((g) => `<article class="gate"><div><h3>${esc(c.gateName[g.key])}</h3></div><details data-gate="${g.key}" ${(gateOpen[g.key] ?? (innerWidth > 760 || g.state !== "passed")) ? "open" : ""}><summary id="gate-${g.key}">${tag(g.state, c.gateState[g.state])}</summary><p>${esc(g.reason)}</p><p class="meta">${esc(c.gateAction[g.key])}</p><time>证据时间：${esc(c.time(g.evidence_at))}</time></details></article>`).join("")}${d.pending_reasons.length ? `<div class="notice"><h3>待处理原因</h3><ul class="pending">${d.pending_reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>` : `<p>${d.overall === "production_ready" ? "当前检查无待处理原因，来源已启用；仍需关注后续变化。" : "当前检查无待处理原因，仍需负责人显式启用。"}</p>`}</section><section class="section" aria-labelledby="form-title"><h2 id="form-title">发起一次登录验收</h2><p>选择本次运行范围，只创建人工验收任务，不加入自动调度。</p><form id="run-form" class="scope-form"><label>组织<select id="organization" ${c.scopeLoading.value || c.scheduling.value ? "disabled" : ""}><option value="">请选择组织</option>${c.organizations.value.map((o) => `<option value="${esc(o.id)}" ${o.id === c.selectedOrganizationId.value ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select></label><label>工作区<select id="workspace" ${c.scopeLoading.value || c.scheduling.value ? "disabled" : ""}><option value="">请选择工作区</option>${c.workspaces.value.map((w) => `<option value="${esc(w.id)}" ${w.id === c.selectedWorkspaceId.value ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label><label class="query">验收关键词<input id="query" type="text" maxlength="200" autocomplete="off" placeholder="例如：桌面灯" value="${esc(c.acceptanceQuery.value)}" ${c.scheduling.value ? "disabled" : ""}/></label><div class="submit-row"><p id="run-hint">${unknown ? "上次提交结果未知，暂不重复提交；读取检查也不能证明未知任务已结束。" : c.scopeLoading.value ? "正在读取运行范围。" : !c.selectedOrganizationId.value || !c.selectedWorkspaceId.value ? "需要活动组织与工作区。" : !c.acceptanceQuery.value.trim() ? "填写关键词后可发起运行。" : "排队确认与浏览器运行结果分开展示。"}</p><button type="submit" id="run" class="primary" aria-describedby="run-hint" ${!c.canSchedule.value || unknown ? "disabled" : ""}>${c.scheduling.value ? "提交中…" : "发起登录验收运行"}</button></div></form>${c.scopeMessage.value ? `<p class="notice" data-error="true" role="alert">${esc(c.scopeMessage.value)}</p><button type="button" id="scope-retry" ${c.scopeLoading.value || c.scheduling.value ? "disabled" : ""}>重新读取运行范围</button>` : ""}${notice(resultNotice, /失败|未知/.test(resultNotice))}${submittedScope ? `<p class="meta">本次提交范围：${esc(submittedScope)}</p>` : ""}${c.scheduledTaskId.value ? `<details id="task-detail" ${taskOpen ? "open" : ""}><summary>运行详情</summary><code>任务编号：${esc(c.scheduledTaskId.value)}</code><p class="meta">只确认排队，不提供当前没有的任务直达或停止操作。</p></details>` : ""}</section><section class="section run" aria-labelledby="run-title"><h2 id="run-title">最近浏览器运行</h2><p>${esc(c.currentRunState.value)}；这是已读取记录，不推定为刚提交任务的结果。</p>${d.latest_run ? `<dl><div><dt>开始时间</dt><dd>${esc(c.time(d.latest_run.started_at))}</dd></div><div><dt>完成时间</dt><dd>${esc(c.time(d.latest_run.finished_at))}</dd></div><div><dt>错误分类</dt><dd>${esc(d.latest_run.error_code || "无")}</dd></div></dl>` : "<p>尚无运行记录；请先配置有效登录档案。</p>"}</section><section class="section" aria-labelledby="coverage-title"><h2 id="coverage-title">这次作业实际覆盖了什么</h2><p>检查搜索、商品详情和翻页观测；它们不替代启用门禁。</p><p class="meta">解析器 ${esc(d.coverage_matrix.parser_version)}<br>观测时间 ${esc(c.time(d.coverage_matrix.observed_at))}</p><div class="matrix">${d.coverage_matrix.rows.map((r) => `<article><header><h3>${esc(c.matrixName[r.key])}</h3>${tag(r.state, c.matrixState[r.state])}</header><p>${esc(r.reason)}</p><div class="meta"><span>${esc(r.contract)}</span><span>观测 ${r.observed_count} 项</span></div></article>`).join("")}</div><details class="technical" id="technical" ${technical ? "open" : ""}><summary>技术详情</summary><code>overall ${esc(d.overall)}</code><code>来源内部编号：${esc(d.provider_id)}</code><code>关联编号：${esc(c.requestId.value || "未提供")}</code></details></section>`;
  }
  function restoreFocus(id) {
    if (document.activeElement !== document.body) return;
    const target = document.getElementById(id);
    (target && !target.disabled ? target : document.getElementById("refresh"))?.focus({
      preventScroll: true,
    });
  }
  async function read() {
    const trigger = document.activeElement?.id;
    const owner = generation,
      model = c;
    if (model.refreshing.value) return false;
    readNotice = model.data.value ? "正在刷新，保留上次证据。" : "";
    const p = model.load();
    render();
    await p;
    if (owner !== generation) return false;
    if (model.message.value)
      readNotice = `读取失败：${model.message.value}${model.data.value ? " 已保留上次证据。" : ""}`;
    else readNotice = "读取完成，证据时间仍以各项记录为准。";
    render();
    restoreFocus(trigger);
    return true;
  }
  async function scopes(workspaceOnly = false) {
    const owner = generation,
      model = c,
      p = workspaceOnly ? model.loadWorkspaces() : model.loadExecutionScopes();
    render();
    await p;
    if (owner === generation) {
      render();
      restoreFocus("organization");
    }
  }
  async function schedule() {
    if (!c.canSchedule.value || unknown) return false;
    const trigger = document.activeElement?.id;
    const owner = generation,
      model = c;
    submittedScope = `${model.organizations.value.find((o) => o.id === model.selectedOrganizationId.value)?.name} / ${model.workspaces.value.find((w) => w.id === model.selectedWorkspaceId.value)?.name} / ${model.acceptanceQuery.value.trim()}`;
    resultNotice = "正在提交，关闭页面不代表取消任务。";
    const p = model.scheduleAcceptanceRun();
    render();
    await p;
    if (owner !== generation) return false;
    if (unknown) resultNotice = "提交结果未知，可能已经创建任务；请核对后再处理，不自动重试。";
    else if (model.scopeMessage.value) resultNotice = "本次提交失败，输入已保留。";
    else resultNotice = "验收任务已排队；不是浏览器运行成功，也没有启用来源。";
    if (model.message.value) readNotice = `检查重读失败：${model.message.value} 已保留上次证据。`;
    render();
    restoreFocus(trigger);
    return true;
  }
  async function complete(outcome = "success", id = [...pending.keys()][0]) {
    const request = pending.get(id);
    if (!request) return false;
    pending.delete(id);
    if (request.owner !== generation) {
      request.reject(new Error("stale"));
      return false;
    }
    if (outcome === "unknown") unknown = true;
    if (["error", "unknown", "expired", "forbidden", "timeout"].includes(outcome))
      request.reject(
        outcome === "timeout"
          ? new DOMException("aborted", "AbortError")
          : new ApiClientError(outcome === "expired" ? 401 : outcome === "forbidden" ? 403 : 503),
      );
    else {
      const value =
        request.method === "POST"
          ? D.scheduled
          : request.path === "/org/memberships"
            ? outcome === "empty"
              ? []
              : D.organizations
            : request.path.endsWith("/workspaces")
              ? outcome === "empty"
                ? []
                : D.workspaces
              : c.data.value || D.original;
      request.resolve({ data: clone(value), request_id: "fixture-request" });
    }
    for (let n = 0; n < 12; n++) await Promise.resolve();
    render();
    return true;
  }
  function scene(key) {
    if (!(key in sceneNames)) throw Error(key);
    // End old inert reads; a fresh model keeps late source callbacks out of the new scene.
    for (const request of pending.values()) request.reject(new Error("review scene changed"));
    pending = new Map();
    intents = [];
    readNotice = "";
    resultNotice = "";
    unknown = false;
    expanded = false;
    technical = false;
    taskOpen = false;
    submittedScope = "";
    gateOpen = {};
    document.activeElement?.blur();
    c = createModel();
    c.state.value = "ready";
    c.data.value = clone(D.original);
    c.organizations.value = clone(D.organizations);
    c.workspaces.value = clone(D.workspaces);
    c.selectedOrganizationId.value = D.organizations[0].id;
    c.selectedWorkspaceId.value = D.workspaces[0].id;
    c.lastUpdatedAt.value = "2026-09-09T02:00:00.000Z";
    label = [
      "default",
      "pending",
      "context",
      "gates",
      "technical",
      "focus",
      "hover",
      "pressed",
      "review-tools",
    ].includes(key)
      ? "原始 E2E 夹具"
      : "原始事实夹具 / 合成界面状态";
    if (D.variants[key]) {
      c.data.value = clone(D.variants[key]);
      label = "合成SQL行经源方法派生；无真实观测";
    }
    if (key === "pending") c.data.value = clone(D.pending);
    if (key === "context") expanded = true;
    if (key === "gates") gateOpen = { login: true, captcha: true, parser: true };
    if (key === "technical") technical = true;
    if (key === "task-detail") taskOpen = true;
    if (["loading", "expired", "forbidden", "error"].includes(key)) {
      c.state.value = key;
      c.refreshing.value = key === "loading";
      c.data.value = null;
      c.message.value = key === "loading" ? "" : "合成读取状态，请使用恢复入口。";
    }
    if (key === "refreshing") c.refreshing.value = true;
    if (key.startsWith("refresh-"))
      readNotice = `合成刷新${{ error: "失败", timeout: "超时", expired: "登录失效", forbidden: "权限拒绝" }[key.slice(8)]}，保留上次证据与观测时间。`;
    if (key.startsWith("scope-")) {
      c.organizations.value = [];
      c.workspaces.value = [];
      c.selectedOrganizationId.value = "";
      c.selectedWorkspaceId.value = "";
      c.scopeLoading.value = key === "scope-loading";
      c.scopeMessage.value = c.scopeLoading.value
        ? ""
        : key === "scope-empty"
          ? "当前账号没有可用于验收的活动组织。"
          : "组织范围读取失败，请重试。";
    }
    if (key.startsWith("workspace-")) {
      c.workspaces.value = [];
      c.selectedWorkspaceId.value = "";
      c.scopeLoading.value = key === "workspace-loading";
      c.scopeMessage.value = c.scopeLoading.value
        ? ""
        : key === "workspace-empty"
          ? "该组织没有可用于验收的活动工作区。"
          : "工作区读取失败，请重试。";
    }
    if (
      [
        "query-filled",
        "submitting",
        "scheduled",
        "scheduled-read-error",
        "submit-error",
        "submit-unknown",
        "task-detail",
      ].includes(key)
    )
      c.acceptanceQuery.value = "桌面灯";
    if (key === "query-limit") c.acceptanceQuery.value = "验".repeat(200);
    if (key === "submitting") {
      c.scheduling.value = true;
      resultNotice = "合成提交中；关闭页面不代表取消任务。";
    }
    if (["scheduled", "scheduled-read-error", "task-detail"].includes(key)) {
      c.scheduledTaskId.value = D.scheduled.task_id;
      resultNotice = "合成验收任务已排队；未证明运行成功，不自动启用来源。";
    }
    if (key === "scheduled-read-error")
      readNotice = "合成检查重读失败，已保留上次证据。任务排队确认仍然有效。";
    if (key === "submit-error") {
      c.scopeMessage.value = "合成提交失败，原输入已保留。";
      resultNotice = c.scopeMessage.value;
    }
    if (key === "submit-unknown") {
      unknown = true;
      resultNotice = "合成提交结果未知，可能已有任务；不自动重试。";
    }
    if (key === "coverage-invalid") {
      label = "合成覆盖异常，不改变启用结论";
      c.data.value.coverage_matrix.rows.forEach((r) => {
        r.state = "invalid";
        r.reason = "合成结构化结果不符合当前合同。";
      });
    }
    if (key === "long-content") {
      label = "合成长内容";
      c.data.value.owner_label = "平台来源管理与解析质量核验负责人".repeat(3);
      c.data.value.gates[2].reason = "当前解析器样本与审批证据需要逐项核对。".repeat(12);
    }
    if (key.startsWith("run-")) {
      label = "合成运行状态";
      c.data.value.latest_run.status = key.slice(4);
      if (["scheduled", "leased", "running"].includes(key.slice(4)))
        c.data.value.latest_run.finished_at = null;
    }
    render();
    if (key === "focus") document.querySelector("#refresh").focus();
    review.hidden = key !== "review-tools" && !new URL(location.href).searchParams.has("review");
    review.innerHTML = `<label>非业务审核场景<select id="scene">${Object.entries(sceneNames)
      .map(([k, v]) => `<option value="${k}" ${key === k ? "selected" : ""}>${esc(v)}</option>`)
      .join("")}</select></label>`;
    window.scrollTo(0, 0);
  }
  app.addEventListener("click", (e) => {
    const n = e.target.closest("button,a");
    if (!n || n.disabled) return;
    if (n.dataset.route) {
      e.preventDefault();
      intents.push({ method: "NAVIGATE", path: n.dataset.route });
      return;
    }
    if (["refresh", "retry"].includes(n.id)) void read();
    if (n.id === "scope-retry") void scopes();
    if (n.id === "context") {
      expanded = !expanded;
      render();
    }
  });
  app.addEventListener("submit", (e) => {
    e.preventDefault();
    void schedule();
  });
  app.addEventListener("input", (e) => {
    if (e.target.id === "query") {
      c.acceptanceQuery.value = e.target.value;
      render();
    }
  });
  app.addEventListener("change", (e) => {
    if (e.target.id === "organization") {
      c.selectedOrganizationId.value = e.target.value;
      void scopes(true);
    }
    if (e.target.id === "workspace") {
      c.selectedWorkspaceId.value = e.target.value;
      render();
    }
  });
  app.addEventListener(
    "toggle",
    (e) => {
      if (e.target.dataset.gate) gateOpen[e.target.dataset.gate] = e.target.open;
      if (e.target.id === "technical") technical = e.target.open;
      if (e.target.id === "task-detail") taskOpen = e.target.open;
    },
    true,
  );
  review.addEventListener("change", (e) => {
    if (e.target.id === "scene") scene(e.target.value);
  });
  window.ACCEPTANCE_C = {
    scenes: sceneNames,
    scene,
    read,
    scopes,
    schedule,
    complete,
    state: () => ({
      data: clone(c.data.value),
      view: c.state.value,
      scopeLoading: c.scopeLoading.value,
      scheduling: c.scheduling.value,
      refreshing: c.refreshing.value,
      organization: c.selectedOrganizationId.value,
      workspace: c.selectedWorkspaceId.value,
      query: c.acceptanceQuery.value,
      task: c.scheduledTaskId.value,
      canSchedule: c.canSchedule.value,
      unknown,
      readNotice,
      resultNotice,
      scopeMessage: c.scopeMessage.value,
      intents: clone(intents),
      pending: [...pending.values()].map(({ id, owner, path, method }) => ({
        id,
        owner,
        path,
        method,
      })),
    }),
  };
  scene("default");
})();
