/* Isolated review harness. No HTTP, business writes, persistent state or actual routing. */
const D = window.HOME_C_DATA;
const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const scenes = [
  "running",
  "attention",
  "runtime-open",
  "truth-open",
  "long-items",
  "candidates",
  "collecting",
  "quiet",
  "no-score",
  "unknown-selection",
  "rules-failed",
  "rules-loading",
  "not-configured",
  "setup-closed",
  "setup-edited",
  "setup-invalid",
  "setup-busy",
  "setup-failed",
  "setup-saved",
  "setup-saved-read-failed",
  "paused",
  "resume-busy",
  "resume-failed",
  "resumed",
  "readonly",
  "readonly-paused",
  "loading",
  "error",
  "expired",
  "forbidden",
  "rate-limited",
  "blocked",
];
let summary,
  rules,
  form,
  canManage,
  readState,
  ruleState,
  open,
  busy,
  message,
  bad,
  invalid,
  runtimeOpen,
  truthOpen,
  outcome,
  lastIntent,
  lastRoute,
  generation = 0;
const rulesPath = "/trends/monitoring-rules";
const keywordList = (v) =>
  v
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
function payload() {
  const included = keywordList(form.include_keywords);
  return {
    name: form.name.trim() || `自动选品 · ${included[0]}`,
    include_keywords: included,
    negative_keywords: keywordList(form.negative_keywords),
    market: form.market,
    language: { JP: "ja-JP", KR: "ko-KR", DE: "de-DE", FR: "fr-FR" }[form.market] || "en-US",
    category: form.category.trim() || null,
    notification_channel: "in_app",
    collection_interval_minutes: form.collection_interval_minutes,
    recommendation_min_source_count: form.recommendation_min_source_count,
  };
}
const link = (href, text, attrs = "") => `<a href="${esc(href)}" ${attrs}>${text}</a>`;
const date = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "未设置");
const selection = () => summary.automatic_selection;
function fields() {
  const labels = {
    include_keywords: "想找的商品关键词",
    market: "目标市场",
    collection_interval_minutes: "采集频率",
    recommendation_min_source_count: "形成候选的来源门槛",
    negative_keywords: "排除词（可选）",
    category: "商品分类（可选）",
    name: "规则名称（可选）",
  };
  return Object.entries(labels)
    .map(([name, label]) => {
      const select = D.options[name],
        max = { include_keywords: 500, negative_keywords: 500, category: 80, name: 120 }[name];
      const error = name === "include_keywords" && invalid;
      const attrs = `id="${name}" name="${name}" ${busy ? "disabled" : ""}`;
      const field = select
        ? `<select ${attrs}>${select.map((item) => `<option value="${item.value}" ${form[name] === item.value ? "selected" : ""}>${item.label}</option>`).join("")}</select>`
        : `<input ${attrs} value="${esc(form[name])}" maxlength="${max}" ${name === "include_keywords" ? 'required aria-describedby="keyword-help keyword-error"' : ""} ${error ? 'aria-invalid="true"' : ""} />`;
      return `<label class="${name === "include_keywords" ? "wide" : ""}" for="${name}"><span>${label}</span>${field}${name === "include_keywords" ? `<small id="keyword-help">支持英文逗号、中文逗号或换行；保留原有关键词顺序。</small><span id="keyword-error" class="field-error" ${error ? 'role="alert"' : "hidden"}>至少填写一个希望持续寻找的商品关键词。</span>` : name === "name" ? "<small>留空按首个关键词命名。</small>" : ""}</label>`;
    })
    .join("");
}
function setup() {
  const s = selection();
  if (!s) return "";
  if (ruleState !== "ready")
    return `<section class="unknown" aria-live="polite" aria-busy="${ruleState === "loading"}"><p>${ruleState === "loading" ? "正在核对自动选品规则…" : "规则读取失败，暂时无法判断是否已有规则或需要恢复。"}</p>${ruleState === "error" ? "<button data-reload>重新读取</button>" : ""}<small>待审保护：不将未知规则当作首次使用，不开放创建或恢复。</small></section>`;
  const paused = rules.filter((item) => item.status === "paused");
  const callout =
    s.state === "not_configured"
      ? `<section class="surface callout"><div><b>${paused.length ? "自动选品当前已暂停" : "先告诉系统要找什么"}</b><p>${paused.length ? "恢复已有规则后继续采集；来源门槛形成候选，五项质量门通过后才推荐。" : "设置市场、关键词和来源门槛，让系统持续发现候选。"}</p></div>${canManage ? (paused.length ? `<button data-resume ${busy ? "disabled" : ""}>${busy ? "正在恢复…" : "恢复自动选品"}</button>` : `<button data-toggle ${busy ? "disabled" : ""} aria-expanded="${open}" aria-controls="rule-form">${open ? "收起设置" : "开始设置"}</button>`) : link("/trends?section=rules", "查看规则 →")}</section>`
      : "";
  return `${callout}${open && canManage ? `<form id="rule-form" class="surface"><header><div><span class="section-number">SETUP / 首次设置</span><h3>创建自动选品规则</h3></div></header><div class="rule-fields">${fields()}</div><div class="form-actions"><button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "正在启用…" : "保存并开始自动选品"}</button></div></form>` : ""}`;
}
function queue() {
  const s = selection();
  if (!s)
    return `<section class="surface unknown" id="unknown-selection"><h3>自动选品状态暂不可用</h3><p>本次响应缺少自动选品信息，不能据此判断推荐为空、规则未配置或计数为零。</p><button data-reload>重新读取</button></section>`;
  const items = s.recommended_items;
  return `<section id="decisions" class="surface"><header><div><span class="section-number">01 / 人工决策</span><h3>推荐清单</h3></div>${link("/opportunities", `全部 ${s.recommended_count} 条 →`)}</header>${items.map((item) => link(item.route, `<div><strong>${esc(item.title)}</strong><small>${esc(item.reason)}</small></div>${item.value_score !== null ? `<span class="score">${Number.isInteger(item.value_score) ? item.value_score : item.value_score.toFixed(1)} <small>分</small></span>` : ""}<em>查看 →</em>`, 'class="queue-link"')).join("")}${!items.length ? `<div class="quiet-empty"><b>当前没有待人工采纳的推荐</b><p>${s.rule_candidate_count ? `${s.rule_candidate_count} 条规则命中候选正在完成五项质量门校验。` : s.awaiting_evidence_count ? `${s.awaiting_evidence_count} 条商品仍在采集。` : "系统会在五项质量门全部通过后自动加入这里。"}</p>${s.rule_candidate_count ? link("/opportunities?view=rule_candidates", "查看候选进度") : s.awaiting_evidence_count ? link("/opportunities?view=evidence_pending", "查看采集进度") : ""}</div>` : ""}</section>`;
}
function work() {
  const items = [
    ...summary.actions.filter((item) => item.source_module !== "opportunity"),
    ...summary.health,
  ];
  return items.length
    ? `<section id="work" class="surface"><header><div><span class="section-number">02 / 本人事项</span><h3>其他待办与异常</h3></div></header>${items.map((item) => link(item.route, `<span class="priority">${esc(D.priorities[item.priority ?? "normal"])}</span><span><b>${esc(item.title)}</b><small>${esc(item.reason)}</small></span><span aria-hidden="true">→</span>`, `class="work-link" data-severity="${item.severity}"`)).join("")}</section>`
    : "";
}
function automation() {
  const s = selection();
  if (!s) return "";
  const facts = [
    ["recommended_count", "待你采纳", "/opportunities?view=recommended"],
    ["rule_candidate_count", "规则命中候选", "/opportunities?view=rule_candidates"],
    ["awaiting_evidence_count", "采集中", "/opportunities?view=evidence_pending"],
    ["enabled_rule_count", "运行规则", "/trends?section=rules"],
  ];
  return `<section class="surface" id="automation"><header><div><span class="section-number">03 / 自动发现</span><h3>选品运行进度</h3></div></header><div class="facts">${facts.map(([key, label, href]) => link(href, `<strong>${s[key]}</strong><span>${label}</span>`)).join("")}</div><details id="runtime" ${runtimeOpen ? "open" : ""}><summary>运行详情 · 采集进度与时间</summary><h4>系统正在做什么</h4><ol class="pipeline"><li><b>监控平台</b><span>${s.enabled_rule_count} 条规则运行中</span></li><li><b>筛出候选</b><span>已发现 ${s.candidate_count} 条</span></li><li><b>质量门校验</b><span>${s.rule_candidate_count} 条候选正在完成五项校验</span></li><li><b>人工采纳</b><span>已确认 ${s.adopted_count} 条</span></li></ol><dl class="dates"><div><dt>上次采集</dt><dd>${date(s.last_collection_at)}</dd></div><div><dt>下次采集</dt><dd>${date(s.next_collection_at)}</dd></div><div><dt>规则候选</dt><dd>${s.candidate_count} 条</dd></div><div><dt>人工已采纳</dt><dd>${s.adopted_count} 条</dd></div></dl></details></section>`;
}
function statePanel() {
  const copy = {
    loading: ["正在读取首页", "等待本次工作范围的首页数据。"],
    error: ["首页读取失败", "请求未完成，请重新读取；此处不展示旧计数。"],
    expired: ["登录已过期", "请重新登录后查看当前工作范围。"],
    forbidden: ["无权读取当前首页", "当前请求没有通过权限检查；选择范围不会自动授予权限。"],
    "rate-limited": ["请求过于频繁", "请稍后重新读取，不会自动重放创建或恢复。"],
    blocked: ["依赖暂时受阻", "暂时无法读取首页，请稍后重试。"],
  }[readState];
  return `<section class="surface state-panel" aria-live="polite" aria-busy="${readState === "loading"}"><h3>${copy[0]}</h3><p>${copy[1]}</p>${readState !== "loading" ? `<nav><button data-reload>重新读取</button>${readState === "expired" ? link("/login", "重新登录") : readState === "forbidden" ? link("/select-context", "选择组织与工作区") : ""}</nav><details><summary>关联编号</summary><p>request_id: home-c-${readState}<br />trace_id: home-c-review</p></details>` : ""}</section>`;
}
function render() {
  const s = selection();
  document.querySelector("#content").innerHTML =
    `<header class="command"><div><span class="state-label" data-state="${s?.state || "unknown"}">${readState !== "ready" ? "首页尚未读取" : !s ? "自动选品状态未知" : { running: "自动选品运行中", attention: "自动选品需检查", not_configured: "自动选品未配置" }[s.state]}</span><h2>选品控制台</h2><p>系统发现与补证，你负责最终采纳。</p></div>${readState === "ready" ? `<nav aria-label="首页操作">${link("/trends?section=rules", "管理规则")}${link("/opportunities", "查看推荐清单")}${link("/opportunities/start", "创建选品 →", 'class="primary"')}</nav>` : ""}</header>${message ? `<p id="message" class="${bad ? "error" : "notice"}" role="status">${esc(message)}</p>` : ""}${readState === "ready" ? `${setup()}${queue()}${work()}${automation()}<details id="truth" class="truth" ${truthOpen ? "open" : ""}><summary>数据说明</summary><div><span>共 ${summary.actions.length + summary.changes.length + summary.follows.length + summary.health.length} 条可见投影</span><span>生成时间 ${date(summary.generated_at)}</span><span>自动推荐不等于自动采纳</span><small>当前 changes / follows 仅计入总数，不冒充已有逐项入口。</small></div></details>` : statePanel()}`;
  document.querySelector("#rule-form")?.addEventListener("submit", create);
  document.querySelector("[data-toggle]")?.addEventListener("click", () => {
    if (!busy) {
      open = !open;
      render();
      document.querySelector("[data-toggle]")?.focus();
    }
  });
  document.querySelector("[data-resume]")?.addEventListener("click", resume);
  document
    .querySelectorAll("[data-reload]")
    .forEach((node) => node.addEventListener("click", reload));
  document.querySelectorAll("#rule-form input,#rule-form select").forEach((node) =>
    node.addEventListener("input", () => {
      form[node.name] = ["collection_interval_minutes", "recommendation_min_source_count"].includes(
        node.name,
      )
        ? Number(node.value)
        : node.value;
    }),
  );
  document.querySelector("#runtime")?.addEventListener("toggle", (event) => {
    runtimeOpen = event.target.open;
  });
  document.querySelector("#truth")?.addEventListener("toggle", (event) => {
    truthOpen = event.target.open;
  });
}
function delayed(done) {
  const mine = generation;
  setTimeout(() => {
    if (mine !== generation) return;
    done();
    busy = false;
    render();
  }, 450);
}
function createdSummary() {
  const result = clone(D.summary);
  result.automatic_selection = { ...clone(D.zero), state: "attention", enabled_rule_count: 1 };
  return result;
}
function create(event) {
  event.preventDefault();
  if (busy || !canManage || ruleState !== "ready" || !selection()) return;
  if (!keywordList(form.include_keywords).length) {
    invalid = true;
    render();
    document.querySelector("#include_keywords").focus();
    return;
  }
  lastIntent = { path: rulesPath, method: "POST", body: payload() };
  busy = true;
  invalid = false;
  message = "";
  render();
  delayed(() => {
    if (outcome === "failed") {
      bad = true;
      message = "隔离失败响应：暂时无法保存，请稍后重试。";
      return;
    }
    open = false;
    bad = false;
    message = "规则创建请求已成功；采集状态以重新读取结果为准。";
    if (outcome === "read-failed") {
      readState = "error";
    } else {
      summary = createdSummary();
      rules = [{ ...lastIntent.body, id: "sample-created-rule", status: "enabled", version: 1 }];
    }
  });
}
function resume() {
  if (busy || !canManage || ruleState !== "ready") return;
  const item = rules.find((r) => r.status === "paused");
  if (!item) return;
  lastIntent = {
    path: `${rulesPath}/${item.id}`,
    method: "PATCH",
    body: {
      status: "enabled",
      expected_version: item.version,
      collection_interval_minutes: item.collection_interval_minutes,
      recommendation_min_source_count: item.recommendation_min_source_count,
    },
  };
  busy = true;
  message = "";
  render();
  delayed(() => {
    bad = outcome === "failed";
    if (bad) {
      message = "隔离失败响应：请刷新规则版本后重试。";
      return;
    }
    item.status = "enabled";
    item.version++;
    summary = createdSummary();
    message = `“${item.name}”恢复请求已成功；其余暂停规则未恢复。`;
  });
}
function reload() {
  if (busy) return;
  lastIntent = { method: "GET", paths: ["/me/home-dashboard", rulesPath] };
  readState = "loading";
  render();
  delayed(() => {
    summary = clone(D.summary);
    rules = [];
    ruleState = "ready";
    readState = "ready";
    open = false;
  });
}
function showScene(name) {
  if (!scenes.includes(name)) throw new Error("Unknown home scene");
  generation++;
  summary = clone(D.summary);
  rules = [];
  form = clone(D.form);
  canManage = true;
  readState = "ready";
  ruleState = "ready";
  open = false;
  busy = false;
  message = "";
  bad = false;
  invalid = false;
  runtimeOpen = false;
  truthOpen = false;
  outcome = "success";
  lastIntent = null;
  lastRoute = "";
  if (["attention", "resumed"].includes(name)) {
    summary.automatic_selection.state = "attention";
    summary.automatic_selection.next_collection_at = null;
  }
  if (name === "runtime-open") runtimeOpen = true;
  if (name === "truth-open") truthOpen = true;
  if (name === "long-items") {
    summary.automatic_selection.recommended_items[0].reason =
      "长文本隔离样例：请先进入机会详情核对商品证据、评分依据、成本和风险，再由你作出最终判断。".repeat(
        4,
      );
    summary.health[0].reason =
      "长异常原因：任务暂停，需要进入完整处理上下文确认来源状态与下一步。".repeat(4);
  }
  if (["candidates", "collecting", "quiet"].includes(name)) {
    summary.automatic_selection.recommended_items = [];
    summary.automatic_selection.recommended_count = 0;
    if (name !== "candidates") summary.automatic_selection.rule_candidate_count = 0;
    if (name === "quiet") {
      summary.automatic_selection = {
        ...clone(D.zero),
        state: "running",
        enabled_rule_count: 1,
        next_collection_at: D.summary.automatic_selection.next_collection_at,
      };
      summary.actions = [];
      summary.health = [];
      summary.changes = [];
      summary.follows = [];
    }
  }
  if (name === "no-score") summary.automatic_selection.recommended_items[0].value_score = null;
  if (name === "unknown-selection") delete summary.automatic_selection;
  if (["rules-failed", "rules-loading"].includes(name)) {
    summary.automatic_selection = clone(D.zero);
    ruleState = name === "rules-failed" ? "error" : "loading";
  }
  if (
    name.startsWith("setup-") ||
    [
      "not-configured",
      "paused",
      "resume-busy",
      "resume-failed",
      "readonly",
      "readonly-paused",
    ].includes(name)
  ) {
    summary.automatic_selection = clone(D.zero);
    summary.actions = [];
    summary.health = [];
    summary.changes = [];
    summary.follows = [];
    open = true;
  }
  if (name === "setup-closed") open = false;
  if (
    [
      "setup-edited",
      "setup-busy",
      "setup-failed",
      "setup-saved",
      "setup-saved-read-failed",
    ].includes(name)
  )
    form = clone(D.edited);
  if (name === "setup-invalid") {
    form.include_keywords = " ，, ";
    invalid = true;
  }
  if (name === "setup-busy") busy = true;
  if (name === "setup-failed") {
    outcome = "failed";
    bad = true;
    message = "隔离失败响应：暂时无法保存，请稍后重试。";
  }
  if (name === "setup-saved") {
    open = false;
    summary = createdSummary();
    message = "规则创建请求已成功；采集状态以重新读取结果为准。";
  }
  if (name === "setup-saved-read-failed") {
    open = false;
    readState = "error";
    outcome = "read-failed";
    message = "规则创建请求已成功，但首页重新读取失败。不要重复创建，请先重新读取。";
  }
  if (["paused", "resume-busy", "resume-failed", "readonly-paused"].includes(name)) {
    open = false;
    rules = clone(D.paused);
  }
  if (name === "resume-busy") busy = true;
  if (name === "resume-failed") {
    outcome = "failed";
    bad = true;
    message = "隔离失败响应：请刷新规则版本后重试。";
  }
  if (name === "resumed") {
    rules = clone(D.paused);
    rules[0].status = "enabled";
    message = "“隔离暂停规则 1”恢复请求已成功；其余暂停规则未恢复。";
  }
  if (name.startsWith("readonly")) {
    canManage = false;
    open = false;
  }
  if (["loading", "error", "expired", "forbidden", "rate-limited", "blocked"].includes(name))
    readState = name;
  document.querySelector("#scene").value = name;
  render();
  window.scrollTo(0, 0);
}
document.querySelector("#scene").innerHTML = scenes
  .map((name) => `<option>${name}</option>`)
  .join("");
document
  .querySelector("#scene")
  .addEventListener("change", (event) => showScene(event.target.value));
document.addEventListener("click", (event) => {
  const node = event.target.closest("a");
  if (!node) return;
  event.preventDefault();
  lastRoute = node.getAttribute("href");
});
window.HOME_C_REVIEW = { scenes, showScene };
window.HOME_C_DIAGNOSTICS = () =>
  clone({
    lastIntent,
    lastRoute,
    form,
    rules,
    busy,
    open,
    canManage,
    readState,
    ruleState,
    message,
  });
showScene("running");
