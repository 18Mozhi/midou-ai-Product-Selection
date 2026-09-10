(() => {
  const api = window.ORG_APPROVALS_C,
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
    control("refresh", "OG-REFRESH", "刷新数据", "#refresh", "normal", [], {
      busyScene: "refreshing",
      parentControl: true,
    }),
    control("refresh-loading", "OG-REFRESH", "首次读取禁用刷新", "#refresh", "loading", [], {
      disabledOnly: true,
      parentControl: true,
    }),
    ...["error", "forbidden", "expired", "rate_limited"].map((s) =>
      control(`retry-${s}`, "OG-RETRY", `重新加载 / ${s}`, "#retry", s, [], {
        parentControl: true,
      }),
    ),
    ...[
      ["requests", "审批记录", "00f81ad5e8a2f732.1"],
      ["templates", "模板版本", "86f59f25b64551b6.1"],
    ].flatMap(([view, label, signature]) =>
      [false, true].map((selected) =>
        control(
          `view-${view}-${selected ? "selected" : "available"}`,
          "OG-A-VIEW",
          `${label} / ${selected ? "已选" : "未选"}`,
          `[data-view="${view}"]`,
          selected === (view === "requests") ? "normal" : "templates",
          selected ? [] : [signature],
          { selected, view },
        ),
      ),
    ),
    ...[
      [
        "request",
        "审批",
        "f376017b5e1818c0.1",
        "184674807c82ee93.1",
        "3169b6613d3ce948.1",
        "1c008f867673db60.1",
      ],
      [
        "template",
        "模板",
        "2a3781fdd41e7df6.1",
        "0b242741fe22e1a9.1",
        "0ab42724896b9cf9.1",
        "1c008f867673db60.2",
      ],
    ].flatMap(([kind, label, reset, prev, next, tech]) => {
      const base = kind === "request" ? "normal" : "template_catalog";
      return [
        control(
          `${kind}-reset`,
          `OG-A-${kind.toUpperCase()}-FILTER`,
          `${label}重置`,
          "#reset",
          `${kind}_search`,
          [reset],
          { kind, filtersOpen: true },
        ),
        control(
          `${kind}-clear-empty`,
          `OG-A-${kind.toUpperCase()}-FILTER`,
          `${label}空结果清筛选`,
          "#clear-filter",
          `${kind}_filter_empty`,
          [],
          { kind, proposalOnly: true },
        ),
        control(
          `${kind}-previous`,
          `OG-A-${kind.toUpperCase()}-FILTER`,
          `${label}上一页`,
          '[data-page="-1"]',
          `${kind}_page_two`,
          [prev],
          { kind, delta: -1, disabledScene: base },
        ),
        control(
          `${kind}-next`,
          `OG-A-${kind.toUpperCase()}-FILTER`,
          `${label}下一页`,
          '[data-page="1"]',
          base,
          [next],
          { kind, delta: 1, disabledScene: `${kind}_page_two` },
        ),
        ...[false, true].map((open) =>
          control(
            `${kind}-technical-${open ? "open" : "closed"}`,
            "OG-TECH",
            `${label}技术详情 / ${open ? "收起" : "展开"}`,
            ".technical summary",
            kind === "request" ? "normal" : "templates",
            open ? [] : [tech],
            { open },
          ),
        ),
        ...[false, true].map((filtersOpen) =>
          control(
            `${kind}-filters-${filtersOpen ? "open" : "closed"}`,
            "PROPOSAL-FILTERS",
            `${label}手机筛选 / ${filtersOpen ? "收起" : "展开"}`,
            "#filters-toggle",
            base,
            [],
            { kind, filtersOpen, proposalOnly: true, widths: [390] },
          ),
        ),
      ];
    }),
    control(
      "select",
      "OG-A-SELECT",
      "选择另一模板",
      '[data-select][aria-pressed="false"]',
      "template_catalog",
      ["f6777d94811ef9af.1"],
      { selected: false },
    ),
    control(
      "select-current",
      "OG-A-SELECT",
      "当前模板已选",
      '[data-select][aria-pressed="true"]',
      "template_catalog",
      [],
      { selected: true },
    ),
    control(
      "select-archived",
      "OG-A-SELECT",
      "归档模板仍可阅读",
      '[data-select][aria-pressed="true"]',
      "template_archived",
      [],
      { selected: true },
    ),
    control(
      "back-directory",
      "PROPOSAL-BACK",
      "手机返回模板目录",
      "#back-directory",
      "template_page_two",
      [],
      { proposalOnly: true, widths: [390] },
    ),
    control(
      "approvals",
      "OG-A-LINK",
      "前往审批工作台",
      "a[href='/tasks/approvals']",
      "normal",
      ["cb237b82e3d08902.1"],
      { href: "/tasks/approvals" },
    ),
    control(
      "audit",
      "OG-A-LINK",
      "查看组织审计",
      "a[href='/org-admin/audit']",
      "normal",
      ["a8c2e662cd00ee63.1"],
      { href: "/org-admin/audit" },
    ),
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
    const c = controls.find((item) => item.id === id);
    if (!c || !c.states.includes(variant)) throw Error("Unknown control/state");
    api.scene(
      variant === "busy"
        ? c.busyScene
        : variant === "disabled"
          ? c.disabledScene || c.scene
          : c.scene,
    );
    if (c.filtersOpen !== undefined && api.state().filtersOpen !== c.filtersOpen)
      $("#filters-toggle").click();
    if (c.open !== undefined) $(".technical").open = c.open;
    $(".control-tools").open = false;
  }
  const picker = $("#control-picker");
  for (const c of controls.filter((c) => c.widths.includes(innerWidth <= 760 ? 390 : 1440)))
    for (const state of c.states)
      picker.add(new Option(`${c.label} / ${state}`, `${c.id}:${state}`));
  $("#control-show").onclick = () => {
    const [id, state] = picker.value.split(":");
    prepare(id, state);
    $(controls.find((c) => c.id === id).selector)?.scrollIntoView({ block: "center" });
  };
  window.ORG_APPROVAL_CONTROLS_C = { controls, prepare };
  prepare("select-current");
})();
