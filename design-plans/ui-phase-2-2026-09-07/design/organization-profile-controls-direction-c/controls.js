/* Review adapter: parent layout/controller/data remain unchanged. No live requests. */
(() => {
  const basicStates = ["default", "hover", "focus", "pressed"];
  const controls = [
    {
      id: "save",
      actionId: "OG-PROFILE-SAVE",
      label: "保存并审计",
      selector: "#save-profile",
      scene: "editing",
      busyScene: "save_busy",
    },
    {
      id: "refresh",
      actionId: "OG-REFRESH",
      label: "刷新资料",
      selector: "#refresh-profile",
      scene: "normal",
      busyScene: "refreshing",
    },
    {
      id: "retry",
      actionId: "OG-RETRY",
      label: "服务错误后重读",
      selector: "#retry-profile",
      scene: "error",
    },
    ...["blocked", "expired", "forbidden", "rate_limited", "conflict_page"].map((scene) => ({
      id: `retry-${scene}`,
      actionId: "OG-RETRY",
      label: `重读 / ${scene}`,
      selector: "#retry-profile",
      scene,
    })),
    ...["identity", "profile-form", "summary"].flatMap((target) =>
      [false, true].map((selected) => ({
        id: `nav-${target}-${selected ? "selected" : "available"}`,
        actionId: "PROPOSAL-NAV",
        label: `目录 ${target} / ${selected ? "已选" : "可选"}`,
        selector: `.directory nav a[href='#${target}']`,
        scene: "normal",
        target,
        selected,
        proposalOnly: true,
      })),
    ),
    ...[
      ["identity", "normal", "#identity"],
      ["page", "refresh_error", "#page-feedback"],
      ["form", "save_error", "#form-feedback"],
    ].map(([id, scene, parent]) => ({
      id: `technical-${id}`,
      actionId: "PROPOSAL-TECH",
      label: `技术详情 / ${id}`,
      selector: `${parent} summary`,
      scene,
      proposalOnly: true,
    })),
    ...["save_error", "save_conflict"].map((scene) => ({
      id: scene,
      actionId: "OG-PROFILE-SAVE",
      label: `保存反馈 / ${scene}`,
      selector: "#save-profile",
      scene,
      context: true,
    })),
    ...["save_timeout", "write_read_failed"].map((scene) => ({
      id: scene,
      actionId: "PROPOSAL-RECHECK",
      label: `结果核验 / ${scene}`,
      selector: "#save-profile",
      scene,
      proposalOnly: true,
      disabledOnly: true,
      context: true,
    })),
    {
      id: "refresh-loading",
      actionId: "OG-REFRESH",
      label: "首次加载不能刷新",
      selector: "#refresh-profile",
      scene: "loading",
      disabledOnly: true,
    },
  ].map((control) => ({
    ...control,
    scope: control.proposalOnly
      ? "proposal-only-not-source-action"
      : "source-action-representative-or-variant",
    states: control.disabledOnly
      ? ["disabled"]
      : [...basicStates, ...(control.busyScene ? ["pending"] : [])],
  }));
  const select = document.getElementById("control-select");
  for (const c of controls) select.add(new Option(c.label, c.id));
  function prepare(id, mode = "default") {
    const c = controls.find((item) => item.id === id);
    if (!c) throw new Error("Unknown control");
    if (mode === "pending" && !c.busyScene) throw new Error("No pending presentation");
    window.ORG_PROFILE_C.scene(mode === "pending" ? c.busyScene : c.scene);
    document.body.dataset.controlOutcome = c.actionId === "PROPOSAL-RECHECK" ? "recheck" : "normal";
    if (c.target) {
      const target = c.selected ? c.target : c.target === "identity" ? "summary" : "identity";
      document.querySelector(`.directory nav a[href='#${target}']`).click();
    }
    select.value = id;
    document.getElementById("control-mode").value = mode;
    document.getElementById("control-note").textContent =
      `${c.label}：${c.proposalOnly ? "仅提案，不计为现有源码动作" : "现有动作的代表呈现"}。图稿未获审，不代表真实写入或生产状态。`;
  }
  document.getElementById("show-control").onclick = () => {
    const c = controls.find((item) => item.id === select.value);
    const mode = document.getElementById("control-mode").value;
    if (mode === "pending" && !c.busyScene) {
      document.getElementById("control-note").textContent =
        "没有该控件的在途呈现；不补造禁用或等待规则。";
      return;
    }
    prepare(c.id, mode);
    document.querySelector(c.selector).scrollIntoView({ block: "center" });
  };
  window.ORG_PROFILE_CONTROLS_C = { controls, prepare };
})();
