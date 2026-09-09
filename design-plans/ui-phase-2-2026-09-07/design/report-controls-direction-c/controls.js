/* Review adapter only: reuse the unchanged report layout, data and business controller. */
(() => {
  const id = (index) => window.REPORT_C_DATA.exports[index].id;
  const controls = [
    {
      actionId: "RP-CREATE",
      id: "create",
      label: "导出机会 CSV",
      selector: "[data-create]",
      scene: "opportunity",
      busyScene: "create_busy",
    },
    {
      actionId: "RP-TYPE",
      id: "type-opportunity",
      label: "切换机会报表",
      selector: "[data-type='opportunity']",
      scene: "trend",
      selected: false,
    },
    {
      actionId: "RP-TECH",
      id: "technical-page",
      label: "页面技术详情",
      selector: "#workspace .notice summary",
      scene: "download_error",
    },
    {
      actionId: "RP-LOAD",
      id: "reload",
      label: "服务错误后重载",
      selector: "[data-load]",
      scene: "error",
    },
    {
      actionId: "RP-REFRESH",
      id: "refresh",
      label: "刷新状态",
      selector: "[data-refresh]",
      scene: "opportunity",
      busyScene: "refreshing",
    },
    {
      actionId: "RP-TASKS",
      id: "tasks",
      label: "在任务中心查看",
      selector: "[data-tasks]",
      scene: "opportunity",
    },
    {
      actionId: "RP-DOWNLOAD",
      id: "download",
      label: "下载有效文件",
      selector: `[data-download='${id(0)}']`,
      scene: "opportunity",
      busyScene: "download_busy",
    },
    {
      actionId: "RP-REGENERATE",
      id: "regenerate-list",
      label: "列表重新生成过期文件",
      selector: `.export-row [data-regenerate='${id(2)}']`,
      scene: "opportunity",
      busyClick: true,
    },
    {
      actionId: "RP-DETAIL",
      id: "detail",
      label: "查看导出详情",
      selector: `[data-detail='${id(0)}']`,
      scene: "opportunity",
    },
    {
      actionId: "RP-CLOSE",
      id: "close",
      label: "关闭导出详情",
      selector: "#detail-close",
      scene: "detail_succeeded",
    },
  ];
  const variants = [
    ...["trend", "team"].map((type) => ({
      actionId: "RP-TYPE",
      id: `type-${type}`,
      label: `切换${window.REPORT_C_DATA.labels[type]}`,
      selector: `[data-type='${type}']`,
      scene: "opportunity",
      selected: false,
    })),
    ...["opportunity", "trend", "team"].map((type) => ({
      actionId: "RP-TYPE",
      id: `type-${type}-selected`,
      label: `已选${window.REPORT_C_DATA.labels[type]}`,
      selector: `[data-type='${type}']`,
      scene: type,
      selected: true,
    })),
    {
      actionId: "RP-TECH",
      id: "technical-detail",
      label: "详情错误码",
      selector: "#detail-content > details summary",
      scene: "detail_dead",
    },
    {
      actionId: "RP-REGENERATE",
      id: "regenerate-detail",
      label: "详情重新生成过期文件",
      selector: "#detail-footer [data-regenerate]",
      scene: "detail_expired",
      busyScene: "regenerate_busy",
    },
    {
      actionId: "RP-REGENERATE",
      id: "regenerate-list-dead",
      label: "列表重新生成最终失败记录",
      selector: `.export-row [data-regenerate='${id(0)}']`,
      scene: "detail_dead",
      closeModal: true,
      busyClick: true,
    },
    ...["expired", "forbidden", "rate_limited", "blocked"].map((scene) => ({
      actionId: "RP-LOAD",
      id: `reload-${scene}`,
      label: `重载：${window.REPORT_C.scenes[scene]}`,
      selector: "[data-load]",
      scene,
    })),
    ...["trend", "team"].map((type) => ({
      actionId: "RP-CREATE",
      id: `create-${type}`,
      label: `导出${window.REPORT_C_DATA.labels[type]} CSV`,
      selector: "[data-create]",
      scene: type,
      busyClick: true,
    })),
  ].map((control) => ({ ...control, variantKey: `P28-${control.id}` }));
  const all = [...controls, ...variants],
    select = document.getElementById("control-select");
  for (const c of all) select.add(new Option(c.label, c.id));
  function prepare(id, mode = "default") {
    const c = all.find((v) => v.id === id);
    if (!c) throw new Error("Unknown control");
    if (mode === "busy" && !c.busyScene && !c.busyClick)
      throw new Error("No source busy presentation");
    window.REPORT_C.scene(mode === "busy" && c.busyScene ? c.busyScene : c.scene);
    if (c.closeModal) document.getElementById("detail-close").click();
    if (mode === "busy" && c.busyClick) {
      window.REPORT_C.setMode("hold");
      document.querySelector(c.selector).click();
    }
    select.value = id;
    document.getElementById("control-mode").value = mode;
    document.getElementById("control-note").textContent =
      `${c.label}：仅核对既有源控件及声明变体；默认/悬停/键盘焦点/按下与“已选”分别核对。在途不代表真实请求，图稿不代表Vue或用户批准。`;
  }
  document.getElementById("show-control").onclick = () => {
    const c = all.find((v) => v.id === select.value),
      mode = document.getElementById("control-mode").value;
    if (mode === "busy" && !c.busyScene && !c.busyClick) {
      document.getElementById("control-note").textContent =
        "源码没有该控件的禁用/在途表现；不补造禁用规则。";
      return;
    }
    prepare(c.id, mode);
    document.querySelector(c.selector).scrollIntoView({ block: "center" });
  };
  window.REPORT_CONTROLS_C = { controls, variants, prepare };
})();
