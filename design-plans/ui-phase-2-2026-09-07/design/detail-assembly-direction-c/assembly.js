(() => {
  "use strict";
  const D = window.DETAIL_ASSEMBLY_C_DATA;
  const $ = (s) => document.querySelector(s);
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const labels = Object.fromEntries(D.tabs);
  const fields = [
    ["period_start", "统计开始日期", "date"],
    ["period_end", "统计结束日期", "date"],
    ["sales_units", "实际销量", "number", 0, 1e9, 1],
    ["revenue_amount", "实际销售额", "number", 0, 1e12, 0.000001],
    ["ad_spend_amount", "广告花费", "number", 0, 1e12, 0.000001],
    ["returned_units", "退货量", "number", 0, 1e9, 1],
    ["purchase_lead_time_days", "采购交期（天）", "number", 0, 3650, 1],
    ["actual_profit_amount", "实际利润", "number", -1e12, 1e12, 0.000001],
    ["currency", "币种", "text"],
    ["source_ref", "来源编号", "text"],
    ["notes", "核对说明（选填）", "textarea"],
  ];
  const modalNames = {
    observe: "继续观察",
    reject: "驳回机会",
    approved: "AI 抽检通过",
    rejected: "AI 抽检驳回",
  };
  const scenes = Object.fromEntries(D.tabs.map(([key, label]) => [key, `${label} / 同一机会`]));
  Object.assign(scenes, {
    "feedback-draft": "复盘 / 跨分区草稿",
    "observe-dialog": "决定 / 观察原因",
    "reject-dialog": "决定 / 驳回原因",
    "approve-dialog": "AI / 通过原因",
    "ai-reject-dialog": "AI / 驳回原因",
    "decision-failure": "决定 / 失败保留原因",
    "pending-elsewhere": "切区 / AI 请求处理中",
    "failure-elsewhere": "切区 / AI 失败可恢复",
    "unknown-elsewhere": "切区 / 结果未知锁定",
    "ai-read-error": "AI / 读取失败与旧记录",
    "main-read-error": "详情 / 读取失败",
    forbidden: "详情 / 无权限",
    readonly: "结论 / 只读",
    "directory-open": "移动 / 十分区目录",
  });
  let S,
    generation = 0,
    held = false,
    pendingFinish = null,
    opener = null;
  const resolve = (tab) => (Object.hasOwn(labels, tab) ? tab : "overview");
  const line = (a, b) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`;
  const button = (id, text, primary = false) =>
    `<button id="${id}" data-write ${primary ? 'class="primary"' : ""} ${S.busy || S.locked || S.readonly ? "disabled" : ""}>${text}</button>`;
  const empty = (title, description) =>
    `<div class="empty"><h3>${title}</h3><p>${description}</p></div>`;
  function header(text, sub, action = "") {
    return `<div class="section-heading"><div><h2 id="section-title" tabindex="-1">${text}</h2><p>${sub}</p></div>${action ? `<div class="actions">${action}</div>` : ""}</div>`;
  }
  function base() {
    return {
      tab: "overview",
      form: copy(D.defaults),
      formOpen: false,
      modal: null,
      operation: null,
      intents: [],
      busy: false,
      locked: false,
      readonly: false,
      aiRead: "ready",
      scope: "ready",
      nextOutcome: "intent",
      returnIntent: null,
    };
  }
  function updateRoute() {
    const url = new URL(location.href);
    if (S.tab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", S.tab);
    history.replaceState(null, "", url);
  }
  function navigation() {
    $("#navigation").innerHTML = D.tabs
      .map(
        ([key, label], i) =>
          `${i === 0 ? "<p>判断依据</p>" : i === 4 ? "<p>辅助与追溯</p>" : ""}<button data-tab="${key}" ${key === S.tab ? 'aria-current="page"' : ""}>${label}${key === "feedback" && isDirty() ? "（有草稿）" : ""}</button>`,
      )
      .join("");
    $("#current-tab").textContent = labels[S.tab];
  }
  function isDirty() {
    return JSON.stringify(S.form) !== JSON.stringify(D.defaults);
  }
  function operation() {
    const node = $("#operation"),
      o = S.operation;
    if (!o) {
      node.innerHTML = "";
      node.removeAttribute("data-tone");
      return;
    }
    node.dataset.tone = o.status;
    const text = {
      pending: "演示处理中",
      intent: "演示提交已记录",
      error: "演示失败，输入已保留",
      unknown: "演示结果未知，暂停重复提交",
    }[o.status];
    node.innerHTML = `<strong>${labels[o.origin]}：${text}</strong><p>${o.status === "pending" ? "可以继续阅读其他分区；关闭弹窗或切换页面不等于取消请求。" : o.status === "intent" ? "未发送任何接口请求，也没有生成新事实。本次草稿保留供核对。" : o.status === "unknown" ? "不能据此断言未写入。真实实现需要核对结果；本离线样例只能通过切换审稿场景重新开始。" : "这是隔离的失败演示，未写入业务。回到原操作后可显式重试。"}</p><div class="actions"><button id="operation-origin">回到${labels[o.origin]}</button>${o.modal && o.status === "error" && !$("#reason-dialog").open ? '<button id="restore-reason">恢复原因</button>' : ""}</div>`;
    $("#operation-origin").onclick = () => setTab(o.origin);
    if ($("#restore-reason"))
      $("#restore-reason").onclick = () => {
        setTab(o.origin);
        openReason(o.modal.kind, true);
      };
  }
  function overview() {
    const d = D.facts.detail;
    return (
      header("结论", "先确认依据完整度，再决定是否提前人工处理。") +
      `<div class="lead"><h3>待判断，尚无可靠推荐结论</h3><p>评分、利润和风险依据仍不足。当前样例不满足采纳条件，AI 输出也不能替代这些依据。</p><div class="actions"><button data-jump="evidence" class="primary">核对证据</button><button data-jump="profit">查看成本缺项</button></div></div>
      <div class="fact-grid"><section><h3>当前事实</h3><dl class="list">${line("综合评分", d.overall_score ?? "未提供")}${line("证据汇总", `${d.evidence_count} 条 / ${d.source_count} 个来源`)}${line("基础覆盖", "部分完整")}${line("风险等级", "待识别")}</dl><p class="muted">更新时间：2026-08-08 20:00（北京时间）。这是固定历史样例，不是最新生产记录。</p></section>
      <section><h3>人工判断</h3><p class="notice">五项质量门与选择阶段未随此夹具提供。采纳保持不可用，不把缺失字段解释为已通过。</p>${S.readonly ? "<p>当前仅允许读取，不显示写入操作。</p>" : `<details id="early"><summary>提前人工处理</summary><p class="muted">观察与驳回也必须记录原因，不改写原始评分。</p><div class="actions">${button("observe", "继续观察")}${button("reject", "驳回")}</div></details>`}</section></div>`
    );
  }
  function profit() {
    return (
      header("利润与成本", "计算快照与已确认输入分开核对。") +
      `<div class="lead"><h3>数据不足，不能生成可靠 ROI</h3><p>当前机会没有利润运行快照，也没有当前生效成本输入。</p></div><dl class="list">${line("最新运行", "未生成")}${line("生效输入", `${D.profit.current_inputs.length} 项`)}${line("净利润 / 净利率", "不可计算，不显示零值")}</dl><section class="section-block"><h3>计算口径</h3><p>含税销售价减去采购、物流、平台费、支付手续费、税费和已知履约成本。这里只说明既有口径，不在浏览器中补价或重算。</p></section><p class="notice">此样例未授予 cost:confirm，不提供成本提交、复核或利润排队入口。成本九字段与复核状态仍保留在独立利润稿中，未借用其金额。</p>`
    );
  }
  function ai() {
    const a = D.facts.analyses[0],
      r = a.result;
    return (
      header(
        "AI 辅助",
        "输出不能替代事实、评分、利润或人工决策。",
        S.readonly ? "" : button("queue-ai", "生成辅助分析", true),
      ) +
      (S.aiRead === "error"
        ? '<div class="notice error"><h3>本次读取失败</h3><p>下方是上次读取的旧记录，不代表本次读取成功。抽检暂不可用。</p><button id="retry-ai">重试读取</button></div>'
        : "") +
      `<article class="review-output"><p>已完成生成 / 待人工抽检</p><h3>原始摘要</h3><p id="ai-summary">${esc(r.content.summary)}</p><h3>${esc(r.content.classifications[0].label)}</h3><p>${esc(r.content.classifications[0].rationale)}</p><p class="refs">引用：${esc(r.content.classifications[0].source_refs[0])}</p><h3>缺失项：利润</h3><p>${esc(r.content.missing_fields[0].reason)}</p></article>
      <div class="actions">${!S.readonly && S.aiRead === "ready" ? button("approved", "抽检通过") + button("rejected", "抽检驳回") : ""}<button data-jump="profit">核对利润依据</button></div>
      <details class="technical"><summary>模型与追溯信息</summary><dl class="list">${line("请求 ID", a.id)}${line("结果 ID", r.id)}${line("模型", r.model_name)}${line("提示词合同", a.prompt_contract_version)}${line("输入哈希", a.input_sha256)}</dl></details>`
    );
  }
  function feedback() {
    return (
      header("经营复盘", "实际经营事实与历史预测分开保留。") +
      `<div class="notice"><h3>该样例未提供复盘字段</h3><p>无法确认是否已有历史记录，不能显示为“0 条”或补用其他机会的校准结果。</p></div>` +
      (S.readonly
        ? ""
        : `<div class="actions"><button id="toggle-feedback" aria-expanded="${S.formOpen}" class="primary">${S.formOpen ? "收起录入" : "录入经营事实"}</button>${isDirty() ? '<span class="muted">本次草稿已保留，仅当前页面有效</span>' : ""}</div>`) +
      (S.formOpen
        ? `<form id="feedback-form"><p class="notice">新录入草稿的默认 0 是待核对输入，不是已发生的销量或利润。本稿只演示提交，不创建事实记录。</p><div class="fields">${fields.map(([key, label, type, min, max, step]) => `<label ${key === "source_ref" || key === "notes" ? 'class="wide"' : ""} for="f-${key}">${label}${type === "textarea" ? `<textarea id="f-${key}" name="${key}" maxlength="1000" rows="3">${esc(S.form[key])}</textarea>` : `<input id="f-${key}" name="${key}" type="${type}" value="${esc(S.form[key])}" required ${type === "number" ? `min="${min}" max="${max}" step="${step}"` : key === "currency" ? 'maxlength="3" pattern="[A-Za-z]{3}"' : key === "source_ref" ? 'maxlength="255"' : ""}>`}</label>`).join("")}</div><p id="feedback-error" class="field-error" role="alert"></p><div class="actions">${button("submit-feedback", "演示提交经营事实", true)}</div></form>`
        : "")
    );
  }
  function content() {
    if (S.scope !== "ready")
      return (
        header(
          S.scope === "forbidden" ? "无权读取该机会" : "详情读取失败",
          "身份栏仅用于定位历史样例，不是当前读取成功的证明。",
        ) +
        empty(
          "业务内容未展示",
          S.scope === "forbidden"
            ? "请由有权限的成员核对访问范围。当前审稿不会授予新权限。"
            : "没有把读取失败显示成空机会。",
        ) +
        (S.scope === "error" ? '<button id="retry-main">重试读取样例</button>' : "")
      );
    const d = D.facts.detail;
    if (S.tab === "overview") return overview();
    if (S.tab === "profit") return profit();
    if (S.tab === "ai") return ai();
    if (S.tab === "feedback") return feedback();
    if (S.tab === "evidence")
      return (
        header("证据", "汇总数量与本次返回的明细分别展示。") +
        `<dl class="list">${line("机会汇总", `${d.evidence_count} 条证据 / ${d.source_count} 个来源`)}${line("返回明细", `${d.evidence.length} 条`)}</dl>` +
        empty(
          "本次没有可展开的明细",
          "汇总为 1，但数组为空；保留差异，不造原文链接，也不宣称没有证据。",
        ) +
        '<button data-jump="market">查看市场覆盖状态</button>'
      );
    if (S.tab === "market")
      return (
        header("市场", "先看已有覆盖，再核对支持结论的证据。") +
        `<dl class="list">${line("市场", d.market)}${line("市场分区状态", "已覆盖（covered）")}${line("趋势评分", "未提供")}${line("整体证据汇总", "1 条 / 1 个来源；非市场增长指标")}</dl>` +
        empty(
          "尚无增长或销量序列",
          "本夹具没有曲线、时间窗口或销量字段，不把分区覆盖状态换算成趋势结论。",
        ) +
        '<button data-jump="evidence">核对证据明细</button>'
      );
    if (S.tab === "competition")
      return (
        header("竞争", "读取权限与竞争覆盖状态分别展示。") +
        `<dl class="list">${line("竞争覆盖", "待补充数据")}${line("竞争评分", "未提供")}</dl>` +
        empty(
          "未授予竞品与供应链读取权限",
          "该样例仅有机会读取与决定能力，不展示竞品价格、供应候选数量或采集按钮。无权限不是 0 条结果。",
        )
      );
    if (S.tab === "risk")
      return (
        header("风险", "未知不等于低风险，覆盖不等于结论。") +
        `<div class="lead"><h3>风险待识别</h3><p>当前风险等级 unknown，风险分区 insufficient_data。</p></div>` +
        empty(
          "未提供逐项风险事实",
          "合规、侵权、供应、趋势、利润和数据质量没有逐项事实时，不画六个安全勾选。",
        ) +
        '<div class="actions"><button data-jump="evidence">核对证据</button><button data-jump="lineage">查看业务血缘</button></div>'
      );
    if (S.tab === "lineage")
      return (
        header("业务血缘", "节点必须来自当前机会，不能跨样例拼接。") +
        empty(
          "该样例未提供血缘字段",
          "节点、新鲜度和影响范围均未知。没有导入另一条 opportunity-1 的来源与任务，也没有画出无依据的因果链。",
        ) +
        '<button data-jump="evidence">返回证据核对</button>'
      );
    return (
      header("决策历史", "人工决定独立记录，不覆盖原始事实。") +
      empty(
        "尚无决策记录",
        "当前夹具明确返回 decisions: []。观察、驳回和 AI 抽检的演示提交都不会伪造一条历史。",
      ) +
      '<button data-jump="overview">返回结论</button>'
    );
  }
  function render() {
    navigation();
    $("#work").innerHTML = content();
    $("#context-status").textContent =
      S.scope === "ready"
        ? "待判断 / 待补充数据"
        : S.scope === "forbidden"
          ? "无权限 / 业务内容已隐藏"
          : "读取失败 / 业务内容已隐藏";
    operation();
    bind();
  }
  function setTab(tab, focus = true) {
    S.tab = resolve(tab);
    updateRoute();
    render();
    if (innerWidth <= 700) $("#directory").open = false;
    if (focus) $("#section-title").focus();
  }
  function bind() {
    document
      .querySelectorAll("[data-tab],[data-jump]")
      .forEach((b) => (b.onclick = () => setTab(b.dataset.tab || b.dataset.jump)));
    for (const kind of Object.keys(modalNames))
      if ($(`#${kind}`)) $(`#${kind}`).onclick = () => openReason(kind);
    if ($("#queue-ai")) $("#queue-ai").onclick = () => submit(copy(D.reviewIntents.queue), "ai");
    if ($("#retry-ai"))
      $("#retry-ai").onclick = () => {
        S.aiRead = "ready";
        render();
        $("#section-title").focus();
      };
    if ($("#retry-main"))
      $("#retry-main").onclick = () => {
        S.scope = "ready";
        render();
        $("#section-title").focus();
      };
    if ($("#toggle-feedback"))
      $("#toggle-feedback").onclick = () => {
        S.formOpen = !S.formOpen;
        render();
        $("#toggle-feedback").focus();
      };
    if ($("#feedback-form")) {
      $("#feedback-form").oninput = (e) => {
        if (!e.target.name) return;
        S.form[e.target.name] =
          e.target.type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value;
        for (const n of $("#feedback-form").querySelectorAll("input")) n.setCustomValidity("");
        $("#feedback-error").textContent = "";
        navigation();
        document
          .querySelectorAll("[data-tab]")
          .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
      };
      $("#feedback-form").onsubmit = (e) => {
        e.preventDefault();
        let key, message;
        if (S.form.period_end < S.form.period_start) {
          key = "period_end";
          message = "结束日期不能早于开始日期。";
        } else if (S.form.returned_units > S.form.sales_units) {
          key = "returned_units";
          message = "退货量不能超过实际销量。";
        } else if (!S.form.source_ref.trim()) {
          key = "source_ref";
          message = "请填写有效来源编号。";
        }
        if (key) {
          $("#feedback-error").textContent = message;
          $(`#f-${key}`).setCustomValidity(message);
          $(`#f-${key}`).reportValidity();
          return;
        }
        const body = {
          ...copy(S.form),
          currency: S.form.currency.toUpperCase(),
          expected_version: D.facts.detail.version,
          observed_at: D.fixedNow,
        };
        submit({ method: "POST", path: D.feedbackIntent.path, body }, "feedback");
      };
    }
  }
  function locks() {
    $("#reason").readOnly = S.busy || S.locked;
    document
      .querySelectorAll("[data-write]")
      .forEach((b) => (b.disabled = S.busy || S.locked || S.readonly));
    $("#submit-reason").disabled = S.busy || S.locked || !validReason();
  }
  function validReason() {
    return (
      S.modal &&
      S.modal.reason.trim().length >=
        (S.modal.kind === "observe" || S.modal.kind === "reject" ? 1 : 2)
    );
  }
  function openReason(kind, restore = false) {
    if (S.busy || S.locked || S.readonly) return;
    opener = document.activeElement;
    const old = restore ? S.operation?.modal : null;
    S.modal = old
      ? copy(old)
      : { kind, reason: "", origin: kind === "observe" || kind === "reject" ? "overview" : "ai" };
    $("#reason-title").textContent = modalNames[kind];
    $("#reason-target").textContent = D.facts.detail.name;
    $("#reason-help").textContent =
      S.modal.origin === "ai"
        ? "只记录抽检结论和原因，不改写 AI 原始输出。"
        : "人工决定独立记录，不改写评分和证据。";
    $("#reason-hint").textContent =
      S.modal.origin === "ai"
        ? "去除首尾空格后至少 2 字，最多 1000 字。"
        : "填写原因，最多 1000 字；请求保留原始输入。";
    $("#reason").value = S.modal.reason;
    $("#reason-error").textContent = "";
    $("#reason-dialog").showModal();
    locks();
    $("#reason").focus();
    operation();
  }
  function closeReason() {
    if (S.operation?.status === "error" && S.operation.modal?.kind === S.modal?.kind)
      S.operation.modal = copy(S.modal);
    $("#reason-dialog").close();
    if (!S.busy && S.operation?.status !== "error" && S.operation?.status !== "unknown")
      S.modal = null;
    operation();
    if (opener?.isConnected && !opener.disabled) opener.focus();
    else $("#section-title")?.focus();
  }
  function submit(intent, origin, modal = null) {
    if (S.busy || S.locked || S.readonly || !intent) return;
    const epoch = generation,
      outcome = S.nextOutcome;
    S.nextOutcome = "intent";
    S.intents.push(copy(intent));
    S.busy = true;
    S.operation = { origin, status: "pending", modal: modal ? copy(modal) : null };
    locks();
    operation();
    let completed = false;
    const finish = () => {
      if (completed || epoch !== generation) return;
      completed = true;
      S.busy = false;
      S.operation.status = outcome;
      S.locked = outcome === "unknown";
      if (outcome === "intent" && $("#reason-dialog").open) closeReason();
      if ((outcome === "error" || outcome === "unknown") && $("#reason-dialog").open)
        $("#reason-error").textContent =
          outcome === "error" ? "演示失败，原因保留，可显式重试。" : "演示结果未知，暂停重复提交。";
      locks();
      operation();
    };
    pendingFinish = finish;
    if (!held) setTimeout(finish, 180);
  }
  function scene(name, initial = false) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown review scene");
    generation++;
    $("#return").textContent = "返回来源";
    $("#return").removeAttribute("title");
    pendingFinish = null;
    held = false;
    S = base();
    if ($("#reason-dialog").open) $("#reason-dialog").close();
    S.tab = Object.hasOwn(labels, name) ? name : "overview";
    if (name === "readonly") S.readonly = true;
    if (name === "forbidden") S.scope = "forbidden";
    if (name === "main-read-error") S.scope = "error";
    if (name === "feedback-draft") {
      S.tab = "feedback";
      S.formOpen = true;
      S.form.source_ref = "审稿草稿，不是经营事实";
      S.form.notes = "切到风险再返回，这段说明应保留。";
    }
    if (name === "ai-read-error") {
      S.tab = "ai";
      S.aiRead = "error";
    }
    const modalKind = {
      "observe-dialog": "observe",
      "reject-dialog": "reject",
      "approve-dialog": "approved",
      "ai-reject-dialog": "rejected",
      "decision-failure": "observe",
    }[name];
    if (modalKind) S.tab = ["observe", "reject"].includes(modalKind) ? "overview" : "ai";
    if (name.endsWith("elsewhere")) {
      S.tab = "risk";
      S.operation = {
        origin: "ai",
        status: name.startsWith("pending")
          ? "pending"
          : name.startsWith("unknown")
            ? "unknown"
            : "error",
        modal: { kind: "approved", reason: D.reviewReason, origin: "ai" },
      };
      S.busy = S.operation.status === "pending";
      S.locked = S.operation.status === "unknown";
    }
    if (initial) S.tab = resolve(new URL(location.href).searchParams.get("tab"));
    $("#scene").value = name;
    $("#directory").open = innerWidth > 700 || name === "directory-open";
    updateRoute();
    render();
    if (modalKind) {
      openReason(modalKind);
      S.modal.reason = S.modal.origin === "ai" ? D.reviewReason : D.reason;
      $("#reason").value = S.modal.reason;
      locks();
      if (name === "decision-failure") {
        S.operation = { origin: "overview", status: "error", modal: copy(S.modal) };
        $("#reason-error").textContent = "演示失败，原因保留，可显式重试。";
        operation();
      }
    }
    window.scrollTo(0, 0);
  }
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  $("#identity-title").textContent = D.facts.detail.name;
  $("#return").onclick = () => {
    const from = new URL(location.href).searchParams.get("from");
    S.returnIntent =
      typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
        ? from
        : "/opportunities";
    $("#return").textContent = "已记录返回意图";
    $("#return").title = S.returnIntent;
  };
  $("#reason").oninput = () => {
    S.modal.reason = $("#reason").value;
    $("#reason-error").textContent = "";
    locks();
  };
  $("#reason-form").onsubmit = (e) => {
    e.preventDefault();
    if (!validReason()) return;
    const m = S.modal;
    const intent =
      m.origin === "ai"
        ? { ...copy(D.reviewIntents[m.kind]), body: { outcome: m.kind, notes: m.reason.trim() } }
        : {
            ...copy(D.decisions[m.kind]),
            body: { action: m.kind, reason: m.reason, expected_version: D.facts.detail.version },
          };
    submit(intent, m.origin, m);
  };
  $("#close-reason").onclick = closeReason;
  $("#cancel-reason").onclick = closeReason;
  $("#reason-dialog").oncancel = (e) => {
    e.preventDefault();
    closeReason();
  };
  $("#reason-dialog").onkeydown = (e) => {
    if (e.key !== "Tab") return;
    const items = [
      ...$("#reason-dialog").querySelectorAll("button:not(:disabled),textarea"),
    ].filter((n) => n.getClientRects().length);
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  window.DETAIL_ASSEMBLY_C = {
    scenes,
    scene,
    state: () => copy(S),
    outcome: (v) => {
      if (!["intent", "error", "unknown"].includes(v)) throw Error("outcome");
      S.nextOutcome = v;
    },
    hold: (v) => {
      held = v;
    },
    finish: () => {
      const fn = pendingFinish;
      pendingFinish = null;
      fn?.();
    },
  };
  scene("overview", true);
})();
