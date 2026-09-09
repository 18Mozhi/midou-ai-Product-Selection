// Formal offline proposal. Synthetic contract-shape records; no network/storage or browser ROI math.
(() => {
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0"),
    recordId = uuid(21),
    opp = uuid(18),
    reviewId = uuid(81);
  const scenes = [
    ["workspace", "完整找货工作台"],
    ["keyword-record", "关键词记录 / 无机会成本"],
    ["missing-quote", "待确认报价字段"],
    ["readonly", "只读货源"],
    ["cost-only", "独立成本权限"],
    ["platform-inspect", "受权采集明细"],
    ["queued", "首次排队"],
    ["running", "来源执行中"],
    ["source-blocked", "部分来源受阻"],
    ["failed", "采集失败"],
    ["empty-result", "采集成功无候选"],
    ["empty", "无找货记录"],
    ["loading", "正在读取"],
    ["error", "读取失败"],
    ["expired", "会话过期"],
    ["forbidden", "无权限"],
    ["rate-limited", "限流"],
    ["search-empty", "搜索无结果"],
    ["detail-error", "详情失败"],
    ["comparison-error", "对比历史读取失败"],
    ["erp", "ERP参考不作为确认报价"],
    ["select-one", "选择一家"],
    ["select-two", "选择两家"],
    ["select-five", "最多五家"],
    ["comparison", "已保存对比"],
    ["spec-format", "规格仅格式差异"],
    ["spec-different", "规格不一致"],
    ...["keyword", "image", "opportunity", "product_url"].map((v) => [
      "search-" + v,
      "找货输入 / " + v,
    ]),
    ["search-error", "找货失败保留"],
    ["search-busy", "找货提交中"],
    ["quote", "确认新报价版本"],
    ["quote-defaults", "缺字段预填非事实"],
    ["quote-error", "报价失败保留"],
    ["quote-busy", "报价提交中"],
    ["purchase", "锁定报价与MOQ"],
    ["purchase-error", "采购失败保留"],
    ["purchase-busy", "采购提交中"],
    ["delete", "删除保留证据"],
    ["delete-error", "删除失败保留"],
    ["delete-busy", "删除提交中"],
    ["cost-missing", "利润输入不足"],
    ["cost-calculated", "已计算历史快照"],
    ["cost-pending", "成本待复核"],
    ["cost-overdue", "复核超时不自动批准"],
    ["cost-approved", "复核通过记录"],
    ["cost-rejected", "复核驳回记录"],
    ["cost-readonly", "成本只读"],
    ["cost-review-approved", "内联通过原因"],
    ["cost-review-rejected", "内联驳回原因"],
    ["cost-error", "成本读取失败"],
    ["cost-reviewers-empty", "无可选复核人"],
    ["cost-submit-error", "成本提交失败保留"],
    ["cost-recalculating", "利润重算排队"],
    ...["deep-ocean", "cloud-white", "aurora-purple"].flatMap((t) =>
      ["standard", "compact"].map((d) => [t + "-" + d, t + " / " + d]),
    ),
  ].map(([id, label]) => ({ id, label, pageId: "P21" }));
  const baseOffers = Array.from({ length: 6 }, (_, i) => ({
    id: uuid(100 + i),
    supplier_name:
      ["南岸收纳用品", "澄木家居制品", "启程日用品", "森屿工艺", "齐物收纳", "北辰家居"][i] +
      "（样本）",
    product_title: "模块化桌面收纳托盘",
    specification: i === 1 ? "30 × 20 cm / 单只" : "30x20cm / 1pc",
    moq: 100,
    quoted_price: 8 + i,
    currency: "USD",
    lead_time_days: 7 + i,
    location: "广东",
    confidence_value: 80,
    stability_status: "stable",
    risk_level: "unknown",
    observed_at: "2026-09-09T00:00:00.000Z",
    evidence_id: uuid(200 + i),
    quote: { id: uuid(300 + i), version: 2 },
    original_url: "https://example.com/synthetic-supplier/" + (i + 1),
  }));
  const records = [
    { id: recordId, name: "桌面收纳机会 · 货源核对", input_type: "opportunity", input_ref: opp },
    { id: uuid(22), name: "折叠收纳箱", input_type: "keyword", input_ref: "折叠收纳箱" },
  ];
  let current,
    record,
    offers,
    selectedQuotes,
    tab,
    query,
    modalKind,
    modalOffer,
    busy,
    message,
    modalError,
    opener,
    searchForm,
    quoteForm,
    purchaseForm,
    deleteReason = "",
    costForm,
    reviewDecision = "",
    reviewReason = "",
    costMessage = "";
  const intents = [];
  const is = (...v) => v.includes(current.id),
    manager = () => !is("readonly", "cost-only"),
    costAllowed = () => !is("readonly", "cost-readonly"),
    reviewAllowed = () => is("cost-review-approved", "cost-review-rejected", "cost-overdue");
  const action = (id, label, cls = "", disabled = false, attrs = "") =>
    `<button type="button" data-action="${id}" class="${cls}" ${disabled ? "disabled" : ""} ${attrs}>${label}</button>`;
  const link = (id, label, href, external = false) =>
    `<a class="${external ? "source-link" : "link"}" data-action="${id}" href="${href}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  const badge = (v, cls = "") => `<span class="badge ${cls}">${v}</span>`;
  const notice = (title, body, cls = "") =>
    `<section class="notice ${cls}"><strong>${title}</strong><p>${body}</p></section>`;
  const localDate = (date) => {
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  function choose(id) {
    if ($("#modal").open) $("#modal").close();
    current = scenes.find((s) => s.id === id);
    if (!current) throw new Error("Unknown scene");
    record = { ...records[is("keyword-record") ? 1 : 0] };
    offers = structuredClone(baseOffers.slice(0, is("select-five") ? 6 : 3));
    if (!is("select-five")) {
      offers[2].quote = null;
      offers[2].moq = null;
      offers[2].specification = null;
      offers[2].lead_time_days = null;
      offers[2].confidence_value = null;
    }
    if (is("missing-quote", "quote-defaults")) offers = [{ ...offers[2] }];
    selectedQuotes = is("select-one")
      ? [offers[0].quote.id]
      : is("select-two")
        ? offers.slice(0, 2).map((o) => o.quote.id)
        : is("select-five")
          ? offers.slice(0, 5).map((o) => o.quote.id)
          : [];
    tab = id.startsWith("cost-")
      ? "cost"
      : is("comparison", "spec-format", "spec-different")
        ? "comparison"
        : "offers";
    query = is("search-empty") ? "不存在的找货记录" : "";
    modalKind = "";
    busy = false;
    modalError = "";
    message = "";
    costMessage = "";
    reviewReason = "";
    reviewDecision = id.startsWith("cost-review-")
      ? id.endsWith("approved")
        ? "approved"
        : "rejected"
      : "";
    searchForm = {
      input_type:
        id.startsWith("search-") &&
        ["keyword", "image", "opportunity", "product_url"].includes(id.slice(7))
          ? id.slice(7)
          : "keyword",
      input_ref: "桌面收纳托盘",
    };
    if (searchForm.input_type === "opportunity") searchForm.input_ref = opp;
    if (["image", "product_url"].includes(searchForm.input_type))
      searchForm.input_ref = "https://example.com/synthetic-source";
    costForm = {
      platform: "amazon",
      input_type: "purchase_price",
      amount_value: 0,
      currency: "USD",
      source_type: "supplier_quote",
      source_ref_id: "",
      evidence_id: "",
      observed_at: localDate("2026-09-09T00:00:00Z"),
      reviewer_id: "",
    };
    if (is("cost-submit-error")) {
      Object.assign(costForm, {
        source_ref_id: uuid(300),
        evidence_id: uuid(200),
        reviewer_id: uuid(90),
      });
      costMessage = "隔离失败样本：输入已保留；结果不能仅由网络错误推定。";
    }
    $("#scene").value = id;
    document.documentElement.dataset.theme = id.startsWith("cloud-white")
      ? "cloud-white"
      : id.startsWith("aurora-purple")
        ? "aurora-purple"
        : "deep-ocean";
    document.documentElement.dataset.density = id.endsWith("compact") ? "compact" : "standard";
    render();
    if (id.startsWith("search-") && id !== "search-empty") openModal("search", null, true);
    else
      for (const kind of ["quote", "purchase", "delete"])
        if (id === kind || id.startsWith(kind + "-"))
          openModal(
            kind,
            kind === "quote" ? offers.find((o) => !o.quote) || offers[0] : offers[0],
            true,
          );
  }
  function empty(title, text, id = "SC-STATE", label = "重新读取") {
    return `<section class="empty"><span class="symbol" aria-hidden="true">◇</span><h2>${title}</h2><p>${text}</p>${id ? action(id, label, "primary") : ""}</section>`;
  }
  function render() {
    const matches = records.filter((r) =>
      (r.name + " " + r.input_ref + " completed_with_warnings")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
    $("#app").innerHTML =
      `<header class="identity"><span class="brand">Scout<i>Ops</i></span><span class="meta">样本组织 / 桌面收纳工作区</span></header><div class="layout"><aside class="scope"><div><p class="eyebrow">供应链找货</p><h2>把报价追到证据</h2><p class="meta">当前工作区的找货记录，保留来源与版本。</p></div>${manager() ? action("SC-S-OPEN", "＋ 发起找货", "primary") : "<p>货源只读权限</p>"}<label>搜索找货记录<input id="search" data-action="SC-SEARCH" type="search" placeholder="记录名称、编号、状态" value="${esc(query)}" /></label><div class="records">${matches.map((r) => action("SC-DETAIL", `<strong>${r.name}</strong><small>${r.input_type === "opportunity" ? "选品机会" : "关键词"} · ${r.id === record.id ? { queued: "等待采集", running: "采集中", failed: "采集失败", "empty-result": "未找到可用候选" }[current.id] || "已完成但有缺失" : "已完成但有缺失"}</small><small>查看详情 →</small>`, "record", false, `data-record="${r.id}" aria-pressed="${r.id === record.id}"`)).join("")}</div><p class="meta">${matches.length} 个匹配记录</p><div class="scope-footer">真实候选 → 确认报价 → 保存对比 → 采购排队<br><br>样本数据，不连接生产</div></aside><main class="workspace"><header class="page-head"><div><p class="eyebrow">${record.input_type === "opportunity" ? "关联机会" : "关键词找货"} / 货源事实</p><h1>${esc(record.name)}</h1><p>先核对规格与证据，再确定采购数量。</p><div class="actions">${manager() ? action("SC-REFRESH", "重新采集") : ""}${link("SC-RULES", "费用与利润规则", "/sourcing/cost-rules?from=" + encodeURIComponent("/sourcing?record=" + record.id))}${manager() ? `<details class="more"><summary>更多操作</summary><div>${action("SC-DELETE-OPEN", "删除找货记录", "danger")}</div></details>` : ""}</div></div></header>${message ? `<div class="notice info" role="status">${esc(message)}</div>` : ""}${content(matches)}<p class="artifact">P21 · SOURCING-C-r1 · ${esc(current.label)} · 合成合同样本，具体设计待审。</p></main></div>`;
  }
  function content(matches) {
    if (is("loading"))
      return `<section class="panel" aria-busy="true"><h2>正在读取找货记录</h2><div class="skeleton"></div><div class="skeleton"></div><p class="meta">未知，不提前显示0个候选。</p></section>`;
    if (is("empty"))
      return empty(
        "还没有找货记录",
        "提供关键词、图片引用、机会或商品链接。",
        manager() ? "SC-S-OPEN" : "SC-STATE",
        manager() ? "发起找货" : "重新读取",
      );
    if (!matches.length)
      return empty(
        "没有匹配的找货记录",
        "清空搜索后恢复当前工作区记录。",
        "SC-SEARCH-CLEAR",
        "清空搜索",
      );
    if (is("error", "expired", "forbidden", "rate-limited"))
      return empty(
        {
          error: "找货记录读取失败",
          expired: "登录状态已过期",
          forbidden: "当前无读取权限",
          "rate-limited": "请求受到限流",
        }[current.id],
        "此时不能判断记录为空；错误请求号 synthetic-sourcing-21。",
        "SC-STATE",
        "重新读取",
      );
    const noOffers = is("queued", "running", "failed", "empty-result");
    const progress = is("queued")
      ? [0, 0, 0, 3]
      : is("running")
        ? [1, 0, 0, 2]
        : is("failed")
          ? [0, 3, 0, 0]
          : is("empty-result")
            ? [3, 0, 0, 0]
            : [1, 0, 2, 0];
    return `<section class="progress-panel"><div><strong>${noOffers ? { queued: "等待采集", running: "采集中", failed: "采集失败", "empty-result": "采集成功，未找到候选" }[current.id] : "来源分别完成，受阻不掩盖成功"}</strong><p>公开页采集；没有登录续期入口，也没有浏览器自动轮询。</p></div><div class="counts">${progress.map((n, i) => badge(["成功 ", "失败 ", "受阻 ", "执行中 / 等待 "][i] + n, i === 2 && n ? "warn" : "")).join("")}</div>${is("platform-inspect") ? link("SC-COLLECTION", "查看采集任务明细", "/platform-admin/collection?task=" + uuid(70)) : ""}</section>${is("detail-error") ? notice("详情暂不可用", "列表身份保留；下方旧结果未被标成刚读取成功。", "error") : ""}${is("comparison-error") ? notice("对比历史未能读取", "这是独立降级提案：货源仍可读，但历史不能显示为空。当前Vue仍会阻断整页，尚未修复。", "error") : ""}${is("erp") ? notice("ERP货源线索 · 非确认报价", `历史参考 USD 7.00；不能代替现行供应商报价。<br>${link("SC-ERP", "打开ERP样本来源 ↗", "https://example.com/synthetic-erp", true)}<br><code>证据 ${uuid(250)}</code>`, "info") : ""}<div class="tablist" role="tablist" aria-label="找货记录内容">${[["offers", "货源候选"], ["comparison", "报价对比"], ...(record.input_type === "opportunity" ? [["cost", "机会成本"]] : [])].map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" aria-controls="tab-panel" aria-selected="${tab === id}" tabindex="${tab === id ? 0 : -1}" data-action="SC-TAB" data-tab="${id}">${label}</button>`).join("")}</div><div id="tab-panel" role="tabpanel" aria-labelledby="tab-${tab}">${tab === "cost" ? costPanel() : tab === "comparison" ? comparisonPanel() : noOffers ? empty("尚无可用供应商候选", "任务结束不代表必有结果；受阻、空成功和失败分别呈现。", null) : offerPanel()}</div>${manager() && selectedQuotes.length ? `<aside class="tray" aria-live="polite"><div><strong>已选 ${selectedQuotes.length} / 5 家报价</strong><p>${selectedQuotes.length < 2 ? "至少再选择一家" : "保存引用当前报价ID，不改写报价事实"}</p></div>${action("SC-COMPARE", "保存报价对比", "primary", selectedQuotes.length < 2)}</aside>` : ""}`;
  }
  function offerPanel() {
    return `<section class="panel"><div class="panel-title"><div><h2>供应商候选</h2><p class="meta">报价、MOQ、规格、交期与证据逐项核对</p></div>${badge(offers.length + " 个样本候选")}</div>${offers
      .map(
        (o) =>
          `<article class="offer"><div><div class="offer-top"><div><h3>${o.supplier_name}</h3><p>${o.product_title}</p></div>${badge(o.quote ? "已确认 v" + o.quote.version : "待补齐", o.quote ? "good" : "warn")}</div><dl>${[
            ["规格", o.specification ?? "缺失"],
            ["最小起订量", o.moq ?? "待确认"],
            ["交期", o.lead_time_days === null ? "待确认" : o.lead_time_days + " 天"],
            ["所在地", o.location],
            ["可信度", o.confidence_value === null ? "待确认" : o.confidence_value + " / 100"],
            ["稳定性 / 风险", o.quote ? "稳定 / 未知" : "待确认 / 待确认"],
          ]
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
            .join(
              "",
            )}</dl>${!o.quote ? notice("人工确认前不可比较", "规格、MOQ、交期、可信度待补齐；输入默认值不等于采集事实。") : ""}<div class="evidence">${link("SC-SOURCE", "打开原始商品页 ↗", o.original_url, true)}<span class="meta">观测于 2026-09-09 08:00 · 证据 <code>${o.evidence_id}</code></span></div></div><div class="offer-side"><span class="meta">原始报价</span><strong class="price">${o.currency} ${o.quoted_price.toFixed(2)}</strong><span class="meta">到岸价：待费用规则计算</span>${manager() && o.quote ? `<label class="check"><input type="checkbox" data-action="SC-SELECT" data-offer="${o.id}" ${selectedQuotes.includes(o.quote.id) ? "checked" : ""}/>加入对比</label>` : ""}${manager() ? action(o.quote ? "SC-PURCHASE-OPEN" : "SC-QUOTE-OPEN", o.quote ? "创建采购任务" : "确认报价", o.quote ? "" : "primary", false, `data-offer="${o.id}"`) : "<span class='meta'>只读：不能确认或采购</span>"}</div></article>`,
      )
      .join("")}</section>`;
  }
  function comparisonPanel() {
    const format = is("spec-format"),
      different = !format;
    return `<section class="panel"><div class="panel-title"><div><h2>已保存报价对比</h2><p class="meta">样本记录 · 2026-09-08 16:00 · 两家报价</p></div>${badge("保存时的报价引用")}</div>${notice(format ? "规格仅有格式差异" : "规格文本存在差异，先核对后比较", format ? "大小写、空白和全半角归一后相同；仍不证明商品等价。" : "请核对型号、容量、包装、计量单位。系统不自动换算或判断语义等价。", "info")}<div class="compare-grid">${baseOffers
      .slice(0, 2)
      .map(
        (o, i) =>
          `<article class="compare"><h3>${o.supplier_name}</h3><p class="meta">${o.product_title}</p><dl>${[
            ["规格", format ? (i ? "30X20CM / 1PC" : "３０x２０cm / 1pc") : o.specification],
            ["最小起订量", o.moq],
            ["报价", o.currency + " " + o.quoted_price],
            ["交期", o.lead_time_days + " 天"],
          ]
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
            .join("")}</dl></article>`,
      )
      .join(
        "",
      )}</div><p class="meta">这些是保存时绑定的报价，不承诺今天仍是现行版本。${different ? "不得仅因价格低就忽略规格差异。" : ""}</p></section>`;
  }
  function input(name, label, attrs = "", value = "") {
    return `<label>${label}<input name="${name}" ${attrs} value="${esc(value)}" ${busy ? "disabled" : ""}/></label>`;
  }
  function select(name, label, choices, value) {
    return `<label>${label}<select name="${name}" ${busy ? "disabled" : ""}>${choices.map(([v, t]) => `<option value="${v}" ${v === value ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  }
  function costPanel() {
    if (is("cost-error"))
      return empty(
        "机会成本未能读取",
        "机会版本、利润分析或复核人读取失败；不把缺少快照当作已有0成本。",
        "SC-COST-LOAD",
        "重新读取成本",
      );
    const calculated = is("cost-calculated"),
      status = is("cost-approved")
        ? "已通过"
        : is("cost-rejected")
          ? "已驳回"
          : is("cost-overdue")
            ? "已超时 / 仍待复核"
            : "待复核";
    return `<section class="panel"><div class="panel-title"><div><h2>机会成本与利润</h2><p class="meta">机会版本 7 · 已生效输入与待复核输入分开</p></div>${link("SC-OPPORTUNITY", "打开机会详情", "/opportunities/" + opp + "?tab=profit&from=/sourcing")}</div><p>净利润 = 含税售价 − 采购 − 物流 − 平台费 − 支付手续费 − 税费 − 履约成本</p>${
      calculated
        ? `<div class="cost-summary"><div class="notice info"><p class="meta">服务端已计算快照 · 规则 SAMPLE-v2</p><strong class="profit-number">USD 20.00</strong><p>净利率 20% · 含税售价 USD 100.00</p><p class="meta">仅展示快照，不在浏览器重算。</p></div><div class="cost-lines">${[
            ["采购", 50],
            ["物流", 10],
            ["平台费", 8],
            ["支付手续费", 2],
            ["税费", 5],
            ["履约成本", 5],
          ]
            .map(([n, v]) => `<div><span>${n}</span><strong>USD ${v}.00</strong></div>`)
            .join("")}<p class="meta">总成本 USD 80.00 · 合成已计算样本</p></div></div>`
        : notice(
            is("cost-recalculating") ? "重算已排队，尚无新结果" : "数据不足，不能生成可靠ROI",
            "缺少物流 / 已生效费用版本。提交待复核值不会替换当前成本。",
            "info",
          )
    }<div class="review-row"><strong>已生效采购价 · USD 8.00</strong><p class="meta">输入 v2 · 人工双人复核 · 来源报价 ${uuid(300)}</p></div><section class="review-row"><div class="panel-title"><h3>成本复核队列</h3>${badge(status, is("cost-overdue") ? "warn" : "")}</div><p>采购价 USD 9.00 · 输入 v3 · amazon</p><p class="meta">提交人：采购成员甲 · 指定复核人：采购成员乙<br>期限 2026-09-10 08:00 · 证据 ${uuid(201)}</p><p class="meta">24小时复核；超时提醒和升级，不自动通过。</p>${reviewAllowed() ? `<div class="actions">${action("SC-REVIEW-OPEN", "驳回", "", false, 'data-decision="rejected"')}${action("SC-REVIEW-OPEN", "通过", "", false, 'data-decision="approved"')}</div>` : ""}${reviewDecision ? `<form id="review-form" class="inline-form"><label>${reviewDecision === "approved" ? "复核说明" : "驳回原因"}<textarea name="review_reason" required minlength="2" maxlength="1000">${esc(reviewReason)}</textarea></label><div class="form-footer">${action("SC-REVIEW-CANCEL", "取消")}<button type="submit" data-action="SC-COST-REVIEW" class="primary">提交复核</button></div></form>` : ""}</section>${costMessage ? `<div role="alert" class="notice error">${esc(costMessage)}</div>` : ""}${
      costAllowed()
        ? `<form id="cost-form" class="inline-form"><h3>提交成本复核</h3><p class="meta">由另一名活动成本确认人复核，通过前不影响利润。观测时间按本地时区显示。</p><div class="form-grid">${input("platform", "平台", 'required maxlength="80"', costForm.platform)}${select(
            "input_type",
            "类型",
            [
              ["sale_price", "含税售价"],
              ["purchase_price", "采购价"],
              ["logistics", "物流"],
            ],
            costForm.input_type,
          )}${input("amount_value", "金额（0需显式确认）", 'type="number" required min="0" step="0.000001"', costForm.amount_value)}${input("currency", "币种", 'required maxlength="3"', costForm.currency)}${input("source_type", "来源类型", 'required maxlength="80"', costForm.source_type)}${input("source_ref_id", "来源标识", 'required maxlength="255"', costForm.source_ref_id)}${input("evidence_id", "证据ID", 'required maxlength="36"', costForm.evidence_id)}${input("observed_at", "观测时间", 'type="datetime-local" required', costForm.observed_at)}${select("reviewer_id", "指定复核人", [["", "请选择另一名成本确认人"], ...(is("cost-reviewers-empty") ? [] : [[uuid(90), "采购成员乙（样本）"]])], costForm.reviewer_id)}</div>${is("cost-reviewers-empty") ? notice("没有可选复核人", "不能提交；请核对另一名活动成员的cost:confirm权限。") : ""}<div class="form-footer"><button type="submit" data-action="SC-COST-SUBMIT" class="primary" ${!costForm.reviewer_id ? "disabled" : ""}>提交双人复核</button>${action("SC-COST-RECALCULATE", "重新计算")}</div></form>`
        : notice("当前为只读成本视图", "成本提交和重算需要独立cost:confirm权限。", "info")
    }</section>`;
  }
  function openModal(kind, offer, scene = false) {
    opener = document.activeElement?.closest("[data-action]");
    modalKind = kind;
    modalOffer = offer;
    busy = scene && current.id.endsWith("busy");
    modalError =
      scene && current.id.endsWith("error")
        ? "隔离失败 / 输入已保留。请核对后显式重试，不能由网络错误推定未写入。"
        : "";
    if (kind === "quote")
      quoteForm = {
        moq: offer.moq ?? 1,
        specification: offer.specification ?? "",
        lead_time_days: offer.lead_time_days ?? 7,
        location: offer.location ?? "",
        confidence_value: offer.confidence_value ?? 80,
        stability_status: offer.quote?.stability_status ?? "unknown",
        risk_level: offer.quote?.risk_level ?? "unknown",
        observed_at: localDate(offer.observed_at),
        evidence_id: offer.evidence_id,
      };
    if (kind === "purchase")
      purchaseForm = { quantity: offer.moq ?? 1, reason: "从供应链找货页面创建采购任务" };
    renderModal();
    $("#modal").showModal();
    focusField();
  }
  function focusField() {
    ($("#modal input,#modal select,#modal textarea") || $("#modal button"))?.focus();
  }
  function closeModal() {
    if (busy) return;
    $("#modal").close();
    modalKind = "";
    opener?.focus();
  }
  function renderModal() {
    let title, body, submit;
    if (modalKind === "search") {
      title = "发起供应商找货";
      submit = "开始公开网页采集";
      body =
        select(
          "input_type",
          "输入类型",
          [
            ["keyword", "关键词"],
            ["image", "图片"],
            ["opportunity", "机会"],
            ["product_url", "商品链接"],
          ],
          searchForm.input_type,
        ) +
        input(
          "input_ref",
          {
            keyword: "商品关键词",
            image: "图片地址或图片证据编号",
            opportunity: "机会编号",
            product_url: "商品链接",
          }[searchForm.input_type],
          'required maxlength="2048"',
          searchForm.input_ref,
        ) +
        notice(
          "只提交所选输入类型与引用",
          "图片是引用而非上传；网页缺失字段保持待确认。不虚构登录续期。",
          "info",
        );
    } else if (modalKind === "quote") {
      title = "确认完整供应商报价";
      submit = "确认新版本";
      body =
        notice(
          "新建不可变报价版本",
          `${esc(modalOffer.supplier_name)} · ${modalOffer.currency} ${modalOffer.quoted_price}<br>原始价格和币种不可在这里编辑。1/7/80是现有输入默认值，不是证据，请逐项核实。`,
          "info",
        ) +
        input("specification", "规格", 'required maxlength="1000"', quoteForm.specification) +
        `<div class="form-grid">${input("moq", "最小起订量", 'type="number" min="1" step="1" required', quoteForm.moq)}${input("lead_time_days", "交期（天）", 'type="number" min="0" max="3650" step="1" required', quoteForm.lead_time_days)}${input("location", "所在地", 'required maxlength="255"', quoteForm.location)}${input("confidence_value", "可信度（0–100）", 'type="number" min="0" max="100" step="any" required', quoteForm.confidence_value)}${select(
          "stability_status",
          "稳定性",
          [
            ["stable", "稳定"],
            ["variable", "波动"],
            ["unknown", "未知"],
          ],
          quoteForm.stability_status,
        )}${select(
          "risk_level",
          "风险",
          [
            ["low", "低"],
            ["medium", "中"],
            ["high", "高"],
            ["unknown", "未知"],
          ],
          quoteForm.risk_level,
        )}${input("observed_at", "观测时间（本地）", 'type="datetime-local" required', quoteForm.observed_at)}</div>${input("evidence_id", "确认依据证据", 'type="search" list="evidence-options" required', quoteForm.evidence_id)}<datalist id="evidence-options">${offers.map((o) => `<option value="${o.evidence_id}">${o.supplier_name}</option>`).join("")}</datalist><p class="meta">建议列表不等于权限校验；证据归属仍由服务端确认。</p>`;
    } else if (modalKind === "purchase") {
      title = "创建采购任务";
      submit = "确认创建";
      body = `<dl class="locked">${[
        ["供应商", modalOffer.supplier_name],
        ["锁定报价", "v" + modalOffer.quote.version],
        ["最小起订量", modalOffer.moq],
        ["报价证据", modalOffer.evidence_id],
      ]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join(
          "",
        )}</dl>${input("quantity", "采购数量", `type="number" min="${modalOffer.moq}" step="1" required`, purchaseForm.quantity)}<label>创建原因<textarea name="reason" required minlength="2" maxlength="1000" ${busy ? "disabled" : ""}>${esc(purchaseForm.reason)}</textarea></label>${notice("仅创建待消费采购任务", "提交成功表示queued，不代表已经下单、付款或完成采购。", "info")}`;
    } else {
      title = "删除找货记录";
      submit = "确认删除";
      body =
        notice(
          "候选证据和审计仍保留",
          `删除“${record.name}”后不再显示在工作台，不永久删除原始事实。`,
          "error",
        ) +
        `<label>删除原因<textarea name="reason" required maxlength="500" ${busy ? "disabled" : ""}>${esc(deleteReason)}</textarea></label>`;
    }
    $("#modal").innerHTML =
      `<form id="modal-form"><header><div><p class="eyebrow">供应链 / ${modalKind === "delete" ? "危险操作" : "明确输入"}</p><h2 id="dialog-title">${title}</h2></div>${action("SC-MODAL-CLOSE", "×", "", busy, `aria-label="关闭${title}"`)}</header>${body}${modalError ? `<div role="alert" class="notice error">${esc(modalError)}<br><code>synthetic-request-21</code></div>` : ""}<footer>${action("SC-MODAL-CLOSE", "取消", "", busy)}<button type="submit" data-action="SC-${modalKind.toUpperCase()}-SUBMIT" class="primary ${modalKind === "delete" ? "danger" : ""}" ${busy ? "disabled" : ""}>${busy ? "提交中…" : submit}</button></footer></form>`;
  }
  function intent(path, method, body) {
    intents.push({ path, method, ...(body === undefined ? {} : { body: structuredClone(body) }) });
  }
  document.addEventListener("input", (e) => {
    if (e.target.id === "search") {
      query = e.target.value;
      render();
      $("#search").focus();
    } else if (e.target.closest("#modal")) {
      const form =
        modalKind === "search"
          ? searchForm
          : modalKind === "quote"
            ? quoteForm
            : modalKind === "purchase"
              ? purchaseForm
              : null;
      if (form) form[e.target.name] = e.target.value;
      else deleteReason = e.target.value;
    } else if (e.target.closest("#cost-form")) costForm[e.target.name] = e.target.value;
    else if (e.target.name === "review_reason") reviewReason = e.target.value;
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "scene") choose(e.target.value);
    else if (e.target.matches("#modal [name=input_type]")) {
      searchForm.input_type = e.target.value;
      renderModal();
      $("#modal [name=input_type]").focus();
    } else if (e.target.name === "reviewer_id") {
      costForm.reviewer_id = e.target.value;
      $("[data-action=SC-COST-SUBMIT]").disabled = !costForm.reviewer_id;
    } else if (e.target.dataset.action === "SC-SELECT") {
      const o = offers.find((x) => x.id === e.target.dataset.offer),
        i = selectedQuotes.indexOf(o.quote.id);
      if (i >= 0) selectedQuotes.splice(i, 1);
      else if (selectedQuotes.length < 5) selectedQuotes.push(o.quote.id);
      else message = "一次最多比较五家供应商，第六项未加入。";
      render();
      $(`[data-offer="${o.id}"][type=checkbox]`)?.focus();
    }
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled || el.type === "submit") return;
    const id = el.dataset.action;
    if (el.tagName === "A") {
      e.preventDefault();
      intent(el.getAttribute("href"), "NAVIGATE");
      message = "仅记录导航目标，未访问外部页面或生产服务。";
      render();
      return;
    }
    if (id === "SC-S-OPEN") openModal("search");
    else if (id === "SC-MODAL-CLOSE") closeModal();
    else if (id === "SC-QUOTE-OPEN" || id === "SC-PURCHASE-OPEN")
      openModal(
        id === "SC-QUOTE-OPEN" ? "quote" : "purchase",
        offers.find((o) => o.id === el.dataset.offer),
      );
    else if (id === "SC-DELETE-OPEN") openModal("delete");
    else if (id === "SC-TAB") {
      tab = el.dataset.tab;
      render();
      $("#tab-" + tab).focus();
    } else if (id === "SC-DETAIL") {
      record = { ...records.find((r) => r.id === el.dataset.record) };
      selectedQuotes = [];
      tab = "offers";
      intent("/sourcing/searches/" + record.id, "GET");
      render();
    } else if (id === "SC-SEARCH-CLEAR") {
      query = "";
      render();
      $("#search").focus();
    } else if (id === "SC-COMPARE") {
      if (selectedQuotes.length < 2 || selectedQuotes.length > 5) return;
      intent("/sourcing/comparisons", "POST", {
        name: record.name + " 报价对比",
        quote_ids: selectedQuotes,
      });
      message = "隔离意图已记录；未保存实际对比。";
      render();
    } else if (id === "SC-REFRESH") {
      intent("/sourcing/searches/" + record.id + "/refresh", "POST", {});
      message = "隔离排队演示，不代表新候选已采集。";
      render();
    } else if (id === "SC-STATE") {
      intent("/sourcing/searches", "GET");
      message = "仅记录重读意图；原页面状态恢复由实际接口决定。";
      render();
    } else if (id === "SC-COST-LOAD") {
      intent("/opportunities/" + opp, "GET");
      intent("/opportunities/" + opp + "/profit-analysis", "GET");
      if (costAllowed()) intent("/cost-input-reviewers", "GET");
      message = "仅记录机会版本、利润与有权限时的复核人重读意图。";
      render();
    } else if (id === "SC-COST-RECALCULATE") {
      intent("/opportunities/" + opp + "/profit-runs", "POST", {
        platform: costForm.platform,
        expected_version: 7,
      });
      costMessage = "隔离排队意图已记录；旧利润快照不变。";
      render();
    } else if (id === "SC-REVIEW-OPEN") {
      reviewDecision = el.dataset.decision;
      reviewReason = "";
      render();
      $("#review-form textarea").focus();
    } else if (id === "SC-REVIEW-CANCEL") {
      reviewDecision = "";
      render();
      $("[data-action=SC-REVIEW-OPEN]")?.focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.target.getAttribute("role") !== "tab" ||
      !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)
    )
      return;
    e.preventDefault();
    const tabs = [...document.querySelectorAll('[role="tab"]')],
      at = tabs.indexOf(e.target);
    tabs[
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (at + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
    ].click();
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    if (e.target.id === "cost-form") {
      if (!costForm.reviewer_id) return;
      intent("/opportunities/" + opp + "/cost-inputs", "POST", {
        ...costForm,
        amount_value: Number(costForm.amount_value),
        observed_at: new Date(costForm.observed_at).toISOString(),
        expected_version: 7,
      });
      costMessage = "隔离成本提交意图已记录；待复核，不替换当前成本。";
      render();
      return;
    }
    if (e.target.id === "review-form") {
      if (reviewReason.trim().length < 2) return;
      intent("/opportunities/" + opp + "/cost-input-reviews/" + reviewId + "/actions", "POST", {
        decision: reviewDecision,
        reason: reviewReason.trim(),
        expected_version: 3,
      });
      costMessage = "隔离复核意图已记录；没有改变真实复核或利润。";
      render();
      return;
    }
    if (e.target.id !== "modal-form") return;
    if (modalKind === "search") intent("/sourcing/searches", "POST", { ...searchForm });
    else if (modalKind === "quote")
      intent("/sourcing/quotes", "POST", {
        candidate_id: modalOffer.id,
        ...quoteForm,
        moq: Number(quoteForm.moq),
        lead_time_days: Number(quoteForm.lead_time_days),
        confidence_value: Number(quoteForm.confidence_value),
        observed_at: new Date(quoteForm.observed_at).toISOString(),
      });
    else if (modalKind === "purchase") {
      if (purchaseForm.reason.trim().length < 2) {
        modalError = "请填写至少两个非空白字符的原因。";
        renderModal();
        focusField();
        return;
      }
      intent("/sourcing/purchase-tasks", "POST", {
        quote_id: modalOffer.quote.id,
        quantity: Number(purchaseForm.quantity),
        reason: purchaseForm.reason.trim(),
      });
    } else {
      if (!deleteReason.trim()) {
        modalError = "删除原因不能只有空白。";
        renderModal();
        focusField();
        return;
      }
      intent("/sourcing/searches/" + record.id, "DELETE", { reason: deleteReason.trim() });
    }
    if (window.sourcingReview.outcome === "error") {
      modalError = "隔离失败样本：输入保留，不自动重放请求。";
      renderModal();
      focusField();
    } else {
      closeModal();
      message = "隔离成功演示：仅记录请求意图，没有真实采集、报价或采购写入。";
      render();
    }
  });
  $("#modal").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
  $("#modal").addEventListener("click", (e) => {
    if (e.target !== $("#modal")) return;
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  });
  $("#modal").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
      ...e.currentTarget.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
      ),
    ].filter((n) => n.getClientRects().length);
    if (!nodes.length) {
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
      e.preventDefault();
      nodes[0].focus();
    }
  });
  $("#scene").innerHTML = scenes.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  window.sourcingReview = { scenes, choose, intents, outcome: "success" };
  choose("workspace");
})();
