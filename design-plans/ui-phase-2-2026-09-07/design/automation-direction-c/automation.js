/* Review-only prototype: no fetch, EventSource, cookies, or persistence. */
(() => {
  const D = window.AUTOMATION_C_DATA,
    clone = (v) => structuredClone(v),
    $ = (id) => document.getElementById(id),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    triggers = {
      "approval.overdue": "审批节点超时",
      "approval.node.rejected": "审批被驳回",
      "competitor.alert.queued": "竞品告警入队",
      "task.created": "任务创建",
    },
    severities = { any: "任意", info: "普通", warning: "重要", critical: "严重" },
    actions = { notify_owner: "通知负责人", create_task: "创建人工任务" },
    statuses = {
      queued: "排队中",
      leased: "执行中",
      retry_scheduled: "等待重试",
      succeeded: "已完成",
      rate_limited: "已限流",
      failed: "失败",
      dead_letter: "最终失败",
    },
    time = (v) =>
      v
        ? new Date(v).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })
        : "尚未执行",
    scenes = {
      normal: "规则目录 · 原始响应",
      paused: "已暂停规则 · 合成",
      missing_latest: "尚未执行 · 合成",
      long_rules: "长名与多规则 · 合成",
      loading: "规则读取中",
      empty: "空规则目录 · 合成",
      error: "读取失败",
      blocked: "服务受阻",
      forbidden: "无管理权限",
      expired: "登录失效",
      rate_limited: "读取限流",
      version_conflict: "读取版本冲突",
      detail: "执行记录 · 原始响应",
      executions_empty: "无执行记录 · 合成",
      execution_queued: "执行排队 · 合成",
      execution_leased: "执行处理中 · 合成",
      execution_retry: "等待重试 · 合成",
      execution_succeeded: "执行完成 · 合成",
      execution_rate: "执行限流 · 合成",
      execution_failed: "执行失败 · 合成",
      execution_dead: "执行最终失败 · 合成",
      execution_unknown: "执行未知状态 · 合成",
      execution_suppressed: "已完成但未产生动作 · 合成",
      execution_task: "关联人工任务 · 合成",
      technical: "执行技术详情",
      long_history: "最近100条执行 · 合成",
      create: "创建规则空表单",
      template_overdue: "审批超时模板",
      template_competitor: "竞品复核模板",
      template_rejected: "审批驳回模板",
      task_trigger: "任务触发循环保护",
      edit: "编辑现有规则",
      members_empty: "成员目录为空 · 合成",
      members_error: "成员目录读取失败 · 合成",
      validation: "必填校验",
      preview: "只读预览 · 原始响应",
      preview_task: "人工任务预览 · 合成",
      preview_empty: "零匹配预览 · 合成",
      preview_samples: "历史样本不限定30天 · 合成",
      preview_busy: "试运行处理中 · 合成",
      preview_error: "试运行失败 · 合成",
      preview_changed: "修改条件使预览失效",
      create_busy: "创建提交中 · 合成",
      create_error: "创建失败 · 合成",
      edit_busy: "编辑提交中 · 合成",
      edit_conflict: "编辑冲突 · 合成",
      pause_busy: "暂停提交中 · 合成",
      pause_error: "暂停失败 · 合成",
      resume_error: "恢复失败 · 合成",
      controls: "控件状态板（非业务页）",
      create_intent: "创建并启用意图",
      edit_intent: "保存修改意图",
    };
  let s,
    form = clone(D.emptyForm),
    editing = null,
    selected = null,
    reason = "",
    editorOpen = false,
    busy = false,
    previewing = false,
    preview = null,
    intents = [],
    message = "",
    editorMessage = "",
    detailMessage = "",
    invalid = [],
    mode = "intent",
    revision = 0,
    token = 0,
    held = new Map(),
    editorReturn = "create-rule",
    detailReturn = "";
  const initial = () => ({
    scenario: "normal",
    rows: clone(D.list),
    members: clone(D.members),
    memberState: "ready",
    read: "ready",
    synthetic: "",
  });
  const path = () => `/automations${location.search}`;
  const owner = (id) => s.members.find((v) => v.id === id)?.label || "成员名称未取得";
  const pill = (status) =>
    `<span class="pill ${esc(status)}">${esc(status === "active" ? "运行中" : status === "paused" ? "已暂停" : statuses[status] || "状态待确认")}</span>`;
  function failure(code, status) {
    if (code === "rule_paused_before_execution") return "执行前规则已暂停，本次未产生动作。";
    if (code === "rate_limit_exceeded") return "已达到规则时间窗内的执行上限。";
    if (code === "action_failed")
      return status === "dead_letter"
        ? "动作执行失败，已进入最终失败；此记录不在自动领取重试范围。"
        : status === "retry_scheduled"
          ? "动作执行失败，当前正在等待重试。"
          : "动作执行失败，请核对执行记录。";
    return code ? "执行结果需要核对，请展开技术详情。" : "";
  }
  function alert(text, id, error = false) {
    return text
      ? `<div class="alert ${error ? "error" : ""}" id="${id}" role="status">${esc(text)}</div>`
      : "";
  }
  function ruleFlow(r) {
    return `<ol class="rule-flow" aria-label="规则执行顺序"><li><small>当</small><b>${esc(triggers[r.trigger_event_type] || "触发事件待确认")}</b><p>来自已持久化通知事件</p></li><li><small>且</small><b>严重程度：${esc(severities[r.condition_severity] || "待确认")}</b><p>不代替事实核验</p></li><li><small>则</small><b>${esc(actions[r.action_type] || "动作待确认")}</b><p>${esc(r.action_title)}</p></li></ol>`;
  }
  function ruleRow(r) {
    return `<article class="rule" id="rule-${esc(r.id)}"><header class="rule-header"><div><h2>${esc(r.name)}</h2><p>负责人：${esc(owner(r.owner_id))}${r.action_type === "create_task" ? ` / 任务负责人：${esc(owner(r.action_assignee_id))}` : ""}</p></div><div class="badges">${pill(r.status)}<span>版本 ${r.version}</span></div></header>${ruleFlow(r)}<section class="rule-run"><span>最近执行</span><div><div class="run-facts">${r.latest_execution_at || r.latest_execution_status ? pill(r.latest_execution_status) : ""}<time>${esc(time(r.latest_execution_at))}</time></div>${r.latest_error_code ? `<p class="run-explanation">${esc(failure(r.latest_error_code, r.latest_execution_status))}</p>` : ""}</div></section><footer class="rule-footer"><small>${r.rate_limit_window_minutes} 分钟内最多 ${r.rate_limit_count} 次</small><div class="actions"><button id="detail-${esc(r.id)}" data-detail="${esc(r.id)}" ${busy ? "disabled" : ""}>查看执行记录</button><button id="edit-${esc(r.id)}" data-edit="${esc(r.id)}" ${busy ? "disabled" : ""}>编辑</button><button data-status="${esc(r.id)}" ${busy ? "disabled" : ""}>${r.status === "active" ? "暂停" : "恢复"}</button></div></footer></article>`;
  }
  function statePanel() {
    const titles = {
      loading: "正在读取规则与成员",
      empty: "尚未创建规则",
      error: "规则服务暂不可用",
      blocked: "规则服务暂不可用",
      forbidden: "无权管理自动化",
      expired: "登录已失效",
      rate_limited: "请求过于频繁",
      version_conflict: "规则版本已变化",
    };
    return `<section class="state-panel" aria-live="polite"><h2>${titles[s.read]}</h2><p>${s.read === "empty" ? "从一条跟进规则开始。匹配到真实事件后，系统才会通知负责人或创建人工任务。" : s.read === "loading" ? "等待当前工作区规则与成员响应，未取得的数据不显示为零。" : "没有取得本次完整读取结果。请核对登录、权限或服务状态后重试。"}</p>${s.read === "loading" ? '<div class="loading-bar"></div><div class="loading-bar short"></div>' : s.read === "empty" ? "" : '<button id="retry">重新加载</button>'}</section>`;
  }
  function render() {
    $("app").innerHTML =
      `<div class="review-band"><span>P27 / C 方向 r1 · 自动化规则</span><span>独立审核稿 · 未接入 Vue / API</span></div><div class="shell"><aside class="directory"><h2>规则目录</h2><nav aria-label="本次规则定位">${s.read === "ready" ? s.rows.map((r) => `<button data-locate="${esc(r.id)}"><span>${esc(r.name)}</span><small>${r.status === "active" ? "运行中" : "已暂停"} / 版本 ${r.version}</small></button>`).join("") : '<p class="small">等待读取当前范围目录</p>'}</nav><div class="scope"><strong>当前组织 / 工作区</strong><p>需要团队管理权限。</p><p>规则只通知负责人或创建人工任务，不代替审批与业务决定。</p></div></aside><main class="workspace"><header class="page-heading"><div><h1>自动化规则</h1><p>将确定的事件交给稳定的跟进流程。</p></div><button id="create-rule" class="primary" ${busy ? "disabled" : ""}>创建规则</button></header>${alert(message, "page-result", message.includes("失败"))}${s.synthetic ? alert(`合成布局状态：${s.synthetic}。不是实际生产记录或操作结果。`, "synthetic-note") : ""}<div class="count-line"><span>${s.read === "ready" ? `本次读取 ${s.rows.length} 条规则` : "当前范围规则尚未完整取得"}</span><span>执行记录最多返回最近100条，无历史分页</span></div>${s.scenario === "controls" ? '<section class="control-board"><button>默认</button><button class="hover">悬停</button><button class="focused">焦点</button><button class="pressed">按下</button><button disabled>不可用</button><button disabled>处理中…</button></section>' : s.read === "ready" ? s.rows.map(ruleRow).join("") : statePanel()}<p class="boundary">${esc(D.boundary)}</p><details class="tools"><summary>审核工具：${esc(scenes[s.scenario])}</summary><label for="scene-select">切换图稿场景<select id="scene-select">${Object.entries(
        scenes,
      )
        .map(
          ([key, name]) =>
            `<option value="${key}" ${key === s.scenario ? "selected" : ""}>${esc(name)}</option>`,
        )
        .join(
          "",
        )}</select></label><p>场景切换重置离线草稿；按钮只记录意图，不发送业务请求。</p><p>路由预览：${esc(path())}</p></details></main></div>`;
    $("create-rule").onclick = () => openEditor();
    $("scene-select").onchange = (e) => scene(e.target.value);
    document.querySelectorAll("[data-detail]").forEach(
      (n) =>
        (n.onclick = () =>
          openDetail(
            s.rows.find((v) => v.id === n.dataset.detail),
            n.id,
          )),
    );
    document.querySelectorAll("[data-edit]").forEach(
      (n) =>
        (n.onclick = () =>
          openEditor(
            s.rows.find((v) => v.id === n.dataset.edit),
            n.id,
          )),
    );
    document
      .querySelectorAll("[data-status]")
      .forEach(
        (n) => (n.onclick = () => changeStatus(s.rows.find((v) => v.id === n.dataset.status))),
      );
    document.querySelectorAll("[data-locate]").forEach(
      (n) =>
        (n.onclick = () => {
          $(`rule-${n.dataset.locate}`)?.scrollIntoView({ block: "start" });
          $(`detail-${n.dataset.locate}`)?.focus({ preventScroll: true });
        }),
    );
    if ($("retry"))
      $("retry").onclick = () => {
        message = "已记录重新读取意图；未取得新响应，当前状态保持不变。";
        render();
      };
  }
  function navigate(rule = null, action = "", replace = false) {
    const u = new URL(location.href);
    if (rule) {
      u.searchParams.set("rule", rule.id);
      if (action) u.searchParams.set("action", action);
      else u.searchParams.delete("action");
    } else {
      u.searchParams.delete("rule");
      u.searchParams.delete("action");
    }
    history[replace ? "replaceState" : "pushState"](null, "", u);
  }
  function invalidPreview() {
    revision++;
    preview = null;
    previewing = false;
    if (editorMessage.startsWith("只读预览") || editorMessage.startsWith("试运行"))
      editorMessage = "";
  }
  function formFromRule(r) {
    return Object.fromEntries(Object.keys(D.emptyForm).map((k) => [k, r[k] ?? ""]));
  }
  function openEditor(rule = null, trigger = "create-rule", sync = true) {
    if (busy) return;
    if ($("execution").open) $("execution").close();
    selected = null;
    editing = rule ? clone(rule) : null;
    form = rule ? formFromRule(rule) : clone(D.emptyForm);
    reason = "";
    invalid = [];
    invalidPreview();
    editorMessage = "";
    editorReturn = trigger;
    editorOpen = true;
    if (sync) {
      if (rule) navigate(rule, "edit");
      else if (new URL(location.href).searchParams.has("rule")) navigate(null, "", true);
    }
    renderEditor();
    $("editor").showModal();
    $("editor-close").focus();
    $("editor").scrollTop = 0;
  }
  function closeEditor() {
    editorOpen = false;
    editing = null;
    reason = "";
    invalidPreview();
    editorMessage = "";
    if ($("editor").open) $("editor").close();
    if (new URL(location.href).searchParams.has("rule")) navigate();
    render();
    ($(editorReturn) || $("create-rule")).focus();
  }
  function options(values, value) {
    return Object.entries(values)
      .map(
        ([key, text]) =>
          `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(text)}</option>`,
      )
      .join("");
  }
  function field(key, label, input, wide = false, hint = "") {
    return `<label class="field ${wide ? "wide" : ""}" for="${key}">${label}${input}${hint ? `<small>${hint}</small>` : ""}${invalid.includes(key) ? `<span class="field-error" id="${key}-error">请检查此项，填写有效值。</span>` : ""}</label>`;
  }
  function attrs(key) {
    return `id="${key}" name="${key}" ${invalid.includes(key) ? `aria-invalid="true" aria-describedby="${key}-error"` : ""}`;
  }
  function memberSelect(key) {
    return `<select ${attrs(key)} required><option value="" disabled ${!form[key] ? "selected" : ""}>${s.memberState === "error" ? "成员读取失败" : "请选择当前工作区成员"}</option>${s.members.map((v) => `<option value="${esc(v.id)}" ${v.id === form[key] ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>`;
  }
  function renderEditor(focus = "") {
    $("editor").innerHTML =
      `<header class="modal-header"><div><p>${editing ? `原规则版本 ${editing.version}` : "新建后直接启用"}</p><h2 id="editor-title">${editing ? "编辑自动化规则" : "创建自动化规则"}</h2></div><button class="close" id="editor-close" aria-label="关闭规则编辑器">×</button></header><form id="rule-form" novalidate><div class="editor-layout"><aside class="editor-nav"><nav aria-label="编辑分区"><button type="button" data-section="trigger-section">触发条件</button><button type="button" data-section="action-section">人员与动作</button><button type="button" data-section="rate-section">执行频率</button><button type="button" data-section="preview-section">只读预览</button><small>先定义规则，再核对影响。预览不会创建任务或通知。</small></nav></aside><div class="editor-content">${alert(editorMessage, "editor-result", /失败|冲突|校验/.test(editorMessage))}${s.memberState !== "ready" ? alert(s.memberState === "error" ? "成员目录读取失败（合成），不能把失败当作没有成员。保存与预览需有效成员。" : "成员目录为空（合成），没有可选的当前工作区成员。保存与预览需有效成员。", "member-warning", s.memberState === "error") : ""}<section class="editor-section" id="trigger-section"><h3>触发条件</h3>${!editing ? `<div class="template-list">${D.templates.map((t, i) => `<button type="button" data-template="${i}"><b>${esc(t.name)}</b><small>${esc(t.description)}</small></button>`).join("")}</div>` : ""}<div class="fields">${field("name", "规则名称", `<input ${attrs("name")} value="${esc(form.name)}" required maxlength="200" />`, true)}${field("trigger_event_type", "当：触发事件", `<select ${attrs("trigger_event_type")}>${options(triggers, form.trigger_event_type)}</select>`)}${field("condition_severity", "且：严重程度", `<select ${attrs("condition_severity")}>${options(severities, form.condition_severity)}</select>`)}</div></section><hr class="section-rule"/><section class="editor-section" id="action-section"><h3>人员与动作</h3><div class="fields">${field("action_type", "则：后续动作", `<select ${attrs("action_type")}>${options(form.trigger_event_type.startsWith("task.") ? { notify_owner: actions.notify_owner } : actions, form.action_type)}</select>`)}${field("owner_id", "规则负责人", memberSelect("owner_id"))}${form.action_type === "create_task" ? field("action_assignee_id", "任务负责人", memberSelect("action_assignee_id"), true) : ""}${field("action_title", "动作标题", `<input ${attrs("action_title")} value="${esc(form.action_title)}" required maxlength="200" />`, true)}</div><p class="condition-note">${form.trigger_event_type.startsWith("task.") ? "任务事件不能再次创建任务；切换到任务触发器时自动回到通知负责人并清除任务负责人。" : "规则只消费真实通知投影；任务动作保留 automation 来源，仍需人工判断与处理。"}</p></section><hr class="section-rule"/><section class="editor-section" id="rate-section"><h3>执行频率${editing ? "与修改依据" : ""}</h3><div class="fields">${field("rate_limit_count", "最多执行次数", `<input ${attrs("rate_limit_count")} type="number" value="${form.rate_limit_count}" required min="1" max="1000" step="1" />`, false, "整数，1–1000 次")}${field("rate_limit_window_minutes", "时间窗（分钟）", `<input ${attrs("rate_limit_window_minutes")} type="number" value="${form.rate_limit_window_minutes}" required min="1" max="1440" step="1" />`, false, "整数，1–1440 分钟")}${editing ? field("reason", "修改原因", `<textarea ${attrs("reason")} required maxlength="500">${esc(reason)}</textarea>`, true, "当前界面最多500字符；服务上限1000，保留现有差异。") : ""}</div></section><section class="editor-section" id="preview-section">${previewMarkup()}</section></div></div><footer class="editor-actions"><p>${busy ? "请求在途中；关闭不会撤销已提交操作。" : editing ? "试运行只读；编辑不改变启停状态。" : "试运行只读；创建后直接启用。"}</p><div class="editor-buttons"><button type="button" id="cancel">取消</button><button type="button" id="preview" ${previewing ? "disabled" : ""}>${previewing ? "正在试运行…" : "试运行并预览影响"}</button><button class="primary" id="save" ${busy ? "disabled" : ""}>${busy ? "提交中…" : editing ? "保存修改" : "创建并启用"}</button></div></footer></form>`;
    $("editor-close").onclick = closeEditor;
    $("cancel").onclick = closeEditor;
    $("preview").onclick = runPreview;
    $("rule-form").onsubmit = (e) => {
      e.preventDefault();
      save();
    };
    document.querySelectorAll("[data-template]").forEach(
      (n) =>
        (n.onclick = () => {
          form = { ...form, ...clone(D.templates[Number(n.dataset.template)]) };
          guardCycle();
          invalidPreview();
          invalid = [];
          renderEditor();
          $("name").focus();
        }),
    );
    document
      .querySelectorAll("[data-section]")
      .forEach((n) => (n.onclick = () => $(n.dataset.section).scrollIntoView({ block: "start" })));
    $("rule-form")
      .querySelectorAll("input,select,textarea")
      .forEach((n) =>
        n.addEventListener("input", () => {
          if (n.id === "reason") {
            reason = n.value;
            return;
          }
          form[n.id] = n.type === "number" ? (n.value === "" ? "" : Number(n.value)) : n.value;
          invalidPreview();
          if (["trigger_event_type", "action_type"].includes(n.id)) {
            guardCycle();
            renderEditor(n.id);
          } else {
            $("preview-section").innerHTML = previewMarkup();
            bindPreviewLinks();
            $("preview").disabled = false;
            $("preview").textContent = "试运行并预览影响";
            if ($("editor-result") && !editorMessage) $("editor-result").remove();
          }
        }),
      );
    bindPreviewLinks();
    if (focus) $(focus)?.focus();
  }
  function guardCycle() {
    if (form.trigger_event_type.startsWith("task.") && form.action_type === "create_task") {
      form.action_type = "notify_owner";
      form.action_assignee_id = "";
    }
  }
  function previewMarkup() {
    const p = preview;
    return `<div class="preview-box"><header><div><h3>试运行影响预览</h3><p>读取历史匹配，不执行任何动作</p></div><span class="read-only">只读</span></header>${p ? `<p class="preview-count">最近30天匹配 <strong>${p.matched_30d}</strong> 条</p><dl class="preview-facts"><div><dt>当前限流窗口匹配</dt><dd>${p.matched_in_rate_window} 条</dd></div><div><dt>最多可能执行</dt><dd>${p.projected_action_count} 次</dd></div><div><dt>可能创建人工任务</dt><dd>${p.projected_task_count} 项</dd></div><div><dt>可能发送负责人通知</dt><dd>${p.projected_notification_count} 条</dd></div></dl><p class="condition-note">离线响应样例，不是实际试运行结果。此响应时间窗 ${p.rate_limit_window_minutes} 分钟，上限 ${p.rate_limit_count} 次；未来事件与实际执行仍待服务验证。</p><h3 style="margin-top:20px">匹配样本</h3><p class="condition-note">最多5条，样本查询没有最近30天限制。统计命中与样本返回分别阅读。</p>${p.samples.length ? p.samples.map((v) => `<article class="sample"><strong>${esc(v.title)}</strong><p>${esc(severities[v.severity] || "待确认")} / ${esc(time(v.created_at))}</p><a data-preview-link href="${esc(notificationHref(v.notification_id))}">查看样本</a></article>`).join("") : '<p class="preview-empty">本次响应未返回样本；不等于历史匹配数为零。</p>'}` : `<p class="preview-empty">${previewing ? "只读请求进行中。修改输入或关闭编辑器后，旧结果不再属于当前草稿。" : "尚无当前输入的预览。填写必填项后可试运行；修改规则会清除旧预览。"}</p>`}</div>`;
  }
  function validate() {
    invalid = [...$("rule-form").querySelectorAll("input,select,textarea")]
      .filter(
        (n) =>
          !n.checkValidity() ||
          (n.required && ["text", "textarea"].includes(n.type) && !n.value.trim()),
      )
      .map((n) => n.id);
    if (invalid.length) {
      editorMessage = "表单校验未通过，请检查标红字段。未发送任何请求。";
      renderEditor();
      $(invalid[0]).focus();
      return false;
    }
    return true;
  }
  function body() {
    return {
      ...clone(form),
      action_assignee_id: form.action_type === "create_task" ? form.action_assignee_id : null,
    };
  }
  function runPreview() {
    if (previewing || !validate()) return;
    intents.push({ url: "/automations/preview", method: "POST", body: body() });
    const t = ++token;
    held.set(t, { revision, path: path() });
    previewing = true;
    if (mode === "busy")
      editorMessage = "试运行请求处理中（合成），可继续改输入或关闭。旧结果不会自动应用到新草稿。";
    else if (mode === "error") completePreview(t, null, true);
    else if (mode.startsWith("response"))
      completePreview(
        t,
        mode === "response_task"
          ? D.previewCases.create_task
          : mode === "response_empty"
            ? D.previewCases.empty
            : mode === "response_samples"
              ? D.previewCases.notify_owner
              : D.fixturePreview,
      );
    else {
      previewing = false;
      held.delete(t);
      editorMessage = "只读预览意图已记录，未发送API。没有返回数据时不编造匹配次数。";
    }
    renderEditor();
    $("editor-close").focus();
    return t;
  }
  function completePreview(t, response, error = false) {
    const owner = held.get(t);
    held.delete(t);
    if (!owner || !editorOpen || owner.revision !== revision || owner.path !== path()) return false;
    previewing = false;
    if (error) {
      preview = null;
      editorMessage = "试运行失败（合成）。输入保留；没有当前预览结果，不代表零匹配。";
    } else {
      preview = clone(response);
      editorMessage = "只读预览响应样例已展示；没有执行任务或发送通知。";
    }
    renderEditor();
    return true;
  }
  function save() {
    if (busy || !validate()) return;
    intents.push({
      url: editing ? `/automations/${editing.id}` : "/automations",
      method: editing ? "PATCH" : "POST",
      body: { ...body(), ...(editing ? { expected_version: editing.version, reason } : {}) },
    });
    if (mode === "busy") {
      busy = true;
      editorMessage = "保存请求处理中（合成）。当前允许取消或Escape关闭，但关窗不会撤销请求。";
    } else if (mode === "error" || mode === "conflict")
      editorMessage = editing
        ? "保存修改失败（合成版本冲突）。输入与原因保留，未覆盖现有规则；需核对最新版本后重试。"
        : "创建规则失败（合成）。输入保留，没有新增或启用规则。";
    else editorMessage = "保存意图已记录，未发送API；规则、状态和版本没有伪造更新。";
    renderEditor();
    $("editor-close").focus();
    $("editor").scrollTop = 0;
  }
  function changeStatus(rule) {
    if (busy) return;
    const action = rule.status === "active" ? "pause" : "resume";
    intents.push({
      url: `/automations/${rule.id}/actions`,
      method: "POST",
      body: {
        action,
        expected_version: rule.version,
        reason: action === "pause" ? "由规则管理页人工暂停" : "由规则管理页人工恢复",
      },
    });
    if (mode === "busy") {
      busy = true;
      message = "暂停/恢复请求处理中（合成），暂不可重复提交。";
    } else if (mode === "error")
      message = "暂停/恢复失败（合成）。原规则状态和版本保留，核对响应后再重试。";
    else message = "暂停/恢复意图已记录，未发送API；不把动作意图当作规则已变更。";
    render();
  }
  function notificationHref(id) {
    return `/notifications?notification=${encodeURIComponent(id)}&from=%2Fautomations`;
  }
  function bindPreviewLinks() {
    document.querySelectorAll("[data-preview-link]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          editorMessage = `离线导航预览：${a.getAttribute("href")}。目标权限未验证。`;
          renderEditor();
          $("editor-close").focus();
        }),
    );
  }
  function renderDetail() {
    const d = selected;
    $("execution").innerHTML =
      `<header class="modal-header"><div><p>规则详情与执行记录</p><h2 id="execution-title">执行记录</h2></div><button class="close" id="execution-close" aria-label="关闭执行记录">×</button></header><div class="execution-content">${alert(detailMessage, "detail-result")}${s.synthetic ? alert(`合成状态：${s.synthetic}`, "execution-synthetic") : ""}<header class="execution-context"><div><h3>${esc(d.name)}</h3><p>此规则当前版本 ${d.version}。下列每次执行保留自己的规则版本。</p></div>${pill(d.status)}</header>${d.executions.length ? `<ol class="execution-list">${d.executions.map((x, i) => `<li class="execution-item"><time>${esc(time(x.updated_at))}</time><div class="execution-detail"><div class="execution-meta">${pill(x.status)}<span>规则版本 ${x.rule_version}</span><span>尝试 ${x.attempt_count} 次</span></div><p>${esc(failure(x.last_error_code, x.status) || (x.status === "succeeded" ? "执行记录已完成；通知动作不等于收件人已收到，人工任务也不等于已处理完成。" : "按执行记录状态查看进展，不推断已产生动作。"))}</p><div class="execution-links">${x.action_resource_type === "task" && x.action_resource_id ? `<a data-detail-link href="/tasks/${esc(x.action_resource_id)}?from=%2Fautomations">查看关联人工任务</a>` : ""}${x.notification_id ? `<a data-detail-link href="${esc(notificationHref(x.notification_id))}">查看触发通知与来源</a>` : ""}</div>${x.last_error_code || x.action_resource_id ? `<details class="technical" id="execution-tech-${i}"><summary>技术详情</summary><dl><dt>错误码</dt><dd>${esc(x.last_error_code || "未提供")}</dd><dt>动作资源类型</dt><dd>${esc(x.action_resource_type || "未提供")}</dd><dt>动作资源标识</dt><dd>${esc(x.action_resource_id || "未提供")}</dd></dl></details>` : ""}</div></li>`).join("")}</ol>` : '<p class="preview-empty">尚无匹配事件，未执行任何动作。</p>'}<p class="execution-note">最近最多100条执行，没有独立历史分页。本页只读取执行事实，不提供手动运行、重试或删除。</p></div>`;
    $("execution-close").onclick = closeDetail;
    document.querySelectorAll("[data-detail-link]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          detailMessage = `离线导航预览：${a.getAttribute("href")}。未访问实际任务/通知或验证权限。`;
          renderDetail();
          $("execution-close").focus();
        }),
    );
  }
  function openDetail(rule, trigger = "", sync = true) {
    if (busy) return;
    if ($("editor").open) {
      $("editor").close();
      editorOpen = false;
      invalidPreview();
    }
    selected = clone({ ...D.detail, ...rule, executions: D.detail.executions });
    detailReturn = trigger;
    detailMessage = "";
    if (sync) navigate(rule);
    renderDetail();
    $("execution").showModal();
    $("execution-close").focus();
    $("execution").scrollTop = 0;
  }
  function closeDetail() {
    selected = null;
    $("execution").close();
    if (new URL(location.href).searchParams.has("rule")) navigate();
    render();
    ($(detailReturn) || $("create-rule")).focus();
  }
  function bindDialog(d, close) {
    d.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    d.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
          ...d.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary",
          ),
        ].filter((n) => n.getClientRects().length),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
  }
  function readyCreator() {
    openEditor();
    form = { ...form, ...clone(D.templates[0]), owner_id: D.members[0].id };
    invalidPreview();
    renderEditor();
  }
  function scene(name) {
    if (!scenes[name]) throw new Error(`Unknown scene ${name}`);
    for (const d of [$("editor"), $("execution")]) if (d.open) d.close();
    s = initial();
    s.scenario = name;
    selected = null;
    editing = null;
    editorOpen = false;
    busy = false;
    previewing = false;
    preview = null;
    invalid = [];
    intents = [];
    message = "";
    editorMessage = "";
    detailMessage = "";
    mode = "intent";
    held.clear();
    revision++;
    form = clone(D.emptyForm);
    reason = "";
    const u = new URL(location.href);
    u.search = "";
    history.replaceState(null, "", u);
    if (
      [
        "loading",
        "empty",
        "error",
        "blocked",
        "forbidden",
        "expired",
        "rate_limited",
        "version_conflict",
      ].includes(name)
    ) {
      s.read = name;
      if (name === "empty") s.rows = [];
    }
    if (["paused", "resume_error"].includes(name)) {
      s.rows[0].status = "paused";
      s.rows[0].version = 2;
      s.synthetic = "已暂停规则版本2";
    }
    if (name === "missing_latest") {
      s.rows[0].latest_execution_at = null;
      s.rows[0].latest_execution_status = null;
      s.rows[0].latest_error_code = null;
      s.synthetic = "没有最近执行";
    }
    if (name === "long_rules") {
      s.rows = Array.from({ length: 4 }, (_, i) => ({
        ...clone(D.list[0]),
        id: `synthetic-${i}`,
        name: `合成规则${i + 1}：跨团队审批异常需要结合原始记录进行持续人工跟进的长中文名称`,
      }));
      s.synthetic = "四条长名称规则，不新增实际规则";
    }
    render();
    window.scrollTo(0, 0);
    const executionMap = {
      execution_queued: "queued",
      execution_leased: "leased",
      execution_retry: "retry_scheduled",
      execution_succeeded: "succeeded",
      execution_rate: "rate_limited",
      execution_failed: "failed",
      execution_dead: "dead_letter",
      execution_unknown: "unknown",
      execution_suppressed: "succeeded",
      execution_task: "succeeded",
    };
    if (
      [
        "detail",
        "executions_empty",
        "technical",
        "long_history",
        ...Object.keys(executionMap),
      ].includes(name)
    ) {
      openDetail(s.rows[0], `detail-${s.rows[0].id}`);
      if (name === "executions_empty") {
        selected.executions = [];
        s.synthetic = "空执行列表";
      }
      if (executionMap[name]) {
        const x = selected.executions[0];
        x.status = executionMap[name];
        x.action_resource_type = null;
        x.action_resource_id = null;
        x.last_error_code = ["execution_failed", "execution_dead", "execution_retry"].includes(name)
          ? "action_failed"
          : name === "execution_rate"
            ? "rate_limit_exceeded"
            : name === "execution_suppressed"
              ? "rule_paused_before_execution"
              : null;
        s.synthetic = "执行状态与结果变体";
        if (name === "execution_task") {
          x.action_resource_type = "task";
          x.action_resource_id = D.detail.executions[0].action_resource_id;
        }
      }
      if (name === "long_history") {
        selected.executions = Array.from({ length: 100 }, (_, i) => ({
          ...clone(D.detail.executions[0]),
          id: `synthetic-${i}`,
          rule_version: 1 + (i % 3),
          attempt_count: 1 + (i % 4),
        }));
        s.synthetic = "100条执行布局，时间取相同夹具不造连续真实历史";
      }
      renderDetail();
      if (name === "technical") $("execution-tech-0").open = true;
    } else if (["pause_busy", "pause_error", "resume_error"].includes(name)) {
      mode = name.endsWith("busy") ? "busy" : "error";
      changeStatus(s.rows[0]);
    } else if (
      ![
        "normal",
        "paused",
        "missing_latest",
        "long_rules",
        "loading",
        "empty",
        "error",
        "blocked",
        "forbidden",
        "expired",
        "rate_limited",
        "version_conflict",
        "controls",
      ].includes(name)
    ) {
      if (name.startsWith("edit")) {
        openEditor(s.rows[0], `edit-${s.rows[0].id}`);
        reason = name === "edit" ? "" : "核验后调整频率";
      } else if (name === "create" || name === "validation" || name.startsWith("members"))
        openEditor();
      else readyCreator();
      if (name.startsWith("template_")) {
        form = {
          ...clone(D.emptyForm),
          ...clone(
            D.templates[
              { template_overdue: 0, template_competitor: 1, template_rejected: 2 }[name]
            ],
          ),
        };
      }
      if (name === "task_trigger") {
        form = {
          ...form,
          ...clone(D.templates[1]),
          owner_id: D.members[0].id,
          action_assignee_id: D.members[0].id,
          trigger_event_type: "task.created",
        };
        guardCycle();
      }
      if (name.startsWith("members")) {
        s.members = [];
        s.memberState = name === "members_error" ? "error" : "empty";
      }
      renderEditor();
      if (name === "validation") validate();
      if (name.startsWith("preview")) {
        mode =
          name === "preview_busy"
            ? "busy"
            : name === "preview_error"
              ? "error"
              : name === "preview_task"
                ? "response_task"
                : name === "preview_empty"
                  ? "response_empty"
                  : name === "preview_samples"
                    ? "response_samples"
                    : "response";
        if (name === "preview_task") {
          form.action_type = "create_task";
          form.action_assignee_id = D.members[0].id;
          renderEditor();
        }
        runPreview();
        if (name === "preview_changed") {
          form.rate_limit_count = 1;
          invalidPreview();
          editorMessage = "修改输入后旧预览已失效；请重新试运行。没有自动重放。";
          renderEditor();
        }
        if (name === "preview_error") $("editor").scrollTop = 0;
        else $("preview-section").scrollIntoView({ block: "start" });
      }
      if (
        [
          "create_busy",
          "edit_busy",
          "create_error",
          "edit_conflict",
          "create_intent",
          "edit_intent",
        ].includes(name)
      ) {
        mode = name.endsWith("busy")
          ? "busy"
          : name.endsWith("error")
            ? "error"
            : name.endsWith("conflict")
              ? "conflict"
              : "intent";
        save();
      }
      if (!name.startsWith("preview") && name !== "validation") $("editor-close").focus();
    }
  }
  function restore() {
    const q = new URL(location.href).searchParams,
      id = q.get("rule");
    if (!id) {
      if ($("editor").open) $("editor").close();
      if ($("execution").open) $("execution").close();
      editorOpen = false;
      editing = null;
      selected = null;
      invalidPreview();
      render();
      return;
    }
    const r = s.rows.find((v) => v.id === id);
    if (!r) {
      message = "链接中的自动化规则不存在或不在当前工作区。";
      navigate(null, "", true);
      render();
      return;
    }
    if (q.get("action") === "edit") openEditor(r, "create-rule", false);
    else openDetail(r, "create-rule", false);
  }
  bindDialog($("editor"), closeEditor);
  bindDialog($("execution"), closeDetail);
  window.addEventListener("popstate", restore);
  s = initial();
  render();
  restore();
  window.AUTOMATION_C = {
    scenes,
    scene,
    setMode: (v) => {
      mode = v;
    },
    completePreview,
    state: () =>
      clone({
        ...s,
        form,
        editing,
        selected,
        reason,
        editorOpen,
        busy,
        previewing,
        preview,
        intents,
        message,
        editorMessage,
        mode,
        revision,
        token,
        path: path(),
      }),
  };
})();
