/* Review-only adapter: reuses the unchanged P27 C-r1 layout, fixtures and controller. */
(() => {
  const controls = [
    {
      actionId: "AR-CREATE",
      id: "create",
      label: "创建规则",
      selector: "#create-rule",
      scene: "normal",
      busyScene: "pause_busy",
    },
    { actionId: "AR-LOAD", id: "reload", label: "重新加载", selector: "#retry", scene: "error" },
    {
      actionId: "AR-DETAIL",
      id: "detail",
      label: "查看执行记录",
      selector: "[data-detail]",
      scene: "normal",
      busyScene: "pause_busy",
    },
    {
      actionId: "AR-EDIT",
      id: "edit",
      label: "编辑规则",
      selector: "[data-edit]",
      scene: "normal",
      busyScene: "pause_busy",
    },
    {
      actionId: "AR-STATUS",
      id: "status",
      label: "暂停规则",
      selector: "[data-status]",
      scene: "normal",
      busyScene: "pause_busy",
    },
    {
      actionId: "AR-DETAIL-CLOSE",
      id: "detail-close",
      label: "关闭执行记录",
      selector: "#execution-close",
      scene: "detail",
    },
    {
      actionId: "AR-TASK",
      id: "task",
      label: "关联人工任务",
      selector: "[data-detail-link][href^='/tasks/']",
      scene: "execution_task",
    },
    {
      actionId: "AR-NOTIFICATION",
      id: "notification",
      label: "触发通知与来源",
      selector: "[data-detail-link][href^='/notifications']",
      scene: "detail",
    },
    {
      actionId: "AR-TECH",
      id: "technical",
      label: "技术详情",
      selector: "#execution-tech-0 summary",
      scene: "execution_task",
    },
    {
      actionId: "AR-TEMPLATE",
      id: "template",
      label: "审批超时模板",
      selector: "[data-template='0']",
      scene: "template_overdue",
    },
    {
      actionId: "AR-SAMPLE",
      id: "sample",
      label: "查看预览样本",
      selector: "[data-preview-link]",
      scene: "preview_samples",
    },
    {
      actionId: "AR-EDITOR-CLOSE",
      id: "cancel",
      label: "取消编辑器",
      selector: "#cancel",
      scene: "create",
    },
    {
      actionId: "AR-PREVIEW",
      id: "preview",
      label: "只读试运行",
      selector: "#preview",
      scene: "preview",
      busyScene: "preview_busy",
    },
    {
      actionId: "AR-SAVE",
      id: "save",
      label: "创建并启用",
      selector: "#save",
      scene: "create_intent",
      busyScene: "create_busy",
    },
  ];
  const select = document.getElementById("control-select");
  for (const c of controls) select.add(new Option(c.label, c.id));
  function prepare(id, mode = "default") {
    const control = controls.find((c) => c.id === id);
    if (!control) throw new Error("Unknown control");
    if (mode === "busy" && !control.busyScene) throw new Error("No source busy presentation");
    window.AUTOMATION_C.scene(mode === "busy" ? control.busyScene : control.scene);
    select.value = id;
    document.getElementById("control-mode").value = mode;
    document.getElementById("control-note").textContent =
      `${control.label}：${mode === "busy" ? "由既有在途场景呈现；不是新增禁用规则" : "直接核对实际按钮的默认、悬停、键盘焦点和按下"}。本包代表控件，不等于全部规则行、模板、错误状态或真实Vue通过。`;
  }
  document.getElementById("show-control").onclick = () => {
    const c = controls.find((v) => v.id === select.value);
    const mode = document.getElementById("control-mode").value;
    if (mode === "busy" && !c.busyScene) {
      document.getElementById("control-note").textContent =
        "该控件当前源码没有在途禁用呈现；不补造禁用状态。";
      return;
    }
    prepare(c.id, mode);
    document.querySelector(c.selector)?.scrollIntoView({ block: "center" });
  };
  window.AUTOMATION_CONTROLS_C = { controls, prepare };
})();
