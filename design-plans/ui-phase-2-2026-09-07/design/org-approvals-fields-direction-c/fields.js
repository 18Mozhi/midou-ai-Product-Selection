(() => {
  const api = window.ORG_APPROVALS_C,
    data = window.ORG_APPROVALS_C_DATA;
  const $ = (s) => document.querySelector(s);
  const title = {
    query: "搜索",
    status: "状态",
    workspace: "工作区",
    resource: "资源类型",
    sort: "排序",
  };
  const workspaces = [...new Set(data.templates.map((t) => t.workspace_name))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const fields = ["request", "template"].flatMap((kind) =>
    Object.keys(title).map((key) => ({
      id: `${kind}-${key}`,
      kind,
      key,
      selector: `#${kind}-${key}`,
      binding: kind + key[0].toUpperCase() + key.slice(1),
      label: `${kind === "request" ? "审批" : "模板"}${title[key]}`,
      options:
        key === "query"
          ? null
          : key === "status"
            ? [
                "all",
                ...(kind === "request"
                  ? ["pending", "approved", "rejected", "cancelled"]
                  : ["published", "draft", "archived"]),
              ]
            : key === "workspace"
              ? ["all", ...workspaces]
              : key === "resource"
                ? ["all", "task", "opportunity_decision"]
                : kind === "request"
                  ? ["created_desc", "created_asc", "title_asc", "status_asc"]
                  : ["name_asc", "updated_desc", "nodes_desc", "workspace_asc"],
    })),
  );
  const cases = fields.flatMap((f) =>
    [
      { state: "default" },
      { state: "focus", focus: true },
      ...(f.key === "query"
        ? [
            { state: "matching", value: f.kind === "request" ? "厨房" : "首次" },
            { state: "whitespace", value: "   " },
            { state: "no-result", value: "没有返回的筛选样例" },
            { state: "hidden-id", value: data.templates[0].id },
            { state: "length-200", value: "查".repeat(200) },
            { state: "length-220", value: "查".repeat(220) },
            { state: "restored-200", value: "查".repeat(220), reload: true },
          ]
        : f.options.slice(1).map((value, i) => ({ state: `option-${i + 1}`, value }))),
      ...(f.key === "workspace"
        ? [
            {
              state: "no-workspaces",
              scene: f.kind === "request" ? "missing_template" : "template_empty",
            },
          ]
        : []),
      { state: "refreshing", scene: "refreshing" },
    ].map((v) => ({
      ...v,
      id: `${f.id}-${v.state}`,
      fieldId: f.id,
      kind: f.kind,
      key: f.key,
      selector: f.selector,
    })),
  );
  const compositions = ["request", "template"].flatMap((kind) => [
    { id: `${kind}-filters-default`, kind, label: "默认筛选组合" },
    { id: `${kind}-filters-matching`, kind, label: "多条件筛选组合", matching: true },
    { id: `${kind}-filters-empty`, kind, label: "无结果筛选组合", empty: true },
    { id: `${kind}-filters-refreshing`, kind, label: "刷新中筛选保持可用", refreshing: true },
  ]);
  const help = (f) =>
    ({
      query:
        f.kind === "request"
          ? "仅搜索已加载记录的标题、可见模板名称或工作区名称，不搜索技术编号。"
          : "仅搜索已返回模板的名称或工作区名称，不搜索节点或技术编号。",
      status: "按返回记录的真实状态筛选；无匹配结果不表示输入错误。",
      workspace: "按已返回模板的工作区名称筛选；同名工作区合并为一个选项。",
      resource: "业务任务与机会决策分别查看，不改变当前工作区。",
      sort:
        f.kind === "request"
          ? "仅调整已加载记录的顺序；修改条件后回到第一页。"
          : "版本号排序依据当前版本，不按更新时间；修改条件后回到第一页。",
    })[f.key];
  function decorate() {
    for (const f of fields) {
      const el = $(f.selector);
      if (!el || el.dataset.fieldDecorated) continue;
      el.dataset.fieldDecorated = "true";
      const note = document.createElement("span");
      note.className = "field-help";
      note.id = `${f.id}-help`;
      note.textContent = help(f);
      el.after(note);
      const ids = [note.id];
      if (f.key === "query") {
        const count = document.createElement("span");
        count.id = `${f.id}-count`;
        count.className = "field-count";
        count.textContent = `当前输入长度：${el.value.length}`;
        note.after(count);
        ids.push(count.id);
        if (el.value.length > 200) {
          const warning = document.createElement("span");
          warning.id = `${f.id}-restore-note`;
          warning.className = "field-notice";
          warning.textContent = "链接恢复将按现有规则读取前 200 位；当前输入不会被截断。";
          count.after(warning);
          ids.push(warning.id);
        }
      }
      el.setAttribute("aria-describedby", ids.join(" "));
    }
  }
  new MutationObserver(decorate).observe($("#app"), { childList: true, subtree: true });
  function edit(kind, key, value) {
    const el = $(`#${kind}-${key}`);
    el.value = value;
    el.dispatchEvent(new Event(key === "query" ? "input" : "change", { bubbles: true }));
    decorate();
  }
  function setup(kind, scene) {
    api.scene(scene || (kind === "request" ? "normal" : "templates"));
    const view = kind === "request" ? "requests" : "templates";
    if (api.state().view !== view) $(`[data-view="${view}"]`).click();
    if (!api.state().filtersOpen) $("#filters-toggle").click();
    $(".control-tools").open = false;
    decorate();
  }
  function prepare(id) {
    const c = cases.find((c) => c.id === id);
    if (!c) throw Error("Unknown field case");
    setup(c.kind, c.scene);
    if (Object.hasOwn(c, "value")) edit(c.kind, c.key, c.value);
    if (c.focus) $(c.selector).focus();
  }
  function compose(id) {
    const c = compositions.find((c) => c.id === id);
    if (!c) throw Error("Unknown composition");
    setup(c.kind, c.refreshing ? "refreshing" : undefined);
    if (c.matching) {
      edit(c.kind, "query", c.kind === "request" ? "厨房" : "选品");
      edit(c.kind, "status", c.kind === "request" ? "pending" : "published");
      edit(c.kind, "workspace", "新品决策工作区");
      edit(c.kind, "resource", "opportunity_decision");
      edit(c.kind, "sort", c.kind === "request" ? "title_asc" : "updated_desc");
    }
    if (c.empty) edit(c.kind, "query", "没有返回的筛选样例");
  }
  const picker = $("#field-picker");
  for (const c of cases)
    picker.add(new Option(`${fields.find((f) => f.id === c.fieldId).label} / ${c.state}`, c.id));
  for (const c of compositions)
    picker.add(new Option(`${c.kind === "request" ? "审批" : "模板"} / ${c.label}`, c.id));
  $("#field-show").onclick = () => {
    const c = cases.find((c) => c.id === picker.value);
    if (c) {
      prepare(c.id);
      if (c.reload) location.reload();
      else $(c.selector)?.scrollIntoView({ block: "center" });
    } else {
      compose(picker.value);
      $(".filters").scrollIntoView({ block: "center" });
    }
  };
  window.ORG_APPROVAL_FIELDS_C = { fields, cases, compositions, prepare, compose, decorate };
  decorate();
})();
