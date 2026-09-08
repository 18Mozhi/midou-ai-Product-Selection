(() => {
  const $ = (id) => document.getElementById(id),
    source = window.SCOUTOPS_SHELL_DESIGN;
  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const link = (href, text, attrs = "") => `<a href="${esc(href)}" ${attrs}>${esc(text)}</a>`;
  const scenes = {
    member: "成员 · 任务中心",
    organization: "组织管理员 · 角色与权限",
    platform: "平台超级管理员 · 系统运维",
    security: "平台安全管理员 · 最小菜单",
    auditor: "组织审计员 · 仅审计（派生边界）",
    "member-platform": "成员拥有平台角色 · 切换入口",
    "member-menu": "成员完整菜单",
    "platform-menu": "平台完整菜单",
    "menu-query": "按名称筛选菜单",
    "menu-group": "按分组筛选菜单",
    "menu-empty": "菜单无匹配",
    "context-open": "当前范围展开",
    "operations-secondary": "平台运维二级页",
    "task-detail": "任务二级页 · 更多高亮",
    loading: "导航首次核验中",
    expired: "登录失效",
    forbidden: "壳层被拒绝",
    "forbidden-technical": "壳层被拒绝 · 故障详情",
    context_required: "组织工作区未选择",
    rate_limited: "请求频繁",
    blocked: "导航服务不可用",
    "route-forbidden": "壳层获准但页面无权",
    "surface-missing": "已授权路由组件缺失（派生边界）",
    "recheck-busy": "重新检查中",
    "recheck-recovered": "重新检查成功",
  };
  let profileKey = "member",
    fullPath = "/tasks",
    state = "ready",
    query = "",
    sequence = 0,
    timer,
    simulatedReads = 0,
    missingSurface = false;
  const profile = () => source.profiles[profileKey];
  const pathOnly = () => fullPath.split("?")[0];
  const route = () =>
    source.routes.find((entry) => entry.path === pathOnly()) ||
    source.routes.find(
      (entry) => entry.path === "/tasks/:taskId" && /^\/tasks\/[0-9a-f-]{36}$/.test(pathOnly()),
    );
  const items = () => (state === "ready" ? profile().items : []);
  function activeItem() {
    const entry = route(),
      parent = entry?.parent ?? pathOnly();
    return (
      items().find((item) => item.path === parent) ||
      [...items()]
        .filter(
          (item) =>
            !["/platform-admin", "/org-admin", "/home"].includes(item.path) &&
            pathOnly().startsWith(`${item.path}/`),
        )
        .sort((left, right) => right.path.length - left.path.length)[0]
    );
  }
  function switchLinks() {
    if (state !== "ready") return "";
    const guard = profile().guard;
    if (guard.shell === "platform_admin")
      return link(
        `/select-context?return_to=${encodeURIComponent("/opportunities?status=watching")}&from=${encodeURIComponent(fullPath)}`,
        "返回用户工作台",
        'aria-label="选择组织与工作区后进入用户工作台"',
      );
    if (guard.shell === "organization_admin")
      return link("/trends?market=US&page=2", "返回成员工作台");
    return (
      (guard.roles.includes("organization_admin") ? link("/org-admin", "进入组织后台") : "") +
      (guard.platform_roles.length ? link("/platform-admin", "进入管理后台") : "")
    );
  }
  function renderMenu() {
    const active = activeItem(),
      needle = query.trim().toLocaleLowerCase();
    const filtered = items().filter((item) =>
      `${item.label} ${item.group}`.toLocaleLowerCase().includes(needle),
    );
    const groups = new Map();
    filtered.forEach((item) => groups.set(item.group, [...(groups.get(item.group) || []), item]));
    $("nav-groups").innerHTML =
      [...groups]
        .map(
          ([group, entries]) =>
            `<details ${needle || entries.some((entry) => entry.path === active?.path) ? "open" : ""}><summary>${esc(group)}</summary><div>${entries.map((entry) => link(entry.path, entry.label, `data-menu-route ${active?.path === entry.path ? 'aria-current="page"' : ""}`)).join("")}</div></details>`,
        )
        .join("") || (state === "ready" ? '<p id="menu-empty">没有匹配的菜单或分组。</p>' : "");
    $("shell-switches").innerHTML = switchLinks();
    $("shell-switches").hidden = !$("shell-switches").textContent;
    $("nav-search-label").hidden = items().length < 8;
    $("nav-pending").hidden = state === "ready";
  }
  function render() {
    const guard = profile().guard,
      shell = guard.shell,
      entry = route(),
      active = activeItem();
    const ready = state === "ready",
      allowed = ready && entry && profile().allowedPaths.includes(entry.path);
    const shellTitles = {
      member: "成员工作台",
      organization_admin: "组织管理后台",
      platform_admin: "平台管理后台",
    };
    $("shell-title").textContent = shellTitles[shell];
    $("scope-label").textContent =
      shell === "member"
        ? "当前组织业务范围"
        : shell === "organization_admin"
          ? "仅当前组织"
          : "平台角色授权范围";
    $("role-label").textContent = ready ? profile().roleLabel : "当前角色";
    $("brand").href =
      shell === "member"
        ? "/home"
        : shell === "organization_admin"
          ? "/org-admin"
          : "/platform-admin";
    $("search-entry").hidden = shell !== "member";
    $("notifications-entry").hidden = shell !== "member";
    $("quick-entry").innerHTML =
      shell === "member"
        ? '<button data-deferred="create">创建选品</button>'
        : ready && shell === "organization_admin" && guard.roles.includes("organization_admin")
          ? link("/org-admin/members", "邀请成员")
          : ready &&
              shell === "platform_admin" &&
              guard.platform_capabilities.includes("platform:superadmin")
            ? link("/platform-admin/organizations/new", "新建组织")
            : "";
    renderMenu();
    $("gate").hidden = allowed && !missingSurface;
    $("ready-surface").hidden = !allowed || missingSurface;
    const stateCopy = {
      loading: ["正在核验工作台权限", "菜单只会在服务端确认后显示。"],
      expired: ["登录已失效", "重新登录后再进入所需页面。"],
      forbidden: ["无权进入此工作台", "服务端已拒绝该壳层；返回有权访问的工作台。"],
      context_required: ["尚未选择组织与工作区", "完成租户选择后才能进入成员或组织后台。"],
      rate_limited: ["请求过于频繁", "稍后重试；不要连续刷新。"],
      blocked: ["导航服务暂不可用", "检查网络后重试；运维可在宝塔查看 Node API。"],
      route: ["无权打开此页面", "当前角色不包含该页面要求的能力，请返回有权访问的模块。"],
      missing: ["页面不存在", "该地址没有可用功能，请从左侧目录重新进入。"],
    };
    if (!$("gate").hidden) {
      const key = ready ? (missingSurface ? "missing" : "route") : state;
      $("gate-title").textContent = stateCopy[key][0];
      $("gate-copy").textContent = stateCopy[key][1];
      $("gate-hint").textContent = state === "forbidden" ? "返回有权访问的工作台。" : "";
      $("gate-technical").hidden = state !== "forbidden";
      $("gate-actions").innerHTML =
        state === "expired"
          ? link("/login", "重新登录")
          : state === "context_required"
            ? link("/select-context", "选择组织与工作区")
            : state === "forbidden"
              ? link("/home", "返回成员工作台")
              : ready
                ? link(items()[0]?.path || (missingSurface ? "/" : "/home"), "返回工作台") +
                  (missingSurface ? "" : link("/me?section=permissions", "申请权限或联系管理员"))
                : state === "loading"
                  ? ""
                  : '<button id="recheck">重新检查</button>';
    }
    if (entry) {
      $("breadcrumbs").innerHTML = entry.breadcrumb
        .map((crumb, index) =>
          crumb.path
            ? link(crumb.path, crumb.label)
            : `<span ${index === entry.breadcrumb.length - 1 ? 'aria-current="page"' : ""}>${esc(crumb.label)}</span>`,
        )
        .join('<span aria-hidden="true">/</span>');
      $("page-title").textContent = entry.title;
      $("page-group").textContent = active?.group || shellTitles[shell];
    }
    $("scope-value").textContent =
      shell === "platform_admin"
        ? "平台全局"
        : `${guard.organization_name?.trim() || "未命名组织"} · ${guard.workspace_name?.trim() || "默认工作区"}`;
    $("context-group").textContent = active?.group || shellTitles[shell];
    $("context-role").textContent = profile().roleLabel;
    $("operations").hidden =
      shell !== "platform_admin" || !source.operations.some((item) => item.path === pathOnly());
    $("operations").innerHTML = source.operations
      .map((item) =>
        link(item.path, item.label, item.path === pathOnly() ? 'aria-current="page"' : ""),
      )
      .join("");
    const primary = items().slice(0, 4),
      moreActive =
        pathOnly() !== active?.path || !primary.some((item) => item.path === active?.path);
    $("mobile-navigation").hidden = !ready;
    $("mobile-navigation").innerHTML =
      primary
        .map((item) =>
          link(
            item.path,
            item.label,
            !moreActive && item.path === active?.path ? 'aria-current="page"' : "",
          ),
        )
        .join("") +
      `<button id="more" aria-controls="nav-dialog" aria-expanded="false" ${moreActive ? 'aria-current="page"' : ""}>更多</button>`;
  }
  let opener;
  function openMenu() {
    if (innerWidth > 840) {
      document.querySelectorAll("#nav-groups details").forEach((node) => {
        node.open = true;
      });
      return;
    }
    if ($("nav-dialog").open) return;
    opener = document.activeElement;
    $("mobile-navigation-content").append($("navigation-content"));
    $("nav-dialog").showModal();
    $("open-menu").setAttribute("aria-expanded", "true");
    $("more")?.setAttribute("aria-expanded", "true");
    $("close-menu").focus();
  }
  function closeMenu() {
    if (!$("nav-dialog").open) return;
    $("nav-dialog").close();
    $("desktop-navigation").append($("navigation-content"));
    $("open-menu").setAttribute("aria-expanded", "false");
    $("more")?.setAttribute("aria-expanded", "false");
    if (opener?.isConnected) opener.focus();
  }
  function navigate(href, fromMenu) {
    $("review-note").textContent =
      `设计演示目标：${href}。未请求API或更改浏览器地址；真实路由仍由Vue Router管理。`;
    const target = source.routes.find((entry) => entry.path === href.split("?")[0]);
    if (target?.shell === profile().guard.shell && target.shell !== "account") {
      fullPath = href;
      if (fromMenu) query = "";
      closeMenu();
      $("nav-search").value = query;
      render();
    } else closeMenu();
  }
  function deferred(kind) {
    $("deferred-note").hidden = false;
    $("deferred-note").textContent =
      `审核边界：${kind === "theme" ? "主题浮层、三主题映射与保存回退" : kind === "search" ? "发现搜索弹窗、筛选与结果恢复" : "快捷创建弹窗与最近入口"}待独立C方向图稿。本批只核对入口位置，不模拟成功、不保存偏好或创建对象。`;
  }
  function reset(scene) {
    sequence += 1;
    clearTimeout(timer);
    closeMenu();
    query = "";
    $("nav-search").value = "";
    $("deferred-note").hidden = true;
    $("scope-detail").open = false;
    $("gate-technical").open = false;
    missingSurface = false;
    profileKey = "member";
    fullPath = "/tasks";
    state = "ready";
    if (["organization", "auditor"].includes(scene)) {
      profileKey = scene === "auditor" ? "organization_auditor" : "organization_admin";
      fullPath = scene === "auditor" ? "/org-admin/audit" : "/org-admin/roles";
    }
    if (
      [
        "platform",
        "platform-menu",
        "menu-query",
        "menu-group",
        "menu-empty",
        "operations-secondary",
        "forbidden",
        "forbidden-technical",
      ].includes(scene)
    ) {
      profileKey = "platform_admin";
      fullPath = "/platform-admin/status";
    }
    if (scene === "security") {
      profileKey = "platform_security";
      fullPath = "/platform-admin/security";
    }
    if (scene === "member-platform") profileKey = "member_platform";
    if (scene === "operations-secondary") fullPath = "/platform-admin/mysql";
    if (scene === "task-detail") fullPath = "/tasks/00000000-0000-4000-8000-000000000801";
    if (scene === "route-forbidden") fullPath = "/reports";
    if (scene === "surface-missing") missingSurface = true;
    if (
      ["loading", "expired", "forbidden", "context_required", "rate_limited", "blocked"].includes(
        scene,
      )
    )
      state = scene;
    if (scene === "recheck-busy") state = "loading";
    if (scene === "forbidden-technical") {
      state = "forbidden";
      $("gate-technical").open = true;
    }
    if (scene.startsWith("menu-")) {
      query =
        scene === "menu-query" ? "用户" : scene === "menu-group" ? "高级运维" : "不存在的菜单";
      $("nav-search").value = query;
    }
    render();
    if (
      ["member-menu", "platform-menu", "menu-query", "menu-group", "menu-empty"].includes(scene)
    ) {
      if (innerWidth <= 840) $("open-menu").focus();
      openMenu();
      document.querySelectorAll("#nav-groups details").forEach((node) => {
        node.open = true;
      });
    }
    if (scene === "context-open") $("scope-detail").open = true;
    $("review-note").textContent =
      `审核场景：${scenes[scene]}。${profile().kind}；组织/工作区名称未在样本返回，不拼接编号代替。`;
    window.scrollTo(0, 0);
  }
  $("scene").innerHTML = Object.entries(scenes)
    .map(([key, name]) => `<option value="${key}">${name}</option>`)
    .join("");
  $("scene").addEventListener("change", (event) => reset(event.target.value));
  $("nav-search").addEventListener("input", (event) => {
    query = event.target.value;
    renderMenu();
  });
  $("open-menu").addEventListener("click", openMenu);
  $("close-menu").addEventListener("click", closeMenu);
  $("nav-dialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMenu();
  });
  $("nav-dialog").addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const nodes = [...$("nav-dialog").querySelectorAll("button,a,input,summary")].filter(
      (node) => node.getClientRects().length && !node.disabled,
    );
    const first = nodes[0],
      last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button"),
      anchor = event.target.closest("a");
    if (button?.dataset.deferred) deferred(button.dataset.deferred);
    if (button?.id === "more") openMenu();
    if (button?.id === "recheck") {
      const current = ++sequence;
      simulatedReads += 1;
      state = "loading";
      render();
      timer = setTimeout(() => {
        if (current !== sequence) return;
        state = "ready";
        render();
      }, 450);
    }
    if (anchor) {
      event.preventDefault();
      navigate(anchor.getAttribute("href"), anchor.hasAttribute("data-menu-route"));
    }
  });
  window.addEventListener("keydown", (event) => {
    if (
      profile().guard.shell === "member" &&
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      deferred("search");
    }
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 840) closeMenu();
  });
  window.addEventListener("pagehide", () => {
    sequence += 1;
    clearTimeout(timer);
  });
  window.SHELL_DESIGN_DIAGNOSTICS = () => ({ profileKey, fullPath, state, query, simulatedReads });
  reset("member");
})();
