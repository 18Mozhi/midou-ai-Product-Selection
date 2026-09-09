(() => {
  const D = window.SECURITY_DATA,
    L = window.SECURITY_LABELS,
    app = document.querySelector("#app"),
    modal = document.querySelector("#modal");
  const copy = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const views = {
      events: "登录与风险事件",
      sessions: "活动与历史会话",
      credentials: "访问与凭证",
      audit: "平台审计",
    },
    types = {
      security_events: "登录与风险事件",
      sessions: "活动与历史会话",
      credential_assets: "凭证生命周期",
      organization_tokens: "组织访问令牌",
      audit_events: "平台审计",
    };
  const typeView = (k) =>
    k === "organization_tokens" || k === "credential_assets"
      ? "credentials"
      : k === "security_events"
        ? "events"
        : k === "audit_events"
          ? "audit"
          : k;
  const when = (v) =>
    v
      ? new Date(v).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "未设置";
  const status = (r) => r.outcome ?? r.status;
  const badge = (v) => `<span class="pill ${esc(v)}">${esc(L.statusText(v))}</span>`;
  const title = (k, r) =>
    k === "security_events"
      ? L.eventText(r.event_type)
      : k === "sessions"
        ? r.email
        : k === "audit_events"
          ? L.auditActionText(r.action)
          : r.name;
  const subtitle = (k, r) =>
    k === "security_events"
      ? r.user_id
        ? "已关联用户"
        : "匿名"
      : k === "sessions"
        ? r.device_label
        : k === "credential_assets"
          ? r.provider_name + " / " + L.kindText(r.kind)
          : k === "organization_tokens"
            ? r.scopes.map(L.scopeText).join("、") || "未授予权限"
            : L.resourceText(r.resource_type);
  const columns = {
    security_events: ["事件与结果", "关联身份", "发生时间", "详情"],
    sessions: ["账号与设备", "有效状态", "最近活动", "到期时间", "详情"],
    credential_assets: ["凭证与来源", "有效状态", "到期时间", "最近轮换", "详情"],
    organization_tokens: ["令牌名称", "有效状态", "权限", "到期时间", "详情"],
    audit_events: ["操作与对象", "结果", "发生时间", "详情"],
  };
  const standardFields = {
    security_events: [
      ["event_type", "事件代码"],
      ["outcome", "结果"],
      ["occurred_at", "发生时间"],
    ],
    sessions: [
      ["email", "账号"],
      ["status", "有效状态"],
      ["device_label", "设备类别"],
      ["last_seen_at", "最近活动"],
      ["expires_at", "到期时间"],
      ["created_at", "创建时间"],
    ],
    credential_assets: [
      ["name", "凭证名称"],
      ["provider_name", "来源"],
      ["kind", "凭证类型"],
      ["status", "有效状态"],
      ["expires_at", "到期时间"],
      ["rotated_at", "最近轮换"],
      ["version", "记录版本"],
      ["updated_at", "更新时间"],
    ],
    organization_tokens: [
      ["name", "令牌名称"],
      ["status", "有效状态"],
      ["scopes", "权限"],
      ["expires_at", "到期时间"],
      ["last_used_at", "最近使用"],
      ["version", "记录版本"],
      ["updated_at", "更新时间"],
    ],
    audit_events: [
      ["action", "操作代码"],
      ["resource_type", "对象类型"],
      ["outcome", "结果"],
      ["occurred_at", "发生时间"],
    ],
  };
  const techFields = {
    security_events: [
      ["id", "事件ID"],
      ["user_id", "用户ID"],
      ["request_id", "请求ID"],
      ["trace_id", "链路ID"],
    ],
    sessions: [
      ["id", "会话ID"],
      ["user_id", "用户ID"],
    ],
    credential_assets: [
      ["id", "凭证ID"],
      ["provider_id", "来源ID"],
      ["key_version", "密钥版本"],
      ["fingerprint", "脱敏指纹"],
    ],
    organization_tokens: [
      ["id", "令牌ID"],
      ["organization_id", "组织ID"],
      ["token_prefix", "令牌前缀"],
    ],
    audit_events: [
      ["id", "审计ID"],
      ["resource_id", "对象ID"],
      ["actor_id", "操作者ID"],
      ["request_id", "请求ID"],
      ["trace_id", "链路ID"],
    ],
  };
  const scenes = {
    default: "事件调查默认工作区",
    original: "原始E2E夹具 / 计数与集合不当分页事实",
    sessions: "活动与历史会话",
    credentials: "凭证与令牌双列表",
    audit: "平台审计",
    "window-7d": "7天事件范围",
    "window-30d": "30天审计范围",
    "lifecycle-window": "生命周期不受事件时间窗筛选",
    "filter-draft": "查询草稿未应用",
    "filter-max": "120字符查询上界",
    "filter-pending": "应用筛选在途",
    "filter-error": "筛选失败保留旧范围",
    "switch-pending": "跨视图读取中",
    "switch-error": "跨视图失败 / 旧事实不换标题",
    empty: "全局摘要与全部记录为空",
    "empty-credentials": "凭证和令牌各自空态",
    "credentials-empty-only": "凭证空但令牌仍有记录",
    "tokens-empty-only": "令牌空但凭证仍有记录",
    "history-sessions": "零摘要仍有过期历史会话",
    "history-credentials": "零摘要仍有过期历史凭证",
    "history-audit": "零摘要仍有审计记录",
    loading: "首次读取中",
    expired: "首次登录失效",
    forbidden: "首次缺少权限",
    "rate-limited": "首次请求受限",
    blocked: "首次依赖受阻",
    error: "首次通用错误",
    timeout: "首次超时无旧快照",
    "refresh-error": "刷新失败保留成功快照",
    "refresh-forbidden": "刷新403保留旧事实的源边界",
    "unknown-event": "未知事件代码保持可查",
    "unknown-kind": "未知凭证类型",
    "unknown-scope": "未知令牌权限 / 未授予权限",
    "unknown-audit": "未知平台操作/对象",
    anonymous: "匿名事件",
    "no-expiry": "无到期和最近使用时间",
    "long-name": "长名称与字段换行",
    manage: "凭证管理入口预览",
    "source-boundary": "来源问题与原型边界",
    technical: "页面读取技术信息",
    focus: "按钮键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    disabled: "读取中禁用",
    dark: "深色审核",
    contrast: "高对比审核",
    compact: "紧凑密度审核",
  };
  for (const view of Object.keys(views))
    for (const value of view === "events" || view === "audit"
      ? ["succeeded", "failed", "blocked"]
      : ["active", "expired", "revoked"])
      scenes["status-" + view + "-" + value] = views[view] + " / " + L.statusText(value);
  for (const k of Object.keys(types)) {
    scenes["detail-" + k] = types[k] + " / 完整详情";
    scenes["tech-" + k] = types[k] + " / 技术字段展开";
    scenes["settings-" + k] = types[k] + " / 独立列设置";
    scenes["page-" + k + "-first"] = types[k] + " / 首20条";
    scenes["page-" + k + "-last"] = types[k] + " / 末页1条";
  }
  let S,
    serial = 0,
    returnTarget = null;
  function base() {
    const d = copy(D.original);
    d.summary = {
      security_events: 3,
      risk_events: 2,
      active_sessions: 1,
      active_credentials: 1,
      credentials_expiring: 1,
      active_org_tokens: 1,
    };
    for (const k of Object.keys(types)) {
      d[k] = Array.from({ length: 3 }, (_, i) => {
        const r = copy(D.original[k][0]);
        r.id = "synthetic-" + k + "-" + i;
        if ("outcome" in r) r.outcome = ["failed", "succeeded", "blocked"][i];
        else r.status = ["active", "expired", "revoked"][i];
        if (k === "security_events")
          r.event_type = ["login.failed", "login.succeeded", "mfa_failed"][i];
        if (k === "sessions") {
          r.email = ["security@example.test", "history@example.test", "revoked@example.test"][i];
          r.device_label = "Windows · Chrome";
        }
        if (k === "credential_assets")
          r.name = ["采集读取凭证（合成）", "历史凭证（合成）", "已撤销凭证（合成）"][i];
        if (k === "organization_tokens")
          r.name = ["报表客户端（合成）", "历史令牌（合成）", "已撤销令牌（合成）"][i];
        if (r.status === "expired" && r.expires_at) r.expires_at = "2026-08-01T00:00:00Z";
        if (r.occurred_at) r.occurred_at = "2026-08-08T11:00:00Z";
        return r;
      });
      d.pagination[k] = { page: 1, page_size: 20, total: 3, total_pages: 1 };
    }
    return d;
  }
  function response(scope) {
    const d = base();
    d.view = scope.view;
    d.window = scope.window;
    for (const k of Object.keys(types)) {
      if (!D.views[scope.view].includes(k)) {
        d[k] = [];
        d.pagination[k].total = 0;
        continue;
      }
      if (S.paged === k) {
        const seed = copy(d[k][0]);
        d[k] = Array.from({ length: 21 }, (_, i) => ({
          ...copy(seed),
          id: "synthetic-page-" + k + "-" + i,
        }));
      }
      d[k] = d[k].filter(
        (r) =>
          (!scope.status || status(r) === scope.status) &&
          (!scope.query || Object.values(r).join(" ").includes(scope.query)),
      );
      const page = k === "organization_tokens" ? scope.tokenPage : scope.page;
      const total = d[k].length,
        totalPages = Math.max(1, Math.ceil(total / 20)),
        effective = Math.min(page, totalPages);
      d[k] = d[k].slice((effective - 1) * 20, effective * 20);
      d.pagination[k] = { page: effective, page_size: 20, total, total_pages: totalPages };
    }
    return d;
  }
  const button = (id, label, disabled = false) =>
    `<button type="button" id="${id}" ${disabled ? "disabled" : ""}>${label}</button>`;
  function reset() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    S = {
      target: { view: "events", window: "24h", query: "", status: "", page: 1, tokenPage: 1 },
      snapshot: { view: "events", window: "24h", query: "", status: "", page: 1, tokenPage: 1 },
      queryInput: "",
      statusInput: "",
      data: null,
      phase: "ready",
      pending: null,
      calls: [],
      message: "",
      selected: null,
      modal: null,
      settings: Object.fromEntries(
        Object.entries(columns).map(([k, v]) => [
          k,
          { visible: v.map(() => true), freeze: true, density: "standard" },
        ]),
      ),
      theme: "",
      paged: null,
    };
    S.data = response(S.snapshot);
  }
  function nav() {
    document.querySelector("#views").innerHTML = Object.entries(views)
      .map(
        ([k, v]) =>
          `<button type="button" data-view="${k}" ${S.target.view === k ? 'aria-current="page"' : ""}>${v}</button>`,
      )
      .join("");
    document.querySelectorAll("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          S.queryInput = "";
          S.statusInput = "";
          read({ view: b.dataset.view, query: "", status: "", page: 1, tokenPage: 1 });
        }),
    );
  }
  function scopeText(scope) {
    return (
      views[scope.view] +
      " / " +
      { "24h": "24小时", "7d": "7天", "30d": "30天" }[scope.window] +
      "事件时间窗 / " +
      (scope.query || "无关键词") +
      " / " +
      (scope.status ? L.statusText(scope.status) : "全部状态")
    );
  }
  function summary() {
    const d = S.data;
    return `<section class="summary-strip"><header><h2>全平台背景摘要</h2><small>不随搜索与状态筛选变化</small></header><div class="global-metrics">${Object.entries(
      d.summary,
    )
      .map(([k, v]) => `<div><small>${L.summaryText(k)}</small><strong>${v}</strong></div>`)
      .join(
        "",
      )}</div><p class="summary-note">事件/风险按已读取时间窗；其余为观察时点有效量与未来七日到期量。零摘要不代表没有历史记录或审计。</p></section>`;
  }
  function rowCells(k, r) {
    const details = `<button type="button" data-detail="${k}" data-id="${r.id}">查看详情</button>`;
    switch (k) {
      case "security_events":
        return [
          `<span class="record-title">${esc(title(k, r))}</span>${badge(r.outcome)}`,
          esc(subtitle(k, r)),
          when(r.occurred_at),
          details,
        ];
      case "sessions":
        return [
          `<span class="record-title">${esc(r.email)}</span><small>${esc(r.device_label)}</small>`,
          badge(r.status),
          when(r.last_seen_at),
          when(r.expires_at),
          details,
        ];
      case "credential_assets":
        return [
          `<span class="record-title">${esc(r.name)}</span><small>${esc(subtitle(k, r))}</small>`,
          badge(r.status),
          when(r.expires_at),
          when(r.rotated_at),
          details,
        ];
      case "organization_tokens":
        return [
          `<span class="record-title">${esc(r.name)}</span>`,
          badge(r.status),
          esc(subtitle(k, r)),
          when(r.expires_at),
          details,
        ];
      default:
        return [
          `<span class="record-title">${esc(title(k, r))}</span><small>${esc(subtitle(k, r))}</small>`,
          badge(r.outcome),
          when(r.occurred_at),
          details,
        ];
    }
  }
  function list(k) {
    const rows = S.data[k],
      p = S.data.pagination[k],
      setting = S.settings[k],
      first = setting.visible.findIndex(Boolean);
    return `<section class="collection" data-collection="${k}"><header class="collection-head"><div><h2>${types[k]}</h2><small>匹配 ${p.total} 条；第 ${p.page} / ${p.total_pages} 页</small></div>${rows.length ? `<div class="actions desktop"><button type="button" data-settings="${k}">列设置</button><button type="button" data-freeze="${k}" aria-pressed="${setting.freeze}">${setting.freeze ? "首列已冻结" : "首列未冻结"}</button><label>表格密度<select data-density="${k}"><option value="standard" ${setting.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${setting.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div>` : ""}</header>${
      rows.length
        ? `<div class="desktop table-scroll ${setting.density === "compact" ? "compact" : ""}"><table><thead><tr>${columns[k].map((c, i) => `<th ${!setting.visible[i] ? "hidden" : ""} class="${setting.freeze && i === first ? "sticky-first" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${rows
            .map(
              (r) =>
                `<tr>${rowCells(k, r)
                  .map(
                    (c, i) =>
                      `<td ${!setting.visible[i] ? "hidden" : ""} class="${setting.freeze && i === first ? "sticky-first" : ""}">${c}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join(
              "",
            )}</tbody></table></div><div class="mobile">${rows.map((r) => `<article class="record-card"><button type="button" id="record-${r.id}" data-detail="${k}" data-id="${r.id}"><strong>${esc(title(k, r))}</strong><span>${badge(status(r))}</span><small>${esc(subtitle(k, r))}<br>${when(r.occurred_at || r.last_seen_at || r.expires_at)}</small><span class="read-label">查看完整详情</span></button></article>`).join("")}</div>`
        : `<div class="empty"><h3>没有匹配的${types[k]}记录</h3><p>调整搜索或状态${k === "security_events" || k === "audit_events" ? "、事件时间窗" : ""}后重试。其他分类和全平台摘要仍可查看。</p></div>`
    }${p.total_pages > 1 ? `<nav class="pagination" aria-label="${types[k]}分页"><button type="button" data-page="${k}" data-next="${p.page - 1}" ${p.page <= 1 || S.pending ? "disabled" : ""}>上一页</button><span>${types[k]} 第 ${p.page} / ${p.total_pages} 页</span><button type="button" data-page="${k}" data-next="${p.page + 1}" ${p.page >= p.total_pages || S.pending ? "disabled" : ""}>下一页</button></nav>` : ""}${k === "credential_assets" ? '<p class="manage-note"><button type="button" id="manage">进入凭证与档案管理（入口预览）</button><small>目标页重新校验权限；安全中心不执行轮换或撤销。</small></p>' : ""}</section>`;
  }
  function render() {
    document.documentElement.className = S.theme;
    nav();
    const target = S.target,
      scope = S.snapshot,
      statuses =
        target.view === "events" || target.view === "audit"
          ? ["succeeded", "failed", "blocked"]
          : ["active", "expired", "revoked"];
    app.innerHTML = `<div class="read-bar"><label for="window">事件时间窗<select id="window" ${S.pending ? "disabled" : ""}>${[
      ["24h", "24小时"],
      ["7d", "7天"],
      ["30d", "30天"],
    ]
      .map(
        ([k, v]) => `<option value="${k}" ${target.window === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label>${button("refresh", S.pending ? "正在读取…" : "刷新数据", !!S.pending)}${button("technical", "读取技术信息")}${button("boundary", "依据与边界")}</div><p class="draft-note">${S.original ? "仓库原始E2E夹具：五集合同时非空、事件1行/41总数，与当前按view查询合同不同。" : "合成审核样例：仅返回当前分类；未连接真实用户、会话或凭证。"}</p>${S.message ? `<p class="notice warn" role="status">${esc(S.message)}</p>` : ""}${S.phase !== "ready" ? `<section class="workspace empty"><h2>${{ loading: "正在读取安全事实", expired: "登录已失效", forbidden: "你没有安全运营权限", "rate-limited": "请求过于频繁", blocked: "安全运营依赖受阻", error: "安全运营读取失败", timeout: "读取超过15秒" }[S.phase]}</h2><p>尚无成功快照。${S.phase === "timeout" ? "不会称已保留不存在的上次数据。" : "不把读取失败当作没有记录。"}</p>${["loading", "expired", "forbidden"].includes(S.phase) ? "" : button("retry", "重新读取")}</section>` : summary() + `<section class="investigation"><h2>调查结果</h2><p class="scope-stamp">已读取：${esc(scopeText(scope))}<br>观察时间 ${when(S.data.observed_at)}${target.view !== scope.view ? "<br>目标分类尚未读取成功，下方仍为原分类事实。" : ""}</p><form class="filter-form" id="filter-form" role="search"><label for="query">${{ events: "搜索事件、用户或请求ID", sessions: "搜索账号、设备或会话ID", credentials: "搜索凭证、来源、令牌或组织ID", audit: "搜索操作、对象、操作者或请求ID" }[target.view]}<input type="search" id="query" maxlength="120" autocomplete="off" value="${esc(S.queryInput)}"></label><label for="status">状态<select id="status"><option value="">全部状态</option>${statuses.map((v) => `<option value="${v}" ${S.statusInput === v ? "selected" : ""}>${L.statusText(v)}</option>`).join("")}</select></label><button id="apply" ${S.pending ? "disabled" : ""}>查询</button>${button("reset", "重置", !!S.pending || (!S.target.query && !S.target.status))}</form><p class="small">时间窗只筛选事件与审计；会话、凭证与令牌按观察时点展示生命周期状态。</p>${D.views[scope.view].map(list).join("")}</section>`}`;
    bind();
  }
  function bind() {
    const on = (id, fn, ev = "click") => document.getElementById(id)?.addEventListener(ev, fn);
    on("window", (ev) => read({ window: ev.target.value, page: 1, tokenPage: 1 }), "change");
    on("refresh", () => read());
    on("retry", () => read());
    on("technical", () => info("technical"));
    on("boundary", () => info("source-boundary"));
    on("query", (ev) => (S.queryInput = ev.target.value), "input");
    on("status", (ev) => (S.statusInput = ev.target.value), "change");
    on(
      "filter-form",
      (ev) => {
        ev.preventDefault();
        read({ query: S.queryInput.trim(), status: S.statusInput, page: 1, tokenPage: 1 });
      },
      "submit",
    );
    on("reset", () => {
      S.queryInput = "";
      S.statusInput = "";
      read({ query: "", status: "", page: 1, tokenPage: 1 });
    });
    on("manage", () => info("manage"));
    app
      .querySelectorAll("[data-detail]")
      .forEach((b) => (b.onclick = () => detail(b.dataset.detail, b.dataset.id)));
    app
      .querySelectorAll("[data-settings]")
      .forEach((b) => (b.onclick = () => settings(b.dataset.settings)));
    app.querySelectorAll("[data-freeze]").forEach(
      (b) =>
        (b.onclick = () => {
          S.settings[b.dataset.freeze].freeze = !S.settings[b.dataset.freeze].freeze;
          render();
        }),
    );
    app.querySelectorAll("[data-density]").forEach(
      (b) =>
        (b.onchange = () => {
          S.settings[b.dataset.density].density = b.value;
          render();
        }),
    );
    app
      .querySelectorAll("[data-page]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            read(
              b.dataset.page === "organization_tokens"
                ? { tokenPage: Number(b.dataset.next) }
                : { page: Number(b.dataset.next) },
            )),
      );
  }
  function read(change = {}) {
    const scope = { ...copy(S.target), ...change };
    S.target = scope;
    const token = ++serial;
    S.pending = { token, scope: copy(scope) };
    S.calls.push({
      method: "GET",
      path: "/platform/security/operations",
      token,
      query: {
        window: scope.window,
        view: scope.view,
        page: scope.page,
        page_size: 20,
        token_page: scope.tokenPage,
        token_page_size: 20,
        ...(scope.query ? { query: scope.query } : {}),
        ...(scope.status ? { status: scope.status } : {}),
      },
    });
    S.message = "正在读取目标范围；下方旧事实保留原分类与条件。";
    render();
    return token;
  }
  function complete(outcome = "success", token = S.pending?.token) {
    if (!S.pending || S.pending.token !== token) return;
    const scope = S.pending.scope;
    S.pending = null;
    if (outcome === "error") {
      S.message = "读取失败；保留上次成功快照，未将旧记录归给新视图或条件。";
      render();
      return;
    }
    S.data = response(scope);
    S.snapshot = {
      ...copy(scope),
      page: S.data.pagination[D.views[scope.view][0]].page,
      tokenPage: S.data.pagination.organization_tokens.page,
    };
    S.target = copy(S.snapshot);
    if (outcome === "empty")
      for (const k of D.views[scope.view]) {
        S.data[k] = [];
        S.data.pagination[k] = { page: 1, page_size: 20, total: 0, total_pages: 1 };
      }
    S.phase = "ready";
    S.message = "本地合成响应已读取；未写入生产读取审计。";
    render();
  }
  function show(titleText, description, body, type) {
    if (modal.open) modal.close();
    returnTarget = document.activeElement;
    S.modal = type;
    modal.innerHTML = `<header><h2 id="modal-title">${esc(titleText)}</h2>${button("close", "关闭详情")}</header><p id="modal-desc" class="scope-stamp">${description}</p>${body}<footer>${button("cancel", "返回记录")}</footer>`;
    modal.showModal();
    document.getElementById("close").onclick = close;
    document.getElementById("cancel").onclick = close;
    document.getElementById("close").focus();
  }
  function close() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    S.modal = null;
    S.selected = null;
    if (returnTarget?.isConnected && returnTarget !== document.body) returnTarget.focus();
    else document.getElementById("refresh")?.focus();
  }
  modal.addEventListener("cancel", (ev) => {
    ev.preventDefault();
    close();
  });
  modal.addEventListener("click", (ev) => {
    if (ev.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom)
      close();
  });
  modal.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return;
    const f = [
      ...modal.querySelectorAll("button:not(:disabled),input:not(:disabled),select,summary"),
    ].filter((n) => n.getClientRects().length);
    if (ev.shiftKey && document.activeElement === f[0]) {
      ev.preventDefault();
      f.at(-1).focus();
    } else if (!ev.shiftKey && document.activeElement === f.at(-1)) {
      ev.preventDefault();
      f[0].focus();
    }
  });
  function display(k, v) {
    if (k.endsWith("_at")) return when(v);
    if (k === "status" || k === "outcome") return L.statusText(v);
    if (k === "scopes")
      return v?.map((x) => L.scopeText(x) + " [" + x + "]").join("、") || "未授予权限";
    if (k === "kind") return L.kindText(v) + " [" + v + "]";
    return v === null || v === undefined ? "未设置" : String(v);
  }
  function fields(r, items) {
    return `<dl class="record-details">${items.map(([k, t]) => `<dt>${t}</dt><dd data-field="${k}">${esc(display(k, r[k]))}</dd>`).join("")}</dl>`;
  }
  function detail(k, id, expanded = false) {
    const r = S.data[k].find((x) => x.id === id);
    S.selected = { type: k, row: copy(r), scope: copy(S.snapshot) };
    show(
      title(k, r),
      "来源：" +
        esc(types[k]) +
        "；已读取时点 " +
        when(S.data.observed_at) +
        "。只展示返回元数据，不允许处置对象。",
      fields(r, standardFields[k]) +
        `<details class="meta-block" ${expanded ? "open" : ""}><summary>技术详情</summary>${fields(r, techFields[k])}<p class="small">无会话token/hash、凭证密文、原始IP或原始浏览器标识。</p></details>`,
      "detail-" + k,
    );
  }
  function settings(k) {
    const v = S.settings[k];
    show(
      types[k] + "：列设置",
      "只改变本集合桌面展示，不修改服务查询、移动字段或权限。",
      `<fieldset class="column-list"><legend>至少保留一列</legend>${columns[k].map((c, i) => `<label><input type="checkbox" data-column="${i}" ${v.visible[i] ? "checked" : ""} ${v.visible.filter(Boolean).length === 1 && v.visible[i] ? "disabled" : ""}>${c}</label>`).join("")}</fieldset>`,
      "settings-" + k,
    );
    modal.querySelectorAll("[data-column]").forEach(
      (el) =>
        (el.onchange = () => {
          const i = Number(el.dataset.column);
          if (!el.checked && v.visible.filter(Boolean).length <= 1) {
            el.checked = true;
            return;
          }
          v.visible[i] = el.checked;
          modal
            .querySelectorAll("[data-column]")
            .forEach(
              (n) =>
                (n.disabled =
                  v.visible.filter(Boolean).length === 1 && v.visible[Number(n.dataset.column)]),
            );
          render();
        }),
    );
  }
  function info(key) {
    if (key === "manage")
      show(
        "凭证管理入口预览",
        "这是审核工具说明，不是新增业务确认窗。",
        '<p>真实目标：/platform-admin/credentials</p><p class="notice">目标页重新校验权限。本页可读不代表可轮换、撤销或读取密钥；离线原型不执行跳转。</p>',
        "manage",
      );
    else if (key === "technical")
      show(
        "读取技术信息",
        "仅本地合成请求标识。",
        `<dl class="record-details"><dt>请求编号</dt><dd>prototype-security-59</dd><dt>页面路由</dt><dd>/platform-admin/security</dd><dt>已读取范围</dt><dd>${esc(scopeText(S.snapshot))}</dd><dt>观察时间</dt><dd>${when(S.data.observed_at)}</dd></dl>`,
        "technical",
      );
    else
      show(
        "源码证据与原型边界",
        "当前源码惰性执行证据，不等于生产或完整Vue生命周期通过。",
        D.findings
          .map(
            (f) =>
              `<section><h3>${esc(f.id + " " + f.title)}</h3><p>${esc(f.observed)}</p><p class="notice">待审：${esc(f.proposal)}</p></section>`,
          )
          .join(""),
        "source-boundary",
      );
  }
  function chooseView(v) {
    S.target.view = v;
    S.snapshot.view = v;
    S.data = response(S.snapshot);
  }
  function scene(key) {
    reset();
    document.getElementById("scene").value = key;
    if (Object.keys(views).includes(key)) chooseView(key);
    if (key === "original") {
      S.data = copy(D.original);
      S.original = true;
    }
    if (key === "window-7d") {
      S.snapshot.window = S.target.window = "7d";
      S.data = response(S.snapshot);
    }
    if (key === "window-30d") {
      chooseView("audit");
      S.snapshot.window = S.target.window = "30d";
      S.data = response(S.snapshot);
    }
    if (key === "lifecycle-window") {
      chooseView("sessions");
      S.snapshot.window = S.target.window = "30d";
      S.data = response(S.snapshot);
    }
    if (key.startsWith("status-")) {
      const [, v, s] = key.split("-");
      chooseView(v);
      S.statusInput = s;
      S.snapshot.status = S.target.status = s;
      S.data = response(S.snapshot);
    }
    if (key.startsWith("history-")) {
      const v = key.split("-")[1];
      chooseView(v);
      S.data.summary = Object.fromEntries(Object.keys(S.data.summary).map((k) => [k, 0]));
      for (const k of D.views[v]) {
        S.data[k] =
          v === "audit" ? S.data[k].slice(0, 1) : S.data[k].filter((r) => r.status === "expired");
        S.data.pagination[k].total = S.data[k].length;
      }
    }
    if (
      key === "empty" ||
      key === "empty-credentials" ||
      key === "credentials-empty-only" ||
      key === "tokens-empty-only"
    ) {
      if (key !== "empty") chooseView("credentials");
      for (const k of D.views[S.snapshot.view])
        if (
          key === "empty" ||
          key === "empty-credentials" ||
          (key === "credentials-empty-only" && k === "credential_assets") ||
          (key === "tokens-empty-only" && k === "organization_tokens")
        ) {
          S.data[k] = [];
          S.data.pagination[k].total = 0;
        }
      if (key === "empty")
        S.data.summary = Object.fromEntries(Object.keys(S.data.summary).map((k) => [k, 0]));
    }
    if (
      ["loading", "expired", "forbidden", "rate-limited", "blocked", "error", "timeout"].includes(
        key,
      )
    )
      S.phase = key;
    if (key === "filter-draft") {
      S.queryInput = "尚未应用";
      S.statusInput = "failed";
    }
    if (key === "filter-max") S.queryInput = "检".repeat(120);
    if (key === "unknown-event") S.data.security_events[0].event_type = "unknown.event";
    if (key === "anonymous") S.data.security_events[0].user_id = null;
    if (["unknown-kind", "unknown-scope", "no-expiry", "long-name"].includes(key)) {
      chooseView("credentials");
      if (key === "unknown-kind") S.data.credential_assets[0].kind = "future_kind";
      if (key === "unknown-scope") {
        S.data.organization_tokens[0].scopes = ["future:read"];
        S.data.organization_tokens[1].scopes = [];
      }
      if (key === "no-expiry") {
        S.data.credential_assets[0].expires_at = null;
        S.data.organization_tokens[0].expires_at = null;
      }
      if (key === "long-name")
        S.data.credential_assets[0].name = "华南多来源趋势研究专用采集凭证".repeat(7);
    }
    if (key === "unknown-audit") {
      chooseView("audit");
      S.data.audit_events[0].action = "unknown.action";
      S.data.audit_events[0].resource_type = "unknown_resource";
    }
    const pageMatch = key.match(/^page-(.+)-(first|last)$/);
    if (pageMatch) {
      const k = pageMatch[1];
      S.paged = k;
      S.snapshot.view = S.target.view = typeView(k);
      if (k === "organization_tokens")
        S.snapshot.tokenPage = S.target.tokenPage = pageMatch[2] === "last" ? 2 : 1;
      else S.snapshot.page = S.target.page = pageMatch[2] === "last" ? 2 : 1;
      S.data = response(S.snapshot);
    }
    if (key === "dark") S.theme = "dark";
    if (key === "contrast") S.theme = "contrast";
    if (key === "compact") {
      chooseView("credentials");
      for (const v of Object.values(S.settings)) v.density = "compact";
    }
    const suffix = key.match(/^(detail|tech|settings)-(.+)$/);
    if (suffix) chooseView(typeView(suffix[2]));
    if (key === "manage") chooseView("credentials");
    render();
    if (suffix) {
      if (suffix[1] === "settings") settings(suffix[2]);
      else detail(suffix[2], S.data[suffix[2]][0].id, suffix[1] === "tech");
    }
    if (["manage", "technical", "source-boundary"].includes(key)) info(key);
    if (key === "focus") document.getElementById("refresh").focus();
    if (
      [
        "filter-pending",
        "filter-error",
        "switch-pending",
        "switch-error",
        "refresh-error",
        "refresh-forbidden",
        "disabled",
      ].includes(key)
    ) {
      if (key.startsWith("switch"))
        read({ view: "credentials", query: "", status: "", page: 1, tokenPage: 1 });
      else if (key.startsWith("filter")) {
        S.queryInput = "login.failed";
        S.statusInput = "failed";
        read({ query: S.queryInput, status: S.statusInput });
      } else read();
      if (key.endsWith("error") || key === "refresh-forbidden") {
        complete("error");
        if (key === "refresh-forbidden") {
          S.message = "刷新403：源页面保留原成功事实；这不表示新请求已获授权。";
          render();
        }
      }
    }
  }
  document.getElementById("scene").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.getElementById("scene").onchange = (ev) => scene(ev.target.value);
  window.SECURITY_C = { scene, scenes, state: () => copy(S), complete, read };
  scene("default");
})();
