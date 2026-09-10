(() => {
  // Presentation only. Keep original controller, facts, intent and busy boundaries intact.
  const root = document.querySelector("#workspace");
  document.querySelector("#restore-demo-open").onclick = () => {
    window.WORKSPACE_CONTROLS_C.prepare("restore");
    window.WORKSPACES_C.setMode("hold");
    document.querySelector("#state-action").focus();
    document.querySelector("#state-action").click();
  };
  document.querySelector("#restore-demo-fail").onclick = () => window.WORKSPACES_C.complete("failure");
  const update = () => {
    const state = window.WORKSPACES_C.state();
    document.querySelector("#restore-demo-fail").disabled = state.busy !== "action";
    if (state.busy !== "action" || document.querySelector("#restore-pending")) return;
    const selected = state.items.find((row) => row.id === state.selectedId);
    if (selected?.status !== "archived") return;
    const notice = document.createElement("p");
    notice.id = "restore-pending";
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.textContent = "正在恢复工作区…状态尚未确认，请等待结果。";
    root.querySelector(".page-head").after(notice);
  };
  new MutationObserver(update).observe(root, { childList: true });
  window.WORKSPACE_CONTROLS_C.prepare("restore");
})();
