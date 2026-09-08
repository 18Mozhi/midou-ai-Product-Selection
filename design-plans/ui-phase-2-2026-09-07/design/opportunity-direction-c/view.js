(() => {
  const d = window.OP_C_DATA;
  const e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const btn = (a, label, cls = "", disabled = false) =>
    `<button type="button" data-action="${a}" class="${cls}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const link = (href, label, cls = "") => `<a href="${e(href)}" class="${cls}">${label}</a>`;
  const viewName = (s) => d.views.find((v) => v.value === s.view).label;
  const effective = (s) => s.items.filter((v) => s.selected.includes(v.id));
  const descriptions = {
    recommended: "五项质量门通过后的人工审阅清单。进入详情核对，再填写采纳原因。",
    rule_candidates: "规则来源门槛已达到。逐项核对缺失的质量门，候选不等于可采纳。",
    evidence_pending: "尚未达到规则来源门槛。这里展示来源与证据进展，不生成缺失评分。",
    all: "查看手工、规则发现与其他来源机会。仅在此队列执行当前列表范围的批量操作。",
  };
  const options = {
    decision_status: [
      ["", "全部状态"],
      ["pending", "待决策"],
      ["adopted", "已采纳"],
      ["observing", "继续观察"],
      ["rejected", "已驳回"],
    ],
    coverage_status: [
      ["", "全部完整度"],
      ["insufficient", "不完整"],
      ["partial", "部分完整"],
      ["complete", "完整"],
    ],
    blocking_reason: [
      ["", "全部原因"],
      ["evidence_insufficient", "缺少可采纳证据"],
      ["recommendation_insufficient", "尚无可靠推荐结论"],
    ],
    lifecycle_status: [
      ["", "全部阶段"],
      ["candidate", "候选"],
      ["validating", "验证中"],
      ["ready", "可决策"],
      ["adopted", "已采纳"],
      ["observing", "观察中"],
      ["rejected", "已驳回"],
      ["archived", "已归档"],
    ],
  };
  const labels = {
    q: "机会名称",
    market: "市场",
    decision_status: "决策状态",
    coverage_status: "证据完整度",
    blocking_reason: "阻断原因",
    lifecycle_status: "阶段",
    owner_id: "负责人",
  };
  const displayFilter = (key, value) =>
    options[key]?.find((o) => o[0] === value)?.[1] ||
    (key === "owner_id"
      ? d.members.find((m) => m.id === value)?.label || "已选负责人（选项待核对）"
      : value);
  function filters(s) {
    return Object.keys(d.filters)
      .filter((k) => k !== "decision_status" || s.view === "all")
      .map((k) => {
        const opts =
          k === "owner_id"
            ? [["", "全部负责人"], ...s.members.map((v) => [v.id, v.label])]
            : options[k];
        const extra =
          k === "owner_id" && s.draft[k] && !opts.some((o) => o[0] === s.draft[k])
            ? [[s.draft[k], "已选负责人（选项待核对）"]]
            : [];
        return `<label>${labels[k]}${opts ? `<select name="${k}" data-bind="draft.${k}">${[...opts, ...extra].map(([v, t]) => `<option value="${e(v)}" ${s.draft[k] === v ? "selected" : ""}>${t}</option>`).join("")}</select>` : `<input name="${k}" data-bind="draft.${k}" value="${e(s.draft[k])}" maxlength="${k === "q" ? 200 : 40}" />`}</label>`;
      })
      .join("");
  }
  function setup(s) {
    if (
      !["recommended", "rule_candidates"].includes(s.view) ||
      !["ready", "empty"].includes(s.state)
    )
      return "";
    if (s.setup === "unknown")
      return `<section class="setup"><h3>自动推荐配置 · 状态未知</h3><p>配置读取失败不影响保留候选，也不表示配置已完成。</p>${link("/opportunities/scoring-rules", "检查评分规则")}</section>`;
    const ready = s.setup === "ready",
      steps = d.emptySetup.steps;
    return `<section class="setup"><div class="setup-head"><div><h3>${ready ? "自动推荐配置已就绪" : "下一步：设置评分规则"}</h3><p class="meta">${ready ? "5" : "0"} / 5 项配置 · 配置就绪不等于本商品质量门通过</p></div>${ready ? "" : link(steps[0].route, "设置评分规则")}</div><details ${s.setupOpen ? "open" : ""}><summary>查看五项配置状态</summary><ol>${steps.map((v) => `<li><div><strong>${v.label}</strong><small>${ready ? "隔离已配置状态示例；不是当前生产检查。" : e(v.description)}</small></div>${ready ? "<span>已配置</span>" : link(v.route, "去设置")}</li>`).join("")}</ol></details></section>`;
  }
  function row(s, item, i) {
    const original = item;
    const stage =
      item.selection_stage ?? (item.matched_rule_count > 0 ? "rule_candidate" : "not_eligible");
    const gates = ["score", "market", "competition", "cost", "risk"],
      gateNames = ["评分", "市场", "竞争", "成本", "风险"];
    const status = (value) =>
      ({
        pending: "待判断",
        adopted: "已采纳",
        observing: "观察中",
        rejected: "已驳回",
        unknown: "待识别",
        low: "低",
        medium: "中",
        high: "高",
      })[value] || value;
    const facts =
      s.view === "rule_candidates"
        ? [
            { label: "质量门", value: `${gates.filter((k) => item.quality_gates?.[k]).length}/5` },
            { label: "证据", value: `${item.evidence_count} 条 · ${item.source_count} 源` },
            {
              label: "下一项",
              value: gateNames[gates.findIndex((k) => !item.quality_gates?.[k])] || "全部通过",
            },
          ]
        : s.view === "evidence_pending"
          ? [
              { label: "独立来源", value: `${item.source_count} 个` },
              { label: "证据", value: `${item.evidence_count} 条` },
              { label: "命中规则", value: `${item.matched_rule_count} 条` },
            ]
          : [
              ...(s.view === "all"
                ? [
                    {
                      label: "当前结论",
                      value:
                        stage === "recommended"
                          ? "建议采纳"
                          : stage === "rule_candidate"
                            ? "规则命中候选"
                            : status(item.decision_status),
                    },
                  ]
                : []),
              {
                label: "综合评分",
                value:
                  item.overall_score == null
                    ? "—"
                    : Number.isInteger(item.overall_score)
                      ? String(item.overall_score)
                      : item.overall_score.toFixed(1),
              },
              { label: "证据", value: `${item.evidence_count} 条 · ${item.source_count} 源` },
              { label: "风险", value: status(item.risk_level) },
            ];
    const selectable = s.view === "all" && s.canDecide;
    const source =
      item.matched_rule_count > 0
        ? `规则发现 · 命中 ${item.matched_rule_count} 条规则`
        : item.source_type === "manual"
          ? "手工添加"
          : "其他线索";
    const href = `/opportunities/${item.id}?${new URLSearchParams({ from: s.url })}`;
    return `<article class="op-row ${selectable ? "selectable" : ""}" data-row="${item.id}">${selectable ? `<label class="op-check"><input type="checkbox" data-select="${item.id}" aria-label="选择机会：${e(item.name)}" ${s.selected.includes(item.id) ? "checked" : ""} /></label>` : ""}<div class="picture" aria-label="${s.imageFailed ? "商品图片加载失败" : "商品主图待采集"}">${s.imageFailed ? "图片暂不可用" : "主图待采集"}</div><div class="row-main"><h4>${e(item.name)}</h4><p class="meta">${e(item.market)} · ${e(item.category || "未分类")}</p><p class="meta">${source}</p><p class="meta">更新于 ${new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.updated_at))}</p></div><div class="row-end"><dl>${facts.map((v) => `<div><dt>${v.label}</dt><dd>${e(v.value)}</dd></div>`).join("")}</dl>${link(href, original.selection_stage === "recommended" ? "审阅并采纳 →" : "查看进度 →")}</div></article>`;
  }
  function statePanel(s) {
    const filterActive = Object.values(s.applied).some(Boolean);
    const titles = {
      loading: "正在读取当前队列",
      error: "机会列表读取失败",
      expired: "登录已过期",
      forbidden: "当前范围无访问权限",
      blocked: "当前请求暂不可用",
      empty: filterActive
        ? "当前筛选没有结果"
        : s.view === "all"
          ? "这里还没有机会"
          : `${viewName(s)}暂无项目`,
    };
    return `<section class="empty-panel" role="${s.state === "empty" || s.state === "loading" ? "status" : "alert"}"><span class="empty-mark" aria-hidden="true">${s.state === "loading" ? "…" : s.state === "empty" ? "○" : "!"}</span><h3>${titles[s.state]}</h3><p>${s.state === "loading" ? "读取结果返回前不展示旧列表或零数量。" : s.state === "empty" ? "这是当前返回范围的空结果，不代表其他队列没有候选。" : "保留当前地址与筛选。恢复读取前不把失败当作零机会。"}</p><div class="actions">${s.state === "loading" ? btn("retry", "读取中…", "", true) : s.state === "empty" ? (filterActive ? btn("reset", "清除筛选", "primary") : s.view === "all" ? (s.canDecide ? btn("create", "手工添加", "primary") : btn("retry", "刷新列表", "primary")) : link("/opportunities/scoring-rules", "完善自动推荐配置", "primary")) : btn("retry", "重新读取", "primary")}${s.state !== "loading" && s.view !== "all" ? btn("view:all", "查看全部机会") : ""}</div></section>`;
  }
  function main(s) {
    const selected = effective(s),
      hidden = s.selected.length - selected.length,
      count = Object.values(s.applied).filter(Boolean).length;
    return `<div class="op-layout"><aside class="op-rail"><p class="meta">机会工作区 / 04</p><h1>选品机会</h1><nav aria-label="机会队列">${d.views.map((v) => `<button type="button" data-action="view:${v.value}" ${s.view === v.value ? 'aria-current="page"' : ""}>${v.label}</button>`).join("")}</nav><p class="rail-note">来源门槛 → 质量门 → 人工判断<br /><br />每个队列有独立含义。导航中不填未读取的数量。</p></aside><main class="op-work" id="work" tabindex="-1"><header class="op-heading"><div><p class="meta">当前工作区 · 隔离审核样例</p><h2>${viewName(s)}</h2><p>${descriptions[s.view]}</p></div>${s.canDecide ? link("/opportunities/start", "创建选品 →", "primary") : '<p class="meta">只读访问 · 无机会决策权限</p>'}</header>${s.message ? `<div class="notice ${s.failed ? "error" : "success"}" role="status">${e(s.message)}</div>` : ""}${s.memberFailure ? '<div class="notice" role="alert">机会已加载；成员选项读取失败，批量指派暂不可用。重新读取前不把它解释为没有成员。</div>' : ""}${setup(s)}<section class="op-surface"><header class="range-bar"><div><h3>${["ready", "empty"].includes(s.state) ? `${s.total} 个${s.view === "recommended" ? "建议采纳商品" : "机会"}` : "数量待读取"}</h3><p class="applied">${
      count
        ? `已应用 ${count} 项：${Object.entries(s.applied)
            .filter(([, v]) => v)
            .map(([k, v]) => `${labels[k]} · ${e(displayFilter(k, v))}`)
            .join(" / ")}`
        : "未应用筛选 · 按更新时间排序"
    }</p></div><div class="actions">${btn("filter", `筛选${count ? ` · ${count}` : ""}`)}${count ? btn("reset", "清除筛选", "quiet") : ""}</div></header>${s.canDecide && s.view === "all" && s.selected.length ? `<nav class="selection" aria-label="机会批量操作"><div><strong>本页可处理 ${selected.length} 项</strong><small>${hidden ? `另有 ${hidden} 项选择不在本页，不会提交` : "仅处理当前返回列表中的选中项"}</small></div><div class="actions">${btn("assign", "批量指派", "", !selected.length || !s.members.length || s.busy)}${btn("review", "批量复核", "", !selected.length || s.busy)}${btn("archive", "批量归档", "danger", !selected.length || s.busy)}${btn("clear-selection", "取消选择", "quiet", s.busy)}</div></nav>` : ""}${s.state === "ready" ? s.items.map((v, i) => row(s, v, i)).join("") : statePanel(s)}${s.state === "ready" ? `<footer class="pagination" aria-label="机会分页">${btn("prev", "上一页", "", s.page <= 1 || s.busy)}<span>第 ${s.page} / ${Math.max(1, Math.ceil(s.total / 20))} 页</span>${btn("next", "下一页", "", s.page >= Math.ceil(s.total / 20) || s.busy)}</footer>` : ""}</section>${s.canDecide ? `<section class="secondary-tools"><div>${link("/trends?section=rules", "管理选品规则")}<p class="meta">规则负责持续发现；手工添加与 ERP 导入不会自动补齐评分或成本。</p></div>${s.view === "all" ? `<div class="actions">${btn("erp", "从 ERP 导入", "", s.busy)}${btn("create", "手工添加", "", s.busy)}</div>` : ""}</section>` : ""}</main></div>`;
  }
  function modal(s) {
    if (!s.modal) return "";
    const titles = {
      filter: "筛选当前机会队列",
      create: "创建机会候选",
      erp: "从米豆 ERP 商品列表导入",
      assign: "批量指派",
      review: "批量复核",
      archive: "批量归档",
    };
    let content = "",
      submit = "确认执行";
    if (s.modal === "filter") {
      content = `<p class="meta">当前为未应用草稿。关闭不会改变 URL；点击应用才重新读取列表。</p><div class="field-grid">${filters(s)}</div>`;
      submit = "应用筛选";
    } else if (s.modal === "create") {
      content = `<label>机会名称<input name="name" data-bind="form.name" value="${e(s.form.name)}" required maxlength="200" /></label><div class="field-grid"><label>市场<input name="market" data-bind="form.market" value="${e(s.form.market)}" required maxlength="40" /></label><label>分类（可选）<input name="category" data-bind="form.category" value="${e(s.form.category)}" maxlength="80" /></label></div><label>来源趋势 ID（可选）<input name="source_topic_id" data-bind="form.source_topic_id" value="${e(s.form.source_topic_id)}" maxlength="36" /></label><p class="meta">只接受当前工作区主题。创建后刷新真实证据，评分、利润与风险不会自动填充。取消后保留本页草稿。</p>`;
      submit = "创建机会";
    } else if (s.modal === "erp") {
      content = `<p>浏览器助手在本机 ERP 页面读取商品；登录令牌不发送到智能选品。原始记录、来源网址与采集时间会作为证据保存。</p><label>本次导入数量<input type="number" name="limit" data-bind="limit" value="${s.limit}" required min="1" max="500" /></label><label class="file-choice">选择 ERP JSON<input type="file" name="erp-file" accept=".json,application/json" ${s.busy ? "disabled" : ""} /><small>选择文件即读取并导入，不另设确认按钮。接受商品数组或接口 list 数组。</small></label><p class="meta">关闭弹窗不会取消已经发出的读取或导入请求。此图稿仅本地模拟，不连接 ERP 或助手。</p>${link("/browser-helper/scoutops-browser-helper.zip", "下载浏览器助手")}`;
      submit = "从当前浏览器读取";
    } else {
      const selection = effective(s);
      content = `<div class="notice"><strong>本次实际处理 ${selection.length} 项</strong><p>${s.selected.length > selection.length ? `本页外的 ${s.selected.length - selection.length} 项不包含在请求中。` : "当前返回列表中的选中项，逐项携带版本。"}</p></div><ul class="impact-list">${selection.map((v) => `<li>${e(v.name)}<small>版本 ${v.version}</small></li>`).join("")}</ul>${s.modal === "assign" ? `<label>负责人<select name="assignee" data-bind="assignee" required><option value="">请选择当前工作区成员</option>${s.members.map((m) => `<option value="${m.id}" ${s.assignee === m.id ? "selected" : ""}>${e(m.label)}</option>`).join("")}</select></label>` : `<p>${s.modal === "review" ? "进入验证中，创建或复用人工复核任务。不会自动采纳或改变决策结论。" : "归档不是删除。归档项默认不在列表显示，可用“阶段：已归档”筛选查看。"}</p>`}<label>操作原因<textarea name="reason" data-bind="reason" required maxlength="1000" ${s.reasonInvalid ? 'aria-invalid="true" aria-describedby="reason-error"' : ""}>${e(s.reason)}</textarea>${s.reasonInvalid ? '<small id="reason-error" class="inline-error">请填写非空操作原因。</small>' : ""}</label><p class="meta">任一版本冲突由后端拒绝整批。图稿不执行事务，不证明真实回滚。</p>`;
    }
    return `<dialog aria-labelledby="op-modal-title"><form id="modal-form"><header class="modal-head"><div><p class="meta">${s.modal === "filter" ? "范围编辑" : "操作与影响"}</p><h3 id="op-modal-title">${titles[s.modal]}</h3></div>${btn("close", "×", "", s.busy && s.modal !== "erp")}</header><div class="modal-content">${s.modalError ? `<div class="notice error" role="alert" tabindex="-1">${e(s.modalError)}</div>` : ""}${s.busy ? `<div class="notice" role="status">${s.modal === "erp" ? "读取并导入中；关闭不会撤销请求。" : "正在提交，请等待结果；避免重复操作。"}</div>` : ""}${content}</div><footer class="modal-foot">${s.modal === "filter" ? btn("reset", "重置") : ""}${btn("close", s.busy && s.modal === "erp" ? "关闭并保留请求" : "取消", "", s.busy && s.modal !== "erp")}<button type="submit" class="${s.modal === "archive" ? "danger" : "primary"}" ${s.busy ? "disabled" : ""}>${s.busy ? "处理中…" : submit}</button></footer></form></dialog>`;
  }
  window.OP_C_VIEW = { main, modal, effective };
})();
