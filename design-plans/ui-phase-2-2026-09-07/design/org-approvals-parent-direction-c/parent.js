(() => {
  const api = window.ORG_APPROVALS_C;
  const $ = (selector) => document.querySelector(selector);
  const failures = [
    {
      id: "server-error",
      status: 500,
      kind: "error",
      title: "组织后台暂不可用",
      message: "本次读取未完成，请稍后重新加载。",
    },
    {
      id: "service-blocked",
      status: 503,
      kind: "blocked",
      title: "组织数据暂不可用",
      message: "当前读取暂未恢复，请稍后重新加载。",
    },
    {
      id: "version-conflict",
      status: 409,
      kind: "conflict",
      title: "数据版本已变化",
      message: "数据已被其他操作更新，请先刷新并确认最新内容。",
    },
    {
      id: "rate-limited",
      status: 429,
      kind: "rate_limited",
      title: "请求过于频繁",
      message: "本轮读取未成功，请稍后重新加载。",
    },
    {
      id: "session-expired",
      status: 401,
      kind: "expired",
      title: "登录已失效",
      message: "当前会话无法完成读取，恢复登录状态后可重新加载。",
    },
    {
      id: "permission-forbidden",
      status: 403,
      kind: "forbidden",
      title: "无权管理当前组织",
      message: "当前请求被拒绝，权限恢复后可重新加载。",
    },
    {
      id: "network-unavailable",
      status: 0,
      kind: "blocked",
      title: "网络连接暂不可用",
      message: "请检查网络后重试；系统已完成安全的读取重试。",
    },
  ];
  const scenes = [
    { id: "initial-loading", label: "首次加载", busy: true, replace: true },
    { id: "ready", label: "读取成功", busy: false, replace: false },
    { id: "background-refreshing", label: "后台刷新中", busy: true, replace: false },
    ...["initial", "background"].flatMap((phase) =>
      failures.map((failure) => ({
        id: phase + "-" + failure.id,
        label: (phase === "initial" ? "首次失败" : "刷新失败") + " · " + failure.title,
        phase,
        failure,
        busy: false,
        replace: phase === "initial" || [401, 403].includes(failure.status),
      })),
    ),
  ];
  let current = scenes[0];
  const intents = [];
  const app = $("#app");
  const escape = (v) =>
    String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  function decorate() {
    if (app.dataset.decorating === "true" || app.querySelector("[data-parent-ready]")) return;
    app.dataset.decorating = "true";
    const main = $(".main"),
      rail = $(".rail"),
      heading = $(".heading");
    if (!main || !rail || !heading) {
      delete app.dataset.decorating;
      return;
    }
    main.dataset.parentReady = current.id;
    main.setAttribute("aria-busy", String(current.busy));
    app
      .querySelectorAll(".review,.review-tools,.provenance,.links,.notice")
      .forEach((n) => n.remove());
    rail.innerHTML =
      '<p class="scope-label">组织后台 / 只读观察</p><h2>审批治理</h2><p>核对流转与版本，<br>不在此作业务决定。</p><div class="scope-note">当前范围<strong>当前会话所选组织</strong><span>业务处理仍在工作区进行</span></div>';
    heading.innerHTML =
      '<div><p class="parent-eyebrow">组织管理 · 审批模板</p><h1>审批模板</h1><p>跨工作区核对审批进度和模板版本。</p></div><div class="parent-action"><span class="read-status">' +
      (current.busy
        ? current.replace
          ? "等待本次读取"
          : "正在刷新当前组织数据…"
        : current.phase === "background"
          ? "本次读取未更新数据"
          : current.replace
            ? "尚未完成本次读取"
            : "已读取当前组织数据") +
      '</span><button type="button" id="parent-refresh" class="primary" ' +
      (current.busy ? "disabled" : "") +
      ">" +
      (current.busy && !current.replace ? "正在刷新…" : "刷新数据") +
      "</button></div>";
    const content = document.createElement("div");
    content.className = "retained-content";
    for (const n of [...main.children]) if (n !== heading) content.append(n);
    if (!current.replace) main.append(content);
    const region = document.createElement("section");
    region.className = "parent-region " + (current.replace ? "replacement" : "inline-state");
    region.dataset.scene = current.id;
    const failure = current.failure;
    if (current.replace && current.busy) {
      region.setAttribute("role", "status");
      region.innerHTML =
        '<div class="state-symbol" aria-hidden="true">…</div><p class="state-kicker">正在读取</p><h2>正在读取当前组织数据…</h2><p class="state-copy">数据返回前，暂不展示审批记录、模板或统计数量。</p><div class="loading-lines" aria-hidden="true"><i></i><i></i><i></i></div>';
    } else if (failure) {
      region.setAttribute("role", "alert");
      region.innerHTML =
        '<div class="state-symbol" aria-hidden="true">!</div><div class="state-message"><p class="state-kicker">' +
        (current.replace ? "本次读取未完成" : "刷新未完成 · 保留上次结果") +
        "</p><h2>" +
        escape(failure.title) +
        '</h2><p class="state-copy">' +
        escape(failure.message) +
        '</p><p class="data-boundary">' +
        (current.replace
          ? "当前不展示审批内容。这不表示没有审批记录或模板。"
          : "下方仍是上次返回的内容；本轮未更新模板或摘要，筛选仍可使用。") +
        '</p><details class="trace"><summary>读取追踪 · 示例</summary><code>p34-' +
        escape(failure.id) +
        "-approvals</code><p>审核夹具编号，不是真实用户数据。</p></details>" +
        (current.replace
          ? '<button type="button" class="primary" id="parent-retry">重新加载</button>'
          : "") +
        "</div>";
    } else if (current.busy) {
      region.setAttribute("role", "status");
      region.innerHTML =
        "<p><strong>正在读取，当前仍展示上次返回的内容。</strong><br>模板筛选保持可用；读取成功后更新内容。</p>";
    } else {
      region.hidden = true;
    }
    heading.after(region);
    const read = () => {
      intents.push(
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/approvals" },
      );
      $("#intent-log").textContent = "仅记录两项读取意图，未发送请求。请用审核工具选择后续结果。";
      current = scenes.find(
        (s) => s.id === (current.replace ? "initial-loading" : "background-refreshing"),
      );
      refreshDecoration();
    };
    $("#parent-refresh").onclick = read;
    if ($("#parent-retry")) $("#parent-retry").onclick = read;
    delete app.dataset.decorating;
  }
  function refreshDecoration() {
    // Reuse child renderer and its existing filter values; re-decoration never resets business filters.
    // A harmless existing sort change re-renders the offline child with the same sort.
    const sort = $("#template-sort");
    if (sort) sort.dispatchEvent(new Event("change", { bubbles: true }));
    else api.scene("templates");
    decorate();
  }
  function show(id) {
    const scene = scenes.find((s) => s.id === id);
    if (!scene) throw Error("Unknown parent scene");
    current = scene;
    api.scene("templates");
    if (!api.state().filtersOpen) $("#filters-toggle")?.click();
    decorate();
    $("#parent-picker").value = id;
  }
  new MutationObserver(decorate).observe(app, { childList: true, subtree: true });
  for (const scene of scenes) $("#parent-picker").add(new Option(scene.label, scene.id));
  $("#parent-picker").onchange = (event) => show(event.target.value);
  window.P34_PARENT_C = {
    scenes,
    failures,
    show,
    state: () => ({ scene: current.id, intents: [...intents], child: api.state() }),
  };
  show("initial-loading");
})();
