(() => {
  "use strict";
  const D = window.RECOVERY_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const symbols = {
    loading: "···",
    empty: "○",
    error: "!",
    forbidden: "⊘",
    expired: "⌛",
    blocked: "Ⅱ",
    recovery: "✓",
    not_found: "404",
  };
  const scenes = Object.fromEntries(D.kinds.map((k) => [k, D.labels[k]]));
  Object.assign(scenes, {
    "first-action": "首次操作提示",
    "filter-action": "筛选提示",
    "retry-action": "重试演示提示",
    "permission-action": "权限申请说明",
    "impact-action": "受阻影响说明",
    "confirm-empty": "确认 / 未签认",
    "confirm-check": "确认 / 仅勾选",
    "confirm-phrase": "确认 / 仅短语",
    "confirm-wrong": "确认 / 错误短语",
    "confirm-ready": "确认 / 可确认",
    confirmed: "确认 / 本地完成",
    "invalid-ids": "标识 / 无效值过滤",
    "long-ids": "标识 / 最长有效值",
    "self-return": "404 / 返回当前展示页",
  });
  let S = {
      kind: "empty",
      message: "",
      confirmed: false,
      navigation: [],
      ids: [D.correlations[0].output, D.correlations[1].output],
    },
    opener = null,
    previousOverflow = "",
    querySignature = "";
  const fromQuery = () => {
    const values = new URL(location.href).searchParams.getAll("state");
    return values.length === 1 && D.kinds.includes(values[0]) ? values[0] : "empty";
  };
  const signature = () => JSON.stringify(new URL(location.href).searchParams.getAll("state"));
  function feedback() {
    $("#action-result").hidden = !S.message;
    $("#action-result").textContent = S.message;
    $("#confirmed").hidden = !S.confirmed;
  }
  function render() {
    const copy = D.copy[S.kind];
    const description =
      S.kind === "error"
        ? "本次操作未完成。请先核对结果，再决定是否重试；此处只做离线演示。"
        : S.kind === "not_found"
          ? "地址可能已变更。可返回最近有效页面，或回到今日行动；不把不存在的路径解释为无权限。"
          : copy.description;
    const primary = S.kind === "not_found" ? "返回最近页面" : copy.primary;
    const secondary =
      S.kind === "not_found"
        ? "返回今日行动"
        : S.kind === "error"
          ? "返回空结果示例"
          : copy.secondary;
    $("#preview").dataset.kind = S.kind;
    $("#preview").setAttribute("aria-busy", String(S.kind === "loading"));
    $("#preview").innerHTML =
      `<div class="preview-heading"><span class="symbol ${S.kind === "error" ? "danger-symbol" : ""}" aria-hidden="true">${symbols[S.kind]}</span><div><p>${esc(D.labels[S.kind])}状态示例</p><h2 id="preview-title" tabindex="-1">${esc(copy.title)}</h2></div></div><p class="state-description">${esc(description)}</p>${S.kind === "loading" ? '<div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div>' : `<div class="state-actions"><button id="primary" class="primary">${esc(primary)}</button>${secondary ? `<button id="secondary">${esc(secondary)}</button>` : ""}</div>`}${S.ids.some(Boolean) ? `<details class="correlations"><summary>关联与链路编号</summary><dl>${S.ids.map((id, i) => (id ? `<div><dt>${i === 0 ? "关联编号" : "链路编号"}</dt><dd>${esc(id)}</dd></div>` : "")).join("")}</dl></details>` : ""}`;
    document
      .querySelectorAll("[data-state]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === S.kind)));
    if (S.kind === "not_found") {
      const recent = document.createElement("details");
      recent.className = "correlations";
      recent.innerHTML =
        '<summary>返回目标（隔离演示）</summary><dl><div><dt>最近有效页面</dt><dd id="demo-recent"></dd></div></dl>';
      recent.querySelector("dd").textContent = S.selfReturn ? "/ui-states?state=blocked" : "/home";
      recent.open = Boolean(S.selfReturn);
      $("#preview").append(recent);
    }
    if ($("#primary")) $("#primary").onclick = () => action("primary");
    if ($("#secondary")) $("#secondary").onclick = () => action("secondary");
    feedback();
  }
  function select(kind) {
    if (!D.kinds.includes(kind)) return;
    const url = new URL(location.href),
      values = url.searchParams.getAll("state");
    S.kind = kind;
    S.message = "";
    if (values.length !== 1 || values[0] !== kind) {
      url.searchParams.set("state", kind);
      history.pushState(null, "", url);
    }
    querySignature = signature();
    render();
  }
  function action(which) {
    const old = S.kind,
      result =
        old === "not_found" && which === "primary" && S.selfReturn
          ? D.selfReturn
          : D.actions[old][which];
    if (!result) return;
    if (result.kind !== old) select(result.kind);
    S.message =
      old === "blocked" && which === "secondary"
        ? "这是受阻影响的演示说明，不代表任何真实请求的执行结果。"
        : result.message;
    for (const nav of result.navigation)
      if (typeof nav === "string") {
        S.navigation.push(nav);
        S.message = "已记录导航目标；离线演示不会进入业务页面。";
      }
    feedback();
    if (result.kind !== old) $("#preview-title").focus();
  }
  function enabled() {
    return $("#ack").checked && $("#phrase").value.trim() === "确认撤销";
  }
  function open() {
    opener = document.activeElement;
    $("#ack").checked = false;
    $("#phrase").value = "";
    $("#confirm").disabled = true;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    $("#confirm-dialog").showModal();
    $("#cancel").focus();
  }
  function close() {
    $("#confirm-dialog").close();
    document.body.style.overflow = previousOverflow;
    if (opener?.isConnected) opener.focus();
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown scene");
    if ($("#confirm-dialog").open) close();
    S = {
      kind: D.kinds.includes(name) ? name : "empty",
      message: "",
      confirmed: name === "confirmed",
      navigation: [],
      selfReturn: name === "self-return",
      ids: [D.correlations[0].output, D.correlations[1].output],
    };
    if (name === "invalid-ids") S.ids = [D.correlations[4].output, D.correlations[5].output];
    if (name === "self-return") S.kind = "not_found";
    if (name === "long-ids") S.ids = [D.correlations[2].output, D.correlations[2].output];
    const actions = {
      "first-action": ["empty", "primary"],
      "filter-action": ["empty", "secondary"],
      "retry-action": ["error", "primary"],
      "permission-action": ["forbidden", "secondary"],
      "impact-action": ["blocked", "secondary"],
    };
    if (actions[name]) S.kind = actions[name][0];
    const url = new URL(location.href);
    url.searchParams.set("state", S.kind);
    history.replaceState(null, "", url);
    querySignature = signature();
    render();
    if (actions[name]) action(actions[name][1]);
    const index = [
      "confirm-empty",
      "confirm-check",
      "confirm-phrase",
      "confirm-wrong",
      "confirm-ready",
    ].indexOf(name);
    if (index >= 0) {
      $("#open-confirm").focus();
      open();
      const c = D.confirmations[index];
      $("#ack").checked = c.acknowledged;
      $("#phrase").value = c.typedText;
      $("#confirm").disabled = !enabled();
    }
    if (name === "long-ids") $(".correlations").open = true;
    $("#scene").value = name;
    window.scrollTo(0, 0);
  }
  $("#states").innerHTML = D.kinds
    .map(
      (k) =>
        `<button data-state="${k}" aria-pressed="false" aria-controls="preview">${D.labels[k]}</button>`,
    )
    .join("");
  document.querySelectorAll("[data-state]").forEach(
    (b) =>
      (b.onclick = () => {
        select(b.dataset.state);
        $("#scene").value = b.dataset.state;
      }),
  );
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  $("#open-confirm").onclick = open;
  $("#cancel").onclick = close;
  $("#ack").onchange = $("#phrase").oninput = () => {
    $("#confirm").disabled = !enabled();
  };
  $("#confirm").onclick = () => {
    if (!enabled()) return;
    S.confirmed = true;
    close();
    feedback();
  };
  $("#confirm-dialog").oncancel = (e) => {
    e.preventDefault();
    close();
  };
  $("#confirm-dialog").onmousedown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.target === e.currentTarget &&
      (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    ) {
      e.preventDefault();
      close();
    }
  };
  $("#confirm-dialog").onkeydown = (e) => {
    if (e.key !== "Tab") return;
    const items = [...e.currentTarget.querySelectorAll("input,button:not(:disabled)")];
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  $("#brand").onclick = (e) => {
    e.preventDefault();
    S.navigation.push("/home");
    S.message = "已记录品牌返回今日行动；未进入业务页。";
    feedback();
  };
  addEventListener("popstate", () => {
    if (signature() === querySignature) return;
    querySignature = signature();
    S.kind = fromQuery();
    S.message = "";
    $("#scene").value = S.kind;
    render();
  });
  window.RECOVERY_C = { scenes, scene, state: () => clone(S) };
  S.kind = fromQuery();
  querySignature = signature();
  $("#scene").value = S.kind;
  render();
})();
