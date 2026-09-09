/* Additive, offline composition. Original cost controller/data and all old proofs stay unchanged. */
(() => {
  const C = window.PROFIT_C,
    D = window.PROFIT_C_DATA;
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "未提供").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const labels = {
    overview: "结论与缺项",
    snapshot: "计算快照",
    inputs: "已生效输入",
    reviews: "成本复核",
    form: "提交成本",
  };
  const originalScenes = [
    "snapshot",
    "components",
    "no-inputs",
    "reviews",
    "approved-edited",
    "approved-failed",
    "rejected-edited",
    "rejected-failed",
    "form",
    "purchase",
    "form-failed",
    "form-busy",
    "reviewers-error",
    "reviewers-empty",
    "queue-busy",
    "queue-failed",
    "readonly",
    "read-error",
  ];
  const scenes = {
    overview: "结论 / 有利润但不能采纳",
    "directory-open": "目录 / 五个核对入口",
    ...Object.fromEntries(originalScenes.map((k) => [k, C.scenes[k]])),
  };
  let active = "overview",
    signature = "";
  const row = (label, value, cls = "") =>
    `<div><dt>${esc(label)}</dt><dd class="${cls}">${esc(value)}</dd></div>`;
  function overview(s) {
    const d = s.detail,
      r = s.analysis.latest_run;
    const pending = s.analysis.cost_input_reviews.filter((item) => item.status === "pending");
    if (s.state !== "ready")
      return `<section class="surface blank"><h3>业务依据暂不可读</h3><p>主详情依赖未成功，不沿用身份栏推断本次读取成功。</p></section>`;
    return `<section class="surface decision-boundary"><p class="meta">系统评估与人工决定分开</p><h3>观察，不代表建议采纳</h3><p>当前推荐结论为 observe；风险未知。样本未提供选择阶段与五项质量门，不能从已计算利润推导全部通过。</p><dl class="context-facts">${row("综合 / 趋势 / 竞争评分", `${d.overall_score} / ${d.trend_score} / ${d.competition_score}`)}${row("证据汇总 / 来源", `${d.evidence_count} 条 / ${d.source_count} 个`)}${row("返回证据明细", `${d.evidence.length} 条（与汇总分开）`)}${row("人工决策", "待判断 / 样本无 opportunity:decide 权限")}</dl><p class="context-note">本页不开放采纳、观察或驳回入口。成本确认权限不等于人工决定权限；这里的“观察”是系统结论，不是一条已保存的人工决定。</p></section>
    <div class="context-evidence"><section class="surface"><h3>已计算的利润快照</h3><p class="context-note">${esc(r?.rule_version_code)} · ${esc(r?.platform)} / ${esc(r?.market)}</p><dl class="context-facts">${row("净利润", `${r?.net_profit ?? "未提供"} ${r?.currency ?? ""}`, "net")}${row("净利率", `${r?.net_margin_percent ?? "未提供"}%`)}${row("含税售价 / 总成本", `${r?.sale_price} / ${r?.total_cost} ${r?.currency}`)}${row("计算时间", r?.calculated_at)}</dl><p class="context-note">读取不可变运行值，不在页面中计算价格、汇率或利润。</p><div class="context-actions"><button data-context-go="snapshot">核对分项依据</button></div></section>
    <section class="surface"><h3>成本记录尚需分开核对</h3><dl class="context-facts">${row("当前生效输入", `${s.analysis.current_inputs.length} 项`)}${row("返回复核记录", `${s.analysis.cost_input_reviews.length} 条`)}${row("待复核提交", pending.length ? pending.map((item) => `${item.amount_value} ${item.currency}`).join(" / ") : "无待复核项")}</dl><p class="context-note">当前输入为空，不抹掉历史运行；待复核提交不能替代生效输入。复核和排队都不等于新利润已生成。</p><div class="context-actions"><button data-context-go="inputs">查看当前输入</button><button data-context-go="reviews">核对待复核记录</button></div></section></div>`;
  }
  function sync() {
    const s = C.state();
    $("#work").hidden = active === "overview";
    $("#work").inert = active === "overview";
    $("#context-overview").hidden = active !== "overview";
    $("#context-overview").inert = active !== "overview";
    $("#show-overview").disabled = s.busy;
    if (active === "overview") $("#show-overview").setAttribute("aria-current", "page");
    else $("#show-overview").removeAttribute("aria-current");
    document.querySelectorAll("#sections [data-section]").forEach((b) => {
      if (active === b.dataset.section) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("#active-label").textContent = labels[active];
    const next = JSON.stringify([s.detail, s.analysis, s.state]);
    if (signature !== next) {
      signature = next;
      $("#context-overview").innerHTML = overview(s);
    }
    const dirty = Object.keys(D.defaults).some(
      (key) => key !== "observed_at" && String(s.form[key]) !== String(D.defaults[key]),
    );
    const notices = [
      s.busy ? "成本操作演示处理中，核对目录暂时锁定。" : "",
      s.error ? `成本工作面反馈：${s.error}` : "",
      dirty ? "成本草稿保留在当前页面；切回提交成本继续核对，尚未成为事实。" : "",
      s.review.id && s.review.reason ? "复核原因保留在当前页面，尚未提交。" : "",
      s.message,
    ];
    $("#context-notice").textContent = notices.filter(Boolean).join(" ");
    $("#context-notice").hidden = !notices.some(Boolean);
  }
  function select(key, focus = true) {
    if (!Object.hasOwn(labels, key)) throw Error("Unknown section");
    if (C.state().busy) return false;
    if (key !== "overview") {
      // A round-trip to the current cost pane keeps its rendered draft/error and disclosure state.
      if (C.state().section !== key) $(`#sections [data-section="${key}"]`).click();
    }
    active = key;
    sync();
    if (innerWidth <= 700) $("#context-directory").open = false;
    if (focus) $("#context-title").focus();
    return true;
  }
  function scene(name) {
    if (!Object.hasOwn(scenes, name)) throw Error("Unknown context scene");
    C.scene(["overview", "directory-open"].includes(name) ? "snapshot" : name);
    active = ["overview", "directory-open"].includes(name) ? "overview" : C.state().section;
    $("#context-scene").value = name;
    $("#context-directory").open = innerWidth > 700 || name === "directory-open";
    sync();
    scrollTo(0, 0);
  }
  $("#context-title").textContent = D.facts.detail.name;
  $("#context-id").textContent = D.facts.detail.id;
  $("#show-overview").onclick = () => select("overview");
  $("#context-overview").onclick = (e) => {
    const b = e.target.closest("[data-context-go]");
    if (b) select(b.dataset.contextGo);
  };
  document.addEventListener(
    "click",
    (e) => {
      const button = e.target.closest("#sections [data-section]");
      if (button && !C.state().busy) {
        active = button.dataset.section;
        // Capture before the original controller replaces the clicked navigation node.
        queueMicrotask(() => {
          sync();
          if (innerWidth <= 700) $("#context-directory").open = false;
        });
      }
    },
    true,
  );
  document.addEventListener("input", sync);
  document.addEventListener("change", sync);
  new MutationObserver(sync).observe($("#work"), { childList: true, subtree: true });
  $("#context-scene").innerHTML = Object.entries(scenes)
    .map(([key, title]) => `<option value="${key}">${esc(title)}</option>`)
    .join("");
  $("#context-scene").onchange = (e) => scene(e.target.value);
  window.DETAIL_COST_CONTEXT_C = { scenes, scene, select, sync, active: () => active };
  scene("overview");
})();
