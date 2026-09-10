/* Explicit review states using the existing six-field controller; no service access. */
(() => {
  const ids = [
    "name",
    "logo_url",
    "timezone",
    "data_retention_days",
    "default_workspace_id",
    "reason",
  ];
  const labels = ["名称", "Logo HTTPS 地址", "时区", "数据保留天数", "默认工作区", "变更原因"];
  const fields = ids.map((id, i) => ({
    id,
    label: labels[i],
    selector: `#${id}`,
    binding: `form.${id}`,
    states: [
      "default",
      "hover",
      "focus",
      ...(id === "default_workspace_id" ? [] : ["pressed"]),
      "empty",
      "invalid",
      "corrected",
      "save_editable",
    ],
  }));
  function decorate() {
    for (const id of ids) {
      const el = document.getElementById(id),
        error = document.getElementById(`${id}-error`);
      if (!el) continue;
      error.setAttribute("aria-live", "polite");
      error.setAttribute("aria-atomic", "true");
      if (el.maxLength > 0) {
        let count = document.getElementById(`${id}-count`);
        if (!count) {
          count = document.createElement("span");
          count.id = `${id}-count`;
          count.className = "field-count";
          el.closest(".field").append(count);
          el.setAttribute("aria-describedby", `${el.getAttribute("aria-describedby")} ${count.id}`);
        }
        const message = `${el.value.length} / ${el.maxLength} 字符`;
        if (count.textContent !== message) count.textContent = message;
      }
    }
  }
  function assign(id, value) {
    const el = document.getElementById(id);
    el.value = String(value);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    decorate();
  }
  function prepare(id, state = "default") {
    const f = fields.find((v) => v.id === id);
    if (!f || !f.states.includes(state)) throw new Error("Unknown field state");
    window.ORG_PROFILE_C.scene(state === "save_editable" ? "save_busy" : "normal");
    decorate();
    if (["empty", "invalid", "corrected"].includes(state)) {
      assign(
        id,
        state === "empty"
          ? ""
          : id === "logo_url"
            ? "http://example.test/logo.png"
            : id === "data_retention_days"
              ? "29"
              : "",
      );
      if (state !== "empty") document.getElementById(id).checkValidity();
    }
    document.getElementById("field-select").value = id;
    document.getElementById("field-mode").value = ["empty", "invalid", "save_editable"].includes(
      state,
    )
      ? state
      : "default";
  }
  function combination(scene) {
    window.ORG_PROFILE_C.scene(scene);
    decorate();
    if (scene === "editing") {
      for (const id of ["name", "logo_url", "timezone", "reason"]) {
        const el = document.getElementById(id);
        const prefix = id === "logo_url" ? "https://example.test/" : "";
        assign(id, prefix + "长".repeat(el.maxLength - prefix.length));
      }
    }
  }
  for (const f of fields) document.getElementById("field-select").add(new Option(f.label, f.id));
  document.getElementById("show-field").onclick = () => {
    const id = document.getElementById("field-select").value;
    prepare(id, document.getElementById("field-mode").value);
    document.getElementById(id).scrollIntoView({ block: "center" });
  };
  document.getElementById("workspace").addEventListener("input", decorate);
  document.getElementById("workspace").addEventListener("change", decorate);
  document.getElementById("review-scene").addEventListener("change", decorate);
  // Parent render replaces the form after local save/refresh feedback. Reattach only decoration.
  new MutationObserver(decorate).observe(document.getElementById("workspace"), { childList: true });
  decorate();
  window.ORG_PROFILE_FIELDS_C = { fields, prepare, combination };
})();
