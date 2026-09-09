(() => {
  const D = window.COVERAGE_DATA,
    L = window.COVERAGE_LABELS,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "—").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const app = document.querySelector("#app"),
    modal = document.querySelector("#modal"),
    sections = { summary: "报告与分布", operations: "接口证据", sources: "角色与声明" };
  let S,
    sequence = 0;
  const button = (id, label, extra = "") =>
    `<button type="button" id="${id}" ${extra}>${label}</button>`;
  const tag = (status, label) =>
    `<span class="pill ${esc(status)}">${esc(label || L.evidenceStatusName(status))}</span>`;
  const dl = (pairs) =>
    `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  const time = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "无可用时间");
  function reset() {
    if (modal.open) modal.close();
    modal.innerHTML = "";
    document.body.className = "";
    S = {
      dataset: "current",
      data: clone(D.datasets.current),
      section: "summary",
      query: "",
      status: "",
      applied: { query: "", status: "" },
      pending: null,
      error: "",
      initial: "",
      selected: D.datasets.current.operations[0].operation_id,
      expanded: [],
      reads: [],
    };
  }
  function pool() {
    return S.dataset === "limit" ? D.limitPool : D.datasets[S.dataset].operations;
  }
  function filterRows(q, status) {
    q = q.trim().toLocaleLowerCase();
    return pool().filter(
      (o) =>
        (!status || o.outcome === status) &&
        `${o.operation_id} ${o.method} ${o.path} ${o.required_capability ?? ""} ${o.data_source} ${o.ui_consumers.join(" ")} ${o.crawler_side_effect}`
          .toLocaleLowerCase()
          .includes(q),
    );
  }
  function applySnapshot(target) {
    const rows = filterRows(target.query, target.status);
    S.data = clone(D.datasets[S.dataset]);
    S.data.operations = clone(rows.slice(0, 300));
    S.data.total_filtered = rows.length;
    S.applied = clone(target);
    S.selected =
      S.data.operations.find((o) => o.operation_id === S.selected)?.operation_id ||
      S.data.operations[0]?.operation_id ||
      null;
    S.expanded = [];
  }
  function read() {
    const id = ++sequence;
    S.pending = { id, target: { query: S.query.trim(), status: S.status } };
    S.reads.push({
      path: "/platform/management",
      query: {
        domain: "api_coverage",
        ...(S.query.trim() ? { query: S.query.trim() } : {}),
        ...(S.status ? { status: S.status } : {}),
      },
    });
    S.error = "";
    render();
    return id;
  }
  function complete(outcome = "success", id = S.pending?.id) {
    if (!S.pending || S.pending.id !== id) return false;
    const p = S.pending;
    S.pending = null;
    if (outcome === "success") {
      applySnapshot(p.target);
      S.initial = "";
    } else
      S.error = S.initial
        ? "读取未完成，尚无成功快照。请恢复会话、权限或依赖后重试。"
        : "读取未完成。以下为上次成功快照，当前草稿尚未应用。";
    render();
    return true;
  }
  function filterForm(prefix = "") {
    return `<form id="${prefix}filter" class="filter-form"><label for="${prefix}query">搜索接口、能力、来源或UI<input id="${prefix}query" maxlength="120" value="${esc(S.query)}" placeholder="不搜索测试编号或最近结果" /></label><label for="${prefix}status">验收结果<select id="${prefix}status">${["", "success", "empty", "blocked", "unauthorized", "not_run"].map((v) => `<option value="${v}" ${v === S.status ? "selected" : ""}>${v ? L.outcomeName(v) : "全部状态"}</option>`).join("")}</select></label><button id="${prefix}apply" type="submit" ${S.pending ? "disabled" : ""}>筛选</button>${button(`${prefix}reset`, "重置", S.pending ? "disabled" : "")}</form>`;
  }
  function bindFilters(root, prefix = "") {
    const q = root.querySelector(`#${prefix}query`),
      s = root.querySelector(`#${prefix}status`);
    if (!q) return;
    q.oninput = (e) => (S.query = e.target.value);
    s.onchange = (e) => (S.status = e.target.value);
    root.querySelector(`#${prefix}filter`).onsubmit = (e) => {
      e.preventDefault();
      if (modal.open) closeFilter();
      read();
    };
    root.querySelector(`#${prefix}reset`).onclick = () => {
      S.query = "";
      S.status = "";
      if (modal.open) closeFilter();
      read();
    };
  }
  function reportBanner() {
    const d = S.data;
    return `<section class="report-banner"><h2>${{ current: "报告可与当前接口目录关联", missing: "尚无可关联报告", invalid: "报告无法解析", outdated: "报告与目录不匹配" }[d.report_status] || "报告状态未知"}</h2><p>${d.report_status === "current" ? "只确认目录与报告能关联；未校验构建SHA一致，也不表示五个证据维度全部通过。" : "继续展示当前接口目录。缺失、无效或旧报告不计入当前探测与证据覆盖。"}</p><div class="report-meta"><span>生成于 ${time(d.captured_at)}</span><span>报告年龄 ${d.age_seconds ?? "—"} 秒（非失效阈值）</span><span>目录指纹 ${esc(d.catalog_fingerprint.slice(0, 12))}</span></div></section>`;
  }
  function summary() {
    const d = S.data,
      s = d.summary;
    return `<section class="workspace"><h2>全目录口径</h2><p class="muted">不随接口筛选改变；目录声明与运行报告分开。</p><div class="facts"><div><small>OpenAPI路径 / 操作</small><strong>${s.paths} / ${s.operations}</strong></div><div><small>有探测结果的操作（含拒绝和受阻）</small><strong>${s.verified} / ${s.operations}</strong><small>${Number(s.coverage_percent).toFixed(2)}%，不是成功率</small></div><div><small>通过的适用证据项</small><strong>${s.evidence_passed} / ${s.evidence_applicable}</strong><small>${Number(s.evidence_coverage_percent).toFixed(2)}%</small></div><div><small>已声明UI消费</small><strong>${s.ui_consumed}</strong></div><div><small>声明存在采集副作用</small><strong>${s.crawler_side_effects}</strong></div><div><small>当前匹配 / 本次返回</small><strong>${d.total_filtered} / ${d.operations.length}</strong><small>接口明细最多返回300项</small></div></div><div class="summary-split"><section><h3>结果分布</h3><ul class="result-list">${d.by_outcome.map((r) => `<li><span>${tag(r.key, L.outcomeName(r.key))}</span><b>${r.count} 项</b></li>`).join("")}</ul></section><section><h3>五维证据</h3><div class="dimension-summary">${d.evidence_dimensions.map((r) => `<article><header><strong>${L.dimensionName(r.key)}</strong><span>${r.passed} / ${r.applicable} 通过</span></header><small>失败 ${r.failed} · 未执行 ${r.not_run} · 不适用 ${r.not_applicable}</small></article>`).join("")}</div></section></div><p class="notice warn">“有探测结果”按outcome不等于not_run计数。401/403、受阻记录可被计入，不能解释为所有接口正常可用。</p></section>`;
  }
  function operationDetail() {
    const o = S.data.operations.find((r) => r.operation_id === S.selected);
    if (!o)
      return `<section class="operation-detail"><h3>没有匹配接口</h3><p>调整关键词或结果筛选。全目录统计保持不变。</p></section>`;
    return `<section class="operation-detail" id="operation-detail" tabindex="-1" aria-label="所选接口完整证据"><h3>${esc(o.method)} ${esc(o.path)}</h3><p class="operation-id small">${esc(o.operation_id)}</p>${dl(
      [
        ["运行结果", L.outcomeName(o.outcome)],
        ["HTTP响应", o.http_status ?? "未记录"],
        ["记录角色", o.verification_role || "未记录"],
        ["预期允许角色", o.expected_roles.join("、") || "公开"],
        ["所需能力", o.required_capability || "无能力声明"],
        ["数据来源", L.sourceName(o.data_source)],
        ["UI消费方", o.ui_consumers.join("、") || "尚无声明"],
        ["爬虫副作用", L.sourceName(o.crawler_side_effect)],
      ],
    )}<h3>五维证据逐项阅读</h3><p class="small">展开可查看测试编号与最近结果；无需悬停。</p>${D.dimensions
      .map((k) => {
        const e = o.evidence[k];
        return `<details class="evidence-item" data-dimension="${k}" ${S.expanded.includes(k) ? "open" : ""}><summary><strong>${L.dimensionName(k)}</strong>${tag(e.status)}</summary>${dl(
          [
            ["是否适用", e.applicable ? "适用" : "不适用"],
            ["测试编号", e.test_id || "尚无测试ID"],
            ["最近结果", e.latest_result || "尚无最近结果"],
          ],
        )}</details>`;
      })
      .join("")}<details class="technical"><summary>请求追踪（响应摘要）</summary>${dl([
      ["请求编号", o.request_id || "未记录"],
      ["追踪编号", o.trace_id || "未记录"],
    ])}<p class="small">不展示请求体、Cookie、Token或报告文件路径。</p></details></section>`;
  }
  function operations() {
    const d = S.data;
    return `<section class="workspace"><div class="section-head"><div><h2>接口明细</h2><p class="muted">按稳定操作身份选择，再阅读同一条记录的完整证据。</p></div><span class="small">匹配 ${d.total_filtered} 项 / 返回 ${d.operations.length} 项</span></div>${d.total_filtered > d.operations.length ? '<p class="notice warn">本次最多返回300项；没有下一页或更多接口。请缩小筛选范围后重新读取。</p>' : ""}<div class="operation-workspace"><nav class="operation-index" aria-label="本次返回的全部接口">${d.operations.length ? d.operations.map((o) => `<button type="button" data-operation="${esc(o.operation_id)}" ${o.operation_id === S.selected ? 'aria-current="true"' : ""}><strong>${esc(o.method)} ${esc(o.path)}</strong><small>${esc(L.outcomeName(o.outcome))} · ${esc(o.operation_id)}</small></button>`).join("") : '<p class="empty">没有匹配接口。筛选不搜索测试编号或最近结果。</p>'}</nav>${operationDetail()}</div></section>`;
  }
  function sources() {
    const d = S.data;
    return `<section class="workspace"><h2>角色记录与静态声明</h2><p class="notice warn">expected_allowed由角色目录推导，不是本次授权测试；verified按记录角色关联计数，可能包含not_run，不能用它代替全目录探测数。</p><h3>角色记录</h3><div class="role-grid">${d.by_role
      .map(
        (r) =>
          `<article><h3>${esc(r.key)}</h3>${dl([
            ["预期允许操作", r.expected_allowed],
            ["关联记录数", r.verified],
            ["成功 / 空结果", `${r.success} / ${r.empty}`],
            ["受阻 / 越权拒绝", `${r.blocked} / ${r.unauthorized}`],
          ])}</article>`,
      )
      .join("")}</div>${[
      ["数据来源", d.by_data_source],
      ["UI消费方", d.by_ui_consumer],
      ["爬虫副作用", d.by_crawler_side_effect],
    ]
      .map(
        ([title, rows]) =>
          `<section class="declaration-group"><h3>${title}</h3><dl>${rows.map((r) => `<dt>${esc(r.key === "unmapped" ? "尚无声明" : r.key)}</dt><dd>${r.count}</dd>`).join("")}</dl></section>`,
      )
      .join(
        "",
      )}<p class="small">声明来自metadata最长前缀匹配，不是实时来源、权限或采集探测。UI消费方为多值计数，不要求相加等于操作总数。</p></section>`;
  }
  function render() {
    const focusId = document.activeElement?.id;
    const focusSection = document.activeElement?.dataset?.section;
    document.querySelector("#sections").innerHTML = Object.entries(sections)
      .map(
        ([k, v]) =>
          `<button type="button" data-section="${k}" ${k === S.section ? 'aria-current="page"' : ""}>${v}</button>`,
      )
      .join("");
    app.innerHTML = `<div class="read-bar"><p class="small">GET /platform/management · domain=api_coverage</p><div class="actions">${button("refresh", S.pending ? "读取中…" : "刷新证据", S.pending ? "disabled" : "")}</div></div>${S.dataset === "original" ? '<p class="notice warn">原始E2E夹具：223路径/256操作、仅1条明细和1角色，部分分组计数不一致；不是当前完整目录或生产证据。</p>' : S.dataset === "long" || S.dataset === "limit" ? '<p class="notice warn">本场景包含额外合成目录/长字段，只验证展示边界，不代表已注册接口。</p>' : '<p class="draft-note">当前仓库目录＋合成执行报告；未进行真实接口探测。</p>'}
    ${S.initial ? `<section class="workspace empty"><h2>${{ loading: "正在读取证据", forbidden: "读取权限被拒绝", expired: "会话已过期", rate_limited: "读取暂时受限", blocked: "证据读取依赖受阻", error: "读取未完成" }[S.initial]}</h2><p>尚无成功数据，不展示旧报告或示例覆盖率。</p>${button("retry", "重新加载", S.pending ? "disabled" : "")}</section>` : reportBanner()}
    ${S.error ? `<p class="notice error" role="status">${esc(S.error)}</p>` : ""}${S.pending ? `<p class="notice" role="status">${S.initial ? "正在读取，尚无成功快照。" : "正在读取目标筛选；已显示的报告和分组仍属于上次成功快照。"}</p>` : ""}
    <div class="desktop">${filterForm()}</div><div class="mobile">${button("mobile-filter", "筛选接口覆盖证据", 'aria-haspopup="dialog"')}</div><p class="scope-label">已应用：${esc(S.applied.query || "无关键词")} / ${esc(S.applied.status ? L.outcomeName(S.applied.status) : "全部状态")}；输入草稿不改变当前记录归属。</p>
    ${S.initial ? "" : S.section === "summary" ? summary() : S.section === "operations" ? operations() : sources()}
    <details class="technical"><summary>报告关联范围与未验证项</summary>${dl([
      ["目录完整指纹", S.initial ? "尚未读取" : S.data.catalog_fingerprint],
      ["观察时点", S.initial ? "尚未读取" : time(S.data.observed_at)],
      ["关联规则", "schema3 / method_path_v1 / 路径与操作数 / 目录指纹"],
      ["未由current证明", "构建SHA一致、元数据或权限未变化、五维全部通过、真实生产可用"],
    ])}<p>本页没有启动验证、下载报告或修改业务的按钮。报告年龄不是自动失效阈值。查询/status不写入本页URL。</p></details>
    ${S.pending ? `<div class="simulation"><p>审核工具：模拟本次读取结果</p><div class="actions">${button("resolve", "模拟读取成功")}${button("reject", "模拟读取失败")}</div></div>` : ""}`;
    document.querySelectorAll("[data-section]").forEach(
      (n) =>
        (n.onclick = () => {
          S.section = n.dataset.section;
          render();
        }),
    );
    document.querySelector("#refresh").onclick = read;
    if (document.querySelector("#retry")) document.querySelector("#retry").onclick = read;
    bindFilters(app);
    document.querySelector("#mobile-filter").onclick = openFilter;
    app.querySelectorAll("[data-operation]").forEach(
      (n) =>
        (n.onclick = () => {
          const top = app.querySelector(".operation-index").scrollTop;
          S.selected = n.dataset.operation;
          S.expanded = [];
          render();
          app.querySelector(".operation-index").scrollTop = top;
          document.querySelector("#operation-detail").focus({ preventScroll: true });
          if (innerWidth <= 760)
            document.querySelector("#operation-detail").scrollIntoView({ block: "start" });
        }),
    );
    app.querySelectorAll("[data-dimension]").forEach(
      (n) =>
        (n.ontoggle = () => {
          if (!n.isConnected) return;
          S.expanded = n.open
            ? [...new Set([...S.expanded, n.dataset.dimension])]
            : S.expanded.filter((v) => v !== n.dataset.dimension);
        }),
    );
    if (S.pending) {
      document.querySelector("#resolve").onclick = () => complete();
      document.querySelector("#reject").onclick = () => complete("error");
    }
    const focusTarget = focusSection
      ? document.querySelector(`[data-section="${focusSection}"]`)
      : focusId && document.getElementById(focusId);
    if (focusTarget && !focusTarget.disabled) focusTarget.focus({ preventScroll: true });
    else if (focusId && app.contains(document.getElementById(focusId)))
      document
        .querySelector(innerWidth <= 760 ? "#mobile-filter" : "#query")
        .focus({ preventScroll: true });
  }
  function openFilter() {
    modal.innerHTML = `<header><h2 id="modal-title">筛选接口覆盖证据</h2>${button("close", "关闭")}</header><p id="modal-desc" class="muted">筛选已有报告，不重新运行验证。关闭保留草稿，只有筛选或重置才读取。</p>${filterForm("m-")}`;
    bindFilters(modal, "m-");
    modal.querySelector("#close").onclick = closeFilter;
    modal.showModal();
    modal.querySelector("#close").focus();
  }
  function closeFilter() {
    modal.close();
    modal.innerHTML = "";
    render();
    const target = document.querySelector("#mobile-filter");
    if (innerWidth <= 760) target.focus();
    else document.querySelector("#query").focus();
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeFilter();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...modal.querySelectorAll("button:not(:disabled),input,select")],
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
  modal.addEventListener("click", (e) => {
    const r = modal.getBoundingClientRect();
    if (
      e.target === modal &&
      (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    )
      closeFilter();
  });
  const scenes = {
    default: "当前目录与部分合成证据",
    operations: "接口选择与完整证据",
    sources: "六角色与三类声明",
    missing: "报告缺失",
    invalid: "报告JSON无效",
    outdated: "报告与目录不匹配",
    original: "历史E2E夹具原样说明",
    "different-build": "报告可关联不代表构建SHA一致",
    "wrong-operation-id": "单操作ID不符，回退未执行",
    "wrong-applicability": "维度适用性不符，回退未执行",
    loading: "首次加载",
    forbidden: "首次403权限拒绝",
    expired: "首次401会话过期",
    rate_limited: "首次429限流",
    blocked: "首次依赖受阻",
    error: "首次读取失败",
    "filter-open": "筛选抽屉",
    "filter-draft": "输入草稿未应用",
    "filter-pending": "筛选在途保留旧快照",
    "filter-error": "读取失败不误改报告归属",
    "no-match": "零匹配但保留全目录统计",
    "search-test-id": "测试编号不属于搜索范围",
    "search-latest-result": "最近结果不属于搜索范围",
    "query-max": "120字符关键词边界",
    "catalog-last": "目录最后一条可达",
    "limit-300": "301合成操作仅返回300条",
    long: "长路径、操作ID和证据文本",
    dark: "深色代表场景",
    contrast: "高对比代表场景",
    compact: "紧凑目录代表场景",
    hover: "刷新悬停",
    pressed: "刷新按下",
    focus: "键盘焦点",
  };
  for (const status of ["success", "empty", "blocked", "unauthorized", "not_run"])
    scenes[`result-${status}`] = `结果筛选：${L.outcomeName(status)}`;
  for (const dimension of D.dimensions)
    scenes[`evidence-${dimension}`] = `展开${L.dimensionName(dimension)}`;
  scenes["not-applicable"] = "公开接口不适用维度";
  scenes["unauthenticated-record"] = "未登录受阻记录（无独立筛选选项）";
  function scene(key) {
    reset();
    if (
      [
        "missing",
        "invalid",
        "outdated",
        "original",
        "different-build",
        "wrong-operation-id",
        "wrong-applicability",
        "long",
      ].includes(key)
    ) {
      S.dataset = key;
      S.data = clone(D.datasets[key]);
      S.selected = S.data.operations[0]?.operation_id;
    }
    if (["loading", "forbidden", "expired", "rate_limited", "blocked", "error"].includes(key))
      S.initial = key;
    if (["operations", "sources"].includes(key)) S.section = key;
    if (["dark", "contrast", "compact"].includes(key)) document.body.className = key;
    if (
      key.startsWith("filter-") ||
      key.startsWith("search-") ||
      key === "no-match" ||
      key.startsWith("result-") ||
      key === "query-max"
    ) {
      S.section = "operations";
      S.query =
        key === "no-match"
          ? "no-such-operation"
          : key === "search-test-id"
            ? "synthetic-only-normal-0"
            : key === "search-latest-result"
              ? "示例回执"
              : key === "query-max"
                ? "x".repeat(120)
                : "/health";
      if (key.startsWith("result-")) {
        S.query = "";
        S.status = key.slice(7);
      }
      if (!["filter-open", "filter-draft", "query-max"].includes(key)) {
        read();
        if (key !== "filter-pending") complete(key === "filter-error" ? "error" : "success");
      }
    }
    if (key === "catalog-last") {
      S.section = "operations";
      S.selected = S.data.operations.at(-1).operation_id;
    }
    if (key === "limit-300") {
      S.dataset = "limit";
      S.data = clone(D.datasets.limit);
      S.section = "operations";
      S.selected = S.data.operations[0].operation_id;
    }
    if (key === "long") {
      S.section = "operations";
      S.selected = D.longId;
      S.expanded = ["normal"];
    }
    if (
      key.startsWith("evidence-") ||
      key === "not-applicable" ||
      key === "unauthenticated-record"
    ) {
      S.section = "operations";
      S.selected = key === "not-applicable" ? D.chosenIds[0] : D.chosenIds[4];
      S.expanded = key.startsWith("evidence-")
        ? [key.slice(9)]
        : key === "not-applicable"
          ? ["authorization", "idempotency"]
          : [];
    }
    render();
    if (key === "filter-open") openFilter();
    if (key === "focus") document.querySelector("#refresh").focus();
    if (key === "catalog-last")
      document.querySelector("[data-operation][aria-current]").scrollIntoView({ block: "nearest" });
    document.querySelector("#scene").value = key;
    scrollTo(0, 0);
  }
  document.querySelector("#scene").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.querySelector("#scene").onchange = (e) => scene(e.target.value);
  window.COVERAGE_C = { scenes, scene, state: () => clone(S), read, complete };
  scene("default");
})();
