(() => {
  const D = window.PN_DATA,
    app = document.querySelector("#app"),
    modal = document.querySelector("#modal"),
    clone = (v) => structuredClone(v);
  const esc = (s) =>
    String(s ?? "—").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const name = (s) => D.labels[s] ?? s ?? "—",
    time = (s) => (s ? new Date(s).toLocaleString("zh-CN") : "未提供");
  const categories = {
      system: "系统通知",
      task: "任务通知",
      approval: "审批通知",
      competitor: "竞品通知",
    },
    severities = { info: "普通", warning: "重要", critical: "严重" },
    audiences = { all_users: "全部活动用户", organization: "指定组织", user: "指定用户" };
  const columns = ["通知 / 时间", "接收人", "组织", "类型 / 级别", "阅读", "渠道投递"];
  const scenes = {
    default: "人工消息工作台",
    deliveries: "投递观测",
    configuration: "系统配置事实",
    "original-draft": "原始草稿全文夹具",
    "original-published": "原始已发布全文夹具",
    "original-cancelled": "原始已取消全文夹具",
    "original-operations": "原始投递旧夹具（字段差异保留）",
    loading: "首次读取中",
    "first-error": "首次读取失败",
    "first-timeout": "首次读取超时",
    refreshing: "保留快照刷新",
    "retained-error": "刷新失败保留",
    "all-empty": "两种记录均空 · 辅助配置仍可读",
    "messages-empty": "人工消息为空",
    "deliveries-empty": "投递为空不影响人工消息",
    "filter-draft": "投递筛选草稿",
    "filter-long": "120字搜索边界",
    "filter-pending": "筛选等待 · 保留旧范围",
    "filter-error": "筛选失败 · 保留旧范围",
    "message-page-first": "人工消息10条第一页",
    "message-page-last": "人工消息第二页",
    "delivery-page-first": "投递20条第一页",
    "delivery-page-last": "投递第二页",
    "page-pending": "双分页独立 · 消息翻页等待",
    "page-error": "消息翻页失败保留",
    "message-reader": "完整消息阅读",
    "body-expanded": "正文展开",
    "body-max": "2000字完整正文",
    "body-plain-text": "正文纯文本安全边界",
    "published-reader": "已发布只读阅读",
    "cancelled-reader": "已取消只读阅读",
    "delivery-detail": "投递详情",
    "delivery-technical": "投递技术信息",
    "delivery-missing": "缺失渠道不补造",
    "delivery-mixed": "历史多渠道状态",
    settings: "六列视图设置",
    "one-column": "至少保留一列",
    compact: "紧凑密度",
    frozen: "首列冻结",
    dark: "深色主题",
    contrast: "高对比主题",
    focus: "键盘焦点",
    hover: "悬停",
    pressed: "按下",
    "new-all": "新建草稿 · 全部活动用户",
    "new-organization": "新建草稿 · 指定组织",
    "new-user": "新建草稿 · 指定用户",
    "edit-all": "编辑草稿 · 全部活动用户",
    "edit-organization": "编辑草稿 · 指定组织",
    "edit-user": "编辑草稿 · 指定用户",
    "editor-empty": "空标题正文校验",
    "editor-min": "标题正文2字边界",
    "editor-max": "标题200正文2000边界",
    "editor-over": "程序赋值越界防护",
    "editor-no-target": "未选择受众",
    "editor-no-options": "候选列表为空",
    "editor-no-channel": "未启用站内渠道",
    "editor-reason-short": "编辑原因不足",
    "editor-reason-max": "编辑原因300字",
    "editor-pending": "保存中 · 冻结表单",
    "editor-error": "保存失败保留内容",
    "editor-conflict": "编辑版本冲突",
    "editor-unknown": "保存结果不明",
    "editor-success": "草稿保存成功但尚未发布",
    "editor-refresh-error": "保存成功但列表刷新失败",
    publish: "发布草稿确认",
    cancel: "取消草稿确认",
    "action-reason-short": "发布原因不足",
    "action-reason-max": "发布原因300字",
    "action-reason-over": "发布原因超长",
    "publish-pending": "发布请求中",
    "publish-error": "发布失败保留原因",
    "publish-conflict": "发布状态或版本冲突",
    "publish-empty": "有效收件人为空",
    "publish-forbidden": "发布权限错误提示",
    "publish-unknown": "发布结果不明不重试",
    "publish-success": "发布成功 · 返回计数",
    "publish-refresh-error": "发布成功但列表未刷新",
    "cancel-success": "草稿已取消不是撤回",
    "reason-cancelled": "取消原因窗 · 零提交",
    "closed-pending": "关闭编辑不取消请求",
    "new-editor-old-result": "旧结果不关闭新编辑",
    "routes-limited": "告警仅显示前6条",
    "audience-limit": "候选上限不是受众预检",
    "personal-route": "个人偏好入口说明",
    "governance-route": "规则总览入口说明",
    "source-boundary": "源码事实与提案边界",
  };
  let s,
    opener,
    counter = 0;
  const notice = (t, type = "") =>
    t ? `<div class="notice ${type}" role="status">${esc(t)}</div>` : "";
  const audience = (r) =>
    r.audience_type === "organization"
      ? `指定组织：${r.organization_name ?? "未提供名称"}`
      : r.audience_type === "user"
        ? `指定用户：${r.user_email ?? "未提供邮箱"}`
        : "全部活动用户";
  const deliveryText = (raw) =>
    String(raw || "")
      .split(",")
      .filter(Boolean)
      .map((v) => {
        const [channel, status] = v.split(":");
        return `${channel === "in_app" ? "站内" : channel === "email" ? "邮件" : channel}：${name(status)}`;
      })
      .join("；") || "无渠道记录";
  function reset() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    opener = null;
    document.documentElement.className = "";
    s = {
      key: "default",
      view: "messages",
      data: clone(D.synthetic),
      selected: 0,
      phase: "ready",
      query: "",
      status: "",
      draftQuery: "",
      draftStatus: "",
      snapshot: { query: "", status: "" },
      pending: null,
      write: null,
      editor: null,
      action: null,
      dialog: "",
      message: "",
      calls: [],
      columns: columns.map(() => true),
      compact: false,
      frozen: false,
      source: "合成完整快照：字段/模板来自实际仓储；不代表生产数据",
      routeIntent: null,
    };
  }
  function bind(id, fn) {
    const e = document.getElementById(id);
    if (e) e.onclick = fn;
  }
  function pagebar(which) {
    const p = s.data[which === "messages" ? "message_pagination" : "pagination"];
    if (!p) return '<p class="small">旧夹具未提供分页字段，不能由现有行数推算总量。</p>';
    return `<nav class="pagination" aria-label="${which === "messages" ? "人工消息" : "投递记录"}分页"><span>第 ${p.page} / ${p.total_pages} 页，共 ${p.total} 条<br><small>每页最多 ${which === "messages" ? 10 : 20} 条</small></span><div class="actions"><button id="previous" ${s.pending || p.page <= 1 ? "disabled" : ""}>上一页</button><button id="next" ${s.pending || p.page >= p.total_pages ? "disabled" : ""}>下一页</button></div></nav>`;
  }
  function render() {
    const ready = !["loading", "error"].includes(s.phase);
    app.innerHTML = `<div class="shell ${s.compact ? "compact" : ""}"><aside class="sidebar"><div class="brand">ScoutOps<small>平台运营</small></div><nav aria-label="通知管理分区">${[
      ["messages", "人工消息"],
      ["deliveries", "投递观测"],
      ["configuration", "系统事实"],
    ]
      .map(
        ([k, v]) =>
          `<button data-view="${k}" ${s.view === k ? 'aria-current="page"' : ""}>${v}</button>`,
      )
      .join(
        "",
      )}</nav><div class="side-note"><small>草稿与投递独立分页<br>邮件服务未接入<br>只读统计不能估算发布人数</small></div></aside><main><header class="header"><div><h1>通知管理</h1><p class="muted">先准备消息，再核对受众与发布结果。</p></div><span class="review">C 方向 · 待审核</span></header><div class="toolbar"><div><h2>${{ messages: "人工消息", deliveries: "投递观测", configuration: "系统配置事实" }[s.view]}</h2><p class="small">${s.view === "messages" ? "草稿与发布记录不受投递搜索或类型筛选影响。" : s.view === "deliveries" ? "搜索标题、接收人邮箱、组织；类型筛选不改变人工消息。" : "全局配置与聚合事实，不受投递筛选影响。"}</p></div><div class="actions">${s.view === "messages" ? `<button id="new" class="primary" ${s.write ? "disabled" : ""}>新建草稿</button>` : s.view === "deliveries" ? '<button id="filter">筛选投递</button><button id="settings">视图设置</button>' : ""}<button id="refresh" ${s.pending ? "disabled" : ""}>${s.pending ? "读取中…" : "刷新"}</button></div></div>${notice(s.message, s.message.includes("失败") || s.message.includes("冲突") ? "error" : "warn")}${!ready ? `<div class="workspace empty"><h3>${s.phase === "loading" ? "正在读取消息与投递" : "暂时无法读取通知管理"}</h3><p>尚无成功快照，不展示占位统计或假收件人数。</p>${s.phase === "error" ? '<button id="retry">重新读取</button>' : ""}</div>` : s.view === "messages" ? messages() : s.view === "deliveries" ? deliveries() : configuration()}<div class="observed"><span>读取时间：${ready ? time(s.data.observed_at) : "尚未读取"}</span><span>${esc(s.source)}</span></div><p class="draft-note">离线审核：按钮只操作内存，不发送通知、不写数据库或审计。原型中的新布局、快照归属、防重和双结果尚未进入 Vue。</p><section class="scene-review"><label for="scene-picker">审核场景<select id="scene-picker">${Object.entries(
      scenes,
    )
      .map(([k, v]) => `<option value="${k}" ${s.key === k ? "selected" : ""}>${v}</option>`)
      .join(
        "",
      )}</select></label><div class="actions"><button id="mock-success">模拟成功响应</button><button id="mock-error">模拟失败响应</button><button id="boundaries">查看源码边界</button></div><small>以上场景和响应控件仅供审核，不属于生产页面。</small></section></main></div>`;
    document.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          s.view = b.dataset.view;
          render();
        }),
    );
    bind("new", () => edit());
    bind("filter", () => open("filter"));
    bind("settings", () => open("settings"));
    bind("refresh", () => read());
    bind("retry", () => read());
    bind("boundaries", () => open("boundaries"));
    bind("mock-success", () => (s.write ? finish("success") : complete("success")));
    bind("mock-error", () => (s.write ? finish("error") : complete("error")));
    bind("previous", () =>
      read(s.view, s.data[s.view === "messages" ? "message_pagination" : "pagination"].page - 1),
    );
    bind("next", () =>
      read(s.view, s.data[s.view === "messages" ? "message_pagination" : "pagination"].page + 1),
    );
    document.querySelectorAll("[data-message]").forEach(
      (b) =>
        (b.onclick = () => {
          s.selected = Number(b.dataset.message);
          if (innerWidth <= 760) open("reader");
          else render();
        }),
    );
    document.querySelectorAll("[data-delivery]").forEach(
      (b) =>
        (b.onclick = () => {
          s.deliveryIndex = Number(b.dataset.delivery);
          open("delivery");
        }),
    );
    bindReader(app);
    bindRoutes(app);
    document.querySelector("#scene-picker").onchange = (e) => scene(e.target.value);
  }
  function messages() {
    const rows = s.data.messages ?? [];
    if (!rows.length)
      return `<div class="workspace empty"><h3>还没有人工消息</h3><p>新建只保存草稿。之后仍需单独确认发布，不会自动发送。</p></div>${pagebar("messages")}`;
    s.selected = Math.min(s.selected, rows.length - 1);
    return `<div class="inbox"><div class="message-list">${rows.map((r, i) => `<button data-message="${i}" ${s.selected === i ? 'aria-current="true"' : ""}><span class="pill ${esc(r.status)}">${esc(name(r.status))}</span><strong>${esc(r.title)}</strong><small>${esc(audience(r))}</small><small>${time(r.updated_at)}</small><small class="mobile">查看正文与操作</small></button>`).join("")}</div><article class="reader desktop">${reader(rows[s.selected])}</article></div>${pagebar("messages")}`;
  }
  function reader(r) {
    return `<span class="pill ${esc(r.status)}">${esc(name(r.status))}</span><h2>${esc(r.title)}</h2><p class="small">${esc(categories[r.category] ?? r.category)} / ${esc(severities[r.severity] ?? r.severity)}</p><p class="preview">${esc(r.body)}</p><details class="message-body"><summary>完整正文</summary><div class="body-full">${esc(r.body)}</div></details><dl class="message-meta">${[
      ["接收范围", audience(r)],
      [
        "发送方式",
        [r.in_app_enabled ? "站内通知" : "", r.email_enabled ? "邮件（历史配置）" : ""]
          .filter(Boolean)
          .join("、") || "无启用渠道",
      ],
      ["更新时间", time(r.updated_at)],
      ["读取版本", `v${r.version}`],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p class="small">全部活动用户仍须符合有效成员、活动组织及默认工作区条件；人数以发布返回为准，不由订阅数估算。</p>${r.status === "draft" ? `<div class="actions"><button data-edit ${s.write ? "disabled" : ""}>编辑草稿</button><button data-action="publish" class="primary" ${s.write ? "disabled" : ""}>发布草稿</button><button data-action="cancel" ${s.write ? "disabled" : ""}>取消草稿</button></div>` : notice("已发布或已取消的消息只读，不能编辑或撤回。")}`;
  }
  function bindReader(root) {
    root
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => edit(s.data.messages[s.selected])));
    root
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  }
  function deliveries() {
    const rows = s.data.items ?? [],
      summary = s.data.summary ?? {};
    return `<div class="scope">${Object.entries(summary)
      .map(
        ([k, v]) =>
          `<div><strong>${esc(v)}</strong>${{ total: "匹配投递", unread: "未读", critical: "严重" }[k] ?? esc(k)}</div>`,
      )
      .join(
        "",
      )}</div><p class="small">当前快照：${esc(s.snapshot.query || "全部搜索")} / ${esc(categories[s.snapshot.status] || "全部类型")}。上述计数只对应投递筛选。</p><section class="workspace">${!rows.length ? '<div class="empty"><h3>没有匹配的投递记录</h3><p>人工消息、固定模板与全局配置不因此为空。</p><button id="empty-reset">清除筛选并读取</button></div>' : `<div class="desktop ${s.frozen ? "freeze" : ""} ${s.compact ? "compact" : ""}"><table><thead><tr>${columns.map((v, i) => (s.columns[i] ? `<th scope="col">${v}</th>` : "")).join("")}</tr></thead><tbody>${rows.map((r, i) => `<tr>${[`<button data-delivery="${i}">${esc(r.title)}</button><small>${time(r.created_at)}</small>`, esc(r.recipient_email), esc(r.organization_name), `${esc(categories[r.category] ?? r.category)} / ${esc(severities[r.severity] ?? r.severity)}`, r.read_at ? "已读" : "未读", esc(deliveryText(r.delivery_status))].map((v, n) => (s.columns[n] ? `<td>${v}</td>` : "")).join("")}</tr>`).join("")}</tbody></table></div><div class="mobile">${rows.map((r, i) => `<article class="card"><strong>${esc(r.title)}</strong><p>${r.read_at ? "已读" : "未读"} / ${esc(categories[r.category] ?? r.category)}</p><p class="small">${esc(r.recipient_email)}<br>${esc(r.organization_name)}</p><button data-delivery="${i}">完整投递事实</button></article>`).join("")}</div>`}${pagebar("deliveries")}</section>`;
  }
  function configuration() {
    const d = s.data;
    return `<div class="configuration"><section><h3>系统模板</h3><p class="small">固定事件合同，不提供编辑按钮。</p><ul>${(d.templates ?? []).map((r) => `<li><strong>${esc(r.title)}</strong><small>${esc(r.event_pattern)} / ${esc(name(r.status))}</small></li>`).join("") || "<li>当前响应未提供模板记录。</li>"}</ul></section><section><h3>渠道状态</h3><p class="small">全局历史投递聚合，不受当前筛选影响。</p><ul>${(d.channels ?? []).map((r) => `<li><strong>${esc(r.name)} / ${esc(name(r.status))}</strong><small>${(r.deliveries ?? []).map((v) => `${esc(name(v.status))}：${esc(v.total)}`).join("，") || "暂无投递"}</small></li>`).join("")}</ul>${notice("邮件服务未接入，入口保持关闭；历史邮件事实不代表现在可发送。")}</section><section><h3>用户订阅</h3><p class="small">仅为全局偏好统计；人工平台消息发布不读取这些偏好。</p><dl class="kv">${Object.entries(
      d.subscriptions ?? {},
    )
      .map(
        ([k, v]) =>
          `<dt>${{ total: "订阅用户", in_app_enabled: "启用站内", email_enabled: "启用邮件", task_enabled: "接收任务", approval_enabled: "接收审批", competitor_enabled: "接收竞品", in_app: "启用站内（旧夹具）", email: "启用邮件（旧夹具）", disabled: "全部停用（旧夹具）" }[k] ?? esc(k)}</dt><dd>${esc(v)}</dd>`,
      )
      .join(
        "",
      )}</dl><button data-route="/me">个人偏好入口</button></section><section><h3>告警路由</h3><p class="small">响应最多50条，目前仅展示前6条，不代表全部规则。</p><ul>${
      (d.alert_routes ?? [])
        .slice(0, 6)
        .map(
          (r) =>
            `<li><strong>${esc(r.name)}</strong><small>${esc({ notify_owner: "通知负责人", notify: "发送通知", create_task: "创建人工任务" }[r.action_type] ?? "按规则处理")} / ${esc(r.status === "active" ? "启用" : name(r.status))}</small></li>`,
        )
        .join("") || "<li>暂无告警路由。</li>"
    }</ul><button data-route="/platform-admin/governance">规则总览</button></section></div>`;
  }
  function bindRoutes(root) {
    root.querySelectorAll("[data-route]").forEach(
      (b) =>
        (b.onclick = () => {
          s.routeIntent = b.dataset.route;
          open("route");
        }),
    );
    bind("empty-reset", () => {
      s.query = s.status = s.draftQuery = s.draftStatus = "";
      read("deliveries", 1);
    });
  }
  function read(which = s.view, page) {
    if (s.pending) return;
    const dp = s.data.pagination?.page ?? 1,
      mp = s.data.message_pagination?.page ?? 1;
    s.pending = {
      query: s.query,
      status: s.status,
      page: which === "deliveries" ? (page ?? dp) : dp,
      message_page: which === "messages" ? (page ?? mp) : mp,
    };
    s.calls.push({
      method: "GET",
      path: `/platform/management?${new URLSearchParams({ domain: "notifications", page: String(s.pending.page), page_size: "20", message_page: String(s.pending.message_page), message_page_size: "10", ...(s.query ? { query: s.query } : {}), ...(s.status ? { status: s.status } : {}) })}`,
    });
    s.message = `读取目标：${s.query || "全部搜索"} / ${categories[s.status] || "全部类型"}，投递第${s.pending.page}页 / 消息第${s.pending.message_page}页；当前仍为旧快照。`;
    render();
  }
  function complete(outcome) {
    if (!s.pending) return;
    const p = s.pending;
    s.pending = null;
    if (outcome === "error") s.message = "读取失败，保留原快照、筛选范围及两种页码。";
    else {
      s.phase = "ready";
      s.snapshot = { query: p.query, status: p.status };
      s.query = p.query;
      s.status = p.status;
      if (s.paginationFixture) {
        s.data = clone(D.pagination);
        for (const [key, rows, pg, size, total] of [
          ["pagination", "items", p.page, 20, 21],
          ["message_pagination", "messages", p.message_page, 10, 11],
        ]) {
          const n = Math.min(pg, 2);
          s.data[key] = { page: n, page_size: size, total, total_pages: 2 };
          if (n === 2)
            s.data[rows] = [
              {
                ...s.data[rows][0],
                id: `synthetic-last-${rows}`,
                title: `合成最后一条${rows === "items" ? "投递" : "消息"}`,
              },
            ];
        }
      }
      if (outcome === "empty") {
        s.data.items = [];
        s.data.summary = { total: 0, unread: 0, critical: 0 };
        s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 1 };
      }
      s.message = "模拟读取完成；人工消息范围未被投递筛选改变。";
    }
    render();
  }
  function close() {
    const was = s.dialog;
    s.dialog = "";
    if (modal.open) modal.close();
    modal.replaceChildren();
    if (was === "editor") s.editor = null;
    if (was === "action") s.action = null;
    render();
    const target = opener?.id
      ? document.getElementById(opener.id)
      : document.querySelector(innerWidth <= 760 ? "[data-message]" : "#refresh");
    (target && target.getClientRects().length
      ? target
      : document.querySelector("#refresh")
    )?.focus();
  }
  function open(kind) {
    if (!modal.open) opener = document.activeElement;
    s.dialog = kind;
    renderDialog();
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    focusDialog();
  }
  function focusDialog() {
    (
      modal.querySelector(
        "input:not(:disabled):not([type=checkbox]),textarea:not(:disabled),select:not(:disabled)",
      ) ?? modal.querySelector("button:not(:disabled)")
    )?.focus({ preventScroll: true });
  }
  const head = (title, desc) =>
    `<header><h2 id="dialog-title">${title}</h2><button id="close-modal" aria-label="关闭弹窗">关闭</button></header><p id="dialog-description" class="muted">${desc}</p>`;
  const options = (obj, value) =>
    Object.entries(obj)
      .map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${v}</option>`)
      .join("");
  function edit(row) {
    if (s.write) return;
    s.editor = {
      token: ++counter,
      item: row ? clone(row) : null,
      form: row
        ? {
            kind: "notification",
            title: row.title,
            body: row.body,
            category: row.category,
            severity: row.severity,
            audience_type: row.audience_type,
            organization_id: row.organization_id ?? "",
            user_id: row.user_id ?? "",
            in_app_enabled: Boolean(row.in_app_enabled),
            email_enabled: false,
            expected_version: row.version,
            reason: "编辑平台消息",
          }
        : {
            kind: "notification",
            title: "",
            body: "",
            category: "system",
            severity: "info",
            audience_type: "all_users",
            organization_id: "",
            user_id: "",
            in_app_enabled: true,
            email_enabled: false,
            reason: "创建平台消息草稿",
            expected_version: 1,
          },
      error: "",
    };
    open("editor");
  }
  function action(kind) {
    if (s.write) return;
    const item = s.data.messages[s.selected];
    if (item?.status !== "draft") return;
    s.action = {
      token: ++counter,
      item: clone(item),
      kind,
      reason: kind === "publish" ? "发布平台消息" : "取消平台消息",
      error: "",
    };
    open("action");
  }
  function errors() {
    if (s.dialog === "action") {
      const n = s.action.reason.trim().length;
      return n < 2 || n > 300 ? ["操作原因需为2–300字。"] : [];
    }
    if (!s.editor) return [];
    const f = s.editor.form,
      out = [];
    if (f.title.trim().length < 2 || f.title.trim().length > 200) out.push("标题需为2–200字。");
    if (f.body.trim().length < 2 || f.body.trim().length > 2000) out.push("正文需为2–2000字。");
    if (f.audience_type === "organization" && !f.organization_id)
      out.push("请选择组织；候选不是完整组织目录。");
    if (f.audience_type === "user" && !f.user_id) out.push("请选择用户；候选不证明可投递。");
    if (!f.in_app_enabled) out.push("必须启用站内通知。");
    if (s.editor.item && (f.reason.trim().length < 2 || f.reason.trim().length > 300))
      out.push("修改原因需为2–300字。");
    return out;
  }
  function validation() {
    const out = errors(),
      v = s.editor ?? s.action;
    const e = document.querySelector("#validation");
    if (e) e.textContent = out.join("\n");
    const b = document.querySelector("#submit");
    if (b) b.disabled = Boolean(s.write) || out.length > 0 || Boolean(v?.blocked);
    for (const id of ["title", "body", "reason"]) {
      const field = document.getElementById(id);
      if (field) {
        const max = Number(field.maxLength),
          n = field.value.trim().length;
        field.setAttribute("aria-invalid", String(n < 2 || n > max));
      }
    }
  }
  function renderDialog() {
    if (s.dialog === "reader")
      modal.innerHTML = `${head("消息阅读", "只读当前列表消息，无额外请求；发布和取消状态均能阅读完整正文。")}<article class="reader">${reader(s.data.messages[s.selected])}</article>`;
    else if (s.dialog === "delivery") {
      const r = s.data.items[s.deliveryIndex ?? 0];
      modal.innerHTML = `${head("投递事实", "当前列表行详情；不提供重试投递、标记已读或编辑通知操作。")}<h3>${esc(r.title)}</h3><dl class="kv">${[
        ["接收人", r.recipient_email],
        ["组织", r.organization_name],
        [
          "类型 / 级别",
          `${categories[r.category] ?? r.category} / ${severities[r.severity] ?? r.severity}`,
        ],
        ["阅读状态", r.read_at ? "已读" : "未读"],
        ["投递状态", deliveryText(r.delivery_status)],
        ["创建时间", time(r.created_at)],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`)
        .join(
          "",
        )}</dl><details id="technical"><summary>技术详情</summary><dl class="kv"><dt>通知 ID</dt><dd>${esc(r.id)}</dd><dt>原始投递状态</dt><dd>${esc(r.delivery_status || "无渠道记录")}</dd></dl></details><footer><button id="cancel-dialog">返回</button></footer>`;
    } else if (s.dialog === "filter")
      modal.innerHTML = `${head("筛选投递记录", "仅影响投递记录及其统计，不影响人工消息、固定模板或全局配置。关闭保留草稿。")}<form id="filter-form"><div class="form-row"><label for="query">标题 / 接收人邮箱 / 组织</label><input id="query" maxlength="120" value="${esc(s.draftQuery)}" /></div><div class="form-row"><label for="category-filter">通知类型</label><select id="category-filter"><option value="">全部类型</option>${options(categories, s.draftStatus)}</select></div><footer><button id="reset" type="button" ${s.pending ? "disabled" : ""}>重置并读取</button><button id="cancel-dialog" type="button">取消</button><button id="apply" type="submit" class="primary" ${s.pending ? "disabled" : ""}>应用筛选</button></footer></form>`;
    else if (s.dialog === "settings")
      modal.innerHTML = `${head("投递视图", "仅影响六列投递表格；至少一列。手机详情保持完整，不持久化用户偏好。")}<section>${columns.map((v, i) => `<label class="check"><input type="checkbox" data-column="${i}" ${s.columns[i] ? "checked" : ""} />${v}</label>`).join("")}<label class="check"><input id="compact" type="checkbox" ${s.compact ? "checked" : ""} />紧凑密度</label><label class="check"><input id="freeze" type="checkbox" ${s.frozen ? "checked" : ""} />冻结首列</label></section><footer><button id="cancel-dialog">完成</button></footer>`;
    else if (s.dialog === "editor") {
      const e = s.editor,
        f = e.form,
        disabled = s.write ? "disabled" : "",
        targetKey = f.audience_type === "organization" ? "organization_id" : "user_id",
        targets =
          s.data.audience_options?.[
            f.audience_type === "organization" ? "organizations" : "users"
          ] ?? [];
      modal.innerHTML = `${head(e.item ? "编辑通知草稿" : "新建通知草稿", "保存只形成草稿，不发布。确认消息内容和接收范围后，仍需单独填写发布原因。")}<form id="editor-form"><div class="form-row"><label for="title">标题</label><input id="title" data-field="title" required minlength="2" maxlength="200" aria-describedby="validation" value="${esc(f.title)}" ${disabled} /></div><div class="form-row"><label for="body">正文</label><textarea id="body" data-field="body" required minlength="2" maxlength="2000" rows="5" aria-describedby="validation" ${disabled}>${esc(f.body)}</textarea><small class="small">纯文本，保留换行；去除首尾空白后2–2000字。</small></div><div class="form-grid"><div class="form-row"><label for="category">消息类型</label><select id="category" data-field="category" ${disabled}>${options(categories, f.category)}</select></div><div class="form-row"><label for="severity">重要程度</label><select id="severity" data-field="severity" ${disabled}>${options(severities, f.severity)}</select></div></div><div class="form-row"><label for="audience">接收范围</label><select id="audience" ${disabled}>${options(audiences, f.audience_type)}</select></div>${f.audience_type !== "all_users" ? `<div class="form-row"><label for="target">${f.audience_type === "organization" ? "选择组织" : "选择用户"}</label><select id="target" data-field="${targetKey}" required ${disabled}><option value="">请选择</option>${targets.map((r) => `<option value="${esc(r.id)}" ${f[targetKey] === r.id ? "selected" : ""}>${esc(r.name ?? r.email)}</option>`).join("")}</select><p class="small">${targets.length ? "候选只显示活动对象，最多200组织/500用户；不是完整远程搜索。" : "当前候选为空，请重新读取核实；不擅自扩大受众。"}</p></div>` : ""}<p class="small">实际收件人还须有活动成员、活动组织和默认工作区；人工发布不读取个人订阅偏好。不预估发送人数。</p><fieldset><legend>发送方式</legend><label class="check"><input id="in-app" type="checkbox" ${f.in_app_enabled ? "checked" : ""} ${disabled} />站内通知</label><label class="check"><input type="checkbox" id="email" disabled />邮件（服务未接入）</label></fieldset>${e.item ? `<div class="form-row"><label for="reason">修改原因</label><textarea id="reason" data-field="reason" required minlength="2" maxlength="300" rows="3" aria-describedby="validation" ${disabled}>${esc(f.reason)}</textarea><p class="small">当前读取版本 v${e.item.version}，随保存提交，不可手工修改。</p></div>` : ""}<p id="validation" class="validation" aria-live="polite"></p>${notice(e.error, "error")}${s.write ? notice("提交中：表单已冻结。关闭窗口不等于取消已发请求。", "warn") : ""}<footer><button id="cancel-dialog" type="button">${s.write ? "关闭（不取消请求）" : "取消"}</button>${e.blocked ? '<button id="recover" type="button">关闭并重新读取</button>' : ""}<button id="submit" type="submit" class="primary">${s.write ? "保存中…" : "保存草稿（模拟）"}</button></footer></form>`;
    } else if (s.dialog === "action") {
      const a = s.action,
        r = a.item;
      modal.innerHTML = `${head(a.kind === "publish" ? "发布通知草稿" : "取消通知草稿", a.kind === "publish" ? "发布将按执行时的有效成员关系同步写入站内消息；本页仅模拟。" : "只取消尚未发布的草稿，不是撤回已经发布的通知。")}<div class="context-strip"><h3>${esc(r.title)}</h3><p>${esc(audience(r))}</p><small>读取版本 v${r.version} / 站内通知 / 不预估收件人数</small></div><form id="action-form"><div class="form-row"><label for="reason">${a.kind === "publish" ? "发布" : "取消"}原因</label><textarea id="reason" required minlength="2" maxlength="300" rows="4" aria-describedby="validation" ${s.write ? "disabled" : ""}>${esc(a.reason)}</textarea><p class="small">2–300字；原原因组件没有最大长度限制，本稿按既有后端上限提供提前提示。</p></div><p id="validation" class="validation" aria-live="polite"></p>${notice(a.error, "error")}${s.write ? notice("请求中，不重复提交。关闭只隐藏窗口，不代表撤销请求。", "warn") : ""}<footer><button id="cancel-dialog" type="button">${s.write ? "关闭（不取消请求）" : "返回"}</button>${a.blocked ? '<button id="recover" type="button">关闭并重新读取</button>' : ""}<button id="submit" class="primary" type="submit">${s.write ? "处理中…" : a.kind === "publish" ? "确认发布（模拟）" : "确认取消草稿（模拟）"}</button></footer></form>`;
    } else if (s.dialog === "route")
      modal.innerHTML = `${head("关联入口说明", "审核工具：不执行真实导航，不修改个人偏好或其他规则。")}<div class="context-strip"><code>${esc(s.routeIntent)}</code></div><p>${s.routeIntent === "/me" ? "个人偏好入口仅针对当前账号，不是其他用户的偏好管理。" : "规则总览是原关联入口，不等于本页能编辑告警路由或查看全部路线。"}</p><footer><button id="cancel-dialog">返回</button></footer>`;
    else
      modal.innerHTML = `${head("源码事实与提案边界", "图册是审核稿，不是生产实现、发送证明或安全验收。")}<dl class="kv"><dt>两条读取</dt><dd>投递20条、人工消息10条独立分页。筛选不改变消息和全局配置；告警最多返回50但只显示6。</dd><dt>三种写入</dt><dd>新建草稿、仅draft可编辑、发布/取消原因。原因与版本、幂等及审计合同不变；没有撤回。</dd><dt>受众</dt><dd>活动用户/成员/组织和默认工作区，按最早符合成员关系去重；不查个人订阅。候选上限不是投递预检。</dd><dt>本稿提案</dt><dd>新建按钮纠名、页内三分区、独立快照、单飞、表单冻结、实例归属、错误入窗、未知不自动重试、写入/读取双结果、空时仍可读配置。</dd><dt>未验证</dt><dd>真实Vue与KeepAlive、浏览器返回、数据库/受众去重/审计/会话同源幂等、软键盘、六角色和生产部署。</dd></dl><footer><button id="cancel-dialog">知道了</button></footer>`;
    bind("close-modal", close);
    bind("cancel-dialog", close);
    bind("recover", () => {
      close();
      read();
    });
    bindReader(modal);
    if (s.dialog === "filter") {
      document.querySelector("#query").oninput = (e) => (s.draftQuery = e.target.value);
      document.querySelector("#category-filter").onchange = (e) => (s.draftStatus = e.target.value);
      document.querySelector("#filter-form").onsubmit = (e) => {
        e.preventDefault();
        if (s.pending) return;
        s.query = s.draftQuery.trim();
        s.status = s.draftStatus;
        close();
        read("deliveries", 1);
      };
      bind("reset", () => {
        if (s.pending) return;
        s.query = s.status = s.draftQuery = s.draftStatus = "";
        close();
        read("deliveries", 1);
      });
    }
    if (s.dialog === "settings") {
      modal.querySelectorAll("[data-column]").forEach(
        (b) =>
          (b.onchange = () => {
            if (!b.checked && s.columns.filter(Boolean).length === 1) {
              b.checked = true;
              return;
            }
            s.columns[Number(b.dataset.column)] = b.checked;
            render();
          }),
      );
      document.querySelector("#compact").onchange = (e) => {
        s.compact = e.target.checked;
        render();
      };
      document.querySelector("#freeze").onchange = (e) => {
        s.frozen = e.target.checked;
        render();
      };
    }
    if (s.dialog === "editor") {
      modal.querySelectorAll("[data-field]").forEach((f) => {
        f.oninput = () => {
          s.editor.form[f.dataset.field] = f.value;
          validation();
        };
        f.onchange = f.oninput;
      });
      document.querySelector("#audience").onchange = (e) => {
        s.editor.form.audience_type = e.target.value;
        renderDialog();
      };
      document.querySelector("#in-app").onchange = (e) => {
        s.editor.form.in_app_enabled = e.target.checked;
        validation();
      };
      document.querySelector("#editor-form").onsubmit = (e) => {
        e.preventDefault();
        submit();
      };
      validation();
    }
    if (s.dialog === "action") {
      document.querySelector("#reason").oninput = (e) => {
        s.action.reason = e.target.value;
        validation();
      };
      document.querySelector("#action-form").onsubmit = (e) => {
        e.preventDefault();
        submit();
      };
      validation();
    }
    if (modal.open && !modal.contains(document.activeElement)) focusDialog();
  }
  function submit() {
    const v = s.dialog === "editor" ? s.editor : s.action;
    if (!v || s.write || v.blocked || errors().length) return;
    const editing = s.dialog === "editor",
      kind = editing ? (v.item ? "edit" : "create") : v.kind,
      body = editing
        ? clone(v.form)
        : { action: v.kind, expected_version: v.item.version, reason: v.reason.trim() },
      id = v.item?.id;
    s.write = { token: v.token, kind, item: v.item ? clone(v.item) : null, body };
    s.calls.push({
      method: kind === "edit" ? "PATCH" : "POST",
      path: `/platform/management/messages${id ? `/${id}` : ""}${editing ? "" : "/actions"}`,
      body: clone(body),
    });
    render();
    renderDialog();
  }
  function finish(outcome) {
    if (!s.write) return;
    const w = s.write;
    s.write = null;
    const current = s.editor ?? s.action,
      owns = current?.token === w.token;
    const failure = {
      error: "请求失败（模拟），未确认写入，输入已保留。",
      conflict: "状态或版本冲突（模拟），请重新读取后操作。",
      empty: "有效收件人为空（模拟），候选账号不证明有可投递成员关系。",
      forbidden: "权限错误提示（模拟），请核实会话与platform:operate。",
      unknown: "结果尚未确认（模拟），不自动重试；先重新读取核实。",
    }[outcome];
    if (failure) {
      s.message = failure;
      if (owns) {
        current.error = failure;
        current.blocked = ["conflict", "empty", "forbidden", "unknown"].includes(outcome);
      }
    } else {
      s.message =
        outcome === "refresh-error"
          ? "模拟写入成功，但列表刷新失败；当前列表仍是旧快照，请勿重复提交。"
          : w.kind === "publish"
            ? "模拟发布成功：返回覆盖2人、站内2条、邮件0条。未真实发送。"
            : w.kind === "cancel"
              ? "模拟草稿已取消，不是撤回已发布通知。"
              : "模拟草稿保存成功，尚未发布。";
      if (outcome !== "refresh-error") {
        const index = s.data.messages.findIndex((r) => r.id === w.item?.id);
        if (w.kind === "create") {
          s.data.messages.unshift({
            ...w.body,
            id: "synthetic-created",
            status: "draft",
            version: 1,
            updated_at: "2026-09-09T00:00:00Z",
          });
          if (s.data.message_pagination) {
            s.data.message_pagination.page = 1;
            s.data.message_pagination.total++;
            s.data.message_pagination.total_pages = Math.max(
              1,
              Math.ceil(s.data.message_pagination.total / 10),
            );
          }
          s.selected = 0;
        } else if (index >= 0) {
          const row = s.data.messages[index];
          if (w.kind === "edit") Object.assign(row, w.body);
          else row.status = w.kind === "publish" ? "published" : "cancelled";
          row.version++;
        }
        s.source = "模拟响应后的合成快照，非生产事实";
      }
      if (owns) {
        s.editor = s.action = null;
        s.dialog = "";
        modal.close();
        modal.replaceChildren();
      }
    }
    render();
    if (s.dialog) renderDialog();
    else document.querySelector("#refresh")?.focus();
  }
  function scene(key) {
    if (!scenes[key]) throw Error("Unknown scene: " + key);
    reset();
    s.key = key;
    if (key.startsWith("original-")) {
      if (key === "original-operations") {
        s.data = clone(D.originalOperations);
        s.view = "configuration";
        s.source = "原始投递旧夹具：模板/偏好字段与当前仓储不同，缺少双分页";
      } else {
        s.data = clone(D.originalMessages[key.replace("original-", "")]);
        s.source = "原 UI2-PN57 全文夹具：单消息、空投递与空配置，未与其他夹具拼接";
      }
    }
    if (
      key === "deliveries" ||
      key.startsWith("delivery-") ||
      key.startsWith("filter-") ||
      ["settings", "one-column", "frozen"].includes(key)
    )
      s.view = "deliveries";
    if (["configuration", "routes-limited", "personal-route", "governance-route"].includes(key))
      s.view = "configuration";
    if (key === "loading") {
      s.phase = "loading";
      s.pending = {};
    }
    if (["first-error", "first-timeout"].includes(key)) {
      s.phase = "error";
      s.message =
        key === "first-timeout" ? "读取超时，尚无成功快照。" : "首次读取失败，尚无可保留记录。";
    }
    if (key === "retained-error") s.message = "读取失败，保留上次成功的两类列表和全局配置。";
    if (["all-empty", "messages-empty"].includes(key)) {
      s.data.messages = [];
      s.data.message_pagination = { page: 1, page_size: 10, total: 0, total_pages: 1 };
    }
    if (["all-empty", "deliveries-empty"].includes(key)) {
      s.data.items = [];
      s.data.summary = { total: 0, unread: 0, critical: 0 };
      s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 1 };
      s.view = key === "all-empty" ? "configuration" : "deliveries";
    }
    if (key.includes("page-")) {
      s.paginationFixture = true;
      s.data = clone(D.pagination);
      s.view = key.startsWith("delivery-") ? "deliveries" : "messages";
      if (key.endsWith("last")) {
        read(s.view, 2);
        complete("success");
      }
    }
    if (key === "one-column") s.columns = columns.map((_, i) => i === 0);
    if (key === "compact") s.compact = true;
    if (key === "frozen") s.frozen = true;
    if (["dark", "contrast"].includes(key)) document.documentElement.className = key;
    if (key === "routes-limited")
      s.data.alert_routes = Array.from({ length: 8 }, (_, i) => ({
        ...s.data.alert_routes[0],
        id: `route-${i}`,
        name: `合成路由 ${i + 1}`,
      }));
    if (key === "delivery-missing") s.data.items[0].delivery_status = null;
    if (key === "delivery-mixed") s.data.items[0].delivery_status = "in_app:delivered,email:failed";
    if (key === "published-reader" || key === "cancelled-reader")
      s.data.messages[0].status = key.split("-")[0];
    if (key === "body-max")
      s.data.messages[0].body = "正文保留换行与完整信息。\n".repeat(160).slice(0, 2000);
    if (key === "body-plain-text")
      s.data.messages[0].body =
        '<img src="https://example.invalid/leak" onerror="alert(1)">\n这是纯文本，不执行HTML。';
    render();
    if (key === "refreshing") read();
    if (["filter-pending", "filter-error"].includes(key)) {
      s.query = "采集";
      s.status = "task";
      read("deliveries", 1);
      if (key === "filter-error") complete("error");
    }
    if (["filter-draft", "filter-long"].includes(key)) {
      s.draftQuery = key === "filter-long" ? "字".repeat(120) : " 采集 ";
      s.draftStatus = "task";
      open("filter");
    }
    if (["page-pending", "page-error"].includes(key)) {
      read("messages", 2);
      if (key === "page-error") complete("error");
    }
    if (
      [
        "message-reader",
        "body-expanded",
        "body-max",
        "body-plain-text",
        "published-reader",
        "cancelled-reader",
      ].includes(key)
    ) {
      open("reader");
      if (key.startsWith("body-")) modal.querySelector(".message-body").open = true;
    }
    if (
      ["delivery-detail", "delivery-technical", "delivery-missing", "delivery-mixed"].includes(key)
    ) {
      open("delivery");
      if (key === "delivery-technical") document.querySelector("#technical").open = true;
    }
    if (key === "settings") open("settings");
    if (key === "focus") document.querySelector("#refresh").focus();
    if (key === "source-boundary") open("boundaries");
    if (["personal-route", "governance-route"].includes(key)) {
      s.routeIntent = key === "personal-route" ? "/me" : "/platform-admin/governance";
      open("route");
    }
    if (
      key.startsWith("new-") ||
      key.startsWith("edit-") ||
      key.startsWith("editor-") ||
      ["closed-pending", "audience-limit"].includes(key)
    ) {
      const editing =
        key.startsWith("edit-") || key.startsWith("editor-reason") || key === "editor-conflict";
      edit(editing ? s.data.messages[0] : undefined);
      const f = s.editor.form;
      f.title = "系统维护提醒";
      f.body = "今晚十点进行系统维护，请提前保存工作。";
      if (
        key.endsWith("organization") ||
        ["editor-no-target", "editor-no-options", "audience-limit"].includes(key)
      ) {
        f.audience_type = "organization";
        f.organization_id = D.synthetic.audience_options.organizations[0].id;
      }
      if (key.endsWith("user")) {
        f.audience_type = "user";
        f.user_id = D.synthetic.audience_options.users[0].id;
      }
      if (key === "editor-empty") f.title = f.body = "";
      if (key === "editor-min") f.title = f.body = "通知";
      if (key === "editor-max" || key === "editor-over") {
        f.title = "字".repeat(key === "editor-max" ? 200 : 201);
        f.body = "字".repeat(key === "editor-max" ? 2000 : 2001);
      }
      if (key === "editor-no-target") f.organization_id = "";
      if (key === "editor-no-options") {
        f.organization_id = "";
        s.data.audience_options.organizations = [];
      }
      if (key === "editor-no-channel") f.in_app_enabled = false;
      if (key === "editor-reason-short") f.reason = "一";
      if (key === "editor-reason-max") f.reason = "字".repeat(300);
      renderDialog();
      if (
        [
          "editor-pending",
          "editor-error",
          "editor-conflict",
          "editor-unknown",
          "editor-success",
          "editor-refresh-error",
          "closed-pending",
          "new-editor-old-result",
        ].includes(key)
      ) {
        submit();
        if (key === "closed-pending") {
          close();
          s.message = "编辑窗已关闭，已发模拟保存仍待结果；未取消事务。";
          render();
        } else if (key === "new-editor-old-result") {
          s.editor = {
            ...s.editor,
            token: ++counter,
            form: { ...s.editor.form, title: "另一条新草稿", body: "保留新的输入" },
          };
          finish("success");
        } else if (key !== "editor-pending")
          finish(key === "editor-refresh-error" ? "refresh-error" : key.replace("editor-", ""));
      }
    }
    if (
      ["publish", "cancel", "reason-cancelled"].includes(key) ||
      key.startsWith("publish-") ||
      key.startsWith("action-reason")
    ) {
      action(key.startsWith("cancel") ? "cancel" : "publish");
      if (key === "action-reason-short") s.action.reason = "一";
      if (key === "action-reason-max") s.action.reason = "字".repeat(300);
      if (key === "action-reason-over") s.action.reason = "字".repeat(301);
      renderDialog();
      if (key.startsWith("publish-") && !["publish", "published-reader"].includes(key)) {
        submit();
        if (key !== "publish-pending")
          finish(key === "publish-refresh-error" ? "refresh-error" : key.replace("publish-", ""));
      }
      if (key === "reason-cancelled") {
        close();
        s.message = "已退出原因窗，未产生模拟写请求。";
        render();
      }
    }
    if (key === "cancel-success") {
      action("cancel");
      submit();
      finish("success");
    }
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [
      ...modal.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary",
      ),
    ].filter((v) => v.getClientRects().length);
    if (
      (!e.shiftKey && document.activeElement === f.at(-1)) ||
      (e.shiftKey && document.activeElement === f[0])
    ) {
      e.preventDefault();
      (e.shiftKey ? f.at(-1) : f[0])?.focus();
    }
  });
  window.PN_C = { scenes, scene, complete, finish, submit, state: () => s };
  scene("default");
})();
