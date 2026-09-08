(() => {
  "use strict";
  const D = window.APPROVAL_C_DATA,
    $ = (v) => document.querySelector(v),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const statuses = { pending: "审批中", approved: "已批准", rejected: "已驳回", "": "全部" },
    labels = {
      ...statuses,
      cancelled: "已取消",
      waiting: "等待中",
      escalated: "已升级",
      draft: "草稿",
      published: "已发布",
      adopt: "采纳",
      observe: "观察",
      reject: "驳回",
      recommend: "推荐",
      not_recommend: "不推荐",
      unknown: "待识别",
      medium: "中",
      calculated: "已计算",
      in_progress: "进行中",
      approve: "批准",
      task: "任务",
      opportunity_decision: "机会决策",
    },
    text = (v) => (v == null || v === "" ? "未提供" : labels[v] || String(v)),
    time = (v) =>
      v
        ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
        : "未设置",
    percent = (v) => (v == null ? "不适用" : `${v}%`);
  const scenes = {
    normal: "队列 · 待我处理",
    requested: "队列 · 我发起的",
    empty: "筛选无结果",
    no_templates: "尚无已发布模板",
    readonly: "只有读取权限",
    loading: "正在读取",
    error: "服务读取失败",
    forbidden: "无权访问",
    expired: "登录已失效",
    rate_limited: "请求过于频繁",
    version_conflict: "版本已变化",
    member_error: "成员依赖读取失败",
    detail_loading: "详情正在读取",
    detail_missing: "详情不存在",
    detail_error: "详情读取失败",
    detail: "详情 · 提交与当前",
    evidence: "详情 · 提交证据",
    basis: "详情 · 依据和规则",
    nodes: "详情 · 节点与历史",
    technical: "详情 · 技术信息",
    decision: "详情 · 记录判断",
    unchanged: "对照无变化样例",
    removed: "规则与依据缺失样例",
    fallback: "历史无快照样例",
    task: "任务证据不适用样例",
    context_missing: "未提供审批依据样例",
    detail_readonly: "详情不可决定",
    terminal: "已结束只读样例",
    escalated: "节点升级样例",
    template: "模板草稿与已有模板",
    template_error: "模板失败保留",
    template_busy: "模板处理中",
    publish: "叠加发布确认",
    publish_error: "发布失败保留",
    publish_busy: "发布处理中",
    request: "发起审批",
    request_error: "发起失败保留",
    request_busy: "发起处理中",
    decision_error: "决定冲突保留原因",
    decision_busy: "决定处理中",
    pagination: "21条分页布局样例",
    long: "长标题与原因样例",
    controls: "审稿控件六态板",
  };
  let s,
    currentDetail = null,
    formKind = "",
    formTrigger = "",
    detailTrigger = "",
    publishTarget = null,
    intents = [],
    reasons = { decision: "", publish: "" },
    modes = { detail: "intent", template: "intent", request: "intent", publish: "intent" },
    messages = {},
    templateDraft,
    requestDraft;
  const types = { task: "任务", opportunity_decision: "机会决策" };
  const options = (object, current) =>
    Object.entries(object)
      .map(([k, v]) => `<option value="${k}" ${k === current ? "selected" : ""}>${esc(v)}</option>`)
      .join("");
  const memberOptions = (current) =>
    `<option value="">请选择当前工作区成员</option>${D.members.map((v) => `<option value="${v.id}" ${current === v.id ? "selected" : ""}>${esc(v.label)}</option>`).join("")}`;
  const published = () => s.templates.filter((v) => v.status === "published");
  const rows = () => s.rows.filter((r) => !s.status || r.status === s.status);
  const visible = () => rows().slice((s.page - 1) * 20, s.page * 20);
  function url() {
    const q = new URLSearchParams(s.extra);
    if (s.queue === "requested") q.set("view", "requested");
    if (s.status !== "pending") q.set("status", s.status);
    if (s.page > 1) q.set("page", String(s.page));
    if (currentDetail) q.set("approval", currentDetail.id);
    return "/tasks/approvals" + (q.size ? `?${q}` : "");
  }
  function sync() {
    const u = new URL(location.href);
    u.search = url().split("?")[1] || "";
    history.replaceState(null, "", u);
  }
  function safeReturn() {
    const value = s.extra.from;
    return typeof value === "string" &&
      (value === "/notifications" || value.startsWith("/notifications?"))
      ? value
      : "";
  }
  function navigation(route) {
    s.message = `离线导航预览：${route}。未请求页面或改变业务。`;
    render();
    const msg = $("#page-message");
    if (msg) msg.scrollIntoView({ block: "nearest" });
  }
  function mainRead() {
    const states = {
      loading: ["正在读取审批事实", "列表、模板及必要成员目录尚未完成，数量未知。"],
      error: ["审批服务暂不可用", "本次读取失败，不能显示为空队列。"],
      forbidden: ["无权访问审批", "请核对当前组织、工作区和读取权限。"],
      expired: ["登录已失效", "完成登录后重新加载。本稿不模拟登录成功。"],
      rate_limited: ["请求过于频繁", "请稍后重新加载，不推测服务端未给出的等待时间。"],
      version_conflict: ["审批版本已变化", "请重新读取最新状态再处理。"],
      member_error: [
        "成员依赖读取失败",
        "现有页面把列表、模板和成员一起读取；本稿保留整页失败边界，不伪装已完整加载。",
      ],
    };
    const copy = states[s.read];
    if (!copy) return "";
    return `<section class="empty" ${s.read === "loading" ? 'role="status" aria-busy="true"' : 'role="alert"'}><h2>${copy[0]}</h2><p>${copy[1]}</p>${s.read === "loading" ? '<div class="skeleton"></div><div class="skeleton short"></div>' : '<button id="reload">刷新最新状态</button>'}</section>`;
  }
  function render() {
    const unknown = s.read !== "ready",
      pageRows = visible(),
      mine = pageRows.filter((r) => r.can_decide).length,
      overdue = pageRows.filter(
        (r) => r.status === "pending" && r.due_at && new Date(r.due_at) < new Date(D.clock),
      ).length;
    $("#app").innerHTML =
      `<div class="layout"><aside class="directory" aria-label="审批范围"><div><h2>人工审批</h2><p>核对依据，再记录你的判断。<br>超时只升级审批人，不自动批准。</p></div><nav><button id="queue-decidable" data-queue="decidable" aria-pressed="${s.queue === "decidable"}">待我处理</button><button id="queue-requested" data-queue="requested" aria-pressed="${s.queue === "requested"}">我发起的</button></nav><div class="scope"><p>当前组织 / 工作区</p><p>“待我处理”只含到达本人当前节点的事项，所有写入仍需服务端授权。</p></div></aside><main class="surface"><header class="page-heading"><div><h1>审批中心</h1><p>先看提交依据与当前变化，再为本节点批准或驳回。</p></div><div class="header-actions">${s.canManage ? (published().length ? '<button id="manage">管理模板</button><button id="new-request" class="primary">＋ 发起审批</button>' : '<button id="manage" class="primary">配置模板</button>') : '<span class="hint">只有读取权限</span>'}</div></header>
      <section class="page-facts" aria-label="本页审批事实"><div><strong>${unknown ? "—" : mine} 项${s.canManage ? "本页可审批" : "本页节点匹配"}</strong><p>${s.canManage ? "只统计当前页，不代表全工作区" : "当前节点指向本人；没有写入权限"}</p></div><div><strong class="${overdue && !unknown ? "overdue" : ""}">${unknown ? "—" : overdue} 项本页超时</strong><p>演示时钟：2026/8/10 08:00</p></div></section>
      ${s.message ? `<p id="page-message" class="notice" role="status">${esc(s.message)}</p>` : ""}
      ${
        unknown
          ? mainRead()
          : `<nav class="filters" aria-label="审批状态">${Object.entries(statuses)
              .map(
                ([k, v]) =>
                  `<button id="status-${k || "all"}" data-status="${k}" aria-pressed="${s.status === k}">${v}</button>`,
              )
              .join(
                "",
              )}</nav><section class="list-top"><h2>${s.queue === "requested" ? "我发起的" : "待我处理"}</h2><span class="hint">筛选结果 ${rows().length} 项</span></section><div class="queue-list">${pageRows.length ? pageRows.map((item) => `<button class="queue-item" id="open-${item.id}" data-open="${item.id}"><div><span class="row-status">${text(item.status)}</span>${item.can_decide ? '<span class="can-decide">需要你处理</span>' : ""}<h3>${esc(item.title)}</h3><p>${esc(item.template_name)} · ${esc(item.current_node_name || "流程已结束")}</p></div><div class="deadline"><p>${item.escalated_at ? "节点已升级" : "处理期限"}</p><strong>${item.escalated_at ? "已转交超时接收人" : time(item.due_at)}</strong></div><span class="open-copy">核对依据</span></button>`).join("") : `<section class="empty"><h3>当前筛选没有审批记录</h3><p>${published().length ? "可切换范围或状态，也可使用已发布模板发起审批。" : "先配置并发布模板，再发起需要人工判断的流程。"}</p>${s.canManage ? `<button id="empty-action" class="primary">${published().length ? "发起审批" : "配置模板"}</button>` : ""}</section>`}</div>${rows().length > 20 ? `<nav class="pagination" aria-label="审批分页"><button id="previous" ${s.page <= 1 ? "disabled" : ""}>上一页</button><p>第 ${s.page} / ${Math.ceil(rows().length / 20)} 页 · 每页20项</p><button id="next" ${s.page >= Math.ceil(rows().length / 20) ? "disabled" : ""}>下一页</button></nav>` : ""}`
      }
      ${s.detailState ? `<section class="notice ${s.detailState === "loading" ? "" : "error"}" role="status">${{ loading: "正在读取审批详情…", missing: "该审批记录不存在或不属于当前工作区。", error: "审批详情读取失败，请重试。" }[s.detailState]}${s.detailState !== "loading" ? '<button id="dismiss-detail">关闭提示</button>' : ""}</section>` : ""}
      ${s.scene === "controls" ? '<section><h2>控件六态示意</h2><div class="control-board"><button>默认</button><button class="hover-demo">悬停</button><button class="focus-demo">聚焦</button><button class="active-demo">按下</button><button disabled>禁用</button><button disabled aria-busy="true">处理中…</button></div></section>' : ""}
      <p class="provenance">离线待审稿。${s.synthetic ? "扩展状态是合成布局样例。" : "列表和详情来自独立测试响应，不是一致数据库快照。"} 详情锁模板v3与目录v1、节点无升级与历史已升级、同ID不同展示名存在样例差异；原样保留，不据此推断真实流程。筛选仅演示当前样例，不代表服务端全量检索。</p></main></div>`;
    $("#manage")?.addEventListener("click", () => openForm("template", "manage"));
    $("#new-request")?.addEventListener("click", () => openForm("request", "new-request"));
    $("#empty-action")?.addEventListener("click", () =>
      openForm(published().length ? "request" : "template", "empty-action"),
    );
    document
      .querySelectorAll("[data-open]")
      .forEach((b) => (b.onclick = () => openDetail(b.dataset.open, b.id)));
    document.querySelectorAll("[data-status]").forEach(
      (b) =>
        (b.onclick = () => {
          closeDetail(false);
          s.status = b.dataset.status;
          s.page = 1;
          s.detailState = "";
          sync();
          render();
          document.getElementById(b.id).focus();
        }),
    );
    document.querySelectorAll("[data-queue]").forEach(
      (b) =>
        (b.onclick = () => {
          closeDetail(false);
          s.queue = b.dataset.queue;
          s.page = 1;
          s.detailState = "";
          sync();
          render();
          document.getElementById(b.id).focus();
        }),
    );
    ["previous", "next"].forEach((id) => {
      const b = document.getElementById(id);
      if (b)
        b.onclick = () => {
          s.page += id === "next" ? 1 : -1;
          sync();
          render();
          document.getElementById(id === "next" ? "previous" : "next").focus();
        };
    });
    $("#reload")?.addEventListener("click", () => {
      s.message = "离线重读意图已记录，未请求API，尚无新的读取结果。";
      render();
      $("#reload").focus();
    });
    $("#dismiss-detail")?.addEventListener("click", () => {
      s.detailState = "";
      render();
      document.querySelector("[data-open]")?.focus();
    });
  }
  function table(changes, basis = false) {
    return `<table class="change-table"><thead><tr><th>变化字段</th><th>提交时</th><th>当前</th></tr></thead><tbody>${changes.map((c) => `<tr><td>${esc(c.label)}</td><td><span>提交时</span>${esc(basis ? text(c.before) : (c.before_detail ?? c.before ?? "未提供"))}</td><td class="after"><span>当前</span>${esc(basis ? text(c.after) : (c.after_detail ?? c.after ?? "未提供"))}</td></tr>`).join("")}</tbody></table>`;
  }
  function openDetail(id, trigger = "") {
    const item = s.rows.find((v) => v.id === id);
    if (!item) {
      s.detailState = "missing";
      render();
      return;
    }
    detailTrigger = trigger || `open-${id}`;
    currentDetail = clone(s.detail);
    currentDetail.id = id;
    if (s.scene === "pagination") currentDetail.title = item.title;
    reasons.decision = "";
    messages.detail = "";
    sync();
    renderDetail();
    $("#detail-dialog").showModal();
    $("#detail-close").focus();
  }
  function closeDetail(restore = true) {
    currentDetail = null;
    reasons.decision = "";
    if ($("#detail-dialog").open) $("#detail-dialog").close();
    sync();
    if (restore) (document.getElementById(detailTrigger) || $("#queue-decidable"))?.focus();
  }
  function renderDetail() {
    const item = currentDetail,
      c = item.decision_context,
      diff = item.decision_context_diff,
      fallback = c?.snapshot_status === "live_fallback",
      canDecide = s.canManage && item.can_decide,
      busy = modes.detail === "busy";
    const tabs = {
      compare: "提交与当前",
      evidence: "证据明细",
      basis: "依据和规则",
      nodes: "节点与历史",
      decision: "记录判断",
    };
    $("#detail-dialog").innerHTML =
      `<header class="detail-header"><div><p>${esc(item.template_name)} · 锁定模板 v${item.approval_template_version ?? "未提供"} · ${text(item.status)}</p><h2 id="detail-title">${esc(item.title)}</h2></div><button id="detail-close" aria-label="关闭审批详情">关闭</button></header><div class="detail-body"><aside class="detail-index"><nav aria-label="审批详情目录">${Object.entries(
        tabs,
      )
        .map(
          ([k, v]) => `<button data-section="${k}" aria-current="${k === "compare"}">${v}</button>`,
        )
        .join("")}</nav></aside><div class="reading">
      <div class="resource-links">${c?.resource ? `<a data-route="${esc(c.resource.route)}" href="${esc(c.resource.route)}">查看${esc(c.resource.label)}</a>` : ""}${safeReturn() ? `<a data-route="${esc(safeReturn())}" href="${esc(safeReturn())}">返回通知中心</a>` : ""}</div>
      <section id="section-compare"><div class="section-title"><h3>${fallback ? "当前事实回退" : "提交快照与当前事实"}</h3><span class="hint">当前节点：${esc(item.current_node_name || "流程已结束")}</span></div>
      ${
        !c
          ? '<p class="notice error">未提供审批判断上下文，不能展示为证据100%或完整。请核对相关事实。</p>'
          : `<p class="snapshot-origin">${fallback ? `历史审批未保存快照。以下只展示当前事实，不能回填提交时状态。读取于${time(c.observed_at)}` : `提交时已锁定：${time(c.captured_at)}。${diff?.available ? `当前事实读取于${time(diff.observed_at)}` : "未提供可比较的当前上下文。"}`}</p>
      ${fallback ? `<div class="notice">当前证据${c.evidence.applicable ? `完整度 ${percent(c.evidence.percent)}` : "规则不适用"}；提交时完整度未知，不生成伪差异。</div>` : diff?.available && diff.evidence_summary ? `<div class="comparison"><div><small>提交时完整度</small><strong>${percent(diff.evidence_summary.before_percent)}</strong><p>${c.evidence.applicable ? `${diff.evidence_summary.before_complete} / ${diff.evidence_summary.before_total} 项` : "任务证据规则不适用"}</p></div><div><small>当前完整度</small><strong>${percent(diff.evidence_summary.after_percent)}</strong><p>${c.evidence.applicable ? `${diff.evidence_summary.after_complete} / ${diff.evidence_summary.after_total} 项` : "不是满分或零分"}</p></div></div>` : `<p class="notice">${c.evidence.applicable ? `提交时完整度 ${percent(c.evidence.percent)}；当前对照不可用。` : "任务证据规则不适用，不绘制百分比。"}</p>`}
      ${!fallback && diff?.available ? (diff.has_changes ? table([...diff.requirement_changes, ...diff.basis_changes.map((change) => ({ ...change, before: text(change.before), after: text(change.after) })), ...diff.rule_version_changes]) : '<p class="notice">当前证据、依据和规则版本与提交时保持一致。</p>') : ""}`
      }</section>
      <section id="section-evidence"><div class="section-title"><h3>${fallback ? "当前证据" : "提交时证据"}</h3></div>${!c ? '<p class="hint">审批上下文未提供。</p>' : !c.evidence.applicable ? `<p class="notice">${esc(c.evidence.note || "当前审批没有独立证据规则，不适用。")}</p>` : `${c.evidence.missing_items.length ? `<p class="notice">${fallback ? "当前事实" : "提交快照"}缺失：${esc(c.evidence.missing_items.join("、"))}。${!fallback && diff?.available ? "是否已经补齐请以上方当前差异为准。" : ""}</p>` : ""}${c.evidence.requirements.map((r) => `<article class="evidence-row"><div><strong>${esc(r.label)}</strong><em class="${r.complete ? "" : "missing"}">${r.complete ? "已具备" : "待补齐"}</em><p>${esc(r.detail)}</p></div><a href="${esc(r.route)}" data-route="${esc(r.route)}">查看证据</a></article>`).join("")}`}</section>
      <section id="section-basis"><div class="section-title"><h3>${fallback ? "当前依据和规则" : "提交依据和规则"}</h3></div>${
        !c
          ? '<p class="hint">未提供依据和规则版本。</p>'
          : `<dl class="facts">${c.basis_items.map((b) => `<div><dt>${esc(b.label)}</dt><dd>${esc(text(b.value))}</dd></div>`).join("")}${Object.entries(
              c.rule_versions,
            )
              .map(
                ([k, v]) =>
                  `<div><dt>${{ approval_template: "锁定审批模板", scoring: "评分规则", profit: "利润规则" }[k]}</dt><dd>${esc(v ?? "未生成")}</dd></div>`,
              )
              .join(
                "",
              )}</dl>${c.decision ? `<article class="requested-decision"><strong>申请${text(c.decision.action)}</strong><p>${esc(c.decision.reason)}</p><small>基于机会第 ${c.decision.opportunity_version} 版 · ${time(c.decision.created_at)}</small></article>` : ""}`
      }</section>
      <section id="section-nodes"><div class="section-title"><h3>节点与操作历史</h3><span class="hint">升级不会代替人工决定</span></div>${item.nodes?.length ? item.nodes.map((n) => `<article class="node ${n.status === "pending" ? "active" : ""}"><strong>${n.ordinal}. ${esc(n.name)}</strong><p>${text(n.status)} · 当前审批人 ${esc(n.active_approver_name)}</p><small>期限 ${time(n.due_at)}</small><div class="path"><span>原审批人 ${esc(n.approver_name)}</span><span>超时转交 ${esc(n.escalation_assignee_name)}</span></div><small>${n.escalated_at ? `升级记录时间 ${time(n.escalated_at)}` : "节点记录未标记升级"}</small>${n.decision_reason ? `<p>${esc(n.decision_reason)}</p>` : ""}</article>`).join("") : '<p class="hint">未提供节点明细。</p>'}<h3>操作记录</h3>${item.actions?.length ? item.actions.map((a) => `<article class="history-item"><strong>${text(a.action)}</strong><small>${esc(a.actor_name || "未知成员")} · ${time(a.created_at)}</small><p>${esc(a.reason)}</p></article>`).join("") : '<p class="hint">尚无操作记录。</p>'}<p class="notice">样例边界：节点字段与历史记录可能来自不同快照，本稿不根据历史动作替换当前审批人，也不推断已经批准。</p></section>
      <details class="technical" id="technical"><summary>技术详情</summary><dl class="facts"><div><dt>审批编号 / 当前版本</dt><dd>${item.id} / ${item.version}</dd></div><div><dt>资源类型 / 编号</dt><dd>${item.resource_type} / ${item.resource_id}</dd></div>${(item.nodes || []).map((n) => `<div><dt>节点 ${n.ordinal} / 当前审批人ID</dt><dd>${n.id} / ${n.active_approver_id}</dd></div>`).join("")}</dl></details></div></div>
      <section class="decision" id="section-decision">${canDecide ? `${c?.evidence.applicable && !c.evidence.is_complete ? `<p class="notice">${fallback ? "当前证据有缺失" : "提交快照有缺失"}，请阅读当前对照并在原因中说明判断依据。缺失提示不新增批准门槛。</p>` : ""}<label for="decision-reason">审批原因（批准和驳回均必填）<textarea id="decision-reason" maxlength="1000" ${busy ? "readonly" : ""} placeholder="记录可审计的判断依据">${esc(reasons.decision)}</textarea></label><p class="notice ${messages.detail ? "error" : ""}" id="decision-message" role="status">${esc(messages.detail || (busy ? "处理中演示。关闭不代表取消已发送操作；本稿没有真实请求。" : "离线图稿：点击只生成请求预览，不产生批准或驳回记录。"))}</p><div class="decision-actions"><p>记录当前版本 ${item.version} 的判断</p><button id="reject" class="danger" ${busy || !reasons.decision.trim() ? "disabled" : ""}>驳回</button><button id="approve" class="primary" ${busy || !reasons.decision.trim() ? "disabled" : ""}>${busy ? "正在提交…" : "批准并流转"}</button></div>` : '<p class="notice">当前节点不是由你审批、没有决定权限，或审批已结束。此处仅供查阅。</p>'}</section>`;
    $("#detail-close").onclick = () => closeDetail();
    document
      .querySelectorAll("#detail-dialog [data-section]")
      .forEach((b) => (b.onclick = () => section(b.dataset.section)));
    document.querySelectorAll("#detail-dialog [data-route]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          const target = a.dataset.route;
          closeDetail();
          navigation(target);
        }),
    );
    if ($("#decision-reason"))
      $("#decision-reason").oninput = (e) => {
        reasons.decision = e.target.value;
        for (const id of ["approve", "reject"])
          document.getElementById(id).disabled = busy || !reasons.decision.trim();
      };
    for (const action of ["approve", "reject"])
      document.getElementById(action)?.addEventListener("click", () => decide(action));
  }
  function section(name) {
    const target = document.getElementById(name === "technical" ? name : `section-${name}`);
    if (!target) return;
    target.style.scrollMarginTop = `${$(".detail-header").getBoundingClientRect().height + 18}px`;
    if (name === "technical") target.open = true;
    document
      .querySelectorAll("[data-section]")
      .forEach((b) => b.setAttribute("aria-current", String(b.dataset.section === name)));
    target.scrollIntoView({ block: "start" });
  }
  function record(kind, request) {
    intents.push(clone(request));
    messages[kind] =
      modes[kind] === "error"
        ? "离线失败演示：没有可确认的成功结果。输入已保留，请核对最新事实后再重试。"
        : "请求预览已生成，未发送API；没有新增业务成功记录。";
  }
  function decide(action) {
    if (
      !currentDetail ||
      !s.canManage ||
      !currentDetail.can_decide ||
      modes.detail === "busy" ||
      !reasons.decision.trim()
    )
      return;
    record("detail", {
      url: `/tasks/approvals/${currentDetail.id}/actions`,
      method: "POST",
      body: { action, reason: reasons.decision, expected_version: currentDetail.version },
    });
    $("#decision-message").textContent = messages.detail;
    $("#decision-message").className = "notice" + (modes.detail === "error" ? " error" : "");
  }
  function captureForm() {
    if (!formKind) return;
    const target = formKind === "template" ? templateDraft : requestDraft;
    document
      .querySelectorAll("#form-dialog [name]")
      .forEach((n) => (target[n.name] = n.type === "number" ? Number(n.value) : n.value));
  }
  function openForm(kind, trigger) {
    if (!s.canManage || (kind === "request" && !published().length)) return;
    formKind = kind;
    formTrigger = trigger;
    messages[kind] = "";
    renderForm();
    $("#form-dialog").showModal();
    $("#form-close").focus();
  }
  function closeForm() {
    captureForm();
    if ($("#publish-dialog").open) closePublish();
    $("#form-dialog").close();
    formKind = "";
    document.getElementById(formTrigger)?.focus();
  }
  function renderForm() {
    const template = formKind === "template",
      v = template ? templateDraft : requestDraft,
      busy = modes[formKind] === "busy",
      tpl = published().find((t) => t.id === v.template_id);
    $("#form-dialog").innerHTML =
      `<form class="dialog-form"><header class="form-heading"><h2 id="form-title">${template ? "新建审批模板草稿" : "发起审批"}</h2><button type="button" id="form-close">关闭</button></header><p class="form-intro">${template ? "定义一个审批节点。草稿必须显式发布，发布后新审批才可使用。" : "选用已发布模板并关联真实任务或机会决策，提交时锁定模板版本。"}</p>
      ${
        template
          ? `<label class="field" for="template-name">模板名称 · 必填<input id="template-name" name="name" required maxlength="200" value="${esc(v.name)}" ${busy ? "readonly" : ""}></label><label class="field" for="resource-type">资源类型<select id="resource-type" name="resource_type" ${busy ? "disabled" : ""}>${options(types, v.resource_type)}</select></label><section class="form-section"><h3>审批节点</h3><label class="field" for="node-name">节点名称 · 必填<input id="node-name" name="node_name" required maxlength="120" value="${esc(v.node_name)}" ${busy ? "readonly" : ""}></label><label class="field" for="sla">处理时限（分钟）<input id="sla" name="sla_minutes" type="number" min="1" max="43200" step="1" required value="${v.sla_minutes}" ${busy ? "readonly" : ""}></label><div class="pair"><label class="field" for="approver">审批人 · 必填<select id="approver" name="approver_id" required ${busy ? "disabled" : ""}>${memberOptions(v.approver_id)}</select></label><label class="field" for="escalation">超时接收人 · 必填<select id="escalation" name="escalation_assignee_id" required ${busy ? "disabled" : ""}>${memberOptions(v.escalation_assignee_id)}</select></label></div></section><p class="hint">当前UI创建单节点；超时只升级接收人，不会自动批准或驳回。</p>`
          : `<label class="field" for="request-template">已发布模板 · 必填<select id="request-template" name="template_id" required ${busy ? "disabled" : ""}><option value="">请选择模板</option>${published()
              .map(
                (t) =>
                  `<option value="${t.id}" ${v.template_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`,
              )
              .join(
                "",
              )}</select></label><p class="locked-type">${tpl ? `关联类型：${types[tpl.resource_type]}。由模板锁定，不可独立修改。` : "选择模板后确定关联类型。"}</p><label class="field" for="resource-id">关联资源编号 · 必填<input id="resource-id" name="resource_id" required value="${esc(v.resource_id)}" ${busy ? "readonly" : ""}></label><p class="hint">资源是否存在、属于本工作区和类型匹配，均由服务端验证。本稿不会猜测编号。</p><label class="field" for="request-title">审批标题 · 必填<input id="request-title" name="title" required maxlength="200" value="${esc(v.title)}" ${busy ? "readonly" : ""}></label>`
      }
      <p id="form-message" class="notice ${messages[formKind] ? "error" : ""}" role="status">${esc(messages[formKind] || (busy ? "处理中演示；关闭只收起窗口，不代表取消请求。" : "此为离线图稿，提交只生成请求预览，不写入业务数据。"))}</p><footer class="form-footer"><button type="button" id="form-cancel">${busy ? "收起" : "取消"}</button><button type="submit" id="form-submit" class="primary" ${busy ? 'disabled aria-busy="true"' : ""}>${busy ? "正在提交…" : template ? "保存草稿" : "发起审批"}</button></footer></form>
      ${template ? `<section class="template-list"><h3>现有模板</h3>${s.templates.length ? s.templates.map((t) => `<article class="template-item"><div><strong>${esc(t.name)}</strong><p>${text(t.status)} · v${t.current_version} · ${t.node_count}节点</p></div>${t.status === "draft" ? `<button id="publish-${t.id}" data-publish="${t.id}" ${busy ? "disabled" : ""}>发布</button>` : ""}</article>`).join("") : '<p class="hint">尚无模板。</p>'}</section>` : ""}`;
    $("#form-close").onclick = closeForm;
    $("#form-cancel").onclick = closeForm;
    $("#form-dialog form").onsubmit = (e) => {
      e.preventDefault();
      submitForm();
    };
    $("#request-template")?.addEventListener("change", () => {
      captureForm();
      const selected = published().find((t) => t.id === requestDraft.template_id);
      if (selected) requestDraft.resource_type = selected.resource_type;
      renderForm();
      $("#request-template").focus();
    });
    document
      .querySelectorAll("[data-publish]")
      .forEach((b) => (b.onclick = () => openPublish(b.dataset.publish)));
  }
  function validText(scope) {
    for (const node of scope.querySelectorAll(
      "input[required]:not([type=number]),textarea[required]",
    )) {
      node.setCustomValidity(node.value.trim() ? "" : "不能仅填写空格。");
      node.oninput = () => node.setCustomValidity("");
    }
    return scope.reportValidity();
  }
  function submitForm() {
    if (!formKind || modes[formKind] === "busy" || !s.canManage) return;
    captureForm();
    if (!validText($("#form-dialog form"))) return;
    let request;
    if (formKind === "template") {
      const f = templateDraft;
      request = {
        url: "/tasks/approval-templates",
        method: "POST",
        body: {
          name: f.name,
          resource_type: f.resource_type,
          nodes: [
            {
              name: f.node_name,
              approver_id: f.approver_id,
              sla_minutes: Number(f.sla_minutes),
              escalation_assignee_id: f.escalation_assignee_id,
            },
          ],
        },
      };
    } else {
      const f = requestDraft,
        tpl = published().find((t) => t.id === f.template_id);
      if (!tpl) return;
      request = {
        url: "/tasks/approvals",
        method: "POST",
        body: {
          template_id: f.template_id,
          resource_type: tpl.resource_type,
          resource_id: f.resource_id.trim(),
          title: f.title.trim(),
        },
      };
    }
    record(formKind, request);
    $("#form-message").textContent = messages[formKind];
    $("#form-message").className = "notice" + (modes[formKind] === "error" ? " error" : "");
  }
  function openPublish(id) {
    if (!s.canManage || modes.template === "busy") return;
    captureForm();
    publishTarget = clone(s.templates.find((t) => t.id === id && t.status === "draft"));
    reasons.publish = "";
    messages.publish = "";
    renderPublish();
    $("#publish-dialog").showModal();
    $("#publish-close").focus();
  }
  function closePublish() {
    const id = publishTarget?.id;
    publishTarget = null;
    reasons.publish = "";
    $("#publish-dialog").close();
    document.getElementById(`publish-${id}`)?.focus();
  }
  function renderPublish() {
    const busy = modes.publish === "busy";
    $("#publish-dialog").innerHTML =
      `<form class="dialog-form"><header class="form-heading"><h2 id="publish-title">发布审批模板</h2><button type="button" id="publish-close">关闭</button></header><p class="form-intro">将发布“${esc(publishTarget.name)}”第 ${publishTarget.current_version} 版。新审批锁定该版本，历史审批不会被改写。</p><p class="locked-type">当前修订号 ${publishTarget.revision} · ${publishTarget.node_count} 节点 · ${types[publishTarget.resource_type]}</p><label class="field" for="publish-reason">发布原因 · 必填<textarea id="publish-reason" required maxlength="500" ${busy ? "readonly" : ""}>${esc(reasons.publish)}</textarea></label><p id="publish-message" class="notice ${messages.publish ? "error" : ""}" role="status">${esc(messages.publish || (busy ? "处理中演示；关闭不代表取消已发送的发布。" : "离线预览，不会真实发布模板。"))}</p><footer class="form-footer"><button type="button" id="publish-cancel">返回模板</button><button type="submit" id="publish-confirm" class="primary" ${busy ? 'disabled aria-busy="true"' : ""}>${busy ? "正在提交…" : "确认发布"}</button></footer></form>`;
    $("#publish-close").onclick = closePublish;
    $("#publish-cancel").onclick = closePublish;
    $("#publish-reason").oninput = (e) => (reasons.publish = e.target.value);
    $("#publish-dialog form").onsubmit = (e) => {
      e.preventDefault();
      if (!publishTarget || modes.publish === "busy" || !s.canManage || !validText(e.target))
        return;
      record("publish", {
        url: `/tasks/approval-templates/${publishTarget.id}/actions`,
        method: "POST",
        body: { expected_revision: publishTarget.revision, reason: reasons.publish.trim() },
      });
      $("#publish-message").textContent = messages.publish;
    };
  }
  for (const [id, close] of [
    ["detail-dialog", closeDetail],
    ["form-dialog", closeForm],
    ["publish-dialog", closePublish],
  ]) {
    const dialog = document.getElementById(id);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("click", (e) => {
      const r = dialog.getBoundingClientRect();
      if (
        e.target === dialog &&
        (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      )
        close();
    });
    dialog.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
          ...dialog.querySelectorAll("button,input,select,textarea,a[href],summary"),
        ].filter((n) => !n.disabled && n.getClientRects().length),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  function scene(name, initial = false) {
    if (!Object.hasOwn(scenes, name)) throw new Error("Unknown scene");
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    currentDetail = null;
    formKind = "";
    publishTarget = null;
    intents = [];
    reasons = { decision: "", publish: "" };
    messages = {};
    modes = { detail: "intent", template: "intent", request: "intent", publish: "intent" };
    templateDraft = {
      name: "",
      resource_type: "task",
      node_name: "",
      approver_id: "",
      sla_minutes: 60,
      escalation_assignee_id: "",
    };
    requestDraft = { template_id: "", resource_type: "task", resource_id: "", title: "" };
    s = {
      scene: name,
      rows: clone(D.list.data),
      detail: clone(D.detail),
      templates: clone(D.templates),
      queue: "decidable",
      status: "pending",
      page: 1,
      extra: {},
      read: "ready",
      canManage: true,
      detailState: "",
      synthetic: false,
      message: "",
    };
    if (
      Object.hasOwn(
        {
          loading: 1,
          error: 1,
          forbidden: 1,
          expired: 1,
          rate_limited: 1,
          version_conflict: 1,
          member_error: 1,
        },
        name,
      )
    )
      s.read = name;
    if (name === "requested") s.queue = "requested";
    if (name === "empty") s.status = "approved";
    if (name === "no_templates") {
      s.templates = [];
      s.rows = [];
      s.synthetic = true;
    }
    if (["readonly", "detail_readonly"].includes(name)) s.canManage = false;
    if (
      name.startsWith("detail_") &&
      ["detail_loading", "detail_missing", "detail_error"].includes(name)
    )
      s.detailState = name.slice(7);
    if (
      [
        "unchanged",
        "removed",
        "fallback",
        "task",
        "context_missing",
        "terminal",
        "escalated",
        "pagination",
        "long",
      ].includes(name)
    )
      s.synthetic = true;
    if (name === "unchanged") s.detail.decision_context_diff = clone(D.unchanged);
    if (name === "removed") s.detail.decision_context_diff = clone(D.removed);
    if (name === "fallback") {
      s.detail.decision_context.snapshot_status = "live_fallback";
      s.detail.decision_context.captured_at = null;
      s.detail.decision_context_diff = { available: false };
    }
    if (name === "context_missing") {
      delete s.detail.decision_context;
      delete s.detail.decision_context_diff;
    }
    if (name === "task") {
      const c = s.detail.decision_context;
      s.detail.resource_type = "task";
      s.detail.resource_id = "00000000-0000-4000-8000-000000000951";
      s.detail.title = "任务审批布局样例";
      c.resource = {
        type: "task",
        id: s.detail.resource_id,
        label: "任务样例",
        route: `/tasks/${s.detail.resource_id}`,
      };
      c.evidence = {
        applicable: false,
        complete: 0,
        total: 0,
        percent: null,
        is_complete: null,
        missing_items: [],
        requirements: [],
        note: "任务审批没有独立证据完整度规则，按任务事实审批。",
      };
      c.decision = null;
      c.basis_items = [];
      c.rule_versions.scoring = null;
      c.rule_versions.profit = null;
      s.detail.decision_context_diff = {
        ...clone(D.unchanged),
        evidence_summary: {
          before_complete: 0,
          before_total: 0,
          before_percent: null,
          after_complete: 0,
          after_total: 0,
          after_percent: null,
        },
      };
    }
    if (name === "terminal") {
      s.detail.status = "approved";
      s.detail.can_decide = false;
      s.detail.current_node_name = null;
      s.detail.nodes = [];
      s.detail.actions = [];
    }
    if (name === "escalated") {
      s.detail.escalated_at = D.detail.actions[0].created_at;
      s.detail.nodes[0].escalated_at = s.detail.escalated_at;
      s.detail.nodes[0].active_approver_name = D.members[1].label;
      s.detail.nodes[0].active_approver_id = D.members[1].id;
      s.detail.nodes[0].escalation_assignee_id = D.members[1].id;
      s.detail.can_decide = false;
    }
    if (name === "pagination")
      s.rows = Array.from({ length: 21 }, (_, i) => ({
        ...clone(D.list.data[0]),
        id: `00000000-0000-4000-8000-${String(970 + i).padStart(12, "0")}`,
        title: `审批分页布局样例 ${i + 1}`,
      }));
    if (name === "long")
      s.detail.title = "核对采纳依据、市场证据与风险识别变化，再记录当前节点的人工判断。".repeat(3);
    if (initial) {
      const q = new URLSearchParams(location.search);
      s.queue = q.get("view") === "requested" ? "requested" : "decidable";
      s.status = ["pending", "approved", "rejected", "cancelled", ""].includes(q.get("status"))
        ? q.get("status")
        : "pending";
      s.page = Math.min(
        Math.max(1, Number(q.get("page")) || 1),
        Math.max(1, Math.ceil(rows().length / 20)),
      );
      s.extra = Object.fromEntries(
        [...q].filter(([k]) => !["view", "status", "page", "approval"].includes(k)),
      );
    }
    $("#scene-picker").value = name;
    render();
    const detailScenes = [
      "detail",
      "evidence",
      "basis",
      "nodes",
      "technical",
      "decision",
      "unchanged",
      "removed",
      "fallback",
      "task",
      "context_missing",
      "detail_readonly",
      "terminal",
      "escalated",
      "decision_error",
      "decision_busy",
      "long",
    ];
    if (detailScenes.includes(name)) {
      openDetail(s.rows[0].id);
      if (["decision_error", "decision_busy"].includes(name)) {
        modes.detail = name === "decision_busy" ? "busy" : "error";
        reasons.decision = "核验提交快照及当前风险变化后记录判断";
        if (name === "decision_error")
          messages.detail =
            "审批版本已变化。原因已保留；请核对最新审批状态，不能把本次提交当作已批准。";
        renderDetail();
      }
      if (name === "long") {
        reasons.decision = "长原因布局样例：核对变化与证据。".repeat(35);
        renderDetail();
      }
      $("#detail-close").focus();
      if (["evidence", "basis", "nodes", "technical", "decision"].includes(name)) section(name);
      else if (["decision_error", "decision_busy", "long"].includes(name)) section("decision");
      else if (name === "escalated") section("nodes");
    }
    if (name.startsWith("template") || name.startsWith("publish")) {
      if (name !== "template") templateDraft = clone(D.forms.template);
      openForm("template", "manage");
      if (name.startsWith("template_") || name.startsWith("publish")) {
        modes.template =
          name === "template_busy" ? "busy" : name === "template_error" ? "error" : "intent";
        if (name === "template_error")
          messages.template = "离线失败演示：草稿提交未获成功确认，字段保留。";
        renderForm();
      }
      if (name.startsWith("publish")) {
        openPublish(D.templates[1].id);
        modes.publish =
          name === "publish_busy" ? "busy" : name === "publish_error" ? "error" : "intent";
        reasons.publish = name === "publish" ? "" : "核验后发布";
        if (name === "publish_error")
          messages.publish = "模板修订已变化，发布未获确认；原因已保留。";
        renderPublish();
        $("#publish-close").focus();
      } else $("#form-close").focus();
    }
    if (name.startsWith("request") && name !== "requested") {
      requestDraft = clone(D.forms.request);
      openForm("request", "new-request");
      modes.request =
        name === "request_busy" ? "busy" : name === "request_error" ? "error" : "intent";
      if (name === "request_error")
        messages.request = "关联资源不存在或类型不匹配的失败演示，未确认创建审批。";
      renderForm();
      $("#form-close").focus();
    }
    if (initial) {
      const id = new URLSearchParams(location.search).get("approval");
      if (id) openDetail(id);
    }
    sync();
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  $("#scene-picker").onchange = (e) => scene(e.target.value);
  window.APPROVAL_C = {
    scenes,
    scene,
    section,
    state: () =>
      clone({
        ...s,
        path: url(),
        currentDetail,
        formKind,
        publishTarget,
        intents,
        reasons,
        modes,
        messages,
        templateDraft,
        requestDraft,
      }),
    setMode: (kind, value) => {
      modes[kind] = value;
    },
    openForm,
    openDetail,
  };
  scene("normal", true);
})();
