(() => {
  const data = window.SCOUTOPS_DISCOVERY_DESIGN;
  const $ = (id) => document.getElementById(id);
  const dialog = $("discovery");
  const types = {
    task: "任务",
    opportunity: "机会",
    evidence: "证据",
    collection_task: "采集任务",
  };
  const errorKinds = {
    401: "expired",
    403: "forbidden",
    409: "error",
    429: "blocked",
    500: "error",
    503: "blocked",
  };
  const scenes = [
    ["search-idle", "搜索 · 初始"],
    ["search-invalid", "搜索 · 少于两个字符"],
    ...Object.entries(types).map(([key, label]) => [`search-filter-${key}`, `搜索筛选 · ${label}`]),
    ["search-results", "搜索 · 结果"],
    ["search-empty", "搜索 · 无结果"],
    ["search-loading", "搜索 · 读取中"],
    ...Object.keys(errorKinds).map((code) => [`search-${code}`, `搜索 · ${code}`]),
    ["create-ready", "快捷创建 · 两个入口"],
    ["create-one", "快捷创建 · 一个入口"],
    ["create-recent", "快捷创建 · 最近使用"],
    ["create-empty", "快捷创建 · 无入口"],
    ["create-loading", "快捷创建 · 读取中"],
    ...Object.keys(errorKinds).map((code) => [`create-${code}`, `快捷创建 · ${code}`]),
    ["create-organization_admin", "组件能力投影 · 组织管理"],
    ["create-platform_admin", "组件能力投影 · 平台管理"],
    ["create-all_registered", "组件能力投影 · 全部注册入口"],
  ];
  let mode = "search",
    shell = "member",
    state = "idle",
    sequence = 0,
    previousFocus;
  let recent = [],
    actions = [],
    resultItems = [],
    actionPool = data.actions;
  let requestId = "",
    traceId = "",
    hint = "",
    lastRequest = "",
    lastNavigation = "";
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const clearRead = () => {
    sequence++;
    requestId = "";
    traceId = "";
    hint = "";
  };
  function validation(message = "") {
    $("query-error").textContent = message;
    $("query-error").hidden = !message;
    $("query").setAttribute("aria-invalid", String(Boolean(message)));
    if (message) $("query").setAttribute("aria-describedby", "query-error");
    else $("query").removeAttribute("aria-describedby");
  }
  function filterChanged() {
    const type = $("resource-type").value;
    $("status").innerHTML =
      `<option value="">${type ? "全部状态" : "先选对象类型"}</option>` +
      (data.statusOptions[type] || [])
        .map((option) => `<option value="${option.value}">${option.label}</option>`)
        .join("");
    $("status").disabled = !type;
    const supported = ["task", "opportunity"].includes(type);
    $("assignee").disabled = !supported;
    $("assignee").placeholder = supported ? "姓名或账号" : "仅任务和机会可用";
    if (!supported) $("assignee").value = "";
  }
  function render() {
    dialog.setAttribute("aria-label", mode === "search" ? "全局搜索" : "快捷创建");
    $("eyebrow").textContent = mode === "search" ? "GLOBAL SEARCH" : "QUICK CREATE";
    $("title").textContent = mode === "search" ? "搜索当前工作区" : "选择已授权入口";
    $("surface-title").textContent = mode === "search" ? "搜索结果" : "可用入口";
    $("search-form").hidden = mode !== "search";
    $("create-note").hidden = mode !== "create";
    $("projection").hidden =
      !Object.values(data.actionPreviews).includes(actionPool) || mode !== "create";
    $("notifications").hidden = shell !== "member";
    $("footer-note").textContent =
      mode === "search" ? "搜索不跨组织或工作区" : "这里只提供入口，不提前创建业务对象";
    const content = $("content");
    if (state === "idle") {
      content.innerHTML =
        '<div class="empty-intro"><p class="eyebrow">START WITH A QUESTION</p><h4>你要找什么？</h4><p>输入至少 2 个字符，按 Enter 或选择“搜索”。可按对象、状态与负责人缩小范围。</p></div>';
    } else if (state === "ready" && mode === "search") {
      content.innerHTML = resultItems
        .map(
          (item) =>
            `<a class="directory-link" href="${escape(item.route)}"><span class="entry-body"><strong>${escape(item.title)}</strong><span class="result-tags"><span>${escape(types[item.resource_type])}</span><span>${escape(data.statusOptions[item.resource_type]?.find((option) => option.value === item.status)?.label || item.status || "未提供状态")}</span></span><small>${escape(item.subtitle || "无补充说明")}${item.assignee_name ? ` · ${escape(item.assignee_name)}` : ""}</small><small>更新于 ${escape(new Date(item.updated_at).toLocaleString("zh-CN"))}</small></span><span aria-hidden="true">→</span></a>`,
        )
        .join("");
    } else if (state === "ready") {
      content.innerHTML = actions
        .map(
          (item, index) =>
            `<a class="directory-link" href="${escape(item.route)}" data-action="${escape(item.id)}"><span class="entry-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span class="entry-body"><strong>${escape(item.label)}</strong><small>${escape(item.description)}</small></span>${recent.includes(item.id) ? '<span class="recent">最近</span>' : ""}<span aria-hidden="true">→</span></a>`,
        )
        .join("");
    } else {
      const copy = data.stateCopy[state];
      const safe = (value) => /^[A-Za-z0-9._:-]{1,128}$/.test(value);
      content.innerHTML = `<section class="state-panel" data-kind="${state}" role="${state === "loading" ? "status" : "region"}" aria-label="${escape(copy.title)}"><p class="eyebrow">${copy.eyebrow}</p><h4>${copy.title}</h4><p>${escape(hint || copy.description)}</p>${safe(requestId) ? `<p class="technical">请求编号：${escape(requestId)}</p>` : ""}${safe(traceId) ? `<p class="technical">追踪编号：${escape(traceId)}</p>` : ""}${state === "loading" ? "" : '<div class="state-actions"><button id="retry">重新加载</button><button id="state-close">关闭</button></div>'}</section>`;
      $("retry")?.addEventListener("click", () => (mode === "search" ? search() : loadActions()));
      $("state-close")?.addEventListener("click", close);
    }
  }
  function close() {
    clearRead();
    dialog.close();
    previousFocus?.focus();
  }
  function open(nextMode, opener, load = true) {
    clearRead();
    mode = nextMode;
    state = "idle";
    actions = [];
    resultItems = [];
    validation();
    previousFocus = opener || document.activeElement;
    render();
    if (!dialog.open) dialog.showModal();
    if (mode === "search") $("query").focus();
    else {
      $("close").focus();
      if (load) loadActions();
    }
  }
  function read(url, nextState = "ready", delay = 450) {
    clearRead();
    const owned = sequence;
    lastRequest = url;
    state = "loading";
    render();
    setTimeout(() => {
      if (owned !== sequence || !dialog.open) return;
      state = nextState;
      if (state === "ready") {
        resultItems = [data.result];
        actions = [...actionPool].sort(
          (a, b) =>
            (recent.indexOf(a.id) < 0 ? 99 : recent.indexOf(a.id)) -
            (recent.indexOf(b.id) < 0 ? 99 : recent.indexOf(b.id)),
        );
        if (mode === "create" && !actions.length) state = "empty";
      }
      render();
    }, delay);
  }
  function search() {
    const query = $("query").value.trim();
    if (query.length < 2) {
      clearRead();
      state = "idle";
      validation("请输入至少 2 个字符后搜索。");
      render();
      $("query").focus();
      return;
    }
    validation();
    const params = new URLSearchParams({ q: query, limit: "10" });
    if ($("resource-type").value) params.set("resource_type", $("resource-type").value);
    if ($("status").value) params.set("status", $("status").value);
    if (!$("assignee").disabled && $("assignee").value.trim())
      params.set("assignee", $("assignee").value.trim());
    read(`/me/global-search?${params}`);
  }
  function loadActions() {
    read(`/me/quick-actions?shell=${shell}`);
  }
  function showScene(value) {
    if (dialog.open) close();
    shell = value.includes("organization_admin")
      ? "organization_admin"
      : value.includes("platform_admin")
        ? "platform_admin"
        : "member";
    actionPool =
      value === "create-one" ? data.oneAction : data.actionPreviews[value.slice(7)] || data.actions;
    recent = value === "create-recent" ? ["sourcing", "task"] : [];
    $("query").value = "";
    $("resource-type").value = "";
    filterChanged();
    validation();
    open(
      value.startsWith("search") ? "search" : "create",
      mode === "search" ? $("open-search") : $("open-create"),
      false,
    );
    if (value === "search-invalid") {
      $("query").value = "任";
      search();
    } else if (value.startsWith("search-filter-")) {
      $("query").value = "合同查询";
      $("resource-type").value = value.slice(14);
      filterChanged();
      $("status").value = data.statusOptions[$("resource-type").value][0].value;
      if (!$("assignee").disabled) $("assignee").value = "负责人甲";
    } else if (value.endsWith("loading")) {
      state = "loading";
    } else if (value.endsWith("empty")) {
      state = "empty";
    } else if (errorKinds[value.split("-").at(-1)]) {
      state = errorKinds[value.split("-").at(-1)];
      requestId = data.failure.requestId;
      traceId = data.failure.traceId;
      hint = data.failure.hint;
    } else if (value !== "search-idle") {
      state = "ready";
      resultItems = [data.result];
      actions = [...actionPool].sort(
        (a, b) =>
          (recent.indexOf(a.id) < 0 ? 99 : recent.indexOf(a.id)) -
          (recent.indexOf(b.id) < 0 ? 99 : recent.indexOf(b.id)),
      );
    }
    if (mode === "search" && state !== "idle") $("query").value = "合同查询";
    render();
    $("discovery").querySelector(".dialog-scroll").scrollTop = 0;
    $("scene").value = value;
  }
  $("organization").textContent = data.scope.organization_name;
  $("workspace").textContent = data.scope.workspace_name;
  $("scene").innerHTML = scenes
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  $("scene").addEventListener("change", () => showScene($("scene").value));
  $("open-search").addEventListener("click", (event) => open("search", event.currentTarget));
  $("open-create").addEventListener("click", (event) => open("create", event.currentTarget));
  $("reset").addEventListener("click", () => {
    recent = [];
    $("query").value = "";
    $("resource-type").value = "";
    filterChanged();
    $("navigation").textContent = "审核工具：组件记忆已清空。";
  });
  $("resource-type").addEventListener("change", filterChanged);
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    search();
  });
  $("close").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("mousedown", (event) => {
    if (event.target === dialog) {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [...dialog.querySelectorAll("button,a[href],input,select")].filter(
      (node) => !node.disabled && node.getClientRects().length,
    );
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    event.preventDefault(); // Local proposal: record intent, never navigate or write business data.
    if (link.dataset.action)
      recent = [link.dataset.action, ...recent.filter((id) => id !== link.dataset.action)].slice(
        0,
        5,
      );
    lastNavigation = link.getAttribute("href");
    $("navigation").textContent = `审核模拟目标：${lastNavigation}；未执行导航或创建。`;
    if (!(event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey))
      close();
  });
  window.DISCOVERY_DESIGN_DIAGNOSTICS = () => ({
    mode,
    shell,
    state,
    recent: [...recent],
    requestId,
    traceId,
    hint,
    lastRequest,
    lastNavigation,
    sequence,
  });
  // Bounded reviewer/test harness only; not exposed as production UI or network API.
  window.DISCOVERY_DESIGN_REVIEW = {
    scenes: scenes.map(([key]) => key),
    showScene,
    lateRead: (nextState, delay) => read("review-only:late-response", nextState, delay),
  };
})();
