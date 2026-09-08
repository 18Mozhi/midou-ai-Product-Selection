(() => {
  "use strict";
  const d = window.PROVIDER_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  class ReviewDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [d.reviewClock]));
    }
    static now() {
      return new Date(d.reviewClock).getTime();
    }
  }
  function sourceModel() {
    return window.PROVIDER_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      reactive: (v) => v,
      watch() {},
      nextTick: (cb) => Promise.resolve().then(() => cb?.()),
      onMounted() {},
      onBeforeUnmount() {},
      ApiClientError: class extends Error {},
      Date: ReviewDate,
      window: { setTimeout() {}, clearTimeout() {} },
      document,
      HTMLElement,
      AbortController,
      URL,
      request: () => Promise.reject(new Error("Source network disabled in design prototype")),
    });
  }
  const modes = {
    public_page: "公开页面",
    public_rss: "公开订阅源",
    authenticated_browser: "登录浏览器",
    import: "文件导入",
    manual: "人工录入",
  };
  const statuses = { draft: "草稿", disabled: "未启用", enabled: "已启用" };
  const admissions = {
    all: "全部",
    inactive: "未进入调度",
    blocked: "执行受阻",
    compliant: "合规门禁已满足",
    runtime_gate: "需运行时登录门禁",
    registered: "等待导入或人工录入",
  };
  const terms = { pending: "待复核", approved: "已批准", rejected: "已拒绝" };
  const columns = ["来源", "模式 / 市场", "频率 / 并发", "超时 / 重试", "解析器", "状态", "操作"];
  const scenes = {
    default: "原始25条目录 · 第一页",
    "page-two": "原始25条目录 · 第二页",
    search: "搜索名称/代码/负责人/市场/语言",
    "status-filter": "已启用定义筛选",
    "mode-filter": "接入模式筛选",
    "admission-filter": "执行受阻筛选",
    "sort-updated": "最近更新排序",
    "sort-admission": "执行门禁排序",
    "no-match": "筛选零结果",
    columns: "七列设置",
    compact: "紧凑表格",
    unfrozen: "首可见列不冻结",
    preview: "移动记录详情",
    "preview-tech": "移动技术详情展开",
    loading: "首次读取中",
    empty: "来源目录为空",
    error: "首次读取失败",
    forbidden: "首次读取权限错误",
    expired: "首次读取会话失效",
    blocked: "依赖受阻",
    refreshing: "读取中保留快照",
    "refresh-error": "刷新失败保留快照",
    "refresh-forbidden": "刷新权限错误保留快照",
    "refresh-expired": "刷新会话错误保留快照",
    "save-busy": "保存中",
    "save-conflict": "版本409 · 保留编辑内容",
    "save-error": "依赖失败 · 保留编辑内容",
    "save-success": "保存后重读成功",
    "save-reload-failed": "保存成功但重读失败",
    "save-unknown": "连接中断 · 结果未确认",
    "late-result": "旧保存结束 · 新窗口不被关闭（提案）",
    "edit-to-create": "源对象残留 · 编辑后新建",
    "date-roundtrip": "源UTC切片到本地输入 · 时区差异",
    hover: "创建按钮悬停",
    focus: "创建按钮键盘焦点",
    pressed: "创建按钮按下",
    "review-tool": "非业务审核工具",
  };
  for (const action of ["create", "edit"])
    for (let step = 1; step <= 4; step++)
      scenes[`${action}-${step}`] =
        `${action === "create" ? "创建" : "编辑"} · ${d.fields.find((f) => f.step === step)?.step} / 4`;
  for (const mode of d.modes) scenes[`template-${mode}`] = `技术模板 · ${modes[mode]}`;
  for (const a of d.admissionCases) scenes[`admission-${a.key}`] = `执行口径 · ${a.key}`;
  for (let step = 1; step <= 4; step++) scenes[`errors-${step}`] = `第${step}组即时错误`;
  let m,
    s,
    epoch = 0,
    requestSeq = 0,
    restoreTarget = null;
  const options = (values, selected) =>
    Object.entries(values)
      .map(
        ([v, label]) =>
          `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(label)}</option>`,
      )
      .join("");
  function state() {
    return clone({
      ...s,
      form: m.form,
      editor: m.editorOpen.value,
      step: m.editorStep.value,
      errors: m.formErrors.value,
      filteredIds: m.filteredItems.value.map((r) => r.id),
      visibleIds: m.visibleItems.value.map((r) => r.id),
      controls: {
        search: m.searchQuery.value,
        status: m.statusFilter.value,
        mode: m.accessModeFilter.value,
        admission: m.admissionFilter.value,
        sort: m.sortOrder.value,
        page: m.page.value,
      },
      counts: {
        all: m.items.value.length,
        enabled: m.enabledCount.value,
        blocked: m.blockedCount.value,
        inactive: m.inactiveCount.value,
      },
    });
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene " + key);
    for (const node of document.querySelectorAll("dialog[open]")) node.close();
    epoch++;
    m = sourceModel();
    m.items.value = clone(d.definitions);
    m.state.value = "ready";
    s = {
      key,
      synthetic: false,
      originalSubset: false,
      hidden: [],
      frozen: true,
      density: "standard",
      readBusy: false,
      readError: "",
      feedback: "",
      editorFeedback: "",
      pendingWrite: null,
      pendingRead: null,
      intents: [],
      navigation: [],
      previewId: null,
      pendingUnknown: false,
    };
    if (key === "page-two") m.page.value = 2;
    if (key === "search") m.searchQuery.value = "PUBLIC_SIGNAL";
    if (key === "status-filter") m.statusFilter.value = "enabled";
    if (key === "mode-filter") m.accessModeFilter.value = "public_rss";
    if (key === "admission-filter") m.admissionFilter.value = "blocked";
    if (key === "sort-updated") m.sortOrder.value = "updated_desc";
    if (key === "sort-admission") m.sortOrder.value = "status";
    if (key === "no-match") m.searchQuery.value = "不存在的来源";
    if (key === "compact") s.density = "compact";
    if (key === "unfrozen") s.frozen = false;
    if (["loading", "empty", "error", "forbidden", "expired", "blocked"].includes(key)) {
      m.items.value = [];
      m.state.value = key;
      s.readBusy = key === "loading";
    }
    if (key === "refreshing") s.readBusy = true;
    if (key.startsWith("refresh-"))
      s.readError = {
        "refresh-error": "刷新失败，已保留上次成功数据。",
        "refresh-forbidden": "本次读取无权限，已保留上次成功数据。",
        "refresh-expired": "本次读取会话失效，已保留上次成功数据。",
      }[key];
    if (key.startsWith("admission-") && key !== "admission-filter") {
      const c = d.admissionCases.find((a) => a.key === key.slice(10));
      m.items.value = [clone(c.item)];
      s.synthetic = !["disabled", "pending"].includes(c.key);
      s.originalSubset = !s.synthetic;
    }
    renderPage();
    if (key === "columns") $("#columns").open = true;
    if (["preview", "preview-tech"].includes(key)) {
      openPreview(d.definition.id);
      if (key === "preview-tech") $("#preview-tech").open = true;
    }
    const group = /^(create|edit|errors)-(\d)$/.exec(key);
    if (group) {
      openEditor(group[1] === "edit" ? d.definition : undefined);
      if (group[1] !== "edit" && Number(group[2]) !== 1) Object.assign(m.form, clone(d.validDraft));
      m.editorStep.value = Number(group[2]);
      if (group[1] === "errors") {
        const values = [
          { code: "Invalid", name: "a", target_url: "ftp://example.test", owner_label: "a" },
          {
            markets: "",
            languages: "",
            fields: "",
            dedupe_key: "",
            parser_version: "bad version",
            healthcheck_url: "ftp://example.test",
          },
          {
            schedule_minutes: 0,
            concurrency_limit: 21,
            timeout_ms: 999,
            retry_limit: 11,
            circuit_failure_threshold: 0,
            retention_days: 3651,
            failure_rules: "",
          },
          {
            status: "enabled",
            terms_review_status: "pending",
            terms_reference_url: "",
            terms_version: "",
            terms_expires_at: "",
          },
        ];
        Object.assign(m.form, values[m.editorStep.value - 1]);
      }
      renderEditor();
    }
    if (key.startsWith("template-")) {
      openEditor();
      Object.assign(m.form, clone(d.validDraft), { access_mode: key.slice(9) });
      m.applyTemplate();
      m.editorStep.value = 3;
      s.editorFeedback = m.message.value;
      renderEditor();
    }
    if (
      ["save-busy", "save-conflict", "save-error", "save-unknown", "date-roundtrip"].includes(key)
    ) {
      openEditor(d.definition);
      m.editorStep.value = 4;
      s.editorFeedback =
        {
          "save-conflict": "版本冲突：刷新最新版本后重新提交。当前编辑内容未丢弃，未自动重试。",
          "save-error": "依赖不可用，未保存。编辑内容已保留。",
          "save-unknown": "连接中断，保存结果尚未确认；请先核对最新版本，不要重复提交。",
          "date-roundtrip":
            "源行为：UTC 17:00 被切片为本地 17:00，提交转为 UTC 09:00（Asia/Shanghai）。时区修正规则待确认。",
        }[key] ?? "";
      s.pendingUnknown = key === "save-unknown";
      renderEditor();
      if (key === "save-busy") submit();
    }
    if (key === "save-success")
      s.feedback = "合成来源定义已创建；列表重新读取成功。（离线结果演示，不代表真实写入）";
    if (key === "save-reload-failed") {
      s.feedback =
        "合成来源定义已创建；列表重读失败，当前仍是之前的快照。请刷新核对，不要重复创建。";
      s.readError = "刷新失败，已保留上次成功数据。";
    }
    if (key === "late-result") {
      openEditor(d.definition);
      submit();
      const id = s.pendingWrite.id;
      closeEditor();
      openEditor(d.blockedDefinition);
      completeWrite("success", id);
    }
    if (key === "edit-to-create") {
      openEditor(d.definition);
      closeEditor();
      openEditor();
      Object.assign(m.form, clone(d.validDraft));
      m.editorStep.value = 4;
      s.editorFeedback =
        "源对象保留 id、version、updated_at 等只读属性。这里只展示事实；请求清理需独立确认，不在图稿中暗改。";
      renderEditor();
    }
    if (["save-success", "save-reload-failed"].includes(key)) renderPage();
    $(".review").hidden =
      key !== "review-tool" && new URL(location.href).searchParams.get("review") !== "1";
    $("#scene").value = key;
    if (key === "focus") $("#create").focus({ preventScroll: true });
  }
  const rowCells = (r) => {
    const a = m.admission(r);
    return [
      `<strong>${esc(r.name)}</strong><small>${esc(r.code)} · ${esc(r.owner_label)}</small>`,
      `${modes[r.access_mode] ?? "其他方式"}<small>${esc(r.markets.join(" / "))}<br>${esc(r.languages.join(" / "))}</small>`,
      `${r.schedule_minutes} 分钟 / ${r.concurrency_limit}`,
      `${r.timeout_ms} ms / ${r.retry_limit}`,
      `${esc(r.parser_version)}<small>定义版本 ${r.version}</small>`,
      `<span class="admission" data-state="${a.state}">${esc(a.label)}</span><small>${esc(a.detail)}</small><small>定义：${statuses[r.status]} / 条款：${terms[r.terms_review_status]}</small>`,
      `<button type="button" data-edit="${esc(r.id)}">编辑</button>`,
    ];
  };
  function renderPage() {
    $("#app").innerHTML =
      `<div class="workspace"><aside class="directory"><h2>来源管理</h2><nav aria-label="来源管理视图">${[
        ["/platform-admin/providers", "来源设置（高级）"],
        ["/platform-admin/providers/adapters", "采集程序（高级）"],
        ["/platform-admin/providers/sources", "来源频道"],
        ["/platform-admin/providers/sources/1688-acceptance", "检查启用条件"],
        ["/platform-admin/credentials", "网页登录凭证"],
      ]
        .map(
          ([route, label], i) =>
            `<a href="#" data-route="${route}" ${i === 0 ? 'aria-current="page"' : ""}>${label}</a>`,
        )
        .join(
          "",
        )}</nav><p class="directory-explanation">当前离线身份为平台超级管理员。页面入口与 API 授权分别检查；目录不是组织连接。</p></aside><section class="paper"><header class="page-head"><div><h1>来源设置</h1><p class="muted">维护技术定义，逐项确认执行前置条件。</p></div><button type="button" class="primary" id="create">新建来源</button></header><div id="page-feedback" aria-live="polite"></div><p class="summary-line" id="summary"></p><div class="notice">定义已启用不等于采集已运行或成功。本页不提供烟测、删除或一键解除受阻。</div><div id="list-controls"><div class="filters"><label for="search">搜索<input id="search" type="search" placeholder="名称、代码、负责人、市场" value="${esc(m.searchQuery.value)}" /></label><label for="status-filter">定义状态<select id="status-filter">${options({ all: "全部", ...statuses }, m.statusFilter.value)}</select></label><label for="mode-filter">接入方式<select id="mode-filter">${options({ all: "全部", ...modes }, m.accessModeFilter.value)}</select></label><label for="admission-filter">执行门禁<select id="admission-filter">${options(admissions, m.admissionFilter.value)}</select></label><label class="filter-sort" for="sort">排序<select id="sort">${options({ name_asc: "名称 A–Z", updated_desc: "最近更新", status: "执行门禁" }, m.sortOrder.value)}</select></label><div class="filter-actions"><button type="button" id="reset">重置</button><button type="button" id="refresh">刷新真实数据</button></div></div><div class="table-controls"><details id="columns"><summary>列设置</summary><fieldset><legend>选择显示列</legend>${columns.map((label, i) => `<label class="check"><input type="checkbox" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} />${label}</label>`).join("")}</fieldset></details><button type="button" id="freeze" aria-pressed="${s.frozen}">${s.frozen ? "首列已冻结" : "首列未冻结"}</button><label for="density">表格密度<select id="density">${options({ standard: "标准", compact: "紧凑" }, s.density)}</select></label></div></div><div id="records"></div><p class="footnote" id="data-note"></p></section></div>`;
    $("#create").onclick = (e) => openEditor(undefined, e.currentTarget);
    const bindings = {
      search: "searchQuery",
      "status-filter": "statusFilter",
      "mode-filter": "accessModeFilter",
      "admission-filter": "admissionFilter",
      sort: "sortOrder",
    };
    for (const [id, ref] of Object.entries(bindings))
      $("#" + id).addEventListener(id === "search" ? "input" : "change", (e) => {
        m[ref].value = e.target.value;
        m.page.value = 1;
        renderRecords();
      });
    $("#reset").onclick = reset;
    $("#refresh").onclick = read;
    $("#freeze").onclick = () => {
      s.frozen = !s.frozen;
      $("#freeze").setAttribute("aria-pressed", s.frozen);
      $("#freeze").textContent = s.frozen ? "首列已冻结" : "首列未冻结";
      renderRecords();
    };
    $("#density").onchange = (e) => {
      s.density = e.target.value;
      renderRecords();
    };
    for (const node of document.querySelectorAll("[data-column]"))
      node.onchange = () => {
        const index = Number(node.dataset.column);
        if (node.checked) s.hidden = s.hidden.filter((i) => i !== index);
        else if (s.hidden.length < 6) s.hidden.push(index);
        renderRecords();
      };
    for (const node of document.querySelectorAll("[data-route]"))
      node.onclick = (e) => {
        e.preventDefault();
        s.navigation.push(node.dataset.route);
        s.feedback = `离线导航意图：${node.textContent}。目标 ${node.dataset.route} 的具体稿另行审核；没有发起真实跳转。`;
        renderRecords();
      };
    renderRecords();
  }
  function reset() {
    m.resetFilters();
    m.page.value = 1;
    renderPage();
  }
  function renderRecords() {
    const total = m.items.value.length,
      rows = m.visibleItems.value,
      firstVisible = columns.findIndex((_, i) => !s.hidden.includes(i));
    $("#summary").textContent = total
      ? `全目录 ${total} 条定义 / ${m.enabledCount.value} 已启用 / ${m.blockedCount.value} 公开采集受阻 / ${m.inactiveCount.value} 未进入调度`
      : "尚无可用定义快照";
    $("#page-feedback").innerHTML =
      `${s.feedback ? `<p class="notice">${esc(s.feedback)}</p>` : ""}${s.readError ? `<div class="notice error" role="alert">${esc(s.readError)}<p>旧快照不是本次读取成功或当前访问许可。</p><button type="button" id="retry-snapshot">再次刷新</button></div>` : s.readBusy && total ? '<p class="notice">正在重新读取，暂时保留上次快照。</p>' : ""}`;
    if ($("#retry-snapshot")) $("#retry-snapshot").onclick = read;
    $("#list-controls").hidden = !total;
    $("#refresh").disabled = s.readBusy;
    $("#refresh").textContent = s.readBusy ? "刷新中…" : "刷新真实数据";
    if (!total) {
      const titles = {
        loading: "正在读取来源定义",
        empty: "还没有来源定义",
        error: "来源定义读取失败",
        expired: "登录已失效",
        forbidden: "你没有此项权限",
        blocked: "依赖暂时受阻",
      };
      $("#records").innerHTML =
        `<div class="empty"><h2>${titles[m.state.value] ?? "暂时无法读取"}</h2><p>${m.state.value === "empty" ? "先登记真实目标、字段、频率、并发和失败规则。" : "本页没有可展示的成功快照。读取失败不等于来源被删除。"}</p>${m.state.value === "loading" ? '<div class="skeleton"></div><div class="skeleton"></div>' : `<button type="button" id="state-action">${m.state.value === "empty" ? "登记第一个来源" : "重新读取来源"}</button>`}</div>`;
      if ($("#state-action"))
        $("#state-action").onclick =
          m.state.value === "empty" ? (e) => openEditor(undefined, e.currentTarget) : read;
    } else if (!rows.length) {
      $("#records").innerHTML =
        '<div class="empty"><h2>没有匹配的来源</h2><p>当前筛选没有结果，来源定义未被删除。</p><button id="clear-filters" type="button">清除筛选条件</button></div>';
      $("#clear-filters").onclick = reset;
    } else {
      $("#records").innerHTML =
        `<p class="list-meta" aria-live="polite">共 ${total} 条，当前筛选 ${m.filteredItems.value.length} 条</p><div class="table-scroll ${s.density === "compact" ? "compact" : ""}"><table><thead><tr>${columns.map((label, i) => `<th ${s.hidden.includes(i) ? "hidden" : ""} ${s.frozen && i === firstVisible ? 'class="frozen-cell"' : ""}>${label}</th>`).join("")}</tr></thead><tbody>${rows
          .map(
            (r) =>
              `<tr data-row="${r.id}">${rowCells(r)
                .map(
                  (cell, i) =>
                    `<td ${s.hidden.includes(i) ? "hidden" : ""} ${s.frozen && i === firstVisible ? 'class="frozen-cell"' : ""}>${cell}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")}</tbody></table></div><div class="mobile-records">${rows
          .map((r) => {
            const a = m.admission(r);
            return `<article class="record"><h3>${esc(r.name)}</h3><p class="admission" data-state="${a.state}">${esc(a.label)}</p><p>${esc(a.detail)}</p><small>${modes[r.access_mode]} / ${esc(r.markets.join(" / "))} / 每${r.schedule_minutes}分钟</small><button type="button" data-preview="${r.id}">查看详情</button></article>`;
          })
          .join(
            "",
          )}</div>${m.filteredItems.value.length > 20 ? `<nav class="pagination" aria-label="来源定义分页"><span>第 ${m.page.value} / ${m.pageCount.value} 页 · 每页20条</span><div><button type="button" id="previous" ${m.page.value <= 1 ? "disabled" : ""}>上一页</button><button type="button" id="next-page" ${m.page.value >= m.pageCount.value ? "disabled" : ""}>下一页</button></div></nav>` : ""}`;
      for (const node of document.querySelectorAll("[data-edit]"))
        node.onclick = () =>
          openEditor(
            m.items.value.find((r) => r.id === node.dataset.edit),
            node,
          );
      for (const node of document.querySelectorAll("[data-preview]"))
        node.onclick = () => openPreview(node.dataset.preview, node);
      if ($("#previous"))
        $("#previous").onclick = () => {
          m.page.value--;
          renderRecords();
        };
      if ($("#next-page"))
        $("#next-page").onclick = () => {
          m.page.value++;
          renderRecords();
        };
    }
    for (const node of document.querySelectorAll("[data-column]")) {
      node.checked = !s.hidden.includes(Number(node.dataset.column));
      node.disabled = node.checked && s.hidden.length === 6;
    }
    $("#data-note").textContent =
      `${s.synthetic ? "合成边界变体；不是生产配置。" : s.originalSubset ? "从原始夹具独立取一条展示准入口径；本场景不是完整25条目录。" : !m.items.value.length ? "空目录或读取异常演示；当前没有原始25条成功快照。" : "原始 E2E 25条目录夹具；25/1/1/24是全局口径，不随本地筛选变化。"} 审核时钟2026-09-09，未调用真实API、烟测、凭证或数据库。`;
  }
  function openPreview(id, trigger) {
    const r = m.items.value.find((r) => r.id === id) ?? d.definition;
    s.previewId = r.id;
    restoreTarget = trigger ?? $("#create");
    const a = m.admission(r);
    const facts = {
      接入方式: modes[r.access_mode],
      "市场 / 语言": `${r.markets.join(" / ")} / ${r.languages.join(" / ")}`,
      调度: `每${r.schedule_minutes}分钟，并发${r.concurrency_limit}`,
      "超时 / 重试": `${r.timeout_ms}ms / ${r.retry_limit}次`,
      当前状态: statuses[r.status],
      执行门禁: `${a.label}：${a.detail}`,
      条款复核: terms[r.terms_review_status],
      条款版本: r.terms_version || "未登记",
      条款到期: r.terms_expires_at
        ? new Date(r.terms_expires_at).toLocaleString("zh-CN", { hour12: false })
        : "未登记",
    };
    $("#preview").innerHTML =
      `<div class="form-body"><div class="dialog-top"><h2 id="preview-title">${esc(r.name)}</h2><button type="button" id="preview-close">关闭详情</button></div><dl>${Object.entries(
        facts,
      )
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
        .join(
          "",
        )}</dl><button type="button" id="preview-edit" class="primary">编辑来源</button><details id="preview-tech"><summary>技术详情</summary><dl>${Object.entries(
        {
          "来源 ID": r.id,
          来源代码: r.code,
          目标地址: r.target_url,
          接入模式代码: r.access_mode,
          "解析器 / 定义版本": `${r.parser_version} / ${r.version}`,
        },
      )
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
        .join("")}</dl></details></div>`;
    $("#preview-close").onclick = closePreview;
    $("#preview-edit").onclick = () => {
      const trigger = restoreTarget;
      closePreview();
      openEditor(r, trigger);
    };
    $("#preview").showModal();
    $("#preview-close").focus();
  }
  function closePreview() {
    $("#preview").close();
    s.previewId = null;
    restoreTarget?.focus();
  }
  function openEditor(item, trigger) {
    epoch++;
    restoreTarget = trigger ?? $("#create");
    m.edit(item);
    s.editorFeedback = "";
    s.pendingUnknown = false;
    renderEditor();
    if (!$("#editor").open) $("#editor").showModal();
    $("#field-code").focus();
  }
  function closeEditor() {
    epoch++;
    m.closeEditor();
    $("#editor").close();
    s.editorFeedback = "";
    restoreTarget?.isConnected ? restoreTarget.focus() : $("#create").focus();
  }
  function fieldMarkup(f) {
    const value = m.form[f.key],
      error = m.formErrors.value[f.key],
      inputOptions = { access_mode: modes, terms_review_status: terms, status: statuses }[f.key];
    const attr = `id="field-${f.key}" data-field="${f.key}" aria-describedby="error-${f.key}" aria-invalid="${Boolean(error)}"`;
    let control;
    if (inputOptions) control = `<select ${attr}>${options(inputOptions, value)}</select>`;
    else if (["fields", "failure_rules"].includes(f.key))
      control = `<textarea ${attr}>${esc(value)}</textarea>`;
    else
      control = `<input ${attr} type="${f.key === "terms_expires_at" ? "datetime-local" : f.key === "terms_reference_url" ? "url" : d.bounds[f.key] ? "number" : "text"}" ${d.bounds[f.key] ? `min="${d.bounds[f.key][0]}" max="${d.bounds[f.key][1]}"` : ""} value="${esc(value)}" />`;
    return `<div class="field ${["target_url", "fields", "failure_rules", "healthcheck_url", "terms_reference_url"].includes(f.key) ? "wide" : ""}"><label for="field-${f.key}">${f.label}${control}</label><small id="error-${f.key}" class="field-error">${esc(error ?? "")}</small></div>`;
  }
  function renderEditor() {
    const step = m.editorStep.value;
    $("#editor").innerHTML =
      `<div class="dialog-layout"><aside class="identity"><h2>${m.editing.value ? "编辑来源" : "登记来源"}</h2><p>${esc(m.editing.value?.name ?? "新的技术定义")}</p><p>${m.editing.value ? `当前版本 ${m.editing.value.version}，保存时携带版本锁` : "默认未启用；技术模板不是实际采集结果"}</p><nav class="step-nav" aria-label="来源登记步骤">${m.steps.map((label, i) => `<button type="button" data-step="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ""}>${i + 1} ${label}</button>`).join("")}</nav><p>只修改定义。是否能执行、是否采集成功，需要核对对应运行链。</p></aside><form id="editor-form" class="form-body" novalidate><div class="dialog-top"><h2 id="editor-title">${m.steps[step - 1]}</h2><button type="button" id="editor-close">关闭</button></div><div class="template-bar"><p>当前模板：${modes[m.form.access_mode]}<br>应用会覆盖字段清单及执行策略，请核对真实合同。</p><button type="button" id="apply-template">应用技术模板</button></div><div class="fields">${d.fields
        .filter((f) => f.step === step)
        .map(fieldMarkup)
        .join(
          "",
        )}</div><div id="publish-preview"></div><div id="editor-feedback" class="feedback" aria-live="polite"></div><footer><p id="step-progress" class="step-progress"></p><div class="actions">${step > 1 ? '<button type="button" id="previous-step">上一步</button>' : ""}${step < 4 ? '<button type="button" id="next-step" class="primary">下一步</button>' : '<button type="submit" id="save" class="primary"></button>'}</div></footer><p class="reasonless">无需原因窗。当前模拟不写入来源、不访问目标地址，也不生成采集成功记录。</p></form></div>`;
    $("#editor-close").onclick = closeEditor;
    for (const node of document.querySelectorAll("[data-step]"))
      node.onclick = () => {
        m.editorStep.value = Number(node.dataset.step);
        renderEditor();
        $("#editor").scrollTop = 0;
        $("#editor-close").focus();
      };
    for (const node of document.querySelectorAll("[data-field]"))
      node.addEventListener(node.tagName === "SELECT" ? "change" : "input", () => {
        const key = node.dataset.field;
        m.form[key] = d.bounds[key]
          ? node.value === ""
            ? ""
            : Number(node.value)
          : key === "code"
            ? node.value.trim()
            : node.value;
        updateEditor();
      });
    $("#apply-template").onclick = () => {
      m.applyTemplate();
      s.editorFeedback = m.message.value;
      renderEditor();
      $("#apply-template").focus();
    };
    if ($("#previous-step"))
      $("#previous-step").onclick = () => {
        m.editorStep.value--;
        renderEditor();
        $("#editor").scrollTop = 0;
        $("#editor-close").focus();
      };
    if ($("#next-step"))
      $("#next-step").onclick = () => {
        const stepBefore = m.editorStep.value;
        m.nextStep();
        s.editorFeedback = m.message.value;
        if (m.editorStep.value !== stepBefore) {
          renderEditor();
          $("#editor").scrollTop = 0;
          $("#editor-close").focus();
        } else {
          updateEditor();
          $("[data-field][aria-invalid='true']")?.focus();
        }
      };
    $("#editor-form").onsubmit = (e) => {
      e.preventDefault();
      submit();
    };
    updateEditor();
  }
  function updateEditor() {
    const errs = m.formErrors.value,
      step = m.editorStep.value;
    for (const f of d.fields.filter((f) => f.step === step)) {
      $("#field-" + f.key).setAttribute("aria-invalid", Boolean(errs[f.key]));
      $("#error-" + f.key).textContent = errs[f.key] ?? "";
    }
    $("#step-progress").textContent =
      `第 ${step} / 4 步${m.currentStepErrors.value.length ? `，本组${m.currentStepErrors.value.length}项待修正` : ""}`;
    $("#publish-preview").innerHTML =
      step === 4
        ? `<section class="publish"><h3>发布预览</h3><p>${esc(m.form.name || "未命名来源")} / ${modes[m.form.access_mode]}</p><p>${esc(m.list(m.form.markets).join(" / "))} / ${esc(m.list(m.form.languages).join(" / "))}</p><p>每${esc(m.form.schedule_minutes)}分钟，并发${esc(m.form.concurrency_limit)}，${statuses[m.form.status]}</p><p>定义状态不代表运行成功；公开来源仍需通过实际执行门禁。</p></section>`
        : "";
    $("#editor-feedback").innerHTML = s.editorFeedback
      ? `<div class="notice ${/失败|冲突|中断|缺失/.test(s.editorFeedback) ? "error" : ""}">${esc(s.editorFeedback)}<details><summary>技术详情</summary><code>synthetic-review-request · 仅离线关联号</code></details></div>`
      : "";
    if ($("#save")) {
      $("#save").disabled =
        Boolean(s.pendingWrite) || Object.keys(errs).length > 0 || s.pendingUnknown;
      $("#save").textContent = s.pendingWrite
        ? "保存中…"
        : m.editing.value
          ? "保存新版本"
          : "创建来源";
    }
  }
  function submit() {
    if (s.pendingWrite || s.pendingUnknown) return null;
    if (Object.keys(m.formErrors.value).length) {
      m.editorStep.value = Math.min(
        ...Object.keys(m.formErrors.value).map((key) => m.stepForField[key] ?? 4),
      );
      s.editorFeedback = "还有即时校验未通过，请先修正。";
      renderEditor();
      $("[data-field][aria-invalid='true']")?.focus();
      return null;
    }
    const request = clone(m.buildRequest()),
      id = ++requestSeq;
    s.pendingWrite = { id, epoch, name: m.form.name, editing: Boolean(m.editing.value), request };
    s.intents.push({
      id,
      method: request.method,
      path: "/api/v1" + request.path,
      body: request.body,
    });
    s.editorFeedback = "正在保存定义；当前只是离线请求意图。关闭窗口不代表撤销已提交请求。";
    updateEditor();
    return id;
  }
  function completeWrite(outcome, id = s.pendingWrite?.id) {
    const pending = s.pendingWrite;
    if (!pending || pending.id !== id) return false;
    s.pendingWrite = null;
    if (pending.epoch !== epoch || !m.editorOpen.value) {
      s.feedback = "旧保存结果已到达，仅归属于原窗口；当前编辑内容未覆盖。请读取最新目录核对。";
      renderRecords();
      if (m.editorOpen.value) updateEditor();
      return true;
    }
    if (outcome === "success" || outcome === "reload-failed") {
      closeEditor();
      s.feedback = `${pending.name}已${pending.editing ? "更新" : "创建"}（离线回执）${outcome === "reload-failed" ? "，列表重读失败，仍保留旧快照；请核对，不要重复提交。" : "，列表重读成功；演示返回仍使用原始夹具，不伪造新业务记录。"}`;
      s.intents.push({ id: ++requestSeq, method: "GET", path: "/api/v1/platform/providers" });
      if (outcome === "success") m.page.value = 1;
      else s.readError = "刷新失败，已保留上次成功数据。";
      renderRecords();
    } else {
      s.pendingUnknown = outcome === "unknown";
      s.editorFeedback = {
        conflict: "版本冲突，当前输入保留；请核对最新版本，未自动重试。",
        error: "依赖不可用，未保存；编辑内容已保留。",
        forbidden: "服务端拒绝本次保存，编辑内容保留；未修改权限。",
        unknown: "连接中断，保存结果尚未确认；先核对最新版本，不要重复提交。",
      }[outcome];
      if (!s.editorFeedback) throw new Error("Unknown write result");
      updateEditor();
    }
    return true;
  }
  function read() {
    const id = ++requestSeq;
    s.pendingRead = { id };
    s.readBusy = true;
    s.readError = "";
    if (!m.items.value.length) m.state.value = "loading";
    s.intents.push({ id, method: "GET", path: "/api/v1/platform/providers" });
    renderRecords();
    return id;
  }
  function completeRead(outcome, id = s.pendingRead?.id) {
    if (!s.pendingRead || s.pendingRead.id !== id) return false;
    s.pendingRead = null;
    s.readBusy = false;
    if (["success", "empty"].includes(outcome)) {
      m.items.value = outcome === "empty" ? [] : clone(d.definitions);
      m.state.value = m.items.value.length ? "ready" : "empty";
      m.page.value = 1;
    } else {
      const label = {
        error: "读取失败",
        timeout: "读取超过12秒",
        forbidden: "本次读取无权限",
        expired: "会话已失效",
        blocked: "依赖暂时受阻",
      }[outcome];
      if (!label) throw new Error("Unknown read result");
      if (m.items.value.length) s.readError = label + "，已保留上次成功数据。";
      else
        m.state.value = ["forbidden", "expired", "error"].includes(outcome) ? outcome : "blocked";
    }
    renderRecords();
    return true;
  }
  for (const [selector, close] of [
    ["#editor", closeEditor],
    ["#preview", closePreview],
  ]) {
    $(selector).addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...$(selector).querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href]",
        ),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
    $(selector).addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    $(selector).addEventListener("mousedown", (e) => {
      if (e.target !== $(selector)) return;
      const r = $(selector).getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        close();
    });
  }
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, title]) => `<option value="${key}">${esc(title)}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  window.PROVIDER_C = {
    scenes,
    scene,
    state,
    openEditor,
    openPreview,
    closeEditor,
    submit,
    completeWrite,
    read,
    completeRead,
    buildRequest: () => clone(m.buildRequest()),
    admission: (item) => m.admission(item),
    invalidate: () => {
      epoch++;
    },
  };
  scene("default");
})();
