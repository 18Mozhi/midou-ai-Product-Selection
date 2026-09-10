(() => {
  // Review-only copy revision. Keep the original r1 and approved first-failure image intact.
  const changes = [
    [".state-kicker", "查看权限提示"],
    [".parent-region h2", "当前无法查看审批内容"],
    [".state-copy", "当前权限还不能读取这些内容。权限调整后，可以重新加载。"],
    [".data-boundary", "审批内容目前未显示，不代表记录或模板为空。"],
  ];
  function soften() {
    if (!window.P34_PARENT_C.state().scene.endsWith("-permission-forbidden")) return;
    for (const [selector, copy] of changes) {
      const node = document.querySelector(selector);
      if (node && node.textContent !== copy) node.textContent = copy;
    }
  }
  new MutationObserver(soften).observe(document.getElementById("app"), {
    childList: true,
    subtree: true,
  });
  window.P34_PERMISSION_TONE_R2 = { changes, soften };
  window.P34_PARENT_C.show("background-permission-forbidden");
  soften();
})();
