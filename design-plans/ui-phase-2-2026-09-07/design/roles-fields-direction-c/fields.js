/* Field-only proposal. Native constraints and reviewed frontend/backend boundaries, no API. */
(() => {
  const $ = (id) => document.getElementById(id),
    data = window.SCOUTOPS_ROLE_DESIGN,
    clock = Date.parse(data.reviewNow);
  const definitions = [
    [
      "role-query",
      "roleQuery",
      "搜索角色或能力",
      "roles",
      "query",
      "只搜索已加载角色名称、描述和中文能力。",
    ],
    [
      "capability-query",
      "capabilityQuery",
      "搜索能力",
      "roles",
      "query",
      "中文动作及技术能力名称；不改变角色权限。",
    ],
    [
      "capability-group",
      "capabilityGroup",
      "能力业务域",
      "roles",
      "select",
      "只选择已加载能力的业务域。",
    ],
    [
      "member-query",
      "scopeQuery",
      "搜索成员",
      "scopes",
      "query",
      "仅已加载成员的姓名、邮箱、团队。",
    ],
    [
      "scope-filter",
      "scopeFilter",
      "数据范围",
      "scopes",
      "select",
      "四种范围可重叠，不是互斥成员总数。",
    ],
    [
      "grant-query",
      "grantQuery",
      "当前页授权搜索",
      "grants",
      "query",
      "仅当前页；不搜索资源编号、授权编号或原因。",
    ],
    [
      "workspace",
      "grantForm.workspace_id",
      "工作区",
      "create-opportunity",
      "select",
      "只选择当前工作区列表；本样本只有一个工作区。",
    ],
    [
      "resource-type",
      "grantForm.resource_type",
      "资源类型",
      "create-opportunity",
      "select",
      "切换类型将动作重置为该类型首项；不清资源编号。",
    ],
    [
      "resource-id",
      "grantForm.resource_id",
      "资源编号",
      "create-opportunity",
      "uuid",
      "保留从真实资源详情页复制 UUID；格式正确不等于资源可访问。",
    ],
    [
      "member-target",
      "grantForm.grantee_membership_id",
      "目标成员",
      "create-opportunity",
      "select",
      "只选择可授予列表中的同组织活动成员，不扩大读取权限。",
    ],
    [
      "grant-actions",
      "grantForm.actions",
      "最小必要动作",
      "create-opportunity",
      "actions",
      "至少选择一项该类型允许的动作。",
    ],
    [
      "create-reason",
      "grantForm.reason",
      "创建业务原因",
      "create-opportunity",
      "reason",
      "必填且去首尾空白，最多500字；不是撤销窗的至少2字规则。",
    ],
    [
      "expires-at",
      "grantForm.expires_at",
      "授权到期时间",
      "create-opportunity",
      "expiry",
      "必须晚于固定审核时钟且不超过30天；生产按提交时当前时间校验。",
    ],
    [
      "extend-reason",
      "grantMutation.reason",
      "延期变更原因",
      "grants",
      "reason",
      "必填且最多500字；尚未提交的草稿不等于审计记录。",
    ],
    [
      "extend-expiry",
      "grantMutation.expires_at",
      "新到期时间",
      "grants",
      "extend",
      "既有后端规则：晚于原到期时间，且距当前时间不超过30天。",
    ],
    [
      "revoke-reason",
      "reason",
      "撤销原因",
      "revoke",
      "shared",
      "前端去空白至少2字且无长度上限；授权API仍限制500字。",
    ],
  ];
  const options = {
    "capability-group": { governance: "组织治理", audit: "安全审计" },
    "scope-filter": {
      own: "own",
      team: "team",
      workspace: "workspace",
      organization: "organization",
    },
    "resource-type": {
      task: "task",
      opportunity: "opportunity",
      competitor: "competitor",
      sourcing: "sourcing",
    },
    "member-target": { empty: "", selected: data.grantTargets[0] },
  };
  const fields = definitions.map(([id, binding, label, scene, kind, help]) => ({
    id,
    binding,
    label,
    scene,
    kind,
    help,
    selector: kind === "actions" ? "#grant-actions label:first-child input" : `#${id}`,
    states: [
      "default",
      "hover",
      "focus",
      ...(kind === "select"
        ? Object.keys(options[id] ?? {})
        : kind === "query"
          ? ["filled", "empty-results"]
          : kind === "actions"
            ? ["none", "all"]
            : kind === "uuid"
              ? ["empty", "invalid", "filled", "pending"]
              : kind === "reason"
                ? ["empty", "spaces", "limit", "pending"]
                : kind === "shared"
                  ? ["short", "spaces", "long"]
                  : [
                      "past",
                      "over-limit",
                      ...(kind === "extend" ? ["not-extended"] : []),
                      "pending",
                    ]),
    ],
  }));
  function expiryError(el, extend) {
    const n = Date.parse(el.value + "+08:00");
    if (!Number.isFinite(n) || n <= clock) return "请选择晚于当前校验时钟的时间。";
    if (n - clock > 30 * 86400000) return "授权有效期不能超过30天。";
    if (extend && n <= Date.parse(data.grant.expires_at))
      return "新到期时间必须晚于当前授权的到期时间。";
    return "";
  }
  function errorFor(c) {
    const el = $(c.id),
      v = el.value?.trim() ?? "";
    if (c.kind === "uuid")
      return !v
        ? "请从真实资源详情页复制资源编号。"
        : new RegExp(`^(?:${el.pattern})$`).test(v)
          ? ""
          : "资源编号格式不正确，请重新复制完整 UUID。";
    if (c.kind === "reason")
      return !v ? "请填写业务原因。" : v.length > 500 ? "原因最多500字。" : "";
    if (c.kind === "shared") return v.length < 2 ? "撤销原因至少需要2个字。" : "";
    if (c.kind === "actions")
      return el.querySelector(":checked") ? "" : "至少选择一项最小必要动作。";
    if (["expiry", "extend"].includes(c.kind)) return expiryError(el, c.kind === "extend");
    if (c.kind === "select" && el.required && !v) return "请选择一项有效选项。";
    return "";
  }
  function decorate() {
    for (const c of fields) {
      const el = $(c.id),
        anchor = c.kind === "actions" ? el.closest("fieldset") : el;
      let help = $(`help-${c.id}`),
        error = $(`error-${c.id}`);
      if (!help) {
        help = document.createElement("p");
        help.id = `help-${c.id}`;
        help.className = "field-help";
        anchor.after(help);
        error = document.createElement("p");
        error.id = `error-${c.id}`;
        error.className = "field-error";
        error.hidden = true;
        error.setAttribute("aria-live", "polite");
        help.after(error);
      }
      help.textContent =
        c.help + (["reason", "shared"].includes(c.kind) ? ` 已输入${el.value.length}字。` : "");
      const targets = c.kind === "actions" ? [anchor, ...el.querySelectorAll("input")] : [el];
      targets.forEach((t) => t.setAttribute("aria-describedby", `${help.id} ${error.id}`));
    }
  }
  function validate(c) {
    decorate();
    const text = errorFor(c),
      el = $(c.id),
      error = $(`error-${c.id}`);
    error.textContent = text;
    error.hidden = !text;
    (c.kind === "actions" ? el.closest("fieldset") : el).setAttribute(
      "aria-invalid",
      String(Boolean(text)),
    );
    return text;
  }
  function prepare(id, mode = "default") {
    const c = fields.find((f) => f.id === id);
    if (!c || !c.states.includes(mode)) throw new Error("Unknown field/state");
    const entry =
      c.scene === "revoke"
        ? "reason-confirm"
        : c.scene === "scopes"
          ? "scope-reset"
          : c.scene === "roles"
            ? "role-technical-closed"
            : c.scene === "grants"
              ? "extend"
              : "create-opportunity";
    window.ROLES_CONTROLS_C.prepare(entry, mode === "pending" ? "busy" : "default");
    if (c.scene === "scopes") {
      $("member-query").value = "";
      $("member-query").dispatchEvent(new Event("input"));
    }
    document.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
    document.querySelectorAll(".field-error").forEach((n) => {
      n.hidden = true;
      n.textContent = "";
    });
    let el = $(id);
    if (Object.hasOwn(options[id] ?? {}, mode)) {
      el.value = options[id][mode];
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (mode === "filled") {
      el.value =
        c.kind === "uuid"
          ? data.grant.resource_id
          : id === "grant-query"
            ? "采购"
            : id === "member-query"
              ? "采购"
              : "审计";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (mode === "empty-results") {
      el.value = "无匹配示例";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (mode === "empty") el.value = "";
    if (mode === "spaces") el.value = "   ";
    if (mode === "invalid") el.value = "不是完整UUID";
    if (mode === "short") el.value = "无";
    if (mode === "limit") el.value = "因".repeat(500);
    if (mode === "long") el.value = "因".repeat(501);
    if (mode === "past") el.value = "2026-08-28T18:00";
    if (mode === "over-limit") el.value = "2026-09-28T18:00";
    if (mode === "not-extended") el.value = "2026-09-01T18:00";
    if (["none", "all"].includes(mode))
      el.querySelectorAll("input").forEach((n) => (n.checked = mode === "all"));
    if (!["query", "select"].includes(c.kind))
      el.dispatchEvent(new Event(c.kind === "actions" ? "change" : "input", { bubbles: true }));
    decorate();
    if (!["default", "hover", "focus", "pending"].includes(mode)) validate(c);
    if (mode === "pending") {
      $(c.scene === "grants" ? "extend-submit" : "create-submit").disabled = true;
    }
  }
  document.addEventListener("input", (e) => {
    const c = fields.find((f) => f.id === e.target.id);
    if (c) validate(c);
  });
  document.addEventListener("change", (e) => {
    decorate();
    const c = fields.find(
      (f) => f.id === e.target.id || (f.kind === "actions" && e.target.closest("#grant-actions")),
    );
    if (c) validate(c);
  });
  for (const [id, kinds] of [
    ["create-form", ["uuid", "reason", "expiry", "actions", "select"]],
    ["extend-form", ["reason", "extend"]],
    ["revoke-form", ["shared"]],
  ])
    $(id).addEventListener(
      "submit",
      (e) => {
        const applicable = fields.filter((f) => kinds.includes(f.kind) && $(id).contains($(f.id)));
        if (applicable.some((c) => Boolean(validate(c)))) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  decorate();
  window.ROLES_FIELDS_C = { fields, prepare, validate };
})();
