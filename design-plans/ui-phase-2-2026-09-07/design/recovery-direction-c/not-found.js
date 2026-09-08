(() => {
  "use strict";
  const D = window.RECOVERY_C_DATA,
    $ = (s) => document.querySelector(s);
  const name = new URL(location.href).searchParams.get("case") || "home";
  const row = D.notFound[name] || D.notFound.home;
  const navigation = [];
  $("#requested-path").textContent = row.requestedPath;
  $("#requested-path").title = row.input.path;
  const primary = document.createElement("a");
  primary.href = "#recovery-intent";
  primary.className = "primary";
  primary.dataset.target = row.recent.fullPath;
  primary.textContent = row.distinct ? "返回最近页面" : "返回今日行动";
  $("#recovery-actions").append(primary);
  if (row.distinct) {
    const home = document.createElement("a");
    home.href = "#recovery-intent";
    home.dataset.target = "/home";
    home.textContent = "返回今日行动";
    $("#recovery-actions").append(home);
  }
  $("#destination").textContent = row.distinct
    ? `将返回：${row.recent.title}`
    : "将从今日行动重新进入业务流程";
  document.querySelectorAll("[data-target]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        navigation.push(a.dataset.target);
        $("#recovery-intent").hidden = false;
        $("#recovery-intent").textContent = "已记录返回意图；本离线稿不会进入业务页面。";
      }),
  );
  window.NOT_FOUND_C = { state: () => JSON.parse(JSON.stringify({ case: name, row, navigation })) };
  $("#not-found-title").focus();
})();
