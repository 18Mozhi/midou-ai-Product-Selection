(() => {
  const api = window.TEAMS_C,
    $ = (s) => document.querySelector(s);
  const control = (id, actionId, label, selector, scene, signatures = [], extra = {}) => ({
    id,
    actionId,
    label,
    selector,
    scene,
    signatures,
    ...extra,
  });
  const controls = [
    control("refresh", "OG-REFRESH", "刷新团队与成员", "#refresh", "normal", [], {
      busyScene: "refreshing",
    }),
    control("refresh-loading", "OG-REFRESH", "首次读取禁用刷新", "#refresh", "loading", [], {
      disabledOnly: true,
    }),
    ...["error", "blocked", "expired", "forbidden", "rate_limited"].map((s) =>
      control(`retry-${s}`, "OG-RETRY", `重新加载 / ${s}`, "#retry", s),
    ),
    control(
      "open",
      "OG-T-OPEN",
      "头部新建",
      ".head-actions [data-create]",
      "normal",
      ["dea8d744b50ed1f0.1"],
      { busyScene: "refreshing" },
    ),
    control("open-empty", "OG-T-OPEN", "空目录新建", ".empty [data-create]", "empty", [
      "9f5ea38e58a26f78.1",
    ]),
    control(
      "create",
      "OG-T-CREATE",
      "创建并写入审计",
      "#create-submit",
      "create_draft",
      ["1ea0ce8ecc982edd.1", "bae4e728dfc90592.1"],
      { busyScene: "create_busy" },
    ),
    control(
      "cancel-create",
      "OG-T-CANCEL",
      "取消创建",
      "#cancel-create",
      "create_draft",
      ["617ab4a17066056a.1"],
      { disabledScene: "create_busy" },
    ),
    ...[
      ["all", "全部", "cde0a7cecbbc9a09.1"],
      ["active", "正常使用", "18ece981bcb15fca.1"],
      ["archived", "已归档", "56fb9bb2ac849bf0.1"],
    ].flatMap(([status, label, sig]) =>
      [false, true].map((selected) =>
        control(
          `status-${status}-${selected ? "selected" : "available"}`,
          "OG-T-FILTER",
          `${label} / ${selected ? "已选" : "未选"}`,
          `[data-status="${status}"]`,
          "catalog",
          selected ? [] : [sig],
          { status, selected },
        ),
      ),
    ),
    control(
      "reset",
      "OG-T-FILTER",
      "重置筛选",
      "#filters [data-reset]",
      "search_email",
      ["66725db5db9a8fe8.1"],
      { filtersOpen: true },
    ),
    control("clear-empty", "OG-T-FILTER", "空结果清筛选", ".empty [data-reset]", "filter_empty", [
      "83a359c9f404cb11.1",
    ]),
    control("select", "OG-T-SELECT", "选择另一团队", ".team-row[aria-pressed='false']", "catalog", [
      "95629c96c6d7c41b.1",
    ]),
    control(
      "select-current",
      "OG-T-SELECT",
      "当前团队已选",
      ".team-row[aria-pressed='true']",
      "catalog",
    ),
    control(
      "previous",
      "OG-T-PAGE",
      "上一页",
      ".pagination button:first-child",
      "page_two",
      ["3619d28a163df5ce.1"],
      { disabledScene: "catalog" },
    ),
    control(
      "next",
      "OG-T-PAGE",
      "下一页",
      ".pagination button:last-child",
      "catalog",
      ["d56d9b5edd39513e.1"],
      { disabledScene: "page_two" },
    ),
    ...[
      ["assign", "分配", "9fbd42d272c62579.1"],
      ["remove", "移除", "917ad4e4a5730305.1"],
    ].flatMap(([action, label, sig]) => [
      control(
        action,
        "OG-T-MEMBER",
        `${label}成员`,
        `[data-member-action="${action}"]`,
        "selected",
        [sig],
        { member: true, busyScene: "member_busy" },
      ),
      control(
        `${action}-missing`,
        "OG-T-MEMBER",
        `未选成员仍可点击${label}`,
        `[data-member-action="${action}"]`,
        "member_missing",
      ),
      control(
        `${action}-archived`,
        "OG-T-MEMBER",
        `归档团队仍可${label}`,
        `[data-member-action="${action}"]`,
        "archived",
        [],
        { member: true },
      ),
      control(
        `${action}-no-members`,
        "OG-T-MEMBER",
        `无活动成员时${label}入口`,
        `[data-member-action="${action}"]`,
        "no_members",
      ),
    ]),
    control("members", "OG-T-LINK", "查看组织成员", "a[href='/org-admin/members']", "normal", [
      "76054446429e86da.1",
    ]),
    control(
      "workspaces",
      "OG-T-LINK",
      "查看工作区边界",
      "a[href='/org-admin/workspaces']",
      "normal",
      ["2db399169624cf8a.1"],
    ),
    control("technical", "OG-TECH", "展开技术详情", "#technical summary", "normal", [
      "1c008f867673db60.1",
    ]),
    control("technical-open", "OG-TECH", "收起技术详情", "#technical summary", "technical"),
    ...["assign", "remove"].flatMap((action) =>
      ["confirm", "cancel", "close"].map((verb) =>
        control(
          `reason-${action}-${verb}`,
          "D-OG-REASON",
          `${action === "assign" ? "分配" : "移除"}原因 / ${verb}`,
          `#reason-${verb}`,
          `reason_${action}`,
          [],
          { reasonAction: action, ...(verb === "confirm" ? { shortReason: true } : {}) },
        ),
      ),
    ),
    control(
      "filters-closed",
      "PROPOSAL-FILTERS",
      "展开手机筛选",
      "#filters summary",
      "catalog",
      [],
      { filtersOpen: false, proposalOnly: true },
    ),
    control("filters-open", "PROPOSAL-FILTERS", "收起筛选", "#filters summary", "catalog", [], {
      filtersOpen: true,
      proposalOnly: true,
    }),
  ].map((c) => ({
    ...c,
    states: c.disabledOnly
      ? ["disabled"]
      : [
          "default",
          "hover",
          "focus",
          "pressed",
          ...(c.busyScene ? ["busy"] : []),
          ...(c.disabledScene || c.shortReason ? ["disabled"] : []),
        ],
  }));
  function prepare(id, state = "default") {
    const c = controls.find((item) => item.id === id);
    if (!c || !c.states.includes(state)) throw Error("Unknown control/state");
    api.scene(
      state === "busy" ? c.busyScene : state === "disabled" ? c.disabledScene || c.scene : c.scene,
    );
    if (c.status) {
      const chosen = c.selected ? c.status : c.status === "all" ? "active" : "all";
      $(`[data-status="${chosen}"]`).click();
    }
    if (c.member && state !== "busy") {
      const select = $("#team-member-select");
      select.value = api.state().members.find((m) => m.status === "active").id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (c.filtersOpen !== undefined) $("#filters").open = c.filtersOpen;
    document.body.dataset.reasonAction = c.reasonAction || "";
    if (state === "disabled" && c.shortReason) {
      $("#reason-input").value = "短";
      $("#reason-input").dispatchEvent(new Event("input", { bubbles: true }));
    }
    $(".control-tools").open = false;
  }
  document.addEventListener(
    "click",
    (event) => {
      const action = event.target.closest("[data-member-action]")?.dataset.memberAction;
      if (action) document.body.dataset.reasonAction = action;
    },
    true,
  );
  const picker = $("#control-picker");
  for (const c of controls)
    for (const state of c.states)
      picker.add(new Option(`${c.label} / ${state}`, `${c.id}:${state}`));
  $("#control-show").onclick = () => {
    const [id, state] = picker.value.split(":");
    prepare(id, state);
    $(controls.find((c) => c.id === id).selector)?.scrollIntoView({ block: "center" });
  };
  window.TEAM_CONTROLS_C = { controls, prepare };
  prepare("remove");
})();
