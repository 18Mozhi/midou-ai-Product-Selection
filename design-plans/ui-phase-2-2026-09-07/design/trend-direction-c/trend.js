/* Local review only. Intent records never leave memory; no network, storage or clipboard writes. */
const scenes = [
  "topics",
  "detail",
  "detail-long",
  "detail-no-evidence",
  "detail-history",
  "detail-source",
  "detail-readonly",
  "help",
  "filter-open",
  "filter-edited",
  "filtered",
  "all-status",
  "copy-failed",
  "page-two",
  "empty",
  "loading",
  "error",
  "expired",
  "forbidden",
  "blocked",
  "detail-loading",
  "detail-failed",
  "followed",
  "follow-busy",
  "follow-failed",
  "refresh-busy",
  "refresh-started",
  "refresh-failed",
  "rules",
  "rules-empty",
  "rules-paused",
  "rules-failed-sources",
  "rules-error",
  "rules-readonly",
  "rule-open",
  "rule-edited",
  "rule-busy",
  "rule-failed",
  "rule-duplicate",
  "rule-saved",
  "anomaly-open",
  "anomaly-edited",
  "anomaly-busy",
  "anomaly-failed",
  "anomaly-existing",
  "anomaly-created",
  "irrelevant-open",
  "irrelevant-busy",
  "irrelevant-failed",
  "irrelevant-saved",
  "restore-open",
  "restore-failed",
  "restore-saved",
  "governance",
  "governance-empty",
  "governance-error",
  "merge-edited",
  "split-edited",
  "proposal-busy",
  "proposal-failed",
  "proposal-queued",
  "confirm-open",
  "confirm-failed",
  "confirmed",
  "reject-open",
  "reject-failed",
  "rejected",
  "self-decision-failed",
];
const clone = (v) => JSON.parse(JSON.stringify(v));
const modal = document.querySelector("#modal");
let S,
  generation = 0,
  opener = "";
