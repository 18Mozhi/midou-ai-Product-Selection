(() => {
  "use strict";
  const data = window.PERMISSION_C_DATA;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const $ = (s) => document.querySelector(s);
  const op = "platform_operations_admin",
    security = "platform_security_admin",
    superRole = "platform_super_admin";
  const scenes = {
    default: "默认 · 运营与安全的六项差异",
    all: "运营与安全 · 显示全部并集",
    "same-differences": "同一角色 · 没有差异",
    "same-all": "同一角色 · 显示三项能力",
    "super-operations": "超级与运营 · 四项差异",
    "super-operations-all": "超级与运营 · 七项并集",
    reverse: "左右交换 · 归属随角色变化",
    "code-search": "权限编码 · 大小写与首尾空格",
    "name-search": "名称搜索 · 管理",
    "group-security": "安全治理分组",
    "group-collection": "采集治理分组",
    "group-reports": "通知与报表分组",
    combined: "搜索与分组联合筛选",
    "no-match": "搜索无匹配 · 重置可用",
    "unknown-group": "URL 中已不存在的分组",
    "group-platform": "平台治理分组",
    "single-role": "合成边界 · 仅有超级管理员",
    "single-role-all": "单角色 · 查看全部七项",
    "single-reset": "源码边界 · 单角色重置后默认角色缺失",
    "empty-capabilities": "合成边界 · 两角色无能力",
    "unknown-capabilities": "合成边界 · 未知能力与重复兜底名称",
    "long-content": "合成长角色名与说明 · 不截断",
    "role-descriptions": "移动角色说明 · 展开阅读",
    loading: "首次读取 · 加载占位",
    empty: "目录读取成功 · 零角色",
    error: "首次读取失败 · 重试",
    timeout: "首次读取超过12秒",
    forbidden: "首次读取 · 权限错误",
    expired: "首次读取 · 会话错误",
    refreshing: "刷新中 · 保留上次矩阵",
    "refresh-error": "刷新失败 · 旧矩阵与旧时间",
    "refresh-timeout": "刷新超时 · 旧矩阵保留",
    "refresh-forbidden": "刷新权限错误 · 源码仍保留旧矩阵",
    "refresh-expired": "刷新会话错误 · 源码仍保留旧矩阵",
    "refresh-selection": "读取中切换比较角色",
    refreshed: "读取恢复成功 · 时间更新",
    "url-restored": "URL 初始化 · 五条件及其他参数",
    "url-invalid": "URL 角色不存在 · 回退首两项",
    "query-boundary": "搜索80字上限 · 合成边界",
    "reset-disabled": "仅改变角色和全部开关 · 重置禁用",
    hover: "刷新按钮 · 悬停",
    focus: "刷新按钮 · 键盘焦点",
    pressed: "刷新按钮 · 按下",
    "review-tool": "非业务审核场景工具",
  };
  const sourceCase = Object.fromEntries(data.cases.map((c) => [c.key, c]));
  let s,
    pending = null,
    sequence = 0;
  const refs = () => ({
    compareLeft: s.left,
    compareRight: s.right,
    differencesOnly: s.only,
    capabilityQuery: s.query,
    capabilityGroup: s.group,
  });
  const label = (code) => data.capabilityLabels[code]?.label ?? "其他平台权限";
  const group = (code) => data.capabilityLabels[code]?.group ?? "其他能力";
  const chosen = () => ({
    left: s.roles.find((r) => r.code === s.left),
    right: s.roles.find((r) => r.code === s.right),
  });
  const union = () => [
    ...new Set([...(chosen().left?.capabilities ?? []), ...(chosen().right?.capabilities ?? [])]),
  ];
  const filters = () => Number(Boolean(s.query.trim())) + Number(Boolean(s.group));
  function comparison() {
    const pair = chosen(),
      left = new Set(pair.left?.capabilities ?? []),
      right = new Set(pair.right?.capabilities ?? []);
    return union()
      .sort((a, b) => label(a).localeCompare(label(b), "zh-CN"))
      .map((capability) => ({
        capability,
        label: label(capability),
        group: group(capability),
        left: left.has(capability),
        right: right.has(capability),
        difference:
          left.has(capability) === right.has(capability)
            ? "两者相同"
            : left.has(capability)
              ? `仅${pair.left?.name ?? "左侧角色"}`
              : `仅${pair.right?.name ?? "右侧角色"}`,
      }))
      .filter((v) => !s.only || v.left !== v.right)
      .filter((v) => !s.group || v.group === s.group)
      .filter(
        (v) =>
          !s.query.trim() ||
          `${v.label} ${v.capability}`
            .toLocaleLowerCase("zh-CN")
            .includes(s.query.trim().toLocaleLowerCase("zh-CN")),
      );
  }
  function fallback() {
    if (!s.roles.some((r) => r.code === s.left)) s.left = s.roles[0]?.code ?? "";
    if (!s.roles.some((r) => r.code === s.right)) s.right = s.roles[1]?.code ?? s.left;
  }
  function persist() {
    const url = new URL(location.href);
    const values = {
      left_role: s.left === op ? "" : s.left,
      right_role: s.right === security ? "" : s.right,
      show_all: s.only ? "" : "1",
      capability_query: s.query.trim(),
      capability_group: s.group,
    };
    for (const [k, v] of Object.entries(values)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    history.replaceState(null, "", url); // No popstate listener: do not claim two-way Vue history support.
  }
  const base = () => ({
    key: "default",
    roles: clone(data.roles),
    left: op,
    right: security,
    only: true,
    query: "",
    group: "",
    status: "ready",
    busy: false,
    error: "",
    time: "09:20",
    synthetic: false,
    intents: [],
  });
  function scene(key, initial = false) {
    if (!scenes[key]) throw new Error("Unknown scene " + key);
    pending = null;
    s = base();
    s.key = key;
    const c = sourceCase[key]?.controls;
    if (c)
      Object.assign(s, {
        left: c.compareLeft,
        right: c.compareRight,
        only: c.differencesOnly,
        query: c.capabilityQuery,
        group: c.capabilityGroup,
      });
    if (key === "group-platform") s.group = "平台治理";
    if (key.startsWith("single-")) {
      s.roles = [clone(data.roles[2])];
      s.synthetic = true;
      fallback();
      if (key === "single-role-all") s.only = false;
      if (key === "single-reset") {
        s.left = op;
        s.right = security;
      }
    }
    if (key === "empty-capabilities") {
      s.roles = s.roles.slice(0, 2).map((r) => ({ ...r, capabilities: [] }));
      s.synthetic = true;
    }
    if (key === "unknown-capabilities") {
      s.roles[0].capabilities.push("synthetic:first", "synthetic:second");
      s.synthetic = true;
      s.group = "其他能力";
    }
    if (key === "long-content") {
      s.roles[0].name += "（跨区域平台运营与采集协调职责核对样例）";
      s.roles[0].description =
        "合成长说明：" +
        "此角色描述仅用于验证多行中文阅读，不代表新增能力或自动取得业务数据权限。".repeat(5);
      s.synthetic = true;
    }
    if (["loading", "empty", "error", "timeout", "forbidden", "expired"].includes(key)) {
      s.roles = [];
      s.time = "";
      fallback();
      s.status = key === "loading" ? "loading" : key === "empty" ? "empty" : "error";
      s.busy = key === "loading";
      s.error =
        {
          error: "角色目录读取失败。",
          timeout: "角色目录读取超过 12 秒，请稍后重试。",
          forbidden: "无权限读取角色目录。",
          expired: "会话已过期，无法读取角色目录。",
        }[key] ?? "";
    }
    if (key.startsWith("refresh") && key !== "refreshed") {
      s.busy = ["refreshing", "refresh-selection"].includes(key);
      s.error =
        {
          "refresh-error": "角色目录读取失败。",
          "refresh-timeout": "角色目录读取超过 12 秒，请稍后重试。",
          "refresh-forbidden": "无权限读取角色目录。",
          "refresh-expired": "会话已过期，无法读取角色目录。",
        }[key] ?? "";
      if (s.error) s.error += " 已保留上次成功读取的权限矩阵。";
      if (key === "refresh-selection") {
        s.left = superRole;
        s.right = op;
      }
    }
    if (key === "refreshed") s.time = "09:24";
    if (key === "url-restored") {
      s.left = superRole;
      s.right = op;
      s.only = false;
      s.query = "管理";
      s.group = "平台治理";
    }
    if (key === "url-invalid") {
      s.left = "retired";
      s.right = "retired";
      fallback();
    }
    if (key === "query-boundary") {
      s.query = "字".repeat(80);
      s.synthetic = true;
    }
    if (key === "reset-disabled") {
      s.left = superRole;
      s.only = false;
    }
    if (initial) {
      const q = new URL(location.href).searchParams;
      s.left = q.get("left_role") || op;
      s.right = q.get("right_role") || security;
      s.only = q.get("show_all") !== "1";
      s.query = (q.get("capability_query") || "").slice(0, 80);
      s.group = (q.get("capability_group") || "").slice(0, 40);
      fallback();
    }
    render();
    $(".review").hidden =
      key !== "review-tool" && new URL(location.href).searchParams.get("review") !== "1";
    $("#scene").value = key;
    $("#scene-note").textContent = scenes[key];
    if (key === "focus") $("#refresh").focus({ preventScroll: true });
  }
  function render() {
    const hasRoles = s.roles.length > 0;
    $("#app").innerHTML =
      `<div class="workspace"><aside class="directory" aria-label="比较角色"><h2>选择比较角色</h2><p>从目录选择两侧角色，比较不会改变授权。</p>${["left", "right"].map((side) => `<section class="role-choice"><label for="${side}">${side === "left" ? "左侧角色" : "右侧角色"}<select id="${side}" ${!hasRoles ? "disabled" : ""}>${hasRoles ? s.roles.map((r) => `<option value="${esc(r.code)}">${esc(r.name)}</option>`).join("") : '<option value="">目录尚无可选角色</option>'}</select></label><p id="${side}-description"></p><small id="${side}-count"></small></section>`).join("")}<p class="context-note">这是角色能力目录，不是账号实际授权清单。账号的角色分配请进入管理员管理。</p></aside><section class="paper" aria-labelledby="page-title"><header class="page-head"><div><h1 id="page-title">平台角色权限比较</h1><p class="muted">先选角色，再逐项核对能力归属。</p></div><div class="actions"><button id="refresh" type="button">刷新角色目录</button><a id="admins" href="../user-admin-direction-c/index.html?mode=admins">管理管理员</a></div></header><p id="directory-meta" class="directory-meta"></p><div id="read-status" aria-live="polite"></div><section id="compare-body" ${!hasRoles ? "hidden" : ""}><div class="filters" role="search" aria-label="权限筛选"><label for="query">搜索权限<input id="query" maxlength="80" placeholder="名称或权限编码" /></label><label for="group">能力分组<select id="group"><option value="">全部分组</option>${[
        ...new Set(s.roles.flatMap((r) => r.capabilities).map(group)),
      ]
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((g) => `<option>${esc(g)}</option>`)
        .join("")}${
        s.group &&
        !s.roles
          .flatMap((r) => r.capabilities)
          .map(group)
          .includes(s.group)
          ? `<option value="${esc(s.group)}">当前条件：${esc(s.group)}</option>`
          : ""
      }</select></label><button id="reset" type="button">重置</button></div><div class="comparison-meta"><p id="result-count" aria-live="polite"></p><label class="check" for="only"><input id="only" type="checkbox" />只看差异</label></div><div id="matrix"></div></section><div id="initial-state"></div><p class="footnote" id="fixture-note"></p></section></div>`;
    $(".context-note").insertAdjacentHTML(
      "afterend",
      '<details class="mobile-descriptions"><summary>查看角色说明与范围</summary><div id="mobile-role-descriptions"></div></details>',
    );
    $(".mobile-descriptions").open = ["role-descriptions", "long-content"].includes(s.key);
    $("#left").value = s.left;
    $("#right").value = s.right;
    $("#query").value = s.query;
    $("#group").value = s.group;
    $("#only").checked = s.only;
    for (const id of ["left", "right", "query", "group", "only"])
      $("#" + id).addEventListener(id === "query" ? "input" : "change", (e) => {
        const key = id === "only" ? "only" : id;
        s[key] = id === "only" ? e.target.checked : e.target.value;
        persist();
        update();
      });
    $("#reset").onclick = () => {
      s.left = op;
      s.right = security;
      s.only = true;
      s.query = "";
      s.group = "";
      persist();
      render();
    };
    $("#refresh").onclick = read;
    update();
  }
  function update() {
    const pair = chosen(),
      rows = comparison(),
      hasRoles = s.roles.length > 0;
    for (const side of ["left", "right"]) {
      $("#" + side + "-description").textContent =
        pair[side]?.description ??
        (hasRoles ? "当前角色不在这次目录中，请重新选择。" : "成功读取目录后显示角色说明。");
      $("#" + side + "-count").textContent = pair[side]
        ? `角色自身全部能力 ${pair[side].capabilities.length} 项`
        : "未选择可用角色";
    }
    $("#mobile-role-descriptions").innerHTML =
      ["left", "right"]
        .map(
          (side) =>
            `<p><strong>${esc(pair[side]?.name ?? "未选择可用角色")}</strong><br>${esc(pair[side]?.description ?? "成功读取目录并选择角色后显示说明。")}</p>`,
        )
        .join("") + "<p>这是角色能力目录，不是账号实际授权清单；账号授权请进入管理员管理。</p>";
    $("#directory-meta").textContent =
      `全目录 ${s.roles.length} 个角色 · ${new Set(s.roles.flatMap((r) => r.capabilities)).size} 项去重能力 · ${s.time ? "最近成功读取 " + s.time : "尚未成功读取"}`;
    $("#refresh").disabled = s.busy;
    $("#refresh").textContent = s.busy ? "正在刷新…" : "刷新角色目录";
    $("#reset").disabled = !filters();
    $("#reset").title = filters()
      ? "清除搜索与分组，并恢复默认角色和只看差异"
      : "只有搜索或分组非空时可用（现有行为）";
    $("#read-status").innerHTML = s.error
      ? `<div class="notice error" role="alert"><p>${esc(s.error)}</p>${hasRoles ? '<p class="status-age">下方是上次读取的目录，不代表本次读取成功或当前仍有访问权限。</p>' : ""}</div>`
      : s.busy && hasRoles
        ? '<p class="notice">正在读取角色目录，暂时保留上次矩阵；仍可调整本地比较条件。</p>'
        : "";
    $("#compare-body").hidden = !hasRoles;
    $("#result-count").innerHTML =
      `<strong>当前显示 ${rows.length} 项能力</strong><small>两侧并集 ${union().length} 项${filters() ? ` · ${filters()} 个筛选条件` : ""}，不同于全目录统计</small>`;
    const unavailable = hasRoles && (!pair.left || !pair.right);
    $("#matrix").innerHTML = rows.length
      ? `<div class="matrix-heading" aria-hidden="true"><span>能力 / 分组</span><span>${esc(pair.left?.name)}</span><span>${esc(pair.right?.name)}</span></div>${rows.map((r) => `<article class="permission-row" data-code="${esc(r.capability)}"><h3>${esc(r.label)}<small>${esc(r.group)}</small></h3>${["left", "right"].map((side) => `<div class="ownership"><span class="role-name">${esc(pair[side]?.name)}</span><b data-enabled="${r[side]}"><span class="sr-role">${esc(pair[side]?.name)}：</span>${r[side] ? "拥有" : "无"}</b></div>`).join("")}<p class="difference">${esc(r.difference)}</p></article>`).join("")}`
      : `<div class="empty"><h2>${unavailable ? "默认角色不在当前目录中" : filters() ? "没有符合当前筛选的权限" : "当前比较没有权限差异"}</h2><p>${unavailable ? "现有重置行为恢复固定的运营与安全角色。请在左侧重新选择目录内的角色；本稿未自行替换授权目录。" : filters() ? "可调整搜索、能力分组，或使用重置恢复默认比较。" : "两侧可以选择同一角色。关闭「只看差异」可查看其能力并集；目录为空能力时仍不会产生结果。"}</p></div>`;
    $("#initial-state").innerHTML = !hasRoles
      ? s.status === "loading"
        ? '<div class="loading-lines" role="status"><p>正在读取角色目录…</p><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>'
        : `<div class="empty"><h2>${s.status === "empty" ? "角色目录暂无记录" : "暂时无法读取角色目录"}</h2><p>${s.status === "empty" ? "本次读取成功，但返回零个角色。这不等于取消了任何账号的授权。" : "尚无成功读取的矩阵，不能将读取失败展示成零权限。"}</p><button id="retry" type="button">${s.status === "empty" ? "重新检查" : "重新加载"}</button></div>`
      : "";
    if ($("#retry")) {
      $("#retry").disabled = s.busy;
      $("#retry").onclick = read;
    }
    $("#fixture-note").textContent =
      `${s.synthetic ? "合成边界夹具；不是生产角色或权限。" : "角色事实来自原始 E2E 三角色夹具，状态与 09:20/09:24 时钟为离线演示。"} 页面只读，没有保存、授权编辑、原因窗或分页。`;
  }
  function read() {
    if (s.busy) return null;
    const id = ++sequence;
    pending = { id, hadRoles: s.roles.length > 0 };
    s.intents.push({ id, method: "GET", path: "/api/v1/platform/roles" });
    s.busy = true;
    s.error = "";
    if (!s.roles.length) s.status = "loading";
    update();
    return id;
  }
  function complete(result = "success", id = pending?.id) {
    if (!pending || id !== pending.id) return false;
    const previous = pending;
    pending = null;
    s.busy = false;
    if (result === "success" || result === "empty") {
      s.roles = result === "empty" ? [] : clone(data.roles);
      s.time = "09:24";
      s.status = s.roles.length ? "ready" : "empty";
      fallback();
      persist();
    } else {
      s.error = {
        error: "角色目录读取失败。",
        timeout: "角色目录读取超过 12 秒，请稍后重试。",
        forbidden: "无权限读取角色目录。",
        expired: "会话已过期，无法读取角色目录。",
      }[result];
      if (!s.error) throw new Error("Unknown outcome");
      if (previous.hadRoles) s.error += " 已保留上次成功读取的权限矩阵。";
      s.status = s.roles.length ? "ready" : "error";
    }
    render();
    return true;
  }
  $("#scene").innerHTML = Object.entries(scenes)
    .map(([key, title]) => `<option value="${key}">${esc(title)}</option>`)
    .join("");
  $("#scene").onchange = (e) => scene(e.target.value);
  window.PERMISSION_C = {
    scenes,
    scene,
    state: () => clone({ ...s, controls: refs(), pending }),
    comparison,
    read,
    complete,
  };
  scene("default", true);
})();
