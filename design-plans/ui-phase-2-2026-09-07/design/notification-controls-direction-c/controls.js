(() => {
  "use strict";
  const base = window.NOTIFICATION_C;
  const controls = [
    {
      id: "start",
      actionId: "AN-N-START",
      scene: "detail",
      selector: "#action-start",
      label: "开始处理",
      busyLabel: "开始处理中…",
    },
    {
      id: "close",
      actionId: "AN-N-CLOSE",
      scene: "detail",
      selector: "#action-close",
      label: "关闭通知",
      busyLabel: "正在关闭…",
    },
    {
      id: "reopen",
      actionId: "AN-N-REOPEN",
      scene: "detail_closed",
      selector: "#action-reopen",
      label: "重新打开",
      busyLabel: "正在重新打开…",
    },
    {
      id: "markAll",
      actionId: "AN-N-ALL-READ",
      scene: "normal",
      selector: "#all-read",
      label: "全部已读",
      busyLabel: "正在标记…",
    },
    {
      id: "preferences",
      actionId: "AN-N-PREF-SAVE",
      scene: "preferences",
      selector: "#preferences-save",
      label: "保存偏好",
      busyLabel: "保存中…",
    },
  ];
  function enhance() {
    const state = base.state(),
      request = state.intents.at(-1);
    if (!state.pending || !request) return;
    const control = controls.find((c) =>
      c.id === "markAll"
        ? request.url === "/notifications/actions"
        : c.id === "preferences"
          ? request.method === "PUT"
          : request.body?.action === c.id,
    );
    if (!control) return; // Automatic read has no user-facing submit button.
    const button = document.querySelector(control.selector);
    if (!button) return;
    button.setAttribute("aria-busy", "true");
    if (button.textContent !== control.busyLabel) button.textContent = control.busyLabel;
  }
  function prepare(id, mode = "intent") {
    const control = controls.find((c) => c.id === id);
    if (!control || !["intent", "busy", "error"].includes(mode))
      throw Error("Unknown control/mode");
    base.scene(control.scene);
    base.setMode(mode);
    document.querySelector("#control-picker").value = id;
    document.querySelector("#mode-picker").value = mode;
    enhance();
  }
  document.querySelector("#control-picker").innerHTML = controls
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  document.querySelector("#prepare-control").onclick = () =>
    prepare(
      document.querySelector("#control-picker").value,
      document.querySelector("#mode-picker").value,
    );
  new MutationObserver(enhance).observe(document.querySelector("#app"), {
    childList: true,
    subtree: true,
  });
  for (const dialog of document.querySelectorAll("dialog"))
    new MutationObserver(enhance).observe(dialog, { childList: true, subtree: true });
  window.NOTIFICATION_CONTROLS_C = { controls, prepare, enhance };
})();
