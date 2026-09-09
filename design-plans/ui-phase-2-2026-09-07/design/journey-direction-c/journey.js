(() => {
  const d = window.JOURNEY_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const themes = { "deep-ocean": "目录蓝", "aurora-purple": "冷雾蓝", "cloud-white": "净页白" };
  const densities = { standard: "标准", compact: "紧凑" };
  function presentation(theme, density) {
    if (!Object.hasOwn(themes, theme) || !Object.hasOwn(densities, density))
      throw new Error("Unknown review presentation");
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.querySelector("#preview-theme").value = theme;
    document.querySelector("#preview-density").value = density;
    document.querySelector("#preview-label").textContent =
      `${themes[theme]} / ${densities[density]}`;
  }
  const e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const scenes = {
    keyword: "关键词输入",
    asin: "ASIN 输入",
    url: "商品链接输入",
    "keyword-edited": "关键词已填",
    "asin-edited": "ASIN 已填",
    "url-edited": "链接已填",
    "keyword-required": "关键词必填错误",
    "asin-invalid": "ASIN 格式错误",
    "url-invalid": "链接格式错误",
    "reason-required": "决策原因必填错误",
    "asin-restoring": "ASIN 输入恢复中",
    "url-restoring": "链接输入恢复中",
    "asin-create-busy": "ASIN 输入提交中",
    "url-create-busy": "链接输入提交中",
    "create-busy": "创建中",
    "create-failed": "创建未获确认",
    "url-rejected": "非 HTTPS 返回拒绝",
    restoring: "正在恢复",
    "restore-failed": "恢复失败",
    "restore-expired": "恢复登录过期",
    "restore-forbidden": "恢复无权访问",
    "restore-blocked": "恢复受阻",
    "retry-busy": "重试读取提交中",
    "invalid-id": "非法活动 ID 已清理",
    "missing-id": "活动 ID 返回 404",
    accepted: "任务已接收",
    running: "来源处理中",
    "running-evidence": "处理中已有证据",
    "read-busy": "进度读取中",
    "read-failed": "进度读取失败",
    "read-expired": "读取登录过期",
    "read-forbidden": "读取权限拒绝",
    "read-blocked": "读取受阻",
    results: "双候选待选择",
    selected: "候选已选",
    "no-topic": "选择无主题候选",
    "single-result": "单条自动选中",
    "first-result": "first_result 兼容回退",
    "missing-fields": "缺标题与发布者",
    "long-result": "长标题与原文地址",
    "twenty-results": "20 条展示与总量区分",
    timeline: "完整时间轴",
    empty: "真实空结果",
    blocked: "来源明确受阻",
    failed: "任务失败",
    "deadline-running": "旅程超时但任务仍运行",
    "adoption-pending": "尚无已评估机会",
    "adopt-ready": "五门通过待采纳",
    "gate-score": "评分质量门未通过",
    "gate-market": "市场质量门未通过",
    "gate-competition": "竞争质量门未通过",
    "gate-cost": "成本质量门未通过",
    "gate-risk": "风险质量门未通过",
    "adopt-busy": "采纳提交中",
    "adopt-conflict": "提交时质量门变化",
    "adopt-refreshed": "冲突刷新后的新状态",
    "adopt-decided": "采纳成功与验证任务",
    "observe-edited": "观察原因已填",
    "observe-busy": "观察提交中",
    "observe-failed": "观察失败保留",
    "observe-decided": "观察决定返回",
    "reject-edited": "驳回原因已填",
    "reject-busy": "驳回提交中",
    "reject-failed": "驳回失败保留",
    "reject-decided": "驳回决定返回",
    "decided-no-links": "决定已存但无关联 ID",
    "next-input": "开始下一次的空草稿",
  };
  const kinds = { keyword: "关键词", asin: "ASIN", product_url: "商品链接" };
  const titles = {
    accepted: "任务已接收",
    running: "来源处理中",
    result_ready: "可验证结果已到达",
    succeeded_empty: "来源返回空结果",
    blocked: "来源明确受阻",
    failed: "任务终止失败",
    decided: "决定已保存",
  };
  const stageNames = {
    queued: "已排队",
    collecting: "正在收集",
    parsing: "正在整理",
    decision: "等待决策",
  };
  const statusNames = { waiting: "等待", active: "处理中", completed: "已完成", blocked: "受阻" };
  const actionNames = { adopt: "采纳", observe: "继续观察", reject: "驳回" };
  const gateNames = {
    score: "评分",
    market: "市场",
    competition: "竞争",
    cost: "成本",
    risk: "风险",
  };
  const selectedCandidate = () => candidates().find((v) => v.raw_evidence_id === s.selected);
  const canAdopt = () => {
    const c = selectedCandidate();
    return Boolean(
      c?.topic_id &&
      c.opportunity_id &&
      c.selection_stage === "recommended" &&
      c.quality_gates?.all_passed === true &&
      Object.keys(gateNames).every((k) => c.quality_gates[k] === true),
    );
  };
  function qualityView() {
    const c = selectedCandidate();
    if (!c)
      return '<div class="gate-summary"><strong>先选择一条候选</strong><p>核对所选机会的质量门后，再记录决定。</p></div>';
    if (!c.opportunity_id)
      return '<div class="gate-summary"><strong>尚无已评估机会</strong><p>此候选暂不能采纳；可继续观察或驳回。已有主题不等于评估完成。</p></div>';
    const passed = Object.keys(gateNames).filter((k) => c.quality_gates?.[k] === true).length;
    return `<section class="gate-summary" aria-label="采纳质量门"><header><strong>采纳质量门</strong><b>${passed} / 5</b></header><ul>${Object.entries(
      gateNames,
    )
      .map(
        ([k, label]) =>
          `<li data-passed="${c.quality_gates?.[k] === true}"><span>${label}</span><b>${c.quality_gates?.[k] === true ? "已通过" : "待补齐"}</b></li>`,
      )
      .join(
        "",
      )}</ul><p>${canAdopt() ? "五门已通过，且满足待决策、有效规则与来源门槛。提交时服务端仍会复核。" : "暂不可采纳。请在机会列表补齐评估，刷新后再核对；五门全过仍需满足待决策、有效规则与来源门槛。"}</p></section>`;
  }
  const btn = (action, label, cls = "", disabled = false) =>
    `<button type="button" data-action="${action}" class="${cls}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const link = (href, label, external = false) =>
    `<a href="${e(href)}" ${external ? 'target="_blank" rel="noopener noreferrer" data-source="true"' : ""}>${label}</a>`;
  let s,
    revision = 0;
  const candidates = () =>
    s.journey?.results?.length
      ? s.journey.results
      : s.journey?.first_result
        ? [s.journey.first_result]
        : [];
  function apply(next) {
    s.journey = clone(next);
    const items = candidates();
    if (!items.some((v) => v.raw_evidence_id === s.selected))
      s.selected = items.length === 1 ? items[0].raw_evidence_id : "";
    s.savedId = next.state === "decided" ? null : next.id;
  }
  function timeline() {
    return `<details ${s.timelineOpen ? "open" : ""}><summary>查看处理时间轴</summary><ol class="timeline">${s.journey.timeline.map((step) => `<li data-status="${step.status}"><i aria-hidden="true"></i><span><b>${stageNames[step.stage]}</b><small>${statusNames[step.status]}</small></span><time>${step.occurred_at ? e(new Date(step.occurred_at).toLocaleString("zh-CN", { hour12: false })) : "等待前序步骤"}</time></li>`).join("")}</ol></details>`;
  }
  function inputView() {
    return `<div class="j-input-layout"><form class="j-surface j-form" id="create-form"><h3>先提供一个商品线索</h3><fieldset ${s.busy || s.reading ? "disabled" : ""}><legend>输入类型</legend><div class="choices">${Object.entries(
      kinds,
    )
      .map(
        ([kind, name]) =>
          `<label class="radio"><input type="radio" name="kind" value="${kind}" ${s.form.input_kind === kind ? "checked" : ""} /><span>${name}</span></label>`,
      )
      .join(
        "",
      )}</div></fieldset><label>${s.form.input_kind === "keyword" ? "商品关键词" : s.form.input_kind === "asin" ? "10 位 ASIN" : "HTTPS 商品链接"}<input name="input_value" type="${s.form.input_kind === "product_url" ? "url" : "text"}" ${s.form.input_kind === "asin" ? 'pattern="[A-Za-z0-9]{10}"' : ""} value="${e(s.form.input_value)}" required maxlength="200" ${s.busy || s.reading ? "disabled" : ""} ${s.fieldError ? 'aria-invalid="true" aria-describedby="field-error"' : 'aria-describedby="input-hint"'} /><small id="input-hint" class="field-hint">三类输入均使用当前合规的 Google 新闻来源，不承诺直接获得平台商品价格。</small>${s.fieldError ? `<small class="field-error" id="field-error">${e(s.fieldError)}</small>` : ""}</label><p class="field-hint">创建只会提交采集任务，不代表结果已到达或机会已采纳。离开页面不会取消后台任务。</p><button class="primary" type="submit" ${s.busy || s.reading ? "disabled" : ""}>${s.busy ? "正在创建任务…" : s.reading ? "正在恢复进度…" : "创建选品任务"}</button></form><aside class="j-surface aside-note"><h3>接下来会发生什么</h3><ol><li>系统接收线索，创建可追溯的采集任务。</li><li>返回来源证据、空结果或明确失败原因。</li><li>你核对证据与质量门，再记录采纳、观察或驳回决定。</li></ol><p class="field-hint">采纳必须满足与机会详情一致的五项质量门。页面不会编造评分、利润或来源结果。</p></aside></div>`;
  }
  function decisionView() {
    const taskReady = d.taskTerminal.includes(s.journey.task_status);
    return `<form class="j-surface decision-panel" id="decision-form"><p class="meta">人工判断</p><h3>记录本次决定</h3><p class="field-hint">已选 ${s.selected ? "1" : "0"} 条候选。观察与驳回不提交候选 ID，但仍可能返回验证任务。</p>${qualityView()}
      ${taskReady ? "" : '<div class="notice error">任务仍在处理。旅程超时不等于任务终止；此时后端会拒绝决定，先重新读取进度。</div>'}
      <fieldset ${s.busy || s.reading || !taskReady ? "disabled" : ""}><legend>决定方式</legend><div class="choices"><label class="radio"><input type="radio" name="decision" value="adopt" ${s.decision.action === "adopt" ? "checked" : ""} ${canAdopt() ? "" : "disabled"} /><span>采纳合格机会</span></label>${["observe", "reject"].map((action) => `<label class="radio"><input type="radio" name="decision" value="${action}" ${s.decision.action === action ? "checked" : ""} /><span>${actionNames[action]}</span></label>`).join("")}</div></fieldset>
      <label>决策原因<textarea name="reason" required maxlength="1000" ${s.busy || s.reading || !taskReady ? "disabled" : ""} ${s.reasonError ? 'aria-invalid="true" aria-describedby="reason-error"' : ""}>${e(s.decision.reason)}</textarea>${s.reasonError ? `<small id="reason-error" class="field-error">${e(s.reasonError)}</small>` : ""}</label>
      <button type="submit" class="${s.decision.action === "reject" ? "danger" : "primary"}" ${s.busy || s.reading || !taskReady || (s.decision.action === "adopt" && !canAdopt()) ? "disabled" : ""}>${s.busy ? "正在保存…" : "保存审计决策"}</button><p class="field-hint">原因随决定记录，不改写原始证据。只有返回关联 ID，才展示对应机会或任务链接。</p></form>`;
  }
  function journeyView() {
    const j = s.journey,
      items = candidates(),
      terminal = ["result_ready", "succeeded_empty", "blocked", "failed", "decided"].includes(
        j.state,
      );
    const records = items.length
      ? `<section class="j-surface"><h3>核对 ${items.length} 条可展示候选</h3><p class="field-hint">任务报告 ${j.available_result_count} 条；本页返回 ${items.length} 条，最多展示 20 条。不是分页总数。</p>${items.map((v, i) => `<article class="candidate"><label class="radio"><input type="radio" name="candidate" value="${v.raw_evidence_id}" ${s.selected === v.raw_evidence_id ? "checked" : ""} ${s.busy || s.reading ? "disabled" : ""} /><span><small>候选 ${i + 1}</small><strong>${e(v.title || "真实来源记录")}</strong><small>${e(v.publisher || "来源未提供发布者")} · ${e(new Date(v.observed_at).toLocaleString("zh-CN", { hour12: false }))}</small></span></label>${v.topic_id ? "" : "<p>尚未形成主题，不能据此生成机会；仍可记录观察或驳回。</p>"}${link(v.canonical_url, "查看来源原文 ↗", true)}</article>`).join("")}</section>`
      : "";
    const empty =
      !items.length && terminal && j.state !== "decided"
        ? `<section class="j-surface j-empty"><h3>${j.state === "failed" ? "任务已失败，没有可展示证据" : j.task_status === "succeeded_empty" ? "没有返回可用结果" : j.task_status === "running" ? "旅程超时，采集任务仍在处理" : "来源受阻，没有可展示证据"}</h3><p>任务状态：${e(j.task_status)}</p>${j.blocked_reason ? `<p class="as-technical">原因码：${e(j.blocked_reason)}</p><dl class="facts"><div><dt>责任人</dt><dd>${e(j.blocked_owner || "采集负责人")}</dd></div><div><dt>下一步</dt><dd>${e(j.blocked_next_step || "查看失败根因后再处理。")}</dd></div></dl>` : '<p class="field-hint">无结果不是零分，也不生成可靠 ROI。</p>'}</section>`
        : "";
    const complete = j.decision
      ? `<article class="j-surface completion"><p class="meta">服务端返回的决定记录</p><h3>${actionNames[j.decision.action] || e(j.decision.action)}</h3><blockquote>${e(j.decision.reason)}</blockquote><p class="field-hint">${e(new Date(j.decision.created_at).toLocaleString("zh-CN", { hour12: false }))}</p><div class="actions">${j.opportunity_id ? link(`/opportunities/${j.opportunity_id}`, "查看机会、证据与历史 ↗") : ""}${j.verification_task_id ? link(`/tasks/${j.verification_task_id}`, "打开验证任务 ↗") : ""}</div>${!j.opportunity_id && !j.verification_task_id ? '<p class="field-hint">本次返回未提供关联机会或任务 ID，不生成猜测链接。</p>' : ""}</article>`
      : "";
    return `<section class="j-surface"><header class="j-progress"><div><p class="meta">当前旅程</p><h3>${titles[j.state]}</h3></div><div><strong>${Math.ceil(j.elapsed_ms / 1000)} 秒</strong><p class="field-hint">服务端已报告时长</p></div></header><dl class="facts"><div><dt>原始输入</dt><dd>${kinds[j.input_kind]} · ${e(j.input_value)}</dd></div><div><dt>来源</dt><dd>${j.provider_code === "google_news_search" ? "Google 新闻" : e(j.provider_code)}</dd></div><div><dt>任务报告结果</dt><dd>${j.available_result_count} 条</dd></div></dl>${timeline()}</section>${empty}${j.state !== "decided" ? `<div class="results-layout">${records}${terminal ? decisionView() : '<aside class="j-surface"><h3>等待下一次实际返回</h3><p>已有证据不代表采集已结束。任务进入终态前不开放决定。</p><p class="field-hint">真实页面成功读取后按既有 2 秒间隔轮询。本稿只通过顶部审核按钮推进隔离样例，不运行后台采集。</p></aside>'}</div>` : complete}<footer class="j-footer"><p class="as-technical">关联编号 ${e(j.request_id)}<br />开始下一次不取消或重放本次后台任务。</p>${btn("reset", "开始下一次", "", s.busy)}</footer>`;
  }
  function render(focus) {
    const step = !s.journey
      ? 1
      : s.journey.state === "decided"
        ? 4
        : ["accepted", "running"].includes(s.journey.state)
          ? 2
          : 3;
    const oldY = scrollY;
    const recovery = s.error
      ? `<div class="actions">${btn(s.journey || s.savedId ? "retry" : "reset", s.journey || s.savedId ? "重试读取进度" : "重新输入", "", s.busy || s.reading)}${s.error === "expired" ? "" : btn("explain", s.error === "forbidden" ? "查看权限说明" : s.error === "blocked" ? "查看影响" : "返回上一页")}</div>`
      : "";
    document.querySelector("#app").innerHTML =
      `<div class="j-layout"><aside class="j-rail"><small>选品 / 新旅程</small><h1>从线索到判断</h1><ol aria-label="工作阶段">${["输入线索", "来源处理", "审阅候选", "决定记录"].map((label, i) => `<li ${step === i + 1 ? 'aria-current="step"' : ""}><b>${i + 1}</b><span>${label}</span></li>`).join("")}</ol><p>当前阶段来自任务返回。页面不会以装饰进度或本地计时冒充真实完成。</p></aside><main class="j-work" id="work" tabindex="-1" aria-busy="${s.busy || s.reading}"><header class="j-head"><div><p class="meta">创建选品 · 当前会话工作区</p><h2>${s.journey ? "核对这次选品进展" : "开始一次选品"}</h2><p>一条线索，一次可追溯的任务。证据和人工判断分开记录。</p></div>${link("/opportunities", "返回机会列表")}</header>${s.message ? `<div class="notice ${s.error ? "error" : "success"}" role="${s.error ? "alert" : "status"}" tabindex="-1"><strong>${e(s.message)}</strong>${recovery}</div>` : ""}${s.reading ? '<div class="notice" role="status">正在读取已存在的旅程；此时不能创建或保存决定。</div>' : ""}${s.journey ? journeyView() : inputView()}</main></div>`;
    document.querySelector("#advance").disabled =
      s.busy || s.reading || !s.journey || !["accepted", "running"].includes(s.journey.state);
    if (focus) {
      document.querySelector(focus)?.focus({ preventScroll: true });
      scrollTo(0, oldY);
    }
  }
  function later(intent, success, fail) {
    if (s.busy || s.reading) return;
    s.lastIntent = clone(intent);
    s.intents.push(clone(intent));
    s.busy = true;
    s.message = "";
    s.error = "";
    const current = revision,
      fails = s.failNext;
    s.failNext = false;
    render();
    setTimeout(() => {
      if (current !== revision) return;
      s.busy = false;
      if (fails) {
        s.message = fail;
        s.error = "error";
      } else success();
      render();
      document.querySelector(s.error ? '[role="alert"]' : "#work")?.focus();
    }, 350);
  }
  function create(event) {
    event.preventDefault();
    if (s.busy || s.reading) return;
    const body = clone(s.form);
    let invalid = "";
    if (body.input_kind === "product_url") {
      const u = new URL(body.input_value);
      if (u.protocol !== "https:" || u.username || u.password || u.hash)
        invalid = d.urlErrors[0].hint;
    }
    if (invalid || !body.input_value.trim()) s.failNext = true;
    later(
      { method: "POST", path: "/selection-journeys", body },
      () => {
        apply({
          ...clone(d.sample),
          input_kind: body.input_kind,
          input_value: body.input_value.trim(),
          state: "accepted",
          task_status: "queued",
          results: [],
          first_result: null,
          available_result_count: 0,
          elapsed_ms: 0,
          terminal_at: null,
          timeline: d.sample.timeline.map((v, i) => ({
            ...v,
            status: i === 0 ? "completed" : "waiting",
            occurred_at: i === 0 ? d.sample.accepted_at : null,
          })),
        });
        s.error = "";
        s.message = "任务已接收，尚未获得终态。这里只显示隔离返回。";
      },
      invalid || "创建未获得成功确认；输入已保留，请核对结果后显式重试。",
    );
  }
  function decide(event) {
    event.preventDefault();
    if (
      s.busy ||
      s.reading ||
      !s.journey ||
      !d.taskTerminal.includes(s.journey.task_status) ||
      (s.decision.action === "adopt" && !canAdopt())
    )
      return;
    if (!s.decision.reason.trim()) {
      s.reasonError = "请填写非空决策原因。";
      render('[name="reason"]');
      return;
    }
    const body = {
      ...s.decision,
      selected_raw_evidence_id: s.decision.action === "adopt" ? s.selected : null,
    };
    const opportunityId = body.action === "adopt" ? selectedCandidate().opportunity_id : null;
    const gateConflict = body.action === "adopt" && Boolean(s.refreshedJourney);
    if (gateConflict) s.failNext = true;
    later(
      { method: "POST", path: `/selection-journeys/${s.journey.id}/decisions`, body },
      () => {
        apply({
          ...s.journey,
          state: "decided",
          decided_at: d.sample.accepted_at,
          decision: {
            ...body,
            reason: body.reason.trim(),
            actor_id: "00000000-0000-4000-8000-000000007640",
            created_at: d.sample.accepted_at,
          },
          opportunity_id: opportunityId,
          verification_task_id: "00000000-0000-4000-8000-000000007630",
        });
        s.decision.reason = "";
        s.error = "";
        s.message = opportunityId
          ? "合格机会已采纳；机会及验证任务按返回 ID 展示。"
          : "决定已保存；未生成机会。验证任务按返回 ID 展示。";
      },
      gateConflict
        ? "服务端已拒绝采纳：成本质量门发生变化。原因已保留，请刷新后再核对。"
        : "决定未获得成功确认；原因保留，未自动重放。",
    );
  }
  function reset() {
    if (s.busy) return;
    revision++;
    s.journey = null;
    s.savedId = null;
    s.selected = "";
    s.form.input_value = "";
    s.decision = clone(d.defaults.decision);
    s.reading = false;
    s.error = "";
    s.message = "已开始下一次；上一任务没有被取消。决定草稿已清空（待审提案）。";
    s.reasonError = "";
    render('[name="input_value"]');
  }
  function scene(name) {
    revision++;
    s = {
      scene: name,
      form: clone(d.defaults.form),
      decision: clone(d.defaults.decision),
      journey: null,
      selected: "",
      savedId: null,
      busy: false,
      reading: false,
      error: "",
      message: "",
      fieldError: "",
      reasonError: "",
      failNext: false,
      intents: [],
      lastIntent: null,
      navigation: null,
      timelineOpen: false,
    };
    if (name.startsWith("asin")) s.form.input_kind = "asin";
    if (name.startsWith("url")) s.form.input_kind = "product_url";
    if (name.endsWith("edited") || name.endsWith("create-busy") || name === "create-failed")
      s.form.input_value = d.values[s.form.input_kind];
    if (name.endsWith("create-busy")) s.busy = true;
    if (name === "create-failed") {
      s.error = "error";
      s.message = "创建未获得成功确认，原输入保留。";
      s.failNext = true;
    }
    if (name === "url-rejected") {
      s.form.input_value = d.urlErrors[0].input_value;
      s.fieldError = d.urlErrors[0].hint;
      s.error = "error";
      s.message = "服务端拒绝此商品链接，请修正后重试。";
    }
    if (name.endsWith("restoring") || name.startsWith("restore-") || name === "retry-busy") {
      s.savedId = d.sample.id;
      s.reading = name.endsWith("restoring");
      if (!s.reading) {
        s.error = name.slice(8);
        s.message = `上次旅程恢复失败（${s.error === "expired" ? "登录已过期" : s.error === "forbidden" ? "当前范围无权访问" : "读取暂不可用"}）。活动 ID 保留，不自动创建。`;
      }
      if (name === "retry-busy") {
        s.reading = true;
        s.error = "error";
        s.message = "重试已发出，正在读取上次旅程；不会创建新任务。";
      }
    }
    if (name === "invalid-id" || name === "missing-id")
      s.message =
        name === "invalid-id"
          ? "非法活动 ID 已移除，没有发起旅程读取或创建。"
          : "恢复返回 404；只清除活动 ID，未创建新任务。";
    const inputs = [
      "keyword",
      "asin",
      "url",
      "keyword-edited",
      "asin-edited",
      "url-edited",
      "keyword-required",
      "asin-invalid",
      "url-invalid",
      "asin-restoring",
      "url-restoring",
      "asin-create-busy",
      "url-create-busy",
      "create-busy",
      "create-failed",
      "url-rejected",
      "restoring",
      "retry-busy",
      "restore-failed",
      "restore-expired",
      "restore-forbidden",
      "restore-blocked",
      "invalid-id",
      "missing-id",
      "next-input",
    ];
    if (!inputs.includes(name)) apply(d.sample);
    if (["accepted", "running", "running-evidence"].includes(name)) {
      const j = clone(d.sample);
      j.state = name === "accepted" ? "accepted" : "running";
      j.task_status = name === "accepted" ? "queued" : "running";
      j.terminal_at = null;
      j.elapsed_ms = name === "accepted" ? 0 : 8000;
      if (name !== "running-evidence") {
        j.results = [];
        j.available_result_count = 0;
      }
      j.timeline = j.timeline.map((v, i) => ({
        ...v,
        status: i === 0 ? "completed" : i === 1 && name !== "accepted" ? "active" : "waiting",
        occurred_at: i === 0 || (i === 1 && name !== "accepted") ? v.occurred_at : null,
      }));
      apply(j);
      s.timelineOpen = true;
    }
    if (name === "read-busy") s.reading = true;
    if (["read-failed", "read-expired", "read-forbidden", "read-blocked"].includes(name)) {
      s.error = name.slice(5);
      s.message = "当前读取失败，以下保留最近一次返回，不代表最新状态。不会自动重复提交任务。";
    }
    if (
      [
        "selected",
        "adoption-pending",
        "observe-edited",
        "observe-busy",
        "observe-failed",
        "reject-edited",
        "reject-busy",
        "reject-failed",
      ].includes(name)
    )
      s.selected = d.sample.results[1].raw_evidence_id;
    if (name === "no-topic") s.selected = d.sample.results[0].raw_evidence_id;
    if (name.startsWith("adopt-") || name.startsWith("gate-")) {
      s.journey.results[1] = clone(d.qualified);
      s.selected = d.qualified.raw_evidence_id;
      s.decision = { action: "adopt", reason: "  核对来源后继续验证  " };
      if (name.startsWith("gate-"))
        s.journey.results[1] = clone(d.missingGates[name.slice(5)].candidate);
      if (name === "adopt-busy") s.busy = true;
      if (name === "adopt-conflict" || name === "adopt-refreshed") {
        s.refreshedJourney = clone(s.journey);
        s.refreshedJourney.results[1] = clone(d.missingGates.cost.candidate);
        if (name === "adopt-refreshed") apply(s.refreshedJourney);
        else {
          s.error = "blocked";
          s.message =
            "服务端已拒绝采纳：成本质量门发生变化。原因已保留；下方为上次读取状态，请刷新后再核对。";
        }
      }
      if (name === "adopt-decided") {
        apply({
          ...s.journey,
          state: "decided",
          opportunity_id: d.qualified.opportunity_id,
          verification_task_id: "00000000-0000-4000-8000-000000007630",
          decision: {
            action: "adopt",
            reason: s.decision.reason.trim(),
            selected_raw_evidence_id: s.selected,
            created_at: d.sample.accepted_at,
          },
        });
        s.decision.reason = "";
      }
    }
    if (name === "single-result")
      apply({ ...d.sample, results: [d.sample.results[1]], available_result_count: 1 });
    if (name === "first-result")
      apply({
        ...d.sample,
        results: [],
        first_result: d.sample.results[0],
        available_result_count: 1,
      });
    if (name === "missing-fields") {
      s.journey.results[0].title = null;
      s.journey.results[0].publisher = null;
    }
    if (name === "long-result") {
      s.journey.results[1].title =
        "用于移动排版的长标题：便携式搅拌机线索 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789，需要核对原始来源、发布时间与主题归属，不能从标题推断销量或利润。";
      s.journey.results[1].canonical_url =
        "https://example.test/a-very-long-product-path-without-real-product-data";
    }
    if (name === "twenty-results") {
      s.journey.results = Array.from({ length: 20 }, (_, i) => ({
        ...d.sample.results[1],
        raw_evidence_id: `00000000-0000-4000-8000-${String(7700 + i).padStart(12, "0")}`,
        title: `合成候选 ${i + 1} · 排版检查`,
        canonical_url: `https://example.test/layout-${i + 1}`,
      }));
      s.journey.available_result_count = 28;
    }
    if (name === "timeline") s.timelineOpen = true;
    if (["empty", "blocked", "failed", "deadline-running"].includes(name)) {
      const j = clone(d.sample);
      j.results = [];
      j.available_result_count = 0;
      j.state = name === "empty" ? "succeeded_empty" : name === "failed" ? "failed" : "blocked";
      j.task_status =
        name === "empty"
          ? "succeeded_empty"
          : name === "failed"
            ? "failed_terminal"
            : name === "deadline-running"
              ? "running"
              : "blocked_robots";
      j.blocked_reason =
        name === "empty"
          ? null
          : name === "deadline-running"
            ? "selection_deadline_exceeded"
            : j.task_status;
      j.blocked_owner = j.blocked_reason ? "隔离采集负责人" : null;
      j.blocked_next_step = j.blocked_reason ? "核对来源准入及任务事件后处理，不自动重放。" : null;
      j.timeline = j.timeline.map((v, i) => ({
        ...v,
        status: i < 1 ? "completed" : i === 1 ? "blocked" : "waiting",
        occurred_at: i <= 1 ? v.occurred_at : null,
      }));
      if (name === "empty") j.timeline = clone(d.sample.timeline);
      if (name === "deadline-running") {
        j.elapsed_ms = 181000;
        j.within_deadline = false;
        j.terminal_at = null;
      }
      apply(j);
    }
    for (const action of ["observe", "reject"])
      if (name.startsWith(`${action}-`)) {
        s.decision.action = action;
        s.decision.reason = "  核对来源后继续验证  ";
        if (name.endsWith("busy")) s.busy = true;
        if (name.endsWith("failed")) {
          s.error = "error";
          s.message = "决定未获得成功确认；保留原因，不自动重放。";
          s.failNext = true;
        }
        if (name.endsWith("decided")) {
          apply({
            ...d.sample,
            state: "decided",
            decision: {
              action,
              reason: s.decision.reason.trim(),
              selected_raw_evidence_id: null,
              created_at: d.sample.accepted_at,
            },
            opportunity_id: null,
            verification_task_id: "00000000-0000-4000-8000-000000007630",
          });
          s.decision.reason = "";
        }
      }
    if (name === "decided-no-links")
      apply({
        ...d.sample,
        state: "decided",
        decision: {
          action: "observe",
          reason: "核对来源后继续验证",
          selected_raw_evidence_id: null,
          created_at: d.sample.accepted_at,
        },
      });
    if (name === "next-input") {
      s.form.input_kind = "asin";
      s.message = "已开始下一次，上一任务未取消。输入类型保留，决定草稿清空（提案）。";
    }
    if (name === "keyword-required") s.fieldError = "请填写商品线索。";
    if (name === "asin-invalid") {
      s.form.input_value = "short";
      s.fieldError = "ASIN 必须为 10 位字母或数字。";
    }
    if (name === "url-invalid") {
      s.form.input_value = "not-a-url";
      s.fieldError = "请填写有效的商品链接。";
    }
    if (name === "reason-required") {
      s.decision.reason = "";
      s.reasonError = "请填写非空决策原因。";
    }
    render();
    document.querySelector("#scene").value = name;
  }
  function advance() {
    if (!s.journey || s.busy || s.reading || !["accepted", "running"].includes(s.journey.state))
      return;
    const original = { input_kind: s.journey.input_kind, input_value: s.journey.input_value };
    s.lastIntent = { method: "GET", path: `/selection-journeys/${s.journey.id}` };
    apply({ ...d.sample, ...original });
    s.message = "隔离下一次返回：任务进入结果终态。不是实时采集证据。";
    render();
  }
  document.querySelector("#scene").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  document.querySelector("#scene").addEventListener("change", (event) => scene(event.target.value));
  document.querySelector("#advance").addEventListener("click", advance);
  document.addEventListener(
    "invalid",
    (event) => {
      const field = event.target;
      if (!["input_value", "reason"].includes(field.name)) return;
      event.preventDefault();
      if (field.name === "reason") s.reasonError = "请填写非空决策原因。";
      else
        s.fieldError = field.validity.valueMissing
          ? "请填写商品线索。"
          : field.validity.patternMismatch
            ? "ASIN 必须为 10 位字母或数字。"
            : "请填写有效的商品链接。";
      render(`[name="${field.name}"]`);
    },
    true,
  );
  document.addEventListener("input", (event) => {
    if (event.target.name === "input_value") s.form.input_value = event.target.value;
    if (event.target.name === "reason") s.decision.reason = event.target.value;
    const field = event.target;
    if (
      ["input_value", "reason"].includes(field.name) &&
      field.validity.valid &&
      field.value.trim()
    ) {
      const reason = field.name === "reason";
      if (reason) s.reasonError = "";
      else s.fieldError = "";
      document.querySelector(reason ? "#reason-error" : "#field-error")?.remove();
      field.removeAttribute("aria-invalid");
      if (reason) field.removeAttribute("aria-describedby");
      else field.setAttribute("aria-describedby", "input-hint");
    }
  });
  document.addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (name === "kind") {
      s.form.input_kind = value;
      s.fieldError = "";
    } else if (name === "decision") s.decision.action = value;
    else if (name === "candidate") s.selected = value;
    else return;
    render(`[name="${name}"][value="${value}"]`);
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "create-form") create(event);
    if (event.target.id === "decision-form") decide(event);
  });
  document.addEventListener("click", (event) => {
    const a = event.target.closest("a");
    if (a && !a.classList.contains("skip")) {
      event.preventDefault();
      s.navigation = a.getAttribute("href");
      if (!a.dataset.source) {
        s.message = `导航意图：${s.navigation}；未离开隔离图稿。`;
        render();
      }
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    if (button.dataset.action === "reset") reset();
    if (button.dataset.action === "explain") {
      if (!["blocked", "forbidden"].includes(s.error)) {
        s.navigation = "history.back";
        s.message = "返回上一页意图；未离开隔离图稿，也未取消后台任务。";
        render();
        return;
      }
      s.message =
        s.error === "forbidden"
          ? "创建/读取/决定分别要求 task:create / opportunity:read / opportunity:decide；联系管理员核对当前范围。"
          : "当前请求未获得确认；关闭不取消后台任务，也不会自动重放。";
      render();
    }
    if (button.dataset.action === "retry" && !s.busy && !s.reading) {
      const id = s.journey?.id || s.savedId;
      s.lastIntent = { method: "GET", path: `/selection-journeys/${id}` };
      s.reading = true;
      const ticket = revision;
      render();
      setTimeout(() => {
        if (ticket !== revision) return;
        s.reading = false;
        s.error = "";
        s.message = "已恢复上次进度（隔离返回）。";
        apply(s.refreshedJourney || d.sample);
        render();
      }, 350);
    }
  });
  for (const id of ["preview-theme", "preview-density"])
    document
      .getElementById(id)
      .addEventListener("change", () =>
        presentation(
          document.querySelector("#preview-theme").value,
          document.querySelector("#preview-density").value,
        ),
      );
  window.JOURNEY_C = { scenes, scene, state: () => clone(s), advance, presentation };
  presentation("deep-ocean", "standard");
  scene("keyword");
})();
