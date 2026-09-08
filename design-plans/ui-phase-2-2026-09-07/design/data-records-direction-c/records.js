(() => {
  const data = window.DATA_RECORDS_DATA,
    clone = (v) => structuredClone(v),
    $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "—").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const source = window.DATA_RECORDS_SOURCE({
    ref: (value) => ({ value }),
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    onMounted: () => {},
    onBeforeUnmount: () => {},
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: () => {} }),
    defineProps: () => ({}),
    createApiClient: () => () => {
      throw Error("No HTTP");
    },
    createApiResponseClient: () => () => {
      throw Error("No export");
    },
    ApiClientError: Error,
    window,
    AbortController,
    URLSearchParams,
    URL,
    document,
  });
  const scenes = {
    default: "原始热点记录",
    "original-supplier": "原始供应商记录",
    trends: "补充热点状态",
    opportunities: "补充机会状态",
    competitors: "补充竞品状态",
    suppliers: "补充供应商状态",
    empty: "查询无记录",
    loading: "首次读取中",
    expired: "登录已过期",
    forbidden: "无权限",
    blocked: "依赖受阻",
    error: "首次读取失败",
    refreshing: "保留快照刷新中",
    "refresh-error": "刷新失败保留范围",
    "refresh-timeout": "读取超时",
    "scope-pending": "类型切换等待",
    "scope-error": "类型切换失败",
    "query-draft": "尚未提交草稿",
    "query-max": "120字符查询",
    filtered: "查询成功",
    "page-21": "21条第一页",
    "page-two": "21条第二页",
    "limit-100": "最近100条上限",
    "export-page-two": "第二页导出完整筛选范围",
    filter: "筛选抽屉",
    detail: "只读记录详情",
    "long-detail": "长记录详情",
    export: "导出原因",
    "export-empty": "空原因",
    "export-short": "原因不足",
    "export-max": "300字原因",
    "export-over": "超过300字原因",
    "export-running": "导出处理中",
    "export-success": "导出模拟成功",
    "export-error": "导出明确失败",
    "export-unknown": "导出结果未知",
    columns: "列显隐",
    compact: "紧凑密度",
    technical: "请求编号",
    "copy-failed": "模拟复制被拒绝",
    "quality-handoff": "证据质量下一段（审核说明）",
    hover: "悬停",
    pressed: "按下",
    focus: "键盘焦点",
  };
  for (const [entity, statuses] of Object.entries(data.statuses))
    for (const status of statuses)
      scenes[`${entity}-${status}`] =
        `${data.entities.find((v) => v.value === entity).label} / ${data.labels[entity][status]}`;
  let s,
    epoch = 0,
    serial = 0;
  const returns = new Map();
  const label = (e) => data.entities.find((v) => v.value === e).label,
    statusText = (v, e = s.snapshot.entity) => source.statusName(v, e),
    time = (v) => (v ? new Date(v).toLocaleString("zh-CN") : "—");
  function bind() {
    source.entity.value = s.entity;
    source.query.value = s.query;
    source.status.value = s.status;
    source.data.value = s.snapshot;
    source.snapshotScope.value = s.scope;
    source.page.value = s.page;
  }
  const scopeText = (v) =>
    `${label(v.entity)} · 搜索：${v.query || "不限"} · 状态：${v.status ? statusText(v.status, v.entity) : "全部"}`;
  function close(d) {
    if (d.open) d.close();
    if (d.id === "export-dialog") render();
    const t = returns.get(d.id);
    if (t?.isConnected) t.focus();
  }
  function wire(d) {
    d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => close(d)));
    d.oncancel = (e) => {
      e.preventDefault();
      close(d);
    };
    d.onclick = (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        close(d);
    };
    d.onkeydown = (e) => {
      if (e.key !== "Tab") return;
      const ns = [
        ...d.querySelectorAll("button:not(:disabled),input,select,textarea,summary"),
      ].filter((n) => n.getClientRects().length);
      if (e.shiftKey && document.activeElement === ns[0]) {
        e.preventDefault();
        ns.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === ns.at(-1)) {
        e.preventDefault();
        ns[0].focus();
      }
    };
  }
  function open(d, trigger, focus) {
    returns.set(d.id, trigger || document.activeElement);
    wire(d);
    d.showModal();
    d.scrollTop = 0;
    d.querySelector(focus || "button")?.focus();
  }
  function frozen() {
    return Boolean(s.pending) || $("#export-dialog").open || s.unknown;
  }
  function getPath(scope) {
    const p = new URLSearchParams({ domain: "data", entity: scope.entity });
    if (scope.query) p.set("query", scope.query);
    if (scope.status) p.set("status", scope.status);
    return "/platform/management?" + p;
  }
  function url() {
    const u = new URL(location.href);
    u.search = new URLSearchParams({
      ...(s.entity !== "trends" ? { entity: s.entity } : {}),
      ...(s.query ? { q: s.query } : {}),
      ...(s.status ? { status: s.status } : {}),
      ...(s.page > 1 ? { page: String(s.page) } : {}),
    });
    history.replaceState(null, "", u);
  }
  function read() {
    if (frozen()) return false;
    const scope = { entity: s.entity, query: s.query, status: s.status };
    s.pending = { kind: "read", id: ++serial, epoch, scope };
    s.readNotice = s.scope
      ? "正在读取新范围；当前记录仍属于下面标注的旧快照。"
      : "正在读取近期记录。";
    s.intents.push({ method: "GET", path: getPath(scope) });
    url();
    render();
    return true;
  }
  function matches(value, query) {
    const pattern = [...query]
      .map((c) => (c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("");
    return new RegExp(pattern, "iu").test(String(value ?? ""));
  }
  function response(scope) {
    const base = s.base[scope.entity];
    const items = base.items
      .filter(
        (r) =>
          (!scope.status || r.status === scope.status) &&
          (!scope.query ||
            [
              r.title,
              r.organization_name,
              scope.entity === "suppliers" ? r.category : r.workspace_name,
            ].some((v) => matches(v, scope.query))),
      )
      .slice(0, 100);
    return {
      ...clone(base),
      items,
      summary: items.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {
        total: items.length,
      }),
    };
  }
  function complete(outcome = "success", id = s.pending?.id) {
    const p = s.pending;
    if (!p || p.id !== id || p.epoch !== epoch) return false;
    s.pending = null;
    if (p.kind === "read") {
      if (outcome === "success") {
        s.snapshot = response(p.scope);
        if (["opportunities", "competitors"].includes(p.scope.entity)) s.synthetic = true;
        s.scope = p.scope;
        s.page = Math.min(s.page, Math.max(1, Math.ceil(s.snapshot.items.length / 20)));
        s.first = "";
        s.readNotice = "模拟读取成功；数量只覆盖筛选后返回的最近 100 条。";
        url();
      } else {
        s.readNotice =
          (outcome === "timeout" ? "读取超过 15 秒。" : "读取失败。") +
          (s.scope ? "保留当前快照，请重试目标范围。" : "未取得数据，请处理后重试。");
        if (!s.scope) s.first = "error";
      }
    } else {
      if (outcome === "success") {
        s.writeNotice = `模拟文件响应已收到，文件归属固定为${label(p.scope.entity)}；原型未创建CSV或审计记录。`;
        s.intents.push({
          method: "DOWNLOAD_INTENT",
          filename: `platform-${p.scope.entity}-2026-09-09.csv`,
        });
      } else if (outcome === "unknown" || outcome === "timeout") {
        s.unknown = true;
        s.writeNotice =
          "导出结果未知，服务器可能已经写入审计。此路由不保证重复提交幂等，请先核对，不自动重发。";
      } else s.writeNotice = "模拟服务端明确拒绝导出。保留当前记录，不伪造文件生成成功。";
    }
    render();
    return true;
  }
  function changeEntity(entity) {
    if (frozen() || s.entity === entity) return false;
    s.entity = entity;
    s.status = s.statusDraft = "";
    s.page = 1;
    read();
    return true;
  }
  function apply(reset = false) {
    if (frozen()) return false;
    if (reset) {
      s.queryDraft = s.statusDraft = "";
    }
    if (s.queryDraft.trim().length > 120) {
      s.fieldError = "查询最多120字符。";
      render();
      return false;
    }
    s.query = s.queryDraft.trim();
    s.status = s.statusDraft;
    s.page = 1;
    s.fieldError = "";
    close($("#filter-dialog"));
    read();
    return true;
  }
  function moveFilters() {
    const form = $("#filter-form");
    if (form)
      (matchMedia("(max-width:760px)").matches ? $("#filter-slot") : $("#filter-home")).append(
        form,
      );
  }
  function render() {
    bind();
    const busy = frozen(),
      mismatch = source.scopeMismatch.value,
      owner = s.scope?.entity || s.entity,
      current = data.entities.find((v) => v.value === owner),
      pg = source.pagination.value;
    $("#entities").innerHTML = data.entities
      .map(
        (e) =>
          `<button data-entity="${e.value}" ${s.entity === e.value ? 'aria-current="page"' : ""} ${busy ? "disabled" : ""}>${e.label}</button>`,
      )
      .join("");
    document
      .querySelectorAll("[data-entity]")
      .forEach((b) => (b.onclick = () => changeEntity(b.dataset.entity)));
    $("#record-title").textContent = `${label(owner)}近期记录`;
    $("#provenance").textContent =
      `${s.synthetic ? "补充合成数据，非实时平台记录" : "原始 UI2-DG54 隔离夹具"} · ${s.scope ? "观测 " + time(s.snapshot.observed_at) : "尚无成功快照"}`;
    $("#export-open").disabled = busy || mismatch || s.handoff;
    $("#open-filter").disabled = busy || s.handoff;
    $("#export-help").textContent = s.unknown
      ? "请核对正式导出与审计记录后再决定是否重试。"
      : mismatch
        ? "新范围尚未读取成功，暂不可导出。当前记录仍按旧类型与旧筛选解释。"
        : "CSV将按已提交条件重新查询最近100条，不限当前20条分页；结果可能与当前快照有变化。";
    for (const [id, text] of [
      ["read-notice", s.readNotice],
      ["write-notice", s.writeNotice],
    ]) {
      $("#" + id).textContent = text;
      $("#" + id).className = text
        ? "notice" +
          (text.includes("失败") || text.includes("未知") || text.includes("超过")
            ? " warning"
            : "")
        : "";
    }
    $("#work").hidden = s.handoff;
    $("#quality-handoff").hidden = !s.handoff;
    $("#quality-handoff").innerHTML =
      '<h3>证据与质量图稿待交</h3><p>这是下一交付段说明，不是假业务页面。证据、溯源、下载授权、核对和问题处理将分别设计与验证；当前稿不代表 P54 整页完成。</p><button id="back-records">返回近期记录审核稿</button>';
    $("#back-records").onclick = () => {
      s.handoff = false;
      render();
    };
    $("#view-records").disabled = busy;
    $("#view-quality").disabled = busy;
    $("#filter-form")?.remove();
    $("#filter-home").innerHTML =
      `<form class="filters" id="filter-form"><label>${s.entity === "suppliers" ? "产品标题 / 供应商 / 组织" : "名称 / 组织 / 工作区"}<input id="query" maxlength="120" value="${esc(s.queryDraft)}" ${busy ? "disabled" : ""}></label><label>记录状态<select id="status" ${busy ? "disabled" : ""}><option value="">全部状态</option>${data.statuses[s.entity].map((v) => `<option value="${v}" ${s.statusDraft === v ? "selected" : ""}>${statusText(v, s.entity)}</option>`).join("")}</select></label><div class="actions"><button class="primary" id="apply" ${busy ? "disabled" : ""}>筛选</button><button id="reset" type="button" ${busy || (!s.queryDraft && !s.statusDraft) ? "disabled" : ""}>重置</button></div><p class="field-error" role="alert">${esc(s.fieldError)}</p></form>`;
    $("#query").oninput = (e) => {
      s.queryDraft = e.target.value;
      $("#reset").disabled = !s.queryDraft && !s.statusDraft;
    };
    $("#status").onchange = (e) => {
      s.statusDraft = e.target.value;
      $("#reset").disabled = !s.queryDraft && !s.statusDraft;
    };
    $("#filter-form").onsubmit = (e) => {
      e.preventDefault();
      apply();
    };
    $("#reset").onclick = () => apply(true);
    moveFilters();
    $("#snapshot-scope").textContent = s.scope
      ? `当前快照：${scopeText(s.scope)}${mismatch ? "；目标范围：" + scopeText({ entity: s.entity, query: s.query, status: s.status }) : ""}`
      : "尚无成功快照，不能显示零记录或零异常结论。";
    $("#summary").innerHTML = s.scope
      ? Object.entries(s.snapshot.summary)
          .map(
            ([k, v]) =>
              `<div><dt>${k === "total" ? "本次返回" : statusText(k, owner)}</dt><dd>${v}</dd></div>`,
          )
          .join("")
      : "";
    if (s.first || !s.snapshot.items.length) {
      $("#content").innerHTML =
        `<section class="status-pane"><h3>${s.first ? { loading: "正在读取近期记录", expired: "登录已过期", forbidden: "没有平台数据权限", blocked: "依赖暂不可用", error: "近期数据读取失败" }[s.first] : "当前筛选没有记录"}</h3><p>${s.first ? "未取得可展示的数据；请按正式系统要求处理后重试。" : "该结论仅针对当前已提交条件，不能推断平台没有其他数据。"}</p><button id="retry" ${busy ? "disabled" : ""}>重新加载</button></section>`;
      $("#retry").onclick = read;
    } else {
      const headers = [
        current.label,
        "组织 / 工作区",
        owner === "suppliers"
          ? "供应商 / 地点"
          : owner === "competitors"
            ? "来源站点 / 市场"
            : "分类 / 市场",
        "状态",
        `${current.primary} / ${current.secondary}`,
        "更新时间",
        "技术信息",
      ];
      const rows = source.pagedItems.value;
      const cells = (r, i) => [
        `<strong>${esc(r.title)}</strong><button id="record-${i}" data-record="${i}">查看记录</button>`,
        `${esc(r.organization_name)}<small>${esc(r.workspace_name)}</small>`,
        `${esc(r.category || "—")}<small>${esc(r.market || "—")}</small>`,
        statusText(r.status, owner),
        `${esc(r.metric_primary)} / ${esc(r.metric_secondary)}${s.synthetic && r.metric_primary === 0 ? "<small>示例原始空值经现有转换为0；不当作新测量事实。</small>" : ""}`,
        esc(time(r.updated_at)),
        `<details><summary>技术详情</summary><code>${esc(r.id)}</code></details>`,
      ];
      $("#content").innerHTML =
        `<section class="record-surface"><h3>${label(owner)}记录清单</h3><div class="table-tools"><details id="columns" ${s.columnsOpen ? "open" : ""}><summary>列设置</summary><div class="column-list">${headers.map((h, i) => `<label><input type="checkbox" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} ${s.hidden.length === 6 && !s.hidden.includes(i) ? "disabled" : ""}>${h}</label>`).join("")}</div></details><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "首列已冻结" : "首列未冻结"}</button><label>表格密度<select id="density"><option value="standard">标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-wrap"><table class="${s.freeze ? "frozen" : ""} ${s.density}"><thead><tr>${headers
          .filter((_, i) => !s.hidden.includes(i))
          .map((h) => `<th scope="col">${h}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (r, i) =>
              `<tr>${cells(r, i)
                .filter((_, n) => !s.hidden.includes(n))
                .map((v) => `<td>${v}</td>`)
                .join("")}</tr>`,
          )
          .join(
            "",
          )}</tbody></table></div><div class="record-cards">${rows.map((r, i) => `<button id="mobile-record-${i}" data-record="${i}"><strong>${esc(r.title)}</strong><span>${statusText(r.status, owner)}</span><small>${esc(r.organization_name)} / ${esc(r.workspace_name)}</small><span>查看记录详情</span></button>`).join("")}</div><nav class="pagination" aria-label="近期记录分页"><button id="previous" ${busy || pg.page <= 1 ? "disabled" : ""}>上一页</button><span>${source.rangeLabel.value} · 第 ${pg.page} / ${pg.total_pages} 页</span><button id="next" ${busy || pg.page >= pg.total_pages ? "disabled" : ""}>下一页</button></nav></section>`;
      document
        .querySelectorAll("[data-record]")
        .forEach((b) => (b.onclick = () => detail(Number(b.dataset.record), b)));
      for (const [id, delta] of [
        ["previous", -1],
        ["next", 1],
      ])
        $("#" + id).onclick = () => {
          s.page = pg.page + delta;
          url();
          render();
          $("#" + id)?.focus();
        };
      $("#columns").ontoggle = (e) => (s.columnsOpen = e.target.open);
      document.querySelectorAll("[data-column]").forEach(
        (b) =>
          (b.onchange = () => {
            const i = Number(b.dataset.column);
            s.hidden = b.checked ? s.hidden.filter((v) => v !== i) : [...s.hidden, i];
            s.columnsOpen = true;
            render();
            document.querySelector(`[data-column="${i}"]`).focus();
          }),
      );
      $("#freeze").onclick = () => {
        s.freeze = !s.freeze;
        render();
        $("#freeze").focus();
      };
      $("#density").onchange = (e) => {
        s.density = e.target.value;
        render();
        $("#density").focus();
      };
    }
    $("#technical").innerHTML =
      `<details id="request-tech" ${s.techOpen ? "open" : ""}><summary>请求技术详情</summary><code>ui2-dg54-design</code><button id="copy-request">复制请求编号</button><p role="status">${esc(s.copyNotice)}</p></details>`;
    $("#request-tech").ontoggle = (e) => (s.techOpen = e.target.open);
    $("#copy-request").onclick = () => {
      s.copyNotice = s.copyFail
        ? "模拟复制被拒绝，请手动选择编号。"
        : "模拟复制成功（未写系统剪贴板）。";
      s.techOpen = true;
      s.intents.push({ method: "CLIPBOARD_INTENT", value: "ui2-dg54-design" });
      render();
      $("#copy-request").focus();
    };
    tools();
  }
  function tools() {
    $("#intents").textContent = JSON.stringify(s.intents, null, 2);
    $("#simulation-note").textContent = s.pending
      ? "有模拟请求等待结果按钮返回；无真实网络。"
      : "当前无待返回请求。";
  }
  function detail(i, trigger) {
    bind();
    const r = source.pagedItems.value[i],
      e = data.entities.find((v) => v.value === s.scope.entity);
    if (!r) return;
    const d = $("#record-dialog");
    d.innerHTML = `<header class="dialog-header"><h2 id="detail-title">${esc(r.title)}</h2><button data-close>关闭</button></header><div class="dialog-body"><p id="detail-description">${label(s.scope.entity)}只读记录，不编辑、不删除，也不跳转到原业务模块。</p><dl>${[
      ["所属组织", r.organization_name],
      ["工作区", r.workspace_name],
      [
        s.scope.entity === "suppliers" ? "供应商 / 地点" : "分类或站点 / 市场",
        `${r.category || "—"} / ${r.market || "—"}`,
      ],
      ["状态", statusText(r.status)],
      [`${e.primary} / ${e.secondary}`, `${r.metric_primary} / ${r.metric_secondary}`],
      ["更新时间", time(r.updated_at)],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><details id="record-tech"><summary>技术详情</summary><code>${esc(r.id)}</code></details></div><footer class="dialog-footer"><button data-close>返回记录</button></footer>`;
    open(d, trigger);
  }
  function exportOpen() {
    bind();
    if (frozen() || source.scopeMismatch.value) return false;
    s.exportScope = clone({ entity: s.entity, query: s.query, status: s.status });
    s.reason = "平台运营数据核对";
    const d = $("#export-dialog");
    d.innerHTML = `<header class="dialog-header"><h2 id="export-title">填写受控导出原因</h2><button data-close>关闭</button></header><div class="dialog-body"><p id="export-description">原因与操作者、筛选范围和行数一起写入平台审计。本原型不生成真实文件。</p><div class="scope-box"><strong>固定本次导出条件</strong><p>${esc(scopeText(s.exportScope))}</p><p>服务端重新读取最近100条，不限当前第${s.page}页。可能与当前快照不同；不保证重复导出只记一次审计。</p></div><label>导出原因（2–300字）<textarea id="reason" aria-describedby="reason-error" rows="4">${s.reason}</textarea></label><p class="reason-error" id="reason-error" role="status"></p></div><footer class="dialog-footer"><button data-close>取消</button><button class="primary" id="export-submit">确认提交</button></footer>`;
    $("#reason").oninput = () => {
      s.reason = $("#reason").value;
      const n = s.reason.trim().length;
      $("#export-submit").disabled = n < 2 || n > 300;
      $("#reason-error").textContent =
        n < 2 ? "至少填写2个字。" : n > 300 ? "超过300字，请缩短原因。" : `${n} / 300 字`;
    };
    $("#export-submit").onclick = submitExport;
    open(d, $("#export-open"), "textarea");
    render();
    return true;
  }
  function submitExport() {
    if (
      s.pending ||
      s.unknown ||
      !$("#export-dialog").open ||
      s.reason.trim().length < 2 ||
      s.reason.trim().length > 300
    )
      return false;
    const scope = clone(s.exportScope);
    close($("#export-dialog"));
    s.pending = { kind: "export", id: ++serial, epoch, scope };
    s.intents.push({
      method: "POST",
      path: "/platform/management/data/exports",
      body: { ...scope, reason: s.reason.trim() },
      accept: "text/csv",
    });
    s.writeNotice = "导出请求处理中。类型、筛选及文件归属已固定（待审提案）。";
    render();
    return true;
  }
  function scene(key = "default") {
    if (!(key in scenes)) throw Error("Unknown scene " + key);
    for (const d of document.querySelectorAll("dialog[open]")) d.close();
    epoch++;
    s = {
      base: clone(data.synthetic),
      snapshot: clone(data.originals.trends),
      scope: { entity: "trends", query: "", status: "" },
      entity: "trends",
      query: "",
      queryDraft: "",
      status: "",
      statusDraft: "",
      page: 1,
      first: "",
      fieldError: "",
      pending: null,
      unknown: false,
      synthetic: false,
      readNotice: "",
      writeNotice: "",
      intents: [],
      hidden: [],
      freeze: true,
      density: "standard",
      columnsOpen: false,
      techOpen: false,
      copyNotice: "",
      copyFail: false,
      handoff: false,
    };
    s.base.trends = clone(data.originals.trends);
    s.base.suppliers = clone(data.originals.suppliers);
    history.replaceState(null, "", location.pathname);
    scrollTo(0, 0);
    $("#review-tools").open = false;
    $("#scene-picker").value = key;
    if (key === "original-supplier") {
      s.entity = "suppliers";
      s.snapshot = clone(data.originals.suppliers);
      s.scope.entity = "suppliers";
    }
    const entityKey = Object.keys(data.statuses).find((e) => key === e || key.startsWith(e + "-"));
    if (entityKey) {
      s.synthetic = true;
      s.base = clone(data.synthetic);
      s.entity = entityKey;
      s.status = s.statusDraft = key === entityKey ? "" : key.slice(entityKey.length + 1);
      s.scope = { entity: entityKey, query: "", status: s.status };
      s.snapshot = response(s.scope);
    }
    if (["page-21", "page-two", "limit-100", "export-page-two"].includes(key)) {
      s.synthetic = true;
      const count = key === "limit-100" ? 100 : 21;
      s.base.trends.items = Array.from({ length: count }, (_, i) => ({
        ...data.originals.trends.items[0],
        id: `synthetic-trend-${i + 1}`,
        title: `便携照明热点记录 ${i + 1}`,
      }));
      s.snapshot = response(s.scope);
      s.page = key === "page-two" || key === "export-page-two" ? 2 : 1;
    }
    if (key === "empty") {
      s.query = s.queryDraft = "没有此记录";
      s.scope.query = s.query;
      s.snapshot = response(s.scope);
    }
    if (["loading", "expired", "forbidden", "blocked", "error"].includes(key)) {
      s.first = key;
      s.scope = null;
      s.snapshot = { entity: "trends", summary: {}, items: [], observed_at: null };
    }
    if (key === "query-draft") s.queryDraft = "尚未提交的搜索";
    if (key === "query-max") s.queryDraft = "字".repeat(120);
    if (key === "filtered") {
      s.query = s.queryDraft = "隔离";
      s.scope.query = s.query;
      s.snapshot = response(s.scope);
    }
    if (key === "long-detail") {
      s.synthetic = true;
      s.snapshot.items[0].title = "用于长内容换行审核的近期业务记录".repeat(7);
      s.snapshot.items[0].organization_name = "长组织名称".repeat(25);
      s.snapshot.items[0].id = "synthetic_".repeat(35);
    }
    if (key === "compact") s.density = "compact";
    if (key === "columns") s.columnsOpen = true;
    if (key === "technical" || key === "copy-failed") s.techOpen = true;
    if (key === "copy-failed") {
      s.copyFail = true;
      s.copyNotice = "模拟复制被拒绝，请手动选择编号。";
    }
    if (key === "quality-handoff") s.handoff = true;
    render();
    if (["loading", "refreshing", "refresh-error", "refresh-timeout"].includes(key)) {
      read();
      if (key === "refresh-error") complete("error");
      if (key === "refresh-timeout") complete("timeout");
    }
    if (key === "scope-pending" || key === "scope-error") {
      changeEntity("suppliers");
      if (key === "scope-error") complete("error");
    }
    if (key === "filter") {
      $("#filter-slot").append($("#filter-form"));
      open($("#filter-dialog"), $("#open-filter"));
    }
    if (key === "detail" || key === "long-detail") {
      detail(0, $(innerWidth <= 760 ? "#mobile-record-0" : "#record-0"));
      if (key === "long-detail") $("#record-tech").open = true;
    }
    if (key === "export" || key.startsWith("export-")) {
      exportOpen();
      const value = {
        "export-empty": "",
        "export-short": "字",
        "export-max": "审".repeat(300),
        "export-over": "审".repeat(301),
      }[key];
      if (value !== undefined) {
        $("#reason").value = value;
        $("#reason").dispatchEvent(new Event("input"));
      }
      if (["export-running", "export-success", "export-error", "export-unknown"].includes(key)) {
        submitExport();
        if (key !== "export-running") complete(key.slice(7));
      }
    }
    if (key === "focus") $("#export-open").focus();
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([key, title]) => `<option value="${key}">${title}</option>`)
    .join("");
  $("#scene-picker").onchange = (e) => scene(e.target.value);
  $("#export-open").onclick = exportOpen;
  $("#open-filter").onclick = () => open($("#filter-dialog"), $("#open-filter"));
  $("#view-quality").onclick = () => {
    if (frozen()) return;
    s.handoff = true;
    s.intents.push({ method: "NAVIGATE", path: "/platform-admin/data?view=quality" });
    render();
  };
  $("#view-records").onclick = () => {
    if (frozen()) return;
    s.handoff = false;
    render();
  };
  document
    .querySelectorAll("[data-result]")
    .forEach((b) => (b.onclick = () => complete(b.dataset.result)));
  matchMedia("(max-width:760px)").addEventListener("change", () => {
    if (innerWidth > 760) close($("#filter-dialog"));
    moveFilters();
  });
  window.DATA_RECORDS_C = {
    scenes,
    scene,
    read,
    complete,
    changeEntity,
    exportOpen,
    submitExport,
    state: () => clone(s),
  };
  scene();
})();
