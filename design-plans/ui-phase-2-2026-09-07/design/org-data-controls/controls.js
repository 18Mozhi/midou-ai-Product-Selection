(() => {
  const api = window.ORG_DATA_C;
  const control = (id, label, selector, scene, signatures = [], extra = {}) => ({
    id,
    label,
    selector,
    scene,
    signatures,
    ...extra,
  });
  const controls = [
    control("refresh", "刷新数据", "#refresh", "normal", [], {
      parentControl: true,
      busyScene: "refreshing",
      action: "read",
    }),
    control("refresh-loading", "首次读取禁用刷新", "#refresh", "loading", [], {
      parentControl: true,
      disabledOnly: true,
      action: "read",
    }),
    ...["error", "forbidden", "expired", "rate_limited"].map((scene) =>
      control(`retry-${scene}`, `重新加载 / ${scene}`, "#retry", scene, [], {
        parentControl: true,
        action: "read",
      }),
    ),
    ...[
      ["workspaces", "工作区比较", "874d2aeb7a9f46f2.1"],
      ["exports", "导出履历", "26b1ac38e04c362f.1"],
    ].flatMap(([view, label, signature]) =>
      [false, true].map((selected) =>
        control(
          `view-${view}-${selected ? "selected" : "available"}`,
          `${label} / ${selected ? "已选" : "未选"}`,
          `[data-view="${view}"]`,
          selected === (view === "workspaces") ? "normal" : "exports",
          selected ? [] : [signature],
          { selected, view, action: "view" },
        ),
      ),
    ),
    ...[
      ["workspace", "工作区", "3638b3e1e1d8cad7.1", "a3740ac6cf7e5072.1", "595d56ce2159fb14.1"],
      ["export", "导出", "000799abd17373dd.1", "ad756c5bd12f75ea.1", "17620112cb625463.1"],
    ].flatMap(([kind, label, reset, prev, next]) => {
      const base = kind === "workspace" ? "normal" : "exports";
      return [
        control(`${kind}-reset`, `${label}重置筛选`, "#reset", `${kind}_search`, [reset], {
          kind,
          filtersOpen: true,
          action: "reset",
        }),
        control(
          `${kind}-clear-empty`,
          `${label}空结果清除筛选`,
          "#clear-filter",
          `${kind}_filter_empty`,
          [],
          { kind, proposalOnly: true, action: "reset" },
        ),
        control(
          `${kind}-previous`,
          `${label}上一页`,
          '[data-page="-1"]',
          `${kind}_page_two`,
          [prev],
          { kind, disabledScene: base, delta: -1, action: "page" },
        ),
        control(`${kind}-next`, `${label}下一页`, '[data-page="1"]', base, [next], {
          kind,
          disabledScene: kind === "workspace" ? "workspace_page_two" : "export_page_three",
          delta: 1,
          action: "page",
        }),
        ...[false, true].map((filtersOpen) =>
          control(
            `${kind}-filters-${filtersOpen ? "open" : "closed"}`,
            `${label}手机筛选 / ${filtersOpen ? "收起" : "展开"}`,
            "#filters-toggle",
            base,
            [],
            { kind, filtersOpen, proposalOnly: true, widths: [390], action: "filters" },
          ),
        ),
      ];
    }),
    ...[false, true].map((open) =>
      control(
        `technical-${open ? "open" : "closed"}`,
        `技术详情 / ${open ? "收起" : "展开"}`,
        ".technical summary",
        "exports",
        open ? [] : ["1c008f867673db60.1"],
        { open, action: "technical" },
      ),
    ),
    control("reports", "前往报表工作台", "#reports", "normal", ["cd1df6927d5a68fd.1"], {
      action: "navigate",
      href: "/reports",
    }),
  ].map((c) => ({
    ...c,
    widths: c.widths || [1440, 390],
    states: c.disabledOnly
      ? ["disabled"]
      : [
          "default",
          "hover",
          "focus",
          "pressed",
          ...(c.busyScene ? ["busy"] : []),
          ...(c.disabledScene ? ["disabled"] : []),
        ],
  }));
  function prepare(id, variant = "default") {
    const c = controls.find((c) => c.id === id);
    if (!c || !c.states.includes(variant)) throw Error("Unknown control/state");
    api.scene(
      variant === "busy"
        ? c.busyScene
        : variant === "disabled"
          ? c.disabledScene || c.scene
          : c.scene,
    );
    if (c.filtersOpen !== undefined && api.state().filtersOpen !== c.filtersOpen)
      document.querySelector("#filters-toggle").click();
    if (c.open !== undefined) document.querySelector(".technical").open = c.open;
    // New review only: do not repeat the historical prototype's unsupported no-auto-retry claim.
    if (api.state().pageState === "rate_limited")
      document.querySelector(".paper.empty p").textContent = "本轮读取未成功，请稍后重新加载。";
    document.querySelector(".control-tools").open = false;
  }
  const picker = document.querySelector("#control-picker");
  for (const c of controls.filter((c) => c.widths.includes(innerWidth <= 760 ? 390 : 1440)))
    for (const state of c.states)
      picker.add(new Option(`${c.label} / ${state}`, `${c.id}:${state}`));
  document.querySelector("#control-show").onclick = () => {
    const [id, state] = picker.value.split(":");
    prepare(id, state);
    document
      .querySelector(controls.find((c) => c.id === id).selector)
      .scrollIntoView({ block: "center" });
  };
  window.ORG_DATA_CONTROLS_C = { controls, prepare };
  prepare("view-workspaces-selected");
})();
