/* Standalone review prototype. All writes, navigation and data states stay in memory. */
(() => {
  const D = window.OP_DETAIL_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const label = (v) => D.labels.opportunityLabels[v] || v,
    time = (v) =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Shanghai",
      }).format(new Date(v));
  const core = ["overview", "evidence", "decisions"],
    tabs = [...D.labels.opportunityPrimaryTabs, ...D.labels.opportunitySecondaryTabs],
    actions = { adopt: "采纳", observe: "继续观察", reject: "驳回" };
  let s, timer, opener;
  const scenes = {
    "directory-open": "移动目录展开",
    recommended: "结论 / 建议采纳",
    collecting: "结论 / 无可靠数据",
    candidate: "结论 / 规则命中候选",
    early: "结论 / 提前人工处理",
    readonly: "结论 / 只读",
    technical: "运行信息展开",
    blockers: "补证 / 待创建任务",
    progress: "补证 / 进行中",
    cleared: "补证 / 已解除",
    redecision: "补证 / 可重新决定",
    long: "结论 / 长标题",
    "gate-summary-pending": "质量门 / 汇总尚未通过",
    "evidence-empty": "证据 / 无记录",
    evidence: "证据 / 两条来源",
    "evidence-20": "证据 / 20条",
    "evidence-40": "证据 / 展开到40",
    "evidence-41": "证据 / 展开到41",
    "evidence-long": "证据 / 长来源与标题",
    "history-empty": "历史 / 无决定",
    history: "历史 / 三种决定",
    "history-long": "历史 / 长原因",
    loading: "读取 / 加载中",
    empty: "读取 / 确认无数据",
    error: "读取 / 服务异常",
    forbidden: "读取 / 无权访问",
    expired: "读取 / 登录过期",
    blocked: "读取 / 受阻",
    "profit-error": "读取 / 利润依赖失败",
  };
  for (const [key, name] of Object.entries(D.gateLabels))
    scenes[`missing-${key}`] = `质量门 / 缺${name}`;
  for (const [action, name] of Object.entries(actions))
    for (const [state, text] of Object.entries({
      empty: "未填写",
      edited: "已填写",
      busy: "保存中",
      failed: "失败保留",
      success: "成功重读",
    }))
      scenes[`${action}-${state}`] = `${name} / ${text}`;
  scenes["decision-conflict"] = "决定 / 版本冲突";
  scenes["decision-unknown"] = "决定 / 结果未知";
  const recommended = () => ({
    ...clone(D.sample),
    ...clone(D.historical.recommendedBase),
    version: D.sample.version,
    evidence: clone(D.historical.evidence),
  });
  function base() {
    return {
      name: "recommended",
      detail: recommended(),
      tab: "overview",
      status: "ready",
      canDecide: true,
      visible: 20,
      early: false,
      technical: false,
      expanded: false,
      busy: false,
      action: "observe",
      reason: "",
      error: "",
      invalid: false,
      failedNext: false,
      unknown: false,
      conflict: false,
      modal: false,
      message: "",
      intents: [],
      lastIntent: null,
      navigation: null,
      reads: 0,
    };
  }
  function records() {
    return ["adopt", "observe", "reject"].map((action, i) => ({
      id: `layout-decision-${i}`,
      action,
      reason: [
        "核对当前证据后采纳，保留成本与风险复查。",
        "供应证据仍待补充，继续观察。",
        "当前证据不足以支持选品，记录驳回原因。",
      ][i],
      actor_id: D.sample.owner_id,
      created_at: D.sample.updated_at,
      opportunity_version: 3 - i,
    }));
  }
  function many(count) {
    return Array.from({ length: count }, (_, i) => ({
      ...clone(D.historical.evidence[i % 2]),
      id: `layout-evidence-${i}`,
      title: `布局样例 ${i + 1}：${D.historical.evidence[i % 2].title}`,
    }));
  }
  function scene(name) {
    clearTimeout(timer);
    if ($("#decision-dialog").open) $("#decision-dialog").close();
    s = base();
    s.name = name;
    $("#scene").value = name;
    if (["collecting", "early", "blockers", "progress", "evidence-empty"].includes(name))
      s.detail = clone(D.sample);
    if (name === "candidate")
      Object.assign(s.detail, {
        selection_stage: "rule_candidate",
        quality_gates: { ...s.detail.quality_gates, cost: false, risk: false, all_passed: false },
      });
    if (name.startsWith("missing-")) {
      s.detail.quality_gates[name.slice(8)] = false;
      s.detail.quality_gates.all_passed = false;
      s.detail.selection_stage = "rule_candidate";
    }
    if (name === "gate-summary-pending") s.detail.quality_gates.all_passed = false;
    if (name === "early") s.early = true;
    if (name === "readonly") s.canDecide = false;
    if (name === "technical") s.technical = true;
    if (["blockers", "progress", "cleared", "redecision"].includes(name)) {
      s.expanded = true;
      s.detail.redecision_ready = name === "redecision";
      s.detail.adoption_blockers = [
        {
          code: "evidence_insufficient",
          status: name === "blockers" ? "blocked" : name === "progress" ? "in_progress" : "cleared",
          next_action:
            name === "blockers"
              ? "补齐关联证据后再核对推荐条件。"
              : name === "progress"
                ? "补采进行中；完成后重新评分。"
                : "证据补齐，核对最新评分后由人工决定。",
          task_id: name === "blockers" ? null : D.taskId,
          progress_percent: name === "progress" ? 40 : null,
          task_status: null,
          score_job_status: null,
        },
      ];
    }
    if (name === "long")
      s.detail.name = "长标题布局样例：" + "核对来源、适配范围和关键证据后再决定。".repeat(7);
    if (name.startsWith("evidence")) {
      s.tab = "evidence";
      if (name === "evidence-empty") s.detail.evidence = [];
      if (["evidence-20", "evidence-40", "evidence-41"].includes(name)) {
        s.detail.evidence = many(41);
        s.visible = Number(name.slice(9));
      }
      if (name === "evidence-long") {
        s.detail.evidence[0].title = "超长证据布局样例：" + "核对原始来源而非AI摘要。".repeat(12);
        s.detail.evidence[0].publisher = "长来源布局样例".repeat(12);
      }
    }
    if (name.startsWith("history")) {
      s.tab = "decisions";
      s.detail.decisions = name === "history-empty" ? [] : records();
      if (name === "history-long") s.detail.decisions[0].reason = "长原因布局样例。\n".repeat(60);
    }
    if (
      ["loading", "empty", "error", "forbidden", "expired", "blocked", "profit-error"].includes(
        name,
      )
    )
      s.status = name;
    if (/^(adopt|observe|reject)-/.test(name) || name.startsWith("decision-")) {
      const [action, state] = name.split("-");
      s.action = actions[action] ? action : "observe";
      if (state === "success") {
        s.tab = "decisions";
        s.detail.decision_status = { adopt: "adopted", observe: "observing", reject: "rejected" }[
          action
        ];
        s.detail.decisions = [
          {
            ...records()[0],
            action,
            reason: D.decisionIntents[action].body.reason.trim(),
            opportunity_version: 4,
          },
        ];
        s.detail.version = 4;
        s.message = "模拟成功后重读：决定已记录，原始评分与证据不变。";
      } else {
        s.modal = true;
        s.reason = state === "empty" ? "" : D.decisionIntents[s.action].body.reason;
        s.busy = state === "busy";
        s.failedNext = state === "failed";
        s.conflict = state === "conflict";
        s.unknown = state === "unknown";
        if (s.failedNext || s.conflict || s.unknown) s.error = errorCopy();
      }
    }
    render();
    if (s.modal) showDialog(false);
    window.scrollTo(0, 0);
  }
  const canAdopt = () =>
    s.detail.selection_stage === "recommended" && s.detail.quality_gates.all_passed;
  const button = (text, action, extra = "") =>
    `<button type="button" data-action="${action}" ${extra}>${text}</button>`;
  function identity() {
    return `<header class="identity"><p class="meta"><span>${esc(s.detail.market)}</span><span>${esc(s.detail.category || "未分类")}</span><span>${esc(label(s.detail.source_type))}</span></p><h2>${esc(s.detail.name)}</h2><div class="meta"><span>更新 ${time(s.detail.updated_at)}（中国标准时间）</span><span>隔离样例，非真实商品评估</span></div><details id="technical" ${s.technical ? "open" : ""}><summary>运行信息</summary><dl class="technical"><div><dt>机会 ID</dt><dd>${esc(s.detail.id)}</dd></div><div><dt>数据版本</dt><dd>v${s.detail.version}</dd></div><div><dt>评分规则</dt><dd>${esc(s.detail.score_rule_version || "尚未计算")}</dd></div><div><dt>当前阶段停留</dt><dd>${s.detail.lifecycle_dwell_seconds} 秒</dd></div></dl></details></header>`;
  }
  function overview() {
    const d = s.detail,
      gates = d.quality_gates,
      passed = Object.keys(D.gateLabels).filter((k) => gates[k]).length,
      missing = Object.entries(D.gateLabels)
        .filter(([k]) => !gates[k])
        .map(([, v]) => v),
      ready = canAdopt();
    const title =
      d.selection_stage === "not_eligible" && !d.matched_rule_count
        ? label(d.decision_status)
        : label(d.selection_stage);
    const copy = ready
      ? "五项质量门全部通过，最终采纳仍由你决定。"
      : missing.length
        ? `仍有${missing.join("、")}质量门待完成；现在不能采纳。`
        : "各项显示通过，但汇总或推荐阶段尚未满足。刷新核对前不开放采纳。";
    const controls = s.canDecide
      ? ready
        ? `<div id="decision-actions" class="actions" tabindex="-1">${button("采纳建议", "adopt", 'class="primary"')}${button("继续观察", "observe")}${button("驳回", "reject", 'class="danger"')}</div>`
        : `<div class="waiting"><strong>尚未进入最终采纳队列</strong><p>先核对缺失项；如需提前处理，可记录观察或驳回原因。</p><details id="early" ${s.early ? "open" : ""}><summary>提前人工处理</summary><div id="decision-actions" class="actions" tabindex="-1">${button("继续观察", "observe")}${button("驳回", "reject", 'class="danger"')}</div></details></div>`
      : '<p class="waiting" role="status">当前角色可查看依据；记录决定需要“机会决策”权限。</p>';
    const unresolved = d.adoption_blockers.filter((b) => b.status !== "cleared");
    return `${d.redecision_ready ? '<div class="flag" role="status">补采与重新评分已完成，请核对后重新决定。<a href="#decision-actions" id="redecision">前往决定</a></div>' : ""}<section class="surface" aria-labelledby="system-verdict-title"><div class="verdict"><div><p class="meta">系统建议</p><h3 id="system-verdict-title">${esc(title)}</h3><p>${esc(copy)}</p><span class="human-state">人工决定：${esc(label(d.decision_status))}</span></div><dl class="facts"><div><dt>综合评分</dt><dd>${d.overall_score ?? "—"}</dd></div><div><dt>证据</dt><dd>${d.evidence_count} 条 / ${d.source_count} 源</dd></div><div><dt>风险</dt><dd>${esc(label(d.risk_level))}</dd></div></dl></div><div class="gates-heading"><h4>五项质量门</h4><strong>${passed} / 5 项显示通过</strong></div><ul class="gate-strip" aria-label="五项质量门">${Object.entries(
      D.gateLabels,
    )
      .map(
        ([k, v]) =>
          `<li data-pass="${gates[k]}"><span>${v}</span><b>${gates[k] ? "通过" : "待完成"}</b></li>`,
      )
      .join(
        "",
      )}</ul><p class="gate-explanation">通过数量不是采纳权限；还需汇总通过且处于“建议采纳”阶段。</p>${controls}</section>${d.adoption_blockers.length ? `<section class="surface"><h3>补证进度</h3>${unresolved.length ? `<div class="blocker-lead"><div><strong>仍有 ${unresolved.length} 个阻断项</strong><p>${esc(unresolved[0].next_action)}</p></div>${unresolved[0].task_id ? `<a class="link-button" data-local href="/tasks?task=${unresolved[0].task_id}">查看补采任务</a>` : s.canDecide ? button("创建补采任务", "create-task") : ""}</div>` : ""}<details id="blockers" ${s.expanded ? "open" : ""}><summary>查看判断条件与补证进度</summary>${d.adoption_blockers.map((b) => `<article class="blocker"><strong>${esc(label(b.code))}</strong><p>${{ blocked: "仍在阻断", in_progress: "解除中", cleared: "已解除" }[b.status]}：${esc(b.next_action)}</p>${b.progress_percent != null ? `<p>补采任务进度 ${b.progress_percent}%</p>` : ""}${b.task_id ? `<a class="link-button" data-local href="/tasks?task=${b.task_id}">查看任务</a>` : ""}</article>`).join("")}</details></section>` : ""}`;
  }
  function evidence() {
    const rows = s.detail.evidence.slice(0, s.visible),
      remaining = s.detail.evidence.length - rows.length;
    return `<section class="surface"><header class="surface-head"><h3>可追溯证据</h3><span>${s.detail.evidence.length} 条关联记录</span></header><p class="delivery-note">按返回顺序展示，不在浏览器重排。列表条数与汇总证据数可不同；原文链接在图稿中仅演示，不访问外网。</p>${rows.length ? rows.map((e, i) => `<article class="evidence-row"><span class="ordinal">${String(i + 1).padStart(2, "0")}</span><div><h4>${esc(e.title)}</h4><p>${esc(e.publisher)}</p><small>观测于 ${time(e.observed_at)}（中国标准时间）</small></div><a class="link-button" data-source href="${esc(e.canonical_url)}" target="_blank" rel="noopener noreferrer" aria-label="查看原文：${esc(e.title)}">查看原文 ↗</a></article>`).join("") : '<div class="blank"><h3>尚无关联证据</h3><p>没有原始证据时，不显示模拟分数或伪造来源。</p></div>'}${s.detail.evidence.length > 20 ? `<footer class="evidence-footer"><span>已显示 ${rows.length} / ${s.detail.evidence.length} 条</span>${rows.length > 20 ? button("收起到 20 条", "collapse") : ""}${remaining ? button(`继续显示 ${Math.min(20, remaining)} 条（剩余 ${remaining} 条）`, "more") : ""}</footer>` : ""}</section>`;
  }
  function history() {
    return `<section class="surface"><header class="surface-head"><h3>决策历史</h3><span>${s.detail.decisions.length} 条记录</span></header><p class="delivery-note">保留决定原因、版本与操作者；原始事实不随决定改写。以下为隔离布局记录，未发生真实写入。</p>${s.detail.decisions.length ? s.detail.decisions.map((d) => `<article class="history-row"><div><strong>${esc(label(d.action))}</strong><small>${time(d.created_at)}</small><small>机会版本 v${d.opportunity_version}</small></div><div><p>${esc(d.reason)}</p><small>操作者 ${esc(d.actor_id)}</small></div></article>`).join("") : '<div class="blank"><h3>尚无决策记录</h3><p>人工决定会在这里留下原因与版本；系统建议不等同于人工采纳。</p></div>'}</section>`;
  }
  function readState() {
    const text = {
      loading: ["正在读取机会", "详情和利润依赖读取完成后再展示工作面。"],
      empty: ["没有可展示的机会", "仅用于已确认空数据的状态；404或无权限不归为空。"],
      error: ["机会暂时无法读取", "当前读请求失败，请重试核对，不展示旧对象数据。"],
      forbidden: ["无法访问该机会", "请核对账号和工作区范围；重试不会增加权限。"],
      expired: ["登录已过期", "恢复会话后再重试，不代你执行真实登录。"],
      blocked: ["读取已受阻", "依赖或访问条件尚未满足，请先处理阻断。"],
      "profit-error": [
        "利润依赖读取失败",
        "现有主加载依赖利润接口，因此整个详情暂不可用；未擅自改成局部降级。",
      ],
    }[s.status];
    return `<section class="surface blank" role="status"><h3>${text[0]}</h3><p>${text[1]}</p><p class="meta">隔离请求 ui2-op-detail-review</p>${s.status !== "loading" ? button("重新读取", "retry", 'class="primary"') : ""}</section>`;
  }
  function render() {
    $("#sections").innerHTML = tabs
      .map(
        ([key, name]) =>
          `<a href="/opportunities/${s.detail.id}${key === "overview" ? "" : `?tab=${key}`}" data-tab="${key}" ${s.tab === key ? 'aria-current="page"' : ""}><span>${name}</span>${core.includes(key) ? "" : "<small>待设计</small>"}</a>`,
      )
      .join("");
    $("#directory").open = innerWidth > 600 || s.name === "directory-open";
    $("#directory-label").textContent =
      `核对内容：${tabs.find(([k]) => k === s.tab)?.[1] || "结论"}`;
    $("#work").setAttribute("aria-busy", String(s.busy || s.status === "loading"));
    $("#work").innerHTML =
      s.status !== "ready"
        ? readState()
        : `${identity()}${s.message ? `<p class="notice" role="status">${esc(s.message)}</p>` : ""}${s.tab === "overview" ? overview() : s.tab === "evidence" ? evidence() : s.tab === "decisions" ? history() : '<section class="surface blank"><h3>此分区图稿待接续</h3><p>已保留真实导航键，但未提供此分区的布局、业务操作或完成证明。</p></section>'}<p class="delivery-note">C 方向核心提案 · 状态与焦点保护待迁入 Vue；成本、风险、市场、竞争、AI、血缘和复盘仍待独立设计。具体图稿、73页实现与生产签收均未完成。</p>`;
    $("#work")
      .querySelectorAll("[data-action]")
      .forEach((b) => {
        if (s.busy && b.dataset.action !== "retry") b.disabled = true;
      });
  }
  function errorCopy() {
    return s.conflict
      ? "版本已变化。请关闭并重新读取机会，核对最新事实后再填写决定；本稿不自动覆盖版本。"
      : s.unknown
        ? "请求结果未知；关闭后先核对历史，不自动重发。图稿不保证未写入。"
        : "记录失败（隔离 503）。原因已保留；核对后可显式重试。请求 ui2-op-detail-review";
  }
  function syncDialog() {
    $("#decision-dialog-title").textContent = `记录${actions[s.action]}决定`;
    $("#decision-target").textContent = `${s.detail.name} / 数据版本 v${s.detail.version}`;
    $("#reason").value = s.reason;
    $("#reason").readOnly = s.busy;
    $("#reason").setAttribute("aria-invalid", String(s.invalid));
    $("#reason-count").textContent = `${s.reason.length} / 1000`;
    $("#reason-error").hidden = !s.invalid;
    $("#reason-error").textContent = "请填写非空原因，不超过 1000 字。";
    $("#write-error").hidden = !s.error;
    $("#write-error").textContent = s.error;
    $("#save-progress").hidden = !s.busy;
    $("#save").disabled = s.busy || s.conflict || s.unknown;
    $("#save").textContent = s.busy ? "保存中…" : "确认记录";
    $("#save").className = s.action === "reject" ? "danger" : "primary";
  }
  function showDialog(reset = true) {
    if (reset) {
      s.reason = "";
      s.error = "";
      s.invalid = false;
      s.conflict = false;
      s.unknown = false;
    }
    s.modal = true;
    syncDialog();
    $("#decision-dialog").showModal();
    $("#reason").focus();
  }
  function close() {
    s.modal = false;
    $("#decision-dialog").close();
    (opener?.isConnected ? opener : document.querySelector(`[data-action="${s.action}"]`))?.focus();
  }
  function recordIntent(intent) {
    s.lastIntent = clone(intent);
    s.intents.push(clone(intent));
  }
  $("#decision-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (s.busy || s.conflict || s.unknown) return;
    s.reason = $("#reason").value;
    if (!s.reason.trim() || s.reason.length > 1000) {
      s.invalid = true;
      syncDialog();
      $("#reason").focus();
      return;
    }
    recordIntent({
      method: "POST",
      path: `/opportunities/${s.detail.id}/decisions`,
      body: { action: s.action, reason: s.reason, expected_version: s.detail.version },
    });
    const action = s.action,
      reason = s.reason;
    s.busy = true;
    s.error = "";
    render();
    syncDialog();
    timer = setTimeout(() => {
      s.busy = false;
      if (s.failedNext) {
        s.failedNext = false;
        s.error = errorCopy();
        render();
        syncDialog();
        return;
      }
      close();
      s.reads++;
      s.detail.version++;
      s.detail.decision_status = { adopt: "adopted", observe: "observing", reject: "rejected" }[
        action
      ];
      s.detail.decisions.unshift({
        ...records()[0],
        action,
        reason: reason.trim(),
        opportunity_version: s.detail.version,
      });
      s.message = "模拟记录成功并重读；原始评分与证据不变。";
      render();
      $("#work").focus();
    }, 350);
  });
  $("#reason").addEventListener("input", (e) => {
    s.reason = e.target.value;
    s.invalid = false;
    $("#reason-count").textContent = `${s.reason.length} / 1000`;
    $("#reason").setAttribute("aria-invalid", "false");
    $("#reason-error").hidden = true;
  });
  $("#decision-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  $("#decision-dialog").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const list = [...$("#decision-dialog").querySelectorAll("button,textarea")].filter(
        (n) => !n.disabled,
      ),
      first = list[0],
      last = list.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("click", (e) => {
    const closeButton = e.target.closest("[data-close]");
    if (closeButton) return close();
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      e.preventDefault();
      if (s.busy) return;
      s.tab = tab.dataset.tab;
      s.navigation = {
        path: `/opportunities/${s.detail.id}`,
        query: { from: "/opportunities", ...(s.tab === "overview" ? {} : { tab: s.tab }) },
        replace: true,
      };
      s.visible = 20;
      render();
      return;
    }
    const source = e.target.closest("[data-source], [data-local], #return-link");
    if (source) {
      e.preventDefault();
      s.navigation = source.getAttribute("href");
      return;
    }
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled || s.busy) return;
    const a = b.dataset.action;
    if (actions[a]) {
      if (!s.canDecide || (a === "adopt" && !canAdopt())) return;
      opener = b;
      s.action = a;
      showDialog();
    } else if (a === "more") {
      s.visible = Math.min(s.visible + 20, s.detail.evidence.length);
      render();
    } else if (a === "collapse") {
      s.visible = 20;
      render();
      $("#work").focus();
    } else if (a === "retry") {
      s.lastIntent = { method: "GET", path: `/opportunities/${s.detail.id}` };
      s.status = "ready";
      s.reads++;
      render();
    } else if (a === "create-task") {
      recordIntent(D.taskIntent);
      s.busy = true;
      render();
      timer = setTimeout(() => {
        s.busy = false;
        s.reads++;
        s.navigation = clone(D.taskNavigation);
        s.message = "模拟创建/复用补数任务；真实流程将重读后进入任务详情，本图不跳转。";
        render();
      }, 350);
    }
  });
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, name]) => `<option value="${key}">${name}</option>`)
    .join("");
  $("#scene").addEventListener("change", (e) => scene(e.target.value));
  window.OP_DETAIL_C = {
    scenes,
    scene,
    state: () => clone(s),
    replaceEvidence: () => {
      s.detail.evidence = clone(s.detail.evidence);
      s.visible = 20;
      render();
    },
    changeOpportunity: () => {
      s.detail.id = "00000000-0000-4000-8000-000000000426";
      s.visible = 20;
      render();
    },
  };
  scene("recommended");
})();
