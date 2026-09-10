/* Explicit C proposal control catalog; reuses the original controller without live services. */
(() => {
  const D = window.MEMBERS_C_DATA,
    api = window.MEMBERS_C;
  const buyer = D.members.items[1].id,
    locked = D.members.items[2].id,
    invitation = D.members.invitations[0].id;
  const four = ["default", "hover", "focus", "pressed"];
  const actionSelector = (action, id) => `[data-action='${action}'][data-id='${id}']`;
  const definitions = [
    {
      id: "refresh",
      actionId: "OG-REFRESH",
      label: "刷新成员资料",
      selector: "#refresh",
      scene: "normal",
      busyScene: "refreshing",
      primary: true,
    },
    {
      id: "refresh-loading",
      actionId: "OG-REFRESH",
      label: "首次加载 / 刷新禁用",
      selector: "#refresh",
      scene: "loading",
      disabledOnly: true,
    },
    ...[
      ["error", "服务错误"],
      ["blocked", "服务不可用"],
      ["expired", "登录失效"],
      ["forbidden", "无权访问"],
      ["rate_limited", "请求频繁"],
    ].map(([scene, label]) => ({
      id: `retry-${scene}`,
      actionId: "OG-RETRY",
      label: `${label} / 重新加载`,
      selector: "#retry",
      scene,
      primary: scene === "error",
    })),
    {
      id: "invite",
      actionId: "OG-M-INVITE",
      label: "创建邀请",
      selector: "#invite-submit",
      scene: "invite_form",
      busyScene: "invite_busy",
      primary: true,
    },
    ...[
      ["invite_partial", "部分失败"],
      ["invite_interrupted", "中断保留尾部（仅提案）"],
    ].map(([scene, label]) => ({
      id: scene,
      actionId: "OG-M-INVITE",
      label: `${label} / 创建邀请`,
      selector: "#invite-submit",
      scene,
      proposalOnly: scene === "invite_interrupted",
    })),
    ...["pending", "expired"].flatMap((tab) =>
      [false, true].map((selected) => ({
        id: `tab-${tab}-${selected ? "selected" : "available"}`,
        actionId: tab === "pending" ? "OG-M-TAB-PENDING" : "OG-M-TAB-EXPIRED",
        label: `${tab === "pending" ? "待接受" : "已失效"} / ${selected ? "已选" : "未选"}`,
        selector: `[data-tab='${tab}']`,
        scene: (tab === "expired") === selected ? "invite_expired" : "normal",
        selected,
        primary: selected,
      })),
    ),
    ...[
      ["normal", "等待邮件服务"],
      ["invite_acceptance", "等待接受"],
    ].map(([scene, label]) => ({
      id: `revoke-${scene}`,
      actionId: "OG-M-INVITATION-REVOKE",
      label: `${label} / 撤销邀请`,
      selector: actionSelector("revoke", invitation),
      scene,
      busyAction: "revoke",
      targetId: invitation,
      primary: scene === "normal",
    })),
    {
      id: "search",
      actionId: "OG-M-SEARCH",
      label: "搜索姓名或邮箱",
      selector: "#filter-query",
      scene: "filters_open",
      primary: true,
      value: "陈",
    },
    ...[
      ["status", "OG-M-STATUS-FILTER", "有效状态", "locked"],
      ["role", "OG-M-ROLE-FILTER", "角色筛选", "procurement_member"],
      ["team", "OG-M-TEAM-FILTER", "团队筛选", "采购协作组"],
      ["sort", "OG-M-SORT", "成员排序", "joined_desc"],
    ].map(([id, actionId, label, value]) => ({
      id: `filter-${id}`,
      actionId,
      label,
      selector: `#filter-${id}`,
      scene: "filters_open",
      select: true,
      primary: true,
      value,
    })),
    {
      id: "row-role",
      actionId: "OG-M-ROLE-SELECT",
      label: "陈采购 / 选择角色",
      selector: `#role-${buyer}`,
      scene: "normal",
      select: true,
      primary: true,
      value: "selection_manager",
    },
    {
      id: "reset",
      actionId: "OG-M-RESET",
      label: "筛选区 / 重置",
      selector: "#filters-panel [data-reset]",
      scene: "filters_open",
      primary: true,
    },
    {
      id: "reset-empty",
      actionId: "PROPOSAL-RESET-EMPTY",
      label: "空结果区 / 重置（新增入口提案）",
      selector: ".empty [data-reset]",
      scene: "filter_empty",
      proposalOnly: true,
    },
    ...[false, true].map((open) => ({
      id: `technical-${open ? "open" : "closed"}`,
      actionId: "OG-TECH",
      label: `成员技术详情 / ${open ? "展开" : "收起"}`,
      selector: `.member[data-member='${buyer}'] summary`,
      scene: "normal",
      disclosure: open,
      primary: !open,
    })),
    {
      id: "assign-role",
      actionId: "OG-M-ROLE-ASSIGN",
      label: "陈采购 / 分配角色",
      selector: actionSelector("role", buyer),
      scene: "normal",
      busyAction: "role",
      targetId: buyer,
      primary: true,
    },
    {
      id: "disable",
      actionId: "OG-M-STATE",
      label: "陈采购 / 禁用成员",
      selector: actionSelector("disable", buyer),
      scene: "normal",
      busyAction: "disable",
      targetId: buyer,
      primary: true,
    },
    {
      id: "restore",
      actionId: "OG-M-STATE",
      label: "账号仍锁定 / 恢复成员",
      selector: actionSelector("restore", locked),
      scene: "disabled_locked",
      busyAction: "restore",
      targetId: locked,
    },
    {
      id: "prev",
      actionId: "OG-M-PREV",
      label: "成员上一页",
      selector: ".pagination button:first-child",
      scene: "page_two",
      disabledScene: "multipage",
      primary: true,
    },
    {
      id: "next",
      actionId: "OG-M-NEXT",
      label: "成员下一页",
      selector: ".pagination button:last-child",
      scene: "multipage",
      disabledScene: "page_two",
      primary: true,
    },
    ...[
      ["disable", "禁用"],
      ["restore", "恢复"],
      ["role", "角色分配"],
      ["revoke", "撤销邀请"],
    ].flatMap(([action, label]) =>
      ["confirm", "cancel", "close"].map((part) => ({
        id: `reason-${action}-${part}`,
        actionId: "D-OG-REASON",
        label: `${label}原因窗 / ${{ confirm: "确认提交", cancel: "取消", close: "关闭" }[part]}`,
        selector: `#reason-${part}`,
        scene: `reason_${action}`,
        reasonAction: action,
        shortReason: part === "confirm",
        primary: action === "role" && part === "confirm",
      })),
    ),
    ...["member-section", "invitation-section"].flatMap((target) =>
      [false, true].map((selected) => ({
        id: `directory-${target}-${selected ? "selected" : "available"}`,
        actionId: "PROPOSAL-DIRECTORY",
        label: `${target === "member-section" ? "成员" : "邀请"}目录 / ${selected ? "已选" : "未选"}`,
        selector: `.directory a[href='#${target}']`,
        scene: "normal",
        target,
        selected,
        proposalOnly: true,
      })),
    ),
    ...[false, true].map((open) => ({
      id: `filters-${open ? "open" : "closed"}`,
      actionId: "PROPOSAL-FILTER-DISCLOSURE",
      label: `筛选折叠区 / ${open ? "展开" : "收起"}`,
      selector: "#filters-panel > summary",
      scene: "normal",
      disclosure: open,
      proposalOnly: true,
    })),
    ...[
      ["refresh_error", "刷新失败"],
      ["action_conflict", "操作冲突"],
    ].map(([scene, label]) => ({
      id: `feedback-${scene}`,
      actionId: "PROPOSAL-FEEDBACK-TECH",
      label: `${label} / 技术说明`,
      selector: "#feedback summary",
      scene,
      proposalOnly: true,
    })),
  ];
  const controls = definitions.map((c) => ({
    ...c,
    scope: c.proposalOnly
      ? "proposal-only-not-source-action"
      : "source-action-representative-or-variant",
    states: c.disabledOnly
      ? ["disabled"]
      : [
          ...(c.select ? ["default", "hover", "focus"] : four),
          ...(c.busyScene || c.busyAction
            ? ["disabled", "busy"]
            : c.disabledScene || c.shortReason
              ? ["disabled"]
              : []),
        ],
  }));
  function decorate() {
    const s = api.state(),
      workspace = document.getElementById("workspace");
    let note = document.getElementById("control-busy-note");
    if (s.busy && !note) {
      note = document.createElement("p");
      note.id = "control-busy-note";
      note.className = "control-busy-note";
      note.setAttribute("role", "status");
      workspace.querySelector(".page-head").after(note);
    }
    if (note) {
      note.hidden = !s.busy;
      const text =
        s.busy === "refresh"
          ? "正在刷新资料，请等待读取结果。"
          : "当前变更请求处理中，请等待结果后再提交。";
      if (note.textContent !== text) note.textContent = text;
      for (const button of workspace.querySelectorAll("button:disabled"))
        button.setAttribute("aria-describedby", note.id);
    }
  }
  function prepare(id, mode = "default") {
    const c = controls.find((v) => v.id === id);
    if (!c || !c.states.includes(mode)) throw new Error("Unknown control/state");
    const waiting = ["busy", "disabled"].includes(mode) && Boolean(c.busyScene || c.busyAction);
    api.scene(
      waiting && c.busyScene
        ? c.busyScene
        : mode === "disabled" && c.disabledScene
          ? c.disabledScene
          : c.scene,
    );
    if (waiting && c.busyAction) {
      api.setMode("hold");
      document.querySelector(c.selector).click();
      const input = document.getElementById("reason-input");
      input.value = "核验成员变更";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("reason-confirm").click();
    }
    if (mode === "disabled" && c.shortReason) {
      const input = document.getElementById("reason-input");
      input.value = "短";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (c.target)
      document
        .querySelector(
          `.directory a[href='#${c.selected ? c.target : c.target === "member-section" ? "invitation-section" : "member-section"}']`,
        )
        .click();
    if (c.disclosure !== undefined)
      document.querySelector(c.selector).parentElement.open = c.disclosure;
    document.getElementById("control-select").value = id;
    document.getElementById("control-mode").value = ["disabled", "busy"].includes(mode)
      ? mode
      : "default";
    document.getElementById("control-note").textContent =
      `${c.label}；${c.proposalOnly ? "仅提案入口" : "已有动作的代表控件"}，非生产/未获审。`;
    decorate();
  }
  for (const c of controls)
    document.getElementById("control-select").add(new Option(c.label, c.id));
  document.getElementById("show-control").onclick = () => {
    const id = document.getElementById("control-select").value,
      mode = document.getElementById("control-mode").value;
    const c = controls.find((v) => v.id === id);
    if (!c.states.includes(mode)) {
      document.getElementById("control-note").textContent = "该控件没有此状态，本稿不补造。";
      return;
    }
    prepare(id, mode);
    document.querySelector(c.selector).scrollIntoView({ block: "center" });
  };
  new MutationObserver(decorate).observe(document.getElementById("workspace"), { childList: true });
  decorate();
  window.MEMBERS_CONTROLS_C = { controls, prepare };
})();
