(() => {
  "use strict";
  const D = window.ORG_PROFILE_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    fmt = (v) =>
      v == null ? "未取得数据" : typeof v === "number" ? v.toLocaleString("zh-CN") : String(v),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "未取得时间"),
    fields = [
      "name",
      "logo_url",
      "timezone",
      "data_retention_days",
      "default_workspace_id",
      "reason",
    ],
    paths = ["/org/admin/summary", "/org/admin/profile", "/org/admin/workspaces"];
  let state,
    generation = 0;
  const scenes = {
    normal: "当前资料 / 原有测试样本",
    editing: "编辑资料 / 未提交草稿",
    blank_logo: "Logo 留空",
    long_name: "长组织名称",
    long_workspace: "长工作区名称",
    missing_workspace: "默认工作区未在选项中",
    no_options: "工作区选项为空",
    archived_option: "归档工作区仍在源选项中",
    zero_summary: "真实零计数",
    missing_summary: "缺失摘要不冒充零",
    loading: "首次加载",
    error: "服务错误",
    blocked: "请求超时或依赖不可用",
    expired: "登录失效",
    forbidden: "无管理权限",
    rate_limited: "请求过于频繁",
    conflict_page: "读取版本冲突",
    refreshing: "后台刷新 / 保留资料",
    refresh_error: "刷新失败 / 保留草稿",
    refresh_success: "合成刷新完成",
    dirty_refresh: "刷新覆盖未提交修改",
    save_busy: "资料保存中",
    save_error: "保存失败 / 保留输入",
    save_conflict: "版本冲突 / 保留输入",
    save_success: "合成写入及重读成功",
    write_read_failed: "合成写入已确认 / 重读失败",
    save_timeout: "保存结果未确认",
    logo_invalid: "Logo 非 HTTPS 校验",
    reason_missing: "变更原因必填",
    retention_invalid: "保留天数越界",
    timezone_invalid: "时区必填",
    name_invalid: "名称必填",
    technical: "技术详情展开",
    focus: "保存按钮键盘焦点",
    hover: "保存按钮悬停",
    pressed: "保存按钮按下",
    controls: "审核控制面板（非业务界面）",
  };
  function base() {
    return {
      profile: clone(D.profile),
      summary: clone(D.summary),
      workspaces: clone(D.workspaces),
      form: clone(D.initialForm),
      page: "ready",
      busy: "",
      note: "",
      formNote: "",
      kind: "info",
      errors: {},
      intents: [],
      mode: "intent",
      pending: null,
      recheck: false,
      dirty: false,
      scene: "normal",
      provenance:
        "现有 E2E 夹具，仅作审核样本。摘要为 8 个工作区，选项仅返回 1 项；不补造其余工作区。",
    };
  }
  function log(url, method = "GET", body) {
    state.intents.push({ url, method, ...(body === undefined ? {} : { body }) });
    $("#review-intents").textContent = JSON.stringify(state.intents, null, 2);
  }
  function technical(text) {
    return `<details class="technical"><summary>技术详情</summary><code>${esc(text)}</code></details>`;
  }
  function feedback(text, id = "page-feedback") {
    return `<div id="${id}" class="feedback" data-kind="${state.kind}" tabindex="-1" role="${state.kind === "error" ? "alert" : "status"}"><h3>${state.kind === "error" ? "需要处理" : "操作说明"}</h3><p>${esc(text)}</p>${technical("request_id: synthetic-review-only\n仅用于审核，不对应真实服务请求")}</div>`;
  }
  function workspaceName() {
    return (
      state.workspaces.find((w) => w.id === state.profile.default_workspace_id)?.name ||
      "未找到对应工作区"
    );
  }
  function field(name, label, control, hint, wide = false) {
    return `<div class="field ${wide ? "wide" : ""}"><label for="${name}">${label}</label>${control}<small id="${name}-hint">${hint}</small><p id="${name}-error" class="error" ${state.errors[name] ? "" : "hidden"}>${esc(state.errors[name] || "")}</p></div>`;
  }
  function input(name, attributes = "") {
    return `<input id="${name}" name="${name}" value="${esc(state.form[name])}" aria-describedby="${name}-hint ${name}-error" aria-invalid="${Boolean(state.errors[name])}" ${attributes}>`;
  }
  function identity() {
    const p = state.profile;
    return `<section id="identity" class="identity anchor" tabindex="-1"><header class="identity-head"><div><h2>${esc(p.name)}</h2><p>当前会话选择的组织 / 已读取资料</p></div><span class="tag">${p.status === "active" ? "正常使用" : ["archived", "disabled"].includes(p.status) ? "已停用" : "其他状态"}</span></header><dl><div><dt>组织标识</dt><dd>${esc(p.slug)}</dd></div><div><dt>时区</dt><dd>${esc(p.timezone)}</dd></div><div><dt>数据保留</dt><dd>${fmt(p.data_retention_days)} 天</dd></div><div><dt>默认工作区</dt><dd>${esc(workspaceName())}</dd></div></dl>${technical(`organization_id: ${p.id}\nversion: ${p.version}\n资料更新时间: ${time(p.updated_at)}`)}</section>`;
  }
  function form() {
    return `<section class="edit-paper"><aside class="edit-guide"><h3>更新组织资料</h3><p>填写资料和变更原因后保存；组织标识和状态保持只读。</p></aside><div class="form-area"><form id="profile-form" class="anchor" tabindex="-1">${state.formNote ? feedback(state.formNote, "form-feedback") : ""}<fieldset class="field-group"><legend>名称与标识</legend><div class="fields">${field("name", "名称", input("name", 'required maxlength="120"'), "必填，最多 120 个字符。", true)}${field("logo_url", "Logo HTTPS 地址", input("logo_url", 'type="url" pattern="https://.*" maxlength="2048" placeholder="https://…"'), "仅支持 HTTPS；留空表示暂不设置 Logo。", true)}</div></fieldset><fieldset class="field-group"><legend>数据与默认范围</legend><div class="fields">${field("timezone", "时区", input("timezone", 'required maxlength="64"'), "填写组织使用的时区，最多 64 个字符。")}${field("data_retention_days", "数据保留天数", input("data_retention_days", 'type="number" min="30" max="3650" step="1" required'), "必填，30–3650 的整数。")}${field("default_workspace_id", "默认工作区", `<select id="default_workspace_id" name="default_workspace_id" required aria-describedby="default_workspace_id-hint default_workspace_id-error" aria-invalid="${Boolean(state.errors.default_workspace_id)}"><option disabled value="" ${!state.workspaces.some((w) => w.id === state.form.default_workspace_id) ? "selected" : ""}>请选择工作区</option>${state.workspaces.map((w) => `<option value="${esc(w.id)}" ${state.form.default_workspace_id === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select>`, "选择当前组织的默认工作区；更换前不能归档原默认工作区。", true)}</div></fieldset><fieldset class="field-group"><legend>变更依据</legend><div class="fields">${field("reason", "变更原因", `<textarea id="reason" name="reason" required maxlength="500" aria-describedby="reason-hint reason-error" aria-invalid="${Boolean(state.errors.reason)}">${esc(state.form.reason)}</textarea>`, "必填，最多 500 个字符；随本次变更记录。", true)}</div></fieldset><footer class="form-actions"><p id="draft-hint">${state.recheck ? "先刷新核验结果，再决定下一次变更；不自动重复提交。" : "草稿仅保留在当前页面。刷新成功会按服务端资料重新填充，并清空原因。"}</p><button id="save-profile" type="submit" class="primary" ${state.busy === "save" || state.recheck ? "disabled" : ""}>${state.busy === "save" ? "正在保存…" : "保存并审计"}</button></footer></form></div></section>`;
  }
  function summary() {
    const s = state.summary;
    return `<section id="summary" class="summary-paper anchor" tabindex="-1"><header class="summary-head"><h3>治理摘要</h3><p>来自当前组织的已落库事实。近 7 日审计仅统计业务审计日志，不等于审计页面全部来源的记录总数。</p></header><div class="summary-columns"><table class="summary-table"><caption class="muted">当前组织规模</caption><thead><tr><th scope="col">对象</th><th scope="col">活动</th><th scope="col">全部</th></tr></thead><tbody>${[
      ["members", "成员"],
      ["workspaces", "工作区"],
      ["teams", "团队"],
    ]
      .map(
        ([key, label]) =>
          `<tr><th scope="row">${label}</th><td>${fmt(s?.[key]?.active)}</td><td>${fmt(s?.[key]?.total)}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table><dl class="summary-stats"><div><dt>待处理审批</dt><dd>${fmt(s?.pending_approvals)}</dd></div><div><dt>有效令牌</dt><dd>${fmt(s?.active_tokens)}</dd></div><div><dt>近 7 日审计</dt><dd>${fmt(s?.recent_audit_events)}</dd></div></dl></div><p class="sample-note">摘要截至 ${time(s?.observed_at)}。${esc(state.provenance)}</p></section>`;
  }
  function render() {
    const states = {
      error: "组织后台暂不可用",
      blocked: "组织数据暂不可用",
      expired: "登录已失效",
      forbidden: "无权管理当前组织",
      rate_limited: "请求过于频繁",
      conflict: "数据版本已变化",
    };
    $("#workspace").innerHTML =
      `<header class="page-head"><div><h2>组织资料</h2><p>核对当前组织，维护基本资料与默认范围。</p></div><div><small>摘要更新于 ${time(state.summary?.observed_at)}</small><button id="refresh-profile" ${state.page === "loading" || state.busy === "refresh" ? "disabled" : ""}>${state.busy === "refresh" ? "正在刷新…" : "刷新数据"}</button></div></header>${state.note ? feedback(state.note) : ""}${state.page === "loading" ? `<section class="state-panel" aria-busy="true"><h3>正在读取当前组织数据…</h3><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></section>` : state.page !== "ready" ? `<section class="state-panel"><h3>${states[state.page]}</h3><p>${state.page === "expired" ? "恢复登录后重新加载。" : state.page === "forbidden" ? "请核验组织管理及工作区读取权限，不能通过本页绕过授权。" : "未能取得完整资料与摘要，请稍后重新加载。"}</p><button id="retry-profile">重新加载</button></section>` : identity() + form() + summary()}`;
    $("#review-scene").value = state.scene;
    $("#review-note").textContent = scenes[state.scene];
    for (const name of fields)
      if (state.errors[name] && $("#" + name)) $("#" + name).setCustomValidity(state.errors[name]);
    $("#profile-form")?.addEventListener("submit", save);
    $("#refresh-profile").addEventListener("click", refresh);
    $("#retry-profile")?.addEventListener("click", refresh);
    $("#profile-form")?.addEventListener("input", edit);
    $("#profile-form")?.addEventListener("change", edit);
    $("#profile-form")?.addEventListener("invalid", invalid, true);
  }
  function edit(event) {
    const el = event.target;
    if (!fields.includes(el.name)) return;
    state.form[el.name] =
      el.name === "data_retention_days" && el.value !== "" ? Number(el.value) : el.value;
    state.dirty = true;
    delete state.errors[el.name];
    el.setCustomValidity("");
    el.setAttribute("aria-invalid", "false");
    $("#" + el.name + "-error").hidden = true;
  }
  function invalid(event) {
    const el = event.target,
      messages = {
        name: "请填写名称，最多 120 个字符。",
        logo_url: "Logo 地址必须以 https:// 开头，或保持为空。",
        timezone: "请填写时区，最多 64 个字符。",
        data_retention_days: "数据保留天数必须为 30–3650 的整数。",
        default_workspace_id: "请选择当前组织返回的工作区。",
        reason: "请填写变更原因，最多 500 个字符。",
      };
    state.errors[el.name] = messages[el.name];
    el.setCustomValidity(messages[el.name]);
    el.setAttribute("aria-invalid", "true");
    const hint = $("#" + el.name + "-error");
    hint.hidden = false;
    hint.textContent = messages[el.name];
  }
  function save(event) {
    event.preventDefault();
    if (state.busy === "save" || state.recheck) return;
    const body = { ...clone(state.form), expected_version: state.profile.version };
    log("/org/admin/profile", "PATCH", body);
    if (state.mode === "intent") {
      state.formNote = "仅记录保存意图；未向服务提交，未修改组织资料或审计。";
      state.kind = "info";
      render();
      $("#form-feedback").focus();
      return;
    }
    state.busy = "save";
    state.pending = { kind: "save", generation, body };
    render();
  }
  function refresh() {
    if (state.page === "loading" || state.busy === "refresh") return;
    for (const p of paths) log(p);
    if (state.mode === "intent") {
      state.note =
        "仅记录重新读取意图。本稿未连接服务，当前资料和草稿不变。真实刷新成功会覆盖未提交修改。";
      state.kind = "info";
      render();
      $("#page-feedback").focus();
      return;
    }
    state.busy = "refresh";
    state.pending = { kind: "refresh", generation };
    render();
  }
  function complete(outcome, token = generation) {
    if (token !== generation || !state.pending || state.pending.generation !== token) return false;
    const pending = state.pending;
    state.pending = null;
    state.busy = "";
    if (["error", "conflict", "forbidden", "timeout"].includes(outcome)) {
      state.kind = "error";
      const message =
        outcome === "conflict"
          ? "数据已被其他操作更新，请先刷新并确认最新内容。此次修改未获确认；输入保留。"
          : outcome === "timeout"
            ? "请求已超时，尚未确认保存结果。先刷新核验，不自动重复提交。"
            : "合成服务错误：本次操作未完成，请稍后重试。输入保留。";
      if (pending.kind === "save") state.formNote = message;
      else state.note = "合成刷新失败：保留上次资料与当前草稿，不冒充刷新成功。";
      if (outcome === "forbidden") state.page = "forbidden";
      if (outcome === "timeout" && pending.kind === "save") state.recheck = true;
    } else if (outcome === "read_failed" && pending.kind === "save") {
      state.formNote =
        "合成响应：写入已确认，但资料重读失败。仍显示旧资料；请刷新核验，不要再次提交同一变更。";
      state.kind = "error";
      state.recheck = true;
    } else if (outcome === "success") {
      if (pending.kind === "save")
        state.profile = {
          ...state.profile,
          ...Object.fromEntries(
            fields.filter((k) => k !== "reason").map((k) => [k, pending.body[k]]),
          ),
          version: state.profile.version + 1,
        };
      state.form = Object.fromEntries(
        fields.map((k) => [k, k === "reason" ? "" : (state.profile[k] ?? "")]),
      );
      state.errors = {};
      state.dirty = false;
      state.recheck = false;
      state.kind = "info";
      state.formNote = "";
      state.note =
        pending.kind === "save"
          ? "合成写入及重读成功，已显示新版本。此处不是实际组织变更或审计证明。"
          : "合成刷新完成：按已读取资料重新填充，未提交修改和原因已清除。";
    } else throw new Error("Unsupported synthetic completion");
    render();
    const notice = $(state.formNote ? "#form-feedback" : "#page-feedback");
    notice?.focus();
    return true;
  }
  function scene(name) {
    if (!(name in scenes)) throw new Error("Unknown scene");
    generation++;
    state = base();
    for (const link of document.querySelectorAll(".directory nav a"))
      link.setAttribute("aria-current", String(link.hash === "#identity"));
    state.scene = name;
    $("#review-intents").textContent = "未触发动作；本稿不访问服务。";
    $("#review-tools").hidden = name !== "controls";
    $("#review-toggle").setAttribute("aria-expanded", String(name === "controls"));
    if (!["normal", "technical", "controls", "focus", "hover"].includes(name))
      state.provenance = "合成审核状态，不代表真实组织、保存结果或服务状态。";
    if (
      [
        "editing",
        "save_busy",
        "save_error",
        "save_conflict",
        "save_success",
        "write_read_failed",
        "save_timeout",
        "dirty_refresh",
        "refresh_error",
      ].includes(name)
    ) {
      state.form.name = "Global Goods 新品研究组";
      state.form.reason = "核验资料后更新组织名称";
      state.dirty = true;
    }
    if (name === "blank_logo") state.form.logo_url = "";
    if (name === "long_name") {
      state.profile.name = "跨境商品与供应链联合研究组织".repeat(5);
      state.form.name = state.profile.name;
    }
    if (name === "long_workspace")
      state.workspaces[0].name = "新品决策与供应链证据核验工作区".repeat(5);
    if (name === "missing_workspace") {
      state.profile.default_workspace_id = "00000000-0000-4000-8000-000000009999";
      state.form.default_workspace_id = state.profile.default_workspace_id;
    }
    if (name === "no_options") state.workspaces = [];
    if (name === "archived_option") {
      state.workspaces[0].status = "archived";
      state.note =
        "合成选项包含归档工作区；现有前端和保存校验没有 active-only 过滤，本稿不擅自新增规则。";
    }
    if (name === "zero_summary") {
      for (const k of ["members", "workspaces", "teams"])
        state.summary[k] = { total: 0, active: 0 };
      for (const k of ["pending_approvals", "active_tokens", "recent_audit_events"])
        state.summary[k] = 0;
    }
    if (name === "missing_summary") state.summary = null;
    if (["loading", "error", "blocked", "expired", "forbidden", "rate_limited"].includes(name))
      state.page = name;
    if (name === "conflict_page") state.page = "conflict";
    if (name === "refreshing") state.busy = "refresh";
    if (name === "refresh_error") {
      state.note = "合成刷新失败：已读取资料与未提交输入保留。";
      state.kind = "error";
    }
    if (["refresh_success", "dirty_refresh"].includes(name)) {
      state.form = clone(D.initialForm);
      state.note =
        "合成刷新完成：已按服务端资料填充，未提交修改与原因已清除。请注意刷新会覆盖草稿。";
      state.dirty = false;
    }
    if (name === "save_busy") state.busy = "save";
    if (name === "save_error") {
      state.formNote = "合成 400 响应：资料未通过校验，请修正后再提交。输入已保留。";
      state.kind = "error";
    }
    if (name === "save_conflict") {
      state.formNote = "合成 409 响应：数据已被其他操作更新，请先刷新并确认最新内容。输入已保留。";
      state.kind = "error";
    }
    if (name === "save_success") {
      state.profile.name = state.form.name;
      state.profile.version = 4;
      state.form.reason = "";
      state.note = "合成写入及重读成功，版本 4。不是实际组织变更或审计证明。";
    }
    if (name === "write_read_failed") {
      state.formNote =
        "合成响应：写入已确认，但资料重读失败。仍显示旧资料；请刷新核验，不重复提交。";
      state.kind = "error";
      state.recheck = true;
    }
    if (name === "save_timeout") {
      state.formNote =
        "保存结果尚未确认。先刷新核验，不自动重复提交；这是待审交互保护，不是实际超时结果。";
      state.kind = "error";
      state.recheck = true;
    }
    const invalidFields = {
      logo_invalid: [
        "logo_url",
        "http://example.test/logo.png",
        "Logo 地址必须以 https:// 开头，或保持为空。",
      ],
      reason_missing: ["reason", "", "请填写变更原因。"],
      retention_invalid: ["data_retention_days", 29, "请输入 30–3650 的整数。"],
      timezone_invalid: ["timezone", "", "请填写时区。"],
      name_invalid: ["name", "", "请填写名称。"],
    };
    if (invalidFields[name]) {
      const [key, value, message] = invalidFields[name];
      state.form[key] = value;
      state.errors[key] = message;
    }
    render();
    window.scrollTo(0, 0);
    if (name === "technical") $("#identity details").open = true;
    if (name === "focus") $("#save-profile").focus({ preventScroll: true });
  }
  $("#review-scene").innerHTML = Object.entries(scenes)
    .map(([key, value]) => `<option value="${key}">${value}</option>`)
    .join("");
  $("#review-scene").addEventListener("change", (e) => scene(e.target.value));
  $("#review-toggle").addEventListener("click", () => {
    $("#review-tools").hidden = !$("#review-tools").hidden;
    $("#review-toggle").setAttribute("aria-expanded", String(!$("#review-tools").hidden));
  });
  $(".directory nav").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const target = $(link.hash);
    if (!target) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    target.scrollIntoView({ block: "start", behavior: "instant" });
    for (const item of document.querySelectorAll(".directory nav a"))
      item.setAttribute("aria-current", String(item === link));
    target.focus({ preventScroll: true });
  });
  scene("normal");
  window.ORG_PROFILE_C = {
    scenes,
    scene,
    complete,
    setMode: (mode) => {
      if (!["intent", "hold"].includes(mode)) throw new Error("Invalid mode");
      state.mode = mode;
    },
    state: () => clone({ ...state, generation }),
  };
})();
