(() => {
  const $ = (id) => document.getElementById(id);
  const data = window.SCOUTOPS_SCORING_DESIGN;
  const definitions = [
    ["market_demand", "市场需求"],
    ["competition", "竞争"],
    ["profit", "利润"],
    ["fulfillment_efficiency", "履约效率"],
    ["customer_experience", "客户体验"],
    ["content_fit", "场景与内容适配"],
    ["risk", "风险"],
    ["data_quality", "数据质量"],
  ];
  const actionLabels = {
    submit: "提交审批",
    approve: "批准",
    reject: "拒绝",
    activate: "启用",
    rollback: "回滚",
  };
  const statusLabels = {
    active: "已启用",
    draft: "草稿",
    pending_approval: "待审批",
    approved: "已批准",
    rejected: "已拒绝",
    retired: "已停用",
    rolled_back: "已回滚",
  };
  const actionStatuses = {
    submit: "draft",
    approve: "pending_approval",
    reject: "pending_approval",
    activate: "approved",
    rollback: "active",
  };
  const scenes = {
    versions: "版本目录",
    empty: "空目录",
    "readonly-empty": "只读空目录",
    readonly: "只读目录",
    "decide-only": "可提交但不可审批",
    "create-basics": "创建 · 版本与阈值",
    ...Object.fromEntries(
      definitions.map(([code, label]) => [`create-${code}`, `创建 · ${label}`]),
    ),
    preview: "只读影响预览",
    "preview-error": "预览失败（模拟）",
    "preview-loading": "预览读取中（模拟）",
    ...actionLabels,
    "action-conflict": "审批版本冲突（模拟）",
    "action-busy": "审批提交中（模拟）",
  };
  for (const [value, label] of Object.entries(scenes)) $("scene").add(new Option(label, value));
  let rules = data.rules,
    canDecide = true,
    canApprove = true,
    mode = "",
    selected,
    currentAction,
    opener;
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s],
    );
  const time = (value) =>
    value
      ? new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(value))
      : "—";
  function renderRules() {
    $("new-rule").hidden = !canDecide;
    $("first-rule").hidden = !canDecide;
    $("readonly-help").hidden = canDecide;
    $("directory").hidden = !rules.length;
    $("empty").hidden = Boolean(rules.length);
    const active = rules.find((rule) => rule.status === "active");
    const groups = new Set(
      (active?.dimensions ?? []).filter((dim) => dim.weight > 0).map((dim) => dim.evidence_group),
    );
    const gates = [
      ["评分规则", Boolean(active), active?.version_code ?? "尚无启用版本"],
      ["市场证据", groups.has("market"), groups.has("market") ? "已纳入评分" : "未设置证据组"],
      [
        "竞争证据",
        groups.has("competition"),
        groups.has("competition") ? "已纳入评分" : "未设置证据组",
      ],
      ["成本证据", groups.has("cost"), groups.has("cost") ? "已纳入评分" : "未设置证据组"],
      [
        "风险维度",
        Boolean(active?.dimensions.some((dim) => dim.code === "risk" && dim.weight > 0)),
        active?.dimensions.some((dim) => dim.code === "risk" && dim.weight > 0)
          ? "已启用风险权重"
          : "未启用风险权重",
      ],
    ];
    document.querySelector(".setup-status").textContent = gates.every(([, ready]) => ready)
      ? "评分配置已覆盖"
      : "配置未就绪";
    $("coverage").innerHTML =
      `<div class="active-strip"><div><small>当前生效版本</small><h3>${active ? esc(active.name) : "尚无已启用规则"}</h3><small>${active ? `更新 ${time(active.updated_at)} · 北京时间` : "规则命中商品只能停留在候选队列"}</small></div><b>${active ? esc(active.version_code) : "未设置"}</b></div><div class="coverage-grid">${gates.map(([label, ready, detail]) => `<div class="coverage-item ${ready ? "" : "warning"}"><strong>${esc(label)} · ${ready ? "已配置" : "缺项"}</strong><small>${esc(detail)}</small></div>`).join("")}</div><p class="coverage-explain">${canDecide ? "只有启用版本的配置才用于后续评分。" : "当前身份仅可查看规则。"} 完整自动推荐还需要竞品监控和费用规则同时生效；评分不替代人工决策。</p>`;
    $("versions").innerHTML =
      `<h3>版本目录 <small>当前 ${rules.length} 项</small></h3>` +
      rules
        .map((rule) => {
          const buttons = [];
          if (canApprove && ["draft", "pending_approval", "approved"].includes(rule.status))
            buttons.push(["preview", "预览影响"]);
          for (const [action, status] of Object.entries(actionStatuses))
            if (rule.status === status && (action === "submit" ? canDecide : canApprove))
              buttons.push([action, actionLabels[action]]);
          return `<article class="version-card" data-rule="${rule.id}"><div class="version-heading"><div><code>${esc(rule.version_code)} · rev ${rule.revision}</code><h3>${esc(rule.name)}</h3><p>更新 ${time(rule.updated_at)} · 审批 ${time(rule.approved_at)}</p></div><span class="badge">${statusLabels[rule.status]}</span></div><dl class="version-facts"><div><dt>推荐阈值</dt><dd>≥ ${rule.thresholds.recommend_min}</dd></div><div><dt>观察阈值</dt><dd>≥ ${rule.thresholds.observe_min}</dd></div></dl><div class="weights">${rule.dimensions.map((dim) => `<span>${esc(dim.label)} <b>${dim.weight}%</b></span>`).join("")}</div><div class="version-actions">${buttons.map(([action, label]) => `<button type="button" data-action="${action}" data-rule="${rule.id}" class="${["reject", "rollback"].includes(action) ? "danger" : action === "preview" ? "" : "primary"}">${label}</button>`).join("")}</div>${rule.status === "pending_approval" && !canApprove ? '<p class="help">等待有审批权限的成员处理</p>' : ""}</article>`;
        })
        .join("");
    for (const rule of rules)
      document.querySelector(`.version-card[data-rule="${rule.id}"] .badge`).dataset.status =
        rule.status;
  }
  function section(name) {
    $("basics").hidden = name !== "basics";
    $("dimensions").hidden = name !== "dimensions";
    $("show-basics").setAttribute("aria-pressed", String(name === "basics"));
    $("show-dimensions").setAttribute("aria-pressed", String(name === "dimensions"));
    $("modal").querySelector(".modal-scroll").scrollTop = 0;
  }
  function dimension(index) {
    $("dimension-choice").value = String(index);
    definitions.forEach((_, i) => {
      $(`dimension-${i}`).hidden = i !== index;
      $(`pick-${i}`).setAttribute("aria-pressed", String(i === index));
    });
  }
  definitions.forEach(([code, label], index) => {
    $("dimension-choice").add(new Option(label, String(index)));
    const button = document.createElement("button");
    button.id = `pick-${index}`;
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(index === 0));
    button.setAttribute("aria-controls", `dimension-${index}`);
    button.onclick = () => dimension(index);
    $("dimension-nav").append(button);
    const panel = document.createElement("section");
    panel.id = `dimension-${index}`;
    panel.className = "dimension-panel";
    panel.hidden = index !== 0;
    panel.setAttribute("aria-labelledby", `pick-${index}`);
    panel.innerHTML = `<h3>${label}</h3><label>权重（%）<input id="weight-${index}" aria-label="${label}权重" name="weight-${code}" type="number" min="0" max="100" step="0.01" value="0" /></label><label>证据组<select id="group-${index}" aria-label="${label}证据组" name="group-${code}"><option value="market">市场</option><option value="competition">竞争</option><option value="cost">成本</option><option value="other" selected>其他</option></select></label><label class="check-option"><input id="required-${index}" aria-label="${label}必填" name="required-${code}" type="checkbox" />该维度为必填输入</label><p class="help">权重为0时不启用，不会作为配置维度提交。</p>`;
    $("dimension-panels").append(panel);
  });
  $("show-basics").onclick = () => section("basics");
  $("dimension-choice").onchange = () => dimension(Number($("dimension-choice").value));
  $("show-dimensions").onclick = () => section("dimensions");
  function validateCreate() {
    const weights = definitions.map((_, index) => Number($(`weight-${index}`).value));
    const positive = weights.filter((weight) => weight > 0),
      total = Math.round(positive.reduce((sum, weight) => sum + weight, 0) * 100) / 100;
    let error = "";
    if (!$("version_code").value.trim() || !$("rule_name").value.trim())
      error = "请填写版本代码和规则名称。";
    else if (!$("recommend_min").value || !$("observe_min").value) error = "请填写推荐与观察阈值。";
    else if (!$("recommend_min").validity.valid || !$("observe_min").validity.valid)
      error = "推荐与观察阈值必须在0到100之间，最多两位小数。";
    else if (Number($("recommend_min").value) <= Number($("observe_min").value))
      error = "推荐阈值必须大于观察阈值。";
    else if (definitions.some((_, index) => !$(`weight-${index}`).validity.valid))
      error = "权重必须在0到100之间，最多两位小数。";
    else if (positive.length < 2) error = "至少配置2个权重大于0的评分维度。";
    else if (total !== 100) error = `当前权重合计 ${total}%，必须为100%。`;
    else if (!weights.some((weight, index) => weight > 0 && $(`required-${index}`).checked))
      error = "至少将1个已启用维度标记为必填。";
    $("validation").textContent = error || `权重合计 ${total}%，可以保存草稿。`;
    $("validation").dataset.valid = String(!error);
    if (mode === "create") $("save").disabled = Boolean(error);
    return error;
  }
  $("create-content").addEventListener("input", validateCreate);
  $("create-content").addEventListener("change", validateCreate);
  function start(kind, trigger) {
    if ($("modal").open) $("modal").close();
    mode = kind;
    opener = trigger;
    $("modal").dataset.kind = kind;
    for (const name of ["create", "preview", "action"]) {
      const content = $(`${name}-content`);
      content.hidden = name !== kind;
      content.querySelectorAll("input,select,textarea").forEach((input) => {
        input.disabled = name !== kind;
      });
    }
    $("save").hidden = kind === "preview";
    $("save").disabled = false;
    $("save").className = "primary";
    $("cancel").textContent = kind === "preview" ? "关闭预览" : "取消";
    $("modal-form").setAttribute("aria-busy", "false");
  }
  function reveal(focus) {
    $("modal").showModal();
    focus?.focus({ preventScroll: true });
    $("modal").querySelector(".modal-scroll").scrollTop = 0;
  }
  function openCreate(trigger) {
    if (!canDecide) return;
    start("create", trigger);
    section("basics");
    $("modal-title").textContent = "新建评分规则草稿";
    $("modal-kicker").textContent = "NEW VERSION";
    $("modal-intro").textContent = "不使用默认数值。保存草稿后仍需提交、批准并启用。";
    $("save").textContent = "保存草稿";
    validateCreate();
    reveal($("version_code"));
  }
  function previewContent(state = "preview") {
    if (
      selected.id !== data.preview.rule_id ||
      selected.version_code !== data.preview.rule_version_code
    ) {
      $("preview-content").innerHTML =
        '<p class="preview-failure">此场景未提供该版本的预览样本。未请求API，不展示其他版本的试算结果。</p>';
      return;
    }
    if (state === "preview-loading") {
      $("preview-content").innerHTML =
        '<p class="preview-failure" role="status">正在按当前持久化输入试算…（设计模拟）</p>';
      return;
    }
    if (state === "preview-error") {
      $("preview-content").innerHTML =
        '<div class="preview-failure"><p class="error" role="alert">预览依赖暂不可用；规则和机会状态均未改变。（设计模拟）</p><button id="retry-preview" type="button">重试预览</button></div>';
      $("retry-preview").onclick = () => {
        previewContent();
        $("close").focus();
        $("review-note").textContent = "只恢复隔离预览样本，未请求API，不代表线上服务恢复。";
      };
      return;
    }
    const preview = data.preview,
      item = preview.items[0];
    $("preview-content").innerHTML =
      `<p class="help">当前页 ${preview.items.length} / 共 ${preview.total} 个机会；只比较当前页。</p><dl class="preview-summary">${[
        ["分数上升", "increased"],
        ["分数下降", "decreased"],
        ["新可计算", "newly_calculable"],
        ["结论变化", "recommendation_changed"],
        ["仍数据不足", "insufficient_data"],
      ]
        .map(([label, key]) => `<div><dt>${label}</dt><dd>${preview.page_summary[key]}</dd></div>`)
        .join(
          "",
        )}</dl><h3>${esc(item.opportunity_name)}</h3><p class="help">可决策 · 当前规则 ${esc(item.current_rule_version)}</p><dl class="score-comparison"><div><dt>当前评分</dt><dd>${item.current_score.toFixed(2)}</dd></div><div><dt>只读试算</dt><dd>${item.projected_score.toFixed(2)}</dd></div><div><dt>分数变化</dt><dd>${item.score_delta.toFixed(2)}</dd></div></dl><div class="preview-meta"><p>试算结论：推荐 · 结论未变化</p><p>证据覆盖：${item.projected_coverage_percent}%</p><p>缺失字段：${item.missing_fields.length ? item.missing_fields.map(esc).join("、") : "样本未列出缺失字段"}</p></div><nav class="pagination" aria-label="预览分页"><button type="button" disabled>上一页</button><span>第 ${preview.page} 页</span><button type="button" disabled>下一页</button></nav>`;
  }
  function openPreview(rule, trigger, state = "preview") {
    if (!canApprove) return;
    start("preview", trigger);
    selected = rule;
    $("modal-title").textContent = `发布影响预览 · ${rule.version_code}`;
    $("modal-kicker").textContent = "READ-ONLY PREVIEW";
    $("modal-intro").textContent = "只读试算，不写入评分运行；不改规则、机会或历史评分。";
    previewContent(state);
    reveal($("close"));
  }
  function openAction(rule, action, trigger, state = "") {
    if (action === "submit" ? !canDecide : !canApprove) return;
    start("action", trigger);
    selected = rule;
    currentAction = action;
    $("modal-title").textContent = `${actionLabels[action]} · ${rule.version_code}`;
    $("modal-kicker").textContent = "AUDITED CHANGE";
    $("modal-intro").textContent = "请核对目标版本与操作原因。使用当前修订号进行冲突校验。";
    $("action-target").innerHTML =
      `<strong>${esc(rule.name)}</strong>${statusLabels[rule.status]} · ${esc(rule.version_code)} · rev ${rule.revision}`;
    $("reason").value = "";
    $("rollback-field").hidden = action !== "rollback";
    $("rollback-target").required = action === "rollback";
    $("rollback-target").disabled = action !== "rollback";
    $("rollback-target").replaceChildren(new Option("请选择已批准或停用版本", ""));
    for (const target of rules.filter((item) => ["approved", "retired"].includes(item.status)))
      $("rollback-target").add(
        new Option(`${target.version_code} · ${statusLabels[target.status]}`, target.id),
      );
    $("action-error").hidden = state !== "action-conflict";
    if (state === "action-conflict") $("reason").value = "核验该版本操作";
    $("save").textContent = state === "action-busy" ? "正在提交…" : `确认${actionLabels[action]}`;
    $("save").disabled = state === "action-busy";
    $("modal-form").setAttribute("aria-busy", String(state === "action-busy"));
    if (["reject", "rollback"].includes(action)) $("save").className = "danger-fill";
    reveal($("reason"));
  }
  function close() {
    $("modal").close();
    opener?.focus({ preventScroll: true });
  }
  $("close").onclick = close;
  $("cancel").onclick = close;
  $("modal").addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  $("modal").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = [...$("modal").querySelectorAll("button,input,select,textarea")].filter(
      (node) => !node.disabled && node.getClientRects().length,
    );
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      event.preventDefault();
      controls[0].focus();
    }
  });
  $("modal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("save").disabled || (mode === "create" && validateCreate())) return;
    $("review-note").textContent =
      `${mode === "create" ? "草稿校验" : actionLabels[currentAction]}演示结束，未请求API、未改变规则或历史评分。`;
    close();
  });
  $("new-rule").onclick = (event) => openCreate(event.currentTarget);
  $("first-rule").onclick = (event) => openCreate(event.currentTarget);
  $("versions").onclick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const rule = rules.find((item) => item.id === button.dataset.rule);
    if (button.dataset.action === "preview") openPreview(rule, button);
    else openAction(rule, button.dataset.action, button);
  };
  $("scene").onchange = () => {
    close();
    const scene = $("scene").value;
    canDecide = !scene.startsWith("readonly");
    canApprove = canDecide && scene !== "decide-only";
    rules = scene.includes("empty")
      ? []
      : scene === "decide-only"
        ? [data.lifecycleRule("pending_approval")]
        : data.rules;
    if (actionLabels[scene] || scene.startsWith("action-")) {
      const action = actionLabels[scene] ? scene : "approve";
      rules = [data.lifecycleRule(actionStatuses[action]), data.lifecycleRule("retired", true)];
    }
    renderRules();
    $("modal-form").reset();
    dimension(0);
    if (scene.startsWith("create-")) {
      openCreate($("scene"));
      const index = definitions.findIndex(([code]) => scene === `create-${code}`);
      if (index >= 0) {
        section("dimensions");
        dimension(index);
        ($("dimension-choice").getClientRects().length
          ? $("dimension-choice")
          : $(`pick-${index}`)
        ).focus({ preventScroll: true });
      }
    } else if (scene.startsWith("preview")) openPreview(data.rules[1], $("scene"), scene);
    else if (actionLabels[scene] || scene.startsWith("action-"))
      openAction(rules[0], actionLabels[scene] ? scene : "approve", $("scene"), scene);
  };
  renderRules();
})();
