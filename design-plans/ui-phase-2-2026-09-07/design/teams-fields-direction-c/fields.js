(() => {
  const api = window.TEAMS_C,
    $ = (s) => document.querySelector(s);
  const fields = [
    {
      id: "name",
      model: "form.name",
      selector: "#team-name",
      label: "团队名称",
      required: true,
      max: 120,
      states: ["default", "focus", "empty", "whitespace", "boundary", "corrected", "pending"],
    },
    {
      id: "lead",
      model: "form.lead_membership_id",
      selector: "#team-lead",
      label: "负责人（可选）",
      required: false,
      states: ["default", "focus", "empty", "admin", "buyer", "locked", "no-members", "pending"],
    },
    {
      id: "workflow",
      model: "form.default_workflow_key",
      selector: "#team-workflow",
      label: "默认流程键（可选）",
      required: false,
      max: 80,
      states: ["default", "focus", "empty", "whitespace", "boundary", "free-text", "pending"],
    },
    {
      id: "reason",
      model: "form.reason",
      selector: "#team-reason",
      label: "创建原因",
      required: true,
      max: 500,
      states: ["default", "focus", "empty", "whitespace", "boundary", "corrected", "pending"],
    },
    {
      id: "query",
      model: "query",
      selector: "#query",
      label: "搜索团队",
      required: false,
      states: ["default", "focus", "name", "email", "workflow", "no-result", "cleared"],
    },
    {
      id: "sort",
      model: "sort",
      selector: "#sort",
      label: "排序",
      required: false,
      states: ["default", "focus", "name_asc", "members_desc", "updated_desc"],
    },
    {
      id: "member",
      model: "selectedMembershipId",
      selector: "#team-member-select",
      label: "操作成员",
      required: false,
      states: ["default", "focus", "admin", "buyer", "locked", "no-members", "archived", "pending"],
    },
  ];
  const combinations = {
    "create-empty": ["create", "四字段空表单"],
    "create-ready": ["create_draft", "创建信息填妥"],
    "create-optional-empty": ["create_optional_empty", "可选配置留空"],
    "create-invalid": ["create_required", "必填字段就地错误"],
    "create-boundary": ["create_long", "三个文本字段边界"],
    "create-pending": ["create_busy", "提交期间继续编辑"],
    "create-failed": ["create_failure", "失败保留草稿"],
    "member-missing": ["member_missing", "未选择操作成员"],
    "member-archived": ["archived", "归档团队成员选择"],
  };
  const help = {
    name: "使用成员熟悉的业务名称，最多120个字符。",
    lead: "可暂不设置；设为负责人时会同时建立团队成员关系。可选项来自当前组织活动成员。",
    workflow: "可留空。只保存流程键，不检查对应流程是否存在；最多80个字符。",
    reason: "说明团队职责、使用范围与创建目的；原因将写入组织审计。",
    query: "匹配团队名称、负责人邮箱或流程键，不搜索团队成员名单。",
    sort: "仅排序已加载的团队；成员数或更新时间相同时按名称排列。",
    member: "选择本次操作对象，不表示其已属于团队。锁定账号仍可能属于活动成员。",
  };
  function decorate() {
    for (const field of fields) {
      const input = $(field.selector);
      if (!input || input.dataset.fieldReady) continue;
      input.dataset.fieldReady = "true";
      const create = field.model.startsWith("form.");
      if (create) input.disabled = false;
      const container = create
        ? input.parentElement
        : field.id === "member"
          ? $(".membership")
          : input.parentElement;
      container.dataset.field = field.id;
      const description = document.createElement("small");
      description.id = `${field.id}-field-help`;
      description.className = "field-help";
      description.textContent = help[field.id];
      input.after(description);
      const errorId = {
        name: "name-error",
        lead: "lead-error",
        workflow: "workflow-error",
        reason: "create-reason-error",
      }[field.id];
      const error = errorId ? $(`#${errorId}`) : null;
      const described = [description.id];
      if (error) {
        error.className = "field-error";
        error.setAttribute("aria-live", "polite");
        if (input.getAttribute("aria-invalid") !== "true") error.textContent = "";
        described.push(error.id);
      }
      let count;
      if (field.max) {
        count = document.createElement("small");
        count.id = `${field.id}-field-count`;
        count.className = "field-count";
        description.after(count);
        described.push(count.id);
      }
      input.setAttribute("aria-describedby", described.join(" "));
      const update = (clear) => {
        if (count) count.textContent = `${input.value.length}/${field.max}`;
        if (clear && error) {
          error.textContent = "";
          input.setAttribute("aria-invalid", "false");
        }
      };
      for (const event of ["input", "change"]) input.addEventListener(event, () => update(true));
      update(false);
    }
    const form = $("#create-form");
    if (form && api.state().busy === "create" && !$("#field-pending")) {
      const notice = document.createElement("p");
      notice.id = "field-pending";
      notice.setAttribute("role", "status");
      notice.textContent =
        "正在提交已确认内容，暂不能再次提交或取消。字段仍可编辑；后续草稿的完成处理不在本图演示。";
      form.setAttribute("aria-busy", "true");
      form.querySelector("footer").before(notice);
    }
  }
  new MutationObserver(decorate).observe($("#workspace"), { childList: true, subtree: true });
  function fill(input, value) {
    input.value = value;
    input.dispatchEvent(
      new Event(input.id === "team-member-select" ? "change" : "input", { bubbles: true }),
    );
    decorate();
  }
  function person(which) {
    const members = api.state().members.filter((m) => m.status === "active");
    if (which === "locked") return members.find((m) => m.account_status === "locked").id;
    return members.find((m) =>
      m.roles.includes(which === "admin" ? "organization_admin" : "procurement_member"),
    ).id;
  }
  function prepare(id, variant = "default") {
    if (combinations[id]) {
      api.scene(combinations[id][0]);
      decorate();
      if (id === "create-boundary") fill($("#team-reason"), "因".repeat(500));
      if (id === "member-archived") fill($("#team-member-select"), person("buyer"));
      return;
    }
    const field = fields.find((f) => f.id === id);
    if (!field || !field.states.includes(variant)) throw Error("Unknown field/state");
    api.scene(
      field.model.startsWith("form.")
        ? variant === "pending"
          ? "create_busy"
          : "create_draft"
        : id === "member"
          ? variant === "pending"
            ? "member_busy"
            : variant === "archived"
              ? "archived"
              : "selected"
          : "catalog",
    );
    if (variant === "no-members") api.setMembers([]);
    decorate();
    const input = $(field.selector);
    if (["empty", "whitespace"].includes(variant)) {
      fill(input, variant === "empty" ? "" : "   ");
      if (field.required) {
        $("#create-form").requestSubmit();
        decorate();
      }
    } else if (["admin", "buyer", "locked"].includes(variant)) fill(input, person(variant));
    else if (variant === "no-members") fill(input, "");
    else if (variant === "boundary")
      fill(input, (id === "workflow" ? "k" : "界").repeat(field.max));
    else if (variant === "free-text") fill(input, "待配置流程-key");
    else if (variant === "corrected") {
      fill(input, "");
      $("#create-form").requestSubmit();
      decorate();
      fill($(field.selector), id === "name" ? "北美新品采购组" : "划分团队协作职责");
    } else if (id === "query" && !["default", "focus"].includes(variant)) {
      const row = api.state().items.find((t) => t.lead_email && t.default_workflow_key);
      fill(
        input,
        variant === "name"
          ? row.name
          : variant === "email"
            ? row.lead_email
            : variant === "workflow"
              ? row.default_workflow_key
              : "不存在的团队",
      );
      if (variant === "cleared") fill($(field.selector), "");
    } else if (id === "sort" && !["default", "focus"].includes(variant)) fill(input, variant);
    else if (id === "member" && variant === "archived") fill(input, person("buyer"));
    if (["query", "sort"].includes(id)) $("#filters").open = true;
    if (variant === "focus") $(field.selector).focus();
  }
  document.addEventListener(
    "click",
    (e) => {
      const action = e.target.closest("[data-member-action]")?.dataset.memberAction;
      if (action) document.body.dataset.reasonAction = action;
    },
    true,
  );
  const picker = $("#field-picker");
  for (const f of fields)
    for (const v of f.states) picker.add(new Option(`${f.label} / ${v}`, `${f.id}:${v}`));
  for (const [id, [, label]] of Object.entries(combinations))
    picker.add(new Option(`组合 / ${label}`, id));
  $("#field-show").onclick = () => {
    const [id, v] = picker.value.split(":");
    prepare(id, v);
    $(
      fields.find((f) => f.id === id)?.selector ||
        (id.startsWith("member") ? ".membership" : "#create-form"),
    )?.scrollIntoView({ block: "start" });
  };
  window.TEAM_FIELDS_C = { fields, combinations, prepare };
  prepare("create-ready");
})();