const keywordList = (v) =>
  v
    .split(/[,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
function render() {
  document.querySelector("#modes").innerHTML = [
    ["topics", "趋势主题"],
    ["rules", "监控规则"],
    ...(S.canManage ? [["governance", "合并拆分"]] : []),
  ]
    .map(([id, label]) => button(`mode-${id}`, label, S.mode === id ? 'aria-current="page"' : ""))
    .join("");
  const enabled = S.rules.filter((r) => r.status === "enabled"),
    failed = [...new Set(enabled.flatMap((r) => r.last_failed_sources))];
  document.querySelector("#content").innerHTML =
    `<header class="command"><div><small class="section-tag">MARKET INTELLIGENCE / 隔离样例</small><h2>${S.mode === "topics" ? "热点趋势" : S.mode === "rules" ? "监控规则" : "主题治理"}</h2><p>信号可追溯，缺失数据不补造。</p></div><nav aria-label="趋势操作">${S.canManage ? button("rule", enabled.length ? "创建趋势监控" : "创建第一条监控规则", `class="primary" ${disabled()}`) : ""}${button("refresh", S.busy === "refresh" ? "正在启动…" : "立即刷新来源", disabled())}${button("mode-rules", "管理监控规则")}</nav></header>${S.state === "ready" || S.state === "empty" ? `<section class="readiness" aria-label="市场证据就绪"><div><span>自动监控</span><b>${enabled.length} 条启用</b><small>${enabled.filter((r) => r.last_evaluated_at).length} 条已有评估记录</small></div><div><span>当前市场主题</span><b>${S.total} 个</b><small>只表示当前范围的读取结果</small></div><div><span>来源运行</span><b>${failed.length ? `${failed.length} 个异常` : "未报告异常"}</b><small>仅启用规则最近一次记录</small></div></section>` : ""}${S.message ? `<p id="message" class="${S.bad ? "error" : "notice"}" role="status">${esc(S.message)}</p>` : ""}${S.mode === "topics" ? `${button("filter", "筛选趋势", 'class="filter-trigger" aria-haspopup="dialog"')}<section class="surface filter-inline">${filterView()}</section>${S.state !== "ready" ? stateView() : S.detailOpen ? (S.detailState === "ready" ? detailView() : `<section class="surface state-panel"><h3>${S.detailState === "loading" ? "正在读取主题证据" : "主题证据读取失败"}</h3><p>不将上一个主题的证据展示为当前主题。</p>${button("back", "返回趋势列表")}${S.detailState === "error" ? button("reload-detail", "重新读取主题") : ""}</section>`) : topicListView()}<details class="help" ${S.help ? "open" : ""}><summary>帮助：热点趋势怎么看</summary><h3>可追溯的选品信号，不是热搜排名</h3><p>热度是实际信号数。置信度和增速缺少测量规则时保持数据不足，不依据来源数量自动生成分数。</p><p>关注、建立监控、转为机会是三个不同动作；进入机会不代表自动采纳。</p></details>` : S.state !== "ready" && S.state !== "empty" ? stateView() : S.mode === "rules" ? rulesView() : governanceView()}`;
  if (S.modal) {
    modal.className = S.modal === "filter" ? "filter-modal" : "";
    modal.innerHTML = modalView();
    if (!modal.open) modal.showModal();
    (modal.querySelector("button:not(:disabled)") || modal).focus();
  } else if (modal.open) {
    modal.close();
    if (opener) document.querySelector(opener)?.focus();
  }
  bindForms();
}
function syncButtons() {
  const submit = modal.querySelector('[type="submit"]');
  if (submit && S.modal !== "filter")
    submit.disabled = Boolean(S.busy) || (S.modal !== "rule" && S.reason.trim().length < 2);
  const p = S.proposal,
    proposal = document.querySelector('#proposal-form [type="submit"]');
  if (proposal)
    proposal.disabled =
      Boolean(S.busy) ||
      p.reason.trim().length < 2 ||
      (p.operation === "merge" ? !p.sourceIds.length : !p.signalIds.length || !p.newTitle.trim());
  const decision = document.querySelector('#decision-form [type="submit"]');
  if (decision) decision.disabled = Boolean(S.busy) || S.decision.reason.trim().length < 2;
}
function bindForms() {
  document.querySelectorAll("#filter-form").forEach((form) => {
    form.addEventListener("input", (e) => {
      if (!e.target.name) return;
      if (e.target.name === "sort") S.sort = e.target.value;
      else S.filters[e.target.name] = e.target.value;
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilters();
    });
  });
  document.querySelector("#timeline-source")?.addEventListener("change", (e) => {
    S.timelineSource = e.target.value;
    render();
    document.querySelector("#timeline-source")?.focus();
  });
  modal.querySelector("#modal-form")?.addEventListener("input", (e) => {
    const n = e.target.name;
    if (!n) return;
    if (S.modal === "rule") S.ruleForm[n] = T.options[n] ? Number(e.target.value) : e.target.value;
    else if (n === "severity") S.severity = e.target.value;
    else S.reason = e.target.value;
    syncButtons();
  });
  modal.querySelector("#modal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitModal();
  });
  document.querySelector("#proposal-form")?.addEventListener("input", (e) => {
    const n = e.target.name;
    if (!n) return;
    if (n === "sourceIds" || n === "signalIds") {
      const values = S.proposal[n];
      S.proposal[n] = e.target.checked
        ? [...new Set([...values, e.target.value])]
        : values.filter((v) => v !== e.target.value);
    } else S.proposal[n] = e.target.value;
    syncButtons();
  });
  document.querySelector("#proposal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    propose();
  });
  document.querySelector("#decision-form")?.addEventListener("input", (e) => {
    S.decision.reason = e.target.value;
    syncButtons();
  });
  document.querySelector("#decision-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    decide();
  });
}
function recordRead() {
  const p = new URLSearchParams({ page: String(S.page), page_size: "20" });
  Object.entries(S.filters).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  S.lastIntent = {
    method: "GET",
    paths: [
      `/trends?${p}`,
      "/trends/monitoring-rules",
      ...(S.canManage ? ["/trends/change-requests"] : []),
    ],
  };
}
function serialize() {
  const q = new URLSearchParams();
  Object.entries(S.query).forEach(([k, v]) => {
    if (v !== undefined) q.set(k, String(v));
  });
  return "/trends" + (q.size ? "?" + q : "");
}
function applyFilters() {
  S.page = 1;
  S.query = {
    ...S.query,
    q: S.filters.q || undefined,
    market: S.filters.market || undefined,
    category: S.filters.category || undefined,
    status: S.filters.status === "active" ? undefined : S.filters.status,
    sort: S.sort === "impact" ? undefined : S.sort,
    page: undefined,
    topic: undefined,
    section: undefined,
  };
  S.url = serialize();
  S.detailOpen = false;
  S.modal = null;
  S.mode = "topics";
  S.state = "ready";
  recordRead();
  render();
  document.querySelector('[data-action="filter"]')?.focus();
}
function closeModal() {
  if (S.busy) return;
  S.modal = null;
  S.modalError = "";
  render();
  if (opener) document.querySelector(opener)?.focus();
}
function openModal(kind, selector) {
  if (S.busy || (!S.canManage && kind !== "filter")) return;
  opener = selector;
  S.modal = kind;
  S.modalError = "";
  S.reason = "";
  S.severity = "warning";
  S.ruleForm = clone(T.ruleForm);
  render();
  modal.querySelector("button")?.focus();
}
function start(kind, intent, done) {
  if (S.busy) return;
  S.busy = kind;
  S.lastIntent = intent;
  S.message = "";
  S.modalError = "";
  render();
  const mine = generation;
  setTimeout(() => {
    if (mine !== generation) return;
    S.busy = "";
    done();
    render();
  }, 400);
}
function writeFailed() {
  if (S.fail) {
    S.bad = true;
    S.message = "隔离失败响应：操作未完成，请核对状态后重试。";
    if (S.modal) S.modalError = S.message;
    return true;
  }
  return false;
}
function submitModal() {
  if (S.busy || !S.canManage) return;
  const kind = S.modal,
    d = S.detail;
  if (kind === "rule") {
    const f = S.ruleForm,
      body = {
        name: f.name,
        include_keywords: keywordList(f.include_keywords),
        negative_keywords: keywordList(f.negative_keywords),
        market: f.market,
        language: f.language,
        category: f.category || null,
        notification_channel: "in_app",
        collection_interval_minutes: f.collection_interval_minutes,
        recommendation_min_source_count: f.recommendation_min_source_count,
      };
    start("rule", { method: "POST", path: "/trends/monitoring-rules", body }, () => {
      const normalized = body.include_keywords.map((x) =>
        x.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " "),
      );
      if (new Set(normalized).size !== normalized.length) {
        S.modalError = T.duplicate.actionHint;
        return;
      }
      if (writeFailed()) return;
      S.modal = null;
      S.mode = "rules";
      S.rules = [{ ...clone(T.rule), ...body, name: body.name.trim(), version: 1 }];
      S.message = "规则创建请求成功，已重新读取规则；来源门槛只形成候选。";
      S.bad = false;
      S.query.section = "rules";
      S.url = serialize();
    });
  } else if (kind === "anomaly") {
    if (S.reason.trim().length < 2) return;
    const evidenceId = S.evidenceId;
    start(
      "anomaly",
      {
        method: "POST",
        path: `/trends/${d.id}/evidence/${evidenceId}/quality-issues`,
        body: { severity: S.severity, reason: S.reason.trim() },
      },
      () => {
        if (writeFailed()) return;
        S.issueIds[evidenceId] = "00000000-0000-4000-8000-000000000412";
        S.modal = null;
        S.reason = "";
        S.message = S.existingIssue
          ? "该证据已有未关闭质量工单，沿用返回的工单。"
          : "质量工单已创建；这里只演示返回结果。";
        S.bad = false;
      },
    );
  } else {
    if (S.reason.trim().length < 2) return;
    const status = kind === "restore" ? "active" : "irrelevant",
      reason = S.reason.trim();
    start(
      "relevance",
      {
        method: "POST",
        path: `/trends/${d.id}/relevance`,
        body: { status, reason, expected_version: d.version },
      },
      () => {
        if (writeFailed()) return;
        d.status = status;
        d.version++;
        d.relevance_history.unshift({
          status,
          reason,
          version: d.version,
          actor_id: T.request.proposed_by,
          occurred_at: T.detail.last_seen_at,
        });
        S.modal = null;
        S.reason = "";
        S.message = "相关性已更新，原始证据和历史原因保留。";
        S.bad = false;
      },
    );
  }
}
function follow() {
  if (!S.canManage) return;
  const d = S.detail,
    method = d.followed ? "DELETE" : "PUT";
  start("follow", { path: `/trends/${d.id}/follow`, method }, () => {
    if (writeFailed()) return;
    d.followed = method === "PUT";
    const item = S.topics.find((t) => t.id === d.id);
    if (item) item.followed = d.followed;
    S.message = d.followed ? "已关注该主题。" : "已取消关注。";
    S.bad = false;
  });
}
function toggleRule(id) {
  if (!S.canManage) return;
  const r = S.rules.find((v) => v.id === id);
  start(
    "toggle-rule",
    {
      path: `/trends/monitoring-rules/${r.id}`,
      method: "PATCH",
      body: {
        status: r.status === "enabled" ? "paused" : "enabled",
        expected_version: r.version,
        collection_interval_minutes: r.collection_interval_minutes,
        recommendation_min_source_count: r.recommendation_min_source_count,
      },
    },
    () => {
      if (writeFailed()) return;
      r.status = S.lastIntent.body.status;
      r.version++;
      S.message = `规则${r.status === "enabled" ? "已启用" : "已暂停"}；状态来自隔离响应。`;
      S.bad = false;
    },
  );
}
function propose() {
  const p = S.proposal;
  if (!S.canManage || S.busy || p.reason.trim().length < 2) return;
  const versions = { [S.detail.id]: S.detail.version };
  p.sourceIds.forEach((id) => {
    const t = S.topics.find((v) => v.id === id);
    if (t) versions[id] = t.version;
  });
  const body = {
    operation: p.operation,
    target_topic_id: S.detail.id,
    source_topic_ids: p.operation === "merge" ? p.sourceIds : [],
    signal_ids: p.operation === "split" ? p.signalIds : [],
    new_title: p.operation === "split" ? p.newTitle.trim() : null,
    new_category: p.operation === "split" ? p.newCategory.trim() || null : null,
    expected_versions: versions,
    reason: p.reason.trim(),
  };
  start("proposal", { method: "POST", path: "/trends/change-requests", body }, () => {
    if (writeFailed()) return;
    S.requests = [
      {
        ...clone(T.request),
        ...body,
        target_topic: clone(S.detail),
        source_topics: S.topics.filter((t) => body.source_topic_ids.includes(t.id)),
        status: "pending",
      },
    ];
    S.message = "提议已进入确认队列；尚未执行合并或拆分，需另一位管理员确认。";
    S.bad = false;
  });
}
function decide() {
  const d = S.decision,
    r = S.requests.find((v) => v.id === d.requestId);
  if (!r || !S.canManage || d.reason.trim().length < 2) return;
  const body = { decision: d.action, reason: d.reason.trim(), expected_version: r.version };
  start(
    "decision",
    { method: "POST", path: `/trends/change-requests/${r.id}/decisions`, body },
    () => {
      if (S.selfDecision) {
        S.bad = true;
        S.message = "提议人与确认人必须是两个不同的活动用户。";
        return;
      }
      if (writeFailed()) return;
      r.status = d.action === "confirm" ? "confirmed" : "rejected";
      r.decision_reason = body.reason;
      r.version++;
      d.requestId = "";
      S.message = "确认队列已重读；隔离结果不证明真实治理事务已执行。";
      S.bad = false;
    },
  );
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (a) {
    e.preventDefault();
    S.lastRoute = a.getAttribute("href");
    return;
  }
  const target = e.target.closest("button");
  if (!target || target.disabled) return;
  if (target.dataset.topic) {
    S.detail = clone(S.topics.find((t) => t.id === target.dataset.topic));
    S.detailOpen = true;
    S.detailState = "ready";
    S.timelineSource = "";
    S.query.topic = S.detail.id;
    S.query.section = undefined;
    S.url = serialize();
    S.lastIntent = { method: "GET", path: `/trends/${S.detail.id}` };
    render();
    document.querySelector('[data-action="back"]')?.focus();
    return;
  }
  if (target.dataset.evidence) {
    S.evidenceId = target.dataset.evidence;
    openModal("anomaly", `[data-evidence="${S.evidenceId}"]`);
    return;
  }
  if (target.dataset.toggleRule) {
    toggleRule(target.dataset.toggleRule);
    return;
  }
  if (target.dataset.ruleResults) {
    const r = S.rules.find((v) => v.id === target.dataset.ruleResults);
    S.filters.q = r.include_keywords[0] || "";
    applyFilters();
    return;
  }
  if (target.dataset.decision) {
    S.decision = { requestId: target.dataset.request, action: target.dataset.decision, reason: "" };
    render();
    document.querySelector("#decision-form textarea")?.focus();
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  if (action.startsWith("mode-")) {
    const mode = action.slice(5);
    if (mode === "governance" && !S.canManage) return;
    if (S.mode === "governance" && mode !== "governance")
      S.proposal = {
        operation: "merge",
        sourceIds: [],
        signalIds: [],
        newTitle: "",
        newCategory: "",
        reason: "",
      };
    S.mode = mode;
    S.query.section = mode === "topics" ? undefined : mode;
    S.url = serialize();
    render();
    return;
  }
  if (action === "back") {
    S.detailOpen = false;
    render();
    document.querySelector(".topic-row")?.focus();
  }
  if (action === "filter") openModal("filter", '[data-action="filter"]');
  if (["rule", "irrelevant", "restore"].includes(action))
    openModal(action, `[data-action="${action}"]`);
  if (action === "close-modal") closeModal();
  if (action === "follow") follow();
  if (action === "clear") {
    S.filters = { q: "", market: "", category: "", status: "active" };
    S.sort = "impact";
    S.topics = [clone(T.detail), clone(T.secondary)];
    S.total = 2;
    applyFilters();
  }
  if (action === "copy") {
    S.copiedUrl = S.url;
    S.message = S.copyFail
      ? "当前视图已同步到地址栏，可复制地址保存。"
      : "当前排序、筛选和页码链接已复制（隔离模拟，不写剪贴板）。";
    render();
  }
  if (action === "previous" || action === "next") {
    S.page += action === "next" ? 1 : -1;
    S.query.page = S.page === 1 ? undefined : S.page;
    S.query.topic = undefined;
    S.url = serialize();
    recordRead();
    render();
  }
  if (action === "reload" || action === "reload-detail") {
    S.state = "ready";
    S.detailState = "ready";
    recordRead();
    S.message = "本次读取已恢复（隔离演示）。";
    S.bad = false;
    render();
  }
  if (action === "refresh")
    start(
      "refresh",
      {
        method: "POST",
        path: "/provider-sources/refresh",
        body: {
          organization_id: "00000000-0000-4000-8000-000000000401",
          workspace_id: "00000000-0000-4000-8000-000000000402",
        },
      },
      () => {
        if (writeFailed()) return;
        S.message = "已受理 2 个来源刷新；不代表采集完成，不自动重读主题。";
        S.bad = false;
      },
    );
  if (action === "merge" || action === "split") {
    S.proposal.operation = action;
    render();
  }
  if (action === "cancel-decision") {
    S.decision.requestId = "";
    render();
  }
});
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  }
});
modal.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const nodes = [
    ...modal.querySelectorAll(
      "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
    ),
  ].filter((n) => n.getClientRects().length);
  const first = nodes[0],
    last = nodes.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
