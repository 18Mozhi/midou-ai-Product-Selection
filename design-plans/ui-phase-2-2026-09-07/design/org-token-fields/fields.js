(() => {
  const api = window.ORG_TOKEN_C;
  const visual = ["default", "hover", "focus"];
  const fields = [
    {
      id: "filter-query",
      model: "tokenQuery",
      kind: "query",
      help: "搜索名称、前缀、中文状态或读取范围，不搜索记录 ID。",
      variants: [...visual, "filled", "spaces", "long", "empty-result", "id-excluded"],
    },
    {
      id: "filter-status",
      model: "statusFilter",
      kind: "select",
      help: "生命周期来自已返回的记录，筛选不会撤销或轮换令牌。",
      options: ["all", "active", "expiring", "never_used", "revoked", "rotated", "expired"],
    },
    {
      id: "filter-scope",
      model: "scopeFilter",
      kind: "select",
      help: "仅筛选已有读取范围，不更改令牌授权。",
      options: ["all", ...window.ORG_TOKEN_C_DATA.scopeOptions.map((s) => s.value)],
    },
    {
      id: "filter-sort",
      model: "tokenSort",
      kind: "select",
      help: "只调整已加载记录的排列顺序。",
      options: ["created_desc", "expires_asc", "last_used_desc", "name_asc", "status_asc"],
    },
    {
      id: "create-name",
      model: "createForm.name",
      kind: "create",
      help: "按接入系统或用途命名，不填写密钥、密码或个人隐私。",
      max: 120,
      error: "name",
      variants: [...visual, "filled", "limit", "spaces", "error", "busy"],
    },
    {
      id: "create-ttl",
      model: "createForm.ttl_days",
      kind: "create",
      help: "填写 1–365 的整数天数；预计到期仅供核对，实际以响应为准。",
      error: "ttl_days",
      variants: [
        ...visual,
        "minimum",
        "maximum",
        "zero",
        "over",
        "fraction",
        "empty",
        "error",
        "busy",
      ],
    },
    {
      id: "create-reason",
      model: "createForm.reason",
      kind: "create",
      help: "说明接入系统、负责人及用途；原因会写入组织审计。",
      max: 500,
      error: "reason",
      variants: [...visual, "filled", "limit", "spaces", "error", "busy"],
    },
    {
      id: "field-scopes",
      model: "createForm.scopes",
      kind: "scopes",
      variants: ["empty", "one", "all", "error", "busy"],
    },
    ...["rotate", "revoke"].map((action) => ({
      id: `reason-${action}`,
      inputId: "reason-input",
      model: "reason",
      kind: "reason",
      action,
      help: "原因会与操作者、时间和目标一起记录；取消不会提交。",
      proposalMax: 500,
      variants: ["default", "hover", "focus", "short", "valid", "limit"],
    })),
  ];
  for (const f of fields)
    if (f.options) f.variants = [...visual, ...f.options.map((v) => `option-${v}`)];
  function decorate() {
    const main = document.querySelector(".main");
    if (!main || main.dataset.fieldsReady) return;
    main.dataset.fieldsReady = "pending";
    const active = document.activeElement;
    const selection =
      active?.tagName === "INPUT" && active.type === "search"
        ? [active.selectionStart, active.selectionEnd]
        : null;
    const filters = document.querySelector(".filters");
    if (filters) {
      const region = document.createElement("div");
      region.className = "field-review-region";
      filters.parentElement.prepend(region);
      for (const selector of [".paper-head", "#filters-toggle", ".filters", ".count"])
        region.append(document.querySelector(`#catalog ${selector}`));
      const actions = document.createElement("div");
      actions.className = "field-actions";
      const note = document.createElement("small");
      note.textContent = "仅重置筛选和排序，返回第 1 页。";
      actions.append(note, document.querySelector("#reset"));
      filters.append(actions);
    }
    const group = document.querySelector(".scope-group");
    if (group) group.id = "field-scopes";
    const nameLabel = document.getElementById("create-name")?.closest("label");
    const duration = document.querySelector(".duration");
    if (nameLabel && duration) nameLabel.after(duration);
    const added = new Set();
    for (const f of fields) {
      const input = document.getElementById(f.inputId ?? f.id);
      if (!input || f.kind === "scopes" || added.has(input.id)) continue;
      added.add(input.id);
      if (f.kind === "reason")
        document.querySelectorAll(".reason-body > small").forEach((n) => n.remove());
      const label = input.closest("label");
      const title = document.createElement("span");
      title.id = `${input.id}-label`;
      title.textContent = label.firstChild.textContent;
      label.replaceChild(title, label.firstChild);
      label.querySelectorAll(":scope > small").forEach((n) => n.remove());
      const help = document.createElement("small");
      help.id = `${input.id}-help`;
      help.className = "field-help";
      const update = () => {
        help.textContent = f.help;
        if (f.max) {
          const counter = document.createElement("span");
          counter.className = "field-count";
          counter.textContent = `${input.value.length} / ${f.max}`;
          help.append(counter);
        }
      };
      update();
      label.append(help);
      input.addEventListener("input", update);
      input.setAttribute("aria-labelledby", title.id);
      const error = f.error && document.getElementById(`error-${f.error}`);
      input.setAttribute("aria-describedby", [help.id, error?.id].filter(Boolean).join(" "));
      if (error) input.setAttribute("aria-invalid", "true");
      if (f.kind === "create") input.required = true;
    }
    if (active && main.contains(active)) {
      active.focus({ preventScroll: true });
      if (selection) active.setSelectionRange(...selection);
    }
  }
  function prepare(id, variant = "default") {
    const f = fields.find((f) => f.id === id);
    if (!f || !f.variants.includes(variant)) throw Error("Unknown field/state");
    let scene =
      f.kind === "reason"
        ? `reason_${f.action}`
        : f.kind === "create" || f.kind === "scopes"
          ? "create"
          : "normal";
    if (variant === "busy") scene = "create_busy";
    if (variant === "error") scene = f.id === "create-ttl" ? "create_ttl_error" : "create_required";
    api.scene(scene);
    decorate();
    const $ = (s) => document.querySelector(s);
    if (f.id.startsWith("filter-") && !api.state().filtersOpen) $("#filters-toggle").click();
    decorate();
    const set = (value) => {
      const input = document.getElementById(f.inputId ?? f.id);
      input.value = String(value);
      input.dispatchEvent(new Event(f.kind === "select" ? "change" : "input", { bubbles: true }));
      decorate();
    };
    if (f.kind === "query") {
      const values = {
        filled: "月度",
        spaces: "   ",
        long: "样".repeat(220),
        "empty-result": "不存在的接入系统",
        "id-excluded": api.state().tokens[0].id,
      };
      if (Object.hasOwn(values, variant)) set(values[variant]);
    }
    if (f.kind === "select" && variant.startsWith("option-")) set(variant.slice(7));
    if (f.kind === "create" && !["busy", "error"].includes(variant)) {
      const values =
        f.id === "create-ttl"
          ? { minimum: 1, maximum: 365, zero: 0, over: 366, fraction: 1.5, empty: "" }
          : {
              filled: f.id === "create-name" ? "月度经营只读接入" : "核对报表接入用途",
              limit: "样".repeat(f.max),
              spaces: "   ",
            };
      if (Object.hasOwn(values, variant)) set(values[variant]);
    }
    if (f.kind === "scopes" && ["one", "all"].includes(variant)) {
      for (let i = 0; i < (variant === "one" ? 1 : 4); i++) $(`#scope-${i}`).click();
      decorate();
    }
    if (f.kind === "reason" && ["short", "valid", "limit"].includes(variant))
      set(variant === "short" ? "字" : variant === "valid" ? "定期核对接入用途" : "样".repeat(500));
    $("#field-picker").value = id;
    return f;
  }
  function selectField(id) {
    const state = document.querySelector("#field-state");
    state.replaceChildren();
    for (const v of fields.find((f) => f.id === id).variants) state.add(new Option(v, v));
    prepare(id, state.value);
  }
  new MutationObserver(decorate).observe(document.getElementById("app"), { childList: true });
  const picker = document.querySelector("#field-picker");
  for (const f of fields)
    picker.add(new Option(f.model + (f.action ? ` / ${f.action}` : ""), f.id));
  picker.onchange = (e) => selectField(e.target.value);
  document.querySelector("#field-state").onchange = (e) => prepare(picker.value, e.target.value);
  window.ORG_TOKEN_FIELDS_C = { fields, prepare, decorate };
  decorate();
  selectField(fields[0].id);
})();
