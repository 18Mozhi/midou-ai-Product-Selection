(() => {
  const D = window.COMMERCIAL_DATA,
    app = document.querySelector("#app"),
    modal = document.querySelector("#modal");
  const copy = (v) => JSON.parse(JSON.stringify(v)),
    e = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const keys = Object.keys(D.quotaNames),
    names = D.quotaNames;
  const status = (v) =>
    ({
      active: "启用",
      draft: "草稿",
      retired: "已退役",
      suspended: "已暂停",
      ended: "已结束",
      revoked: "已撤销",
      unassigned: "未分配",
    })[v] || v;
  const uid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const date = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "未设置";
  const local = (v) =>
    v ? new Date(new Date(v).getTime() + 8 * 3600000).toISOString().slice(0, 16) : "";
  const num = (v) => Number(v ?? 0).toLocaleString("zh-CN");
  const pill = (v) => `<span class="pill ${e(v)}">${e(status(v))}</span>`;
  const btn = (id, text, disabled = false, cls = "") =>
    `<button type="button" id="${id}" class="${cls}" ${disabled ? "disabled" : ""}>${text}</button>`;
  function sample() {
    const d = copy(D.original);
    d.organization.id = uid(58);
    d.organization.name = "华南选品研究组（合成示例）";
    d.scope.organization_id = uid(58);
    d.assignment.id = uid(158);
    d.assignment.organization_id = uid(58);
    d.assignment.plan_id = uid(1);
    d.plans[0].id = uid(1);
    d.adjustments[0].id = uid(258);
    d.plans.push(
      {
        ...copy(d.plans[0]),
        id: uid(2),
        code: "draft_58",
        name: "待审核方案（合成）",
        status: "draft",
        assignment_count: 0,
        version: 1,
      },
      {
        ...copy(d.plans[0]),
        id: uid(3),
        code: "retired_58",
        name: "历史方案（合成）",
        status: "retired",
        assignment_count: 1,
      },
    );
    d.summary = { total: 3, active: 1, draft: 1, retired: 1 };
    d.pagination.total = 3;
    return d;
  }
  const defaultPlan = () => ({
    code: "",
    name: "",
    description: "",
    collection_tasks: 100,
    open_api_requests: 1000,
    report_exports: 20,
    reason: "商业配置变更",
  });
  let S,
    returnId = "refresh",
    instance = 0;
  const scenes = {
    default: "方案目录 / 三状态合成",
    original: "原始E2E夹具 / 不当真实运营数据",
    organization: "组织用量 / 已读取范围",
    unassigned: "组织尚未分配",
    suspended: "组织分配已暂停",
    ended: "组织分配已结束",
    lookup: "组织编号输入",
    "lookup-invalid": "组织编号格式错误",
    "lookup-pending": "组织读取中 / 保留旧范围",
    "lookup-error": "组织读取失败 / 保留旧范围",
    "clear-organization": "清除组织返回目录",
    "filter-draft": "筛选输入未提交",
    "filter-active": "筛选已启用",
    "filter-retired": "筛选已退役",
    "filter-empty": "筛选无匹配",
    "filter-pending": "筛选读取中",
    "filter-error": "筛选失败保留旧条件",
    empty: "全局没有方案",
    loading: "首次读取中",
    error: "首次读取错误含401/403",
    "rate-limited": "请求过于频繁",
    blocked: "依赖受阻",
    timeout: "首次超时无旧快照",
    "page-first": "方案分页 / 首20条",
    "page-last": "方案分页 / 末页",
    "adjustment-first": "调整历史 / 首10条",
    "adjustment-last": "调整历史 / 末页",
    "adjustment-empty": "无调整记录",
    "adjustment-timing": "记录状态与时间生效不同",
    "quota-zero": "零有效配额 / 不反推调整",
    "quota-over": "已用超过有效配额",
    "no-selectable": "当前页无启用可选方案",
    "current-off-page": "当前方案在分页外",
    "assignment-form": "四字段分配表单",
    "assignment-invalid": "分配日期与原因错误",
    "adjustment-form": "五字段人工调整",
    "adjustment-zero": "调整量为零",
    "adjustment-invalid-time": "失效早于生效",
    create: "七字段创建草稿",
    "create-invalid": "创建字段错误",
    "create-min": "配额下界0",
    "create-max": "配额上界10亿 / 原因500字",
    "create-saving": "创建中 / 可关闭不等于取消",
    "create-error": "创建失败 / 窗内可达",
    "edit-active": "七字段编辑启用方案",
    "edit-draft": "编辑草稿方案",
    "edit-retired": "编辑退役方案",
    "edit-invalid": "编辑原因单字符差异",
    "confirm-save": "保存方案 / 影响前后",
    "confirm-activate": "启用方案确认",
    "confirm-retire": "退役方案确认",
    "confirm-assign": "首次分配确认",
    "confirm-renew": "变更分配 / 新周期不猜用量",
    "confirm-suspend": "暂停组织确认",
    "confirm-resume": "恢复组织确认",
    "confirm-end": "结束组织确认",
    "confirm-adjust": "增加当前配额确认",
    "confirm-adjust-negative": "减少配额 / 截零提示",
    "confirm-adjust-future": "未来调整 / 不提前算当前配额",
    "confirm-adjust-expired": "已过期调整 / 预览限制",
    "confirm-revoke": "撤销记录确认",
    "confirm-revoke-future": "撤销未来记录 / 不减当前配额",
    "confirm-off-page": "分页外目标 / 不编造影响值",
    "confirm-saving": "执行中冻结内容",
    "confirm-conflict": "版本冲突 / 需重新核对",
    "confirm-error": "执行失败 / 原操作重试",
    "confirm-unknown": "写入结果未确认",
    "write-success": "模拟写成功并重读",
    "success-refresh-error": "写成功但刷新失败",
    "closed-pending": "关闭窗口不撤销已发事务",
    "new-dialog-old-result": "旧响应不关闭新窗口（提案）",
    technical: "请求与标识披露",
    "source-boundary": "实际源码问题与待审保护",
    cancelled: "取消未发送确认",
    focus: "按钮键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    disabled: "读取中按钮禁用",
    dark: "深色审核",
    contrast: "高对比审核",
    compact: "紧凑密度审核",
  };
  function reset() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    S = {
      data: sample(),
      tab: "catalog",
      view: "ready",
      query: "",
      filterStatus: "",
      orgInput: "",
      snapshot: { org: "", query: "", status: "", page: 1, adjustmentPage: 1 },
      pending: null,
      write: null,
      calls: [],
      message: "",
      modal: null,
      error: "",
      theme: "",
      compact: false,
      plan: defaultPlan(),
      assignment: {
        plan_id: uid(1),
        period_start: "2026-08-01T08:00",
        period_end: "2026-09-01T08:00",
        expected_version: 1,
        reason: "分配或调整配额方案",
      },
      adjustment: {
        quota_key: "collection_tasks",
        delta_value: 50,
        effective_at: "",
        expires_at: "",
        reason: "人工配额调整",
      },
      pageSet: false,
      adjustSet: false,
    };
  }
  function org() {
    S.tab = "organization";
    S.orgInput = S.data.organization.id;
    S.snapshot.org = S.data.organization.id;
  }
  function field(id, label, value, extra = "", hint = "", wide = false) {
    return `<label class="${wide ? "wide" : ""}" for="${id}">${label}<input id="${id}" value="${e(value)}" ${extra}>${hint ? `<small>${hint}</small>` : ""}</label>`;
  }
  function select(id, label, value, options, extra = "") {
    return `<label for="${id}">${label}<select id="${id}" ${extra}>${options.map(([v, t]) => `<option value="${e(v)}" ${v === value ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
  }
  function planRows() {
    return S.data.plans
      .map(
        (p) =>
          `<article class="plan-row"><div>${pill(p.status)}<h3>${e(p.name)}</h3><small>${e(p.code)}</small><p>${e(p.description || "未填写说明")}</p></div><dl>${keys.map((k) => `<div class="quota-pair"><dt>${names[k]}</dt><dd>${num(p.quotas[k])}</dd></div>`).join("")}</dl><div class="row-meta"><p>${p.assignment_count} 个使用组织<small>（活动或暂停分配）</small></p><small>第 ${p.version} 版<br>更新 ${date(p.updated_at)}</small><div class="actions"><button type="button" data-edit="${p.id}" ${S.write ? "disabled" : ""}>编辑</button>${p.status === "draft" ? `<button type="button" data-plan-action="activate" data-id="${p.id}">启用</button>` : p.status === "active" ? `<button type="button" class="danger" data-plan-action="retire" data-id="${p.id}">退役</button>` : ""}</div></div></article>`,
      )
      .join("");
  }
  function pagination(type) {
    const p = S.data[type === "plans" ? "pagination" : "adjustment_pagination"];
    if (p.total_pages <= 1) return "";
    return `<nav class="pagination" aria-label="${type === "plans" ? "方案目录" : "调整历史"}分页">${btn(type + "-prev", "上一页", !!S.pending || p.page <= 1)}<span>${type === "plans" ? "方案目录" : "调整历史"} 第 ${p.page} / ${p.total_pages} 页 · 共 ${p.total} ${type === "plans" ? "个" : "条"}</span>${btn(type + "-next", "下一页", !!S.pending || p.page >= p.total_pages)}</nav>`;
  }
  function catalog() {
    const d = S.data;
    return `<section class="ledger"><header class="ledger-head"><div><h2>方案目录</h2><p class="muted">管理基础配额；这里的统计为全平台。</p></div>${btn("new-plan", "新建配额方案", false, "primary")}</header><div class="catalog-summary">${[
      ["total", "全部"],
      ["active", "启用"],
      ["draft", "草稿"],
      ["retired", "已退役"],
    ]
      .map(([k, t]) => `<span>${t}<strong>${d.summary[k]}</strong></span>`)
      .join(
        "",
      )}</div><form id="filter-form" class="catalog-filter">${field("query", "方案搜索", S.query, 'maxlength="120"', "名称、内部标识或说明")}${select(
      "filter-status",
      "方案状态",
      S.filterStatus,
      [
        ["", "全部状态"],
        ["active", "已启用"],
        ["draft", "草稿"],
        ["retired", "已退役"],
      ],
    )}<button id="apply-filter" ${S.pending ? "disabled" : ""}>查询</button>${btn("reset-filter", "重置", !!S.pending)}</form><p class="scope-stamp">已读取：${e(S.snapshot.query || "无关键词")} / ${status(S.snapshot.status) || "全部状态"}；目录 ${d.pagination.total} 个，不改变全局方案数。</p>${d.plans.length ? planRows() : `<div class="empty"><h3>${d.summary.total ? "没有匹配方案" : "尚未创建配额方案"}</h3><p>${d.summary.total ? "调整名称或状态后重新查询。" : "先创建草稿，核对额度后再启用。系统不会生成默认业务方案。"}</p>${d.summary.total ? btn("empty-reset", "重置筛选") : btn("empty-create", "创建第一个草稿", false, "primary")}</div>`}${pagination("plans")}</section>`;
  }
  function assignmentForm() {
    const a = S.assignment;
    const options = S.data.plans.filter((p) => p.status === "active");
    if (S.data.assignment && !options.some((p) => p.id === S.data.assignment.plan_id))
      options.unshift({
        id: S.data.assignment.plan_id,
        name: S.data.assignment.plan_name,
        code: S.data.assignment.plan_code,
      });
    return `<section class="section-heading"><h3>${S.data.assignment ? "调整方案与周期" : "首次分配方案"}</h3><p class="muted">可选项来自当前目录页的启用方案，并补入当前分配方案。</p><form id="assignment-form" class="form-grid">${select("assignment-plan", "配额方案", a.plan_id, [["", "请选择"], ...options.map((p) => [p.id, p.name + " / " + p.code])], "required")}${field("assignment-reason", "分配原因", a.reason, 'required minlength="2" maxlength="500"', "当前表单最少2字符；服务trim后最少1字符。")}${field("period-start", "周期开始", a.period_start, 'type="datetime-local" required')}${field("period-end", "周期结束", a.period_end, 'type="datetime-local" required', "严格晚于开始；北京时间展示。")}<div class="wide"><button class="primary" id="assign" ${S.write || S.pending ? "disabled" : ""}>${S.data.assignment ? "核对分配变更" : "核对首次分配"}</button></div></form>${!options.length ? '<p class="notice warn">当前页没有启用方案，请返回目录查询；这里不是全量远程方案搜索。</p>' : ""}</section>`;
  }
  function adjustmentForm() {
    const a = S.adjustment;
    return `<section class="section-heading"><h3>人工配额调整</h3><form id="adjustment-form" class="form-grid">${select(
      "quota-key",
      "计量项",
      a.quota_key,
      keys.map((k) => [k, names[k]]),
    )}${field("delta", "调整量", a.delta_value, 'type="number" step="1" min="-1000000000" max="1000000000" required', "非零整数；正值增加，负值减少。")}${field("effective", "生效时间（可选）", a.effective_at, 'type="datetime-local"', "留空使用服务接收时刻。")}${field("expires", "失效时间（可选）", a.expires_at, 'type="datetime-local"', "有值时必须晚于生效时间。")}${field("adjust-reason", "调整原因", a.reason, 'required maxlength="500"', "trim后1–500字符。", true)}<div class="wide"><button id="adjust" class="primary" ${S.write || S.pending ? "disabled" : ""}>核对人工调整</button></div></form>${S.data.assignment?.status === "ended" ? '<p class="notice warn">该分配已结束，服务不接受新增调整。现有页面仍显示入口，此差异需在实现阶段处理。</p>' : ""}</section>`;
  }
  function history() {
    return `<section class="section-heading"><h3>人工调整记录</h3><p class="muted">按组织分页；包含已撤销和其他时间段记录，不是有效配额的求和清单。</p>${S.data.adjustments.map((a) => `<article class="adjustment-row"><div><strong>${names[a.quota_key]} ${a.delta_value > 0 ? "+" : ""}${num(a.delta_value)}</strong><p>${pill(a.status)}</p><small>第 ${a.version} 版 · 更新 ${date(a.updated_at)}</small></div><div><p>${e(a.reason)}</p><small>生效 ${date(a.effective_at)}<br>失效 ${a.expires_at ? date(a.expires_at) : "未设置"}</small></div><div>${a.status === "active" ? `<button type="button" data-revoke="${a.id}">撤销</button>` : ""}</div></article>`).join("") || '<p class="notice">该组织暂无人工调整记录。</p>'}${pagination("adjustments")}</section>`;
  }
  function organization() {
    const d = S.data,
      a = d.assignment;
    return `<form id="lookup-form" class="lookup">${field("organization-input", "组织内部编号", S.orgInput, 'required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"', "输入现有组织UUID；不新增组织选择接口。")}<button id="read-organization" ${S.pending ? "disabled" : ""}>读取组织</button>${btn("clear-organization", "清除组织", !!S.pending)}</form>${
      !S.snapshot.org
        ? '<section class="ledger empty"><h2>先读取组织，再核对额度</h2><p>当前未选择组织；不展示其他组织的用量或写入入口。</p></section>'
        : `<section><header class="org-band"><div><h2>${e(d.organization.name)}</h2><p>已读取组织 · ${pill(a?.status || "unassigned")}</p><small>${e(S.snapshot.org)}<br>事实观察时间 ${date(d.observed_at)}</small></div><div><p>${e(a?.plan_name || "尚无方案分配")}</p>${a ? `<small>当前周期 [开始，结束)<br>${date(a.period_start)}<br>至 ${date(a.period_end)}<br>分配第 ${a.version} 版</small><div class="actions">${a.status === "active" ? btn("suspend", "暂停") : a.status === "suspended" ? btn("resume", "恢复") : ""}${a.status !== "ended" ? btn("end", "结束", false, "danger") : ""}</div>` : ""}</div></header><div class="org-body">${
            a
              ? `<div class="usage-grid">${keys
                  .map((k) => {
                    const limit = Number(d.effective_quotas[k] || 0),
                      used = Number(d.usage[k] || 0);
                    return `<div class="usage-item"><p>${names[k]}（次）</p><strong>${num(used)} <small>/ ${num(limit)}</small></strong><div class="meter" aria-hidden="true"><i style="width:${limit ? Math.min(100, (used / limit) * 100) : 0}%"></i></div><small>已用 / 有效配额<br>${limit === 0 ? "有效配额为0；不计算百分比" : used > limit ? "已用超过有效配额" : "当前余量 " + num(Math.max(0, limit - used))}</small></div>`;
                  })
                  .join(
                    "",
                  )}</div><p class="scope-stamp">用量计全部任务/调用/导出记录，不按成功状态过滤；本页不执行自动强制限额。</p>`
              : ""
          }${assignmentForm()}${a ? adjustmentForm() + history() : ""}</div></section>`
    }`;
  }
  function render() {
    document.documentElement.className = [S.theme, S.compact ? "compact" : ""].join(" ");
    app.innerHTML = `<nav class="task-nav" aria-label="配额工作区">${btn("tab-catalog", "方案目录")}${btn("tab-organization", "组织配额")}</nav><div class="actions">${btn("refresh", S.pending ? "读取中…" : "刷新数据", !!S.pending)}${btn("technical", "技术详情")}${btn("boundary", "依据与边界")}</div><p class="draft-note">${S.original ? "当前使用仓库原始 E2E 夹具（o1/p1/a1不是合法业务UUID）" : "当前使用明确合成样例，非真实组织或配置"} · 全页单位为次数，无收费与支付。</p>${S.message ? `<p class="notice ${S.error ? "error" : "warn"}" role="status">${e(S.message)}</p>` : ""}${S.view !== "ready" ? `<section class="ledger empty"><h2>${{ loading: "正在读取配额方案", error: "读取失败", "rate-limited": "请求过于频繁", blocked: "配额管理依赖受阻", timeout: "读取超时" }[S.view]}</h2><p>尚无可展示的成功快照。${S.view === "error" ? "本页源码将401/403也归入通用error，不假称已实现专用权限页。" : ""}</p>${S.view === "loading" ? "" : btn("retry", "重新读取")}</section>` : S.tab === "catalog" ? catalog() : organization()}`;
    document.getElementById("tab-" + S.tab).setAttribute("aria-current", "page");
    bind();
  }
  function bind() {
    const on = (id, fn, event = "click") => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, fn);
    };
    on("tab-catalog", () => {
      S.tab = "catalog";
      render();
    });
    on("tab-organization", () => {
      S.tab = "organization";
      render();
    });
    on("refresh", () => read());
    on("retry", () => read());
    on("new-plan", () => openPlan());
    on("empty-create", () => openPlan());
    on("technical", () => openInfo("technical"));
    on("boundary", () => openInfo("source-boundary"));
    on("query", (ev) => (S.query = ev.target.value), "input");
    on("filter-status", (ev) => (S.filterStatus = ev.target.value), "change");
    on(
      "filter-form",
      (ev) => {
        ev.preventDefault();
        read({ query: S.query.trim(), status: S.filterStatus, page: 1 });
      },
      "submit",
    );
    const resetFilter = () => {
      S.query = "";
      S.filterStatus = "";
      read({ query: "", status: "", page: 1 });
    };
    on("reset-filter", resetFilter);
    on("empty-reset", resetFilter);
    on("organization-input", (ev) => (S.orgInput = ev.target.value), "input");
    on(
      "lookup-form",
      (ev) => {
        ev.preventDefault();
        read({ org: S.orgInput.trim(), adjustmentPage: 1 });
      },
      "submit",
    );
    on("clear-organization", () => read({ org: "", adjustmentPage: 1 }));
    for (const type of ["plans", "adjustments"])
      for (const [dir, delta] of [
        ["prev", -1],
        ["next", 1],
      ])
        on(type + "-" + dir, () =>
          read(
            type === "plans"
              ? { page: S.data.pagination.page + delta }
              : { adjustmentPage: S.data.adjustment_pagination.page + delta },
          ),
        );
    for (const [id, k] of [
      ["assignment-plan", "plan_id"],
      ["period-start", "period_start"],
      ["period-end", "period_end"],
      ["assignment-reason", "reason"],
    ])
      on(id, (ev) => (S.assignment[k] = ev.target.value), "input");
    for (const [id, k] of [
      ["quota-key", "quota_key"],
      ["delta", "delta_value"],
      ["effective", "effective_at"],
      ["expires", "expires_at"],
      ["adjust-reason", "reason"],
    ])
      on(id, (ev) => (S.adjustment[k] = ev.target.value), "input");
    on(
      "assignment-form",
      (ev) => {
        ev.preventDefault();
        if (S.assignment.period_end <= S.assignment.period_start) {
          S.message = "周期结束必须晚于开始。";
          S.error = "form";
          render();
          return;
        }
        prepare("assign");
      },
      "submit",
    );
    on(
      "adjustment-form",
      (ev) => {
        ev.preventDefault();
        if (!Number(S.adjustment.delta_value)) {
          S.message = "调整量必须是非零整数。";
          S.error = "form";
          render();
          return;
        }
        if (
          S.adjustment.expires_at &&
          new Date(S.adjustment.expires_at) <=
            new Date(S.adjustment.effective_at || D.original.observed_at)
        ) {
          S.message = "失效时间必须晚于生效时间。";
          S.error = "form";
          render();
          return;
        }
        prepare("adjust");
      },
      "submit",
    );
    for (const action of ["suspend", "resume", "end"]) on(action, () => prepare(action));
    app
      .querySelectorAll("[data-edit]")
      .forEach(
        (el) => (el.onclick = () => openPlan(S.data.plans.find((p) => p.id === el.dataset.edit))),
      );
    app.querySelectorAll("[data-plan-action]").forEach(
      (el) =>
        (el.onclick = () =>
          prepare(
            el.dataset.planAction,
            S.data.plans.find((p) => p.id === el.dataset.id),
          )),
    );
    app.querySelectorAll("[data-revoke]").forEach(
      (el) =>
        (el.onclick = () =>
          prepare(
            "revoke",
            S.data.adjustments.find((a) => a.id === el.dataset.revoke),
          )),
    );
  }
  function read(change = {}) {
    if (S.pending) return;
    S.pending = { ...copy(S.snapshot), ...change };
    const p = S.pending;
    S.calls.push({
      method: "GET",
      path: "/platform/commercial",
      query: {
        page: p.page,
        page_size: 20,
        adjustment_page: p.adjustmentPage,
        adjustment_page_size: 10,
        ...(p.org ? { organization_id: p.org } : {}),
        ...(p.query ? { query: p.query } : {}),
        ...(p.status ? { status: p.status } : {}),
      },
    });
    S.message = "读取中：旧结果仍属于下方“已读取”范围。";
    render();
  }
  function complete(outcome) {
    if (!S.pending) return;
    const p = S.pending;
    S.pending = null;
    if (outcome === "error") {
      S.message = "读取失败；保留原成功快照及其组织、筛选和分页，未把旧事实归给新组织。";
      S.error = "read";
      render();
      return;
    }
    const d = sample();
    if (p.org && p.org !== uid(58)) {
      d.organization.id = p.org;
      d.organization.name = "另一组织（合成响应）";
      d.scope.organization_id = p.org;
      d.assignment.organization_id = p.org;
      d.assignment.id = uid(159);
    }
    if (S.pageSet) {
      const all = Array.from({ length: 21 }, (_, i) => ({
        ...copy(d.plans[0]),
        id: uid(i + 1000),
        code: "synthetic_" + i,
        name: "分页合成方案 " + (i + 1),
      }));
      d.plans = all.slice((p.page - 1) * 20, p.page * 20);
      d.summary = { total: 21, active: 21, draft: 0, retired: 0 };
      d.pagination = { page: p.page, page_size: 20, total: 21, total_pages: 2 };
    } else {
      d.plans = d.plans.filter(
        (x) =>
          (!p.status || x.status === p.status) &&
          (!p.query || (x.name + x.code + x.description).includes(p.query)),
      );
      d.pagination.total = d.plans.length;
    }
    if (S.adjustSet) {
      d.adjustments = Array.from({ length: p.adjustmentPage === 1 ? 10 : 1 }, (_, i) => ({
        ...copy(d.adjustments[0]),
        id: uid(2000 + i),
        reason: "分页合成调整 " + ((p.adjustmentPage - 1) * 10 + i + 1),
      }));
      d.adjustment_pagination = {
        page: p.adjustmentPage,
        page_size: 10,
        total: 11,
        total_pages: 2,
      };
    }
    if (outcome === "empty") {
      d.plans = [];
      d.pagination.total = 0;
    }
    S.data = d;
    S.snapshot = copy(p);
    S.orgInput = p.org;
    S.view = "ready";
    S.error = "";
    S.message = "模拟读取完成；未请求服务器。";
    if (!p.org) S.tab = "catalog";
    render();
  }
  function show(title, desc, content, footer = "", type = "info") {
    if (modal.open) modal.close();
    returnId = document.activeElement?.id || "refresh";
    S.modal = { type, instance: ++instance };
    modal.innerHTML = `<header><h2 id="modal-title">${title}</h2>${btn("close", "关闭")}</header><p id="modal-desc" class="scope-stamp">${desc}</p>${content}${footer ? `<footer>${footer}</footer>` : ""}`;
    modal.showModal();
    document.querySelector("#close").onclick = close;
    const cancel = document.querySelector("#cancel");
    if (cancel) cancel.onclick = close;
    modal.querySelector("button:not(:disabled)")?.focus();
  }
  function close() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    S.modal = null;
    document.getElementById(returnId)?.focus();
    if (document.activeElement === document.body) document.getElementById("refresh")?.focus();
  }
  modal.addEventListener("cancel", (ev) => {
    ev.preventDefault();
    close();
  });
  modal.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return;
    const f = [
      ...modal.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary",
      ),
    ].filter((n) => n.getClientRects().length);
    if (ev.shiftKey && document.activeElement === f[0]) {
      ev.preventDefault();
      f.at(-1).focus();
    } else if (!ev.shiftKey && document.activeElement === f.at(-1)) {
      ev.preventDefault();
      f[0].focus();
    }
  });
  function openPlan(item) {
    if (!item && S.write) S.createKey = undefined;
    if (item)
      S.plan = {
        id: item.id,
        expected_version: item.version,
        name: item.name,
        description: item.description || "",
        ...item.quotas,
        status: item.status,
        reason: "编辑配额方案",
      };
    const p = S.plan,
      edit = !!p.id;
    show(
      edit ? "编辑配额方案" : "创建配额方案草稿",
      edit
        ? "保存先进入影响确认；可选择草稿、启用、退役三状态。"
        : "直接创建草稿，不额外二次确认；100/1000/20只是原表单初值，不是业务方案。",
      `<form id="plan-form" class="form-grid">${edit ? "" : field("plan-code", "内部标识", p.code, 'required maxlength="80" pattern="[a-z0-9][a-z0-9_\\-]{0,79}"', "1–80位小写字母、数字、下划线或连字符。")}${field("plan-name", "方案名称", p.name, 'required maxlength="120"')}<label class="wide" for="plan-description">方案说明<textarea id="plan-description" maxlength="500">${e(p.description)}</textarea></label><fieldset class="wide"><legend>基础配额（次数）</legend><div class="form-grid">${keys.map((k) => field("plan-" + k, names[k], p[k], 'type="number" required min="0" max="1000000000" step="1"')).join("")}</div></fieldset>${
        edit
          ? select("plan-status", "方案状态", p.status, [
              ["draft", "草稿"],
              ["active", "启用"],
              ["retired", "退役"],
            ])
          : ""
      }${field("plan-reason", edit ? "修改原因" : "创建原因", p.reason, `required maxlength="500" ${edit ? 'minlength="2"' : ""}`, "保存原因，不在确认窗口重新输入。", true)}<p class="wide invalid" id="form-error" role="alert"></p><div class="wide actions">${btn("cancel", "取消")}<button id="plan-submit" class="primary" ${S.write ? "disabled" : ""}>${edit ? "保存并核对影响" : "创建草稿"}</button></div></form>`,
      "",
      edit ? "edit" : "create",
    );
    for (const k of ["code", "name", "description", ...keys, "status", "reason"]) {
      const input = document.getElementById("plan-" + k);
      if (input) input.oninput = () => (S.plan[k] = input.value);
    }
    document.getElementById("plan-form").onsubmit = (ev) => {
      ev.preventDefault();
      if (!S.plan.reason.trim()) {
        markInvalid("plan-reason", "原因不能仅含空格。");
        return;
      }
      if (edit) {
        const saved = copy(S.plan);
        close();
        prepare("save", saved);
      } else submitCreate();
    };
  }
  function markInvalid(id, text) {
    const el = document.getElementById(id);
    el?.setAttribute("aria-invalid", "true");
    el?.setAttribute("aria-describedby", "form-error");
    const message = document.getElementById("form-error");
    if (message) message.textContent = text;
  }
  function prepare(kind, item) {
    const d = S.data,
      a = d.assignment;
    let body,
      path,
      method = "POST",
      title,
      scope,
      rows = [],
      note = "版本与原因随操作保留；原型不发送请求。";
    if (["save", "activate", "retire"].includes(kind)) {
      const p = kind === "save" ? item : S.data.plans.find((x) => x.id === item.id);
      const current = d.plans.find((x) => x.id === p.id);
      body = {
        name: p.name,
        description: p.description,
        quotas: kind === "save" ? Object.fromEntries(keys.map((k) => [k, Number(p[k])])) : p.quotas,
        status: kind === "activate" ? "active" : kind === "retire" ? "retired" : p.status,
        expected_version: p.expected_version ?? p.version,
        reason: kind === "save" ? p.reason : S.plan.reason,
      };
      path = "/platform/commercial/plans/" + p.id;
      method = "PATCH";
      title =
        kind === "save" ? "保存方案修改" : kind === "activate" ? "启用配额方案" : "退役配额方案";
      scope = `${current?.assignment_count ?? 0} 个活动或暂停组织分配 · ${current?.name || p.name}`;
      rows = keys.map((k) => ({
        label: names[k],
        before: num(current?.quotas[k]),
        after: num(body.quotas[k]),
      }));
      rows.push({ label: "方案状态", before: status(current?.status), after: status(body.status) });
      note = "基础配额随方案版本变化，组织人工调整仍单独叠加。退役不是自动结束已分配组织。";
    } else if (kind === "assign") {
      body = {
        organization_id: S.snapshot.org,
        ...copy(S.assignment),
        expected_version: a?.version ?? null,
      };
      path = "/platform/commercial/assignments";
      title = a ? "调整组织配额方案" : "首次分配配额方案";
      scope = d.organization.name;
      const target =
        d.plans.find((p) => p.id === body.plan_id) ||
        (a?.plan_id === body.plan_id ? { name: a.plan_name, quotas: a.quotas } : null);
      rows = [
        {
          label: "配额方案",
          before: a?.plan_name || "未分配",
          after: target?.name || "需重新读取目标方案",
        },
        {
          label: "统计周期",
          before: a ? date(a.period_start) + " 至 " + date(a.period_end) : "未设置",
          after: body.period_start + " 至 " + body.period_end,
        },
        ...keys.map((k) => ({
          label: names[k] + "有效配额",
          before: a ? num(d.effective_quotas[k]) : "未分配",
          after: "写入后按有效调整与周期重新核对",
        })),
      ];
      note =
        "新周期用量不预估。截零后的有效额不足以反推负调整总额；不编造变更后余量。分配写入成功会变为启用。";
    } else if (kind === "adjust") {
      body = {
        organization_id: S.snapshot.org,
        assignment_id: a.id,
        ...copy(S.adjustment),
        delta_value: Number(S.adjustment.delta_value),
      };
      path = "/platform/commercial/adjustments";
      title = "人工调整配额";
      scope = d.organization.name;
      rows = [
        {
          label: names[body.quota_key],
          before: num(d.effective_quotas[body.quota_key]) + " 当前有效配额",
          after: (body.delta_value > 0 ? "+" : "") + num(body.delta_value) + " 调整记录",
        },
        { label: "生效时间", before: "不适用", after: body.effective_at || "服务接收时刻" },
        { label: "失效时间", before: "不适用", after: body.expires_at || "未设置" },
      ];
      note =
        "只有当前有效记录参与额度。未来/过期记录与截零情况不使用当前快照简单加减；执行后重新核对有效配额。";
    } else if (kind === "revoke") {
      body = { expected_version: item.version, reason: "撤销人工调整" };
      path = "/platform/commercial/adjustments/" + item.id + "/revoke";
      title = "撤销人工调整";
      scope = d.organization.name;
      rows = [
        {
          label: names[item.quota_key] + "记录",
          before:
            (item.delta_value > 0 ? "+" : "") + num(item.delta_value) + " / " + status(item.status),
          after: "已撤销",
        },
        {
          label: "记录生效区间",
          before:
            date(item.effective_at) +
            " 至 " +
            (item.expires_at ? date(item.expires_at) : "未设置失效"),
          after: "有效配额将在写入后重读",
        },
      ];
      note = "active是记录状态，不代表此刻生效；未来、过期或其他周期的记录不能直接从当前额度扣除。";
    } else {
      body = { action: kind, expected_version: a.version, reason: S.assignment.reason };
      path = "/platform/commercial/assignments/" + a.id + "/actions";
      title = { suspend: "暂停组织配额", resume: "恢复组织配额", end: "结束组织配额" }[kind];
      scope = d.organization.name;
      rows = [
        {
          label: "分配状态",
          before: status(a.status),
          after: status({ suspend: "suspended", resume: "active", end: "ended" }[kind]),
        },
      ];
      note = "变更分配状态，不编造付款、用量清零或自动强制限额结果。";
    }
    S.operation = {
      kind,
      title,
      path,
      method,
      body: copy(body),
      rows,
      scope,
      note,
      key: "prototype-" + ++instance,
    };
    openConfirm();
  }
  function openConfirm() {
    const o = S.operation;
    show(
      "确认" + o.title + "？",
      "先核对对象、前后差异及原因，再执行。",
      `<p class="notice"><strong>${e(o.scope)}</strong></p><div class="impact-list">${o.rows.map((r) => `<div class="impact-row"><h3>${e(r.label)}</h3><div><span>变更前</span><strong>${e(r.before)}</strong></div><div><span>变更后 / 待核对</span><strong>${e(r.after)}</strong></div></div>`).join("")}</div><p class="notice warn">${e(o.note)}</p><p>原因：${e(o.body.reason)}</p><small>依据版本：${o.body.expected_version ?? "首次创建，不带现有版本"}</small><p id="write-error" role="alert" class="notice error" hidden></p>`,
      btn("cancel", "取消", !!S.write) +
        btn("confirm-submit", S.write ? "执行中…" : "确认执行", !!S.write, "primary"),
      "confirm",
    );
    document.getElementById("confirm-submit").onclick = submitConfirm;
  }
  function submitCreate() {
    if (S.write) return;
    if (S.retry?.instance === S.modal?.instance) {
      startWrite(S.retry);
      document.getElementById("plan-submit").disabled = true;
      document.getElementById("cancel").disabled = true;
      return;
    }
    const p = S.plan;
    startWrite({
      kind: "create",
      path: "/platform/commercial/plans",
      method: "POST",
      body: {
        code: p.code,
        name: p.name,
        description: p.description,
        quotas: Object.fromEntries(keys.map((k) => [k, Number(p[k])])),
        reason: p.reason,
      },
      key: S.createKey ?? (S.createKey = "prototype-create-" + ++instance),
    });
    document.getElementById("plan-submit").disabled = true;
    document.getElementById("plan-submit").textContent = "创建中…";
    document.getElementById("cancel").disabled = true;
  }
  function submitConfirm() {
    if (S.write) return;
    startWrite(S.operation);
    document.getElementById("confirm-submit").disabled = true;
    document.getElementById("confirm-submit").textContent = "执行中…";
    document.getElementById("cancel").disabled = true;
  }
  function startWrite(op) {
    S.write = { ...copy(op), instance: S.modal?.instance, scope: copy(S.snapshot) };
    S.calls.push({ method: op.method, path: op.path, body: copy(op.body), idempotencyKey: op.key });
    modal.querySelectorAll("input,select,textarea").forEach((n) => (n.disabled = true));
  }
  function finishWrite(outcome) {
    if (!S.write) return;
    const w = S.write;
    S.write = null;
    const same = S.modal?.instance === w.instance;
    if (outcome === "error" || outcome === "conflict" || outcome === "unknown") {
      S.retry = copy(w);
      if (same) {
        const p = document.getElementById("write-error") || document.getElementById("form-error");
        p.hidden = false;
        p.textContent =
          outcome === "conflict"
            ? "版本冲突：关闭后刷新并重新核对；不覆盖新版本。"
            : outcome === "unknown"
              ? "结果未确认：先核对原操作，勿创建另一笔变更。"
              : "执行失败：保留原操作内容和幂等身份。";
        const b =
          document.getElementById("confirm-submit") || document.getElementById("plan-submit");
        b.disabled = outcome !== "error";
        b.textContent = "重试原操作";
        document.getElementById("cancel").disabled = false;
      } else {
        S.message = "已关闭的原操作返回错误或未确认结果；新窗口内容保持不变，需核对原操作。";
        render();
      }
      return;
    }
    if (same) close();
    S.message =
      outcome === "refresh-error"
        ? "模拟写入已成功；列表刷新失败。仍展示上次成功快照，请只重试读取，勿再次写入。"
        : "原操作模拟写入成功；本地合成响应已核对。";
    S.error = "";
    if (outcome !== "refresh-error" && S.snapshot.org === w.scope.org && w.kind === "save") {
      const item = S.data.plans.find((p) => w.path.endsWith("/" + p.id));
      if (item) {
        item.quotas = copy(w.body.quotas);
        item.version++;
        item.status = w.body.status;
      }
    }
    render();
    if (S.modal) {
      const submit = document.getElementById("plan-submit");
      if (submit) submit.disabled = false;
      document.querySelector("#close")?.focus();
    }
  }
  function openInfo(type) {
    show(
      type === "technical" ? "技术详情" : "源码证据与改进边界",
      type === "technical"
        ? "仅披露请求与对象标识，不含密钥。"
        : "以下是真实源码惰性执行结论；改进只存在于待审原型。",
      type === "technical"
        ? `<dl class="kv"><dt>组织快照</dt><dd>${e(S.snapshot.org || "未选择")}</dd><dt>请求编号</dt><dd>prototype-request-58（合成）</dd><dt>观察时间</dt><dd>${date(S.data.observed_at)}</dd><dt>分配标识</dt><dd>${e(S.data.assignment?.id || "无")}</dd><dt>页面路由</dt><dd>/platform-admin/commercial</dd></dl>`
        : D.findings
            .map(
              (f) =>
                `<section><h3>${e(f.id + " " + f.title)}</h3><p>${e(f.observed)}</p><p class="notice">待审：${e(f.proposal)}</p></section>`,
            )
            .join(""),
      btn("cancel", "关闭说明"),
      type,
    );
  }
  function scene(key) {
    reset();
    document.getElementById("scene").value = key;
    if (
      [
        "organization",
        "unassigned",
        "suspended",
        "ended",
        "lookup",
        "lookup-invalid",
        "lookup-pending",
        "lookup-error",
        "clear-organization",
        "adjustment-first",
        "adjustment-last",
        "adjustment-empty",
        "adjustment-timing",
        "quota-zero",
        "quota-over",
        "no-selectable",
        "current-off-page",
        "assignment-form",
        "assignment-invalid",
        "adjustment-form",
        "adjustment-zero",
        "adjustment-invalid-time",
        "confirm-assign",
        "confirm-renew",
        "confirm-suspend",
        "confirm-resume",
        "confirm-end",
        "confirm-adjust",
        "confirm-adjust-negative",
        "confirm-adjust-future",
        "confirm-adjust-expired",
        "confirm-revoke",
        "confirm-revoke-future",
        "confirm-off-page",
      ].includes(key)
    )
      org();
    if (key === "original") {
      S.data = copy(D.original);
      S.original = true;
      org();
    }
    if (key === "unassigned" || key === "confirm-assign") {
      S.data.assignment = null;
      S.assignment.expected_version = null;
    }
    if (key === "suspended" || key === "confirm-resume") S.data.assignment.status = "suspended";
    if (key === "ended") S.data.assignment.status = "ended";
    if (key === "lookup" || key === "lookup-invalid") {
      S.snapshot.org = "";
      S.orgInput = key === "lookup-invalid" ? "not-an-organization" : "";
      if (key === "lookup-invalid") {
        S.message = "组织编号格式无效，请填写现有组织的UUID。";
        S.error = "form";
      }
    }
    if (key === "empty") {
      S.data.plans = [];
      S.data.summary = { total: 0, active: 0, draft: 0, retired: 0 };
      S.data.pagination.total = 0;
    }
    if (["loading", "error", "rate-limited", "blocked", "timeout"].includes(key)) S.view = key;
    if (key === "filter-draft") {
      S.query = "审核";
      S.filterStatus = "draft";
    }
    if (key === "filter-active" || key === "filter-retired") {
      S.filterStatus = key.split("-")[1];
      S.snapshot.status = S.filterStatus;
      S.data.plans = S.data.plans.filter((p) => p.status === S.filterStatus);
      S.data.pagination.total = S.data.plans.length;
    }
    if (key === "filter-empty") {
      S.query = "无匹配";
      S.snapshot.query = S.query;
      S.data.plans = [];
      S.data.pagination.total = 0;
    }
    if (key.startsWith("page-")) {
      S.pageSet = true;
      S.pending = { ...copy(S.snapshot), page: key === "page-first" ? 1 : 2 };
      complete("success");
    }
    if (key === "adjustment-first" || key === "adjustment-last") {
      S.adjustSet = true;
      S.pending = { ...copy(S.snapshot), adjustmentPage: key === "adjustment-first" ? 1 : 2 };
      complete("success");
    }
    if (key === "adjustment-empty") {
      S.data.adjustments = [];
      S.data.adjustment_pagination.total = 0;
    }
    if (key === "adjustment-timing") {
      S.data.adjustments = ["active", "active", "revoked"].map((v, i) => ({
        ...copy(S.data.adjustments[0]),
        id: uid(700 + i),
        status: v,
        effective_at: i === 0 ? "2099-01-01T00:00:00Z" : "2026-07-01T00:00:00Z",
        expires_at: i === 1 ? "2026-07-02T00:00:00Z" : null,
        reason: ["未来生效（合成）", "已过期但状态仍active（合成）", "已撤销（合成）"][i],
      }));
      S.data.adjustment_pagination.total = 3;
      S.data.effective_quotas.open_api_requests = 1000;
    }
    if (key === "quota-zero") S.data.effective_quotas.collection_tasks = 0;
    if (key === "quota-over") S.data.usage.collection_tasks = 150;
    if (key === "no-selectable") {
      S.data.assignment = null;
      S.data.plans = [];
      S.data.pagination.total = 0;
      S.assignment.plan_id = "";
    }
    if (key === "current-off-page" || key === "confirm-off-page") {
      S.data.plans = [];
      S.data.pagination.total = 0;
      S.query = "不含当前方案的合成筛选";
      S.snapshot.query = S.query;
    }
    if (key === "assignment-invalid") {
      S.assignment.period_end = "2026-07-01T08:00";
      S.assignment.reason = "单";
      S.message = "周期结束必须晚于开始；当前表单原因至少2字符。";
      S.error = "form";
    }
    if (key === "adjustment-zero") {
      S.adjustment.delta_value = 0;
      S.message = "调整量必须是非零整数。";
      S.error = "form";
    }
    if (key === "adjustment-invalid-time") {
      S.adjustment.effective_at = "2026-09-02T08:00";
      S.adjustment.expires_at = "2026-09-01T08:00";
      S.message = "失效时间必须晚于生效时间。";
      S.error = "form";
    }
    if (key === "dark") S.theme = "dark";
    if (key === "contrast") S.theme = "contrast";
    if (key === "compact") S.compact = true;
    render();
    if (key === "focus") document.getElementById("refresh").focus();
    if (
      ["lookup-pending", "lookup-error", "filter-pending", "filter-error", "disabled"].includes(key)
    ) {
      if (key.startsWith("lookup")) {
        S.orgInput = uid(59);
        read({ org: uid(59) });
      } else read({ query: "审核", status: "draft" });
      if (key.endsWith("error")) complete("error");
    }
    if (key === "clear-organization") {
      read({ org: "" });
      complete("success");
    }
    if (key.startsWith("create") || key === "new-dialog-old-result") {
      if (key !== "create")
        S.plan = { ...defaultPlan(), code: "audit_58", name: "审核用草稿（合成）" };
      if (key === "create-min") for (const k of keys) S.plan[k] = 0;
      if (key === "create-max") {
        for (const k of keys) S.plan[k] = 1000000000;
        S.plan.reason = "核".repeat(500);
      }
      openPlan();
      if (key === "create-invalid") {
        document.getElementById("plan-code").value = "Bad Code";
        markInvalid("plan-code", "请使用小写内部标识；名称与原因必填。");
      }
      if (key === "create-saving" || key === "create-error" || key === "new-dialog-old-result") {
        submitCreate();
        if (key === "create-error") finishWrite("error");
        if (key === "new-dialog-old-result") {
          close();
          S.plan = { ...defaultPlan(), code: "new_58", name: "新开的草稿（不被旧结果关闭）" };
          openPlan();
          finishWrite("success");
        }
      }
    }
    if (key.startsWith("edit-")) {
      openPlan(S.data.plans.find((p) => p.status === key.split("-")[1]) || S.data.plans[0]);
      if (key === "edit-invalid") {
        document.getElementById("plan-reason").value = "单";
        markInvalid("plan-reason", "本表单最少2字符；服务允许1字符，差异待决定。");
      }
    }
    const confirmKinds = {
      "confirm-save": "save",
      "confirm-activate": "activate",
      "confirm-retire": "retire",
      "confirm-assign": "assign",
      "confirm-renew": "assign",
      "confirm-suspend": "suspend",
      "confirm-resume": "resume",
      "confirm-end": "end",
      "confirm-adjust": "adjust",
      "confirm-adjust-negative": "adjust",
      "confirm-adjust-future": "adjust",
      "confirm-adjust-expired": "adjust",
      "confirm-revoke": "revoke",
      "confirm-revoke-future": "revoke",
      "confirm-off-page": "assign",
      "confirm-saving": "retire",
      "confirm-conflict": "retire",
      "confirm-error": "retire",
      "confirm-unknown": "retire",
      "write-success": "save",
      "success-refresh-error": "retire",
      "closed-pending": "retire",
      cancelled: "retire",
    };
    if (confirmKinds[key]) {
      const kind = confirmKinds[key];
      let item =
        S.data.plans.find((p) => p.status === (kind === "activate" ? "draft" : "active")) ||
        sample().plans[0];
      if (kind === "save")
        item = { ...item, ...item.quotas, collection_tasks: 120, reason: "核对后调整基础配额" };
      if (key === "confirm-renew") S.assignment.period_end = "2026-10-01T08:00";
      if (key === "confirm-adjust-negative") S.adjustment.delta_value = -200;
      if (key === "confirm-adjust-future") S.adjustment.effective_at = "2099-01-01T08:00";
      if (key === "confirm-adjust-expired") {
        S.adjustment.effective_at = "2026-07-01T08:00";
        S.adjustment.expires_at = "2026-07-02T08:00";
      }
      if (kind === "revoke") {
        item = S.data.adjustments[0];
        if (key === "confirm-revoke-future") item.effective_at = "2099-01-01T00:00:00Z";
      }
      prepare(kind, item);
      if (
        [
          "confirm-saving",
          "confirm-conflict",
          "confirm-error",
          "confirm-unknown",
          "write-success",
          "success-refresh-error",
          "closed-pending",
        ].includes(key)
      ) {
        submitConfirm();
        if (key === "closed-pending") close();
        else if (key !== "confirm-saving")
          finishWrite(
            {
              "confirm-conflict": "conflict",
              "confirm-error": "error",
              "confirm-unknown": "unknown",
              "write-success": "success",
              "success-refresh-error": "refresh-error",
            }[key],
          );
      }
      if (key === "cancelled") close();
    }
    if (key === "technical" || key === "source-boundary") openInfo(key);
  }
  document.getElementById("scene").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.getElementById("scene").onchange = (ev) => scene(ev.target.value);
  window.COMMERCIAL_C = {
    scenes,
    scene,
    state: () => copy(S),
    complete,
    finishWrite,
    submitConfirm,
    submitCreate,
  };
  scene("default");
})();
