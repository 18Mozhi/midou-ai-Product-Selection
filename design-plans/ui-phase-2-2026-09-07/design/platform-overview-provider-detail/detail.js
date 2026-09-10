(() => {
  "use strict";
  // Presentation-only child proposal. Preserve the original controller and field values.
  function enhance() {
    const bar = document.querySelector(".review-bar > span");
    if (bar && !bar.dataset.detailReview) {
      bar.dataset.detailReview = "true";
      bar.textContent = "P38 · 来源预览 / 表格设置 C 细化稿 · 未批准 / 未上线";
    }
    const options = document.querySelector(".column-options");
    if (options && !options.querySelector("#column-help")) {
      const help = document.createElement("p");
      help.id = "column-help";
      help.className = "detail-help";
      help.textContent = "至少保留一列。仅调整当前表格的显示。";
      options.append(help);
      options.querySelectorAll("input").forEach((input) => {
        input.setAttribute("aria-describedby", help.id);
      });
    }
    const dialog = document.querySelector("dialog.preview");
    if (!dialog) return;
    const title = dialog.querySelector(".preview-body h3");
    if (title && !title.id) title.id = "provider-name";
    dialog.setAttribute("aria-labelledby", title ? "preview-title provider-name" : "preview-title");
    const body = dialog.querySelector(".preview-body");
    body?.querySelectorAll("dl").forEach((list) => {
      if (list.dataset.grouped) return;
      list.dataset.grouped = "true";
      const fields = [...list.children];
      for (let i = 0; i < fields.length; i += 2) {
        const group = document.createElement("div");
        group.className = "detail-field";
        group.append(fields[i], fields[i + 1]);
        list.append(group);
      }
    });
  }
  new MutationObserver(enhance).observe(document.querySelector("#app"), {
    childList: true,
    subtree: true,
  });
  enhance();
})();
