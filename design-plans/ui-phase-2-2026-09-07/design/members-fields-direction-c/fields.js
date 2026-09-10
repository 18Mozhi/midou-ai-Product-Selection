/* Reuse the C layout; invitations retain the parent flow. Shared reason follows current source,
   replacing only the older proposal's unapproved 500-character limit in this isolated child. */
(() => {
  const api = window.MEMBERS_C,
    D = window.MEMBERS_C_DATA;
  const $ = (s) => document.querySelector(s);
  const touched = new Set();
  let reasonIntents = [];
  const buyer = D.members.items[1].id;
  const definitions = [
    [
      "emails",
      "邀请邮箱",
      "#invite-emails",
      "form.emails",
      "支持换行、逗号或分号；重复邮箱合并。格式不合格的项单独报错，合法项仍按原流程处理。",
      "invite_form",
    ],
    [
      "invite-role",
      "邀请角色",
      "#invite-role",
      "form.role_code",
      "固定五种角色；创建邀请不等于已发送邮件。",
      "invite_form",
    ],
    [
      "invite-reason",
      "邀请原因",
      "#invite-reason",
      "form.reason",
      "必填，去掉首尾空白后 1–500 个字符。与共享原因窗的规则不同。",
      "invite_form",
    ],
    [
      "query",
      "姓名或邮箱搜索",
      "#filter-query",
      "memberQuery",
      "只搜索已加载成员的姓名或邮箱，不请求其他字段。",
      "filters_open",
    ],
    [
      "status",
      "有效状态",
      "#filter-status",
      "memberStatus",
      "成员关系状态优先，再考虑账号锁定或停用。",
      "filters_open",
    ],
    [
      "role",
      "角色筛选",
      "#filter-role",
      "memberRole",
      "按成员角色集合筛选，不改变成员角色。",
      "filters_open",
    ],
    [
      "team",
      "团队筛选",
      "#filter-team",
      "memberTeam",
      "选项只来自已加载成员的团队，不读取团队目录。",
      "filters_open",
    ],
    [
      "sort",
      "成员排序",
      "#filter-sort",
      "memberSort",
      "只对当前已加载成员排序，筛选变化回到第一页。",
      "filters_open",
    ],
    [
      "row-role",
      "单行角色选择",
      `#role-${buyer}`,
      "memberRoles[member.id] || member.roles[0] || 'member'",
      "选择不立即写入；分配角色需要原因确认，且会替换已有角色。",
      "normal",
    ],
    [
      "shared-reason",
      "共享审计原因",
      "#reason-input",
      "reason",
      "去掉首尾空白后至少 2 个字，请填写本次调整的具体依据。",
      "reason_role",
    ],
  ];
  const labels = {
    default: "默认",
    focus: "键盘焦点",
    empty: "留空",
    invalid: "邮箱格式错误",
    mixed: "合法与无效混合",
    normalized: "大小写与重复",
    boundary254: "单邮箱254字符",
    boundary255: "单邮箱255字符",
    corrected: "修正后",
    editable: "写入中仍可编辑",
    whitespace: "仅空白",
    boundary500: "500字符",
    injected501: "脚本写入501字符（非用户输入）",
    short: "不足2字",
    long501: "501字符无前端上限",
    typed: "输入姓名",
    no_result: "未命中",
  };
  const fields = definitions.map(([id, label, selector, binding, help, scene]) => {
    const el = $(selector),
      select = el.tagName === "SELECT";
    const options = select
      ? [...el.options].map((o) => ({ value: o.value, label: o.textContent }))
      : [];
    const states = select
      ? ["default", "focus", "editable", ...options.map((_, i) => `option_${i}`)]
      : {
          emails: [
            "default",
            "focus",
            "empty",
            "invalid",
            "mixed",
            "normalized",
            "boundary254",
            "boundary255",
            "corrected",
            "editable",
          ],
          "invite-reason": [
            "default",
            "focus",
            "empty",
            "whitespace",
            "boundary500",
            "injected501",
            "corrected",
            "editable",
          ],
          query: ["default", "focus", "empty", "typed", "no_result", "editable"],
          "shared-reason": ["default", "focus", "empty", "short", "corrected", "long501"],
        }[id];
    return {
      id,
      label,
      selector,
      binding,
      help,
      scene,
      select,
      options,
      states,
      stateLabels: Object.fromEntries(
        states.map((s) => [
          s,
          s.startsWith("option_") ? `选中：${options[Number(s.slice(7))].label}` : labels[s],
        ]),
      ),
    };
  });
  function emailParts(value) {
    const raw = value
      .split(/[\n,;]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    const unique = [...new Set(raw)];
    return {
      raw,
      unique,
      invalid: unique.filter((v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || v.length > 254),
    };
  }
  function errorFor(f, el) {
    if (!touched.has(f.id)) return "";
    if (f.id === "emails") {
      const p = emailParts(el.value);
      return !p.unique.length
        ? "请填写至少一个邮箱。"
        : p.invalid.length
          ? `有 ${p.invalid.length} 个邮箱格式或长度不合格；合法项不会因此被整批阻止。`
          : "";
    }
    if (f.id === "invite-reason")
      return !el.value.trim() || el.value.trim().length > 500
        ? "请填写 1–500 个字符的邀请原因（首尾空白不计）。"
        : "";
    if (f.id === "shared-reason")
      return el.value.trim().length < 2 ? "请填写至少 2 个字的原因（首尾空白不计）。" : "";
    return "";
  }
  function decorate() {
    for (const f of fields) {
      const el = $(f.selector);
      if (!el) continue;
      const helpId = `field-${f.id}-help`,
        errorId = `field-${f.id}-error`,
        countId = `field-${f.id}-count`;
      let help = document.getElementById(helpId),
        error = document.getElementById(errorId);
      if (!help) {
        help = document.createElement("p");
        help.id = helpId;
        help.className = "field-help";
        help.textContent = f.help;
        if (f.id === "row-role") el.parentElement.after(help);
        else if (el.parentElement.tagName === "LABEL") {
          const label = el.parentElement,
            group = document.createElement("div");
          group.className = "field-group";
          label.before(group);
          group.append(label, help);
        } else el.after(help);
      }
      if (!error) {
        error = document.createElement("p");
        error.id = errorId;
        error.className = "field-error";
        error.setAttribute("aria-live", "polite");
        error.setAttribute("aria-atomic", "true");
        help.after(error);
      }
      const message = errorFor(f, el);
      error.textContent = message;
      error.hidden = !message;
      el.setAttribute("aria-invalid", String(Boolean(message)));
      const described = [helpId, errorId];
      if (["emails", "invite-reason", "shared-reason"].includes(f.id)) {
        let count = document.getElementById(countId);
        if (!count) {
          count = document.createElement("p");
          count.id = countId;
          count.className = "field-count";
          error.after(count);
        }
        const parts = f.id === "emails" ? emailParts(el.value) : null;
        count.textContent = parts
          ? `${parts.unique.length} 个去重邮箱 · ${parts.raw.length - parts.unique.length} 条重复`
          : `${el.value.length}${f.id === "invite-reason" ? " / 500" : ""} 字符`;
        described.push(countId);
      }
      if (f.id === "shared-reason") described.push("reason-help");
      el.setAttribute("aria-describedby", described.join(" "));
    }
  }
  function assign(f, value) {
    const el = $(f.selector);
    el.value = value;
    el.dispatchEvent(new Event(f.select ? "change" : "input", { bubbles: true }));
    // Source select emits on change; the older offline filter controller listens to input.
    if (f.select && el.dataset.filter) el.dispatchEvent(new Event("input", { bubbles: true }));
    touched.add(f.id);
    decorate();
  }
  function prepare(id, state = "default") {
    const f = fields.find((f) => f.id === id);
    if (!f || !f.states.includes(state)) throw new Error("Unknown field state");
    touched.clear();
    reasonIntents = [];
    api.scene(state === "editable" ? "invite_busy" : f.scene);
    if (state === "editable" && f.scene === "filters_open") $("#filters-panel").open = true;
    decorate();
    const value = state.startsWith("option_")
      ? f.options[Number(state.slice(7))].value
      : {
          empty: "",
          invalid: "bad",
          mixed: "good@example.test;bad",
          normalized: " GOOD@example.test ;good@example.test\nsecond@example.test",
          boundary254: "a".repeat(241) + "@example.test",
          boundary255: "a".repeat(242) + "@example.test",
          whitespace: "   ",
          boundary500: "因".repeat(500),
          injected501: "因".repeat(501),
          short: "短",
          long501: "因".repeat(501),
          typed: "陈",
          no_result: "没有这样的成员",
        }[state];
    if (value !== undefined) assign(f, value);
    if (state === "corrected") assign(f, f.id === "emails" ? "bad" : " ");
    $("#field-select").value = id;
    populateModes(f, state);
    $("#field-note").textContent = `${f.label} / ${f.stateLabels[state]}，离线设计提案，未获审。`;
  }
  function populateModes(f, state = "default") {
    $("#field-mode").replaceChildren(...f.states.map((s) => new Option(f.stateLabels[s], s)));
    $("#field-mode").value = state;
  }
  // Current shared Vue submit only enforces trim >= minimumLength. Keep that contract in this
  // isolated proposal and record a separate intention; no service call or success claim is made.
  $("#reason-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const reason = $("#reason-input").value.trim(),
        d = api.state().dialog;
      touched.add("shared-reason");
      decorate();
      if (reason.length < 2 || !d) return;
      const url =
        d.action === "revoke"
          ? `/org/admin/invitations/${d.item.id}/actions`
          : `/org/admin/members/${d.item.id}/${d.action === "role" ? "roles" : "actions"}`;
      reasonIntents.push({
        url,
        method: "POST",
        body: {
          ...(d.action === "role" ? { role_code: d.role } : { action: d.action }),
          expected_version: d.item.version,
          reason,
        },
      });
      $("#reason-cancel").click();
      $("#field-note").textContent =
        "仅记录当前共享前端的提交意图，窗口已关闭；未访问服务，不代表服务端接受长原因。";
      $("#intent-log").textContent = JSON.stringify(reasonIntents, null, 2);
    },
    true,
  );
  document.addEventListener("input", (event) => {
    const f = fields.find((f) => event.target.matches(f.selector));
    if (f) touched.add(f.id);
    decorate();
  });
  document.addEventListener("change", decorate);
  $("#scene-picker").addEventListener("change", () => {
    touched.clear();
    reasonIntents = [];
    decorate();
  });
  new MutationObserver(decorate).observe($("#workspace"), { childList: true });
  for (const f of fields) $("#field-select").add(new Option(f.label, f.id));
  $("#field-select").onchange = () =>
    populateModes(fields.find((f) => f.id === $("#field-select").value));
  $("#show-field").onclick = () => {
    const id = $("#field-select").value;
    prepare(id, $("#field-mode").value);
    $(fields.find((f) => f.id === id).selector).scrollIntoView({ block: "center" });
  };
  populateModes(fields[0]);
  decorate();
  window.MEMBERS_FIELDS_C = {
    fields,
    prepare,
    assign: (id, value) =>
      assign(
        fields.find((f) => f.id === id),
        value,
      ),
    state: () => ({ reasonIntents: structuredClone(reasonIntents) }),
    decorate,
  };
})();
