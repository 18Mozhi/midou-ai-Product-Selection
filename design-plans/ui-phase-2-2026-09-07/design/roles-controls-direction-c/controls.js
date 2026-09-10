/* Child-only state review. Original C renderer and fixture remain unchanged. */
(() => {
  const $ = (id) => document.getElementById(id),
    four = ["default", "hover", "focus", "pressed"];
  const definitions = [
    ...["roles", "scopes", "grants"].flatMap((section) =>
      [false, true].map((selected) => ({
        id: `section-${section}-${selected ? "selected" : "available"}`,
        actionId: "role.section.{section}",
        label: `${{ roles: "角色模板", scopes: "数据范围", grants: "指定授权" }[section]}分区 / ${selected ? "已选" : "未选"}`,
        selector: `[data-section='${section}']`,
        scene: selected ? section : section === "roles" ? "scopes" : "roles",
        selected,
        primary: section === "roles" && selected,
      })),
    ),
    ...["organization_admin", "auditor"].flatMap((role) =>
      [false, true].map((selected) => ({
        id: `role-${role}-${selected ? "selected" : "available"}`,
        actionId: "role.select.{roleCode}",
        label: `${role === "auditor" ? "审计员" : "组织管理员"} / ${selected ? "已选" : "未选"}`,
        selector: `[data-role='${role}']`,
        scene: (role === "auditor") === selected ? "role-auditor" : "roles",
        selected,
        primary: role === "organization_admin" && selected,
      })),
    ),
    ...[false, true].map((open) => ({
      id: `role-technical-${open ? "open" : "closed"}`,
      actionId: "role.capability.technical.toggle",
      label: `角色技术能力 / ${open ? "展开" : "收起"}`,
      selector: "#role-technical summary",
      scene: open ? "role-technical" : "roles",
      primary: !open,
    })),
    {
      id: "capability-reset",
      actionId: "role.capability.filter.reset",
      label: "能力筛选重置",
      selector: "#reset-capabilities",
      scene: "matrix-empty",
      disabledScene: "roles",
      primary: true,
    },
    {
      id: "scope-reset",
      actionId: "role.scope.filter.reset",
      label: "成员范围筛选重置",
      selector: "#reset-scopes",
      scene: "scopes-empty",
      disabledScene: "scopes",
      primary: true,
    },
    {
      id: "create-open",
      actionId: "grant.create.form.toggle",
      label: "展开创建授权",
      selector: "#toggle-create",
      scene: "grants",
      primary: true,
    },
    {
      id: "create-cancel",
      actionId: "grant.create.form.toggle",
      label: "取消创建（保留草稿）",
      selector: "#toggle-create",
      scene: "create-opportunity",
    },
    ...["task", "opportunity", "competitor", "sourcing"].map((type) => ({
      id: `create-${type}`,
      actionId: "grant.create.submit",
      label: `创建${{ task: "任务", opportunity: "机会", competitor: "竞品", sourcing: "供应链" }[type]}授权`,
      selector: "#create-submit",
      scene: `create-${type}`,
      busyScene: "create-busy",
      resourceType: type,
      primary: type === "opportunity",
    })),
    {
      id: "create-no-actions",
      actionId: "grant.create.submit",
      label: "未选择动作 / 创建禁用",
      selector: "#create-submit",
      scene: "create-opportunity",
      noActions: true,
      disabledOnly: true,
    },
    {
      id: "resource-type",
      actionId: "grant.create.type.change",
      label: "选择资源类型",
      selector: "#resource-type",
      scene: "create-opportunity",
      select: true,
      primary: true,
    },
    ...["all", "active", "expired", "revoked"].flatMap((status) =>
      [false, true].map((selected) => ({
        id: `status-${status}-${selected ? "selected" : "available"}`,
        actionId: "grant.status.select.{status}",
        label: `${{ all: "全部", active: "生效中", expired: "已到期", revoked: "已撤销" }[status]}授权 / ${selected ? "已选" : "未选"}`,
        selector: `[data-status='${status}']`,
        scene: "grants",
        statusSelection: selected ? status : status === "all" ? "active" : "all",
        selected,
        busyScene: "extend-busy",
        primary: status === "all" && selected,
      })),
    ),
    {
      id: "select-grant",
      actionId: "grant.select.{grantId}",
      label: "当前页唯一授权 / 已选",
      selector: "#select-grant",
      scene: "grants",
      selected: true,
      primary: true,
    },
    ...[false, true].map((open) => ({
      id: `grant-technical-${open ? "open" : "closed"}`,
      actionId: "grant.technical.toggle",
      label: `授权技术编号 / ${open ? "展开" : "收起"}`,
      selector: "#grant-technical summary",
      scene: open ? "grant-technical" : "grants",
      primary: !open,
    })),
    {
      id: "extend",
      actionId: "grant.expiry.submit",
      label: "延长授权",
      selector: "#extend-submit",
      scene: "grants",
      busyScene: "extend-busy",
      primary: true,
    },
    {
      id: "revoke",
      actionId: "grant.revoke.request",
      label: "撤销授权入口",
      selector: "#revoke",
      scene: "grants",
      busyScene: "extend-busy",
      primary: true,
    },
    {
      id: "page-prev",
      actionId: "grant.page.previous",
      label: "唯一页 / 上一页禁用",
      selector: "#pagination button:first-child",
      scene: "grants",
      disabledOnly: true,
      primary: true,
    },
    {
      id: "page-next",
      actionId: "grant.page.next",
      label: "唯一页 / 下一页禁用",
      selector: "#pagination button:last-child",
      scene: "grants",
      disabledOnly: true,
      primary: true,
    },
    {
      id: "first-grant",
      actionId: "grant.create.form.open",
      label: "无授权 / 创建首条",
      selector: "#first-grant",
      scene: "grants-none",
      primary: true,
    },
    {
      id: "all-grants",
      actionId: "grant.status.all",
      label: "当前状态为空 / 查看全部",
      selector: "#all-grants",
      scene: "grants-filter-empty",
      primary: true,
    },
    ...["confirm", "cancel", "close"].map((part) => ({
      id: `reason-${part}`,
      actionId: "D-OG-REASON",
      label: `撤销原因窗 / ${{ confirm: "确认提交", cancel: "取消", close: "关闭" }[part]}`,
      selector: `#${part}-revoke`,
      scene: "revoke",
      shortReason: part === "confirm",
      primary: part === "confirm",
    })),
  ];
  const controls = definitions.map((c) => ({
    ...c,
    scope: "source-action-representative-or-variant",
    states: c.disabledOnly
      ? ["disabled"]
      : [
          ...(c.select ? ["default", "hover", "focus"] : four),
          ...(c.busyScene
            ? ["disabled", "busy"]
            : c.disabledScene || c.shortReason
              ? ["disabled"]
              : []),
        ],
  }));
  function scene(value) {
    $("scene").value = value;
    $("scene").dispatchEvent(new Event("change"));
  }
  function prepare(id, mode = "default") {
    const c = controls.find((v) => v.id === id);
    if (!c || !c.states.includes(mode)) throw new Error("Unknown control/state");
    const waiting = ["disabled", "busy"].includes(mode) && Boolean(c.busyScene);
    scene(
      waiting ? c.busyScene : mode === "disabled" && c.disabledScene ? c.disabledScene : c.scene,
    );
    $("review-note").textContent = "本地控件演示，不请求API或写入授权。";
    if (c.resourceType) {
      $("resource-type").value = c.resourceType;
      $("resource-type").dispatchEvent(new Event("change"));
    }
    if (c.statusSelection) {
      const option = document.querySelector(`[data-status='${c.statusSelection}']`);
      // Disabled waiting filters cannot be clicked. Set selection before entering the frozen visual state.
      if (waiting) {
        scene("grants");
        document.querySelector(`[data-status='${c.statusSelection}']`).click();
        document.querySelectorAll("#grant-statuses button").forEach((b) => (b.disabled = true));
      } else option.click();
    }
    $("resource-id").value = window.SCOUTOPS_ROLE_DESIGN.grant.resource_id;
    $("member-target").value = window.SCOUTOPS_ROLE_DESIGN.grantTargets[0];
    $("create-reason").value = "核对供应报价";
    $("extend-reason").value = "延长核对期限";
    if (c.noActions) {
      document.querySelectorAll("#grant-actions input").forEach((n) => (n.checked = false));
      $("grant-actions").dispatchEvent(new Event("change"));
    }
    if (mode === "disabled" && c.shortReason) {
      $("revoke-reason").value = "无";
      $("revoke-reason").dispatchEvent(new Event("input"));
    }
    document
      .querySelectorAll('[aria-describedby="control-wait-note"]')
      .forEach((n) => n.removeAttribute("aria-describedby"));
    document.querySelectorAll(".control-wait-note").forEach((n) => n.remove());
    if (waiting) {
      const note = document.createElement("p");
      note.id = "control-wait-note";
      note.className = "control-wait-note";
      note.setAttribute("role", "status");
      note.textContent = "请求处理中 · 本图仅模拟等待，不会执行授权。";
      document.querySelector(c.selector).parentElement.before(note);
      document.querySelector(c.selector).setAttribute("aria-describedby", note.id);
    }
    $("control-select").value = id;
    $("control-state").value = ["disabled", "busy"].includes(mode) ? mode : "default";
    $("control-note").textContent = `${c.label} · 既有动作代表状态，尚未获审；非真实Vue/生产。`;
  }
  controls.forEach((c) => $("control-select").add(new Option(c.label, c.id)));
  $("show-control").onclick = () => {
    const c = controls.find((c) => c.id === $("control-select").value),
      mode = $("control-state").value;
    if (!c.states.includes(mode)) {
      $("control-note").textContent = "该控件未登记此状态，不补造。";
      return;
    }
    prepare(c.id, mode);
    document.querySelector(c.selector).scrollIntoView({ block: "center" });
  };
  window.ROLES_CONTROLS_C = { controls, prepare };
})();
