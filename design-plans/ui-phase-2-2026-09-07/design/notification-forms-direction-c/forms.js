(() => {
  "use strict";
  const base = window.NOTIFICATION_C,
    data = window.NOTIFICATION_FORMS_DATA;
  const sceneNames = {
    preferences: "偏好 / 原始值",
    preferences_off: "偏好 / 全部可编辑项关闭",
    preferences_busy: "偏好 / 保存等待",
    preferences_error: "偏好 / 保存失败",
    preferences_conflict: "偏好 / 版本冲突",
    "diagnostic-error": "读取失败 / 请求编号",
    "diagnostic-forbidden": "无权限 / 请求编号",
    "diagnostic-expired": "登录失效 / 请求编号",
    "diagnostic-rate_limited": "请求频繁 / 请求编号",
    "diagnostic-version_conflict": "版本冲突 / 请求编号",
  };
  function enhance() {
    for (const field of data.fields) {
      const input = document.getElementById(field.key);
      if (!input) continue;
      const label = input.closest("label"),
        description = label.querySelector("small");
      description.id = `${field.key}-help`;
      input.setAttribute("aria-describedby", description.id);
      const title = label.querySelector("span");
      if (!title.querySelector(".field-title")) {
        const node = document.createElement("span");
        node.className = "field-title";
        node.id = `${field.key}-label`;
        node.textContent = title.firstChild.textContent;
        title.replaceChild(node, title.firstChild);
      }
      input.setAttribute("aria-labelledby", `${field.key}-label`);
    }
    const result = document.getElementById("preference-result");
    const form = document.getElementById("preference-form");
    if (result && form) form.setAttribute("aria-describedby", result.id);
  }
  function prepare(scene) {
    if (!Object.hasOwn(sceneNames, scene)) throw Error("Unknown field scene");
    const diagnostic = scene.startsWith("diagnostic-")
      ? data.diagnostics.find((d) => scene === `diagnostic-${d.scene}`)
      : null;
    base.scene(diagnostic ? diagnostic.scene : scene);
    if (diagnostic) {
      const box = document.createElement("section");
      box.className = "diagnostic";
      box.setAttribute("aria-label", "请求诊断");
      const note = document.createElement("p");
      note.setAttribute("role", "status");
      note.textContent = diagnostic.notice;
      const details = document.createElement("details");
      details.id = "page-technical";
      const summary = document.createElement("summary");
      summary.textContent = "技术详情";
      const label = document.createElement("p");
      label.textContent = "本次请求编号（合成审核样本，不是通知/资源编号）";
      const code = document.createElement("code");
      code.id = "page-request-id";
      code.textContent = diagnostic.requestId;
      details.append(summary, label, code);
      box.append(note, details);
      document.querySelector(".overview").before(box);
    }
    document.getElementById("forms-picker").value = scene;
    enhance();
  }
  document.getElementById("forms-picker").innerHTML = Object.entries(sceneNames)
    .map(([key, name]) => `<option value="${key}">${name}</option>`)
    .join("");
  document.getElementById("forms-prepare").onclick = () =>
    prepare(document.getElementById("forms-picker").value);
  new MutationObserver(enhance).observe(document.getElementById("preferences"), {
    childList: true,
    subtree: true,
  });
  window.NOTIFICATION_FORMS_C = { prepare, enhance, sceneNames };
  prepare("preferences");
})();
