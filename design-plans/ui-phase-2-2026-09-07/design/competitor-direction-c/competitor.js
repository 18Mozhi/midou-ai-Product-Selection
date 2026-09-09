/* Offline C-direction review. All records and outcomes below are synthetic, never HTTP/storage. */
(() => {
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const scenes = [
    ["directory", "P19", "竞品目录与证据"],
    ["partial", "P19", "字段缺失与币种未知"],
    ["pending", "P19", "首次采集排队"],
    ["collect-busy", "P19", "采集请求提交中"],
    ["running", "P19", "采集进行中"],
    ["blocked-captcha", "P19", "验证码阻塞"],
    ["terminal", "P19", "采集失败无快照"],
    ["paused", "P19", "暂停监控"],
    ["toggle-busy", "P19", "暂停请求提交中"],
    ["resume-busy", "P19", "恢复请求提交中"],
    ["task-busy", "P19", "价格验证任务提交中"],
    ["review-task-busy", "P19", "评论验证任务提交中"],
    ["task-created", "P19", "价格验证任务已返回ID"],
    ["readonly", "P19", "只读角色"],
    ["task-only", "P19", "独立任务权限"],
    ["deep-link", "P19", "深链优先搜索"],
    ["search-empty", "P19", "搜索无结果"],
    ["empty", "P19", "首次空目录"],
    ["loading", "P19", "目录读取中"],
    ["error", "P19", "目录读取失败"],
    ["expired", "P19", "会话过期"],
    ["forbidden", "P19", "无读取权限"],
    ["rate-limited", "P19", "来源限流"],
    ["detail-error", "P19", "详情失败保留目录"],
    ["rules-unknown", "P19", "规则读取未知"],
    ["history-window", "P19", "历史窗口边界"],
    ["alerts-mixed", "P19", "提醒与任务分离"],
    ["create-link", "P19", "添加 / 商品链接"],
    ["create-market", "P19", "添加 / 市场信息"],
    ["create-confirm", "P19", "添加 / 确认"],
    ["create-error", "P19", "添加 / 失败保留"],
    ["create-busy", "P19", "添加 / 提交中"],
    ["delete", "P19", "删除 / 保留历史"],
    ["delete-error", "P19", "删除 / 版本冲突"],
    ["delete-busy", "P19", "删除 / 提交中"],
    ["rules", "P20", "监控规则目录"],
    ["rules-empty", "P20", "无监控规则"],
    ["rules-disabled", "P20", "只有停用规则"],
    ["rules-no-objects", "P20", "对象空但规则仍存在"],
    ["rules-error", "P20", "规则读取失败"],
    ["rules-loading", "P20", "规则读取中"],
    ["rules-readonly", "P20", "只读规则目录"],
    ["rule-global", "P20", "规则 / 工作区价格"],
    ["rule-target", "P20", "规则 / 指定竞品"],
    ["rule-availability", "P20", "规则 / 库存"],
    ["rule-error", "P20", "规则 / 失败保留"],
    ["rule-busy", "P20", "规则 / 提交中"],
    ...["deep-ocean", "cloud-white", "aurora-purple"].flatMap((theme) =>
      ["standard", "compact"].map((density) => [
        theme + "-" + density,
        "P19",
        theme + " / " + density,
      ]),
    ),
  ].map(([id, pageId, label]) => ({ id, pageId, label }));
  const competitorId = "00000000-0000-4000-8000-000000000019",
    taskId = "00000000-0000-4000-8000-000000000023";
  const objects = [
    {
      id: competitorId,
      title: "桌面收纳托盘 · 胡桃木色",
      external_id: "B000000019",
      source_site: "amazon.com",
      market: "US",
      price: "USD 28.00",
      status: "监控中",
    },
    {
      id: "00000000-0000-4000-8000-000000000020",
      title: "分层文件收纳架 · 亚光黑",
      external_id: "B000000020",
      source_site: "amazon.co.uk",
      market: "UK",
      price: "GBP 32.50",
      status: "监控中",
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      title: "模块化桌面笔架",
      external_id: "B000000021",
      source_site: "amazon.com",
      market: "US",
      price: "等待首次采集",
      status: "监控中",
    },
  ];
  const rules = [
    {
      target: null,
      metric: "价格",
      direction: "减少",
      threshold: "1",
      status: "已生效",
      revision: 2,
    },
    {
      target: competitorId,
      metric: "库存",
      direction: "变为缺货",
      threshold: null,
      status: "已生效",
      revision: 1,
    },
    {
      target: "removed",
      metric: "评论数",
      direction: "增加",
      threshold: "10",
      status: "已停用",
      revision: 4,
    },
  ];
  let current,
    selected = objects[0],
    search = "",
    deep = false,
    modalKind = "",
    step = 1,
    opener,
    busy = false,
    collectionSubmitting = false,
    objectPending = null,
    feedback = "",
    formError = "",
    taskCreated = {};
  let createForm,
    ruleForm,
    reason = "";
  const intents = [];
  const button = (id, text, cls = "", disabled = false, submitting = false) =>
    `<button type="button" data-action="${id}" class="${cls}" ${disabled ? "disabled" : ""} ${submitting ? 'aria-busy="true"' : ""}>${text}</button>`;
  const pendingFor = (id) => objectPending?.id === selected.id && objectPending.action === id;
  const objectButton = (id, text, cls = "") =>
    button(
      id,
      pendingFor(id) ? (id === "CP-TOGGLE" ? "正在提交启停…" : "正在创建任务…") : text,
      cls,
      Boolean(objectPending) || collectionSubmitting,
      pendingFor(id),
    );
  const link = (id, text, href) => `<a data-action="${id}" class="link" href="${href}">${text}</a>`;
  const badge = (text, good = false) => `<span class="badge ${good ? "good" : ""}">${text}</span>`;
  const is = (...ids) => ids.includes(current.id);
  const manager = () => !is("readonly", "task-only", "rules-readonly");
  const taskPermission = () => !is("readonly", "rules-readonly");
  const rulesPage = () => current.pageId === "P20";
  const note = (title, text, cls = "") =>
    `<section class="notice ${cls}"><strong>${title}</strong><p>${text}</p></section>`;
  function choose(id) {
    if ($("#modal").open) $("#modal").close();
    current = scenes.find((s) => s.id === id);
    if (!current) throw new Error("Unknown scene");
    selected = { ...objects[0] };
    search = is("search-empty", "deep-link") ? "不存在的标题" : "";
    deep = is("deep-link");
    modalKind = "";
    busy = false;
    collectionSubmitting = is("collect-busy");
    objectPending = is("toggle-busy", "resume-busy", "task-busy", "review-task-busy")
      ? {
          id: selected.id,
          title: selected.title,
          action: is("toggle-busy", "resume-busy")
            ? "CP-TOGGLE"
            : is("review-task-busy")
              ? "CP-TASK-CREATE-REVIEW"
              : "CP-TASK-CREATE",
        }
      : null;
    feedback = "";
    formError = "";
    taskCreated = is("task-created") ? { [selected.id + ":price"]: true } : {};
    reason = "";
    step = 1;
    createForm = {
      product_url: "https://www.amazon.com/dp/B000000019",
      market: "US",
      title: "桌面收纳托盘 · 胡桃木色",
      opportunity_id: "",
    };
    ruleForm = { competitor_id: "", metric: "price", direction: "decrease", threshold_value: 1 };
    if (is("paused", "resume-busy")) selected.status = "已暂停";
    if (is("partial")) selected.price = "价格未采到";
    document.documentElement.dataset.theme = id.startsWith("cloud-white")
      ? "cloud-white"
      : id.startsWith("aurora-purple")
        ? "aurora-purple"
        : "deep-ocean";
    document.documentElement.dataset.density = id.endsWith("compact") ? "compact" : "standard";
    $("#scene").value = id;
    render();
    if (id.startsWith("create-")) {
      step = id === "create-link" ? 1 : id === "create-market" ? 2 : 3;
      openModal("create", true);
    } else if (id.startsWith("delete")) openModal("delete", true);
    else if (id.startsWith("rule-")) {
      if (is("rule-target", "rule-availability")) ruleForm.competitor_id = competitorId;
      if (is("rule-availability"))
        Object.assign(ruleForm, { metric: "availability", direction: "became_unavailable" });
      openModal("rule", true);
    }
  }
  function emptyPanel(title, description, action, label) {
    return `<section class="empty"><div class="symbol" aria-hidden="true">◇</div><h2>${title}</h2><p>${description}</p>${action ? button(action, label, "primary") : ""}</section>`;
  }
  function render() {
    const rp = rulesPage();
    $("#app").innerHTML =
      `<header class="identity"><span class="brand">Scout<i>Ops</i></span><span class="meta">样本组织 / 桌面收纳工作区</span></header><div class="layout"><aside class="scope"><div><p class="eyebrow">竞争观察</p><h2>看清每一次变化</h2><p>当前工作区的竞品、快照与显式阈值。</p></div>${manager() ? button(rp ? "CP-RULE-OPEN" : "CP-CREATE-OPEN", rp ? "＋ 新建监控规则" : "＋ 添加竞品", "primary") : "<p>只读监控权限</p>"}<nav aria-label="竞品页面">${link("CP-RULE-BACK", "竞品目录", "/competitors")}${link("CP-RULE-NAV", "监控规则", "/competitors/monitoring-rules")}</nav><div class="scope-foot">仅展示采集事实。<br>监控就绪不等于机会已通过竞争质量门。<br><br>样本数据 · 不连接生产</div></aside><main class="workspace"><div class="heading"><div><p class="eyebrow">${rp ? "规则范围 / 阈值 / 状态" : "目录 / 变化 / 原始证据"}</p><h1>${rp ? "让每一次提醒有据可依" : "竞品发生了什么变化？"}</h1><p>${rp ? "先确认适用对象，再读指标与阈值。" : "选择一个监控对象，从最近变化追到对应快照。"}</p></div>${badge(rp ? "P20 · 独立规则页面" : "P19 · 竞品目录")}</div>${feedback ? `<div class="toast" role="status">${esc(feedback)}</div>` : ""}${objectPending ? `<section class="notice info" data-object-operation="${objectPending.id}" aria-busy="true"><strong>正在为“${esc(objectPending.title)}”提交${objectPending.action === "CP-TOGGLE" ? "启停" : "验证任务"}请求</strong><p>尚未确认结果；当前请求结束前，竞品详情内的其他写入入口暂不可用。切换查看对象不会改变本次提交目标。</p></section>` : ""}${content()}<p class="artifact-note">COMPETITOR-C-r1 · ${esc(current.label)} · 合成合同样本，不是实际监控结果。设计提案待审核。</p></main></div>`;
    $(`[data-action="${rp ? "CP-RULE-NAV" : "CP-RULE-BACK"}"]`).setAttribute(
      "aria-current",
      "page",
    );
  }
  function content() {
    if (is("loading", "rules-loading"))
      return `<section class="rules" aria-busy="true" aria-label="正在读取"><h2>正在读取${rulesPage() ? "规则" : "竞品"}</h2><div class="loading"></div><div class="loading"></div><p class="meta">数据未知，不提前显示零条。</p></section>`;
    const errors = {
      error: ["竞品目录未能读取", "请重试，尚不能确认目录为空。", "CP-STATE-PRIMARY", "重新读取"],
      "rules-error": [
        "规则暂时无法读取",
        "不能据此判断没有规则，启用状态也暂不可确认。",
        "CP-STATE-PRIMARY",
        "重新读取",
      ],
      expired: ["登录状态已过期", "重新登录后返回当前竞品页面。", "CP-STATE-PRIMARY", "重新登录"],
      forbidden: [
        "没有此页面的读取权限",
        "请联系管理员核对当前工作区权限。",
        "CP-STATE-PRIMARY",
        "返回工作台",
      ],
    };
    if (errors[current.id]) return emptyPanel(...errors[current.id]);
    if (rulesPage()) return ruleDirectory();
    if (is("empty"))
      return emptyPanel(
        "建立第一个竞品观察对象",
        "填写公开商品链接和市场，首个快照只建立比较起点。",
        manager() ? "CP-CREATE-OPEN" : "CP-STATE-PRIMARY",
        manager() ? "添加竞品" : "刷新数据",
      );
    const filtered = deep
      ? [selected]
      : objects.filter((o) =>
          [o.title, o.external_id, o.source_site].some((v) =>
            v.toLowerCase().includes(search.toLowerCase().trim()),
          ),
        );
    return `${is("rules-unknown") ? note("规则状态未知", "竞品目录可用，但规则读取失败；不显示“零条生效规则”，请重新读取。", "info") + button("CP-STATE-PRIMARY", "重新读取") : ""}<div class="directory"><aside class="objects"><label class="search">搜索竞品<input id="search" data-action="CP-SEARCH" type="search" placeholder="标题、ASIN、来源站点" value="${esc(search)}" /></label><p class="meta">${filtered.length} 个匹配对象${deep ? " · 深链对象优先" : ""}</p>${filtered.map((o) => `<button type="button" class="object" data-action="CP-DETAIL" data-object="${o.id}" aria-pressed="${selected.id === o.id}"><strong>${esc(o.title)}</strong><small>${o.source_site} · ${o.market}</small><span class="object-price">${o.id === selected.id ? esc(selected.price) : o.price}</span><small>${o.id === selected.id ? selected.status : o.status} · 查看详情 →</small></button>`).join("")}</aside><article class="detail">${!filtered.length ? emptyPanel("没有匹配的竞品", "只搜索标题、ASIN 和来源站点，不扩大到其他字段。", "CP-SEARCH-CLEAR", "清空搜索") : detail()}</article></div><details class="help" data-action="CP-HELP"><summary>帮助：从公开链接到变化提醒</summary><p>添加链接 → 首个真实快照 → 后续变化 → 达到显式阈值才排队通知与任务。没有触发记录不代表已发送提醒。</p></details>`;
  }
  function detail() {
    const pending = is("pending", "running"),
      noSnapshot = is("pending", "terminal") || selected.id === objects[2].id,
      partial = is("partial"),
      second = selected.id === objects[1].id;
    const sourceUrl = `https://www.${selected.source_site}/dp/${selected.external_id}`;
    let status = "";
    if (is("pending", "running", "blocked-captcha", "terminal", "rate-limited")) {
      const text = {
        pending: ["首次采集已排队", "尚未形成快照；受理不等于采集成功。"],
        running: ["正在采集", "真实页面将每 2 秒读取任务状态；本图为固定样本，不运行轮询。"],
        "blocked-captcha": ["验证码阻塞", "请检查来源后重试；已有快照不代表本次成功。"],
        terminal: ["采集失败，尚无可用快照", "请检查公开链接和来源状态，再重新尝试。"],
        "rate-limited": ["来源限流", "等待来源恢复后重试，不自动增加采集频率。"],
      }[current.id];
      status = note(text[0], text[1] + "<br><code>任务 synthetic-collection-19</code>");
    }
    return `<div class="detail-head"><div><p class="meta">${selected.market} · ${selected.source_site} / ${selected.external_id}</p><h2>${esc(selected.title)}</h2><a class="source" data-action="CP-SOURCE" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">打开来源商品 ↗ <span class="meta">（新窗口）</span></a></div>${badge(selected.status, selected.status === "监控中")}</div><div class="actions">${manager() ? button("CP-COLLECT", collectionSubmitting ? "正在提交采集…" : selected.status === "已暂停" ? "恢复后可采集" : pending ? "采集中…" : noSnapshot ? "重新尝试首次采集" : "立即采集", "primary", collectionSubmitting || Boolean(objectPending) || pending || selected.status === "已暂停", collectionSubmitting) : ""}${link("CP-RULE-NAV-CURRENT", "当前竞品规则", "/competitors/monitoring-rules?competitor=" + selected.id)}${manager() ? `<details data-action="CP-MORE"><summary>更多操作</summary><div class="menu">${objectButton("CP-TOGGLE", selected.status === "已暂停" ? "恢复监控" : "暂停监控")}${objectButton("CP-DELETE-OPEN", "删除竞品监控", "danger")}</div></details>` : ""}</div>${status}${is("detail-error") ? note("详情暂不可用", "目录信息保留；不把旧详情标成刚刚更新。", "error") + button("CP-DETAIL-RETRY", "重读当前详情") : ""}${noSnapshot ? emptyPanel("等待第一个真实快照", "价格、排名、评论、评分和库存尚未采到，不用示例值补齐。") : `<section class="evidence" aria-label="当前快照"><p class="meta">当前快照 / 原始采集事实</p><p class="price">${partial ? "价格未采到" : esc(selected.price)}</p><div class="facts"><div><small>排名</small><b>${partial ? "未采到" : "#126"}</b></div><div><small>评论 / 评分</small><b>${partial ? "0 / 未采到" : "86 / 4.3"}</b></div><div><small>库存</small><b>${partial ? "未知" : "有货"}</b></div></div><footer><span class="meta">${partial ? "来源异常 · 时效未知 · 币种未采到" : "来源正常 · 新鲜"} · 2026-09-09 08:00</span><code>证据 synthetic-evidence-${second ? "uk" : "us"}-19</code></footer></section><section aria-label="变化与提醒"><div class="section-heading"><h3>最近变化</h3><small>事实、提醒与任务分别展示</small></div><article class="event"><div class="event-title"><strong>价格变化</strong><time class="meta">09-09 08:00</time></div><p class="delta">${partial ? "币种未采到" : second ? "GBP" : "USD"} ${second ? "35.00 → 32.50" : "30.00 → 28.00"}</p><p>影响说明：记录到价格下降，需结合原始证据复核。</p><div class="status-line">${badge(is("alerts-mixed") ? "系统通知：发送失败" : "系统通知：待发送")}${badge(is("alerts-mixed") ? "系统任务：已创建" : "系统任务：待创建")}</div><code>证据 synthetic-evidence-${second ? "uk" : "us"}-19</code>${taskCreated[selected.id + ":price"] ? link("CP-TASK-LINK", "打开验证任务", "/tasks?task=" + taskId) : taskPermission() ? objectButton("CP-TASK-CREATE", "生成验证任务") : "<p class='meta'>只读：无创建任务权限</p>"}</article><article class="event"><div class="event-title"><strong>评论数变化</strong><time class="meta">09-08 16:00</time></div><p>85 → 86</p><p class="meta">说明：评论数增加 1；未匹配到触发提醒记录。</p>${badge("无关联提醒 · 不声称已通知")}<code>证据 synthetic-evidence-18</code>${taskCreated[selected.id + ":review"] ? link("CP-TASK-LINK", "打开评论验证任务", "/tasks?task=" + taskId) : taskPermission() ? objectButton("CP-TASK-CREATE-REVIEW", "生成评论验证任务") : "<p class='meta'>只读：无创建任务权限</p>"}</article></section>`}<section class="history" aria-label="采集快照"><div class="section-heading"><h3>采集快照</h3><small>${is("history-window") ? "返回窗口 100 条 / 最多 100 条" : noSnapshot ? "尚无快照" : "样本返回 2 条 / 最多 100 条"}</small></div>${noSnapshot ? "<p class='meta'>首次真实快照尚未形成。</p>" : `<div class="snapshot"><strong>${partial ? "价格未采到" : esc(selected.price)}</strong><time class="meta">2026-09-09 08:00</time><span>${partial ? "库存未知" : "有货"} · 评分 ${partial ? "未采到" : "4.3"} · 评论 ${partial ? "0" : "86"}</span><code>证据 synthetic-evidence-${second ? "uk" : "us"}-19</code></div><div class="snapshot"><strong>${second ? "GBP 35.00" : "USD 30.00"}</strong><time class="meta">2026-09-08 08:00</time><span>有货 · 评分 4.3 · 评论 85</span><code>证据 synthetic-evidence-18</code></div><p class="meta">${is("history-window") ? "中间 98 条在本静态图中省略，不是完整长列表验证。" : ""}返回窗口最早快照，不一定是全历史首次基线。变化最多返回 200 条、提醒最多 100 条。</p>`}</section>`;
  }
  function ruleDirectory() {
    const rows = is("rules-empty") ? [] : is("rules-disabled") ? [rules[2]] : rules;
    return `${note("范围只在当前工作区", "全部竞品不代表跨组织全局；监控就绪不代表任何机会已通过竞争质量门。", "info")}<section class="rules"><div class="section-heading"><h2>监控规则</h2><span class="meta">${rows.length} 条返回规则 · ${rows.filter((r) => r.status === "已生效").length} 条生效</span></div>${!rows.length ? emptyPanel("尚未配置监控规则", "读取成功后确认无规则。创建明确阈值，才有据可查。", manager() ? "CP-RULE-OPEN" : null, "创建第一条规则") : rows.map((r) => `<article class="rule-row"><div><span class="meta">${r.target ? "指定竞品" : "工作区全部竞品"}</span><h3>${r.metric} · ${r.direction}${r.threshold !== null ? " ≥ " + r.threshold : ""}</h3>${r.metric === "价格" ? "<span class='meta'>数值阈值；接口未提供规则币种</span>" : ""}</div><div class="target">${r.target === null ? "当前工作区全部竞品" : r.target === "removed" || is("rules-no-objects") ? "竞品已移除 / 当前列表不可用" : objects[0].title}<span class="meta">版本 ${r.revision} · 09-09 08:00 更新</span></div>${badge(r.status, r.status === "已生效")}</article>`).join("")}<p class="rule-footer">此页仅读取和新建规则；当前合同没有规则编辑、删除、启停按钮。停用规则仍保留展示，不计入生效数。</p></section>`;
  }
  function openModal(kind, scene = false) {
    opener =
      (!scene &&
        document.activeElement?.closest("#app") &&
        document.activeElement.closest("[data-action]")?.dataset.action) ||
      (kind === "rule" ? "CP-RULE-OPEN" : kind === "delete" ? "CP-DELETE-OPEN" : "CP-CREATE-OPEN");
    modalKind = kind;
    busy = scene && current.id.endsWith("busy");
    formError =
      scene && current.id.endsWith("error")
        ? kind === "delete"
          ? "版本冲突（409），删除未获确认。原因已保留，请核对当前版本。"
          : "请求失败，输入已保留。请核对后显式重试。结果不能仅由网络错误推定。"
        : "";
    if (kind === "delete") reason = scene ? "重复监控同一个商品，保留历史记录。" : "";
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
    formError = "";
    step = 1;
    if (opener === "CP-DELETE-OPEN") $("[data-action='CP-MORE']")?.setAttribute("open", "");
    document.querySelector(`[data-action="${opener}"]`)?.focus();
  }
  function field(name, title, attributes = "", value = createForm[name]) {
    return `<label>${title}<input name="${name}" ${attributes} value="${esc(value)}" ${busy ? "disabled" : ""}/></label>`;
  }
  function renderModal() {
    const create = modalKind === "create",
      rule = modalKind === "rule",
      id = create ? "CP-CREATE" : rule ? "CP-RULE" : "CP-DELETE";
    let body;
    if (create)
      body = `<ol class="steps" aria-label="添加竞品步骤">${["商品链接", "市场信息", "确认采集"].map((v, i) => `<li ${step === i + 1 ? 'aria-current="step"' : ""}>${i + 1} ${v}</li>`).join("")}</ol>${
        step === 1
          ? field("product_url", "商品网址", 'type="url" required maxlength="2048"') +
            "<p class='meta'>公开 Amazon 商品链接。前两步不会创建监控或发起采集。</p>"
          : step === 2
            ? `<div class="pair">${field("market", "市场", 'required maxlength="40" pattern="[A-Za-z0-9._-]+"')}${field("opportunity_id", "关联机会 ID（可选）", 'maxlength="36" pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"')}</div>${field("title", "监控名称", 'required maxlength="500"')}`
            : `<dl>${[
                ["product_url", "商品链接"],
                ["market", "市场"],
                ["title", "监控名称"],
                ["opportunity_id", "关联机会"],
              ]
                .map(
                  ([k, label]) =>
                    `<div><dt>${label}</dt><dd>${esc(createForm[k] || "未关联")}</dd></div>`,
                )
                .join(
                  "",
                )}</dl>${note("确认后提交创建与采集请求", "缺失字段保持未采到，采集排队不等于已生成快照。", "info")}`
      }`;
    else if (rule) {
      const options = (rows, value) =>
        rows
          .map(([v, t]) => `<option value="${v}" ${v === value ? "selected" : ""}>${t}</option>`)
          .join("");
      body = `<label>适用竞品<select name="competitor_id" ${busy ? "disabled" : ""}>${options([["", "当前工作区全部竞品"], ...objects.map((o) => [o.id, o.title])], ruleForm.competitor_id)}</select></label><div class="pair"><label>指标<select name="metric" ${busy ? "disabled" : ""}>${options(
        [
          ["price", "价格"],
          ["rank", "排名"],
          ["review_count", "评论数"],
          ["availability", "库存"],
        ],
        ruleForm.metric,
      )}</select></label><label>方向<select name="direction" ${busy ? "disabled" : ""}>${options(
        ruleForm.metric === "availability"
          ? [
              ["change", "任意变化"],
              ["became_unavailable", "变为缺货"],
            ]
          : [
              ["increase", "增加"],
              ["decrease", "减少"],
              ["change", "任意变化"],
            ],
        ruleForm.direction,
      )}</select></label></div>${ruleForm.metric === "availability" ? note("库存规则不发送数值阈值", "只支持任意变化或变为缺货。", "info") : field("threshold_value", "数值阈值", 'type="number" required min="0" max="999999999999" step="0.000001"', ruleForm.threshold_value) + "<p class='meta'>价格规则没有独立币种字段，不借用当前选中竞品的币种。</p>"}<p class="meta">只有达到显式阈值的真实变化才排队通知与任务；启用并不等于已送达。</p>`;
    } else
      body = `${note("停止监控，保留历史", `删除“${esc(selected.title)}”后不再继续监控；已有快照与审计记录保留。`, "error")}<p class="meta">当前版本 7 · 不永久删除历史证据</p><label>删除原因<textarea name="reason" required maxlength="500" ${busy ? "disabled" : ""}>${esc(reason)}</textarea></label>`;
    $("#modal").innerHTML =
      `<form ${busy ? 'aria-busy="true"' : ""}><header><div><p class="eyebrow">${create ? "建立观察对象" : rule ? "明确范围与阈值" : "危险操作 / 保留审计"}</p><h2 id="dialog-title">${create ? "添加竞品监控" : rule ? "新建监控规则" : "删除竞品监控"}</h2></div>${button(id + "-CLOSE", "×", "", busy)}</header>${body}${formError ? `<div class="notice error" role="alert">${esc(formError)}<br><code>synthetic-request-19</code></div>` : ""}<footer>${create && step > 1 ? button("CP-CREATE-PREVIOUS", "上一步", "", busy) : button(id + "-CLOSE", "取消", "", busy)}<button type="submit" data-action="${id}-SUBMIT" class="primary ${!create && !rule ? "danger" : ""}" ${busy ? 'disabled aria-busy="true"' : ""}>${busy ? (create ? "正在添加…" : rule ? "正在启用…" : "正在删除…") : create ? (step === 3 ? "确认并开始采集" : "下一步") : rule ? "启用规则" : "确认删除"}</button></footer></form>`;
    $("#modal header button").setAttribute("aria-label", "关闭" + $("#dialog-title").textContent);
  }
  function intent(path, method, body) {
    intents.push({ path, method, ...(body === undefined ? {} : { body: structuredClone(body) }) });
  }
  document.addEventListener("input", (e) => {
    if (e.target.id === "search") {
      search = e.target.value;
      deep = false;
      const pos = e.target.selectionStart;
      render();
      $("#search").focus();
      try {
        $("#search").setSelectionRange(pos, pos);
      } catch {}
    } else if (e.target.closest("dialog")) {
      if (modalKind === "create") createForm[e.target.name] = e.target.value;
      else if (modalKind === "rule") ruleForm[e.target.name] = e.target.value;
      else reason = e.target.value;
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "scene") choose(e.target.value);
    else if (e.target.name === "metric") {
      ruleForm.metric = e.target.value;
      if (
        ruleForm.metric === "availability" &&
        !["change", "became_unavailable"].includes(ruleForm.direction)
      )
        ruleForm.direction = "change";
      if (ruleForm.metric !== "availability" && ruleForm.direction === "became_unavailable")
        ruleForm.direction = "change";
      renderModal();
      $("[name=metric]").focus();
    }
  });
  $("#modal").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
      ...$("#modal").querySelectorAll(
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
  $("#modal").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
  $("#modal").addEventListener("click", (e) => {
    if (e.target === $("#modal")) {
      const r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeModal();
    }
  });
  $("#modal").addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;
    if (modalKind === "create" && step < 3) {
      step++;
      renderModal();
      focusField();
      return;
    }
    if (modalKind === "delete" && !reason.trim()) {
      formError = "请填写非空白删除原因。";
      renderModal();
      focusField();
      return;
    }
    if (modalKind === "create")
      intent("/competitors", "POST", {
        market: createForm.market,
        product_url: createForm.product_url,
        title: createForm.title,
        ...(createForm.opportunity_id ? { opportunity_id: createForm.opportunity_id } : {}),
      });
    else if (modalKind === "rule")
      intent("/competitor-monitor-rules", "POST", {
        competitor_id: ruleForm.competitor_id || null,
        metric: ruleForm.metric,
        direction: ruleForm.direction,
        ...(ruleForm.metric === "availability"
          ? {}
          : { threshold_value: Number(ruleForm.threshold_value) }),
      });
    else
      intent("/competitors/" + selected.id, "DELETE", {
        expected_revision: 7,
        reason: reason.trim(),
      });
    if (window.competitorReview.outcome === "pending") {
      busy = true;
      renderModal();
      return;
    }
    if (window.competitorReview.outcome === "error") {
      formError = "隔离失败样本：输入已保留，没有实际发送请求。";
      renderModal();
      focusField();
    } else {
      closeModal();
      feedback = "隔离成功演示：仅记录请求意图，未修改任何真实竞品、规则或任务。";
      render();
    }
  });
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled || el.tagName === "DETAILS" || el.type === "submit") return;
    const id = el.dataset.action;
    if (el.tagName === "A") e.preventDefault();
    if (id.endsWith("-CLOSE")) closeModal();
    else if (id === "CP-CREATE-OPEN") {
      step = 1;
      openModal("create");
    } else if (id === "CP-CREATE-PREVIOUS") {
      step--;
      renderModal();
      focusField();
    } else if (id === "CP-RULE-OPEN") {
      ruleForm = { competitor_id: "", metric: "price", direction: "decrease", threshold_value: 1 };
      openModal("rule");
    } else if (id === "CP-DELETE-OPEN") openModal("delete");
    else if (id === "CP-DETAIL") {
      selected = { ...objects.find((o) => o.id === el.dataset.object) };
      intent("/competitors/" + selected.id, "GET");
      render();
    } else if (id === "CP-SEARCH-CLEAR") {
      search = "";
      deep = false;
      render();
      $("#search").focus();
    } else if (id === "CP-COLLECT") {
      if (collectionSubmitting) return;
      intent("/competitors/" + selected.id + "/collect", "POST", {});
      if (window.competitorReview.outcome === "pending") {
        collectionSubmitting = true;
        render();
        return;
      }
      feedback = "隔离受理演示：采集请求排队，不代表已采集成功。";
      render();
    } else if (id === "CP-TOGGLE") {
      if (objectPending || collectionSubmitting) return;
      intent("/competitors/" + selected.id + "/actions", "POST", {
        status: selected.status === "已暂停" ? "active" : "paused",
        expected_revision: 7,
      });
      if (window.competitorReview.outcome === "pending") {
        objectPending = { id: selected.id, title: selected.title, action: id };
        render();
        $("[data-action=CP-MORE]")?.setAttribute("open", "");
        return;
      }
      feedback = "隔离启停意图已记录；目录状态未模拟持久化。";
      render();
    } else if (["CP-TASK-CREATE", "CP-TASK-CREATE-REVIEW"].includes(id)) {
      if (objectPending || collectionSubmitting) return;
      const review = id.endsWith("REVIEW"),
        second = selected.id === objects[1].id;
      const field = review ? "评论数" : "价格",
        evidence = review
          ? "synthetic-evidence-18"
          : `synthetic-evidence-${second ? "uk" : "us"}-19`;
      const changeValue = review
        ? "85 → 86"
        : `${is("partial") ? "币种未采到" : second ? "GBP" : "USD"} ${second ? "35.00 → 32.50" : "30.00 → 28.00"}`;
      intent("/tasks", "POST", {
        title: `复核竞品变化 · ${field} · ${selected.title}`.slice(0, 200),
        description: `核验竞品 ${selected.id} 的变化事件 synthetic-change-${review ? "18" : "19"}。\n字段：${field}\n变化：${changeValue}\n证据：${evidence}\n采集时间：${review ? "2026-09-08T08:00:00Z" : "2026-09-09T00:00:00Z"}\n请核对原始证据后记录结论，不覆盖竞品快照历史。`,
        priority: "high",
        due_at: null,
      });
      if (window.competitorReview.outcome === "pending") {
        objectPending = { id: selected.id, title: selected.title, action: id };
        render();
        return;
      }
      taskCreated[selected.id + (review ? ":review" : ":price")] = true;
      feedback = "仅创建隔离任务样本，不是真实任务。";
      render();
    } else if (["CP-RULE-NAV", "CP-RULE-NAV-CURRENT"].includes(id)) {
      intent(el.getAttribute("href"), "NAVIGATE");
      const target = selected.id,
        allowed = manager();
      choose(allowed ? "rules" : "rules-readonly");
      if (id.endsWith("CURRENT") && allowed) {
        ruleForm.competitor_id = target;
        openModal("rule");
      }
    } else if (id === "CP-RULE-BACK") {
      intent("/competitors", "NAVIGATE");
      choose("directory");
    } else if (id === "CP-STATE-PRIMARY") {
      intent(
        is("expired")
          ? "/login?return_to=%2Fcompetitors"
          : is("forbidden")
            ? "/home"
            : rulesPage()
              ? "/competitor-monitor-rules"
              : "/competitors",
        is("expired", "forbidden") ? "NAVIGATE" : "GET",
      );
      feedback = "仅记录恢复意图；不访问目的地。";
      render();
    } else if (id === "CP-DETAIL-RETRY") {
      intent("/competitors/" + selected.id, "GET");
      feedback = "仅记录详情重读意图。";
      render();
    } else if (el.tagName === "A") {
      intent(el.getAttribute("href"), "NAVIGATE");
      feedback = "仅记录链接目标；原来源链接仍声明新窗口，不实际访问。";
      render();
    }
  });
  $("#scene").innerHTML = scenes
    .map((s) => `<option value="${s.id}">${s.pageId} · ${s.label}</option>`)
    .join("");
  window.competitorReview = { scenes, choose, intents, outcome: "success" };
  choose("directory");
})();
