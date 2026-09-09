/* Offline, synthetic review surface. No API, storage or production mutations. */
(() => {
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const statuses = {
    draft: "草稿",
    pending_approval: "待审批",
    approved: "已批准",
    active: "生效中",
    retired: "已停用",
    rejected: "已拒绝",
    rolled_back: "已回滚",
  };
  const variants = [
    ["submit", "提交审批", "submit"],
    ["selection-approve", "选品经理批准", "approve", "selection_manager"],
    ["selection-reject", "选品经理拒绝", "reject", "selection_manager"],
    ["admin-approve", "组织管理员批准", "approve", "organization_admin"],
    ["admin-reject", "组织管理员拒绝", "reject", "organization_admin"],
    ["publish", "发布版本", "publish"],
    ["rollback", "回滚版本", "rollback"],
  ];
  const scenes = [
    ...[
      "directory",
      "exchange-basis",
      "readonly",
      "manager-only",
      "selection-only",
      "admin-only",
      "one-approved",
      "no-active",
      "no-rollback",
      "filter-empty",
      "page-two",
      "long-name",
      "loading",
      "empty",
      "error",
      "expired",
      "forbidden",
      "rate-limited",
      "blocked",
    ].map((id) => ({ id, label: id })),
    ...Object.keys(statuses).map((id) => ({ id: "status-" + id, label: statuses[id] })),
    ...["blank", "zero", "automatic", "invalid", "conflict", "busy", "saved"].map((id) => ({
      id: "create-" + id,
      label: "新草稿 · " + id,
    })),
    ...variants.flatMap(([id, label]) =>
      ["confirm", "invalid", "conflict", "busy", "success"].map((state) => ({
        id: id + "-" + state,
        label: label + " · " + state,
      })),
    ),
    ...["deep-ocean", "cloud-white", "aurora-purple"].flatMap((theme) =>
      ["comfortable", "compact"].map((density) => ({
        id: theme + "-" + density,
        label: theme + " / " + density,
      })),
    ),
  ];
  const makeRule = (i, status) => ({
    id: "rule-" + i,
    market: "US",
    platform: "amazon",
    version_code: "US-AMZ-2026-" + String(i).padStart(2, "0"),
    name: "美国站标准费用",
    status,
    revision: 7,
    effective_from: "2026-09-09",
    approvals: ["approved", "active", "retired", "rolled_back"].includes(status)
      ? ["selection_manager", "organization_admin"]
      : [],
  });
  let state, opener;
  const intents = [];
  const review = { scenes, intents, outcome: "conflict", choose };
  window.costRulesReview = review;
  const btn = (id, label, disabled = false, cls = "") =>
    `<button type="button" data-action="${id}" class="${cls}" ${disabled ? "disabled" : ""}>${label}</button>`;
  const selected = () => state.rules.find((r) => r.id === state.selected);
  const targets = () =>
    state.rules.filter(
      (r) =>
        r.id !== state.selected &&
        r.market === selected()?.market &&
        r.platform === selected()?.platform &&
        ["approved", "retired"].includes(r.status),
    );
  const canManage = () => state.capabilities.includes("opportunity:approve");
  function eligible(v, r = selected()) {
    if (!canManage() || !r) return false;
    if (v[2] === "submit") return r.status === "draft";
    if (v[3])
      return (
        r.status === "pending_approval" && state.roles.includes(v[3]) && !r.approvals.includes(v[3])
      );
    if (v[2] === "publish") return r.status === "approved";
    return r.status === "active" && targets().length > 0;
  }
  function choose(id) {
    if ($("#modal").open) $("#modal").close();
    document.body.dataset.theme = "deep-ocean";
    document.body.dataset.density = "comfortable";
    state = {
      id,
      rules: [
        makeRule(3, "active"),
        makeRule(4, "pending_approval"),
        makeRule(5, "draft"),
        makeRule(2, "retired"),
      ],
      selected: "rule-4",
      roles: ["selection_manager", "organization_admin"],
      capabilities: ["opportunity:approve"],
      query: "",
      filter: "all",
      page: 1,
      notice: "",
      kind: "ready",
      busy: false,
    };
    review.outcome = "conflict";
    if (id === "readonly") state.capabilities = [];
    if (id === "manager-only") state.roles = [];
    if (id === "selection-only") state.roles = ["selection_manager"];
    if (id === "admin-only") state.roles = ["organization_admin"];
    if (id === "one-approved") selected().approvals = ["selection_manager"];
    if (id === "no-active") state.rules = state.rules.filter((r) => r.status !== "active");
    if (id === "no-rollback") {
      state.rules = [makeRule(3, "active")];
      state.selected = "rule-3";
    }
    if (id === "filter-empty") state.query = "无匹配版本";
    if (id === "page-two") {
      state.rules = Array.from({ length: 12 }, (_, i) => makeRule(i + 1, "retired"));
      state.page = 2;
      state.selected = "rule-11";
    }
    if (id === "long-name") {
      selected().name = "显式费用依据与适用市场版本核对".repeat(8);
      selected().version_code = "VERSION-" + "0123456789".repeat(5);
    }
    if (
      ["loading", "empty", "error", "expired", "forbidden", "rate-limited", "blocked"].includes(id)
    )
      state.kind = id;
    if (id.startsWith("status-")) {
      selected().status = id.slice(7);
      selected().approvals = ["approved", "active", "retired", "rolled_back"].includes(
        selected().status,
      )
        ? ["selection_manager", "organization_admin"]
        : [];
    }
    for (const theme of ["deep-ocean", "cloud-white", "aurora-purple"])
      if (id.startsWith(theme)) {
        document.body.dataset.theme = theme;
        document.body.dataset.density = id.endsWith("compact") ? "compact" : "comfortable";
      }
    let variant = variants.find((v) => id.startsWith(v[0] + "-"));
    if (variant) {
      selected().status =
        variant[2] === "submit"
          ? "draft"
          : variant[2] === "publish"
            ? "approved"
            : variant[2] === "rollback"
              ? "active"
              : "pending_approval";
      selected().approvals =
        selected().status === "approved" ? ["selection_manager", "organization_admin"] : [];
    }
    if (id.endsWith("-success"))
      state.notice =
        "离线成功态示例：操作已接受。此提示不证明真实版本已变更；重新读取的结果单独核对。";
    if (id === "create-saved")
      state.notice = "草稿已创建（合成回执示例）。尚未提交审批，也未发布。";
    render();
    if (id.startsWith("create-") && id !== "create-saved") openCreate(id.slice(7));
    if (variant && !id.endsWith("-success")) openAction(variant, id.slice(variant[0].length + 1));
    $("#scene").value = id;
  }
  function render() {
    const r = selected(),
      active = state.rules.find((r) => r.status === "active");
    $("#app").innerHTML =
      `<header class="identity"><b class="brand">ScoutOps / 智能选品</b><span>示例工作区 · 供应与成本</span></header><div class="workspace"><aside class="scope"><p class="meta">供应与成本 / 费用版本</p><h1>费用版本审批</h1><p>先核对费用依据，再审批下一版本。</p>${canManage() ? btn("SC-R-CREATE", "＋ 新建费用版本", false, "primary") : "<p>只读访问 · 当前无规则管理权限</p>"}<a href="#" data-action="SC-R-BACK">← 返回找货记录</a><hr><dl><div><dt>列表中的首个生效版本</dt><dd>${active ? esc(active.version_code) : "尚未发布"}</dd></div><div><dt>该版本适用范围</dt><dd>${active ? esc(active.market + " / " + active.platform) : "—"}</dd></div></dl><p class="footnote">生效规则不代表所有市场已就绪，也不代表商品成本已完成复核。</p></aside><main class="main">${state.notice ? `<p class="notice" role="status">${esc(state.notice)}</p>` : ""}${
        state.kind !== "ready"
          ? statePanel()
          : `<section class="panel"><div class="panel-head"><div><h2>版本目录</h2><p class="meta">选择版本，核对费用、适用日期与审批进度</p></div>${btn("SC-R-REFRESH", "刷新列表")}</div><form class="filters" role="search"><label>搜索版本<input id="search" type="search" value="${esc(state.query)}" placeholder="名称、市场、平台或版本号"></label><label>版本状态<select id="filter"><option value="all">全部状态</option>${Object.entries(
              statuses,
            )
              .map(
                ([v, t]) =>
                  `<option value="${v}" ${v === state.filter ? "selected" : ""}>${t}</option>`,
              )
              .join(
                "",
              )}</select></label>${btn("SC-R-RESET", "重置", !state.query && state.filter === "all")}</form><div id="results"></div></section><section id="detail" class="panel"></section>`
      }</main></div>`;
    $(".filters")?.addEventListener("submit", (e) => e.preventDefault());
    $("#search")?.addEventListener("input", (e) => {
      state.query = e.target.value;
      state.page = 1;
      renderResults();
    });
    $("#filter")?.addEventListener("change", (e) => {
      state.filter = e.target.value;
      state.page = 1;
      renderResults();
    });
    if (state.kind === "ready") renderResults();
  }
  function statePanel() {
    const labels = {
      loading: ["正在读取费用版本", "请稍候，尚未取得规则数据。"],
      empty: ["尚无费用版本", "从空白费用创建首个草稿。"],
      error: ["读取失败", "不能把失败显示为空目录。请重试读取。"],
      expired: ["登录已过期", "重新登录后再读取费用版本。"],
      forbidden: ["当前无权读取", "请核对工作区与权限。"],
      "rate-limited": ["请求受限", "请稍后显式重试，未自动重放任何写入。"],
      blocked: ["依赖暂不可用", "无法确认当前版本，请保留操作上下文。"],
    };
    const [title, desc] = labels[state.kind];
    return `<section class="panel empty"><h2>${title}</h2><p>${desc}</p>${state.kind !== "loading" ? btn("SC-R-REFRESH", "重新读取") : ""}<p class="meta">${state.kind === "loading" ? "未取得请求标识" : "示例请求标识：review-read-22"}</p></section>`;
  }
  function renderResults() {
    $("[data-action=SC-R-RESET]").disabled = !state.query && state.filter === "all";
    const rows = state.rules.filter(
      (r) =>
        (state.filter === "all" || r.status === state.filter) &&
        [r.name, r.market, r.platform, r.version_code]
          .join(" ")
          .toLocaleLowerCase()
          .includes(state.query.trim().toLocaleLowerCase()),
    );
    const pages = Math.max(1, Math.ceil(rows.length / 10));
    state.page = Math.min(state.page, pages);
    const slice = rows.slice((state.page - 1) * 10, state.page * 10);
    if (!slice.some((r) => r.id === state.selected)) state.selected = slice[0]?.id;
    $("#results").innerHTML =
      `<div class="versions">${slice.length ? slice.map((r) => `<button type="button" class="version" data-action="SC-R-SELECT" data-id="${r.id}" aria-pressed="${r.id === state.selected}"><b>${esc(r.name)}</b><span class="tag ${r.status}">${statuses[r.status]}</span><small>${esc(r.market)} / ${esc(r.platform)} · ${esc(r.version_code)} · 修订 ${r.revision}</small></button>`).join("") : "<div class=empty><h3>没有匹配的费用版本</h3><p>调整搜索或重置筛选；现行规则没有因此变化。</p></div>"}</div><p class="count">匹配 ${rows.length} 个版本 · 每页最多 10 个</p>${pages > 1 ? `<div class="pager">${btn("SC-R-PAGE-PREV", "上一页", state.page === 1)}<span>${state.page} / ${pages}</span>${btn("SC-R-PAGE-NEXT", "下一页", state.page === pages)}</div>` : ""}`;
    renderDetail();
  }
  function renderDetail() {
    const r = selected();
    if (!r) {
      $("#detail").hidden = true;
      return;
    }
    $("#detail").hidden = false;
    $("#detail").innerHTML =
      `<div class="panel-head"><div><p class="meta">当前选中版本 · ${esc(r.market)} / ${esc(r.platform)}</p><h2>${esc(r.name)}</h2><p class="meta">${esc(r.version_code)} · 修订 ${r.revision} · 生效日期 ${r.effective_from}</p></div><span class="tag ${r.status}">${statuses[r.status]}</span></div><div class="detail-grid"><div><h3>费用依据</h3><p class="meta">下列值均为审核样本，不是平台推荐费率。</p><dl class="fees"><dt>平台费</dt><dd>15 %</dd><dt>支付手续费</dt><dd>0 %</dd><dt>税费</dt><dd>0 %</dd><dt>履约成本</dt><dd>3.50 USD</dd><dt>入仓物流</dt><dd>${state.id === "exchange-basis" ? "0 USD" : "未配置"}</dd></dl><div class="basis"><h3>跨币种与自动成本</h3>${state.id === "exchange-basis" ? '<p>1 CNY = 0.14 USD · 汇率日期 2026-09-08</p><a href="https://example.com/review-only-rate" target="_blank" rel="noopener noreferrer" data-action="SC-R-SOURCE">查看来源（合成占位） ↗</a><p>手机壳自动成本 · 仍需对应高置信证据</p>' : "<p>未配置换算依据 · 仅人工复核成本</p>"}<p class="meta">可选项缺失不等于所有人工成本不可用；本页不计算利润或 ROI。</p></div></div><section class="approval"><h3>审批进度</h3><ol>${[
        ["selection_manager", "选品经理"],
        ["organization_admin", "组织管理员"],
      ]
        .map(
          ([role, label]) =>
            `<li>${label}<span>${r.approvals.includes(role) ? "已批准" : r.status === "pending_approval" ? "等待该角色审批" : "未记录批准"}</span></li>`,
        )
        .join(
          "",
        )}</ol><p class="meta">双角色批准后仍需单独发布；费用审批不等同于成本双人复核。</p></section></div><div class="actions">${variants
        .filter((v) => eligible(v))
        .map((v) =>
          btn(v[0], v[1], false, ["reject", "rollback"].includes(v[2]) ? "danger" : "primary"),
        )
        .join(
          "",
        )}</div>${!canManage() ? "<p class=notice>只读权限：可以核对版本，不可创建或处理审批。</p>" : r.status === "pending_approval" && !variants.some((v) => eligible(v)) ? "<p class=notice>等待尚未处理的真实审批角色；管理权限不替代角色资格。</p>" : r.status === "active" && !targets().length ? "<p class=notice>没有同市场、同平台的已批准或已停用目标，暂不显示回滚操作。</p>" : ""}`;
  }
  const localDay = () =>
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(),
    );
  function field(name, label, value = "", attrs = "", hint = "") {
    return `<label>${label}<input name="${name}" value="${esc(value)}" ${attrs} aria-describedby="form-message">${hint ? `<span>${hint}</span>` : ""}</label>`;
  }
  function modalOpen(html) {
    opener = document.activeElement;
    $("#modal").innerHTML = html;
    $("#modal").showModal();
    $("#modal").scrollTop = 0;
  }
  function modalClose() {
    if (state.busy) return;
    $("#modal").close();
    if (opener?.isConnected) opener.focus();
  }
  function openCreate(mode = "blank") {
    if (!canManage()) return;
    const filled = ["zero", "automatic", "conflict", "busy"].includes(mode),
      auto = mode === "automatic";
    modalOpen(
      `<form id="create-form" novalidate><header><div><p class="meta">创建下一版本 / 保存不会发布</p><h2 id="modal-title">新建费用规则草稿</h2></div>${btn("CLOSE", "关闭")}</header><p>四项费用必须明确填写。空白不等于 0，不从生效版本预填。</p><fieldset><legend>适用范围与身份</legend><div class="field-grid">${field("market", "市场", "US", "required maxlength=40")}${field("platform", "平台", "amazon", "required maxlength=80")}${field("version_code", "版本号", filled ? "US-AMZ-2026-06" : "", "required maxlength=64")}${field("name", "规则名称", filled ? "美国站后续费用" : "", "required maxlength=160")}${field("effective_from", "生效日期", localDay(), "required type=date")}</div></fieldset><fieldset><legend>显式费用</legend><div class="field-grid">${[
        ["platform_fee", "平台费 %"],
        ["payment_fee", "支付手续费 %"],
        ["tax", "税费 %"],
        ["fulfillment", "履约成本"],
      ]
        .map(([n, l]) =>
          field(
            n,
            l,
            filled ? "0" : "",
            `required type=number min=0 ${n !== "fulfillment" ? "max=100" : ""} step=0.000001`,
          ),
        )
        .join(
          "",
        )}${field("currency", "履约币种", "USD", "required maxlength=3 pattern=[A-Za-z]{3}")}${field("logistics", "入仓物流（可选）", auto ? "0" : "", "type=number min=0 step=0.000001", "留空不加入费用项；明确 0 将保留。")}</div></fieldset><fieldset><legend>换算依据与自动成本</legend><label>自动成本适用品类<select name="automatic_product_family"><option value="">仅人工复核成本</option><option value="phone_case" ${auto ? "selected" : ""}>手机壳（Amazon + 1688 高置信匹配）</option></select></label><div class="field-grid">${field("conversion_rate", "1 CNY = 履约币种", auto ? "0.14" : "", "type=number min=0.000001 step=0.000001")}${field("conversion_effective_on", "汇率日期", localDay(), "type=date")}</div>${field("conversion_source_url", "HTTPS 来源页面", auto ? "https://example.com/review-only-rate" : "", "type=url maxlength=2048", "手机壳自动成本需 Amazon、物流及完整汇率依据；示例 URL 不是可用行情证据。")}</fieldset><p id="form-message" class="notice" role="status">保存仅创建草稿；发布前仍需双角色审批。</p><footer>${btn("CLOSE", "取消")}<button type="submit" class="primary">保存草稿</button></footer></form>`,
    );
    $("#create-form").addEventListener("submit", submitCreate);
    if (mode === "invalid") message("请填写版本号、名称及四项显式费用。", true);
    if (mode === "conflict") message("同市场/平台的版本号已存在。输入已保留，请核对版本号。", true);
    if (mode === "busy") setBusy();
  }
  function message(text, error = false) {
    const el = $("#form-message");
    el.textContent = text;
    el.className = error ? "alert" : "notice";
    el.setAttribute("role", error ? "alert" : "status");
  }
  function setBusy() {
    state.busy = true;
    $("#modal").setAttribute("aria-busy", "true");
    $("#modal")
      .querySelectorAll("button,input,select,textarea")
      .forEach((e) => (e.disabled = true));
    message("正在提交，请勿重复操作；关闭窗口不会撤销服务端请求。");
  }
  function submitCreate(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = e.target,
      v = Object.fromEntries(new FormData(f)),
      auto = v.automatic_product_family === "phone_case",
      hasRate = Boolean(v.conversion_rate.trim() || v.conversion_source_url.trim());
    f.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    let invalid = [...f.elements].find((el) => el.willValidate && !el.checkValidity());
    if (invalid) {
      invalid.setAttribute("aria-invalid", "true");
      message("请检查必填项、费用范围和币种格式；空白费用不能自动当作 0。", true);
      invalid.focus();
      return;
    }
    if (
      !v.name.trim() ||
      !v.version_code.trim() ||
      !v.market.trim() ||
      !v.platform.trim() ||
      (hasRate &&
        (!v.conversion_rate ||
          !v.conversion_effective_on ||
          !/^https:\/\//i.test(v.conversion_source_url))) ||
      (auto && (v.platform.trim().toLowerCase() !== "amazon" || v.logistics === "" || !hasRate))
    ) {
      message(
        "请核对名称、范围和完整 HTTPS 换算依据；手机壳自动成本另需 Amazon 与显式物流。",
        true,
      );
      return;
    }
    const body = {
      market: v.market.trim(),
      platform: v.platform.trim(),
      version_code: v.version_code.trim(),
      name: v.name.trim(),
      effective_from: v.effective_from,
      fee_lines: [
        ...["platform_fee", "payment_fee", "tax"].map((type) => ({
          type,
          mode: "percentage_of_sale",
          value: Number(v[type]),
          currency: null,
        })),
        {
          type: "fulfillment",
          mode: "fixed_amount",
          value: Number(v.fulfillment),
          currency: v.currency.toUpperCase(),
        },
        ...(v.logistics.trim()
          ? [
              {
                type: "logistics",
                mode: "fixed_amount",
                value: Number(v.logistics),
                currency: v.currency.toUpperCase(),
              },
            ]
          : []),
      ],
      conversion_rates: v.conversion_rate.trim()
        ? [
            {
              base_currency: "CNY",
              quote_currency: v.currency.toUpperCase(),
              rate_value: Number(v.conversion_rate),
              effective_on: v.conversion_effective_on,
              source_url: v.conversion_source_url.trim(),
            },
          ]
        : [],
      automatic_scope: auto ? { product_family: "phone_case" } : null,
    };
    intents.push({ url: "/cost-rules", method: "POST", body });
    message(
      "离线请求意图已记录；没有发送。模拟版本冲突，输入保留。服务端还会验证币种、日期和来源。",
      true,
    );
  }
  function openAction(v, mode = "confirm") {
    if (!eligible(v)) return;
    const r = { ...selected() },
      targetOptions = targets();
    modalOpen(
      `<form id="action-form" novalidate><header><div><p class="meta">版本操作 / ${v[3] ? esc(v[3]) : "管理权限"}</p><h2 id="modal-title">${v[1]}</h2></div>${btn("CLOSE", "关闭")}</header><div class="basis"><b>${esc(r.name)}</b><p>${esc(r.market)} / ${esc(r.platform)} · ${esc(r.version_code)}</p><p>当前：${statuses[r.status]} · 修订 ${r.revision}</p></div>${v[2] === "rollback" ? `<label>恢复目标<select name="target_rule_id">${targetOptions.map((t) => `<option value="${t.id}">${esc(t.version_code)} · ${statuses[t.status]} · ${esc(t.market)} / ${esc(t.platform)}</option>`).join("")}</select></label><p>仅恢复同市场、同平台的可用版本。历史记录保留。</p>` : `<p>${v[2] === "publish" ? "发布将替换同范围当前生效版。既有历史仍保留。" : v[2] === "submit" ? "提交后等待两类真实角色审批，不会直接发布。" : v[2] === "approve" ? "本次仅记录当前角色批准，另一角色及发布仍分别处理。" : "拒绝将结束当前待审批流程，并保留原因。"}</p>`}<label>操作原因（2–1000 字）<textarea name="reason" minlength="2" maxlength="1000" required rows="4" aria-describedby="form-message">${mode === "invalid" ? " " : "已核对费用依据与适用范围"}</textarea></label><p id="form-message" class="notice" role="status">原因与操作者、角色及版本共同保留。本原型不写入。</p><footer>${btn("CLOSE", "取消")}<button type="submit" class="primary">确认${v[1]}</button></footer></form>`,
    );
    $("#action-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (state.busy) return;
      const f = Object.fromEntries(new FormData(e.target));
      if (f.reason.trim().length < 2) {
        $("textarea").setAttribute("aria-invalid", "true");
        message("请输入至少 2 个字的有效原因。", true);
        $("textarea").focus();
        return;
      }
      intents.push({
        url: `/cost-rules/${r.id}/actions`,
        method: "POST",
        body: {
          action: v[2],
          reason: f.reason.trim(),
          expected_revision: r.revision,
          ...(v[3] ? { approval_role: v[3] } : {}),
          ...(v[2] === "rollback" ? { target_rule_id: f.target_rule_id } : {}),
        },
      });
      message(
        "模拟修订冲突：原因已保留，请取消后刷新实际版本，再核对并重试；不会猜测修订号或自动重放。",
        true,
      );
    });
    if (mode === "invalid") {
      $("textarea").setAttribute("aria-invalid", "true");
      message("请输入至少 2 个字的有效原因。", true);
    }
    if (mode === "conflict")
      message("规则已被更新，原因已保留。请取消后刷新实际版本，再核对并重试。", true);
    if (mode === "busy") setBusy();
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const id = el.dataset.action;
    if (id === "SC-R-SOURCE") {
      e.preventDefault();
      state.notice = "合成来源链接：仅展示已有 HTTPS 来源入口，没有访问行情服务。";
      render();
    }
    if (id === "CLOSE") modalClose();
    if (id === "SC-R-CREATE") openCreate();
    if (id === "SC-R-RESET") {
      state.query = "";
      state.filter = "all";
      state.page = 1;
      render();
    }
    if (id === "SC-R-SELECT") {
      state.selected = el.dataset.id;
      renderResults();
    }
    if (id === "SC-R-PAGE-PREV" || id === "SC-R-PAGE-NEXT") {
      state.page += id.endsWith("PREV") ? -1 : 1;
      renderResults();
    }
    if (id === "SC-R-REFRESH") {
      state.notice = "离线刷新演示：没有访问服务端，也没有更新真实修订号。";
      render();
    }
    if (id === "SC-R-BACK") {
      e.preventDefault();
      state.notice = "返回意图：/sourcing；只演示内部导航，不离开原型。";
      render();
    }
    const v = variants.find((v) => v[0] === id);
    if (v) openAction(v);
  });
  $("#modal").addEventListener("cancel", (e) => {
    e.preventDefault();
    modalClose();
  });
  $("#modal").addEventListener("close", () => $("#modal").removeAttribute("aria-busy"));
  $("#modal").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const list = [...$("#modal").querySelectorAll("button,input,select,textarea,a")].filter(
      (n) => !n.disabled && n.getClientRects().length,
    );
    if (!list.length) {
      e.preventDefault();
      return;
    }
    const first = list[0],
      last = list.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  $("#scene").innerHTML = scenes
    .map((s) => `<option value="${s.id}">${esc(s.label)}</option>`)
    .join("");
  $("#scene").addEventListener("change", (e) => choose(e.target.value));
  choose("directory");
})();
