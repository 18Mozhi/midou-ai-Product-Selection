(() => {
  const api = window.ORG_TOKEN_C,
    states = ["default", "hover", "focus", "pressed"];
  const controls = [];
  // Source-identical variants share a single primary source mapping below.
  const add = (id, label, selector, scene, action, extra = {}) =>
    controls.push({
      id,
      label,
      selector,
      scene,
      action,
      states,
      widths: [1440, 390],
      signatures: [],
      ...extra,
    });
  add("catalog-nav", "定位生命周期", '[data-anchor="catalog-title"]', "normal", "jump", {
    proposalOnly: true,
    focusTarget: "#catalog-title",
  });
  add("create-nav", "定位创建令牌", '[data-anchor="create-name"]', "normal", "jump", {
    proposalOnly: true,
  });
  add("refresh", "刷新数据", "#refresh", "normal", "read", {
    parentReference: true,
    states: [...states, "busy"],
  });
  add("retry", "重新加载", "#retry", "error", "read", { parentReference: true });
  add("create-jump", "定位创建表单", "#new-token", "normal", "jump", { proposalOnly: true });
  add("reset", "重置筛选", "#reset", "search", "reset", { signatures: ["66725db5db9a8fe8.1"] });
  add("clear", "清除空结果筛选", "#clear-filter", "filter_empty", "reset", { proposalOnly: true });
  add("technical-closed", "技术详情收起", ".technical summary", "normal", "technical", {
    open: false,
    signatures: ["1c008f867673db60.1"],
  });
  add("technical-open", "技术详情展开", ".technical summary", "technical", "technical", {
    open: true,
  });
  add("previous", "上一页", '[data-page="-1"]', "page_two", "page", {
    delta: -1,
    signatures: ["d27cb4f69e0d30d7.1"],
  });
  add("previous-disabled", "首页禁用上一页", '[data-page="-1"]', "normal", "page", {
    states: ["disabled"],
    disabledOnly: true,
  });
  add("next", "下一页", '[data-page="1"]', "normal", "page", {
    delta: 1,
    signatures: ["169268616bd2a69a.1"],
  });
  add("next-disabled", "末页禁用下一页", '[data-page="1"]', "page_two", "page", {
    states: ["disabled"],
    disabledOnly: true,
  });
  add("create", "创建并显示一次明文", "#create-submit", "create_draft", "create", {
    states: [...states, "busy"],
    signatures: ["ed5969fa99d64044.1", "073eb5c8ded40aa0.1"],
  });
  for (const days of [30, 90, 180, 365])
    for (const selected of [false, true])
      add(
        `ttl-${days}-${selected ? "selected" : "unselected"}`,
        `${days}天${selected ? "已选" : "未选"}`,
        `[data-ttl="${days}"]`,
        "create",
        "ttl",
        { days, selected, signatures: days === 30 && !selected ? ["ee181e5ac85b01ec.1"] : [] },
      );
  for (let i = 0; i < 4; i++)
    for (const checked of [false, true])
      add(
        `scope-${i}-${checked ? "checked" : "unchecked"}`,
        `${window.ORG_TOKEN_C_DATA.scopeOptions[i].label}${checked ? "已选" : "未选"}`,
        `#scope-${i}`,
        "create",
        "scope",
        {
          scopeIndex: i,
          checked,
          crop: `label[for="scope-${i}"]`,
          signatures: i === 0 && !checked ? ["ab0838b07b48fd2a.1"] : [],
        },
      );
  for (const [id, scene, label] of [
    ["copy", "secret", "复制明文"],
    ["copy-copied", "copy_success", "复制反馈成功"],
    ["copy-failed", "copy_failure", "复制反馈失败"],
  ])
    add(id, label, "#copy", scene, "copy", {
      signatures: id === "copy" ? ["6d8d1a59210a6ea0.1"] : [],
    });
  add("dismiss", "我已安全保存", "#dismiss", "secret", "dismiss", {
    signatures: ["b3a4e8d62ca470a9.1"],
  });
  for (const action of ["rotate", "revoke"]) {
    add(
      action,
      action === "rotate" ? "轮换密钥" : "撤销访问",
      `[data-action="${action}"]`,
      "normal",
      "open-reason",
      {
        tokenAction: action,
        states: [...states, "busy"],
        signatures: [action === "rotate" ? "00a635020f530ba8.1" : "5b6c117ef94cbbb0.1"],
      },
    );
    for (const part of ["close", "cancel", "submit"])
      add(
        `${action}-${part}`,
        `${action === "rotate" ? "轮换" : "撤销"}窗 · ${part === "close" ? "关闭" : part === "cancel" ? "取消" : "确认"}`,
        `#reason-${part}`,
        `reason_${action}`,
        part === "submit" ? "confirm" : "cancel",
        {
          tokenAction: action,
          sharedReason: true,
          states: part === "submit" ? [...states, "disabled"] : states,
        },
      );
  }
  for (const open of [false, true])
    add(
      `filters-${open ? "open" : "closed"}`,
      open ? "收起筛选" : "展开筛选",
      "#filters-toggle",
      "normal",
      "filters",
      { proposalOnly: true, widths: [390], filtersOpen: open },
    );
  function prepare(id, variant = "default") {
    const c = controls.find((c) => c.id === id);
    if (!c) throw Error("Unknown control");
    api.scene(variant === "busy" ? (c.action === "read" ? "refreshing" : "create_busy") : c.scene);
    const $ = (s) => document.querySelector(s);
    if (
      c.action === "reset" &&
      $("#filters-toggle") &&
      !api.state().filtersOpen &&
      c.id === "reset"
    )
      $("#filters-toggle").click();
    if (c.action === "filters" && api.state().filtersOpen !== c.filtersOpen)
      $("#filters-toggle").click();
    if (c.action === "ttl")
      $(`[data-ttl="${c.selected ? c.days : c.days === 90 ? 30 : 90}"]`).click();
    if (c.action === "scope" && c.checked) $(c.selector).click();
    if (c.action === "confirm" && variant !== "disabled") {
      $("#reason-input").value = "定期核对接入用途";
      $("#reason-input").dispatchEvent(new Event("input", { bubbles: true }));
    }
    $("#control-picker").value = id;
    return c;
  }
  for (const c of controls)
    document.querySelector("#control-picker").add(new Option(c.label, c.id));
  document.querySelector("#control-picker").onchange = (e) => prepare(e.target.value);
  window.ORG_TOKEN_CONTROLS_C = { controls, prepare };
})();
