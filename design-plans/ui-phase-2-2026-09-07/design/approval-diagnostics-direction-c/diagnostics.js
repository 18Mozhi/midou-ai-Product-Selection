(() => {
  "use strict";
  const samples = {
    conflict: { notice: "刷新审批详情后再判断。", requestId: "ui2-an-conflict" },
    unexpected: { notice: "稍后重试。", requestId: "" },
  };
  function show(kind) {
    if (!Object.hasOwn(samples, kind)) throw new Error("Unknown diagnostic scene");
    // A settled error after closing detail: no POST, no simulated success or cancellation.
    window.APPROVAL_C.scene("normal");
    const sample = samples[kind],
      section = document.createElement("section");
    section.id = "request-diagnostic";
    section.className = "request-diagnostic";
    section.setAttribute("aria-label", "页级操作提示");
    section.setAttribute("aria-live", "polite");
    section.innerHTML = `<p class="diagnostic-label">页级操作提示 · 离线待审</p>
      <p class="diagnostic-message"></p>
      ${
        sample.requestId
          ? `<details id="request-technical"><summary id="request-summary">技术详情</summary>
      <dl><dt>页面保存的请求编号</dt><dd><code></code></dd></dl>
      <p class="diagnostic-boundary">用于排查请求，不是审批编号。当前页面共用此值，其他请求可能覆盖它；不代表某个弹窗的独立请求归属。</p>
      </details>`
          : ""
      }`;
    section.querySelector(".diagnostic-message").textContent = sample.notice;
    if (sample.requestId) section.querySelector("code").textContent = sample.requestId;
    document.querySelector(".page-heading").after(section);
  }
  document.querySelector("#review-conflict").addEventListener("click", () => show("conflict"));
  document.querySelector("#review-unexpected").addEventListener("click", () => show("unexpected"));
  window.APPROVAL_DIAGNOSTICS_C = { show, samples: JSON.parse(JSON.stringify(samples)) };
  show("conflict");
})();
