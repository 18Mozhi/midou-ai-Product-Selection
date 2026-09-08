/* Local design proposal. Route buttons report exact existing targets; never navigate to production. */
(() => {
  const D = window.GOVERNANCE_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v) =>
    String(v ?? "—").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const section = (k) => D.sections.find((s) => s.value === k),
    status = (v) => D.statusNames[v] ?? v ?? "—",
    type = (v) => D.typeNames[v] ?? v ?? "—";
  const time = (v) =>
    Number.isFinite(Date.parse(v))
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "暂无";
  const button = (id, label, disabled = false, primary = false) =>
    `<button id="${id}" ${disabled ? "disabled" : ""} class="${primary ? "primary" : ""}">${label}</button>`;
  const notice = (t) => (t ? `<p class="notice warn" role="status">${esc(t)}</p>` : "");
  const version = (r, k) =>
    k === "releases"
      ? r.name
        ? `版本 ${r.name}`
        : "未记录版本"
      : k === "approval_templates"
        ? `第 ${r.current_version ?? r.revision} 版`
        : k === "automation_rules"
          ? `第 ${r.version} 版`
          : `第 ${r.revision} 版`;
  const href = (k, r) =>
    k === "automation_rules" && r ? `/automations?rule=${r.id}&action=edit` : section(k).href;
  const searchHints = {
    score_rules: "名称、版本、组织或工作区",
    cost_rules: "名称、版本、市场、平台、组织或工作区",
    approval_templates: "名称、资源类型、组织或工作区",
    automation_rules: "名称、触发事件、动作标题、组织或工作区",
    releases: "应用版本、构建标识或发布阶段",
  };
  const kv = (rows) =>
    `<dl class="kv">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>`;
  const modal = document.querySelector("#modal");
  let s,
    kind = "",
    opener = null,
    generation = 0;
  const initial = () => ({
    target: "score_rules",
    snapshot: "score_rules",
    query: "",
    queryDraft: "",
    status: "",
    statusDraft: "",
    snapshotQuery: "",
    snapshotStatus: "",
    page: 1,
    data: clone(D.originals.score_rules),
    phase: "ready",
    pending: null,
    message: "",
    synthetic: false,
    selected: null,
    selectedSection: null,
    routeIntent: null,
    columns: [true, true, true, true, true],
    compact: false,
    freeze: false,
    theme: "",
    calls: [],
  });
  const filters = (dialog = false) =>
    `<form id="filters" class="filter-grid ${dialog ? "in-dialog" : ""}"><label>搜索${esc(section(s.target).label)}<input id="query" maxlength="120" value="${esc(s.queryDraft)}" placeholder="${esc(searchHints[s.target])}"/></label><label>状态<select id="status"><option value="">全部状态</option>${D.statuses[s.target].map((v) => `<option value="${v}" ${s.statusDraft === v ? "selected" : ""}>${esc(status(v))}</option>`).join("")}</select></label><div class="actions">${button("apply", "应用筛选", !!s.pending, true)}${button("reset", "重置", !!s.pending || (!s.queryDraft.trim() && !s.statusDraft))}</div></form>`;
  function render() {
    document.body.className = s.theme;
    const loaded = !!s.data.observed_at;
    const target = section(s.target),
      record = section(s.snapshot);
    const p = s.data.pagination;
    const errors = {
      loading: "正在读取治理事实",
      expired: "登录状态已失效",
      forbidden: "当前账号无平台治理权限",
      blocked: "治理依赖暂不可用",
      error: "治理数据读取失败",
    };
    const headers = ["记录与版本", "组织与类型", "状态", "更新时间", "操作"];
    const cells = (r, n) => [
      `${button(`detail-${n}`, esc(r.name))}<span class="version-label">${esc(version(r, s.snapshot))}</span>`,
      `${esc(r.organization_name || "平台全局")}<small>${esc(r.workspace_name || r.stage || "—")}</small><small>${esc(type(r.trigger_event_type || r.resource_type || r.platform || s.snapshot))}</small>`,
      esc(status(r.status)),
      time(r.updated_at),
      `<div class="actions">${button(`workbench-${n}`, s.snapshot === "automation_rules" ? "进入规则编辑" : "进入工作台")}</div><details><summary>技术标识</summary><code>${esc(r.version_code || r.id)}</code></details>`,
    ];
    document.querySelector("#app").innerHTML =
      `<div class="catalog"><aside class="directory"><h2>治理版本目录</h2><p>跨组织事实 · 不切换当前组织</p><nav aria-label="治理分类">${D.sections.map((d) => `<button data-section="${d.value}" ${s.target === d.value ? 'aria-current="page"' : ""} ${s.pending ? "disabled" : ""}><span>${esc(d.label)}</span><strong>${loaded ? (s.data.summary[d.value] ?? "—") : "—"}</strong></button>`).join("")}</nav><p>分类数字为全量统计，不随当前筛选变化。未返回值显示“—”。</p><div class="provider-box"><h3>来源配置历史</h3><p>${loaded ? (s.data.summary.provider_versions ?? "—") : "—"} 个历史版本<br>最近变更：${loaded ? time(s.data.provider_versions_latest_at) : "尚未读取"}</p>${button("provider", "进入来源版本管理")}</div></aside><main class="governance-main"><header class="header"><div><h1>版本清楚，操作有归属</h1><p class="muted">在这里核对治理事实，在所属工作台处理。</p></div><div class="actions">${button("refresh", s.pending ? "刷新中…" : "刷新事实", !!s.pending)}${button("target-workbench", esc(target.action), false, true)}</div></header><span class="review">C 方向 · P55 具体稿待审</span>${filters()}<div class="mobile-filter">${button("open-filter", "筛选治理记录")}</div>${notice(s.message)}${s.target !== s.snapshot || s.query !== s.snapshotQuery || s.status !== s.snapshotStatus ? notice(`目标 ${target.label} 尚未读取成功；仍显示 ${record.label}，搜索：${s.snapshotQuery || "不限"}，状态：${status(s.snapshotStatus) || "全部"}，第 ${p.page} 页。行入口保持原范围。`) : ""}<div class="context-line"><h2>${loaded ? record.label : "尚未取得记录"}</h2><p class="scope-note">${loaded ? `显示成功快照：搜索 ${esc(s.snapshotQuery || "不限")} / 状态 ${esc(status(s.snapshotStatus) || "全部")} / 第 ${p.page} 页` : "首次读取没有可保留事实；不显示虚构计数。"}</p></div><section class="workspace">${
        !loaded
          ? `<div class="empty"><h2>${errors[s.phase] || "暂无事实"}</h2><p>按当前状态恢复读取。平台目录权限不等于原模块操作权限。</p>${button("retry", "重新加载", s.phase === "loading")}</div>`
          : `<div class="toolbar"><p>${p.total ? `${(p.page - 1) * 20 + 1}–${Math.min(p.page * 20, p.total)} / ${p.total} 条` : "0 条"} · 筛选后的服务端总量</p>${button("settings", "显示设置")}</div>${
              s.data.items.length
                ? `<div class="desktop"><table class="${s.compact ? "compact" : ""} ${s.freeze ? "freeze" : ""}"><thead><tr>${headers
                    .filter((_, i) => s.columns[i])
                    .map((h) => `<th>${h}</th>`)
                    .join("")}</tr></thead><tbody>${s.data.items
                    .map(
                      (r, n) =>
                        `<tr>${cells(r, n)
                          .filter((_, i) => s.columns[i])
                          .map((c) => `<td>${c}</td>`)
                          .join("")}</tr>`,
                    )
                    .join(
                      "",
                    )}</tbody></table></div><div class="mobile">${s.data.items.map((r, n) => `<article class="card"><h3>${esc(r.name)}</h3><p><span class="version-label">${esc(version(r, s.snapshot))}</span> ${esc(status(r.status))}</p><p>${esc(r.organization_name || "平台全局")} / ${esc(r.workspace_name || r.stage || "—")}</p>${button(`mobile-detail-${n}`, "查看完整记录")}</article>`).join("")}</div>`
                : '<div class="empty"><h3>当前分类没有匹配记录</h3><p>调整搜索或状态。全局计数和来源历史仍保留，不将筛选空结果称为全局没有规则。</p></div>'
            }<div class="pagination"><span>每页 20 条；按更新时间、ID 倒序</span><div class="actions">${button("previous", "上一页", !!s.pending || p.page <= 1)}<span>${p.total_pages ? `第 ${p.page} / ${p.total_pages} 页` : "无分页"}</span>${button("next", "下一页", !!s.pending || p.page >= p.total_pages)}</div></div>`
      }</section><p class="draft-note">${s.synthetic ? "补充合成状态" : "原始 UI2-DG55 夹具"}，不是生产数据。事实时间：${time(s.data.observed_at)}（北京时间）。本页没有保存、启停、审批、发布或回滚请求。</p><details class="technical"><summary>本次读取技术信息</summary><p>请求标识：inert-governance-request</p>${button("copy", "复制请求编号（模拟）")}<p id="copy-message"></p></details><details class="scene-review"><summary>审核工具 / 场景</summary><label>选择场景<select id="scene">${Object.entries(
        scenes,
      )
        .map(([k, v]) => `<option value="${k}">${esc(v)}</option>`)
        .join("")}</select></label></details></main></div>`;
    if (innerWidth <= 760) {
      const parent = document.querySelector(".governance-main");
      parent.insertBefore(
        document.querySelector(".provider-box"),
        parent.querySelector(".technical"),
      );
    }
    bind();
  }
  const on = (id, fn, event = "click") => document.getElementById(id)?.addEventListener(event, fn);
  function request(page = 1) {
    if (s.pending) return;
    s.page = page;
    const params = new URLSearchParams({
      domain: "governance",
      section: s.target,
      page: String(page),
      page_size: "20",
    });
    if (s.query) params.set("query", s.query);
    if (s.status) params.set("status", s.status);
    s.calls.push("/platform/management?" + params);
    s.pending = {
      generation: ++generation,
      target: s.target,
      query: s.query,
      status: s.status,
      page,
    };
    s.message = `正在读取${section(s.target).label}第 ${page} 页；已有事实保持原范围。`;
    render();
  }
  function complete(outcome, token = s.pending?.generation) {
    if (!s.pending || token !== s.pending.generation) return;
    const p = s.pending;
    s.pending = null;
    if (outcome === "success" || outcome === "empty") {
      s.data = clone(
        s.synthetic ? D.synthetic[p.target] : D.originals[p.target] || D.synthetic[p.target],
      );
      if (!D.originals[p.target]) s.synthetic = true;
      s.snapshot = p.target;
      s.snapshotQuery = p.query;
      s.snapshotStatus = p.status;
      s.phase = "ready";
      s.page = 1;
      if (outcome === "empty") {
        s.data.items = [];
        s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 0 };
      } else if (p.page > 1) {
        s.synthetic = true;
        s.data.pagination = { page: 2, page_size: 20, total: 21, total_pages: 2 };
        s.page = 2;
      }
      s.message = "模拟读取完成；未连接真实服务。";
    } else {
      s.message = `${outcome === "expired" ? "会话过期" : outcome === "forbidden" ? "无权限" : outcome === "timeout" ? "读取超过 15 秒" : "读取失败"}；${s.data.observed_at ? "仍保留原快照、版本和所属入口（沿源行为，权限快照策略待真实验收）" : "没有可保留快照"}。`;
      if (!s.data.observed_at)
        s.phase = ["expired", "forbidden"].includes(outcome) ? outcome : "blocked";
    }
    render();
  }
  function bindFilters() {
    const updateDraft = () => {
      s.queryDraft = document.querySelector("#query").value;
      s.statusDraft = document.querySelector("#status").value;
      document.querySelector("#reset").disabled =
        !!s.pending || (!s.queryDraft.trim() && !s.statusDraft);
    };
    on("query", updateDraft, "input");
    on("status", updateDraft, "change");
    on(
      "filters",
      (e) => {
        e.preventDefault();
        if (s.pending) return;
        s.query = s.queryDraft.trim();
        s.status = s.statusDraft;
        if (modal.open) close();
        request();
      },
      "submit",
    );
    on("reset", (e) => {
      e.preventDefault();
      if (s.pending) return;
      s.queryDraft = "";
      s.query = "";
      s.statusDraft = "";
      s.status = "";
      if (modal.open) close();
      request();
    });
  }
  function bind() {
    bindFilters();
    document.querySelectorAll("[data-section]").forEach((n) =>
      n.addEventListener("click", () => {
        if (s.pending) return;
        s.target = n.dataset.section;
        s.status = "";
        s.statusDraft = "";
        s.selected = null;
        request();
      }),
    );
    on("refresh", () => request(s.page));
    on("retry", () => request());
    on("open-filter", () => open("filter"));
    on("settings", () => open("settings"));
    on("previous", () => request(s.data.pagination.page - 1));
    on("next", () => request(s.data.pagination.page + 1));
    on("target-workbench", () => routeIntent(href(s.target)));
    on("provider", () => routeIntent("/platform-admin/providers"));
    s.data.items.forEach((r, n) => {
      for (const id of [`detail-${n}`, `mobile-detail-${n}`])
        on(id, () => {
          s.selected = clone(r);
          s.selectedSection = s.snapshot;
          open("detail");
        });
      on(`workbench-${n}`, () => routeIntent(href(s.snapshot, r)));
    });
    on(
      "copy",
      () =>
        (document.querySelector("#copy-message").textContent =
          "模拟复制失败；没有访问系统剪贴板。"),
    );
    on("scene", () => scene(document.querySelector("#scene").value), "change");
  }
  function routeIntent(url) {
    s.routeIntent = url;
    open("route");
  }
  function open(k) {
    if (!modal.open)
      opener =
        document.activeElement !== document.body
          ? document.activeElement
          : document.querySelector("#refresh");
    kind = k;
    draw();
    if (!modal.open) modal.showModal();
    (modal.querySelector("input,select") || modal.querySelector("button"))?.focus();
    modal.scrollTop = 0;
  }
  function close() {
    const previousKind = kind;
    modal.close();
    modal.replaceChildren();
    kind = "";
    if (previousKind === "filter") render();
    if (opener?.isConnected && !modal.contains(opener)) opener.focus();
    else
      document
        .querySelector(previousKind === "filter" && innerWidth <= 760 ? "#open-filter" : "#refresh")
        .focus();
  }
  function draw() {
    let title = "",
      body = "",
      desc = "",
      footer = "";
    if (kind === "detail") {
      const r = s.selected,
        k = s.selectedSection;
      title = r.name;
      desc = section(k).label + " / 已加载行快照，不发新详情请求。";
      body =
        `<div class="modal-meta"><span class="version-label">${esc(version(r, k))}</span><p>${esc(status(r.status))}</p></div>` +
        kv([
          ["所属组织", r.organization_name || "平台全局"],
          ["工作区或阶段", r.workspace_name || r.stage || "—"],
          ["类型", type(r.trigger_event_type || r.resource_type || r.platform || k)],
          ["更新时间", time(r.updated_at)],
        ]) +
        (k === "cost_rules"
          ? kv([
              ["市场", r.market ?? "未返回"],
              ["平台", r.platform ?? "未返回"],
            ])
          : "") +
        (k === "automation_rules"
          ? kv([
              ["触发条件", type(r.trigger_event_type)],
              ["严重程度", r.condition_severity === "any" ? "不限" : status(r.condition_severity)],
              ["执行动作", type(r.action_type)],
              ["动作标题", r.action_title ?? "未返回"],
              [
                "执行频率上限",
                r.rate_limit_count
                  ? `${r.rate_limit_count} 次 / ${r.rate_limit_window_minutes} 分钟`
                  : "源界面不显示此字段；不据此推断不限频率",
              ],
            ])
          : "") +
        `<details class="technical" id="record-technical"><summary>技术详情</summary>${kv([
          ["记录 ID", r.id],
          ["版本代码", r.version_code ?? "未返回"],
        ])}</details><p class="read-only">不在本页修改。跨组织目录不赋予目标模块写入权限。</p>`;
      footer = button(
        "record-workbench",
        k === "automation_rules" ? "进入规则编辑" : "进入所属工作台",
        false,
        true,
      );
    } else if (kind === "filter") {
      title = "筛选治理记录";
      desc = "编辑草稿不会改变已显示记录，应用后才请求新范围。";
      body = filters(true);
    } else if (kind === "route") {
      title = "工作台跳转说明";
      desc = "审核工具，不是业务确认弹窗，也没有打开真实工作台。";
      body = `<div class="route-target">${esc(s.routeIntent)}</div><p>目标仍受原模块权限和当前组织/工作区限制。本原型不切换租户、不附加额外 ID、不操作任何记录。</p>`;
    } else {
      title = "显示设置";
      desc = "本次原型内有效；不保存偏好，不改变业务字段。";
      body = `<div class="settings">${["记录版本", "组织类型", "状态", "更新时间", "操作"].map((v, n) => `<label class="check"><input type="checkbox" data-column="${n}" ${s.columns[n] ? "checked" : ""}/> ${v}</label>`).join("")}</div><label class="check"><input id="compact" type="checkbox" ${s.compact ? "checked" : ""}/>紧凑行距</label><label class="check"><input id="freeze" type="checkbox" ${s.freeze ? "checked" : ""}/>冻结首个可见列</label><p>至少保留一列；手机完整记录不因列设置缺字段。</p>`;
    }
    modal.innerHTML = `<header><h2 id="dialog-title">${esc(title)}</h2>${button("close", "关闭")}</header><p id="dialog-description">${esc(desc)}</p>${body}<footer>${button("cancel", "返回")}${footer}</footer>`;
    on("close", close);
    on("cancel", close);
    if (kind === "filter") {
      document.querySelector("main #filters")?.remove();
      bindFilters();
    }
    on("record-workbench", () => routeIntent(href(s.selectedSection, s.selected)));
    modal.querySelectorAll("[data-column]").forEach((n) =>
      n.addEventListener("change", () => {
        if (!n.checked && s.columns.filter(Boolean).length === 1) {
          n.checked = true;
          return;
        }
        s.columns[Number(n.dataset.column)] = n.checked;
        render();
      }),
    );
    for (const k of ["compact", "freeze"])
      on(
        k,
        () => {
          s[k] = document.getElementById(k).checked;
          render();
        },
        "change",
      );
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("click", (e) => {
    if (e.target !== modal) return;
    const b = modal.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.left + b.width ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...modal.querySelectorAll("button:not(:disabled),input,select,summary")].filter(
      (n) => n.getClientRects().length,
    );
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
      e.preventDefault();
      f[0].focus();
    }
  });
  const scenes = {
    default: "原始评分记录",
    automation: "原始自动化记录",
    loading: "首次读取",
    expired: "首次过期",
    forbidden: "首次无权限",
    blocked: "首次受阻",
    error: "首次错误",
    pending: "目标切换 / 原快照保留",
    failed: "目标失败 / 原快照保留",
    recovered: "重试成功",
    timeout: "刷新超时",
    "retained-forbidden": "权限错误保留快照 / 源边界",
    "filter-draft": "筛选草稿",
    "filter-applied": "已应用筛选",
    settings: "列与密度设置",
    compact: "紧凑记录",
    dark: "深色草案",
    contrast: "高对比草案",
    "page-first": "合成20/21分页",
    "page-last": "合成末页1/21",
    "page-pending": "翻页中原页保留",
    "page-failed": "翻页失败原页保留",
    "long-detail": "长名称、组织与构建标识",
    "automation-zero": "自动化零频控 / 原显示边界",
    "provider-route": "来源版本入口 / 审核说明",
    "copy-failed": "请求编号复制失败模拟",
    hover: "按钮悬停",
    focus: "键盘焦点",
    pressed: "按钮按下",
  };
  for (const entry of D.sections) {
    for (const [suffix, label] of [
      ["list", "目录"],
      ["detail", "详情"],
      ["technical", "技术展开"],
      ["empty", "筛选为空"],
      ["filter", "状态选项"],
      ["route", "精确工作台入口"],
    ])
      scenes[entry.value + "-" + suffix] = entry.label + " / " + label;
    for (const v of D.statuses[entry.value])
      scenes[entry.value + "-status-" + v] = entry.label + " / " + status(v);
  }
  function scene(key) {
    if (!scenes[key]) throw Error("Unknown scene");
    modal.close();
    modal.replaceChildren();
    kind = "";
    generation++;
    s = initial();
    const item = D.sections.find((e) => key.startsWith(e.value + "-"));
    if (item) {
      s.synthetic = true;
      s.target = item.value;
      s.snapshot = item.value;
      s.data = clone(D.synthetic[item.value]);
      if (key.includes("-status-")) s.data.items[0].status = key.split("-status-")[1];
      if (key.endsWith("-empty")) {
        s.data.items = [];
        s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 0 };
      }
    }
    if (key === "automation") {
      s.target = s.snapshot = "automation_rules";
      s.data = clone(D.originals.automation_rules);
    }
    if (["loading", "expired", "forbidden", "blocked", "error"].includes(key)) {
      s.data = {
        summary: {},
        items: [],
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
      };
      s.phase = key;
    }
    if (key.startsWith("page-")) {
      s.synthetic = true;
      s.data = clone(D.synthetic.score_rules);
      s.data.pagination = { page: 1, page_size: 20, total: 21, total_pages: 2 };
      s.data.items = Array.from({ length: 20 }, (_, i) => ({
        ...D.synthetic.score_rules.items[0],
        id: `synthetic-${i}`,
        name: `合成评分规则 ${i + 1}`,
      }));
      if (key === "page-last") {
        s.data.items = [s.data.items[0]];
        s.data.pagination.page = 2;
        s.page = 2;
      }
    }
    if (key === "filter-draft" || key === "filter-applied") {
      s.queryDraft = "待应用条件";
      s.statusDraft = "active";
      if (key === "filter-applied") {
        s.query = s.snapshotQuery = "待应用条件";
        s.status = s.snapshotStatus = "active";
        s.synthetic = true;
      }
    }
    if (key === "compact") s.compact = true;
    if (key === "dark" || key === "contrast") s.theme = key;
    render();
    if (
      (item && ["detail", "technical"].some((v) => key.endsWith("-" + v))) ||
      key === "long-detail" ||
      key === "automation-zero"
    ) {
      if (key === "automation-zero") {
        s.synthetic = true;
        s.target = s.snapshot = "automation_rules";
        s.data = clone(D.synthetic.automation_rules);
        s.data.items[0].rate_limit_count = 0;
        render();
      }
      s.selected = clone(s.data.items[0]);
      s.selectedSection = s.snapshot;
      if (key === "long-detail") {
        s.synthetic = true;
        s.selected.name = "长中文规则名称需要完整显示，不截断审核依据".repeat(7);
        s.selected.organization_name = "长组织名称".repeat(14);
        s.selected.version_code = "synthetic-build-".repeat(35);
        render();
      }
      open("detail");
      if (key.endsWith("-technical") || key === "long-detail")
        document.querySelector("#record-technical").open = true;
    }
    if (key === "filter-draft" || (item && key.endsWith("-filter"))) open("filter");
    if (item && key.endsWith("-route")) routeIntent(href(item.value, s.data.items[0]));
    if (key === "provider-route") routeIntent("/platform-admin/providers");
    if (key === "settings") open("settings");
    if (["pending", "failed", "recovered"].includes(key)) {
      s.target = "automation_rules";
      request();
      if (key !== "pending") complete(key === "failed" ? "error" : "success");
    }
    if (key === "timeout" || key === "retained-forbidden") {
      request();
      complete(key === "timeout" ? "timeout" : "forbidden");
    }
    if (["page-pending", "page-failed"].includes(key)) {
      request(2);
      if (key === "page-failed") complete("error");
    }
    if (key === "copy-failed") {
      document.querySelector(".technical").open = true;
      document.querySelector("#copy").click();
    }
    if (key === "focus") document.querySelector("#refresh").focus();
  }
  window.GOVERNANCE_C = { scenes, scene, complete, state: () => clone(s) };
  scene("default");
})();
