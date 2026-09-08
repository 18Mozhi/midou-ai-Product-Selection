(() => {
  const D = window.REVIEW_C_DATA,
    copy = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const labels = {
    succeeded: "已完成",
    queued: "已排队",
    leased: "已领取",
    retry_scheduled: "等待重试",
    failed_terminal: "处理已终止",
    dead_letter: "进入死信",
    pending: "待抽检",
    approved: "抽检通过",
    rejected: "抽检驳回",
    none: "未发现失败影响",
    degraded: "部分环节降级",
    blocked: "存在阻断影响",
    adopted: "已采纳",
    observing: "观察中",
    todo: "待处理",
    calculated: "已计算",
    active: "有效",
    enabled: "已启用",
    warning: "警告",
    open: "未处理",
    completed_with_warnings: "完成但有警告",
  };
  const kinds = {
    source: "来源健康",
    collection_task: "采集任务",
    collection_attempt: "执行尝试",
    evidence: "原始证据",
    quality_issue: "质量问题",
    trend: "趋势",
    opportunity: "机会",
    score: "评分",
    profit: "利润",
    task: "任务",
    notification: "通知",
  };
  const label = (v) => labels[v] || v || "未提供";
  const time = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "未记录";
  const sections = {
    ai: "AI 结果审阅",
    lineage: "业务血缘",
    feedback: "经营复盘记录",
    form: "录入复盘事实",
  };
  const scenes = {
    ai: "AI / 待抽检结果",
    "ai-details": "AI / 输入与出处展开",
    "ai-empty": "AI / 真实空记录",
    "ai-loading": "AI / 正在读取",
    "ai-error": "AI / 首次读取失败",
    "ai-stale-error": "AI / 失败保留旧记录",
    "ai-malformed": "AI / 非数组响应",
    "ai-readonly": "AI / 只读",
    "ai-queued": "AI / 已排队无输出",
    "ai-leased": "AI / 已领取无输出",
    "ai-retry": "AI / 等待重试",
    "ai-terminal": "AI / 处理终止",
    "ai-dead-letter": "AI / 死信",
    "ai-approved": "AI / 已通过",
    "ai-rejected": "AI / 已驳回",
    "ai-multiple": "AI / 新旧记录分开",
    "ai-queue-busy": "生成分析 / 提交中",
    "ai-queue-success": "生成分析 / 已接受",
    "ai-queue-failed": "生成分析 / 明确拒绝",
    "ai-reload-error": "生成分析 / 接受后重读失败",
    "approved-empty": "通过抽检 / 空原因",
    "approved-filled": "通过抽检 / 已填写",
    "approved-busy": "通过抽检 / 提交中",
    "approved-failed": "通过抽检 / 失败保留",
    "rejected-empty": "驳回抽检 / 空原因",
    "rejected-filled": "驳回抽检 / 已填写",
    "rejected-busy": "驳回抽检 / 提交中",
    "rejected-failed": "驳回抽检 / 失败保留",
    "review-unknown": "抽检 / 结果待核对",
    lineage: "血缘 / 返回节点",
    "lineage-details": "血缘 / 技术标识与错误",
    "lineage-empty": "血缘 / 无节点",
    "lineage-age-unknown": "血缘 / 距今时间未提供",
    "lineage-no-correlation": "血缘 / 关联标识缺失",
    "lineage-degraded": "血缘 / 降级",
    "lineage-none": "血缘 / 未发现失败影响",
    feedback: "复盘 / 事实与可比基线",
    "feedback-details": "复盘 / 完整历史快照",
    "feedback-empty": "复盘 / 尚无事实",
    "feedback-incomparable": "复盘 / 无可比基线",
    "feedback-zero": "复盘 / 零与无法计算",
    "feedback-loss": "复盘 / 实际亏损",
    "feedback-readonly": "复盘 / 只读",
    form: "录入 / 11字段默认值",
    "form-filled": "录入 / 已填事实",
    "form-busy": "录入 / 提交中",
    "form-failed": "录入 / 明确失败保留",
    "form-period": "录入 / 周期错误",
    "form-returns": "录入 / 退货量错误",
    "form-success": "录入 / 成功追加独立记录",
    "form-unknown": "录入 / 写入结果待核对",
  };
  const fields = [
    ["period_start", "周期开始", "date", "", "period"],
    ["period_end", "周期结束", "date", "", "period"],
    ["sales_units", "实际销量", "number", 'min="0" max="1000000000" step="1"', "sales"],
    [
      "revenue_amount",
      "实际销售额",
      "number",
      'min="0" max="1000000000000" step="0.000001"',
      "sales",
    ],
    [
      "ad_spend_amount",
      "实际广告花费",
      "number",
      'min="0" max="1000000000000" step="0.000001"',
      "sales",
    ],
    ["returned_units", "实际退货量", "number", 'min="0" max="1000000000" step="1"', "sales"],
    [
      "purchase_lead_time_days",
      "实际采购交期（天）",
      "number",
      'min="0" max="3650" step="1"',
      "cost",
    ],
    [
      "actual_profit_amount",
      "实际利润",
      "number",
      'min="-1000000000000" max="1000000000000" step="0.000001"',
      "cost",
    ],
    ["currency", "币种", "text", 'maxlength="3" pattern="[A-Za-z]{3}"', "cost"],
    ["source_ref", "事实来源", "text", 'maxlength="255"', "source"],
    ["notes", "复盘说明（选填）", "textarea", 'maxlength="1000"', "source"],
  ];
  let S,
    generation = 0;
  const current = () => S.analyses[S.selected];
  const locked = () => S.busy || ["unknown", "reload-error"].includes(S.outcome);
  function initial() {
    return {
      section: "ai",
      analyses: copy(D.facts.analyses),
      selected: 0,
      lineage: copy(D.lineage),
      feedback: copy(D.feedbackVersions.history),
      form: copy(D.defaults),
      canWrite: true,
      readState: "ready",
      stale: false,
      details: false,
      busy: false,
      operation: "",
      outcome: "",
      message: "",
      formError: "",
      review: null,
      intents: [],
      reads: 0,
      navigation: "",
      failNext: false,
      demoFeedbackSaved: false,
    };
  }
  function scene(name) {
    generation++;
    closeDialog(false);
    S = initial();
    S.name = name;
    if (name.startsWith("lineage")) S.section = "lineage";
    if (name.startsWith("feedback")) S.section = "feedback";
    if (name.startsWith("form")) {
      S.section = "form";
      if (name !== "form") S.form = copy(D.feedbackForm);
    }
    if (name.endsWith("details")) S.details = true;
    if (name.endsWith("readonly")) S.canWrite = false;
    if (name === "ai-empty") S.analyses = [];
    if (name === "ai-loading") {
      S.readState = "loading";
      S.analyses = [];
    }
    if (["ai-error", "ai-malformed", "ai-stale-error"].includes(name)) {
      S.readState = "error";
      S.stale = name === "ai-stale-error";
      if (!S.stale) S.analyses = [];
    }
    for (const [suffix, status] of Object.entries({
      queued: "queued",
      leased: "leased",
      retry: "retry_scheduled",
      terminal: "failed_terminal",
      "dead-letter": "dead_letter",
    }))
      if (name === `ai-${suffix}`)
        Object.assign(S.analyses[0], {
          status,
          result: null,
          last_error_code: ["queued", "leased"].includes(status) ? null : "ai_provider_timeout",
        });
    for (const outcome of ["approved", "rejected"]) {
      if (name === `ai-${outcome}`)
        Object.assign(current().result, {
          review_status: outcome,
          review: {
            outcome,
            notes: D.reason.trim(),
            reviewed_by: "isolated-reviewer",
            reviewed_at: D.fixedNow,
          },
        });
      if (name.startsWith(`${outcome}-`)) {
        S.review = {
          outcome,
          resultId: current().result.id,
          reason: name.endsWith("empty") ? "" : D.reason,
          error: name.endsWith("failed")
            ? "明确拒绝：本次模拟未被接受，原因保留，可显式重试。"
            : "",
        };
        S.busy = name.endsWith("busy");
        S.operation = "review";
      }
    }
    if (name === "review-unknown") {
      S.outcome = "unknown";
      S.operation = "review";
      S.review = {
        outcome: "approved",
        resultId: current().result.id,
        reason: D.reason,
        error: "结果尚未确认，不能断言未写入；请核对最新抽检记录。",
      };
    }
    if (name === "ai-multiple")
      S.analyses.unshift({
        ...copy(S.analyses[0]),
        id: "isolated-new-request",
        status: "queued",
        result: null,
      });
    if (name.startsWith("ai-queue-") || name === "ai-reload-error") {
      S.operation = "queue";
      S.busy = name.endsWith("busy");
      S.outcome = name.endsWith("success")
        ? "queued"
        : name.endsWith("failed")
          ? "failed"
          : name.endsWith("error")
            ? "reload-error"
            : "";
    }
    if (name === "lineage-empty")
      S.lineage = {
        freshness: { observed_at: null, age_seconds: null },
        failure_impact: { level: "none", codes: [], affected_stages: [] },
        nodes: [],
        request_ids: [],
        trace_ids: [],
      };
    if (name === "lineage-age-unknown") S.lineage.freshness.age_seconds = null;
    if (name === "lineage-no-correlation") {
      S.lineage.nodes.forEach((v) => {
        v.request_id = null;
        v.trace_id = null;
      });
      S.lineage.request_ids = [];
      S.lineage.trace_ids = [];
      S.details = true;
    }
    if (name === "lineage-degraded") {
      S.lineage.nodes = S.lineage.nodes.filter((v) => v.kind === "collection_task");
      S.lineage.failure_impact = {
        level: "degraded",
        codes: [S.lineage.nodes[0].status],
        affected_stages: ["collection_task"],
      };
      S.lineage.freshness = { observed_at: null, age_seconds: null };
    }
    if (name === "lineage-none") {
      S.lineage.nodes = S.lineage.nodes.filter((v) => v.kind === "opportunity");
      S.lineage.failure_impact = { level: "none", codes: [], affected_stages: [] };
      S.lineage.freshness = { observed_at: null, age_seconds: null };
    }
    if (["lineage-none", "lineage-degraded"].includes(name)) {
      S.lineage.request_ids = [
        ...new Set(S.lineage.nodes.map((v) => v.request_id).filter(Boolean)),
      ];
      S.lineage.trace_ids = [...new Set(S.lineage.nodes.map((v) => v.trace_id).filter(Boolean))];
    }
    if (name === "feedback-empty") S.feedback = { facts: [], calibration: null };
    for (const key of ["incomparable", "zero", "loss"])
      if (name === `feedback-${key}`) S.feedback = copy(D.feedbackVersions[key]);
    if (name === "form-period") S.form.period_end = "2026-07-31";
    if (name === "form-returns") S.form.returned_units = 101;
    if (name === "form-busy") {
      S.busy = true;
      S.operation = "feedback";
    }
    if (name === "form-failed") {
      S.outcome = "failed";
      S.operation = "feedback";
    }
    if (name === "form-unknown") {
      S.outcome = "unknown";
      S.operation = "feedback";
    }
    if (name === "form-success") {
      S.section = "feedback";
      S.feedback = copy(D.feedbackSubmission);
      S.demoFeedbackSaved = true;
      S.outcome = "saved";
      S.operation = "feedback";
      S.form.source_ref = "";
      S.form.notes = "";
    }
    if (name === "form-period") S.formError = "period_end";
    if (name === "form-returns") S.formError = "returned_units";
    render();
    document.querySelector("#scene").value = name;
    if (S.review) openDialog();
  }
  const btn = (id, text, primary = false) =>
    `<button id="${id}" ${locked() ? "disabled" : ""} class="${primary ? "primary" : ""}">${text}</button>`;
  function notice() {
    if (S.busy)
      return '<div class="banner" role="status"><strong>正在提交</strong>请等待响应。关闭弹窗不取消服务端处理。</div>';
    if (!S.outcome) return "";
    const messages = {
        queued: [
          "AI 分析请求已排队",
          "当前显示重读得到的隔离旧记录，不代表新分析已经生成；事实、评分和决定未变。",
        ],
        saved: [
          "经营复盘事实已写入（模拟）",
          "只替换响应中的复盘记录与校准快照；来源和说明已清空，其他输入保留。规则、评分与决定未自动变更。",
        ],
        reviewed: ["人工抽检已记录（模拟）", "抽检结论独立保存；AI 原始输出保持不变。"],
        failed: [
          "请求被明确拒绝",
          "隔离失败场景；保留当前输入，可显式重试。这里不代替真实接口错误。",
        ],
        unknown: [
          "结果待核对",
          "尚未收到可确认结果，暂不重复提交。请核对相应记录，不以超时断言没有写入。",
        ],
        "reload-error": [
          "请求已接受，后续读取失败",
          "接受成功事实保留；这里只重试读取，不重复写入。",
        ],
        "intent-only": [
          "已记录这组输入的请求意图",
          "没有匹配的预置返回样例；未伪造保存成功或计算结果，历史事实保持不变。",
        ],
      },
      n = messages[S.outcome];
    return `<div class="banner ${["failed", "unknown", "reload-error"].includes(S.outcome) ? "warning" : ""}" role="status"><strong>${n[0]}</strong><p>${n[1]}</p>${S.outcome === "reload-error" ? '<div class="actions"><button id="retry-load">重试读取机会</button></div>' : ""}${S.review && !document.querySelector("#review-dialog").open ? '<div class="actions"><button id="restore-review">查看保留的抽检原因</button></div>' : ""}</div>`;
  }
  function ai() {
    const item = current();
    return `<div class="banner"><strong>AI 生成内容，仅用于辅助理解</strong>摘要、分类和缺失提示不替代原始事实、评分、利润、风险结论或人工决定。</div><div class="operation-footer">${S.canWrite ? btn("queue-ai", S.busy && S.operation === "queue" ? "正在提交…" : "生成新分析", true) : '<p class="access">只读身份，不能生成或抽检。</p>'}</div>${S.readState === "loading" ? '<p class="empty">正在读取 AI 分析记录，不判定为空。</p>' : ""}${S.readState === "error" ? `<div class="banner danger"><strong>${S.name === "ai-malformed" ? "响应格式异常" : "AI 分析读取失败"}</strong><p>${S.stale ? "下方为上次读取的旧记录，不是本次读取成功。核对前暂停抽检。" : "当前不能判定为尚无分析。"}</p><div class="actions"><button id="retry-ai">重试读取</button></div></div>` : ""}${S.readState === "ready" && !S.analyses.length ? '<div class="empty"><h3>尚无 AI 分析</h3><p>当前机会事实未被修改。</p></div>' : ""}${item ? `<div class="record-layout"><aside class="record-list"><h3>分析记录</h3>${S.analyses.map((v, i) => `<button data-record="${i}" aria-pressed="${i === S.selected}" ${S.busy ? "disabled" : ""}><span>${label(v.status)}</span><small>${time(v.created_at)}</small><small>${v.result ? label(v.result.review_status) : "尚无输出"}</small></button>`).join("")}</aside><article class="ai-result"><div class="row-title"><h3>${label(item.status)}</h3>${item.result ? `<span class="badge">ai_generated · ${label(item.result.review_status)}</span>` : ""}</div>${item.result ? `<p class="ai-summary">${esc(item.result.content.summary)}</p><section class="ai-group"><h3>分类观察</h3>${item.result.content.classifications.length ? item.result.content.classifications.map((v) => `<div class="ai-entry"><b>${esc(v.label)}</b><p>${esc(v.rationale)}</p><div class="refs">引用：${v.source_refs.map(esc).join("、") || "未提供"}</div></div>`).join("") : "<p>本结果没有分类观察。</p>"}</section><section class="ai-group"><h3>缺失提示</h3>${item.result.content.missing_fields.length ? item.result.content.missing_fields.map((v) => `<div class="ai-entry"><b>${esc(v.field)}</b><p>${esc(v.reason)}</p><div class="refs">引用：${v.source_refs.map(esc).join("、") || "未提供"}</div></div>`).join("") : "<p>本结果没有列出缺失提示，不等于事实已经完备。</p>"}</section><div class="operation-footer">${S.canWrite && item.result.review_status === "pending" ? `<button data-review="approved" ${locked() || S.readState !== "ready" ? "disabled" : ""}>抽检通过</button><button data-review="rejected" ${locked() || S.readState !== "ready" ? "disabled" : ""}>抽检驳回</button>` : ""}</div>${item.result.review ? `<div class="read-only-note"><strong>${label(item.result.review.outcome)}</strong><p>${esc(item.result.review.notes)}</p><p class="meta">${esc(item.result.review.reviewed_by)} · ${time(item.result.review.reviewed_at)}</p></div>` : ""}` : `<div class="empty"><h3>${["failed_terminal", "dead_letter"].includes(item.status) ? "本记录不会产生可用结论" : "尚无分析输出"}</h3><p>请求状态：${label(item.status)}；尝试 ${item.attempt_count} 次。</p><p>错误：${esc(item.last_error_code || "未记录错误码")}</p><p>生成新分析会创建新请求，不覆盖本记录。</p></div>`}<details class="trace-detail" ${S.details ? "open" : ""}><summary>输入与技术出处</summary><p>请求记录：${esc(item.id)}</p><p>输入 SHA-256：${esc(item.input_sha256)}</p><p>提示合同：${esc(item.prompt_contract_version)}</p><p>尝试次数：${item.attempt_count}</p>${item.result ? `<p>结果 ID：${esc(item.result.id)}</p><p>模型：${esc(item.result.model_name)}</p><p>提供方请求标识：${esc(item.result.provider_request_id || "未记录")}</p>` : ""}</details></article></div>` : ""}`;
  }
  function lineage() {
    const l = S.lineage;
    return `<div class="banner ${l.failure_impact.level === "blocked" ? "danger" : l.failure_impact.level === "degraded" ? "warning" : ""}"><strong>${label(l.failure_impact.level)}</strong>受影响环节：${l.failure_impact.affected_stages.map((v) => kinds[v] || v).join("、") || "无已报告环节"}</div><dl class="ledger"><div><dt>原始证据观测</dt><dd>${l.freshness.observed_at ? `${time(l.freshness.observed_at)}（中国时间）` : "尚无原始证据观测时间"}</dd></div><div><dt>读取时距今</dt><dd>${l.freshness.age_seconds == null ? "未提供，不能当作 0 秒" : `${l.freshness.age_seconds} 秒（接口快照）`}</dd></div></dl><p class="sheet-note">当前响应 ${l.nodes.length} 个节点。按业务环节分组，不表示每两项都有因果连线；各类查询有限额，缺失节点不补造，不能宣称全历史完整。</p><ol class="node-list">${l.nodes.length ? l.nodes.map((v) => `<li class="node ${/failed_terminal|dead_letter|blocked|open:critical/.test(v.status) ? "blocked" : ""}"><span class="node-kind">${esc(kinds[v.kind] || v.kind)}</span><div><h3>${esc(v.label)}</h3><span>${esc(label(v.status.split(":")[0]))}</span><span class="raw">完整状态：${esc(v.status)}</span><p class="meta">${time(v.occurred_at)}</p><details ${S.details ? "open" : ""}><summary>技术链路</summary><p class="refs">request_id: ${esc(v.request_id ?? "未记录")}</p><p class="refs">trace_id: ${esc(v.trace_id ?? "未记录")}</p><p class="refs">resource_id: ${esc(v.id)}</p></details></div><a href="${esc(v.route)}" aria-label="打开${esc(kinds[v.kind] || v.kind)}节点 ${esc(v.label)}">打开节点</a></li>`).join("") : '<li class="empty"><h3>当前没有可追踪节点</h3><p>无节点不等于所有业务环节成功。</p></li>'}</ol><details class="trace-detail" ${S.details ? "open" : ""}><summary>汇总关联标识与失败码</summary><p>request_ids：${l.request_ids.map(esc).join("、") || "未记录"}</p><p>trace_ids：${l.trace_ids.map(esc).join("、") || "未记录"}</p><p>失败影响代码：${l.failure_impact.codes.map(esc).join("、") || "未报告"}</p></details><p class="notice">节点 URL 原样取自返回值，目标页面继续执行自身授权；本图稿只记录导航意图，不声称普通成员有平台管理权限。</p>`;
  }
  function feedback() {
    const label = (v) => (v === "pending" ? "待决定" : labels[v] || v || "未提供");
    const f = S.feedback,
      c = f.calibration;
    const metric = (v, suffix = "", delta = false) =>
      v == null ? "没有可比基线" : `${delta && v > 0 ? "+" : ""}${v}${suffix}`;
    return `<div class="row-title"><h3>已返回 ${f.facts.length} 条复盘记录</h3>${S.canWrite ? btn("open-form", "录入复盘事实", true) : '<span class="badge">只读</span>'}</div><p class="sheet-note">服务端最多返回 20 条，按周期结束、创建时间与 ID 排序；条数不等于全部周期数，同一周期也不自动合并。</p>${c ? `<div class="calibration"><div><span>实际退货率</span><strong>${metric(c.return_rate_percent, "%")}</strong></div><div><span>广告投入占比</span><strong>${metric(c.ad_spend_ratio_percent, "%")}</strong></div><div><span>利润预测偏差</span><strong>${metric(c.profit_variance_amount, c.profit_variance_currency ? ` ${c.profit_variance_currency}` : "", true)}</strong></div><div><span>采购交期偏差</span><strong>${metric(c.lead_time_variance_days, " 天", true)}</strong></div></div><p class="meta">基线记录 ${esc(c.fact_id)}；评分 ${esc(c.score_rule_version || "无快照")} / 利润 ${esc(c.profit_rule_version || "无快照")} / ${label(c.decision_status_snapshot)}</p>` : '<div class="empty"><h3>尚无经营复盘事实</h3><p>没有校准结果，不填充默认比率。</p></div>'}<div class="banner"><strong>用于人工校准，不自动改规则或决定</strong>同币种才比较利润；零销量/零销售额时相应比率不能计算。以下偏差均来自服务端快照，不在浏览器重算。</div>${f.facts
      .map(
        (v) =>
          `<article class="fact"><h3>${v.period_start} 至 ${v.period_end}</h3><div class="fact-grid">${[
            ["实际销量", v.sales_units],
            ["实际销售额", `${v.revenue_amount} ${v.currency}`],
            ["广告花费", `${v.ad_spend_amount} ${v.currency}`],
            ["退货量", v.returned_units],
            ["采购交期", `${v.purchase_lead_time_days} 天`],
            ["实际利润", `${v.actual_profit_amount} ${v.currency}`],
          ]
            .map(([key, val]) => `<p><span>${key}</span><b>${esc(val)}</b></p>`)
            .join(
              "",
            )}</div><p>来源：${esc(v.source_ref)}</p><p>${esc(v.notes || "未填写复盘说明")}</p><details class="trace-detail" ${S.details ? "open" : ""}><summary>历史快照与审计链路</summary><p>事实 ID：${esc(v.id)}</p><p>决策快照：${label(v.decision_status_snapshot)}</p><p>评分规则：${esc(v.score_rule_version_snapshot || "无快照")}；利润规则：${esc(v.profit_rule_version_snapshot || "无快照")}</p><p>预测利润：${v.predicted_profit_amount ?? "没有基线"} ${esc(v.predicted_currency || "")}</p><p>报价交期：${v.quoted_lead_time_days == null ? "没有基线" : `${v.quoted_lead_time_days} 天`}</p><p>观测 ${time(v.observed_at)} / 创建 ${time(v.created_at)}</p><p>request_id: ${esc(v.request_id)}</p><p>trace_id: ${esc(v.trace_id)}</p></details></article>`,
      )
      .join("")}`;
  }
  const errors = {
    period_end: "周期结束不能早于开始。",
    returned_units: "实际退货量不能大于销量。",
    source_ref: "填写可核对的事实来源。",
  };
  function form() {
    if (!S.canWrite)
      return '<div class="empty"><h3>当前身份只可查看复盘事实</h3><p>写入需要 opportunity:decide；不显示可编辑表单。</p></div>';
    return `<p>只录入已核对的经营事实。金额可以为零，实际利润允许亏损；不会把空值当作真实数值。</p>${S.formError ? `<div class="validation-summary" role="alert">${errors[S.formError]}</div>` : ""}<form id="feedback-form"><div class="input-groups">${Object.entries(
      { period: "周期", sales: "销售与广告", cost: "采购与利润", source: "事实出处" },
    )
      .map(
        ([group, title]) =>
          `<fieldset ${locked() ? "disabled" : ""}><legend>${title}</legend><div class="form-grid">${fields
            .filter((v) => v[4] === group)
            .map(
              ([key, text, type, attrs]) =>
                `<label class="${group === "source" ? "wide" : ""}" for="${key}">${text}${type === "textarea" ? `<textarea id="${key}" ${attrs}>${esc(S.form[key])}</textarea>` : `<input id="${key}" type="${type}" ${attrs} value="${esc(S.form[key])}" required ${S.formError === key ? 'aria-invalid="true"' : ""} aria-describedby="help-${key}" />`}<small id="help-${key}" class="${S.formError === key ? "field-error" : "meta"}">${S.formError === key ? errors[key] : key === "source_ref" ? "ERP 报表编号、财务表编号或人工核对来源" : key === "actual_profit_amount" ? "允许负数；必须与币种一致" : key === "notes" ? "最多 1000 字" : key === "currency" ? "3 位字母；提交时转大写" : ""}</small></label>`,
            )
            .join("")}</div></fieldset>`,
      )
      .join(
        "",
      )}</div><div class="form-footer"><p>提交时记录 observed_at 和当前机会版本；无需手工输入时间戳。零值与 USD 默认仅沿用现有表单，不代表已核实事实。</p><button id="save-feedback" type="submit" class="primary" ${locked() ? "disabled" : ""}>${S.busy ? "正在写入…" : "写入复盘事实"}</button></div></form>`;
  }
  function render() {
    const name = S.section === "lineage" ? "便携净水机会 · 血缘样例" : D.facts.detail.name;
    document.querySelector("#app").innerHTML =
      `<div class="layout"><aside class="directory"><div class="brand">SCOUTOPS</div><p>机会详情 · 辅助与复盘</p><h2>工作目录</h2><details ${innerWidth > 650 ? "open" : ""}><summary>展开目录 · ${sections[S.section]}</summary><nav aria-label="辅助与复盘工作面">${Object.entries(
        sections,
      )
        .map(
          ([key, text]) =>
            `<button data-section="${key}" ${S.busy ? "disabled" : ""} ${S.section === key ? 'aria-current="page"' : ""}>${text}</button>`,
        )
        .join(
          "",
        )}</nav></details><div class="foot"><a href="/opportunities/${D.facts.detail.id}">机会结论</a><a href="/opportunities/${D.facts.detail.id}?tab=evidence">机会证据</a><p>AI 不参与自动决定；历史事实与抽检分开保存。</p></div></aside><main class="content"><div class="context"><a href="/opportunities">返回机会列表</a><span>历史隔离样例 / 非生产</span></div><header class="identity"><h1>${esc(name)}</h1><p>${S.section === "lineage" ? "保留原始 lineage 夹具的 opportunity-1 与节点 URL" : `当前机会版本 ${D.facts.detail.version} · 事实与辅助输出分开核对`}</p></header><section class="workspace" aria-busy="${S.busy || S.readState === "loading"}"><header class="section-title"><div><h2>${sections[S.section]}</h2><p>${S.section === "ai" ? "先读输出，再核对引用与人工抽检" : S.section === "lineage" ? "按真实返回的环节查看事实与失败影响" : "不可变事实与人工校准分开"}</p></div><span class="badge">C 方向待审</span></header><div class="body">${notice()}${{ ai, lineage, feedback, form }[S.section]()}</div></section>${S.navigation ? `<p class="nav-notice" role="status">已记录导航：${esc(S.navigation)}。不打开真实服务。</p>` : ""}${S.message ? `<p class="nav-notice" role="status">${esc(S.message)}</p>` : ""}<p class="notice">历史 AI、血缘及复盘夹具分别演示；非同一生产对象的完整业务链。零值、错误、已审、缺项等变化为合成场景。模型名与哈希仅为记录出处，不包含配置或密钥。</p></main></div>`;
    document.querySelectorAll("[data-section]").forEach(
      (n) =>
        (n.onclick = () => {
          S.section = n.dataset.section;
          render();
        }),
    );
    document.querySelectorAll("[data-record]").forEach(
      (n) =>
        (n.onclick = () => {
          S.selected = Number(n.dataset.record);
          render();
        }),
    );
    document.querySelectorAll("[data-review]").forEach(
      (n) =>
        (n.onclick = () => {
          S.review = {
            resultId: current().result.id,
            outcome: n.dataset.review,
            reason: "",
            error: "",
          };
          openDialog();
        }),
    );
    document.querySelectorAll('a[href^="/"]').forEach(
      (n) =>
        (n.onclick = (event) => {
          event.preventDefault();
          S.navigation = n.getAttribute("href");
          render();
        }),
    );
    document.querySelector("#queue-ai")?.addEventListener("click", () => submit("queue"));
    document.querySelector("#open-form")?.addEventListener("click", () => {
      S.section = "form";
      render();
    });
    document.querySelector("#retry-ai")?.addEventListener("click", () => {
      S.reads++;
      S.lastRead = `/opportunities/${D.facts.detail.id}/ai-analyses`;
      S.readState = "ready";
      S.stale = false;
      S.analyses = copy(D.facts.analyses);
      S.selected = 0;
      render();
    });
    document.querySelector("#retry-load")?.addEventListener("click", () => {
      S.reads++;
      S.outcome = "queued";
      render();
    });
    document.querySelector("#restore-review")?.addEventListener("click", () => openDialog());
    document.querySelector("#feedback-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitFeedback();
    });
    for (const [key, , type] of fields)
      document.querySelector(`#${key}`)?.addEventListener("input", (event) => {
        S.form[key] =
          type === "number"
            ? event.target.value === ""
              ? ""
              : Number(event.target.value)
            : event.target.value;
      });
  }
  function closeDialog(restore = true) {
    const dialog = document.querySelector("#review-dialog");
    if (dialog?.open) dialog.close();
    document.body.classList.remove("modal-open");
    if (restore && S?.review)
      document.querySelector(`[data-review="${S.review.outcome}"]`)?.focus();
  }
  function openDialog() {
    const dialog = document.querySelector("#review-dialog"),
      r = S.review;
    dialog.innerHTML = `<form id="review-form"><header><h2 id="review-title">${r.outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因"}</h2><button type="button" id="close-review" aria-label="关闭原因填写">×</button></header><div class="modal-body"><p>说明将独立写入人工复核记录，AI 原始输出不会被改写。</p><p class="target">结果 ID：${esc(r.resultId)}</p>${r.error ? `<p class="banner danger" role="alert">${esc(r.error)}</p>` : ""}${S.busy ? '<p class="banner" role="status">正在提交；关闭不会取消写入。</p>' : ""}<label for="review-reason">原因（至少 2 字，最多 1000 字）<textarea id="review-reason" required minlength="2" maxlength="1000" ${locked() ? "disabled" : ""} aria-describedby="review-help">${esc(r.reason)}</textarea></label><p id="review-help" class="meta">首尾空白不计入长度，说明与操作者及时间一同保存。</p></div><footer><button type="button" id="cancel-review">${S.busy ? "收起，继续等待" : "取消"}</button><button id="save-review" class="${r.outcome === "approved" ? "primary" : "danger-action"}" ${locked() || r.reason.trim().length < 2 ? "disabled" : ""}>${S.busy ? "正在提交…" : "确认提交"}</button></footer></form>`;
    const close = () => {
      const outcome = S.review.outcome;
      closeDialog(false);
      if (!S.busy && S.outcome !== "unknown") S.review = null;
      render();
      const target =
        document.querySelector(`[data-review="${outcome}"]:not(:disabled)`) ||
        document.querySelector(".section-title h2");
      target.tabIndex = target.tagName === "BUTTON" ? 0 : -1;
      target.focus();
    };
    dialog.querySelector("#close-review").onclick = close;
    dialog.querySelector("#cancel-review").onclick = close;
    dialog.oncancel = (event) => {
      event.preventDefault();
      close();
    };
    dialog.onkeydown = (event) => {
      if (event.key !== "Tab") return;
      const nodes = [...dialog.querySelectorAll("button:not(:disabled),textarea:not(:disabled)")];
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    dialog.querySelector("#review-reason").oninput = (event) => {
      r.reason = event.target.value;
      dialog.querySelector("#save-review").disabled = locked() || r.reason.trim().length < 2;
    };
    dialog.querySelector("#review-form").onsubmit = (event) => {
      event.preventDefault();
      if (r.reason.trim().length >= 2 && r.reason.trim().length <= 1000) submit("review");
    };
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
    dialog
      .querySelector(S.busy || S.outcome === "unknown" ? "#close-review" : "#review-reason")
      .focus();
  }
  async function submit(kind) {
    if (locked() || !S.canWrite) return;
    if (
      kind === "review" &&
      (!S.review || S.readState !== "ready" || current()?.result?.review_status !== "pending")
    )
      return;
    const owner = generation,
      failed = S.failNext,
      review = S.review ? copy(S.review) : null;
    S.failNext = false;
    S.busy = true;
    S.operation = kind;
    S.outcome = "";
    S.intents.push(
      kind === "queue"
        ? copy(D.intents.queue)
        : {
            ...copy(D.intents[review.outcome]),
            path: `/ai-analyses/${review.resultId}/reviews`,
            body: { outcome: review.outcome, notes: review.reason.trim() },
          },
    );
    render();
    if (review && document.querySelector("#review-dialog").open) openDialog();
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (owner !== generation) return;
    S.busy = false;
    if (failed) {
      S.outcome = "failed";
      if (kind === "review") {
        S.review.error = "本次请求被明确拒绝，原因已保留。请核对后显式重试。";
        if (document.querySelector("#review-dialog").open) openDialog();
      }
      render();
      return;
    }
    S.reads++;
    if (kind === "queue") S.outcome = "queued";
    else {
      const record = S.analyses.find((v) => v.result?.id === review.resultId);
      Object.assign(record.result, {
        review_status: review.outcome,
        review: {
          outcome: review.outcome,
          notes: review.reason.trim(),
          reviewed_by: "isolated-reviewer",
          reviewed_at: D.fixedNow,
        },
      });
      closeDialog(false);
      S.review = null;
      S.outcome = "reviewed";
    }
    render();
    document.querySelector(".section-title h2").tabIndex = -1;
    document.querySelector(".section-title h2").focus();
  }
  async function submitFeedback() {
    if (locked() || !S.canWrite) return;
    S.formError =
      S.form.period_end < S.form.period_start
        ? "period_end"
        : Number(S.form.returned_units) > Number(S.form.sales_units)
          ? "returned_units"
          : !S.form.source_ref.trim()
            ? "source_ref"
            : "";
    if (S.formError) {
      render();
      document.querySelector(`#${S.formError}`).focus();
      return;
    }
    const body = {
      ...copy(S.form),
      currency: S.form.currency.trim().toUpperCase(),
      source_ref: S.form.source_ref.trim(),
      notes: S.form.notes.trim(),
      observed_at: D.fixedNow,
      expected_version: D.facts.detail.version,
    };
    S.intents.push({ method: "POST", path: D.feedbackIntent.path, body });
    const owner = generation,
      failed = S.failNext;
    S.failNext = false;
    S.busy = true;
    S.operation = "feedback";
    S.outcome = "";
    render();
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (owner !== generation) return;
    S.busy = false;
    if (failed) S.outcome = "failed";
    else if (
      !S.demoFeedbackSaved &&
      Object.keys(D.feedbackIntent.body).every((key) => body[key] === D.feedbackIntent.body[key])
    ) {
      S.feedback = copy(D.feedbackSubmission);
      S.demoFeedbackSaved = true;
      S.form.source_ref = "";
      S.form.notes = "";
      S.outcome = "saved";
    } else S.outcome = "intent-only";
    render();
  }
  window.REVIEW_C = {
    scenes,
    scene,
    state: () => copy(S),
    failNext: () => {
      S.failNext = true;
    },
    start() {
      document.querySelector("#scene").innerHTML = Object.entries(scenes)
        .map(([key, name]) => `<option value="${key}">${name}</option>`)
        .join("");
      document.querySelector("#scene").onchange = (event) => scene(event.target.value);
      scene("ai");
    },
  };
})();
