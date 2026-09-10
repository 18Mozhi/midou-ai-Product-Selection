(() => {
  "use strict";
  const variants = {
    loading: ["正在读取组织令牌", "数据返回后，将显示当前组织的令牌信息。", null],
    error: ["暂时无法读取组织令牌", "这次读取未能完成。可以重新加载，再试一次。", 500],
    forbidden: [
      "当前无法查看组织令牌",
      "当前权限还不能读取这些内容。权限调整后，可以重新加载。",
      403,
    ],
    expired: ["登录状态需要更新", "当前登录已失效。恢复登录后，可以重新加载。", 401],
    conflict: ["需要重新核对令牌数据", "请重新加载当前数据，再确认令牌的最新状态。", 409],
    rate_limited: ["请求稍有些频繁", "请稍后再试。重新加载只读取数据，不会重新提交令牌操作。", 429],
    blocked: ["组织令牌暂时无法读取", "这次未能完成读取，请稍后重新加载。", 503],
  };
  const scenes = Object.keys(variants).flatMap((kind) =>
    ["initial", "background"].map((phase) => ({ id: `${phase}-${kind}`, phase, kind })),
  );
  const backgroundTitles = {
    error: "这次刷新未能完成",
    conflict: "需要重新核对当前数据",
    rate_limited: "刷新请求稍有些频繁",
    blocked: "这次刷新暂未完成",
    loading: "正在刷新组织令牌",
  };
  const intents = [];
  const $ = (s) => document.querySelector(s);
  const escape = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const selector = $("#scene");
  selector.innerHTML = scenes
    .map(
      (s) =>
        `<option value="${s.id}">${s.phase === "initial" ? "首次读取" : "后台刷新"} · ${variants[s.kind][0]}</option>`,
    )
    .join("");
  let current;
  function render(id) {
    current = scenes.find((s) => s.id === id) || scenes[0];
    selector.value = current.id;
    const { phase, kind } = current;
    const pending = kind === "loading";
    const retained = phase === "background" && !["forbidden", "expired"].includes(kind);
    const [baseTitle, baseDescription, status] = variants[kind];
    const title = retained ? backgroundTitles[kind] : baseTitle;
    const description = retained
      ? pending
        ? "下方保留上次返回的内容，读取完成后再更新。"
        : "下方保留的是上次返回的内容，不代表最新结果。可以使用页头的“刷新数据”重试。"
      : baseDescription;
    const boundary = retained
      ? "仍显示上次读取的内容"
      : pending
        ? "读取完成前，不显示令牌信息或占位数量。"
        : "本次不展示令牌列表、创建表单或令牌明文。";
    const trace = pending
      ? ""
      : `<details class="trace"><summary>查看请求追踪</summary><dl class="trace-body"><dt>请求标识</dt><dd><code>p36-local-read-fixture</code></dd><dt>返回说明 · 合成样例</dt><dd>隔离读取样例 ${status} 此为本地验证样例。</dd></dl></details>`;
    const actions =
      !pending && !retained
        ? `<footer class="read-actions"><p>仅重新读取当前组织的数据。</p><button type="button" class="primary" id="retry">重新加载</button></footer>`
        : "";
    const list = retained
      ? `<section class="retained" aria-label="上次读取内容的展示示例"><header><h2>上次读取内容</h2><span>两条样例节选 · 非当前总数</span></header>${window.ORG_TOKEN_C_DATA.tokens
          .slice(0, 2)
          .map(
            (t) =>
              `<article><h3>${escape(t.name)}</h3><p>${escape(t.token_prefix)} · ${escape(t.scopes.join(" / "))}</p></article>`,
          )
          .join(
            "",
          )}<p>此处仅展示旧内容保留方式，不代表完整列表、创建表单或全部控件已获批准。</p></section>`
      : "";
    $("#surface").dataset.scene = current.id;
    $("#surface").innerHTML =
      `<header class="page-heading"><div><p class="eyebrow">组织后台 / 访问管理</p><h1>组织令牌</h1><p>管理当前组织的固定只读访问凭据。</p></div><button type="button" id="refresh" ${pending ? "disabled" : ""}>${phase === "background" && pending ? "正在刷新…" : "刷新数据"}</button></header><section class="read-card" aria-labelledby="state-title" aria-busy="${pending}"><aside class="read-context"><p class="eyebrow">读取状态</p><strong>当前组织</strong><small>${phase === "initial" ? "首次获取内容" : "更新已有内容"}</small></aside><div class="read-body"><h2 id="state-title">${title}</h2><p class="read-description" role="${pending ? "status" : "alert"}">${description}</p><p class="content-boundary">${boundary}</p>${trace}${actions}</div></section>${list}`;
    const record = (control) => {
      intents.push({
        control,
        scene: current.id,
        method: "GET",
        paths: ["/org/admin/summary", "/org/admin/tokens"],
        background: control === "refresh",
      });
      $("#demo-feedback").textContent = "仅记录演示读取意图；没有发送接口请求，也没有生成令牌。";
    };
    $("#refresh").onclick = () => record("refresh");
    if ($("#retry")) $("#retry").onclick = () => record("retry");
    $("#demo-feedback").textContent = "";
  }
  selector.addEventListener("change", () => render(selector.value));
  window.P36_READ_STATES = { scenes, variants, intents, show: render };
  render(new URL(location.href).searchParams.get("scene") || "initial-error");
})();
