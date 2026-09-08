const T = window.TREND_C_DATA;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const fresh = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "尚未记录");
const statusName = (v) =>
  ({
    active: "活跃",
    irrelevant: "已标记无关",
    stale: "已过期",
    archived: "已归档",
    enabled: "已启用",
    paused: "已暂停",
    pending: "待确认",
    confirmed: "已确认",
    rejected: "已驳回",
  })[v] || v;
const link = (url, text, attrs = "") => `<a href="${esc(url)}" ${attrs}>${text}</a>`;
const button = (id, text, attrs = "") =>
  `<button type="button" data-action="${id}" ${attrs}>${text}</button>`;
const disabled = () => (S.busy ? "disabled" : "");
function filterView() {
  return `<form class="filter-form" id="filter-form"><label><span>市场</span><select name="market"><option value="">全部市场</option><option ${S.filters.market === "US" ? "selected" : ""}>US</option></select></label><label><span>分类</span><input name="category" maxlength="80" value="${esc(S.filters.category)}" /></label><label><span>状态</span><select name="status">${[
    ["active", "活跃"],
    ["irrelevant", "已标记无关"],
    ["stale", "已过期"],
    ["", "全部状态"],
  ]
    .map(
      ([v, l]) => `<option value="${v}" ${S.filters.status === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label><span>关键词</span><input name="q" maxlength="200" value="${esc(S.filters.q)}" /></label><label><span>排序</span><select name="sort">${[
    ["impact", "影响程度"],
    ["latest", "最新信号"],
    ["momentum", "增长速度"],
    ["followed", "我的关注优先"],
  ]
    .map(([v, l]) => `<option value="${v}" ${S.sort === v ? "selected" : ""}>${l}</option>`)
    .join(
      "",
    )}</select></label><div class="actions"><button type="submit">筛选</button>${button("clear", "清除")}${button("copy", "保存视图链接")}</div></form>`;
}
function stateView() {
  const title = {
    loading: "正在读取趋势",
    empty: "没有符合当前条件的趋势",
    error: "趋势读取失败",
    expired: "登录已过期",
    forbidden: "无权读取当前趋势",
    blocked: "依赖暂时受阻",
  }[S.state];
  return `<section class="surface state-panel" aria-live="polite" aria-busy="${S.state === "loading"}"><h3>${title}</h3><p>${S.state === "empty" ? "这是本次明确返回的空列表，不是失败后的空值。" : "未完成本次读取，不展示旧规则、治理条目或就绪结论。"}</p>${S.state !== "loading" ? `<div class="actions">${button(S.state === "empty" ? "clear" : "reload", S.state === "empty" ? "清除筛选并恢复" : "重新加载")}${S.state === "expired" ? link("/login", "重新登录") : S.state === "forbidden" ? link("/select-context", "选择组织与工作区") : ""}</div><details><summary>关联编号</summary><code>trend-c-${S.state}</code></details>` : ""}</section>`;
}
function topicListView() {
  const topics = [...S.topics];
  if (S.sort === "latest")
    topics.sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  else if (S.sort === "momentum")
    topics.sort((a, b) => (b.momentum_percent ?? -Infinity) - (a.momentum_percent ?? -Infinity));
  else if (S.sort === "followed")
    topics.sort((a, b) => Number(b.followed) - Number(a.followed) || b.heat.value - a.heat.value);
  else topics.sort((a, b) => b.heat.value - a.heat.value || b.source_count - a.source_count);
  return `<section class="surface" id="topic-list"><header><div><span class="section-tag">TOPICS / 信号目录</span><h3>趋势列表</h3></div><span class="meta">共 ${S.total} 个主题</span></header><p class="meta">排序仅作用于当前页，最多 20 条；不是全局排名。</p>${topics.map((t) => `<button class="topic-row" data-topic="${t.id}" aria-pressed="${S.detail.id === t.id}"><span><strong>${esc(t.title)}</strong><small>${t.market} · ${esc(t.category || "未分类")} · ${statusName(t.status)}${t.followed ? " · 已关注" : ""}</small></span><span class="source-facts"><small>${t.source_count} 个来源 · ${fresh(t.source_fresh_at)}</small><small>可信度 ${t.confidence.status === "measured" ? `${t.confidence.score} / 100` : "数据不足"}</small></span><span class="count">${t.heat.value}<small>条实际信号 →</small></span></button>`).join("")}<footer class="pagination">${button("previous", "上一页", S.page <= 1 ? "disabled" : "")}<span>第 ${S.page} / ${Math.max(1, Math.ceil(S.total / 20))} 页</span>${button("next", "下一页", S.page >= Math.ceil(S.total / 20) ? "disabled" : "")}</footer></section>`;
}
function detailView() {
  const d = S.detail,
    opportunity =
      "/opportunities?source_topic_id=" +
      encodeURIComponent(d.id) +
      "&name=" +
      encodeURIComponent(d.title) +
      "&market=" +
      encodeURIComponent(d.market) +
      "&category=" +
      encodeURIComponent(d.category || "");
  const source = d.timeline_sources.find((v) => v.source_id === S.timelineSource),
    points = S.timelineSource ? source?.points || [] : d.timeline,
    max = Math.max(1, ...points.map((v) => v.signal_count));
  return `<section class="surface" id="topic-detail"><div class="detail-heading"><div>${button("back", "← 返回趋势列表")}<p class="meta">${statusName(d.status)} · ${d.market} · ${d.language}</p><h3>${esc(d.title)}</h3><small>首次 ${fresh(d.first_seen_at)} · 最近来源 ${fresh(d.source_fresh_at)}</small></div><div class="big-count">${d.heat.value}<small>实际信号数</small></div></div><div class="actions">${S.canManage ? button("follow", d.followed ? "已关注" : "关注", disabled()) + button("rule", "创建监控", disabled()) : ""}${link(opportunity, "转为机会 →")}${S.canManage ? button(d.status === "irrelevant" ? "restore" : "irrelevant", d.status === "irrelevant" ? "恢复为相关" : "标记无关", disabled()) : ""}</div><dl class="topic-facts"><div><dt>可验证结论</dt><dd>${d.signal_count} 条信号 / ${d.source_count} 个来源</dd><dd>置信度：${d.confidence.status === "insufficient_data" ? "数据不足，不使用默认分数" : `${d.confidence.score} / 100`}</dd></div><div><dt>证据覆盖 / 数据状态</dt><dd>${d.data_quality.evidence_count} 条 · ${esc(d.data_quality.coverage_status)}</dd></div><div><dt>环比</dt><dd>${d.momentum_percent == null ? "数据不足" : `${d.momentum_percent}%`}</dd></div></dl></section><div class="detail-grid"><div><section class="surface"><header><div><span class="section-tag">EVIDENCE</span><h3>主要证据</h3></div><small>${d.source_count} 个来源</small></header>${d.evidence.length ? d.evidence.map((e) => `<article class="evidence-row"><strong>${esc(e.title)}</strong><small>${esc(e.publisher)} · 发布 ${fresh(e.published_at)}<br />采集 ${fresh(e.observed_at)}</small><div class="actions">${link(e.canonical_url, "查看原文 ↗", 'target="_blank" rel="noopener noreferrer"')}${S.canManage ? `<button data-evidence="${e.id}" ${S.busy || S.issueIds[e.id] ? "disabled" : ""}>${S.issueIds[e.id] ? "已建质量工单" : "报告异常"}</button>` : ""}</div></article>`).join("") : "<p>当前响应没有证据条目；不补造原文。</p>"}</section><section class="surface"><header><div><span class="section-tag">HISTORY</span><h3>标记原因与恢复记录</h3></div></header>${d.relevance_history.length ? d.relevance_history.map((h) => `<article class="history-row"><strong>${h.status === "irrelevant" ? "标记无关" : "恢复相关"}</strong><small>${fresh(h.occurred_at)} · v${h.version}</small><p>${esc(h.reason)}</p><details><summary>技术详情</summary><code>操作者 ${esc(h.actor_id)}</code></details></article>`).join("") : "<p>尚无相关性变更记录。</p>"}</section></div><div><section class="surface"><header><div><span class="section-tag">TIMELINE</span><h3>信号时间线</h3></div></header><label>来源筛选<select id="timeline-source"><option value="">全部来源</option>${d.timeline_sources.map((v) => `<option value="${v.source_id}" ${S.timelineSource === v.source_id ? "selected" : ""}>${esc(v.source_label)}</option>`).join("")}</select></label><ol class="timeline" aria-label="来源 ${esc(source?.source_label || "全部来源")}，${points.length} 个时间点">${points.map((p) => `<li><small>${fresh(p.at)}</small><span class="signal-track" aria-hidden="true"><i style="width:${Math.max(0, (p.signal_count / max) * 100)}%"></i></span><span>${p.signal_count} 条</span></li>`).join("")}</ol>${points.length ? "" : "<p>该来源暂无时间点。</p>"}</section><section class="surface"><h3>关键词</h3><div class="keywords">${d.keywords.map((k) => `<span>${esc(k.keyword)}<small>${esc(k.type)} · ${k.market} · ${k.language}</small></span>`).join("") || "<p>尚无关键词记录。</p>"}</div></section></div></div>`;
}
function rulesView() {
  return `<section class="surface"><header><div><span class="section-tag">MONITORING</span><h3>趋势监控规则</h3></div>${S.canManage ? button("rule", "＋ 创建规则", disabled()) : ""}</header><p>${S.canManage ? "来源门槛只形成候选；五项质量门通过后才建议采纳。" : "当前只读：可以查看规则和结果，不可创建、暂停或恢复。"}</p>${
    S.rules.length
      ? S.rules
          .map(
            (r) =>
              `<article class="rule-record"><small>${statusName(r.status)} · v${r.version}</small><h4>${esc(r.name)}</h4><span>${r.market} · ${r.language} · ${esc(r.category || "全部分类")}</span><p>包含：${esc(r.include_keywords.join(" · "))}</p>${r.negative_keywords.length ? `<small>排除：${esc(r.negative_keywords.join(" · "))}</small>` : ""}<dl class="rule-facts">${[
                ["通知", "站内"],
                ["采集周期", `每 ${r.collection_interval_minutes} 分钟`],
                ["候选来源门槛", `至少 ${r.recommendation_min_source_count} 个独立来源`],
                ["最后评估", r.last_evaluated_at ? fresh(r.last_evaluated_at) : "尚未评估"],
                [
                  "下次采集",
                  r.next_collection_at
                    ? fresh(r.next_collection_at)
                    : r.status === "paused"
                      ? "已暂停"
                      : "尚未设置",
                ],
                ["上次失败来源", r.last_failed_sources.join("、") || "无"],
              ]
                .map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`)
                .join(
                  "",
                )}</dl><div class="actions">${S.canManage ? `<button data-toggle-rule="${r.id}" ${disabled()}>${r.status === "enabled" ? "暂停" : "启用"}</button>` : ""}<button data-rule-results="${r.id}">查看趋势结果</button></div></article>`,
          )
          .join("")
      : `<section class="state-panel"><h4>还没有监控规则</h4><p>本次读取明确返回空规则。</p>${S.canManage ? button("rule", "创建监控规则") : ""}</section>`
  }</section>`;
}
function governanceView() {
  const p = S.proposal,
    candidates = S.topics.filter(
      (t) =>
        t.id !== S.detail.id &&
        t.status === "active" &&
        t.market === S.detail.market &&
        t.language === S.detail.language,
    );
  return `<section class="surface"><header><div><span class="section-tag">GOVERNANCE</span><h3>合并与拆分确认队列</h3></div><b>${S.requests.filter((r) => r.status === "pending").length} 项待确认</b></header><p>提议与执行分开。提议人与确认人必须是两个不同的活动用户。</p></section><form id="proposal-form" class="surface proposal"><fieldset ${disabled()}><legend>基于当前主题提出治理请求</legend><strong>${esc(S.detail.title)}</strong><div class="actions">${button("merge", "合并主题", `aria-pressed="${p.operation === "merge"}"`)}${button("split", "拆分主题", `aria-pressed="${p.operation === "split"}"`)}</div>${p.operation === "merge" ? `<p>选择并入当前主题的同市场、同语言活动主题（仅当前列表页）。</p>${candidates.map((t) => `<label class="check-row"><input type="checkbox" name="sourceIds" value="${t.id}" ${p.sourceIds.includes(t.id) ? "checked" : ""} /><span>${esc(t.title)} · v${t.version}</span></label>`).join("") || "<p>当前页没有可合并的主题。</p>"}` : `<p>选择具体证据；原主题至少保留一条，服务端再次校验。</p>${S.detail.evidence.map((e) => `<label class="check-row"><input type="checkbox" name="signalIds" value="${e.id}" ${p.signalIds.includes(e.id) ? "checked" : ""} /><span>${esc(e.title)} · ${esc(e.publisher)}</span></label>`).join("")}<div class="form-grid"><label>新主题名称<input name="newTitle" required maxlength="500" value="${esc(p.newTitle)}" /></label><label>新分类（可选）<input name="newCategory" maxlength="80" value="${esc(p.newCategory)}" /></label></div>`}<label>提议原因<textarea name="reason" required minlength="2" maxlength="1000">${esc(p.reason)}</textarea></label><button type="submit" ${S.busy || p.reason.trim().length < 2 || (p.operation === "merge" ? !p.sourceIds.length : !p.signalIds.length || !p.newTitle.trim()) ? "disabled" : ""}>提交确认队列</button></fieldset></form><section class="surface" id="queue"><h3>确认队列</h3>${S.requests.length ? S.requests.map((r) => `<article class="queue-record"><header><div><small>${r.operation === "merge" ? "合并提议" : "拆分提议"}</small><h4>${esc(r.target_topic.title)}</h4></div><b>${statusName(r.status)}</b></header><p>${r.operation === "merge" ? `并入：${esc(r.source_topics.map((t) => t.title).join("、"))}` : `新主题：${esc(r.new_title)} · 移动 ${r.signal_ids.length} 条证据`}</p><blockquote>${esc(r.reason)}</blockquote><small>提议人 ${esc(r.proposed_by.slice(0, 8))}… · v${r.version}</small>${r.status === "pending" ? `<div class="actions"><button data-decision="reject" data-request="${r.id}" ${disabled()}>驳回</button><button data-decision="confirm" data-request="${r.id}" ${disabled()}>确认执行</button></div>${S.decision.requestId === r.id ? `<form id="decision-form" class="decision-form"><label>${S.decision.action === "confirm" ? "确认说明" : "驳回原因"}<textarea name="reason" required minlength="2" maxlength="1000" ${disabled()}>${esc(S.decision.reason)}</textarea></label><div class="actions">${button("cancel-decision", "取消", disabled())}<button type="submit" ${S.busy || S.decision.reason.trim().length < 2 ? "disabled" : ""}>提交${S.decision.action === "confirm" ? "确认" : "驳回"}</button></div></form>` : ""}` : r.decision_reason ? `<p>处理说明：${esc(r.decision_reason)}</p>` : ""}</article>`).join("") : "<p>确认队列为空。</p>"}</section>`;
}
function modalView() {
  const kind = S.modal,
    title = {
      rule: "创建趋势监控",
      anomaly: "创建数据质量工单",
      irrelevant: "标记为无关",
      restore: "恢复为相关",
      filter: "筛选趋势",
    }[kind];
  let body = "";
  if (kind === "filter") body = filterView();
  else if (kind === "rule")
    body =
      Object.entries({
        name: "规则名称",
        include_keywords: "包含关键词（逗号分隔）",
        negative_keywords: "排除关键词（可选）",
        market: "市场",
        language: "语言",
        category: "分类（可选）",
        collection_interval_minutes: "自动采集周期",
        recommendation_min_source_count: "候选来源门槛",
      })
        .map(
          ([name, label]) =>
            `<label>${label}${T.options[name] ? `<select name="${name}" ${disabled()}>${T.options[name].map((o) => `<option value="${o.value}" ${S.ruleForm[name] === o.value ? "selected" : ""}>${o.label}</option>`).join("")}</select>` : `<input name="${name}" ${disabled()} value="${esc(S.ruleForm[name])}" ${["name", "include_keywords", "market", "language"].includes(name) ? "required" : ""} maxlength="${{ name: 120, include_keywords: 500, negative_keywords: 500, market: 40, language: 40, category: 80 }[name]}" />`}</label>`,
        )
        .join("") +
      "<aside>候选不等于建议采纳。来源门槛只形成候选，五项质量门通过后才建议采纳。通知固定站内，不能选择邮件。</aside>";
  else
    body = `${kind === "anomaly" ? `<p>${esc(S.detail.evidence.find((e) => e.id === S.evidenceId)?.title)}</p><label>风险等级<select name="severity" ${disabled()}><option value="warning">需要复核</option><option value="critical" ${S.severity === "critical" ? "selected" : ""}>严重异常</option></select></label>` : "<aside>原始证据、时间线与历史原因不会删除；本次变更需要记录原因。</aside>"}<label>${kind === "anomaly" ? "异常说明" : "变更原因"}<textarea name="reason" required minlength="2" maxlength="500" ${disabled()}>${esc(S.reason)}</textarea></label>`;
  return `<header><h3 id="modal-title">${title}</h3>${button("close-modal", "×", `aria-label="关闭${title}" ${disabled()}`)}</header>${kind === "filter" ? `<div class="modal-body">${body}</div>` : `<form id="modal-form"><div class="modal-body">${S.modalError ? `<p class="error" role="alert">${esc(S.modalError)}</p>` : ""}${body}</div><footer>${button("close-modal", "取消", disabled())}<button type="submit" class="primary" ${S.busy || (kind !== "rule" && S.reason.trim().length < 2) ? "disabled" : ""}>${S.busy ? "提交中…" : kind === "rule" ? "创建并启用" : kind === "anomaly" ? "创建质量工单" : "确认并记录"}</button></footer></form>`}`;
}
