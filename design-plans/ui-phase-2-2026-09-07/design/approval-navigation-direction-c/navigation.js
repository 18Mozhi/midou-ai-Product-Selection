(() => {
  "use strict";
  const dialog = document.getElementById("detail-dialog");
  let header = null,
    directory = null;
  function sync() {
    if (!header?.isConnected || !directory?.isConnected) return;
    const height = header.getBoundingClientRect().height;
    const top = height + 8;
    const offset = top + (innerWidth <= 780 ? directory.getBoundingClientRect().height : 0) + 16;
    for (const [name, value] of [
      ["--approval-reading-top", top],
      ["--approval-target-offset", offset],
    ]) {
      if (dialog.style.getPropertyValue(name) !== `${value}px`)
        dialog.style.setProperty(name, `${value}px`);
    }
  }
  const resize = new ResizeObserver(sync);
  function connect() {
    const nextHeader = dialog.querySelector(".detail-header"),
      nextDirectory = dialog.querySelector(".detail-index");
    if (nextHeader !== header || nextDirectory !== directory) {
      resize.disconnect();
      header = nextHeader;
      directory = nextDirectory;
      if (header) resize.observe(header);
      if (directory) resize.observe(directory);
    }
    sync();
  }
  new MutationObserver(connect).observe(dialog, { childList: true });
  addEventListener("resize", sync);
  connect();
  window.APPROVAL_NAVIGATION_C = { sync: connect };
})();
