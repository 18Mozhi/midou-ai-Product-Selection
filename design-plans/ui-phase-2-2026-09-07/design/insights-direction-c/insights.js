(() => {
  const D = window.INSIGHTS_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const labels = {
    covered: "已覆盖",
    insufficient_data: "数据不足",
    complete: "完整",
    unknown: "未知",
    low: "低",
    medium: "中",
    high: "高",
    calculated: "已计算",
    fresh: "新鲜",
    stale: "过时",
  };
  const label = (v) => labels[v] || v || "未提供";
  const time = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "时间未提供";
  const sections = {
    overview: "关联信息",
    score: "评分解释",
    market: "市场证据",
    competition: "竞争事实",
    risk: "风险与缺项",
  };
  const scenes = {
    overview: "概览 / 关联数量",
    score: "评分 / 历史运行",
    "score-details": "评分 / 展开证据",
    "score-missing": "评分 / 缺失输入",
    "score-zero": "评分 / 真实零值",
    "score-no-run": "评分 / 尚无运行",
    "score-readonly": "评分 / 只读",
    market: "市场 / 汇总非需求结论",
    "market-missing": "市场 / 覆盖不足",
    "market-empty": "市场 / 零条证据",
    competition: "竞争 / 最近快照",
    "competition-details": "竞争 / 出处展开",
    "competition-empty": "竞争 / 确认空结果",
    "competition-no-snapshot": "竞争 / 尚无快照",
    "competition-null": "竞争 / 字段缺失",
    "competition-zero": "竞争 / 零值保留",
    "competition-stale": "竞争 / 过时事实",
    "competition-no-access": "竞争 / 无读取权限",
    "competition-loading": "竞争 / 正在读取",
    "competition-error": "竞争 / 关联读取失败",
    risk: "风险 / 未知且覆盖不足",
    "risk-low-missing": "风险 / 低风险不等于完整",
    "risk-high": "风险 / 高风险已保存",
    "risk-covered": "风险 / 覆盖状态非逐项清单",
    "overview-empty": "概览 / 真实空结果",
    "overview-loading": "概览 / 正在读取",
    "overview-error": "概览 / 关联读取失败",
    "overview-comp-only": "概览 / 仅竞品可读",
    "overview-supplier-only": "概览 / 仅供应可读",
    "overview-no-access": "概览 / 均无读取权限",
    "competitor-busy": "采集竞品 / 提交中",
    "competitor-queued": "采集竞品 / 已排队",
    "competitor-failed": "采集竞品 / 明确拒绝",
    "supplier-busy": "采集供应 / 提交中",
    "supplier-queued": "采集供应 / 已排队",
    "supplier-failed": "采集供应 / 明确拒绝",
    "score-busy": "重新评分 / 提交中",
    "score-queued": "重新评分 / 已排队旧分仍在",
    "score-failed": "重新评分 / 明确拒绝",
    "score-reload-error": "重新评分 / 成功后重读失败",
    "write-unknown": "操作 / 结果待核对",
  };
  let S,
    generation = 0;
  const initial = () => ({
    section: "overview",
    detail: clone(D.facts.detail),
    competitors: clone(D.competitors),
    downstream: clone(D.downstream),
    readState: "ready",
    compRead: true,
    supplierRead: true,
    compManage: true,
    supplierManage: true,
    decide: true,
    busy: false,
    operation: "",
    outcome: "",
    failNext: false,
    intents: [],
    reads: 0,
    navigation: "",
    sourceDetails: false,
  });
  function scene(name) {
    generation++;
    S = initial();
    S.name = name;
    if (/^score/.test(name)) S.section = "score";
    if (/^market/.test(name)) S.section = "market";
    if (/^competition/.test(name)) S.section = "competition";
    if (/^risk/.test(name)) S.section = "risk";
    if (name.endsWith("details")) S.sourceDetails = true;
    if (name.endsWith("loading")) S.readState = "loading";
    if (name === "competition-error" || name === "overview-error") S.readState = "error";
    if (name === "market-empty") {
      S.detail.evidence_count = 0;
      S.detail.source_count = 0;
      S.detail.section_status.market = "insufficient_data";
    }
    if (name === "market-missing") S.detail.section_status.market = "insufficient_data";
    if (name === "score-missing") {
      S.detail.overall_score = null;
      S.detail.latest_score_run.status = "insufficient_data";
      S.detail.latest_score_run.coverage_percent = 70;
      S.detail.latest_score_run.missing_fields = ["profit.input_score"];
      Object.assign(S.detail.score_components[2], {
        input_score: null,
        weighted_score: null,
        evidence_ids: [],
        missing_fields: ["profit.input_score"],
      });
    }
    if (name === "score-zero") {
      S.detail.overall_score = 0;
      S.detail.score_components.forEach((v) =>
        Object.assign(v, { input_score: 0, weighted_score: 0 }),
      );
    }
    if (name === "score-no-run") {
      S.detail.overall_score = null;
      S.detail.latest_score_run = null;
      S.detail.score_components = [];
    }
    if (name === "score-readonly") S.decide = false;
    if (name === "competition-empty" || name === "overview-empty") {
      S.competitors = [];
      S.downstream = { competitors: 0, snapshots: 0, searches: 0, suppliers: 0 };
    }
    if (name === "competition-no-snapshot") {
      S.competitors[0].latest_snapshot = null;
      S.competitors[0].snapshot_count = 0;
      S.downstream.snapshots = 0;
    }
    if (name === "competition-null")
      Object.assign(S.competitors[0].latest_snapshot, {
        current_price: null,
        currency: null,
        review_count: null,
        rating_value: null,
      });
    if (name === "competition-zero")
      Object.assign(S.competitors[0].latest_snapshot, {
        current_price: 0,
        review_count: 0,
        rating_value: 0,
      });
    if (name === "competition-stale") S.competitors[0].latest_snapshot.freshness = "stale";
    if (
      name === "competition-no-access" ||
      name === "overview-supplier-only" ||
      name === "overview-no-access"
    ) {
      S.compRead = false;
      S.compManage = false;
    }
    if (name === "overview-comp-only" || name === "overview-no-access") {
      S.supplierRead = false;
      S.supplierManage = false;
    }
    if (name === "risk-low-missing") S.detail.risk_level = "low";
    if (name === "risk-high") S.detail.risk_level = "high";
    if (name === "risk-covered") {
      S.detail.risk_level = "low";
      S.detail.section_status.risk = "covered";
    }
    for (const key of ["competitor", "supplier", "score"]) {
      if (name === `${key}-busy`) {
        S.busy = true;
        S.operation = key;
      }
      if (name === `${key}-queued`) {
        S.operation = key;
        S.outcome = "queued";
      }
      if (name === `${key}-failed`) {
        S.operation = key;
        S.outcome = "failed";
      }
    }
    if (name === "score-reload-error") {
      S.operation = "score";
      S.outcome = "reload-error";
    }
    if (name === "write-unknown") {
      S.operation = "competitor";
      S.outcome = "unknown";
    }
    render();
    document.querySelector("#scene").value = name;
  }
  const button = (key, text) =>
    `<button data-action="${key}" ${S.busy || S.outcome === "unknown" || S.outcome === "reload-error" ? "disabled" : ""} class="${key === "score" ? "primary" : ""}">${S.busy && S.operation === key ? "正在提交…" : text}</button>`;
  const route = (tab) => `/opportunities/${S.detail.id}${tab === "overview" ? "" : `?tab=${tab}`}`;
  function statusNotice() {
    if (S.busy)
      return `<div class="banner" role="status"><strong>正在提交${S.operation === "score" ? "评分" : "采集"}请求</strong>请等待响应，当前事实不会提前更新。</div>`;
    if (!S.outcome) return "";
    const notices = {
      queued: [
        "请求已接受，任务已排队",
        S.operation === "score"
          ? "这里仍是上次评分，不是本次任务的新结果。完成后刷新机会可见新运行。"
          : "任务编号：isolated-task-layout。此处数量仍是上次读取结果，尚未重新读取。",
      ],
      failed: [
        "请求被明确拒绝",
        "隔离拒绝场景：依赖未就绪。以下为模拟反馈；可显式重试，不会自动循环提交。",
      ],
      unknown: [
        "请求结果待核对",
        "尚未收到可确认结果，不能断言没有写入。请先核对任务记录；关闭或切页不代表服务端取消。",
      ],
      "reload-error": [
        "评分已排队，但重读未完成",
        "排队成功事实保留；下方为上次读取记录，不是新结果。这里只重试读取，不重复排队。",
      ],
    };
    const n = notices[S.outcome];
    return `<div class="banner ${S.outcome === "queued" ? "" : "warning"}" role="status"><strong>${n[0]}</strong><p>${n[1]}</p>${S.outcome === "reload-error" ? '<div class="actions"><button id="retry-score-read">重试读取机会</button></div>' : ""}${S.outcome === "unknown" ? '<div class="actions"><a href="/tasks">前往任务中心核对</a></div>' : ""}</div>`;
  }
  function downstreamState() {
    if (S.readState === "loading")
      return '<div class="empty"><h3>正在读取关联数据</h3><p>数量尚未返回，不显示 0。</p></div>';
    if (S.readState === "error")
      return '<div class="banner danger"><strong>关联数据本轮读取未完成</strong><p>竞品与供应数据共同读取；不能据此判断哪个接口失败，也不把旧结果当成本轮成功。</p><div class="actions"><button id="retry-downstream">重试关联读取</button></div></div>';
    return "";
  }
  function overview() {
    return `${downstreamState()}${S.readState === "ready" ? `<div class="main-split"><div><h3>竞品关联</h3>${S.compRead ? `<div class="figures"><div class="figure"><div class="number">${S.downstream.competitors}</div><p>关联竞品</p></div><div class="figure"><div class="number">${S.downstream.snapshots}</div><p>快照累计</p></div></div><p>对象数量与快照数量分开，不相加为“完成度”。</p>` : '<p class="access">无竞品读取权限 · 不判定数量</p>'}</div><div><h3>供应商候选</h3>${S.supplierRead ? `<div class="figures"><div class="figure"><div class="number">${S.downstream.searches}</div><p>关联搜索</p></div><div class="figure"><div class="number">${S.downstream.suppliers}</div><p>候选累计</p></div></div><p>各搜索 candidate_count 相加，不代表去重供应商或已核实供应能力。</p>` : '<p class="access">无供应读取权限 · 不判定数量</p>'}</div></div>` : ""}<div class="actions">${S.compManage ? button("competitor", "采集 Amazon 竞品") : ""}${S.supplierManage ? button("supplier", "采集公开供应商") : ""}<a href="/competitors">竞品工作台 ↗</a><a href="/sourcing">供应链工作台 ↗</a></div><p class="notice">显示范围：当前机会关联数据。采集动作仅请求排队，不改变评分、风险或人工决定。入口沿用原页面；能否进入由目标页面权限校验。</p>`;
  }
  function score() {
    const d = S.detail,
      r = d.latest_score_run;
    return `<div class="score-head"><div class="score-value">${d.overall_score ?? "—"}</div><div><h3>${d.overall_score == null ? "尚无可用总分" : "已保存的机会评分"}</h3><p>${r ? `规则 ${esc(d.score_rule_version)} · ${esc(label(r.status))} · 覆盖 ${r.coverage_percent ?? "未提供"}${r.coverage_percent == null ? "" : "%"}` : "尚无评分运行"}</p><span class="meta">${r ? `${time(r.scored_at)}（中国时间）` : "缺失输入不使用默认值补齐"}</span></div></div>${r?.missing_fields.length ? `<div class="banner warning"><strong>本次运行缺失项</strong><span>${esc(r.missing_fields.join("、"))}</span></div>` : ""}${d.score_components.length ? d.score_components.map((v) => `<details class="score-row" ${S.sourceDetails ? "open" : ""}><summary><span><strong>${esc(D.facts.dimensions.find((a) => a.code === v.dimension_code)?.label || v.dimension_code)}</strong><small> / 权重 ${v.weight_percent}%</small></span><span><small>输入分</small> <b>${v.input_score ?? "缺失"}</b></span><span><small>加权分</small> ${v.weighted_score ?? "缺失"}</span><span class="arrow">${v.evidence_ids.length} 条证据 · 展开</span></summary><div class="reveal"><p class="meta">维度代码：${esc(v.dimension_code)}</p><p>证据 ID：${v.evidence_ids.length ? v.evidence_ids.map(esc).join("、") : "未提供"}</p><p>缺失项：${v.missing_fields.length ? esc(v.missing_fields.join("、")) : "该维度未报告缺失项"}</p></div></details>`).join("") : '<div class="empty"><h3>尚无评分输入</h3><p>不填充模拟分数或默认权重。</p></div>'}<div class="actions">${S.decide ? button("score", "重新评分") : '<p class="access">只读身份 · 无重新评分操作</p>'}<a href="/opportunities/scoring-rules">管理规则版本 ↗</a></div><p class="notice">总分、权重、加权分均展示返回快照，不在浏览器重新计算；评分不替代五项质量门或人工采纳。</p>`;
  }
  function market() {
    return `<div class="banner ${S.detail.section_status.market === "covered" ? "" : "warning"}"><strong>市场覆盖：${label(S.detail.section_status.market)}</strong>这是已返回的覆盖状态，不是市场规模或销量增长结论。</div><div class="figures"><div class="figure"><div class="number">${S.detail.evidence_count}</div><p>机会关联证据总数</p></div><div class="figure"><div class="number">${S.detail.source_count}</div><p>机会关联来源数</p></div><div class="figure"><div class="number">${esc(S.detail.market)}</div><p>目标市场</p></div></div><h3>这些数量能说明什么？</h3><dl class="ledger"><div><dt>可以确认</dt><dd>当前机会已关联的证据和来源数量。</dd></div><div><dt>不能推导</dt><dd>所有证据均为趋势信号、市场需求已验证、市场规模或增长率。</dd></div><div><dt>继续核对</dt><dd>到证据区逐条查看来源、采集时间与事实内容。</dd></div></dl><div class="actions"><a href="${route("evidence")}">查看机会证据 →</a></div>`;
  }
  function competition() {
    if (!S.compRead)
      return '<div class="empty"><h3>无竞品读取权限</h3><p>未发起竞品读取，不展示任何关联数量或快照。</p></div><div class="actions"><a href="/competitors">前往竞品工作台 ↗</a></div>';
    return `${downstreamState()}${S.readState === "ready" ? `<p class="meta">当前机会关联 ${S.downstream.competitors} 个竞品 · 累计 ${S.downstream.snapshots} 个快照；这里只展示最近快照，不构造趋势。</p>${S.competitors.length ? S.competitors.map((v) => `<article class="competitor"><span class="badge">${esc(v.source_site)} · ${esc(v.market)}</span><h3>${esc(v.title)}</h3><p class="meta">外部标识 ${esc(v.external_id)}</p>${v.latest_snapshot ? `<div class="snapshot"><div><small>快照价格</small><strong>${v.latest_snapshot.current_price ?? "价格缺失"}${v.latest_snapshot.current_price == null ? "" : ` ${esc(v.latest_snapshot.currency || "币种未提供")}`}</strong></div><div><small>评分</small><strong>${v.latest_snapshot.rating_value ?? "未提供"}</strong></div><div><small>评论数</small><strong>${v.latest_snapshot.review_count ?? "未提供"}</strong></div></div><p class="meta">${time(v.latest_snapshot.captured_at)}（中国时间） · 返回新鲜度 ${label(v.latest_snapshot.freshness)}</p>${v.latest_snapshot.freshness === "stale" ? '<p class="banner warning">快照已过时；不代表当前价格或评分。</p>' : ""}` : '<div class="banner warning"><strong>尚无快照</strong>关联竞品不代表已完成采集，价格、评分和评论数均待返回。</div>'}<details class="source-details" ${S.sourceDetails ? "open" : ""}><summary>展开记录标识</summary><p class="source-id">竞品 ID：${esc(v.id)}</p><p class="source-id">关联机会 ID：${esc(v.opportunity_id)}</p></details></article>`).join("") : '<div class="empty"><h3>当前机会没有关联竞品</h3><p>这是读取成功的空结果，不是读取失败。</p></div>'}` : ""}<div class="actions">${S.compManage ? button("competitor", "采集 Amazon 竞品") : ""}<a href="/competitors">竞品工作台 ↗</a></div>`;
  }
  function risk() {
    return `<div class="risk-reading"><div><span class="meta">已保存风险等级</span><strong>${label(S.detail.risk_level)}</strong><p>只描述保存值，不据此补齐其他评估。</p></div><div><span class="meta">风险评估覆盖</span><strong>${label(S.detail.section_status.risk)}</strong><p>与风险等级独立呈现。</p></div></div><div class="banner warning"><strong>当前响应未提供逐项风险评估事实</strong>合规、侵权、供应、趋势、利润和数据质量不能分别标记为通过或无风险。</div><dl class="ledger"><div><dt>当前可以读取</dt><dd>风险等级及风险覆盖状态。</dd></div><div><dt>仍需核对</dt><dd>各项判断对应的证据、评估范围与时间。这里不生成六项已评估清单。</dd></div></dl><div class="actions"><a href="${route("evidence")}">查看机会证据 →</a><a href="${route("profit")}">核对利润与成本 →</a></div>`;
  }
  function render() {
    const titles = {
      overview: "把关联对象与采集状态分开",
      score: "分数背后的输入与出处",
      market: "先看证据，再判断市场",
      competition: "可追溯的竞争事实",
      risk: "风险等级，不是完整评估",
    };
    document.querySelector("#app").innerHTML =
      `<div class="layout"><aside class="directory"><div class="brand">SCOUTOPS</div><p>机会详情 · P18 分析工作面</p><h2>分析目录</h2><details ${innerWidth > 650 ? "open" : ""}><summary>展开分析目录 · ${sections[S.section]}</summary><nav aria-label="分析工作面">${Object.entries(
        sections,
      )
        .map(
          ([key, name]) =>
            `<button data-section="${key}" ${S.busy ? "disabled" : ""} ${S.section === key ? 'aria-current="page"' : ""}>${name}<span>→</span></button>`,
        )
        .join(
          "",
        )}</nav></details><div class="foot"><p>相关工作面</p><a href="${route("evidence")}">证据明细</a><a href="${route("profit")}">利润与成本</a><p>结论与人工决定已在核心稿单独设计，本稿不替代。</p></div></aside><main class="content"><div class="context"><a href="/opportunities">← 返回机会列表</a><span>隔离图稿 · 非生产数据</span></div><header class="identity"><p class="meta">US / OPPORTUNITY / VERSION ${S.detail.version}</p><h1>${esc(S.detail.name)}</h1><p>分析事实与缺项核对</p></header><section class="workspace" aria-busy="${S.busy || S.readState === "loading"}"><header class="section-title"><div><h2>${titles[S.section]}</h2><p>${sections[S.section]} / C 方向重构提案</p></div><span class="badge">待审核</span></header><div class="body">${statusNotice()}${{ overview, score, market, competition, risk }[S.section]()}</div></section>${S.navigation ? `<p class="nav-notice" role="status">已记录导航：${esc(S.navigation)}。隔离图稿不打开真实页面。</p>` : ""}<p class="notice">历史测试夹具与明确合成的状态样例。净水杯机会与手机壳竞品的跨夹具关联仅测试排版，不是业务关联或市场判断；供应候选数量也是隔离样例。未访问真实服务。</p></main></div>`;
    document.querySelectorAll("[data-section]").forEach(
      (node) =>
        (node.onclick = () => {
          S.section = node.dataset.section;
          render();
        }),
    );
    document
      .querySelectorAll("[data-action]")
      .forEach((node) => (node.onclick = () => action(node.dataset.action)));
    document.querySelectorAll('a[href^="/"]').forEach(
      (node) =>
        (node.onclick = (event) => {
          event.preventDefault();
          S.navigation = node.getAttribute("href");
          render();
        }),
    );
    const retry = document.querySelector("#retry-downstream");
    if (retry)
      retry.onclick = () => {
        S.reads++;
        S.lastRead = [
          S.compRead ? "/competitors" : null,
          S.supplierRead ? "/sourcing/searches" : null,
        ].filter(Boolean);
        S.readState = "ready";
        render();
      };
    const reread = document.querySelector("#retry-score-read");
    if (reread)
      reread.onclick = () => {
        S.reads++;
        S.lastReadOperation = "OpportunityWorkspace.load";
        S.outcome = "queued";
        render();
      };
  }
  async function action(key) {
    if (
      S.busy ||
      S.outcome === "unknown" ||
      S.outcome === "reload-error" ||
      !(key === "score" ? S.decide : key === "competitor" ? S.compManage : S.supplierManage)
    )
      return;
    const owner = generation,
      failed = S.failNext;
    S.failNext = false;
    S.busy = true;
    S.operation = key;
    S.outcome = "";
    S.intents.push(clone(D.intents[key]));
    render();
    await new Promise((resolve) => setTimeout(resolve, 160));
    if (owner !== generation) return;
    S.busy = false;
    S.outcome = failed ? "failed" : "queued";
    if (!failed && key === "score") S.reads++;
    render();
  }
  window.INSIGHTS_C = {
    scenes,
    scene,
    state: () => clone(S),
    failNext: () => {
      S.failNext = true;
    },
    start: () => {
      const select = document.querySelector("#scene");
      select.innerHTML = Object.entries(scenes)
        .map(([key, name]) => `<option value="${key}">${name}</option>`)
        .join("");
      select.onchange = () => scene(select.value);
      scene("overview");
    },
  };
})();
