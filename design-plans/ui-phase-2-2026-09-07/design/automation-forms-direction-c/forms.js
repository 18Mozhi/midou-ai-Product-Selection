(() => {
  const fields = window.AUTOMATION_FORM_FIELDS;
  const editor = document.getElementById("editor");
  const text = (el, value) => {
    if (el.textContent !== value) el.textContent = value;
  };
  function invalidMessage(el, field) {
    if (el.validity.valueMissing)
      return `请${el.tagName === "SELECT" ? "选择" : "填写"}${field.label}。`;
    if (el.validity.rangeUnderflow || el.validity.rangeOverflow || el.validity.stepMismatch)
      return `请输入 ${field.min}–${field.max} 的整数。`;
    if (el.validity.badInput) return "请输入有效数字。";
    if (el.required && !el.value.trim()) return `${field.label}不能仅为空格。`;
    return "请检查此项，填写有效值。";
  }
  // Presentation only: do not change values, native constraints, requests or the parent controller.
  function decorate() {
    for (const field of fields) {
      const el = document.getElementById(field.id);
      if (!el) continue;
      const label = el.closest(".field");
      let hint = label.querySelector("small");
      if (!hint) {
        hint = document.createElement("small");
        label.append(hint);
      }
      hint.id = `${field.id}-hint`;
      hint.className = "field-hint";
      text(
        hint,
        field.hint +
          (field.maxlength ? ` 当前 ${el.value.length} / ${field.maxlength} 字符。` : ""),
      );
      let error = document.getElementById(`${field.id}-error`);
      if (error && el.validity.valid && (!el.required || el.value.trim())) {
        error.remove();
        error = null;
        el.removeAttribute("aria-invalid");
      }
      if (error) text(error, invalidMessage(el, field));
      const describedBy = `${hint.id}${error ? ` ${error.id}` : ""}`;
      if (el.getAttribute("aria-describedby") !== describedBy)
        el.setAttribute("aria-describedby", describedBy);
    }
  }
  new MutationObserver(decorate).observe(editor, { childList: true, subtree: true });
  editor.addEventListener("input", decorate);
  function prepare(id) {
    const field = fields.find((f) => f.id === id);
    if (!field) throw new Error(`Unknown field ${id}`);
    window.AUTOMATION_C.scene(id === "reason" ? "edit" : "template_overdue");
    if (id === "action_assignee_id") {
      const action = document.getElementById("action_type");
      action.value = "create_task";
      action.dispatchEvent(new Event("input", { bubbles: true }));
    }
    decorate();
    return field;
  }
  const select = document.getElementById("field-select");
  for (const field of fields) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = field.label;
    select.append(option);
  }
  document.getElementById("show-field").onclick = () => {
    prepare(select.value);
    const el = document.getElementById(select.value);
    el.focus();
    el.scrollIntoView({ block: "center" });
  };
  window.AUTOMATION_FORMS_C = { fields, prepare, decorate };
})();
