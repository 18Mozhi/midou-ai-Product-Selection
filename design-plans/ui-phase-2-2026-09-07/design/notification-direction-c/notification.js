/* Isolated, non-network review prototype. Never persists or sends a business action. */
(() => {
  const D = window.NOTIFICATION_C_DATA,
    original = D.list.data[0],
    clone = (v) => structuredClone(v),
    $ = (id) => document.getElementById(id),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    categories = {
      "": "全部",
      task: "任务",
      approval: "审批",
      competitor: "竞品",
      system: "系统",
    },
    statuses = { "": "全部状态", open: "未处理", in_progress: "处理中", closed: "已关闭" },
    resource = (v) =>
      ({
        task: "任务",
        approval: "审批",
        approval_request: "审批",
        competitor: "竞品",
        opportunity: "机会",
        collection_task: "采集任务",
      })[v] || "系统记录",
    severity = (v) => ({ info: "一般", warning: "需关注", critical: "紧急" })[v] || "待确认",
    body = (v) =>
      /^[a-z][a-z0-9_.-]* 已产生新的可审计事件。$/i.test(v.body)
        ? {
            approval: "审批状态已变化，请查看关联记录。",
            competitor: "竞品监控状态已变化，请查看关联记录。",
            system: "系统状态已变化，请查看关联记录。",
            task: "任务状态已变化，请查看关联记录。",
          }[v.category] || "业务状态已变化，请查看关联记录。"
        : v.body,
    time = (v) => new Date(v).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
    scenes = {
      normal: "01 收件箱 · 原始响应",
      category_task: "02 任务筛选 · 原始响应无匹配",
      category_approval: "03 审批筛选",
      category_competitor: "04 竞品筛选 · 无匹配",
      category_system: "05 系统筛选 · 无匹配",
      workflow_open: "06 未处理筛选",
      workflow_progress: "07 处理中筛选 · 合成",
      workflow_closed: "08 已关闭筛选 · 合成",
      unread: "09 仅未读 · 合成",
      empty: "10 空收件箱 · 合成",
      loading: "11 正在读取",
      error: "12 读取失败",
      forbidden: "13 无权读取",
      expired: "14 登录失效",
      rate_limited: "15 请求频繁",
      version_conflict: "16 版本冲突",
      detail: "17 消息详情 · 已读未处理",
      detail_unread: "18 未读详情 · 自动已读意图",
      read_busy: "19 自动已读处理中 · 合成",
      read_error: "20 自动已读失败 · 合成",
      read_ack: "21 已读响应结果 · 合成快照",
      detail_progress: "22 处理中详情 · 合成",
      detail_closed: "23 已关闭详情 · 合成",
      detail_missing: "24 无来源入口 · 合成",
      detail_unknown: "25 未知严重程度/资源 · 合成",
      detail_technical: "26 技术详情",
      detail_long: "27 长正文 · 合成",
      start_busy: "28 开始处理中 · 合成",
      start_error: "29 开始处理失败 · 合成",
      close_error: "30 关闭通知失败 · 合成",
      reopen_error: "31 重新打开失败 · 合成",
      detail_error: "32 详情读取失败 · 合成",
      all_read_intent: "33 全部已读 · 意图",
      all_read_busy: "34 全部已读处理中 · 合成",
      all_read_error: "35 全部已读失败 · 合成",
      preferences: "36 通知偏好",
      preferences_off: "37 偏好关闭草稿",
      preferences_busy: "38 偏好保存中 · 合成",
      preferences_error: "39 偏好保存失败 · 合成",
      preferences_conflict: "40 偏好版本冲突 · 合成",
      preferences_intent: "41 偏好保存意图",
      connecting: "42 实时连接中 · 示意",
      reconnecting: "43 实时重连 · 示意",
      pagination: "44 二十一组分页 · 合成",
      controls: "45 控件状态板（非业务页）",
    };
  let s,
    selected = null,
    intents = [],
    detailMessage = "",
    preferenceMessage = "",
    preferenceDraft = clone(D.preferences),
    mode = "intent",
    pending = false,
    detailReturn = "",
    preferenceReturn = "preferences-open";
  function initial() {
    return {
      category: "",
      status: "",
      unread: false,
      page: 1,
      rows: clone(D.list.data),
      summary: clone(D.summary),
      read: "ready",
      realtime: "connected",
      message: "",
      extra: {},
      synthetic: "",
      scenario: "normal",
    };
  }
  function rows() {
    return s.rows.filter(
      (v) =>
        (!s.category || v.category === s.category) &&
        (!s.status || v.workflow_status === s.status) &&
        (!s.unread || !v.read_at),
    );
  }
  function query() {
    const q = new URLSearchParams(s.extra);
    if (s.category) q.set("category", s.category);
    if (s.status) q.set("status", s.status);
    if (s.unread) q.set("unread", "1");
    if (s.page > 1) q.set("page", String(s.page));
    if (selected) q.set("notification", selected.id);
    return q;
  }
  function currentPath() {
    const q = query().toString();
    return `/notifications${q ? `?${q}` : ""}`;
  }
  function sync() {
    const u = new URL(location.href);
    u.search = query().toString();
    history.replaceState(null, "", u);
  }
  function notice(message, error = false, id = "page-message") {
    return message
      ? `<div id="${id}" class="alert ${error ? "error" : ""}" role="status">${esc(message)}</div>`
      : "";
  }
  function flag(item) {
    return `<span class="pill ${esc(item.workflow_status)}">${esc(statuses[item.workflow_status] || "待确认")}</span>`;
  }
  function pageState() {
    const titles = {
      loading: "正在读取通知",
      error: "通知服务暂不可用",
      forbidden: "无权读取通知",
      expired: "登录已失效",
      rate_limited: "请求过于频繁",
      version_conflict: "通知版本已变化",
    };
    if (s.read !== "ready")
      return `<section class="state-panel" aria-live="polite"><span class="state-index">${s.read === "loading" ? "…" : "!"}</span><h2>${titles[s.read]}</h2><p>${s.read === "loading" ? "等待通知、汇总与偏好响应；未返回的数量不显示为零。" : "本次未取得完整读取结果。保留筛选，不使用旧数据冒充新结果。"}</p>${s.read === "loading" ? '<div class="loading-line"></div><div class="loading-line short"></div>' : '<button id="retry-read">重新加载</button>'}</section>`;
    const filtered = rows();
    if (!filtered.length)
      return `<section class="state-panel"><span class="state-index">—</span><h2>${s.category || s.status || s.unread ? "没有符合条件的通知" : "当前没有通知"}</h2><p>${s.category || s.status || s.unread ? "当前筛选结果为空，不代表你没有其他通知。分类旁的条数来自独立汇总响应。" : "与你相关的业务事件产生后，通知将显示在这里。"}</p>${s.category || s.status || s.unread ? '<button id="reset">清除筛选</button>' : ""}</section>`;
    return `<div class="list-heading"><span>${esc(categories[s.category])} · ${filtered.length} 组</span><span>按最新事件排列 · 打开未读通知会标记已读</span></div><div>${filtered
      .slice((s.page - 1) * 20, s.page * 20)
      .map(
        (v) =>
          `<button class="notification-row ${v.read_at ? "" : "unread"}" id="row-${esc(v.id)}" data-open="${esc(v.id)}" ${pending ? "disabled" : ""}><span class="row-symbol" aria-hidden="true">${esc((categories[v.category] || "其他").slice(0, 1))}</span><span class="row-copy"><strong>${esc(v.title)}</strong><span class="body">${esc(body(v))}</span><span class="row-status"><span class="${v.read_at ? "" : "reading"}">${v.read_at ? "已读" : "未读"}</span>${flag(v)}${v.group_count > 1 ? `<span class="group">同根因 ${v.group_count} 条</span>` : ""}</span></span><span class="row-meta"><span>${esc(time(v.created_at))}</span><span>查看消息 →</span></span></button>`,
      )
      .join(
        "",
      )}</div>${filtered.length > 20 ? `<nav class="pagination" aria-label="通知分页"><button id="previous" ${s.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${s.page} / ${Math.ceil(filtered.length / 20)} 页 · 共 ${filtered.length} 组</span><button id="next" ${s.page >= Math.ceil(filtered.length / 20) ? "disabled" : ""}>下一页</button></nav>` : ""}`;
  }
  function render() {
    $("app").innerHTML =
      `<div class="review-band"><span>SCOUTOPS / P26 · C 方向 r1</span><span>独立设计稿 · 尚未接入 Vue / API · 待审核</span></div><div class="layout"><aside class="directory"><div class="brand">协作 / 通知</div><nav class="category-nav" aria-label="通知分类">${Object.entries(
        categories,
      )
        .map(
          ([key, name]) =>
            `<button id="category-${key || "all"}" data-category="${key}" aria-pressed="${s.category === key}"><span>${name}</span><b>${s.read === "ready" ? s.summary[key || "total"] : "—"}</b></button>`,
        )
        .join(
          "",
        )}</nav><div class="scope-note"><strong>你的工作区收件箱</strong><p>仅当前组织、工作区和接收人。</p><p>分类数字为原始通知条数；列表按同根因分组，两者口径不同。</p></div></aside><main class="workspace"><header class="page-heading"><div><h1>通知中心</h1><p>先阅读变化，再回到业务来源处理。</p></div><div class="heading-actions"><span class="connection" data-state="${s.realtime}">${{ connected: "实时已连接（示意）", connecting: "实时连接中（示意）", reconnecting: "实时重连中（示意）" }[s.realtime]}</span><button id="preferences-open" ${pending ? "disabled" : ""}>通知偏好</button></div></header>${s.realtime === "reconnecting" ? notice("连接正在恢复。现有实现会在重连触发时回读 API，不是每 30 秒独立轮询；此稿未建立 SSE 连接。") : ""}${notice(s.message, s.message.includes("失败"))}${s.synthetic ? notice(`合成布局状态：${s.synthetic}。不是生产记录或真实写入结果。`, false, "synthetic-note") : ""}<section class="overview" aria-label="通知汇总"><div><div class="read-total"><strong id="unread-total">${s.read === "ready" ? s.summary.unread : "—"}</strong><span>条未读通知</span></div><p class="summary-line"><span>原始条数</span><span>未处理 ${s.read === "ready" ? s.summary.open : "—"}</span><span>处理中 ${s.read === "ready" ? s.summary.in_progress : "—"}</span><span>已关闭 ${s.read === "ready" ? s.summary.closed : "—"}</span></p></div><div class="all-read"><button id="all-read" ${pending ? "disabled" : ""}>${pending && intents.at(-1)?.url === "/notifications/actions" ? "正在标记…" : "全部已读"}</button><small>当前组织 / 工作区发给你的全部未读通知；不受当前筛选和分页限制。</small></div></section><section class="inbox"><div class="filters"><nav class="workflow-nav" aria-label="处理状态筛选">${Object.entries(
        statuses,
      )
        .map(
          ([key, name]) =>
            `<button id="status-${key || "all"}" data-status="${key}" aria-pressed="${s.status === key}">${name}</button>`,
        )
        .join(
          "",
        )}</nav><label class="check"><input id="unread-filter" type="checkbox" ${s.unread ? "checked" : ""} />仅未读</label></div>${s.scenario === "controls" ? '<section class="control-board"><button>默认</button><button class="hover">悬停</button><button class="focused">键盘焦点</button><button class="pressed">按下</button><button disabled>不可用</button><button disabled>处理中…</button></section>' : pageState()}</section><p class="fixture-note">${esc(D.boundary)}</p><details class="scene-tools"><summary>审核工具 · ${esc(scenes[s.scenario])}</summary><label for="scene-select">查看对应状态图<select id="scene-select">${Object.entries(
        scenes,
      )
        .map(
          ([key, name]) =>
            `<option value="${key}" ${s.scenario === key ? "selected" : ""}>${esc(name)}</option>`,
        )
        .join(
          "",
        )}</select></label><p>场景切换会重置本地草稿。正常交互不发送请求，技术键仅在详情折叠区出现。</p><p id="route-preview">路由预览：${esc(currentPath())}</p></details></main></div>`;
    document
      .querySelectorAll("[data-category]")
      .forEach((n) => (n.onclick = () => filter({ category: n.dataset.category })));
    document
      .querySelectorAll("[data-status]")
      .forEach((n) => (n.onclick = () => filter({ status: n.dataset.status })));
    document
      .querySelectorAll("[data-open]")
      .forEach((n) => (n.onclick = () => openDetail(n.dataset.open, n.id)));
    $("unread-filter").onchange = (e) => filter({ unread: e.target.checked });
    $("preferences-open").onclick = () => openPreferences();
    $("all-read").onclick = () => markAll();
    $("scene-select").onchange = (e) => scene(e.target.value);
    if ($("reset")) $("reset").onclick = () => filter({ category: "", status: "", unread: false });
    if ($("previous")) $("previous").onclick = () => filter({ page: s.page - 1 });
    if ($("next")) $("next").onclick = () => filter({ page: s.page + 1 });
    if ($("retry-read"))
      $("retry-read").onclick = () => {
        s.message = "已记录重新读取意图；尚无新响应，当前读取状态保持不变。";
        render();
      };
  }
  function filter(values) {
    s = { ...s, ...values, page: values.page || 1 };
    selected = null;
    sync();
    render();
  }
  function sourceHref(v) {
    return v.action_route.startsWith("/") && !v.action_route.startsWith("//")
      ? `${v.action_route}${v.action_route.includes("?") ? "&" : "?"}from=${encodeURIComponent(currentPath())}`
      : "";
  }
  function detailRender() {
    if (!selected) return;
    const v = selected,
      href = sourceHref(v);
    $("detail").innerHTML =
      `<header class="modal-header"><div><p>通知 / ${esc(categories[v.category] || "其他")}</p><h2 id="detail-title" tabindex="-1">消息详情</h2></div><button class="close" id="detail-close" aria-label="关闭消息详情" ${pending ? "disabled" : ""}>×</button></header>${notice(detailMessage, detailMessage.includes("失败") || detailMessage.includes("冲突"), "detail-result").replace('class="alert', 'class="modal-message alert')}<div class="detail-grid"><section class="message-content"><div class="meta"><span>${esc(time(v.created_at))}</span><span>${esc(severity(v.severity))}</span></div><h3>${esc(v.title)}</h3><article>${esc(body(v))}</article>${v.group_count > 1 ? `<p class="group-note">同一根因的 <strong>${v.group_count} 条通知</strong> 合并展示。本条是可操作的代表；已读与处理操作不等于逐条处理整个组。</p>` : '<p class="group-note">单条通知，没有同根因合并提示。</p>'}${href ? `<a id="source-link" class="source" href="${esc(href)}">返回来源：${esc(resource(v.resource_type))} →</a><p class="source-note">前往原记录查看和处理；目标页仍会独立校验权限。</p>` : '<p class="source-note" style="margin-top:22px">来源未提供可用的站内路径，没有可跳转入口。</p>'}</section><aside class="workflow-panel"><h3>这条通知的状态</h3><dl><div><dt>阅读状态</dt><dd id="detail-read">${v.read_at ? "已读" : "未读"}</dd></div><div><dt>处理状态</dt><dd id="detail-workflow">${flag(v)}</dd></div><div><dt>关联记录</dt><dd>${esc(resource(v.resource_type))}</dd></div><div><dt>当前版本</dt><dd>${v.version}</dd></div></dl><div class="workflow-buttons">${v.workflow_status === "open" ? `<button id="action-start" data-action="start" ${pending ? "disabled" : ""}>开始处理</button>` : ""}<button id="action-${v.workflow_status === "closed" ? "reopen" : "close"}" data-action="${v.workflow_status === "closed" ? "reopen" : "close"}" ${pending ? "disabled" : ""}>${v.workflow_status === "closed" ? "重新打开" : "关闭通知"}</button></div><p>只更改通知的处理状态，不代表任务完成、审批通过，也不会改变阅读状态。</p></aside></div><details class="technical" id="technical"><summary>技术详情</summary><dl><dt>来源类型</dt><dd>${esc(v.resource_type || "未提供")}</dd><dt>来源标识</dt><dd>${esc(v.resource_id || "未提供")}</dd><dt>根因键</dt><dd>${esc(v.root_cause_key || "未提供")}</dd><dt>通知标识</dt><dd>${esc(v.id)}</dd></dl></details><footer class="modal-footer">来源：事务事件投影。此稿不读取真实消息、凭证或邮件地址。</footer>`;
    $("detail-close").onclick = closeDetail;
    document
      .querySelectorAll("[data-action]")
      .forEach((n) => (n.onclick = () => workflow(n.dataset.action)));
    if ($("source-link"))
      $("source-link").onclick = (event) => {
        event.preventDefault();
        detailMessage = `离线导航预览：${href}。未访问来源页，权限尚未验证。`;
        detailRender();
        $("source-link").focus();
      };
  }
  function openDetail(id, trigger = "") {
    if (pending) return;
    selected = clone(s.rows.find((v) => v.id === id) || original);
    detailReturn = trigger;
    detailMessage = "";
    sync();
    if (!selected.read_at) {
      intents.push({
        url: `/notifications/${selected.id}/actions`,
        method: "POST",
        body: { action: "read", expected_version: selected.version },
      });
      detailMessage = "打开未读通知会自动标记已读：已记录意图，未发送API；未收到结果前仍展示未读。";
      if (mode === "busy") {
        pending = true;
        detailMessage = "自动标记已读处理中（合成）。等待响应，暂不可关闭或重复操作。";
      }
      if (mode === "error")
        detailMessage =
          "自动标记已读失败（合成）。消息正文保留，阅读状态仍为未读；没有假定写入成功。";
    }
    detailRender();
    $("detail").showModal();
    if (!pending) $("detail-close").focus();
    else $("detail-title").focus();
  }
  function closeDetail() {
    if (pending) return;
    $("detail").close();
    selected = null;
    detailMessage = "";
    sync();
    render();
    ($(detailReturn) || $("preferences-open")).focus();
  }
  function workflow(action) {
    if (pending || !selected) return;
    intents.push({
      url: `/notifications/${selected.id}/actions`,
      method: "POST",
      body: { action, expected_version: selected.version },
    });
    if (mode === "busy") {
      pending = true;
      detailMessage =
        "通知操作处理中（合成）。等待响应，不重复提交；关闭按钮与 Escape 均暂不可用。";
    } else if (mode === "error")
      detailMessage = `${{ start: "开始处理", close: "关闭通知", reopen: "重新打开" }[action]}失败（合成版本冲突）。保留当前详情；需要重新读取实际版本后重试。`;
    else detailMessage = "已记录通知处理意图，未发送API；阅读状态、处理状态与版本均未伪造更新。";
    detailRender();
    if (!pending) $("detail-close").focus();
  }
  function markAll() {
    if (pending) return;
    intents.push(clone(D.contracts.markAll));
    if (mode === "busy") {
      pending = true;
      s.message =
        "全部已读处理中（合成）。作用于当前组织/工作区的当前接收人全部已投递未读通知，与筛选无关。";
    } else if (mode === "error")
      s.message = "全部已读失败（合成）。未读数量没有清零，请核对实际响应后重试。";
    else s.message = "已记录全部已读意图，未发送API。请求不带筛选条件或通知ID，不代表已读成功。";
    render();
  }
  function prefRender() {
    $("preferences").innerHTML =
      `<header class="modal-header"><div><p>个人设置 / 当前工作区</p><h2 id="preferences-title">通知偏好</h2></div><button id="preferences-close" class="close" aria-label="关闭通知偏好">×</button></header><form id="preference-form"><div class="preferences-body">${notice(preferenceMessage, preferenceMessage.includes("失败") || preferenceMessage.includes("冲突"), "preference-result")}<h3>接收渠道</h3>${prefRow("in_app_enabled", "站内通知", "在当前工作区的通知中心接收消息。")}${prefRow("email_enabled", "邮件通知", "服务未接入，暂不可用；保存时固定关闭。", true)}<h3>事件类型</h3>${prefRow("task_enabled", "任务事件", "与你相关的任务变化。")}${prefRow("approval_enabled", "审批事件", "与你相关的审批变化。")}${prefRow("competitor_enabled", "竞品事件", "与你相关的竞品监控变化。")}<p class="fixture-note">只配置已有五个布尔字段；没有新增“系统事件”开关。取消后本次草稿保留，保存需当前版本 ${preferenceDraft.version}。</p></div><footer class="preferences-actions"><button type="button" id="preferences-cancel">取消</button><button class="primary" id="preferences-save" ${pending ? "disabled" : ""}>${pending ? "保存中…" : "保存偏好"}</button></footer></form>`;
    for (const key of ["in_app_enabled", "task_enabled", "approval_enabled", "competitor_enabled"])
      $(key).onchange = (e) => {
        preferenceDraft[key] = e.target.checked;
      };
    $("preferences-close").onclick = closePreferences;
    $("preferences-cancel").onclick = closePreferences;
    $("preference-form").onsubmit = (e) => {
      e.preventDefault();
      savePreferences();
    };
  }
  function prefRow(key, title, description, disabled = false) {
    return `<label class="preference-row ${disabled ? "disabled" : ""}" for="${key}"><span>${title}<small>${description}</small></span><input type="checkbox" id="${key}" ${preferenceDraft[key] && !disabled ? "checked" : ""} ${disabled ? "disabled" : ""} /></label>`;
  }
  function openPreferences() {
    if (pending) return;
    preferenceReturn = document.activeElement.id || "preferences-open";
    prefRender();
    $("preferences").showModal();
    $("preferences-close").focus();
  }
  function closePreferences() {
    $("preferences").close();
    render();
    ($(preferenceReturn) || $("preferences-open")).focus();
  }
  function savePreferences() {
    if (pending) return;
    intents.push({
      url: "/me/notification-preferences",
      method: "PUT",
      body: {
        ...clone(preferenceDraft),
        email_enabled: false,
        expected_version: preferenceDraft.version,
      },
    });
    if (mode === "busy") {
      pending = true;
      preferenceMessage =
        "偏好保存中（合成）。现有页面允许取消/Escape 关闭，此动作不会撤销在途请求。";
    } else if (mode === "error")
      preferenceMessage = "偏好保存失败（合成）。保留输入，邮件仍关闭；未写入任何实际偏好。";
    else if (mode === "conflict")
      preferenceMessage =
        "偏好版本冲突（合成）。保留草稿供核对；请先获取最新版本，不自动覆盖他人修改。";
    else
      preferenceMessage = "已记录保存意图，未发送API；未收到保存成功结果，不冒充已保存或自动关闭。";
    prefRender();
    $("preferences-close").focus();
  }
  function bindDialog(dialog, close) {
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...dialog.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),summary"),
      ].filter((v) => v.getClientRects().length);
      const first = nodes[0],
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
  function scene(name) {
    if (!scenes[name]) throw new Error(`Unknown scene ${name}`);
    for (const d of [$("detail"), $("preferences")]) if (d.open) d.close();
    s = initial();
    s.scenario = name;
    selected = null;
    intents = [];
    pending = false;
    mode = "intent";
    detailMessage = "";
    preferenceMessage = "";
    preferenceDraft = clone(D.preferences);
    if (name.startsWith("category_")) s.category = name.slice(9);
    if (name === "workflow_open") s.status = "open";
    if (["workflow_progress", "detail_progress"].includes(name)) {
      s.rows[0].workflow_status = "in_progress";
      s.synthetic = "同一通知改为处理中，用于状态布局";
      if (name === "workflow_progress") s.status = "in_progress";
    }
    if (["workflow_closed", "detail_closed", "reopen_error"].includes(name)) {
      s.rows[0].workflow_status = "closed";
      s.synthetic = "同一通知改为已关闭，用于状态布局";
      if (name === "workflow_closed") s.status = "closed";
    }
    if (["unread", "detail_unread", "read_busy", "read_error"].includes(name)) {
      s.rows[0].read_at = null;
      s.summary.unread = 1;
      s.synthetic = "代表通知未读，仅用于自动已读状态演示";
      if (name === "unread") s.unread = true;
    }
    if (name === "read_ack") {
      s.rows[0].version = 2;
      s.synthetic = "只展示已读响应后的独立快照，不是本稿真实请求的回执";
    }
    if (name === "empty") {
      s.rows = [];
      for (const k of Object.keys(s.summary)) s.summary[k] = 0;
      s.synthetic = "空范围响应";
    }
    if (
      ["loading", "error", "forbidden", "expired", "rate_limited", "version_conflict"].includes(
        name,
      )
    )
      s.read = name;
    if (name === "detail_missing") {
      s.rows[0].action_route = "";
      s.rows[0].resource_type = null;
      s.rows[0].resource_id = null;
      s.rows[0].root_cause_key = null;
      s.rows[0].group_count = 1;
      s.synthetic = "单条消息且来源字段缺失";
    }
    if (name === "detail_unknown") {
      s.rows[0].action_route = "//outside.invalid";
      s.rows[0].severity = "unknown";
      s.rows[0].resource_type = "unknown";
      s.synthetic = "未知字段和非安全内部路径";
    }
    if (name === "detail_long") {
      s.rows[0].title = "需要结合原始审批记录逐项核对的长中文通知标题，用于验证移动阅读顺序与换行";
      s.rows[0].body = Array.from(
        { length: 8 },
        (_, i) =>
          `${i + 1}. 合成排版说明：此段只用于检查长正文阅读。通知处理不代替审批决定，请回到来源页核对事实和权限。`,
      ).join("\n\n");
      s.synthetic = "长中文标题、八段正文，不新增业务事件";
    }
    if (name === "pagination") {
      s.rows = Array.from({ length: 21 }, (_, i) => ({
        ...clone(original),
        id: `synthetic-${i + 1}`,
        group_count: 1,
        title: `合成分页通知 ${String(i + 1).padStart(2, "0")}`,
        root_cause_key: `synthetic-${i + 1}`,
        action_route: "",
      }));
      s.synthetic = "21 组独立占位；分页20，汇总保留独立原始夹具，不是一致快照";
    }
    if (["connecting", "reconnecting"].includes(name)) s.realtime = name;
    if (name.endsWith("_busy")) mode = "busy";
    if (name.endsWith("_error")) mode = "error";
    if (name === "preferences_conflict") mode = "conflict";
    if (name === "detail_error")
      s.message = "详情读取失败（合成）。列表仍可读，未打开空详情或标记已读；请再次选择消息。";
    render();
    sync();
    window.scrollTo(0, 0);
    if (
      (name.startsWith("detail") && name !== "detail_error") ||
      name.startsWith("read_") ||
      ["start_busy", "start_error", "close_error", "reopen_error"].includes(name)
    ) {
      openDetail(s.rows[0].id, `row-${s.rows[0].id}`);
      if (name === "detail_technical") $("technical").open = true;
      if (name === "read_ack") {
        detailMessage =
          "合成已读响应快照：阅读状态为已读、版本2；处理状态仍未处理。不是实际写入证明。";
        detailRender();
      }
      if (["start_busy", "start_error", "close_error", "reopen_error"].includes(name))
        workflow(name.split("_")[0]);
    }
    if (name.startsWith("all_read_")) markAll();
    if (name.startsWith("preferences")) {
      if (name === "preferences_off")
        for (const k of [
          "in_app_enabled",
          "task_enabled",
          "approval_enabled",
          "competitor_enabled",
        ])
          preferenceDraft[k] = false;
      openPreferences();
      if (
        [
          "preferences_busy",
          "preferences_error",
          "preferences_conflict",
          "preferences_intent",
        ].includes(name)
      ) {
        preferenceDraft.task_enabled = false;
        savePreferences();
      }
    }
  }
  bindDialog($("detail"), closeDetail);
  bindDialog($("preferences"), closePreferences);
  s = initial();
  const url = new URL(location.href),
    q = url.searchParams;
  s.category = Object.hasOwn(categories, q.get("category")) ? q.get("category") : "";
  s.status = Object.hasOwn(statuses, q.get("status")) ? q.get("status") : "";
  s.unread = q.get("unread") === "1";
  s.page = Math.max(1, Number(q.get("page")) || 1);
  for (const [key, value] of q)
    if (!["category", "status", "unread", "page", "notification", "notification_id"].includes(key))
      s.extra[key] = value;
  render();
  const id = q.get("notification") || q.get("notification_id");
  if (id === original.id) openDetail(id);
  else if (id) {
    s.message = "离线夹具没有此通知，未读取真实API、未打开伪造详情。";
    render();
  }
  window.NOTIFICATION_C = {
    scenes,
    scene,
    setMode: (v) => {
      mode = v;
    },
    state: () =>
      clone({
        ...s,
        selected,
        intents,
        pending,
        mode,
        preferenceDraft,
        detailMessage,
        preferenceMessage,
        path: currentPath(),
      }),
  };
})();
