/* Exact offline control targets, not a claim that a semantic group has only one button. */
(() => {
  const rows = [
    [
      "workspace-quality",
      "DG54-VIEW",
      "page",
      "#quality-view",
      "records:default",
      "",
      "",
      "",
      true,
    ],
    ["workspace-records", "DG54-VIEW", "page", "#records-view", "quality:default"],
    [
      "entity-opportunities",
      "DG54-ENTITY",
      "records",
      '[data-entity="opportunities"]',
      "records:default",
      "records:scope-pending",
      "",
      "",
      true,
    ],
    ["entity-trends", "DG54-ENTITY", "records", '[data-entity="trends"]', "records:suppliers"],
    [
      "entity-competitors",
      "DG54-ENTITY",
      "records",
      '[data-entity="competitors"]',
      "records:default",
    ],
    ["entity-suppliers", "DG54-ENTITY", "records", '[data-entity="suppliers"]', "records:default"],
    [
      "filter-apply",
      "DG54-FILTER",
      "records",
      "#apply",
      "records:default",
      "",
      "",
      "filter-mobile",
      true,
    ],
    [
      "filter-reset",
      "DG54-FILTER",
      "records",
      "#reset",
      "records:query-draft",
      "records:default",
      "",
      "filter-mobile",
    ],
    ["filter-close", "DG54-FILTER", "records", "#filter-dialog [data-close]", "records:filter"],
    [
      "export-open",
      "DG54-EXPORT",
      "records",
      "#export-open",
      "records:default",
      "records:scope-error",
      "records:export-running",
      "",
      true,
    ],
    [
      "export-submit",
      "DG54-EXPORT",
      "records",
      "#export-submit",
      "records:export",
      "records:export-empty",
    ],
    [
      "export-cancel",
      "DG54-EXPORT",
      "records",
      "#export-dialog footer [data-close]",
      "records:export",
    ],
    ["record-retry", "DG54-LOAD", "records", "#retry", "records:error", "", "", "", true],
    [
      "record-technical",
      "DG54-TECH",
      "records",
      "#record-tech summary",
      "records:detail",
      "",
      "",
      "",
      true,
    ],
    [
      "record-next",
      "DG54-PAGE",
      "records",
      "#next",
      "records:page-21",
      "records:page-two",
      "",
      "",
      true,
    ],
    ["record-previous", "DG54-PAGE", "records", "#previous", "records:page-two", "records:page-21"],
    ["quality-retry", "Q54-LOAD", "quality", "#retry", "quality:error", "", "", "", true],
    [
      "quality-issues",
      "Q54-TAB",
      "quality",
      '[data-tab="issues"]',
      "quality:default",
      "",
      "",
      "",
      true,
    ],
    ["quality-evidence", "Q54-TAB", "quality", '[data-tab="evidence"]', "quality:issues"],
    ["quality-runs", "Q54-TAB", "quality", '[data-tab="runs"]', "quality:default"],
    [
      "evidence-lineage",
      "Q54-EVIDENCE",
      "quality",
      "#full-lineage",
      "quality:evidence-detail",
      "",
      "",
      "",
      true,
    ],
    ["evidence-close", "Q54-EVIDENCE", "quality", "#close-dialog", "quality:lineage"],
    ["issue-evidence", "Q54-EVIDENCE", "quality", "#issue-evidence", "quality:issue-detail"],
    [
      "download-submit",
      "Q54-DOWNLOAD",
      "quality",
      "#grant-submit",
      "quality:download-ready",
      "quality:download-unknown",
      "quality:download-busy",
      "",
      true,
    ],
    ["download-cancel", "Q54-DOWNLOAD", "quality", "#cancel", "quality:download-ready"],
    [
      "issue-technical",
      "Q54-TECH",
      "quality",
      ".technical summary",
      "quality:issue-technical",
      "",
      "",
      "",
      true,
    ],
    [
      "evidence-technical",
      "Q54-TECH",
      "quality",
      ".technical summary",
      "quality:lineage-technical",
    ],
    ["run-drill", "Q54-RUN", "quality", "#drill-0", "quality:runs", "", "", "", true],
    ["run-clear", "Q54-RUN", "quality", "#clear-run", "quality:run-match"],
    [
      "batch-submit",
      "Q54-BATCH",
      "quality",
      "#submit",
      "quality:batch-ready",
      "quality:batch-confirm",
      "quality:batch-busy",
      "",
      true,
    ],
    [
      "batch-preview",
      "Q54-BATCH",
      "quality",
      "#preview",
      "quality:batch-attribute",
      "quality:batch-no-member",
    ],
    [
      "batch-back",
      "Q54-BATCH",
      "quality",
      "#back-form",
      "quality:batch-ready",
      "quality:batch-busy",
    ],
    [
      "batch-cancel",
      "Q54-BATCH",
      "quality",
      "#cancel",
      "quality:batch-ready",
      "quality:batch-busy",
    ],
    [
      "issue-select",
      "Q54-SELECT",
      "quality",
      '[data-select="00000000-0000-4000-8000-000000000a62"]',
      "quality:issues",
      "quality:issue-resolved",
      "",
      "close-resolved-detail",
      true,
    ],
    [
      "resolve-submit",
      "Q54-RESOLVE",
      "quality",
      "#submit",
      "quality:resolve-ready",
      "quality:resolve-confirm",
      "quality:resolve-busy",
      "",
      true,
    ],
    [
      "resolve-preview",
      "Q54-RESOLVE",
      "quality",
      "#preview",
      "quality:resolve-valid",
      "quality:resolve-short",
    ],
    [
      "resolve-back",
      "Q54-RESOLVE",
      "quality",
      "#back-form",
      "quality:resolve-ready",
      "quality:resolve-busy",
    ],
    ["resolve-cancel", "Q54-RESOLVE", "quality", "#cancel", "quality:resolve-valid"],
    [
      "quality-next",
      "Q54-PAGE",
      "quality",
      "#next",
      "quality:page-first",
      "quality:page-last",
      "quality:page-wait",
      "",
      true,
    ],
    [
      "quality-previous",
      "Q54-PAGE",
      "quality",
      "#previous",
      "quality:page-last",
      "quality:page-first",
    ],
  ];
  const controls = rows.map(
    ([
      id,
      actionId,
      scope,
      localSelector,
      scene,
      disabledScene = "",
      busyScene = "",
      preparation = "",
      primary = false,
    ]) => ({
      id,
      actionId,
      scope,
      localSelector,
      selector: scope === "page" ? localSelector : `#${scope}-pane ${localSelector}`,
      scene,
      disabledScene,
      busyScene,
      preparation,
      primary,
      states: [
        "default",
        "hover",
        "focus",
        "pressed",
        ...(disabledScene ? ["disabled"] : []),
        ...(busyScene ? ["busy"] : []),
      ],
      scopeBoundary: "listed-control-variant-only-not-all-dynamic-rows-or-Vue",
    }),
  );
  const C = window.DATA_COMPOSED_C;
  for (const root of Object.values(C.roots)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "../data-controls-direction-c/control-overrides.css";
    root.append(link);
  }
  function prepare(id, state = "default") {
    const control = controls.find((c) => c.id === id);
    if (!control || !control.states.includes(state)) throw Error("Unlisted control/state");
    C.scene(
      state === "disabled"
        ? control.disabledScene
        : state === "busy"
          ? control.busyScene
          : control.scene,
    );
    const root = control.scope === "page" ? document : C.roots[control.scope];
    if (control.preparation === "filter-mobile" && innerWidth <= 760)
      root.querySelector("#open-filter").click();
    if (control.preparation === "close-resolved-detail" && state === "disabled")
      root.querySelector("#close-dialog").click();
    const targets = [...root.querySelectorAll(control.localSelector)].filter((n) =>
      n.checkVisibility(),
    );
    if (targets.length !== 1) throw Error(`Expected one ${id}, got ${targets.length}`);
    targets[0].scrollIntoView({ block: "center" });
    return {
      id,
      state,
      scene:
        state === "disabled"
          ? control.disabledScene
          : state === "busy"
            ? control.busyScene
            : control.scene,
    };
  }
  const box = document.createElement("details");
  box.className = "review-controls";
  box.innerHTML =
    '<summary>逐控件审核（非业务界面）</summary><label>定位控件<select id="control-picker"></select></label><label>状态情境<select id="control-state"><option value="default">正常（悬停/焦点/按下请直接操作控件）</option><option value="disabled">不可操作</option><option value="busy">请求处理中</option></select></label><button id="locate-control">显示并定位</button><p>控件禁用可能是新稿保护，不代表源Vue已有。悬停和按下使用真实指针；不向业务写入。完整图片见本批图册。</p>';
  document.body.append(box);
  const picker = box.querySelector("#control-picker");
  picker.innerHTML = controls
    .map((c) => `<option value="${c.id}">${c.actionId} / ${c.id}</option>`)
    .join("");
  const statePicker = box.querySelector("#control-state");
  const update = () => {
    const c = controls.find((v) => v.id === picker.value);
    for (const option of statePicker.options) option.disabled = !c.states.includes(option.value);
    statePicker.value = "default";
  };
  picker.onchange = update;
  box.querySelector("#locate-control").onclick = () => {
    box.open = false;
    prepare(picker.value, statePicker.value);
  };
  update();
  window.DATA_CONTROL_REVIEW_C = { controls, prepare };
})();
