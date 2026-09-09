(() => {
  "use strict";
  const base = window.APPROVAL_C,
    data = window.APPROVAL_C_DATA;
  const controls = [
    {
      id: "approve",
      kind: "detail",
      scene: "decision",
      selector: "#approve",
      label: "批准并流转",
      close: "#detail-close",
      message: "#decision-message",
    },
    {
      id: "reject",
      kind: "detail",
      scene: "decision",
      selector: "#reject",
      label: "驳回",
      close: "#detail-close",
      message: "#decision-message",
    },
    {
      id: "template",
      kind: "template",
      scene: "template",
      selector: "#form-submit",
      label: "保存草稿",
      close: "#form-close",
      message: "#form-message",
    },
    {
      id: "request",
      kind: "request",
      scene: "request",
      selector: "#form-submit",
      label: "发起审批",
      close: "#form-close",
      message: "#form-message",
    },
    {
      id: "publish",
      kind: "publish",
      scene: "publish",
      selector: "#publish-confirm",
      label: "确认发布",
      close: "#publish-close",
      message: "#publish-message",
    },
  ];
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let pending = null,
    lastResult = null,
    observed = 0,
    serial = 0;
  const saved = new Map();
  const modes = (value) => {
    for (const kind of ["detail", "template", "request", "publish"]) base.setMode(kind, value);
  };
  const owns = (op) =>
    op?.dialog.open && op.anchor.isConnected && op.dialog.firstElementChild === op.anchor;
  const publicOperation = (op) =>
    op
      ? {
          token: op.token,
          control: op.control.id,
          label: op.control.label,
          request: clone(op.request),
          title: op.title,
          status: op.status,
          ownerStillOpen: !!owns(op),
        }
      : null;
  function restore() {
    for (const [node, value] of saved) {
      if (!node.isConnected) continue;
      node.disabled = value.disabled;
      if ("readOnly" in node) node.readOnly = value.readOnly;
      if (node.tagName === "BUTTON") node.textContent = value.text;
      if (value.busy === null) node.removeAttribute("aria-busy");
      else node.setAttribute("aria-busy", value.busy);
      if (node.matches("#approve,#reject"))
        node.disabled = !document.querySelector("#decision-reason")?.value.trim();
    }
    saved.clear();
  }
  function remember(node) {
    if (!saved.has(node))
      saved.set(node, {
        disabled: node.disabled,
        readOnly: node.readOnly,
        text: node.textContent,
        busy: node.getAttribute("aria-busy"),
      });
  }
  function tools(host) {
    let panel = host.querySelector(":scope > .response-tools");
    if (!pending) {
      panel?.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "response-tools";
      panel.setAttribute("aria-label", "模拟响应审稿工具");
      host.append(panel);
    }
    if (panel.dataset.token === String(pending.token)) return;
    panel.dataset.token = String(pending.token);
    panel.innerHTML =
      "<p></p><button type='button' data-result='success'>模拟成功返回</button><button type='button' data-result='failure'>模拟失败返回</button>";
    panel.querySelector("p").textContent =
      `审稿工具：返回第 ${pending.token} 次“${pending.control.label}”预览，不是真实服务响应。`;
    const token = pending.token;
    for (const button of panel.querySelectorAll("button"))
      button.onclick = () => {
        const dialog = button.closest("dialog");
        settle(token, button.dataset.result);
        // The removed response tool is not a product control; return keyboard focus locally.
        if (dialog?.open && document.activeElement === document.body)
          dialog
            .querySelector("textarea:not(:disabled),input:not(:disabled),button:not(:disabled)")
            ?.focus();
      };
  }
  function renderReceipt() {
    const host = document.querySelector("#operation-ledger"),
      op = pending || lastResult;
    if (!op) {
      if (host.childElementCount) host.replaceChildren();
      return;
    }
    const key = `${op.token}:${op.status}`;
    if (host.dataset.receipt !== key) {
      host.dataset.receipt = key;
      host.innerHTML =
        '<section class="operation-receipt"><strong></strong><p></p><small></small></section>';
      const receipt = host.firstElementChild;
      receipt.dataset.status = op.status;
      receipt.querySelector("strong").textContent =
        `${op.control.label} · ${op.status === "pending" ? "等待响应（离线模拟）" : op.status === "success" ? "模拟成功已返回" : "模拟失败已返回"}`;
      receipt.querySelector("p").textContent = op.title;
      receipt.querySelector("small").textContent =
        op.status === "pending"
          ? "关闭只收起窗口，不撤销本次操作；响应返回前不重复提交。"
          : "结果属于原提交窗口；不关闭或改写后来打开的窗口。离线图稿没有改变业务事实，实际结果仍需读取服务确认。";
    }
    tools(host.firstElementChild);
  }
  function sync() {
    modes(pending ? "busy" : "intent");
    for (const dialog of document.querySelectorAll("dialog")) {
      if (!dialog.open) {
        dialog.querySelector(":scope > .response-tools")?.remove();
        continue;
      }
      let waiting = dialog.querySelector(".other-operation");
      if (pending && !(owns(pending) && dialog === pending.dialog)) {
        if (!waiting) {
          waiting = document.createElement("p");
          waiting.className = "notice other-operation";
          waiting.setAttribute("role", "status");
          dialog.querySelector("#decision-message,#form-message,#publish-message").before(waiting);
        }
        const text = `前一次“${pending.control.label} · ${pending.title}”仍在等待结果。当前草稿可以编辑；等待结束后再提交，不会自动发送。`;
        if (waiting.textContent !== text) waiting.textContent = text;
      } else waiting?.remove();
      if (pending) {
        for (const button of dialog.querySelectorAll("button[type=submit],#approve,#reject")) {
          remember(button);
          button.disabled = true;
          if (owns(pending) && button.matches(pending.control.selector)) {
            button.setAttribute("aria-busy", "true");
            button.textContent = "等待结果…";
          }
        }
        if (owns(pending) && dialog === pending.dialog) {
          for (const field of dialog.querySelectorAll("input,textarea,select")) {
            remember(field);
            if (field.tagName === "SELECT") field.disabled = true;
            else field.readOnly = true;
          }
          const message = dialog.querySelector(pending.control.message);
          const text = "正在等待本次提交结果（离线模拟）。内容已固定；可收起窗口，关闭不等于取消。";
          if (message.textContent !== text) message.textContent = text;
        }
      }
      tools(dialog);
    }
    for (const node of document.querySelectorAll(
      "#scene-picker,#operation-picker,#prepare-operation",
    ))
      node.disabled = !!pending;
    renderReceipt();
  }
  function settle(token, outcome) {
    if (!pending || pending.token !== token || !["success", "failure"].includes(outcome))
      return false;
    const op = pending,
      sameWindow = owns(op);
    pending = null;
    op.status = outcome;
    lastResult = op;
    restore();
    modes("intent");
    if (sameWindow) {
      if (outcome === "success") op.dialog.querySelector(op.control.close)?.click();
      else {
        const message = op.dialog.querySelector(op.control.message);
        message.className = "notice error";
        message.textContent =
          "本次提交模拟失败，输入已保留。请核对最新事实后再提交；未产生业务变更。";
      }
    }
    sync();
    return true;
  }
  function observe(event) {
    if (pending) return;
    const state = base.state(),
      latest = state.intents.at(-1);
    if (!latest || state.intents.length <= observed) return;
    const control = controls.find((c) =>
      event.type === "click"
        ? c.kind === "detail" && event.target.closest?.(c.selector)
        : c.kind !== "detail" &&
          event.target.matches?.("form") &&
          event.target.querySelector(c.selector) &&
          (c.kind === "publish" || state.formKind === c.kind),
    );
    if (!control) return;
    observed = state.intents.length;
    const dialog = document.querySelector(control.selector).closest("dialog");
    pending = {
      token: ++serial,
      control,
      request: clone(latest),
      status: "pending",
      dialog,
      anchor: dialog.firstElementChild,
      title:
        control.kind === "detail"
          ? state.currentDetail.title
          : control.kind === "publish"
            ? state.publishTarget.name
            : control.kind === "template"
              ? latest.body.name
              : latest.body.title,
    };
    lastResult = null;
    sync();
  }
  // Opening another dialog must render its own normal fields, not inherit the old busy template.
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest?.("#manage,#new-request,#empty-action,[data-open],[data-publish]"))
        modes("intent");
      if (pending && event.target.closest?.("button[type=submit],#approve,#reject")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener(
    "submit",
    (event) => {
      if (pending) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener("click", observe);
  document.addEventListener("submit", observe);
  document.addEventListener("input", sync);
  document.addEventListener("change", sync);
  const observer = new MutationObserver(sync);
  for (const dialog of document.querySelectorAll("dialog"))
    observer.observe(dialog, { childList: true, attributes: true, attributeFilter: ["open"] });
  function change(id, value) {
    const field = document.getElementById(id);
    field.value = value;
    field.dispatchEvent(
      new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
    );
  }
  function prepare(id, pagination = false) {
    const control = controls.find((c) => c.id === id);
    if (!control) throw Error("Unknown operation");
    pending = null;
    lastResult = null;
    observed = 0;
    restore();
    modes("intent");
    base.scene(pagination ? "pagination" : control.scene);
    if (pagination) base.openDetail(base.state().rows[0].id);
    if (control.kind === "detail") change("decision-reason", " 核验后记录判断 ");
    if (control.kind === "publish") change("publish-reason", " 核验后发布 ");
    if (control.kind === "template")
      for (const [key, id] of Object.entries({
        name: "template-name",
        resource_type: "resource-type",
        node_name: "node-name",
        approver_id: "approver",
        sla_minutes: "sla",
        escalation_assignee_id: "escalation",
      }))
        change(id, data.forms.template[key]);
    window.APPROVAL_FIELDS_C.enhance();
    sync();
  }
  document.querySelector("#operation-picker").innerHTML = controls
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  document.querySelector("#prepare-operation").onclick = () =>
    prepare(document.querySelector("#operation-picker").value);
  document.querySelector("#scene-picker").addEventListener("change", () => {
    lastResult = null;
    observed = 0;
    sync();
  });
  window.APPROVAL_LIFECYCLE_C = {
    controls,
    prepare,
    settle,
    sync,
    state: () => ({ pending: publicOperation(pending), lastResult: publicOperation(lastResult) }),
  };
})();
