(() => {
  "use strict";
  const original = window.APPROVAL_C,
    data = window.APPROVAL_C_DATA;
  const states = ["default", "hover", "focus", "pressed", "busy"];
  const controls = [
    {
      id: "approve",
      actionId: "AN-A-DECIDE-APPROVE",
      label: "批准并流转",
      selector: "#approve",
      scene: "decision",
      kind: "detail",
      message: "#decision-message",
      busyLabel: "正在批准…",
      states: [...states.slice(0, 4), "disabled", "busy"],
    },
    {
      id: "reject",
      actionId: "AN-A-DECIDE-REJECT",
      label: "驳回",
      selector: "#reject",
      scene: "decision",
      kind: "detail",
      message: "#decision-message",
      busyLabel: "正在驳回…",
      states: [...states.slice(0, 4), "disabled", "busy"],
    },
    {
      id: "template",
      actionId: "AN-A-TEMPLATE-SUBMIT",
      label: "保存模板草稿",
      selector: "#form-submit",
      scene: "template",
      kind: "template",
      message: "#form-message",
      busyLabel: "正在保存草稿…",
      states,
    },
    {
      id: "publish",
      actionId: "AN-A-PUBLISH-SUBMIT",
      label: "发布模板",
      selector: "#publish-confirm",
      scene: "publish",
      kind: "publish",
      message: "#publish-message",
      busyLabel: "正在发布…",
      states,
    },
    {
      id: "request",
      actionId: "AN-A-REQUEST-SUBMIT",
      label: "发起审批",
      selector: "#form-submit",
      scene: "request",
      kind: "request",
      message: "#form-message",
      busyLabel: "正在发起…",
      states,
    },
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let pending = null,
    restore = [],
    lastFailure = null;
  function change(id, value) {
    const element = document.getElementById(id);
    element.value = value;
    element.dispatchEvent(
      new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
    );
  }
  function prepare(id, state = "default") {
    const control = controls.find((item) => item.id === id);
    if (!control || ![...control.states, "error"].includes(state))
      throw Error("Unknown control/state");
    pending = null;
    restore = [];
    lastFailure = null;
    original.scene(control.scene);
    if (control.kind === "detail")
      change("decision-reason", state === "disabled" ? "" : " 核验后记录判断 ");
    if (control.kind === "template") {
      for (const [field, element] of Object.entries({
        name: "template-name",
        resource_type: "resource-type",
        node_name: "node-name",
        sla_minutes: "sla",
        approver_id: "approver",
        escalation_assignee_id: "escalation",
      }))
        change(element, data.forms.template[field]);
    }
    if (control.kind === "publish") change("publish-reason", " 核验后发布 ");
    // Request scene already uses the original source-derived request fixture.
    document.getElementById("control-picker").value = id;
    const target = document.querySelector(control.selector);
    target.scrollIntoView({ block: "center" });
    return { ...control, requestedState: state };
  }
  function startPending(control, request) {
    if (pending) return;
    const button = document.querySelector(control.selector),
      dialog = button.closest("dialog");
    pending = {
      id: control.id,
      actionId: control.actionId,
      kind: control.kind,
      request: clone(request),
    };
    lastFailure = null;
    original.setMode(control.kind, "busy");
    const targets = dialog.querySelectorAll(
      "input,textarea,select,button[type=submit],#approve,#reject",
    );
    restore = [...targets].map((element) => ({
      element,
      disabled: element.disabled,
      readOnly: element.readOnly,
      busy: element.getAttribute("aria-busy"),
      text: element.tagName === "BUTTON" ? element.textContent : null,
    }));
    for (const { element } of restore) {
      if (element.matches("input,textarea")) element.readOnly = true;
      else element.disabled = true;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = control.busyLabel;
    const message = document.querySelector(control.message);
    message.className = "notice";
    message.dataset.operation = "pending";
    message.textContent = `正在等待“${control.label}”结果（离线模拟）。已固定本次请求内容；关闭窗口不等于取消请求。`;
    const simulate = document.createElement("button");
    simulate.type = "button";
    simulate.className = "review-failure";
    simulate.textContent = "模拟返回失败（审稿工具）";
    simulate.onclick = finishFailure;
    message.append(simulate);
  }
  function finishFailure() {
    if (!pending) return false;
    const control = controls.find((item) => item.id === pending.id);
    lastFailure = clone(pending);
    pending = null;
    original.setMode(control.kind, "error");
    for (const { element, disabled, readOnly, busy, text } of restore) {
      if (!element.isConnected) continue;
      element.disabled = disabled;
      if (typeof readOnly === "boolean") element.readOnly = readOnly;
      if (busy === null) element.removeAttribute("aria-busy");
      else element.setAttribute("aria-busy", busy);
      if (text !== null) element.textContent = text;
    }
    restore = [];
    const message = document.querySelector(control.message);
    if (message?.isConnected) {
      message.className = "notice error";
      message.dataset.operation = "failure";
      message.textContent = `“${control.label}”未获成功确认（离线失败演示）。输入已保留，请核对最新事实后重试；没有改变审批记录。`;
    }
    return true;
  }
  // Existing handlers build the source-aligned intent first; only then enter pending presentation.
  function observeIntent(event) {
    const node = event.target;
    const control = controls.find((item) => {
      if (event.type === "click") return item.kind === "detail" && node.closest?.(item.selector);
      return (
        item.kind !== "detail" &&
        node.matches?.("form") &&
        node.contains(document.querySelector(item.selector)) &&
        (item.kind === "publish" || original.state().formKind === item.kind)
      );
    });
    if (!control || pending) return;
    const state = original.state(),
      request = state.intents.at(-1);
    if (!request || state.modes[control.kind] === "busy") return;
    // Only the event that appended an intent may start a new pending operation.
    if (state.intents.length === lastObservedCount) return;
    lastObservedCount = state.intents.length;
    startPending(control, request);
  }
  let lastObservedCount = 0;
  document.addEventListener("click", observeIntent);
  document.addEventListener("submit", observeIntent);
  const picker = document.getElementById("control-picker");
  picker.innerHTML = controls
    .map((item) => `<option value="${item.id}">${item.label}</option>`)
    .join("");
  function choose() {
    lastObservedCount = 0;
    prepare(picker.value);
  }
  document.getElementById("open-control").onclick = choose;
  document.getElementById("simulate-failure").onclick = finishFailure;
  document.getElementById("scene-picker").addEventListener("change", () => {
    pending = null;
    restore = [];
    lastFailure = null;
    lastObservedCount = 0;
  });
  window.APPROVAL_CONTROL_C = {
    controls,
    prepare: (id, state) => {
      lastObservedCount = 0;
      return prepare(id, state);
    },
    finishFailure,
    state: () => ({ pending: clone(pending), lastFailure: clone(lastFailure) }),
  };
})();