function showScene(name) {
  if (!scenes.includes(name)) throw new Error("Unknown trend scene");
  generation++;
  if (modal.open) modal.close();
  S = {
    mode: "topics",
    state: "ready",
    detailState: "ready",
    topics: [clone(T.detail), clone(T.secondary)],
    detail: clone(T.detail),
    rules: [clone(T.rule)],
    requests: [clone(T.request)],
    canManage: true,
    total: 2,
    page: 1,
    sort: "impact",
    filters: { q: "", market: "", category: "", status: "active" },
    query: { topic: T.detail.id },
    url: "",
    detailOpen: false,
    timelineSource: "",
    modal: null,
    modalError: "",
    ruleForm: clone(T.ruleForm),
    reason: "",
    severity: "warning",
    evidenceId: T.detail.evidence[0].id,
    issueIds: {},
    busy: "",
    message: "",
    bad: false,
    fail: false,
    copyFail: false,
    existingIssue: false,
    selfDecision: false,
    help: false,
    lastIntent: null,
    lastRoute: "",
    copiedUrl: "",
    proposal: {
      operation: "merge",
      sourceIds: [],
      signalIds: [],
      newTitle: "",
      newCategory: "",
      reason: "",
    },
    decision: { requestId: "", action: "confirm", reason: "" },
  };
  if (
    name.startsWith("detail") ||
    name.startsWith("follow") ||
    name.startsWith("anomaly") ||
    name.startsWith("irrelevant") ||
    name.startsWith("restore")
  )
    S.detailOpen = true;
  if (name === "detail-long") {
    S.detail.title = "长主题隔离样例：不同来源如何描述同一类商品的真实需求与使用场景";
    S.detail.evidence[0].title =
      "长证据标题用于验证中文折行与操作区域，不应把缺失摘要或解析版本补造成事实。".repeat(3);
  }
  if (name === "detail-no-evidence") {
    S.detail.evidence = [];
    S.detail.timeline = [];
    S.detail.signal_count = 0;
    S.detail.heat.value = 0;
    S.detail.source_count = 0;
    S.detail.data_quality = {
      coverage_status: "insufficient",
      evidence_count: 0,
      source_count: 0,
      stale: false,
    };
  }
  if (name === "detail-history" || name === "irrelevant-saved" || name === "restore-saved") {
    S.detail.relevance_history = [
      {
        status: "irrelevant",
        reason: "隔离历史原因：与本次主题不一致。",
        actor_id: T.request.proposed_by,
        version: 4,
        occurred_at: T.detail.last_seen_at,
      },
    ];
    S.detail.status = "irrelevant";
    S.detail.version = 4;
    if (name === "restore-saved") {
      S.detail.status = "active";
      S.detail.version = 5;
      S.detail.relevance_history.unshift({
        ...S.detail.relevance_history[0],
        status: "active",
        reason: "已补充相关证据。",
        version: 5,
      });
    }
  }
  if (name === "detail-source") {
    S.detail.timeline_sources = [
      {
        source_id: T.detail.evidence[0].provider_id,
        source_label: "Example News（合成来源分组）",
        points: [{ at: T.detail.last_seen_at, signal_count: 2 }],
      },
    ];
    S.timelineSource = S.detail.timeline_sources[0].source_id;
    S.detail.keywords = [
      { keyword: "ai skincare", type: "primary", market: "US", language: "en-US" },
    ];
  }
  if (name.endsWith("readonly")) S.canManage = false;
  if (name === "detail-loading") S.detailState = "loading";
  if (name === "detail-failed") S.detailState = "error";
  if (name === "help") S.help = true;
  if (["filter-open", "filter-edited"].includes(name) && matchMedia("(max-width:760px)").matches)
    S.modal = "filter";
  if (["filter-edited", "filtered"].includes(name)) {
    S.filters = { q: "skincare", market: "US", category: "beauty", status: "active" };
    S.sort = "latest";
    if (name === "filtered") {
      S.query = { q: "skincare", market: "US", category: "beauty", sort: "latest" };
    }
  }
  if (name === "all-status") {
    S.filters.status = "";
    S.query.status = "";
  }
  if (name === "copy-failed") {
    S.copyFail = true;
    S.message = "当前视图已同步到地址栏，可复制地址保存。";
  }
  if (name === "page-two") {
    S.page = 2;
    S.total = 41;
    S.query.page = 2;
  }
  if (["loading", "empty", "error", "expired", "forbidden", "blocked"].includes(name))
    S.state = name;
  if (name === "empty") {
    S.topics = [];
    S.total = 0;
  }
  if (name === "followed") S.detail.followed = true;
  if (name === "follow-busy") S.busy = "follow";
  if (name === "follow-failed" || name === "refresh-failed") {
    S.fail = true;
    S.bad = true;
    S.message = "隔离失败响应：操作未完成，请核对后重试。";
  }
  if (name === "refresh-busy") S.busy = "refresh";
  if (name === "refresh-started") S.message = "已受理 2 个来源刷新；采集尚未完成。";
  if (name.startsWith("rules") || name.startsWith("rule-")) S.mode = "rules";
  if (name === "rules-empty") S.rules = [];
  if (name === "rules-paused") S.rules[0].status = "paused";
  if (name === "rules-failed-sources")
    S.rules[0].last_failed_sources = ["Example News（隔离失败来源）"];
  if (name === "rules-error") S.state = "error";
  if (["rule-open", "rule-edited", "rule-busy", "rule-failed", "rule-duplicate"].includes(name)) {
    S.modal = "rule";
    if (name !== "rule-open") S.ruleForm = clone(T.ruleEdited);
  }
  if (name === "rule-busy") S.busy = "rule";
  if (name === "rule-failed") {
    S.fail = true;
    S.modalError = "隔离失败响应：请稍后重新提交。";
  }
  if (name === "rule-duplicate") {
    S.ruleForm.include_keywords = "BEAUTY,beauty";
    S.modalError = T.duplicate.actionHint;
  }
  if (name === "rule-saved") S.message = "监控规则已启用；仅形成候选，不代表建议采纳。";
  if (name.startsWith("anomaly-") && !["anomaly-existing", "anomaly-created"].includes(name)) {
    S.modal = "anomaly";
    if (name !== "anomaly-open") {
      S.reason = "隔离复核原因：证据标题与主题不一致。";
      S.severity = "critical";
    }
  }
  if (name === "anomaly-busy") S.busy = "anomaly";
  if (name === "anomaly-failed") {
    S.fail = true;
    S.modalError = "稍后重新提交异常报告。";
  }
  if (name === "anomaly-existing" || name === "anomaly-created") {
    S.issueIds[S.evidenceId] = "00000000-0000-4000-8000-000000000412";
    S.message =
      name === "anomaly-existing"
        ? "该证据已有未关闭质量工单，沿用返回工单。"
        : "质量工单创建成功（隔离响应）。";
  }
  if (
    [
      "irrelevant-open",
      "irrelevant-busy",
      "irrelevant-failed",
      "restore-open",
      "restore-failed",
    ].includes(name)
  ) {
    S.modal = name.startsWith("restore") ? "restore" : "irrelevant";
    if (S.modal === "restore") S.detail.status = "irrelevant";
    if (!name.endsWith("open")) S.reason = "隔离变更原因：已核对原始证据。";
    if (name.endsWith("failed")) {
      S.fail = true;
      S.modalError = "相关性变更失败；保留本次原因。";
    }
    if (name.endsWith("busy")) S.busy = "relevance";
  }
  if (
    name.startsWith("governance") ||
    name.startsWith("merge") ||
    name.startsWith("split") ||
    name.startsWith("proposal") ||
    name.startsWith("confirm") ||
    name.startsWith("reject") ||
    name === "self-decision-failed"
  )
    S.mode = "governance";
  if (name === "governance-empty") S.requests = [];
  if (name === "governance-error") S.state = "error";
  if (
    [
      "merge-edited",
      "split-edited",
      "proposal-busy",
      "proposal-failed",
      "proposal-queued",
    ].includes(name)
  ) {
    S.proposal = {
      operation: name === "merge-edited" ? "merge" : "split",
      sourceIds: name === "merge-edited" ? [T.secondary.id] : [],
      signalIds: [T.detail.evidence[0].id],
      newTitle: "单独观察",
      newCategory: "",
      reason: "证据需要单独核对",
    };
  }
  if (name === "proposal-busy") S.busy = "proposal";
  if (name === "proposal-failed") {
    S.fail = true;
    S.bad = true;
    S.message = "提议提交失败，尚未进入确认队列。";
  }
  if (name === "proposal-queued") S.message = "提议已进入确认队列，尚未执行治理。";
  if (
    [
      "confirm-open",
      "confirm-failed",
      "reject-open",
      "reject-failed",
      "self-decision-failed",
    ].includes(name)
  ) {
    S.decision = {
      requestId: T.request.id,
      action: name.startsWith("reject") ? "reject" : "confirm",
      reason: name.endsWith("failed") ? "隔离决定说明" : "",
    };
    if (name.endsWith("failed")) {
      S.fail = true;
      S.bad = true;
      S.message = "确认失败，请刷新队列版本后重试。";
    }
    if (name === "self-decision-failed") {
      S.selfDecision = true;
      S.message = "提议人与确认人必须是两个不同的活动用户。";
    }
  }
  if (name === "confirmed" || name === "rejected") {
    S.requests[0].status = name;
    S.requests[0].decision_reason = "隔离处理说明；不证明真实信号已迁移。";
  }
  S.url = serialize();
  document.querySelector("#scene").value = name;
  render();
  if (S.modal) modal.querySelector("button")?.focus();
  window.scrollTo(0, 0);
}
document.querySelector("#scene").innerHTML = scenes
  .map((name) => `<option>${name}</option>`)
  .join("");
document.querySelector("#scene").addEventListener("change", (e) => showScene(e.target.value));
window.TREND_C_REVIEW = { scenes, showScene };
window.TREND_C_DIAGNOSTICS = () => clone(S);
showScene("topics");
