(() => {
  "use strict";
  // Separate proposal adapter. The retained renderer and its filter algorithm are unchanged.
  const fields = [
    ["workspace-query", "workspaceQuery", "只搜索工作区名称，不搜索记录 ID。"],
    ["workspace-status", "workspaceStatus", "按工作区的当前状态筛选。"],
    ["workspace-sort", "workspaceSort", "合计用于排序，不代表评分或优先级。"],
    ["export-query", "exportQuery", "搜索工作区名称、中文类型或状态，不搜索记录 ID。"],
    ["export-workspace", "exportWorkspace", "选项来自已加载的导出记录。"],
    ["export-type", "exportType", "按机会、热点或团队报表筛选。"],
    ["export-status", "exportStatus", "按已返回的生成状态筛选。"],
    ["export-sort", "exportSort", "仅调整已加载记录的排列顺序。"],
  ].map(([id, model, help]) => ({ id, model, help }));
  function decorate() {
    const filters = document.querySelector(".filters");
    if (!filters || filters.dataset.fieldReview) return;
    const active = document.activeElement;
    const selection =
      active?.tagName === "INPUT" ? [active.selectionStart, active.selectionEnd] : null;
    filters.dataset.fieldReview = "pending";
    const region = document.createElement("div");
    region.className = "field-review-region";
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", "筛选字段设计审核区域");
    filters.parentElement.prepend(region);
    for (const selector of [".paper-head", "#filters-toggle", ".filters", ".count"])
      region.append(document.querySelector(selector));
    for (const field of fields) {
      const input = document.getElementById(field.id);
      if (!input) continue;
      const label = input.parentElement;
      const title = document.createElement("span");
      title.id = `${field.id}-label`;
      title.textContent = label.firstChild.textContent;
      label.replaceChild(title, label.firstChild);
      const help = document.createElement("small");
      help.id = `${field.id}-help`;
      help.textContent = field.help;
      help.className = "field-help";
      label.append(help);
      input.setAttribute("aria-labelledby", title.id);
      input.setAttribute("aria-describedby", help.id);
    }
    const reset = document.getElementById("reset");
    const actions = document.createElement("div");
    actions.className = "field-actions";
    const explanation = document.createElement("small");
    explanation.textContent = "仅重置当前视图的筛选与排序，返回第 1 页。";
    actions.append(explanation, reset);
    filters.append(actions);
    if (active && region.contains(active)) {
      active.focus({ preventScroll: true });
      if (selection) active.setSelectionRange(...selection);
    }
  }
  new MutationObserver(decorate).observe(document.getElementById("app"), { childList: true });
  decorate();
  window.ORG_DATA_FIELDS_C = { fields, decorate };
})();
