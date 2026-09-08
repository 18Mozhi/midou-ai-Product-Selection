/* Review-only prototype: immutable fixture snapshots, in-memory intents, no HTTP or storage. */
(() => {
  const D = window.PROFIT_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "未提供").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const inputLabels = { sale_price: "含税售价", purchase_price: "采购价", logistics: "物流" },
    sections = {
      snapshot: "计算快照",
      inputs: "已生效输入",
      reviews: "成本复核",
      form: "提交成本",
    },
    date = (v) =>
      v
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(v))
        : "未提供";
  const scenes = {
    snapshot: "快照 / 已计算",
    missing: "快照 / 数据不足",
    "no-run": "快照 / 尚无运行",
    zero: "快照 / 显式零值",
    loss: "快照 / 负利润",
    "no-currency": "快照 / 币种缺失",
    components: "快照 / 分项依据展开",
    "missing-component": "快照 / 汇率缺失",
    "long-proof": "快照 / 长来源依据",
    inputs: "生效输入 / 人工复核",
    "auto-inputs": "生效输入 / 自动证据",
    "mixed-inputs": "生效输入 / 两种确认方式",
    "no-inputs": "生效输入 / 无当前记录",
    reviews: "复核 / 指定给我",
    "review-empty": "复核 / 无记录",
    "other-reviewer": "复核 / 指定给他人",
    overdue: "复核 / 已超时仍待处理",
    "done-approved": "复核 / 已通过",
    "done-rejected": "复核 / 已驳回",
    "review-long": "复核 / 长处理说明",
    "permissions-lost": "复核 / 权限已不可用",
    form: "提交 / 九字段初始",
    sale: "提交 / 含税售价",
    purchase: "提交 / 采购价",
    logistics: "提交 / 物流",
    "form-busy": "提交 / 保存中",
    "form-failed": "提交 / 失败保留",
    "reviewers-loading": "提交 / 复核人读取中",
    "reviewers-error": "提交 / 复核人读取失败",
    "reviewers-empty": "提交 / 无可选复核人",
    "invalid-zero": "提交 / 售价零被拒",
    "invalid-time": "提交 / 未来时间被拒",
    "form-success": "提交 / 待复核未生效",
    "queue-busy": "重算 / 排队中",
    "queue-failed": "重算 / 失败",
    "queue-queued": "重算 / 已排队非已计算",
    "queue-no-rule": "重算 / 无活动规则",
    readonly: "权限 / 只读成本",
    loading: "读取 / 主详情加载中",
    "read-error": "读取 / 利润依赖失败",
  };
  for (const [decision, title] of Object.entries({ approved: "通过", rejected: "驳回" }))
    for (const [state, name] of Object.entries({
      empty: "原因未填",
      edited: "原因已填",
      busy: "保存中",
      failed: "失败保留",
      success: "成功重读",
    }))
      scenes[`${decision}-${state}`] = `${title} / ${name}`;
  let s, timer;
  const localDefault = () => {
    const d = new Date(D.fixedNow),
      pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  function base() {
    return {
      name: "snapshot",
      section: "snapshot",
      analysis: clone(D.facts.analysis),
      detail: clone(D.facts.detail),
      form: { ...clone(D.defaults), observed_at: localDefault() },
      reviewers: [{ id: D.form.reviewer_id, label: "另一名成本确认人（隔离样例）" }],
      reviewersState: "ready",
      canConfirm: true,
      state: "ready",
      expanded: false,
      busy: false,
      review: { id: "", decision: "approved", reason: "" },
      error: "",
      errorField: "",
      message: "",
      failNext: false,
      intents: [],
      lastIntent: null,
      reads: 0,
      navigation: null,
      queueStatus: "",
      invalidKind: "",
    };
  }
  function current(mode = "human_review") {
    return {
      platform: "amazon",
      input_type: "purchase_price",
      amount_value: 40,
      currency: "CNY",
      source_type:
        mode === "automatic_evidence" ? "automatic_crawler_evidence" : "manual_confirmation",
      source_ref_id: "verified:purchase_price",
      evidence_id: D.form.evidence_id,
      observed_at: D.fixedNow,
      input_version: 1,
      confirmation_mode: mode,
    };
  }
  function scene(name) {
    clearTimeout(timer);
    s = base();
    s.name = name;
    $("#scene").value = name;
    if (["missing", "missing-component"].includes(name)) {
      Object.assign(s.analysis.latest_run, {
        status: "insufficient_data",
        total_cost: null,
        net_profit: null,
        net_margin_percent: null,
        missing_fields: ["purchase_price.exchange_rate"],
      });
      Object.assign(s.analysis.latest_run.components[1], {
        converted_amount: null,
        exchange_quote_id: null,
        missing_reason: "exchange_rate_missing",
      });
    }
    if (name === "no-run") s.analysis.latest_run = null;
    if (name === "zero")
      Object.assign(s.analysis.latest_run, {
        net_profit: 0,
        net_margin_percent: 0,
        total_cost: 100,
      });
    if (name === "loss")
      Object.assign(s.analysis.latest_run, {
        net_profit: -8,
        net_margin_percent: -8,
        total_cost: 108,
      });
    if (["zero", "loss"].includes(name)) {
      // Explicit coherent layout snapshots, not a client-side profit calculator.
      s.analysis.latest_run.rule_version_code = `layout-${name}`;
      Object.assign(s.analysis.latest_run.components[6], {
        source_amount: name === "zero" ? 71.4 : 79.4,
        converted_amount: name === "zero" ? 71.4 : 79.4,
      });
      for (const component of s.analysis.latest_run.components)
        if (component.source_ref_id?.startsWith("cost_rule:"))
          component.source_ref_id = `layout:${name}`;
    }
    if (name === "no-currency") s.analysis.latest_run.currency = null;
    if (["components", "missing-component", "long-proof"].includes(name)) s.expanded = true;
    if (name === "long-proof")
      s.analysis.latest_run.components[1].source_ref_id =
        "长来源布局样例：" + "同型号报价证据需逐项核对。".repeat(24);
    if (["inputs", "auto-inputs", "mixed-inputs", "no-inputs"].includes(name)) {
      s.section = "inputs";
      s.analysis.current_inputs =
        name === "no-inputs"
          ? []
          : name === "mixed-inputs"
            ? [
                current(),
                {
                  ...current("automatic_evidence"),
                  input_type: "sale_price",
                  amount_value: 100,
                  currency: "USD",
                },
              ]
            : [current(name === "auto-inputs" ? "automatic_evidence" : "human_review")];
    }
    if (
      [
        "reviews",
        "review-empty",
        "other-reviewer",
        "overdue",
        "done-approved",
        "done-rejected",
        "review-long",
        "permissions-lost",
      ].includes(name)
    ) {
      s.section = "reviews";
      const item = s.analysis.cost_input_reviews[0];
      if (name === "review-empty") s.analysis.cost_input_reviews = [];
      if (name === "other-reviewer") item.can_review = false;
      if (name === "overdue") {
        item.overdue = true;
        item.due_at = "2026-08-07T12:00:00.000Z";
      }
      if (name.startsWith("done-") || name === "review-long") {
        item.status = name === "done-rejected" ? "rejected" : "approved";
        item.can_review = false;
        item.version = 2;
        item.decision_reason =
          name === "review-long" ? "长处理说明布局样例。\n".repeat(45) : "报价证据与币种一致";
      }
      if (name === "permissions-lost") s.canConfirm = false;
    }
    if (
      [
        "form",
        "sale",
        "purchase",
        "logistics",
        "form-busy",
        "form-failed",
        "reviewers-loading",
        "reviewers-error",
        "reviewers-empty",
        "invalid-zero",
        "invalid-time",
        "form-success",
      ].includes(name)
    ) {
      s.section = "form";
      if (name !== "form") s.form = clone(D.form);
      s.form.input_type =
        name === "purchase" ? "purchase_price" : name === "logistics" ? "logistics" : "sale_price";
      if (name === "form-busy") s.busy = true;
      if (name === "form-failed") {
        s.error = "成本提交失败（隔离503）；九个字段已保留，请核对后重试。";
        s.failNext = true;
      }
      if (name.startsWith("reviewers-")) {
        s.reviewersState = name.slice(10);
        s.reviewers = [];
        s.form.reviewer_id = "";
      }
      if (name === "invalid-zero") {
        s.form.amount_value = 0;
        s.error = "售价必须大于零；采购价和物流可以显式填写零。";
        s.errorField = "amount_value";
      }
      if (name === "invalid-time") {
        s.form.observed_at = "2030-01-01T12:00";
        s.error = "观测时间不能晚于服务端当前时间五分钟以上。";
        s.errorField = "observed_at";
      }
      if (name === "form-success") {
        addPendingSubmission();
        s.detail.version++;
        s.message = "模拟已提交双人复核；未生效，当前利润快照不变。";
      }
    }
    if (name.startsWith("queue-")) {
      s.form = clone(D.form);
      s.queueStatus = name.slice(6);
      s.busy = name === "queue-busy";
      if (name === "queue-failed") {
        s.error = "排队失败（隔离503）；未自动重试，当前快照保持不变。";
        s.failNext = true;
      }
      if (name === "queue-queued")
        s.message = "模拟计算任务已排队；不是新利润结果，以下仍是上一运行快照。";
      if (name === "queue-no-rule")
        s.error = "当前平台没有活动费用规则；请核对规则，不用默认费率填补。";
    }
    if (name === "readonly") s.canConfirm = false;
    if (["loading", "read-error"].includes(name)) s.state = name;
    if (/^(approved|rejected)-/.test(name)) {
      s.section = "reviews";
      const [decision, state] = name.split("-");
      s.review = { id: D.facts.reviewId, decision, reason: state === "empty" ? "" : D.reason };
      s.busy = state === "busy";
      if (state === "failed") {
        s.error = "复核保存失败（隔离503）；说明已保留，请核对后重试。";
        s.failNext = true;
      }
      if (state === "success") {
        const item = s.analysis.cost_input_reviews[0];
        item.status = decision;
        item.can_review = false;
        item.decision_reason = D.reason.trim();
        item.version = 2;
        s.review.id = "";
        s.detail.version++;
        if (decision === "approved") s.analysis.current_inputs = [current()];
        s.message =
          decision === "approved"
            ? "模拟复核通过，成本已生效；有活动规则时才会排队重算，旧快照不变。"
            : "模拟已驳回，提交记录保留且不会进入利润计算。";
      }
    }
    render();
    window.scrollTo(0, 0);
  }
  function identity() {
    return `<header class="identity"><p class="meta"><span>US 市场</span><span>机会版本 v${s.detail.version}</span><span>历史隔离样例</span></p><h2>${esc(s.detail.name)}</h2><p class="meta">此处只展示利润与成本，不替代质量门与最终人工决定。</p></header>`;
  }
  function addPendingSubmission() {
    s.analysis.cost_input_reviews.unshift({
      ...clone(D.facts.analysis.cost_input_reviews[0]),
      id: "00000000-0000-4000-8000-000000900449",
      cost_input_id: "00000000-0000-4000-8000-000000900450",
      input_type: s.form.input_type,
      amount_value: Number(s.form.amount_value),
      currency: s.form.currency.toUpperCase(),
      platform: s.form.platform.toLowerCase(),
      evidence_id: s.form.evidence_id,
      submitter_id: D.facts.reviewerId,
      submitter_label: "成本复核人（当前样例）",
      reviewer_label: "另一名成本确认人（隔离样例）",
      reviewer_id: s.form.reviewer_id,
      can_review: false,
      due_at: "2026-08-09T12:00:00.000Z",
    });
  }
  const money = (n, c) => `${n == null ? "—" : esc(n)} <small>${esc(c || "币种未提供")}</small>`;
  function snapshot() {
    const r = s.analysis.latest_run;
    return `<section class="surface"><header class="section-head"><div><h3>计算快照</h3><p>来源于服务端的不可变运行；修改输入不会在浏览器重算。</p></div><a href="/sourcing/cost-rules" data-local>管理费用规则</a></header>${r ? `<div class="snapshot-line"><strong>${r.status === "calculated" ? "已计算" : "数据不足"}</strong><span>${esc(r.platform)} / ${esc(r.market)}</span><span>规则 ${esc(r.rule_version_code)}</span><span>${date(r.calculated_at)}</span></div>` : ""}<p class="formula">净利润 = 含税售价 − 采购 − 物流 − 平台费 − 支付手续费 − 税费 − 履约成本</p>${r?.status === "calculated" ? `<dl class="result-strip"><div><dt>含税售价</dt><dd>${money(r.sale_price, r.currency)}</dd></div><div><dt>总成本</dt><dd>${money(r.total_cost, r.currency)}</dd></div><div class="net ${r.net_profit < 0 ? "loss" : ""}"><dt>净利润</dt><dd>${money(r.net_profit, r.currency)}</dd><p>净利率 ${r.net_margin_percent ?? "—"}%</p></div></dl>` : `<div class="banner"><strong>数据不足，不能生成可靠利润结果</strong><p>${r ? `缺失：${esc(r.missing_fields.join("、") || "缺项明细未提供")}` : "尚无利润计算运行。"}</p><p>缺失值不替换为零，不展示数值 ROI。</p></div>`}${r ? `<div aria-label="利润分项">${r.components.map((c) => `<details class="component" ${s.expanded ? "open" : ""}><summary><span>${esc(D.componentLabels[c.component_type] || c.component_type)}<em>展开来源依据</em></span><b>${c.converted_amount == null ? "缺失" : esc(c.converted_amount)} ${esc(c.target_currency || "币种未提供")}</b></summary><dl class="provenance"><div><dt>原始金额</dt><dd>${esc(c.source_amount ?? "—")} ${esc(c.source_currency || "币种未提供")}</dd></div><div><dt>来源标识</dt><dd>${esc(c.source_ref_id ?? "未提供")}</dd></div><div><dt>证据 ID</dt><dd>${esc(c.evidence_id ?? "未提供")}</dd></div><div><dt>汇率快照</dt><dd>${esc(c.exchange_quote_id ?? "未提供")}</dd></div></dl>${c.missing_reason ? `<p class="missing">缺失原因：${esc(c.missing_reason)}</p>` : ""}</details>`).join("")}</div>` : ""}${s.canConfirm ? `<div class="section-actions"><label>本次重算平台<input id="queue-platform" value="${esc(s.form.platform)}" required maxlength="80" ${s.busy ? "readonly" : ""}/></label><button type="button" id="queue" class="primary" ${s.busy ? "disabled" : ""}>${s.busy ? "排队中…" : "重新计算"}</button><p class="note">与提交成本共用平台值。重算只使用已生效输入，不使用未复核草稿。</p></div>` : '<p class="readonly">当前为只读成本视图。提交成本和重新计算需要“确认成本”权限。</p>'}${s.error ? `<p class="error" role="alert">${esc(s.error)}</p>` : ""}</section>`;
  }
  function inputs() {
    return `<section class="surface"><header class="section-head"><div><h3>已生效输入</h3><p>与当前利润快照的计算时间分别核对；新输入生效不等于新运行完成。</p></div></header>${s.analysis.current_inputs.length ? s.analysis.current_inputs.map((c) => `<article class="input-record"><header class="record-head"><strong>${inputLabels[c.input_type]} ${c.amount_value} ${c.currency}</strong><span class="method">${c.confirmation_mode === "automatic_evidence" ? "爬虫证据自动确认" : "人工双人复核"}</span></header><p class="meta">${c.platform} / 输入版本 v${c.input_version}</p><dl><div><dt>来源类型</dt><dd>${esc(c.source_type)}</dd></div><div><dt>来源标识</dt><dd>${esc(c.source_ref_id)}</dd></div><div><dt>证据 ID</dt><dd>${esc(c.evidence_id)}</dd></div><div><dt>观测时间（中国标准时间）</dt><dd>${date(c.observed_at)}</dd></div></dl></article>`).join("") : '<div class="blank"><h3>没有已生效输入记录</h3><p>历史利润运行仍可存在。待复核提交不在这里冒充当前生效输入。</p></div>'}<p class="proof-label">此分区当前输入为明确合成布局样例，不是新的真实业务记录。</p></section>`;
  }
  function reviews() {
    return `<section class="surface"><header class="section-head"><div><h3>成本复核</h3><p>提交后 24 小时内处理；超时会提示，但不自动通过或使复核失效。</p></div><span>${s.analysis.cost_input_reviews.length} 条返回记录</span></header>${!s.canConfirm ? '<p class="readonly">成本确认权限当前不可用；保留记录，不开放复核提交。</p>' : ""}${s.analysis.cost_input_reviews.length ? s.analysis.cost_input_reviews.map((item) => `<article class="review-item" data-review="${item.id}"><header class="record-head"><div><strong>${inputLabels[item.input_type]} ${item.amount_value} ${item.currency}</strong><p class="audit">${item.platform} / 输入 v${item.input_version} / 复核 v${item.version}</p></div><b class="status-pill" data-overdue="${item.overdue}">${item.overdue ? "已超时" : { pending: "待复核", approved: "已通过", rejected: "已驳回" }[item.status]}</b></header><dl class="who"><div><dt>提交人</dt><dd>${esc(item.submitter_label)}</dd></div><div><dt>指定复核人</dt><dd>${esc(item.reviewer_label)}</dd></div></dl><p class="audit">期限 ${date(item.due_at)}（中国标准时间）</p><p class="audit">证据 ${esc(item.evidence_id)}</p>${item.decision_reason ? `<p class="reason-record">处理说明：${esc(item.decision_reason)}</p>` : ""}${item.can_review && s.canConfirm ? `<div class="review-actions"><button data-begin="rejected" data-id="${item.id}" class="danger" ${s.busy ? "disabled" : ""}>驳回</button><button data-begin="approved" data-id="${item.id}" ${s.busy ? "disabled" : ""}>通过</button></div>` : item.status === "pending" && s.canConfirm ? '<p class="audit">仅指定复核人可处理此单；不代替他人复核。</p>' : ""}${s.review.id === item.id && item.can_review && s.canConfirm ? `<form class="review-form" id="review-form"><h4>${s.review.decision === "approved" ? "通过此项成本复核" : "驳回此项成本提交"}</h4><label for="review-reason">${s.review.decision === "approved" ? "复核说明" : "驳回原因"}<textarea id="review-reason" required minlength="2" maxlength="1000" aria-describedby="review-hint review-error" ${s.busy ? "readonly" : ""}>${esc(s.review.reason)}</textarea></label><small id="review-hint">去除首尾空白后至少 2 个字符，最多 1000 个字符。</small><p id="review-error" role="alert" class="error" ${s.error ? "" : "hidden"}>${esc(s.error)}</p><footer><button type="button" id="cancel-review" ${s.busy ? "disabled" : ""}>取消</button><button type="submit" id="save-review" class="${s.review.decision === "rejected" ? "danger" : "primary"}" ${s.busy || s.review.reason.trim().length < 2 ? "disabled" : ""}>${s.busy ? "保存中…" : "提交"}</button></footer></form>` : ""}</article>`).join("") : '<div class="blank"><h3>暂无成本复核记录</h3><p>不等于读取失败；此处只在已确认空结果时展示。</p></div>'}</section>`;
  }
  const field = (name, title, attr = "", hint = "") =>
    `<label for="${name}">${title}<input id="${name}" name="${name}" value="${esc(s.form[name])}" required ${attr} ${s.busy ? "readonly" : ""} aria-invalid="${s.errorField === name}" aria-describedby="${name}-hint cost-error"/><small id="${name}-hint">${hint}</small></label>`;
  function form() {
    if (!s.canConfirm)
      return '<section class="surface readonly">当前没有提交成本权限。请核对当前角色，不代你变更权限。</section>';
    return `<section class="surface"><header class="section-head"><div><h3>提交成本复核</h3><p>保存有依据的金额，由另一名指定成员复核。</p></div></header><form id="cost-form"><fieldset><legend>金额与适用范围</legend><div class="fields">${field("platform", "平台", 'maxlength="80"', "与本次重算平台共用；不会修改历史快照。")}<label for="input_type">类型<select id="input_type" name="input_type" ${s.busy ? "disabled" : ""}>${Object.entries(
      inputLabels,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${k === s.form.input_type ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label>${field("amount_value", "金额", 'type="number" min="0" step="0.000001"', "售价需大于零；采购价与物流允许显式零。")} ${field("currency", "币种", 'maxlength="3"', "使用三字母币种；最终校验由服务端完成。")}</div></fieldset><fieldset><legend>来源与观测</legend><div class="fields">${field("source_type", "来源类型", 'maxlength="80"', "保留现有来源类型，不从标题猜来源。")} ${field("source_ref_id", "来源标识", 'maxlength="255"', "填写可追溯的原始来源标识。")} ${field("evidence_id", "证据 ID", 'maxlength="36"', "真实服务会验证证据是否属于当前机会范围。")} ${field("observed_at", "观测时间", 'type="datetime-local"', "按本机时区输入；审核环境为中国标准时间（UTC+8）。")}</div></fieldset><fieldset><legend>指定另一人复核</legend><div class="fields"><label class="wide" for="reviewer_id">指定复核人<select id="reviewer_id" name="reviewer_id" required ${s.busy || s.reviewersState !== "ready" || !s.reviewers.length ? "disabled" : ""}><option value="" disabled ${!s.form.reviewer_id ? "selected" : ""}>请选择另一名成本确认人</option>${s.reviewers.map((r) => `<option value="${r.id}" ${r.id === s.form.reviewer_id ? "selected" : ""}>${esc(r.label)}</option>`).join("")}</select></label></div>${s.reviewersState !== "ready" || !s.reviewers.length ? `<div class="banner" role="status"><strong>${{ loading: "正在读取复核人", error: "复核人读取失败", empty: "没有可选复核人" }[s.reviewersState] || "没有可选复核人"}</strong><p>${s.reviewersState === "error" ? "名单未知，不当作空名单；九个字段保留。" : "必须选择另一个可访问当前工作区且具有成本确认权限的成员。"}</p>${s.reviewersState !== "loading" ? '<button type="button" id="retry-reviewers">重新读取名单</button>' : ""}</div>` : ""}</fieldset><p class="error" role="alert" id="cost-error" ${s.error ? "" : "hidden"}>${esc(s.error)}</p><footer><p>当前机会 v${s.detail.version}。提交只创建待复核记录；复核通过前，成本和利润均不因这份草稿改变。</p><button type="submit" class="primary" id="save-cost" ${s.busy || !s.form.reviewer_id || s.reviewersState !== "ready" ? "disabled" : ""}>${s.busy ? "提交中…" : "提交双人复核"}</button></footer></form></section>`;
  }
  function render() {
    $("#sections").innerHTML = Object.entries(sections)
      .map(
        ([key, name]) =>
          `<button type="button" data-section="${key}" ${s.section === key ? 'aria-current="page"' : ""} ${s.busy ? "disabled" : ""}>${name}</button>`,
      )
      .join("");
    $("#back").href = `/opportunities/${s.detail.id}`;
    $("#work").setAttribute("aria-busy", String(s.busy || s.state === "loading"));
    $("#work").innerHTML =
      s.state !== "ready"
        ? `<section class="surface blank" role="status"><h3>${s.state === "loading" ? "正在读取机会和利润依赖" : "利润依赖读取失败"}</h3><p>保留现有主依赖合同；没有读取成功，不把利润显示为零。</p>${s.state !== "loading" ? '<button id="retry-main" type="button">重新读取</button>' : ""}</section>`
        : `${identity()}${s.message ? `<p role="status" class="notice">${esc(s.message)}</p>` : ""}${{ snapshot, inputs, reviews, form }[s.section]()}<p class="delivery-note">C 方向待审 · 此稿仅 P18 利润与成本。无真实 HTTP / 数据库 / 权限写入；过期、缺值和长文本为明确合成布局状态。其余六个业务分区、全页整合和生产验收仍待完成。</p>`;
  }
  function intent(path, body) {
    s.lastIntent = { method: "POST", path, body: clone(body) };
    s.intents.push(clone(s.lastIntent));
  }
  function begin(id, decision) {
    s.review = { id, decision, reason: "" };
    s.error = "";
    render();
    $("#review-reason").focus();
  }
  function submitCost() {
    if (s.busy || !s.canConfirm || s.reviewersState !== "ready" || !s.form.reviewer_id) return;
    const body = {
      ...clone(s.form),
      amount_value: Number(s.form.amount_value),
      observed_at: new Date(s.form.observed_at).toISOString(),
      expected_version: s.detail.version,
    };
    intent(`/opportunities/${s.detail.id}/cost-inputs`, body);
    s.busy = true;
    s.error = "";
    s.errorField = "";
    render();
    timer = setTimeout(() => {
      s.busy = false;
      if (s.failNext) {
        s.failNext = false;
        s.error = "成本提交失败（隔离503）；输入保留，请显式重试。";
      } else if (body.input_type === "sale_price" && body.amount_value === 0) {
        s.error = "售价必须大于零；采购价和物流可以显式填写零。";
        s.errorField = "amount_value";
      } else if (new Date(body.observed_at) > new Date(new Date(D.fixedNow).valueOf() + 300000)) {
        s.error = "观测时间不能晚于服务端当前时间五分钟以上。";
        s.errorField = "observed_at";
      } else {
        s.reads++;
        s.detail.version++;
        addPendingSubmission();
        s.message = "模拟已提交双人复核；未生效，当前利润快照不变。";
      }
      render();
      if (s.errorField) $(`[name="${s.errorField}"]`).focus();
      else $("#work").focus();
    }, 350);
  }
  function submitReview() {
    const item = s.analysis.cost_input_reviews.find((i) => i.id === s.review.id);
    if (s.busy || !s.canConfirm || !item?.can_review || s.review.reason.trim().length < 2) return;
    const decision = s.review.decision,
      reason = s.review.reason.trim();
    intent(`/opportunities/${s.detail.id}/cost-input-reviews/${item.id}/actions`, {
      decision,
      reason,
      expected_version: item.version,
    });
    s.busy = true;
    s.error = "";
    render();
    timer = setTimeout(() => {
      s.busy = false;
      if (s.failNext) {
        s.failNext = false;
        s.error = "复核保存失败（隔离503）；说明已保留，请显式重试。";
      } else {
        item.status = decision;
        item.can_review = false;
        item.decision_reason = reason;
        item.version++;
        item.overdue = false;
        s.detail.version++;
        s.reads++;
        s.review.id = "";
        if (decision === "approved") s.analysis.current_inputs = [current()];
        s.message =
          decision === "approved"
            ? "模拟通过并生效；有活动规则才排队重算。这里仍是旧利润快照。"
            : "模拟驳回已记录；原提交保留，不进入计算。";
      }
      render();
      if (s.error) $("#review-reason").focus();
      else $("#work").focus();
    }, 350);
  }
  document.addEventListener("input", (e) => {
    const n = e.target;
    if (n.id === "review-reason") {
      s.review.reason = n.value;
      $("#save-review").disabled = s.busy || n.value.trim().length < 2;
    } else if (n.id === "queue-platform") s.form.platform = n.value;
    else if (n.name in s.form) s.form[n.name] = n.type === "number" ? n.value : n.value;
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.name in s.form) {
      s.form[n.name] = n.value;
      if (n.id === "reviewer_id") $("#save-cost").disabled = s.busy || !n.value;
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "cost-form") {
      e.preventDefault();
      submitCost();
    }
    if (e.target.id === "review-form") {
      e.preventDefault();
      submitReview();
    }
  });
  document.addEventListener("click", (e) => {
    const local = e.target.closest("[data-local]");
    if (local) {
      e.preventDefault();
      s.navigation = local.getAttribute("href");
      return;
    }
    const section = e.target.closest("[data-section]");
    if (section && !s.busy) {
      s.section = section.dataset.section;
      s.error = "";
      render();
      $("#work").focus();
      return;
    }
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.begin && !s.busy) {
      begin(b.dataset.id, b.dataset.begin);
      return;
    }
    if (b.id === "cancel-review") {
      const action = s.review.decision;
      s.review.id = "";
      s.error = "";
      render();
      $(`[data-begin="${action}"]`)?.focus();
    }
    if (b.id === "retry-reviewers") {
      s.lastIntent = { method: "GET", path: "/cost-input-reviewers" };
      s.reviewers = [{ id: D.form.reviewer_id, label: "另一名成本确认人（隔离样例）" }];
      s.reviewersState = "ready";
      s.reads++;
      render();
      $("#reviewer_id").focus();
    }
    if (b.id === "retry-main") {
      s.lastIntent = { method: "GET", path: `/opportunities/${s.detail.id}/profit-analysis` };
      s.state = "ready";
      s.reads++;
      render();
    }
    if (b.id === "queue" && !s.busy && s.canConfirm) {
      intent(`/opportunities/${s.detail.id}/profit-runs`, {
        platform: s.form.platform,
        expected_version: s.detail.version,
      });
      s.busy = true;
      s.error = "";
      render();
      timer = setTimeout(() => {
        s.busy = false;
        if (s.failNext) {
          s.failNext = false;
          s.error = "排队失败（隔离503）；未自动重试，快照不变。";
        } else if (s.queueStatus === "no-rule") {
          s.error = "没有活动费用规则；不填默认费率，不生成可靠利润。";
        } else {
          s.reads++;
          s.queueStatus = "queued";
          s.message = "模拟计算任务已排队；不是新利润结果，以下仍是上一运行快照。";
        }
        render();
        $("#queue").focus();
      }, 350);
    }
  });
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, title]) => `<option value="${key}">${title}</option>`)
    .join("");
  $("#scene").addEventListener("change", (e) => scene(e.target.value));
  window.PROFIT_C = { scene, scenes, state: () => clone(s) };
  scene("snapshot");
})();
