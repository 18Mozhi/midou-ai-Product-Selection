/* Local navigation review adapter. Original facts/controller remain unchanged. */
(() => {
  "use strict";
  const base = window.NOTIFICATION_C;
  const controls = [
    {
      id: "preferences-open",
      actionId: "AN-N-PREF-OPEN",
      selector: "#preferences-open",
      scene: "normal",
      label: "通知偏好入口",
      disabledScene: "all_read_busy",
    },
    ...["all", "task", "approval", "competitor", "system"].map((key) => ({
      id: `category-${key}`,
      actionId: "AN-N-FILTER-CATEGORY",
      selector: `#category-${key}`,
      scene: key === "all" ? "category_approval" : "normal",
      label: `分类 ${key}`,
      selected: true,
    })),
    ...["all", "open", "in_progress", "closed"].map((key) => ({
      id: `status-${key}`,
      actionId: "AN-N-FILTER-STATUS",
      selector: `#status-${key}`,
      scene: key === "all" ? "workflow_open" : "normal",
      label: `处理状态 ${key}`,
      selected: true,
    })),
    ...[false, true].map((checked) => ({
      id: `unread-${checked ? "on" : "off"}`,
      actionId: "AN-N-UNREAD",
      selector: "#unread-filter",
      target: ".check",
      scene: checked ? "unread" : "normal",
      label: checked ? "仅未读 已勾选" : "仅未读 未勾选",
      selected: true,
    })),
    ...["error", "forbidden", "expired", "rate_limited", "version_conflict"].map((scene) => ({
      id: `retry-${scene}`,
      actionId: "AN-N-LOAD",
      selector: "#retry-read",
      scene,
      label: `重新加载 ${scene}`,
    })),
    ...[false, true].map((unread) => ({
      id: `row-${unread ? "unread" : "read"}`,
      actionId: "AN-N-DETAIL",
      selector: "[data-open]",
      scene: unread ? "unread" : "normal",
      label: unread ? "未读消息 自动read" : "已读消息 详情",
      ...(unread ? {} : { disabledScene: "all_read_busy" }),
    })),
    {
      id: "previous",
      actionId: "AN-N-PAGE",
      selector: "#previous",
      scene: "pagination",
      pageTwo: true,
      disabledScene: "pagination",
      label: "上一页 / 首页禁用",
    },
    {
      id: "next",
      actionId: "AN-N-PAGE",
      selector: "#next",
      scene: "pagination",
      disabledScene: "pagination",
      disabledPageTwo: true,
      label: "下一页 / 末页禁用",
    },
    {
      id: "detail-close",
      actionId: "AN-N-CLOSE-DETAIL",
      selector: "#detail-close",
      scene: "detail",
      disabledScene: "start_busy",
      label: "关闭详情 / 等待时禁用",
    },
    {
      id: "source",
      actionId: "AN-N-SOURCE",
      selector: "#source-link",
      scene: "detail",
      label: "返回业务来源",
    },
    {
      id: "technical",
      actionId: "AN-N-TECH-RESOURCE",
      selector: "#technical summary",
      scene: "detail",
      label: "资源技术详情",
    },
    {
      id: "preferences-cancel",
      actionId: "AN-N-PREF-CLOSE",
      selector: "#preferences-cancel",
      scene: "preferences",
      label: "取消偏好",
    },
    {
      id: "preferences-close",
      actionId: "AN-N-PREF-CLOSE",
      selector: "#preferences-close",
      scene: "preferences",
      label: "偏好关闭图标（提案额外入口）",
      proposalOnly: true,
    },
  ];
  function enhance() {
    // Native checkbox focus extends to its entire clickable label, without moving focus.
    document.querySelector(".check")?.setAttribute("data-review-control", "unread");
  }
  function prepare(id, disabled = false) {
    const c = controls.find((v) => v.id === id);
    if (!c || (disabled && !c.disabledScene)) throw Error("Unknown control/state");
    base.scene(disabled ? c.disabledScene : c.scene);
    if (disabled ? c.disabledPageTwo : c.pageTwo) document.querySelector("#next").click();
    document.querySelector("#navigation-picker").value = id;
    enhance();
  }
  document.querySelector("#navigation-picker").innerHTML = controls
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");
  document.querySelector("#navigation-prepare").onclick = () =>
    prepare(document.querySelector("#navigation-picker").value);
  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target.closest("button,input");
      if (!trigger?.id || !trigger.closest("#app")) return;
      const id = trigger.id;
      queueMicrotask(() => {
        if (trigger.isConnected || document.querySelector("dialog[open]")) return;
        const replacement = document.getElementById(id);
        if (replacement && !replacement.disabled) replacement.focus();
      });
    },
    true,
  );
  window.NOTIFICATION_NAVIGATION_C = { controls, prepare };
})();
