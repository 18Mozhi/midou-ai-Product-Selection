(() => {
  const primary = (id, actionId, label, selector, scene, extra = {}) => ({
    id,
    actionId,
    label,
    selector,
    scene,
    primary: true,
    ...extra,
  });
  const variant = (id, actionId, label, selector, scene, extra = {}) => ({
    id,
    actionId,
    label,
    selector,
    scene,
    ...extra,
  });
  const controls = [
    primary("refresh", "OG-REFRESH", "刷新工作区", "#refresh", "normal", {
      busyScene: "refreshing",
    }),
    primary("retry", "OG-RETRY", "服务错误后重读", "#retry", "error"),
    primary(
      "reason-archive-confirm",
      "D-OG-REASON",
      "归档原因确认",
      "#reason-confirm",
      "reason_archive",
      { disabledScene: "reason_short" },
    ),
    primary("open", "OG-W-OPEN", "头部打开创建", ".head-actions [data-create]", "normal", {
      busyScene: "action_busy",
    }),
    primary("create", "OG-W-CREATE", "创建并写入审计", "#create-submit", "create_draft", {
      busyScene: "create_busy",
    }),
    primary("cancel-create", "OG-W-CANCEL", "取消创建草稿", "#cancel-create", "create_draft", {
      disabledScene: "create_busy",
    }),
    primary("status-all", "OG-W-STATUS-ALL", "全部 / 未选", "[data-status='all']", "active", {
      selected: false,
    }),
    primary(
      "status-active",
      "OG-W-STATUS-ACTIVE",
      "正常 / 未选",
      "[data-status='active']",
      "catalog",
      { selected: false },
    ),
    primary(
      "status-archived",
      "OG-W-STATUS-ARCHIVED",
      "归档 / 未选",
      "[data-status='archived']",
      "catalog",
      { selected: false },
    ),
    primary("reset", "OG-W-RESET", "重置筛选", ".filter-fields [data-reset]", "search"),
    primary(
      "clear-empty",
      "OG-W-CLEAR-EMPTY",
      "空结果清筛选",
      ".empty [data-reset]",
      "filter_empty",
    ),
    primary(
      "select",
      "OG-W-SELECT",
      "选择另一工作区",
      ".workspace-list li:nth-child(2) button",
      "catalog",
      { selected: false },
    ),
    primary("previous", "OG-W-PREVIOUS", "上一页", ".pagination button:first-child", "page_two", {
      disabledScene: "catalog",
    }),
    primary("next", "OG-W-NEXT", "下一页", ".pagination button:last-child", "catalog", {
      disabledScene: "page_two",
    }),
    primary("archive", "OG-W-STATE", "归档非默认工作区", "#state-action", "selected", {
      busyScene: "action_busy",
    }),
    primary(
      "teams",
      "OG-W-TEAMS",
      "管理团队与成员",
      "a[data-route][href='/org-admin/teams']",
      "selected",
    ),
    primary(
      "profile",
      "OG-W-PROFILE",
      "修改默认工作区",
      "a[data-route][href='/org-admin']",
      "normal",
    ),
    primary("technical", "OG-W-TECH", "展开技术详情", "#technical summary", "normal"),
    variant("open-empty", "OG-W-OPEN", "空目录创建入口", ".empty [data-create]", "empty"),
    variant("refresh-loading", "OG-REFRESH", "首次读取不可刷新", "#refresh", "loading", {
      disabledOnly: true,
    }),
    ...["blocked", "expired", "forbidden", "rate_limited"].map((scene) =>
      variant(`retry-${scene}`, "OG-RETRY", `重读 / ${scene}`, "#retry", scene),
    ),
    ...[
      ["all", "catalog", "OG-W-STATUS-ALL"],
      ["active", "active", "OG-W-STATUS-ACTIVE"],
      ["archived", "archived", "OG-W-STATUS-ARCHIVED"],
    ].map(([key, scene, actionId]) =>
      variant(
        `status-${key}-selected`,
        actionId,
        `${key} / 已选`,
        `[data-status='${key}']`,
        scene,
        { selected: true },
      ),
    ),
    variant(
      "select-current",
      "OG-W-SELECT",
      "当前工作区 / 已选",
      ".workspace-list button[aria-pressed='true']",
      "selected",
      { selected: true },
    ),
    variant("restore", "OG-W-STATE", "恢复归档工作区", "#state-action", "restore"),
    variant("default-protected", "OG-W-STATE", "默认工作区保护", "#state-action", "normal", {
      disabledOnly: true,
    }),
    variant("technical-open", "OG-W-TECH", "收起技术详情", "#technical summary", "technical"),
    variant(
      "reason-restore-confirm",
      "D-OG-REASON",
      "恢复原因确认",
      "#reason-confirm",
      "reason_restore",
    ),
    ...["archive", "restore"].flatMap((kind) =>
      ["cancel", "close"].map((action) =>
        variant(
          `reason-${kind}-${action}`,
          "D-OG-REASON",
          `${kind === "archive" ? "归档" : "恢复"} / ${action === "cancel" ? "取消" : "关闭"}`,
          `#reason-${action}`,
          `reason_${kind}`,
        ),
      ),
    ),
  ].map((c) => ({
    ...c,
    scope: c.primary
      ? "representative-control-only-not-all-variants-or-Vue"
      : "additional-control-variant-not-new-action",
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
  const selector = document.querySelector("#control-select");
  for (const c of controls) selector.add(new Option(c.label, c.id));
  function prepare(id, state = "default") {
    const c = controls.find((c) => c.id === id);
    if (!c) throw Error("Unknown control");
    if (!c.states.includes(state)) throw Error("Unsupported state");
    window.WORKSPACES_C.scene(
      state === "busy" ? c.busyScene : state === "disabled" ? c.disabledScene || c.scene : c.scene,
    );
    document.body.dataset.reasonKind =
      (state === "disabled" ? c.disabledScene : c.scene) === "reason_restore"
        ? "restore"
        : "archive";
    document.querySelector("#control-select").value = id;
    document.querySelector("#control-mode").value = ["busy", "disabled"].includes(state)
      ? state
      : "default";
    document.querySelector("#control-note").textContent =
      `${c.label}：${state}。只审控件；原稿字段锁定/原因上限/未知结果保护仍是提案，不等于真实Vue规则。`;
    // Keep review mechanics collapsed in business screenshots.
    document.querySelector(".control-tools").open = false;
  }
  document.querySelector("#show-control").onclick = () => {
    const c = controls.find((c) => c.id === selector.value),
      mode = document.querySelector("#control-mode").value;
    if (!c.states.includes(mode)) {
      document.querySelector("#control-note").textContent = "此控件没有该状态，不补造禁用或等待。";
      return;
    }
    prepare(c.id, mode);
    document.querySelector(c.selector).scrollIntoView({ block: "center" });
  };
  window.WORKSPACE_CONTROLS_C = { controls, prepare };
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest("#state-action")) {
        const current = window.WORKSPACES_C.state();
        const item = current.items.find((row) => row.id === current.selectedId);
        document.body.dataset.reasonKind = item?.status === "archived" ? "restore" : "archive";
      }
    },
    true,
  );
  prepare("archive");
})();
