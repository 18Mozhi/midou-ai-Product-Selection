(() => {
  "use strict";
  const base = window.DETAIL_ASSEMBLY_C;
  const $ = (s) => document.querySelector(s);
  const dialogScenes = ["observe-dialog", "reject-dialog", "approve-dialog", "ai-reject-dialog"];
  const longReason = "核对说明：只记录人工观察，不替代来源事实、利润和风险判断。"
    .repeat(40)
    .slice(0, 1000);
  const scenes = [
    ...Object.keys(base.scenes),
    ...dialogScenes.flatMap((scene) =>
      ["disabled", "busy", "error", "unknown", "long", "long-error"].map(
        (variant) => `${scene}--${variant}`,
      ),
    ),
    "feedback-long",
    "feedback-busy",
    "feedback-invalid",
    "technical-open",
  ];
  function show(name) {
    if (!scenes.includes(name)) throw new Error("Unknown adaptive review scene");
    const [scene, variant] = name.split("--");
    base.scene(
      scene.startsWith("feedback-") && !base.scenes[scene]
        ? "feedback-draft"
        : scene === "technical-open"
          ? "ai"
          : scene,
    );
    if (variant === "disabled") {
      $("#reason").value = "";
      $("#reason").dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (variant?.startsWith("long")) {
      $("#reason").value = longReason;
      $("#reason").dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (["busy", "error", "unknown", "long-error"].includes(variant)) {
      base.hold(true);
      base.outcome(variant === "unknown" ? "unknown" : "error");
      $("#submit-reason").click();
      if (variant !== "busy") base.finish();
    }
    if (scene === "feedback-long") {
      for (const [selector, value] of [
        ["#f-source_ref", "来源编号-".repeat(60).slice(0, 255)],
        ["#f-notes", longReason],
      ]) {
        $(selector).value = value;
        $(selector).dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    if (scene === "feedback-busy") {
      base.hold(true);
      $("#submit-feedback").click();
    }
    if (scene === "feedback-invalid") {
      $("#f-returned_units").value = "1";
      $("#f-returned_units").dispatchEvent(new Event("input", { bubbles: true }));
      $("#feedback-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    if (scene === "technical-open") $(".technical").open = true;
    $("#scene").value = name;
    syncBusy();
  }
  function syncBusy() {
    const state = base.state();
    const busy = state.busy;
    $("#finish-preview").disabled = !busy || state.intents.length === 0;
    $("#finish-preview").title =
      busy && state.intents.length === 0
        ? "此场景为静态示意，请选择带实际本地挂起操作的 busy 场景。"
        : "仅完成本地挂起演示，不代表真实服务返回。";
    for (const selector of ["#work", "#reason-form"]) {
      const node = $(selector);
      if (node.getAttribute("aria-busy") !== String(busy))
        node.setAttribute("aria-busy", String(busy));
    }
    const submit = $("#submit-reason");
    const label = busy ? "演示处理中…" : "演示提交";
    if (submit.textContent !== label) submit.textContent = label;
  }
  $("#scene").innerHTML = scenes
    .map((scene) => `<option value="${scene}">${base.scenes[scene] || scene}</option>`)
    .join("");
  $("#scene").onchange = (event) => show(event.target.value);
  $("#theme").onchange = (event) => {
    document.documentElement.dataset.theme = event.target.value;
  };
  $("#density").onchange = (event) => {
    document.documentElement.dataset.density = event.target.value;
  };
  $("#finish-preview").onclick = () => {
    base.finish();
    syncBusy();
  };
  const observer = new MutationObserver(syncBusy);
  observer.observe($("#operation"), { childList: true, subtree: true, characterData: true });
  window.DETAIL_ADAPTIVE_REVIEW = { scenes, show, dialogScenes, longReason };
  $("#scene").value = base.state().tab;
  syncBusy();
})();
