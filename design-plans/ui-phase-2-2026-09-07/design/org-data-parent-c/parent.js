(() => {
  "use strict";
  const api = window.ORG_DATA_C;
  const $ = (s) => document.querySelector(s);
  const failures = [
    {
      id: "server-error",
      status: 500,
      title: "本次读取暂未完成",
      message: "组织数据暂时未能读取，请稍后重新加载。",
    },
    {
      id: "service-blocked",
      status: 503,
      title: "服务暂时无法响应",
      message: "本轮读取未完成，稍后可以重新加载。",
    },
    {
      id: "version-conflict",
      status: 409,
      title: "数据版本已有变化",
      message: "请重新加载并确认最新内容。",
    },
    {
      id: "rate-limited",
      status: 429,
      title: "请求有些频繁",
      message: "请稍等片刻，再重新加载组织数据。",
    },
    {
      id: "session-expired",
      status: 401,
      title: "需要恢复登录状态",
      message: "当前会话暂时无法读取这些内容。恢复登录后，可以重新加载。",
    },
    {
      id: "permission-forbidden",
      status: 403,
      title: "当前无法查看组织数据",
      message: "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
    },
    {
      id: "network-unavailable",
      status: 0,
      title: "网络连接暂不可用",
      message: "请检查网络连接，恢复后重新加载。",
    },
  ];
  const scenes = [
    { id: "initial-loading", label: "首次读取中", busy: true, replace: true },
    { id: "ready", label: "已读取", busy: false, replace: false },
    { id: "background-refreshing", label: "后台刷新中", busy: true, replace: false },
    ...["initial", "background"].flatMap((phase) =>
      failures.map((failure) => ({
        id: `${phase}-${failure.id}`,
        label: `${phase === "initial" ? "首次" : "后台"} · ${failure.title}`,
        phase,
        failure,
        busy: false,
        replace: phase === "initial" || [401, 403].includes(failure.status),
      })),
    ),
  ];
  let current = scenes[0],
    repaint;
  const intents = [];
  const esc = (v) =>
    String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  function decorate() {
    const main = $(".main"),
      rail = $(".rail"),
      heading = $(".heading");
    if (!main || main.dataset.parentReady) return;
    const active = document.activeElement;
    const selection =
      active?.tagName === "INPUT" ? [active.selectionStart, active.selectionEnd] : null;
    main.dataset.parentReady = current.id;
    main.setAttribute("aria-busy", String(current.busy));
    const view = api.state().view;
    $("#parent-view").value = view;
    const originalView = rail.querySelector(`[data-view="${view}"]`);
    // The existing view click re-renders without resetting either filter/page set.
    repaint = () => originalView.click();
    const navigation = rail.querySelector("nav");
    document.querySelectorAll(".review,.tools,.provenance,.notice").forEach((n) => n.remove());
    rail.innerHTML =
      '<p class="scope-label">组织后台 · 只读观察</p><h2>组织数据</h2><p>数量与生成履历<br>分开核对</p><div class="scope-note">当前范围<strong>当前会话所选组织</strong></div>';
    if (!current.replace) rail.append(navigation);
    heading.innerHTML = `<div><p class="parent-eyebrow">组织数据 / ${view === "exports" ? "导出履历" : "工作区比较"}</p><h1>数据规模与履历</h1><p>核对已返回的事实，不以数量替代质量。</p></div><div class="parent-action"><span class="read-status">${current.busy ? (current.replace ? "等待读取结果" : "正在刷新，保留上次结果") : current.replace ? "本轮尚未完成读取" : current.failure ? "本轮未更新数据" : "已读取当前组织数据"}</span><button id="parent-refresh" class="primary" ${current.busy ? "disabled" : ""}>${current.busy && !current.replace ? "正在刷新…" : "刷新数据"}</button></div>`;
    const retained = document.createElement("div");
    retained.className = "retained-content";
    for (const n of [...main.children]) if (n !== heading) retained.append(n);
    if (!current.replace) main.append(retained);
    const region = document.createElement("section");
    region.className = `parent-region ${current.replace ? "replacement" : "inline-state"}`;
    const failure = current.failure;
    if (current.replace && current.busy) {
      region.setAttribute("role", "status");
      region.innerHTML =
        '<div class="state-symbol" aria-hidden="true">…</div><p class="state-kicker">正在读取</p><h2>正在读取组织数据</h2><p class="state-copy">数据返回前，暂不展示工作区、导出记录或统计数量。</p><div class="loading-lines" aria-hidden="true"><i></i><i></i><i></i></div>';
    } else if (failure) {
      region.setAttribute("role", "alert");
      region.innerHTML = `<div class="state-symbol" aria-hidden="true">i</div><div class="state-message"><p class="state-kicker">${current.replace ? "读取提示" : "刷新未完成 · 保留上次结果"}</p><h2>${esc(failure.title)}</h2><p class="state-copy">${esc(failure.message)}</p><p class="data-boundary">${current.replace ? "当前未展示工作区或导出内容，不代表记录为空。" : "下方仍是上次返回的内容与观测时间，筛选和分页仍可使用。"}</p><details class="trace"><summary>读取追踪 · 示例</summary><code>p35-${esc(failure.id)}-data</code><p>审核样例编号，不是真实请求记录。</p></details>${current.replace ? '<button id="parent-retry" class="primary">重新加载</button>' : ""}</div>`;
    } else if (current.busy) {
      region.setAttribute("role", "status");
      region.innerHTML =
        "<p><strong>正在读取，当前仍展示上次返回的内容。</strong><br>筛选和分页保持可用；读取成功后更新事实。</p>";
    } else region.hidden = true;
    heading.after(region);
    const read = () => {
      intents.push(
        { method: "GET", path: "/org/admin/summary" },
        { method: "GET", path: "/org/admin/data" },
      );
      $("#intent-log").textContent = "已记录两项读取意图，未发送请求；请用审核工具切换后续结果。";
      current = scenes.find(
        (s) => s.id === (current.replace ? "initial-loading" : "background-refreshing"),
      );
      repaint();
      decorate();
      $("#parent-picker").value = current.id;
    };
    $("#parent-refresh").onclick = read;
    if ($("#parent-retry")) $("#parent-retry").onclick = read;
    if (active && main.contains(active)) {
      active.focus({ preventScroll: true });
      if (selection) active.setSelectionRange(...selection);
    }
  }
  function show(id, view = "workspaces") {
    current = scenes.find((s) => s.id === id);
    if (!current || !["workspaces", "exports"].includes(view))
      throw Error("Unknown review scene/view");
    api.scene(view === "workspaces" ? "normal" : "exports");
    decorate();
    $("#parent-picker").value = id;
    $("#parent-view").value = view;
  }
  new MutationObserver(decorate).observe($("#app"), { childList: true });
  for (const scene of scenes) $("#parent-picker").add(new Option(scene.label, scene.id));
  $("#parent-picker").onchange = (e) => show(e.target.value, $("#parent-view").value);
  $("#parent-view").onchange = (e) => show($("#parent-picker").value, e.target.value);
  window.P35_PARENT_C = {
    scenes,
    failures,
    show,
    state: () => ({ scene: current.id, child: api.state(), intents: structuredClone(intents) }),
  };
  show("initial-loading");
})();
