(() => {
  "use strict";
  const selector = "dialog input,dialog select,dialog textarea";
  const fieldNames = {
    "template-name": "模板名称",
    "resource-type": "资源类型",
    "node-name": "节点名称",
    sla: "处理时限",
    approver: "审批人",
    escalation: "超时接收人",
    "request-template": "已发布模板",
    "resource-id": "关联资源编号",
    "request-title": "审批标题",
    "publish-reason": "发布原因",
    "decision-reason": "审批原因",
  };
  function guidance(node) {
    const parts = [];
    if (node.required) parts.push("必填");
    if (node.id === "decision-reason") parts.push("批准与驳回均需填写原因");
    if (node.maxLength > 0)
      parts.push(`${node.value.length} / ${node.maxLength} 字符（浏览器计数）`);
    if (node.type === "number") parts.push(`${node.min}–${node.max} 分钟，整数`);
    if (["approver", "escalation"].includes(node.id)) parts.push("只可选择当前工作区成员");
    if (node.id === "resource-type") parts.push("定义模板关联的业务类型");
    if (node.id === "request-template") parts.push("只可使用已发布模板，关联类型由模板锁定");
    if (node.id === "resource-id") parts.push("存在性、类型及工作区归属由服务端验证");
    return parts.join(" · ");
  }
  function errorText(node) {
    const v = node.validity;
    if (v.valueMissing) return `${fieldNames[node.id]}不能为空。`;
    if (v.badInput) return "请填写有效数字。";
    if (v.rangeUnderflow || v.rangeOverflow) return `处理时限应在 ${node.min}–${node.max} 分钟内。`;
    if (v.stepMismatch) return "处理时限请填写整数分钟。";
    if (v.tooLong) return `最多填写 ${node.maxLength} 个字符。`;
    return node.validationMessage || "请核对该字段。";
  }
  function summarize(form) {
    if (!form) return;
    const summary = form.querySelector(".field-summary");
    const count = form.querySelectorAll('[aria-invalid="true"]').length;
    if (summary) {
      const next = count ? `有 ${count} 项需要核对，请按字段旁的提示修改。尚未生成提交预览。` : "";
      if (summary.textContent !== next) summary.textContent = next;
      summary.hidden = !count;
    }
  }
  function update(node, validate = false) {
    if (!node.matches?.(selector) || !node.dataset.fieldEnhanced) return;
    document.getElementById(`${node.id}-help`).textContent = guidance(node);
    const error = document.getElementById(`${node.id}-error`);
    if (validate || node.getAttribute("aria-invalid") === "true") {
      const invalid = !node.validity.valid;
      node.setAttribute("aria-invalid", String(invalid));
      error.hidden = !invalid;
      error.textContent = invalid ? errorText(node) : "";
      summarize(node.form);
    }
  }
  function enhance() {
    for (const node of document.querySelectorAll(selector)) {
      if (node.dataset.fieldEnhanced || !fieldNames[node.id]) continue;
      node.dataset.fieldEnhanced = "true";
      // The old prototype's validText replaces oninput to clear custom validity.
      // Keep its original publish-reason synchronization alive after that replacement.
      if (node.id === "publish-reason") {
        const syncReason = node.oninput;
        node.addEventListener("input", (event) => {
          if (syncReason && node.oninput !== syncReason) syncReason.call(node, event);
        });
      }
      const help = document.createElement("small"),
        error = document.createElement("small");
      help.id = `${node.id}-help`;
      help.className = "field-guidance";
      error.id = `${node.id}-error`;
      error.className = "field-error";
      error.hidden = true;
      const label = node.closest("label"),
        cluster = document.createElement("div");
      cluster.className = "field-cluster";
      label.before(cluster);
      cluster.append(label, help, error);
      node.setAttribute(
        "aria-describedby",
        [node.getAttribute("aria-describedby"), help.id, error.id].filter(Boolean).join(" "),
      );
      if (node.id === "decision-reason") node.setAttribute("aria-required", "true");
      update(node);
    }
    for (const form of document.querySelectorAll("dialog form")) {
      if (form.querySelector(".field-summary")) continue;
      const summary = document.createElement("p");
      summary.className = "field-summary";
      summary.hidden = true;
      summary.setAttribute("role", "status");
      summary.setAttribute("aria-live", "polite");
      form.querySelector(".form-intro")?.after(summary);
      if (!summary.isConnected) form.querySelector("header").after(summary);
    }
  }
  const pendingFocus = new WeakSet();
  document.addEventListener(
    "invalid",
    (event) => {
      const node = event.target;
      if (!node.matches?.(selector)) return;
      // Keep native constraint rejection, replace the browser bubble with linked Chinese errors.
      event.preventDefault();
      update(node, true);
      const form = node.form;
      if (!form || pendingFocus.has(form)) return;
      pendingFocus.add(form);
      queueMicrotask(() => {
        pendingFocus.delete(form);
        if (form.isConnected) form.querySelector('[aria-invalid="true"]:not(:disabled)')?.focus();
      });
    },
    true,
  );
  document.addEventListener("input", (event) => update(event.target));
  document.addEventListener("change", (event) => update(event.target));
  // Existing controllers replace form content on template changes; decorate new fields only.
  const observer = new MutationObserver((records) => {
    if (
      records.some((record) =>
        [...record.addedNodes].some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches?.("form,input,select,textarea") ||
              node.querySelector?.("input,select,textarea")),
        ),
      )
    )
      enhance();
  });
  for (const dialog of document.querySelectorAll("dialog"))
    observer.observe(dialog, { childList: true, subtree: true });
  enhance();
  window.APPROVAL_FIELDS_C = { fieldNames, enhance };
})();
