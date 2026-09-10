(() => {
  const api = window.WORKSPACES_C;
  const $ = (s) => document.querySelector(s);
  const fields = [
    {
      id: "name",
      model: "form.name",
      selector: "#workspace-name",
      label: "工作区名称",
      max: 120,
      states: ["default", "focus", "empty", "whitespace", "boundary", "corrected", "pending"],
    },
    {
      id: "slug",
      model: "form.slug",
      selector: "#workspace-slug",
      label: "英文标识",
      max: 63,
      states: [
        "default",
        "focus",
        "empty",
        "uppercase",
        "leading-hyphen",
        "trailing-hyphen",
        "single",
        "boundary",
        "corrected",
        "pending",
      ],
    },
    {
      id: "reason",
      model: "form.reason",
      selector: "#workspace-reason",
      label: "创建原因",
      max: 500,
      states: ["default", "focus", "empty", "whitespace", "boundary", "corrected", "pending"],
    },
    {
      id: "query",
      model: "query",
      selector: "#query",
      label: "搜索工作区",
      states: ["default", "focus", "typed", "no-result", "cleared"],
    },
    {
      id: "sort",
      model: "sort",
      selector: "#sort",
      label: "排序",
      states: ["default", "focus", "name_asc", "members_desc", "updated_desc"],
    },
  ];
  const compositions = {
    "create-empty": ["create", "新建空表单"],
    "create-ready": ["create_draft", "填写完成"],
    "create-invalid": ["create_required", "三个必填错误"],
    "create-slug-invalid": ["create_invalid", "英文标识错误"],
    "create-boundary": ["create_long", "三个字段长度边界"],
    "create-pending": ["create_busy", "提交中仍可编辑"],
    "create-failed": ["create_failure", "失败保留草稿"],
    "create-conflict": ["create_conflict", "标识冲突反馈"],
  };
  const labels = {
    name: "使用业务名称，便于成员识别。",
    slug: "1–63位小写字母、数字或连字符；首尾不能是连字符。",
    reason: "说明业务范围、使用团队和创建目的；原因将写入审计记录。",
  };
  function decorate() {
    const form = $("#create-form");
    if (!form || form.dataset.fieldsReady) return;
    form.dataset.fieldsReady = "true";
    for (const field of fields.filter((f) => f.max)) {
      const input = $(field.selector),
        label = form.querySelector(`label[for="${input.id}"]`);
      const group = document.createElement("div");
      group.className = "field-group";
      group.dataset.field = field.id;
      label.before(group);
      group.append(label, input);
      // Unlike the old proposal, source Vue leaves fields editable while submitting.
      input.disabled = false;
      const help = document.createElement("small");
      help.id = `${field.id}-field-help`;
      help.className = "field-help";
      help.textContent = labels[field.id];
      const count = document.createElement("small");
      count.id = `${field.id}-field-count`;
      count.className = "field-count";
      const error = $(`#${field.id}-error`);
      error.setAttribute("aria-live", "polite");
      group.append(help, count, error);
      input.setAttribute("aria-describedby", `${help.id} ${count.id} ${error.id}`);
      const update = (clear) => {
        count.textContent = `${input.value.length}/${field.max}`;
        if (clear) {
          error.textContent = "";
          input.setAttribute("aria-invalid", "false");
        }
      };
      input.addEventListener("input", () => update(true));
      update(false);
    }
    $("#slug-help")?.remove();
    if (api.state().busy === "create") {
      form.setAttribute("aria-busy", "true");
      const pending = document.createElement("p");
      pending.id = "create-pending";
      pending.setAttribute("role", "status");
      pending.textContent =
        "正在提交已确认的内容，暂不能再次提交或取消。字段仍可编辑；本状态图不演示后续草稿的完成处理。";
      form.querySelector("footer").prepend(pending);
    }
  }
  new MutationObserver(decorate).observe($("#workspace"), { childList: true, subtree: true });
  function fill(input, value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function prepare(id, state) {
    if (compositions[id]) {
      api.scene(compositions[id][0]);
      decorate();
      if (id === "create-boundary") fill($("#workspace-reason"), "因".repeat(500));
      return;
    }
    const field = fields.find((f) => f.id === id);
    if (!field || !field.states.includes(state)) throw Error("Unknown field state");
    api.scene(field.max ? (state === "pending" ? "create_busy" : "create_draft") : "catalog");
    decorate();
    const input = $(field.selector);
    if (["empty", "whitespace", "uppercase", "leading-hyphen", "trailing-hyphen"].includes(state)) {
      fill(
        input,
        {
          empty: "",
          whitespace: "   ",
          uppercase: "North",
          "leading-hyphen": "-north",
          "trailing-hyphen": "north-",
        }[state],
      );
      $("#create-form").requestSubmit();
      decorate();
    } else if (state === "boundary") fill(input, (id === "slug" ? "a" : "界").repeat(field.max));
    else if (state === "single") fill(input, "a");
    else if (state === "corrected") {
      fill(input, "");
      $("#create-form").requestSubmit();
      decorate();
      fill(
        $(field.selector),
        id === "slug" ? "north-america" : id === "name" ? "北美新品决策" : "划分新品团队的数据边界",
      );
    } else if (id === "query" && ["typed", "no-result", "cleared"].includes(state)) {
      fill(input, state === "no-result" ? "不存在的工作区" : "北美");
      if (state === "cleared") fill($(field.selector), "");
    } else if (id === "sort" && state !== "default" && state !== "focus") fill(input, state);
    if (state === "focus") $(field.selector).focus();
  }
  const picker = $("#field-scene");
  for (const f of fields)
    for (const s of f.states) picker.add(new Option(`${f.label} / ${s}`, `${f.id}:${s}`));
  for (const [id, [, label]] of Object.entries(compositions))
    picker.add(new Option(`表单 / ${label}`, id));
  $("#field-show").onclick = () => {
    const [id, state] = picker.value.split(":");
    prepare(id, state);
    $(fields.find((f) => f.id === id)?.selector || "#create-form")?.scrollIntoView({
      block: "start",
    });
  };
  window.WORKSPACE_FIELDS_C = { fields, compositions, prepare };
  prepare("create-ready");
})();
