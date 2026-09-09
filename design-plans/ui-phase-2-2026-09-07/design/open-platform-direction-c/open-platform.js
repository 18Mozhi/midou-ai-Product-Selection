(() => {
  const D = window.OPEN_DATA,
    L = window.OPEN_LABELS,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "—").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const views = { clients: "接口账号", webhooks: "事件回调", deliveries: "投递记录" };
  const fullNames = { clients: "接口访问账号", webhooks: "事件回调地址", deliveries: "投递记录" };
  const columns = {
    clients: ["账号", "权限与配额", "状态与有效期", "最近调用", "操作", "技术信息"],
    webhooks: ["回调", "订阅事件", "状态", "最近更新", "操作", "技术信息"],
    deliveries: ["端点与事件", "状态", "响应", "下次可用", "更新时间", "操作", "技术信息"],
  };
  const titles = {
    "create-client": "创建接口访问账号",
    "create-webhook": "创建事件回调地址",
    "client-rotate": "轮换接口访问密钥",
    "client-revoke": "撤销接口访问账号",
    "webhook-disable": "停用事件回调",
    "webhook-enable": "启用事件回调",
    "webhook-test": "发送测试回调",
    "webhook-rotate": "轮换回调签名密钥",
    replay: "重新投递回调",
  };
  const sorts = {
    updated_desc: "最近更新",
    updated_asc: "最早更新",
    name_asc: "名称升序",
    name_desc: "名称降序",
    attempts_desc: "尝试次数最多",
  };
  const modal = document.querySelector("#modal"),
    app = document.querySelector("#app");
  let S,
    returnFocus = null,
    serial = 0;
  const baseFilter = () => ({
    query: "",
    status: "all",
    sort: "updated_desc",
    page: 1,
    pageSize: 20,
  });
  const nowText = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "从未");
  const statusText = (v, key = S.view) =>
    key === "webhooks" && v === "active" ? "启用" : L.statusText(v);
  const button = (id, text, extra = "") =>
    `<button type="button" id="${id}" ${extra}>${text}</button>`;
  const notice = (text, tone = "warn") =>
    text ? `<p class="notice ${tone}" role="status">${esc(text)}</p>` : "";
  const dl = (pairs) =>
    `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
  function reset() {
    if (modal.open) modal.close();
    S = {
      view: "clients",
      pool: clone(D.sample),
      data: clone(D.sample),
      orgDraft: "",
      orgApplied: null,
      filters: Object.fromEntries(Object.keys(views).map((k) => [k, baseFilter()])),
      applied: Object.fromEntries(Object.keys(views).map((k) => [k, baseFilter()])),
      read: null,
      readError: "",
      writeNotice: "",
      first: "",
      writes: [],
      reads: [],
      dialog: null,
      secret: null,
      settings: Object.fromEntries(
        Object.keys(views).map((k) => [k, { hidden: [], freeze: true, density: "standard" }]),
      ),
    };
    returnFocus = null;
    document.body.className = "";
  }
  function source() {
    return window.OPEN_SOURCE({
      ref: (v) => ({ value: v }),
      reactive: (v) => v,
      computed: (f) => ({
        get value() {
          return f();
        },
      }),
      nextTick: async () => {},
      onMounted: () => {},
      onBeforeUnmount: () => {},
      defineProps: () => ({ apiBaseUrl: "offline" }),
      createApiClient: () => () => {
        throw new Error("Offline prototype must not call API");
      },
      ApiClientError: class extends Error {},
      location: { search: "", pathname: "/platform-admin/open-platform" },
      history: { replaceState: () => {}, state: null },
      innerWidth: 1440,
      document: {},
      navigator: {},
      window: {},
      URLSearchParams,
      AbortController,
    });
  }
  function getRows(key) {
    const f = S.applied[key];
    let rows = S.pool[key];
    if (S.orgApplied) rows = rows.filter((r) => r.organization_id === S.orgApplied);
    if (f.status !== "all") rows = rows.filter((r) => r.status === f.status);
    if (f.query) {
      const q = f.query.toLowerCase();
      rows = rows.filter((r) =>
        key === "clients"
          ? `${r.name} ${r.client_prefix}`.toLowerCase().includes(q)
          : key === "webhooks"
            ? `${r.name} ${r.target_url}`.toLowerCase().includes(q)
            : `${r.endpoint_name} ${r.event_type}`.toLowerCase().includes(q) || r.id === f.query,
      );
    }
    rows = [...rows].sort((a, b) =>
      f.sort === "name_asc"
        ? a.name.localeCompare(b.name, "zh-CN")
        : f.sort === "name_desc"
          ? b.name.localeCompare(a.name, "zh-CN")
          : f.sort === "attempts_desc"
            ? b.attempt_count - a.attempt_count
            : f.sort === "updated_asc"
              ? a.updated_at.localeCompare(b.updated_at)
              : b.updated_at.localeCompare(a.updated_at),
    );
    return {
      rows: rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize),
      meta: {
        page: f.page,
        page_size: f.pageSize,
        total: rows.length,
        total_pages: Math.max(1, Math.ceil(rows.length / f.pageSize)),
      },
    };
  }
  function read() {
    const target = { org: S.orgDraft.trim() || null, filters: clone(S.filters) },
      id = ++serial;
    S.read = { id, target };
    S.reads.push({ path: "/platform/open", target: clone(target) });
    S.readError = "";
    render();
    return id;
  }
  function completeRead(outcome = "success", id = S.read?.id) {
    if (!S.read || id !== S.read.id) return false;
    const p = S.read;
    S.read = null;
    if (p.target.org) {
      const validation = source();
      validation.organizationId.value = p.target.org;
      validation.form.name = "只验证组织格式";
      if (!validation.validate("client")) {
        S.readError = "组织编号格式无效；没有应用目标范围，请修改组织UUID后重新读取。";
        render();
        return true;
      }
    }
    if (outcome !== "success") {
      S.readError = S.first
        ? "首次读取失败，尚无成功数据可保留。"
        : outcome === "timeout"
          ? "读取超过15秒；保留已标明范围的旧快照。"
          : "读取失败；以下仍是上次成功范围，不是当前输入结果。";
      render();
      return true;
    }
    S.orgApplied = p.target.org;
    S.applied = clone(p.target.filters);
    S.data = clone(S.pool);
    S.data.scope = { organization_id: S.orgApplied };
    for (const k of Object.keys(views)) {
      const r = getRows(k);
      S.data[k] = r.rows;
      S.data.pagination[k] = r.meta;
    }
    if (S.orgApplied && S.orgApplied !== D.org)
      S.data.summary = {
        clients: { total: 0, active: 0, expired: 0 },
        webhooks: { total: 0, active: 0 },
        deliveries: { total: 0, dead_letter: 0, retry_scheduled: 0 },
      };
    S.first = "";
    render();
    return true;
  }
  function actions(row, key = S.view) {
    let types =
      key === "clients"
        ? row.status === "active"
          ? ["client-rotate", "client-revoke"]
          : []
        : key === "webhooks"
          ? [
              row.status === "active" ? "webhook-disable" : "webhook-enable",
              ...(row.status === "active" ? ["webhook-test"] : []),
              "webhook-rotate",
            ]
          : ["succeeded", "dead_letter"].includes(row.status)
            ? ["replay"]
            : [];
    return types.length
      ? `<div class="row-buttons">${types.map((type) => `<button type="button" data-action="${type}" data-id="${esc(row.id)}" ${type === "client-revoke" ? 'class="danger"' : ""}>${{ "client-rotate": "轮换", "client-revoke": "撤销", "webhook-disable": "停用", "webhook-enable": "启用", "webhook-test": "测试", "webhook-rotate": "轮换密钥", replay: "重放" }[type]}</button>`).join("")}</div>`
      : `<span class="muted">${key === "deliveries" ? "由Worker处理" : "无可用操作"}</span>`;
  }
  const pill = (r, k) =>
    `<span class="pill ${esc(r.status)}">${esc(statusText(r.status, k))}</span>`;
  function cells(r, k) {
    if (k === "clients")
      return [
        `<strong class="row-title">${esc(r.name)}</strong>`,
        `${esc(r.scopes.map(L.scopeText).join("、"))}<small>每分钟 ${r.quota_per_minute} 次</small>`,
        `${pill(r, k)}<small>${esc(nowText(r.expires_at))} 到期</small>`,
        esc(nowText(r.last_used_at)),
        actions(r, k),
        `<button type="button" data-detail="${r.id}" data-tech>完整详情</button>`,
      ];
    if (k === "webhooks")
      return [
        `<strong class="row-title">${esc(r.name)}</strong><small>${esc(r.target_url)}</small>`,
        esc(r.events.map(L.eventText).join("、")),
        `${pill(r, k)}<small>第 ${r.version} 版</small>`,
        esc(nowText(r.updated_at)),
        actions(r, k),
        `<button type="button" data-detail="${r.id}" data-tech>完整详情</button>`,
      ];
    return [
      `<strong class="row-title">${esc(r.endpoint_name)}</strong><small>${esc(L.eventText(r.event_type))}</small>`,
      `${pill(r, k)}<small>已尝试 ${r.attempt_count} 次</small>`,
      esc(r.response_status ?? (r.last_error_code ? "投递失败" : "—")),
      esc(nowText(r.available_at)),
      esc(nowText(r.updated_at)),
      actions(r, k),
      `<button type="button" data-detail="${r.id}" data-tech>完整详情</button>`,
    ];
  }
  function render() {
    const k = S.view,
      f = S.filters[k],
      meta = S.data.pagination[k],
      settings = S.settings[k],
      summary = S.data.summary[k];
    document.querySelector("#views").innerHTML = Object.keys(views)
      .map(
        (v) =>
          `<button type="button" data-view="${v}" ${v === k ? 'aria-current="page"' : ""}><strong>${views[v]}</strong><small>${S.first ? "尚未读取" : `${S.data.summary[v].total} 条记录`}</small></button>`,
      )
      .join("");
    const applied = S.applied[k];
    app.innerHTML = `<form id="org-form" class="org-form"><label for="org">读取组织范围<input id="org" value="${esc(S.orgDraft)}" placeholder="组织UUID；留空读取全部组织" autocomplete="off" /></label><button type="submit" ${S.read ? "disabled" : ""}>${S.read ? "读取中…" : "读取组织"}</button></form>
    <div class="scope-record"><strong>${S.first ? "尚无成功快照" : `已读取：${esc(S.orgApplied || "全部组织")}`}</strong><small>${S.first ? "尚无观测时间或统计数据" : `观测时间 ${esc(nowText(S.data.observed_at))} · 合成审核数据`}</small></div>${notice(S.writeNotice, "")}${notice(S.readError, "error")}${S.read ? notice(`正在读取目标：${S.read.target.org || "全部组织"}；${S.first ? "请等待首次结果。" : "现有记录仍归属上方已读取范围。"}`) : ""}
    ${
      S.first
        ? `<section class="workspace empty"><h2>${esc({ loading: "正在读取开放平台", expired: "登录状态已过期", forbidden: "无权限查看开放平台", rate_limited: "请求过于频繁", blocked: "开放平台依赖受阻", error: "读取失败", timeout: "首次读取超时" }[S.first])}</h2><p>尚无成功结果。${S.first === "loading" ? "请等待读取。" : "恢复会话、权限或依赖后重试；没有旧数据可保留。"}</p>${button("refresh", "重试", S.first === "loading" ? "disabled" : "")}</section>`
        : `
    <section class="workspace"><header class="workspace-head"><div><h2>${fullNames[k]}</h2><p class="muted">${{ clients: "只授权已开放的系统状态读取能力。", webhooks: "管理接收地址、订阅事件与签名材料。", deliveries: "核对响应、尝试次数和可处理时点。" }[k]}</p></div><div class="actions">${button("refresh", "刷新", S.read ? "disabled" : "")}${k !== "deliveries" ? button("create", k === "clients" ? "创建接口账号" : "创建事件回调", 'class="primary"') : ""}</div></header>
    <div class="summary-line">${Object.entries(summary)
      .map(
        ([key, value]) =>
          `<span><strong>${value}</strong>${{ total: "条总记录", active: k === "webhooks" ? "个启用" : "个可用", expired: "个过期", dead_letter: "条多次失败", retry_scheduled: "条等待重试" }[key]}</span>`,
      )
      .join("")}<small>仅随已读取组织变化，不随列表筛选变化</small></div>
    <form id="filter-form"><div class="filter-grid"><label for="query">搜索<input id="query" maxlength="120" value="${esc(f.query)}" placeholder="${{ clients: "名称或账号前缀", webhooks: "名称或回调网址", deliveries: "端点、事件或完整投递ID" }[k]}" /></label><label for="status">状态<select id="status">${["all", ...D.statuses[k]].map((v) => `<option value="${v}" ${v === f.status ? "selected" : ""}>${v === "all" ? "全部状态" : statusText(v, k)}</option>`).join("")}</select></label><label for="sort">排序<select id="sort">${Object.keys(
      sorts,
    )
      .filter((v) => (k === "deliveries" ? !v.startsWith("name") : v !== "attempts_desc"))
      .map((v) => `<option value="${v}" ${v === f.sort ? "selected" : ""}>${sorts[v]}</option>`)
      .join(
        "",
      )}</select></label><label for="page-size">每页<select id="page-size">${[10, 20, 50].map((v) => `<option ${v === f.pageSize ? "selected" : ""}>${v}</option>`).join("")}</select></label></div><div class="filter-actions"><div class="actions"><button id="apply" type="submit" ${S.read ? "disabled" : ""}>应用筛选</button>${button("reset", "重置", S.read ? "disabled" : "")}</div><small>当前快照：${esc(applied.query || "无关键词")} / ${esc(applied.status === "all" ? "全部状态" : statusText(applied.status))} / ${sorts[applied.sort]}</small></div></form>
    <div class="desktop"><div class="table-settings">${button("columns", "列设置")}${button("freeze", settings.freeze ? "首列已冻结" : "首列未冻结", `aria-pressed="${settings.freeze}"`)}<label for="density">表格密度<select id="density"><option value="standard">标准</option><option value="compact" ${settings.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div></div>
    ${
      S.data[k].length
        ? `<div class="desktop table-scroll ${settings.density}"><table><thead><tr>${columns[k].map((c, i) => (settings.hidden.includes(i) ? "" : `<th class="${settings.freeze && i === columns[k].findIndex((_, j) => !settings.hidden.includes(j)) ? "sticky-first" : ""}">${c}</th>`)).join("")}</tr></thead><tbody>${S.data[
            k
          ]
            .map(
              (r) =>
                `<tr>${cells(r, k)
                  .map((c, i) =>
                    settings.hidden.includes(i)
                      ? ""
                      : `<td class="${settings.freeze && i === columns[k].findIndex((_, j) => !settings.hidden.includes(j)) ? "sticky-first" : ""}">${c}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join(
              "",
            )}</tbody></table></div><div class="mobile">${S.data[k].map((r) => `<article class="mobile-record"><button type="button" data-detail="${r.id}" aria-haspopup="dialog"><strong>${esc(r.name || r.endpoint_name)}</strong><span>${pill(r, k)} ${k === "deliveries" ? esc(L.eventText(r.event_type)) : k === "clients" ? esc(r.scopes.map(L.scopeText).join("、")) : esc(r.events.map(L.eventText).join("、"))}</span><small>${k === "clients" ? `每分钟 ${r.quota_per_minute} 次` : k === "deliveries" ? `已尝试 ${r.attempt_count} 次` : `第 ${r.version} 版`}</small><span class="read-link">查看完整详情与操作</span></button></article>`).join("")}</div>`
        : `<div class="empty"><h3>当前筛选没有${fullNames[k]}</h3><p>${meta.page > meta.total_pages ? "当前请求页已超出末页，服务没有自动纠页。请返回第一页重新读取。" : "调整搜索或状态条件，不会删除记录。"}</p>${button("clear", "清除筛选")}</div>`
    }
    <footer class="pagination"><span>${meta.total} 条匹配记录 · 第 ${meta.page} / ${meta.total_pages} 页</span><nav class="actions" aria-label="列表分页">${button("prev", "上一页", S.read || meta.page <= 1 ? "disabled" : "")}${button("next", "下一页", S.read || meta.page >= meta.total_pages ? "disabled" : "")}</nav></footer></section>`
    }
    <details class="technical"><summary>读取合同与证据边界</summary><p>一次GET返回三个集合；切换工作区仅切本地视图。真实管理写入要求独立能力、同源、幂等键和操作原因。图中不调用任何接口。</p><p>投递记录不是尝试历史或原始事件查看器；202只表示排队。示例中的更新时间排序不假定ID稳定次序。</p></details>${S.read ? `<div class="simulation"><p class="small">审核工具：模拟本次读取响应</p><div class="actions">${button("read-success", "模拟读取成功")}${button("read-failure", "模拟读取失败")}</div></div>` : ""}`;
    document.querySelectorAll("[data-view]").forEach(
      (n) =>
        (n.onclick = () => {
          S.view = n.dataset.view;
          render();
        }),
    );
    document.querySelector("#org").oninput = (e) => (S.orgDraft = e.target.value);
    document.querySelector("#org-form").onsubmit = (e) => {
      e.preventDefault();
      read();
    };
    document.querySelector("#refresh").onclick = () => read();
    if (S.read) {
      document.querySelector("#read-success").onclick = () => completeRead();
      document.querySelector("#read-failure").onclick = () => completeRead("error");
    }
    if (!S.first) {
      document.querySelector("#filter-form").onsubmit = (e) => {
        e.preventDefault();
        S.filters[k].page = 1;
        read();
      };
      for (const [id, key] of [
        ["query", "query"],
        ["status", "status"],
        ["sort", "sort"],
        ["page-size", "pageSize"],
      ])
        document.getElementById(id).onchange = document.getElementById(id).oninput = (e) =>
          (S.filters[k][key] = key === "pageSize" ? Number(e.target.value) : e.target.value.trim());
      const clear = () => {
        S.filters[k] = baseFilter();
        read();
      };
      document.querySelector("#reset").onclick = clear;
      if (document.querySelector("#clear")) document.querySelector("#clear").onclick = clear;
      document.querySelector("#prev").onclick = () => {
        S.filters[k].page = meta.page - 1;
        read();
      };
      document.querySelector("#next").onclick = () => {
        S.filters[k].page = meta.page + 1;
        read();
      };
      if (k !== "deliveries")
        document.querySelector("#create").onclick = () =>
          openAction(k === "clients" ? "create-client" : "create-webhook");
      document.querySelector("#columns").onclick = () => show({ kind: "columns" });
      document.querySelector("#freeze").onclick = () => {
        settings.freeze = !settings.freeze;
        render();
      };
      document.querySelector("#density").onchange = (e) => {
        settings.density = e.target.value;
        render();
      };
      bindRows(app);
    }
  }
  function bindRows(root) {
    root.querySelectorAll("[data-detail]").forEach(
      (n) =>
        (n.onclick = () =>
          show({
            kind: "detail",
            row: clone(S.data[S.view].find((r) => r.id === n.dataset.detail)),
            tech: n.hasAttribute("data-tech"),
          })),
    );
    root.querySelectorAll("[data-action]").forEach(
      (n) =>
        (n.onclick = () =>
          openAction(
            n.dataset.action,
            S.data[S.view].find((r) => r.id === n.dataset.id),
            S.dialog?.kind === "detail" ? clone(S.dialog) : null,
          )),
    );
  }
  function show(frame) {
    if (!modal.open) returnFocus = document.activeElement;
    S.dialog = frame;
    renderModal();
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    modal.querySelector("#close").focus();
  }
  function close() {
    if (S.dialog?.kind === "secret") S.secret = null;
    S.dialog = null;
    modal.close();
    modal.innerHTML = "";
    if (returnFocus?.isConnected && returnFocus !== document.body) returnFocus.focus();
    else document.querySelector("#refresh").focus();
  }
  function openAction(type, row = null, back = null) {
    show({
      kind: "form",
      type,
      row: row ? clone(row) : null,
      back,
      values: {
        org: S.orgApplied || "",
        name: "",
        quota: 60,
        target: "",
        events: ["scoutops.test"],
        reason: "开放平台配置变更",
      },
      errors: {},
    });
  }
  function details(row) {
    const k = S.view;
    let facts, tech;
    if (k === "clients") {
      facts = [
        ["授权范围", row.scopes.map(L.scopeText).join("、")],
        ["每分钟限额", `${row.quota_per_minute} 次`],
        ["当前状态", statusText(row.status)],
        ["有效期", nowText(row.expires_at)],
        ["最近调用", nowText(row.last_used_at)],
      ];
      tech = [
        ["账号 ID", row.id],
        ["账号前缀", row.client_prefix],
        ["组织 ID", row.organization_id],
        ["版本", row.version],
        ["更新时间", nowText(row.updated_at)],
      ];
    } else if (k === "webhooks") {
      facts = [
        ["安全网址", row.target_url],
        ["订阅事件", row.events.map(L.eventText).join("、")],
        ["当前状态", statusText(row.status)],
        ["最近更新", nowText(row.updated_at)],
      ];
      tech = [
        ["回调 ID", row.id],
        ["组织 ID", row.organization_id],
        ["签名指纹", row.fingerprint],
        ["版本", row.version],
      ];
    } else {
      facts = [
        ["事件", L.eventText(row.event_type)],
        ["当前状态", statusText(row.status)],
        ["尝试次数", `${row.attempt_count} 次`],
        ["响应状态", row.response_status ?? (row.last_error_code ? "投递失败" : "—")],
        ["下次可用", nowText(row.available_at)],
        ["更新时间", nowText(row.updated_at)],
      ];
      tech = [
        ["投递 ID", row.id],
        ["回调 ID", row.endpoint_id],
        ["组织 ID", row.organization_id],
        ["错误代码", row.last_error_code || "无"],
      ];
    }
    return (
      dl(facts) +
      `<details class="technical" ${S.dialog.tech ? "open" : ""}><summary>技术详情（仅元数据）</summary>${dl(tech)}</details>` +
      actions(row)
    );
  }
  function field(id, label, value, extra = "") {
    const e = S.dialog.errors?.[id];
    return `<label for="field-${id}">${label}<input id="field-${id}" value="${esc(value)}" ${extra} ${e ? `aria-invalid="true" aria-describedby="error-${id}"` : ""} />${e ? `<small class="field-error" id="error-${id}">${esc(e)}</small>` : ""}</label>`;
  }
  function renderModal() {
    const f = S.dialog;
    if (!f) return;
    let title = "",
      desc = "",
      body = "",
      foot = "";
    if (f.kind === "detail") {
      title = f.row.name || f.row.endpoint_name;
      desc = "完整记录与已有操作；所有数据为合成样例。";
      body = details(f.row);
    }
    if (f.kind === "columns") {
      title = `${views[S.view]}列设置`;
      desc = "至少显示一列。只影响本工作区桌面表格，不隐藏移动详情字段。";
      body = columns[S.view]
        .map(
          (c, i) =>
            `<label class="check"><input type="checkbox" data-col="${i}" ${S.settings[S.view].hidden.includes(i) ? "" : "checked"} ${S.settings[S.view].hidden.length === columns[S.view].length - 1 && !S.settings[S.view].hidden.includes(i) ? "disabled" : ""} />${c}</label>`,
        )
        .join("");
    }
    if (f.kind === "form") {
      const creating = f.type.startsWith("create");
      title = titles[f.type];
      desc = creating
        ? "填写接入信息，再核对组织与影响。"
        : "本次原因只用于当前对象；不会消费其他创建表单的旧原因。";
      body = `<div class="stage"><b>填写${creating ? "信息" : "原因"}</b><span>›</span><span>核对影响</span><span>›</span><span>操作结果</span></div>${f.row ? `<div class="scope-record"><strong>${esc(f.row.name || f.row.endpoint_name)}</strong><small>组织 ${esc(f.row.organization_id)} · ${esc(f.row.id)}</small></div>` : ""}<form id="action-form" class="form-fields" novalidate>${creating ? field("org", "创建所属组织UUID", f.values.org, 'autocomplete="off"') + field("name", "名称（1–120字）", f.values.name, 'maxlength="120"') : ""}${f.type === "create-client" ? field("quota", "每分钟配额（当前UI范围1–1000）", f.values.quota, 'type="number" min="1" max="1000"') + '<p class="muted">固定权限：读取系统状态（status:read）；后端上限以运行配置为准。</p>' : ""}${f.type === "create-webhook" ? field("target", "HTTPS回调网址", f.values.target, 'type="url" placeholder="https://example.com/hooks/scoutops"') + `<fieldset ${f.errors.events ? 'aria-describedby="error-events"' : ""}><legend>订阅已支持事件（至少一项）</legend>${["scoutops.test", "task.updated", "approval.updated", "competitor.changed"].map((e) => `<label class="check"><input type="checkbox" data-event="${e}" ${f.values.events.includes(e) ? "checked" : ""} />${L.eventText(e)}</label>`).join("")}${f.errors.events ? `<small class="field-error" id="error-events">${esc(f.errors.events)}</small>` : ""}</fieldset>` : ""}<label for="field-reason">本次操作原因（1–500字）<textarea id="field-reason" maxlength="500" ${f.errors.reason ? 'aria-invalid="true" aria-describedby="error-reason"' : ""}>${esc(f.values.reason)}</textarea>${f.errors.reason ? `<small id="error-reason" class="field-error">${esc(f.errors.reason)}</small>` : ""}</label><button type="submit" id="review-action" class="primary">核对影响</button></form>`;
      foot = button("cancel-action", "取消");
    }
    if (["confirm", "pending", "failure", "unknown"].includes(f.kind)) {
      title = f.pending.title;
      desc = "已冻结目标、版本和请求内容。此处为本地模拟，不会执行真实写入。";
      body = `<div class="stage"><span>填写信息</span><span>›</span><b>核对影响</b><span>›</span><span>操作结果</span></div><div class="scope-record"><strong>${esc(f.row?.name || f.row?.endpoint_name || f.pending.body.name)}</strong><small>组织 ${esc(f.row?.organization_id || f.pending.body.organization_id)}</small></div><p>${esc(f.pending.description)}</p><section class="notice warn"><h3>影响范围</h3><p>${esc(f.pending.impact)}</p></section>${dl([["本次原因", f.pending.body.reason]])}<details class="technical"><summary>请求合同（审核工具）</summary><p>${esc(f.pending.method)} ${esc(f.pending.path)}</p><pre class="long-value">${esc(JSON.stringify(f.pending.body, null, 2))}</pre></details>`;
      if (f.kind === "confirm") {
        if (f.pending.destructive)
          body += `<label class="check"><input type="checkbox" id="ack" />我已阅读影响范围，并确认只处理上述对象</label>`;
        foot =
          button("back", "返回修改") +
          button(
            "execute",
            "确认执行",
            `class="${f.pending.destructive ? "danger" : "primary"}" ${f.pending.destructive ? "disabled" : ""}`,
          );
      } else if (f.kind === "pending") {
        body += notice("正在提交当前操作。重复点击不会发送第二次。离开窗口不代表已取消请求。");
        foot = button("busy", "提交中…", "disabled");
        body += `<div class="simulation"><label for="outcome">审核工具：选择模拟响应</label><select id="outcome">${["success", "read-error", "queued", "replay-no-secret", "conflict", "forbidden", "rate-limit", "blocked", "unknown"].map((v) => `<option>${v}</option>`).join("")}</select>${button("resolve", "模拟返回")}</div>`;
      } else {
        body += notice(f.message, "error");
        foot = button("back", "返回核对");
        if (f.kind === "unknown" || f.outcome === "conflict" || f.outcome === "blocked")
          foot = button("inspect", "核对最新记录");
      }
    }
    if (f.kind === "result") {
      title = "操作响应已确认";
      desc = "操作回执与列表读取是两件事。";
      body = notice(f.message, "") + notice(f.readError, "error");
      foot = button("finish", "返回工作区");
    }
    if (f.kind === "secret") {
      title = f.type.includes("webhook") ? "本次回调签名密钥" : "本次接口访问密钥";
      desc = "仅显示一次。关闭、Escape或离开此窗口后清除；请先保存到受限凭证系统。";
      body = `<div class="scope-record"><strong>${esc(f.row?.name || f.pending.body.name)}</strong><small>组织 ${esc(f.row?.organization_id || f.pending.body.organization_id)}</small></div><div class="secret-slot"><strong>此处显示一次性密钥</strong><p>【设计占位：不是密钥，不能用于接入】</p></div>${notice(f.copyError ? "浏览器未允许复制，请手动保存后关闭。" : "原型不写入剪贴板；可用下方按钮预览复制被拒绝时的提示。")}${notice(f.readError, "error")}`;
      foot = button("copy", "模拟复制被拒绝") + button("saved", "我已安全保存", 'class="primary"');
    }
    modal.setAttribute(
      "role",
      ["confirm", "pending", "failure", "unknown"].includes(f.kind) ? "alertdialog" : "dialog",
    );
    modal.innerHTML = `<header><h2 id="modal-title">${esc(title)}</h2>${button("close", "关闭")}</header><p id="modal-desc" class="muted">${esc(desc)}</p><section>${body}</section>${foot ? `<footer>${foot}</footer>` : ""}`;
    modal.querySelector("#close").onclick = close;
    if (f.kind === "detail") bindRows(modal);
    modal.querySelectorAll("[data-col]").forEach(
      (n) =>
        (n.onchange = () => {
          const h = S.settings[S.view].hidden,
            i = Number(n.dataset.col);
          S.settings[S.view].hidden = n.checked ? h.filter((v) => v !== i) : [...h, i];
          const position = i;
          render();
          renderModal();
          modal.querySelector(`[data-col="${position}"]`).focus();
        }),
    );
    if (f.kind === "form") {
      for (const id of ["org", "name", "quota", "target", "reason"]) {
        const n = modal.querySelector(`#field-${id}`);
        if (n) n.oninput = () => (f.values[id] = id === "quota" ? Number(n.value) : n.value);
      }
      modal.querySelectorAll("[data-event]").forEach(
        (n) =>
          (n.onchange = () => {
            f.values.events = n.checked
              ? [...f.values.events, n.dataset.event]
              : f.values.events.filter((v) => v !== n.dataset.event);
          }),
      );
      modal.querySelector("#action-form").onsubmit = (e) => {
        e.preventDefault();
        prepare();
      };
      modal.querySelector("#cancel-action").onclick = () => (f.back ? show(f.back) : close());
    }
    if (modal.querySelector("#ack"))
      modal.querySelector("#ack").onchange = (e) =>
        (modal.querySelector("#execute").disabled = !e.target.checked);
    if (modal.querySelector("#back"))
      modal.querySelector("#back").onclick = () => show({ ...f, kind: "form", errors: {} });
    if (modal.querySelector("#execute")) modal.querySelector("#execute").onclick = submit;
    if (modal.querySelector("#resolve"))
      modal.querySelector("#resolve").onclick = () =>
        completeWrite(modal.querySelector("#outcome").value);
    if (modal.querySelector("#inspect"))
      modal.querySelector("#inspect").onclick = () => {
        close();
        read();
      };
    if (modal.querySelector("#finish")) modal.querySelector("#finish").onclick = close;
    if (modal.querySelector("#copy"))
      modal.querySelector("#copy").onclick = () => {
        f.copyError = true;
        renderModal();
        modal.querySelector("#copy").focus();
      };
    if (modal.querySelector("#saved")) modal.querySelector("#saved").onclick = close;
  }
  function prepare() {
    const f = S.dialog,
      x = source();
    x.organizationId.value = f.values.org;
    Object.assign(x.form, {
      name: f.values.name,
      quota_per_minute: f.values.quota,
      target_url: f.values.target,
      reason: f.values.reason,
      events: [...f.values.events],
    });
    if (f.type === "create-client") x.createClient();
    else if (f.type === "create-webhook") x.createWebhook();
    else {
      if (!f.values.reason.trim() || f.values.reason.trim().length > 500) {
        f.errors = { reason: "填写1–500字的本次操作原因。" };
        renderModal();
        modal.querySelector("#field-reason").focus();
        return;
      }
      if (f.type.startsWith("client-")) x.clientAction(f.row, f.type.split("-")[1]);
      else if (["webhook-disable", "webhook-enable"].includes(f.type)) x.webhookUpdate(f.row);
      else if (f.type.startsWith("webhook-")) x.webhookAction(f.row, f.type.split("-")[1]);
      else x.replay(f.row);
    }
    if (!x.pending.value) {
      f.errors = Object.fromEntries(
        Object.entries(x.fieldErrors.value).map(([k, v]) => [
          { organization_id: "org", target_url: "target" }[k] || k,
          v,
        ]),
      );
      renderModal();
      modal.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    show({ ...f, kind: "confirm", pending: clone(x.pending.value) });
  }
  function submit() {
    if (S.dialog?.kind !== "confirm") return;
    const f = S.dialog;
    const id = ++serial;
    S.writes.push({
      id,
      path: f.pending.path,
      method: f.pending.method,
      body: clone(f.pending.body),
    });
    show({ ...f, kind: "pending", id });
  }
  function completeWrite(outcome = "success", id = S.dialog?.id) {
    const f = S.dialog;
    if (!f || f.kind !== "pending" || f.id !== id) return false;
    if (["conflict", "forbidden", "rate-limit", "blocked", "unknown"].includes(outcome)) {
      show({
        ...f,
        kind: outcome === "unknown" ? "unknown" : "failure",
        outcome,
        message: {
          conflict: "版本已变化（409）。先重新读取对象，再核对操作；不要沿用旧版本提交。",
          forbidden: "操作被拒绝（403）。当前请求没有成功回执，请核对权限或来源。",
          "rate-limit": "请求受限（429）。按服务提示恢复后重新核对。",
          blocked: "依赖受阻（503）。未确认操作结果，不把它当作安全重新创建的许可。",
          unknown: "未收到确定结果，操作可能已执行。先核对记录，不自动生成新密钥或再次提交。",
        }[outcome],
      });
      return true;
    }
    const queued = ["webhook-test", "replay"].includes(f.type);
    const message = queued
      ? "已排队（模拟202）。外部投递尚未确认，请在投递记录检查Worker结果。"
      : "操作响应已确认（模拟）。";
    S.writeNotice = message;
    const readError =
      outcome === "read-error"
        ? "操作成功，但随后读取失败；列表保留旧快照。请单独刷新，不重复创建或轮换。"
        : "";
    if (readError) S.readError = readError;
    if (
      ["create-client", "create-webhook", "client-rotate", "webhook-rotate"].includes(f.type) &&
      outcome !== "replay-no-secret"
    ) {
      S.secret = { type: f.type, owner: f.row?.organization_id || f.pending.body.organization_id };
      show({ ...f, kind: "secret", readError });
    } else
      show({
        ...f,
        kind: "result",
        message:
          outcome === "replay-no-secret"
            ? "幂等重放已确认；本次响应不再携带密钥，不能找回首次明文。"
            : message,
        readError,
      });
    render();
    return true;
  }
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const items = [
      ...modal.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
      ),
    ].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      const r = modal.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        close();
    }
  });
  const scenes = {
    default: "接口账号工作区",
    webhooks: "事件回调工作区",
    deliveries: "投递调查工作区",
    original: "原始E2E夹具（非真实ID）",
    loading: "首次读取中",
    expired: "会话过期401",
    forbidden: "权限拒绝403",
    rate_limited: "读取限流429",
    blocked: "依赖受阻503",
    error: "首次读取失败",
    timeout: "首次超时无旧快照",
    "org-draft": "组织输入尚未读取",
    "org-pending": "跨组织读取中",
    "org-error": "跨组织失败保留旧范围",
    "query-draft": "筛选草稿未应用",
    "query-pending": "筛选读取中",
    "query-error": "筛选失败保留旧快照",
    "write-read-error": "写入成功但读取失败",
    "replay-no-secret": "幂等重放不再返回密钥",
    "copy-denied": "一次性密钥复制拒绝",
    "secret-cleared": "密钥关闭后清除",
    "unknown-result": "操作结果未知",
    conflict: "版本冲突409",
    "write-forbidden": "操作权限拒绝403",
    "write-rate-limit": "操作限流429",
    "write-blocked": "操作依赖受阻503",
    dark: "深色代表场景",
    contrast: "高对比代表场景",
    compact: "紧凑代表场景",
    hover: "刷新悬停",
    pressed: "刷新按下",
    focus: "键盘焦点",
  };
  for (const k of Object.keys(views)) {
    scenes[`detail-${k}`] = `${views[k]}完整详情`;
    scenes[`tech-${k}`] = `${views[k]}技术展开`;
    scenes[`columns-${k}`] = `${views[k]}列设置`;
    scenes[`empty-${k}`] = `${views[k]}空集合`;
    scenes[`page-${k}`] = `${views[k]}21条第一页`;
    scenes[`page2-${k}`] = `${views[k]}21条末页`;
    for (const status of D.statuses[k])
      scenes[`status-${k}-${status}`] = `${views[k]}状态：${status}`;
  }
  scenes["page-outside"] = "请求页超过末页，不自动纠页";
  for (const type of Object.keys(titles)) {
    scenes[`form-${type}`] = `${titles[type]}填写`;
    scenes[`confirm-${type}`] = `${titles[type]}影响确认`;
  }
  for (const type of ["create-client", "create-webhook"]) {
    scenes[`invalid-${type}`] = `${titles[type]}字段错误`;
    scenes[`long-${type}`] = `${titles[type]}长字段与原因`;
  }
  for (const type of ["create-client", "create-webhook", "client-rotate", "webhook-rotate"]) {
    scenes[`secret-${type}`] = `${titles[type]}一次性密钥响应`;
  }
  scenes["pending-write"] = "写入在途防重复";
  scenes["queued-test"] = "测试202排队结果";
  scenes["queued-replay"] = "重放202排队结果";
  scenes["long-webhook-detail"] = "完整长网址与事件详情";
  for (const k of Object.keys(views))
    for (const sort of Object.keys(sorts).filter((v) =>
      k === "deliveries" ? !v.startsWith("name") : v !== "attempts_desc",
    ))
      scenes[`sort-${k}-${sort}`] = `${views[k]}排序：${sorts[sort]}`;
  function actionScene(type, stage) {
    S.view = type.includes("webhook") ? "webhooks" : type === "replay" ? "deliveries" : "clients";
    render();
    const row = type.startsWith("create")
      ? null
      : S.data[S.view][type === "webhook-enable" ? 1 : 0];
    openAction(type, row);
    Object.assign(S.dialog.values, {
      org: D.org,
      name: "系统状态读取接入（合成）",
      target: "https://example.com/hooks/scoutops",
    });
    if (stage !== "form") {
      prepare();
      if (stage === "pending" || stage === "secret") {
        submit();
        if (stage === "secret") completeWrite();
      }
    } else renderModal();
  }
  function scene(key) {
    reset();
    if (key === "webhooks" || key === "deliveries") S.view = key;
    if (key === "original") S.pool = S.data = clone(D.original);
    if (
      ["loading", "expired", "forbidden", "rate_limited", "blocked", "error", "timeout"].includes(
        key,
      )
    ) {
      S.first = key;
      S.data = { ...S.data, clients: [], webhooks: [], deliveries: [] };
    }
    if (["dark", "contrast"].includes(key)) document.body.className = key;
    if (key === "compact") S.settings.clients.density = "compact";
    const parts = key.split("-");
    if (
      ["detail", "tech", "columns", "empty", "page", "page2", "status", "sort"].includes(
        parts[0],
      ) &&
      parts[1] in views
    )
      S.view = parts[1];
    if (parts[0] === "empty") {
      S.pool[S.view] = [];
      S.data[S.view] = [];
      S.data.pagination[S.view] = { page: 1, page_size: 20, total: 0, total_pages: 1 };
    }
    if (["page", "page2"].includes(parts[0]) && parts[1] in views) {
      const base = S.pool[S.view][0];
      S.pool[S.view] = Array.from({ length: 21 }, (_, i) => ({
        ...clone(base),
        id: `synthetic-${i}`,
        name: base.name ? `${base.name} ${i + 1}` : undefined,
      }));
      S.filters[S.view].page = parts[0] === "page2" ? 2 : 1;
      read();
      completeRead();
    }
    if (parts[0] === "status") {
      S.filters[S.view].status = parts.slice(2).join("-");
      read();
      completeRead();
    }
    if (parts[0] === "sort") {
      S.filters[S.view].sort = parts.slice(2).join("-");
      read();
      completeRead();
    }
    if (key === "page-outside") {
      S.filters.clients.page = 3;
      read();
      completeRead();
    }
    render();
    if (["detail", "tech"].includes(parts[0]))
      show({ kind: "detail", row: clone(S.data[S.view][0]), tech: parts[0] === "tech" });
    if (parts[0] === "columns") show({ kind: "columns" });
    if (key.startsWith("org-")) {
      S.orgDraft = "00000000-0000-4000-8000-000000000999";
      render();
      if (key !== "org-draft") read();
      if (key === "org-error") completeRead("error");
    }
    if (key.startsWith("query-")) {
      S.filters.clients.query = "状态";
      render();
      if (key !== "query-draft") read();
      if (key === "query-error") completeRead("error");
    }
    if (["form", "confirm", "secret"].includes(parts[0]) && titles[parts.slice(1).join("-")])
      actionScene(parts.slice(1).join("-"), parts[0]);
    if (["invalid", "long"].includes(parts[0])) {
      actionScene(parts.slice(1).join("-"), "form");
      if (parts[0] === "invalid") {
        Object.assign(S.dialog.values, {
          org: "",
          name: "",
          target: "http://example.com",
          quota: 0,
          events: [],
          reason: "",
        });
        prepare();
      } else {
        Object.assign(S.dialog.values, {
          name: "跨系统接入验证".repeat(15),
          reason: "仅用于审核的长操作原因。".repeat(40),
          target: "https://example.com/" + "long-path/".repeat(24),
        });
        renderModal();
      }
    }
    if (key === "long-webhook-detail") {
      S.view = "webhooks";
      render();
      show({
        kind: "detail",
        tech: true,
        row: {
          ...S.data.webhooks[0],
          name: "跨组织事件回调接入记录".repeat(9),
          target_url: "https://example.com/" + "callbacks/".repeat(30),
        },
      });
    }
    const outcomes = {
      "write-read-error": "read-error",
      "replay-no-secret": "replay-no-secret",
      "copy-denied": "success",
      "secret-cleared": "success",
      "unknown-result": "unknown",
      conflict: "conflict",
      "write-forbidden": "forbidden",
      "write-rate-limit": "rate-limit",
      "write-blocked": "blocked",
    };
    if (key in outcomes) {
      actionScene("create-client", "pending");
      completeWrite(outcomes[key]);
      if (key === "copy-denied") {
        S.dialog.copyError = true;
        renderModal();
      }
      if (key === "secret-cleared") close();
    }
    if (key === "pending-write") actionScene("create-client", "pending");
    if (key === "queued-test" || key === "queued-replay") {
      actionScene(key === "queued-test" ? "webhook-test" : "replay", "pending");
      completeWrite();
    }
    if (key === "focus") document.querySelector("#refresh").focus();
    document.querySelector("#scene").value = key;
    scrollTo(0, 0);
    if (modal.open) modal.scrollTop = 0;
  }
  document.querySelector("#scene").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.querySelector("#scene").onchange = (e) => scene(e.target.value);
  window.OPEN_C = {
    scenes,
    scene,
    state: () => clone(S),
    read,
    completeRead,
    completeWrite,
    submit,
  };
  scene("default");
})();
