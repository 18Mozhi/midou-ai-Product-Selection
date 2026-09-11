(() => {
  const clone = (v) => structuredClone(v),
    original = window.RUNTIME_C_DATA.original;
  const $ = (s) => document.querySelector(s);
  const esc = (v) =>
    String(v ?? "—").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const source = window.RUNTIME_C_SOURCE({
    ref: (value) => ({ value }),
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    onActivated: () => {},
    onMounted: () => {},
    onBeforeUnmount: () => {},
    onDeactivated: () => {},
    watch: () => {},
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ replace: () => {} }),
    defineProps: () => ({}),
    createApiClient: () => () => {
      throw Error("No source API calls allowed");
    },
    ApiClientError: Error,
    window,
    AbortController,
    URLSearchParams,
  });
  const statuses = [...source.allowedStatuses],
    headings = ["运行", "范围", "状态", "采集数量", "耗时", "开始时间"];
  const scenes = {
    default: "全局档案与运行",
    empty: "首次空数据",
    "no-runs": "有档案无运行",
    "no-profiles": "有运行无档案",
    "no-match": "搜索无结果",
    filtered: "精确追踪查询",
    loading: "首次读取中",
    refreshing: "旧快照刷新中",
    expired: "登录过期",
    forbidden: "无权限",
    blocked: "依赖受阻",
    error: "首次错误",
    "refresh-error": "刷新失败保留旧快照",
    "refresh-timeout": "15秒读取超时",
    "lease-active": "有效占用",
    "lease-expired": "过期占用",
    "lease-free": "无占用禁止回收",
    "profile-disabled": "停用且有占用",
    "credential-null": "期限未知",
    "credential-invalid": "期限不可用",
    "credential-expired": "期限到期",
    "credential-one-ms": "一毫秒后到期",
    "credential-seven-days": "七天边界",
    "credential-eight-days": "超过七天",
    "last-failure": "最近失败并非当前故障",
    "long-content": "长身份与错误",
    paged: "合成26条第一页",
    "page-two": "合成26条第二页",
    "query-max": "查询160字符",
    "query-invalid": "禁止控制字符",
    detail: "只读运行详情",
    "detail-tech": "完整技术字段",
    confirm: "回收确认未输入",
    "confirm-wrong": "输入不匹配",
    "confirm-typed": "确认输入已满足",
    saving: "回收提交中",
    "recovery-zero": "回收零项",
    "recovery-success": "回收成功后读取中",
    "recovery-error": "回收明确失败",
    "recovery-unknown": "回收结果未知",
    "success-refresh-error": "写成功但刷新失败",
    compact: "紧凑密度",
    columns: "列显隐",
    hover: "按钮悬停",
    pressed: "按钮按下",
    focus: "键盘焦点",
  };
  for (const status of statuses) scenes[`status-${status}`] = source.statusText(status);
  let s,
    epoch = 0,
    serial = 0,
    returnFocus = null;
  function bindSource() {
    source.profiles.value = s.data.profiles;
    source.observedAt.value = s.data.observed_at;
    source.runMetrics.value = s.data.run_metrics;
  }
  function closeDialog(d) {
    if (d.open) d.close();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  function openDialog(d, trigger) {
    returnFocus = trigger || document.activeElement;
    d.showModal();
    d.scrollTop = 0;
    d.querySelector("button")?.focus();
  }
  function pathFor() {
    const q = new URLSearchParams({ page: String(s.page) });
    if (s.query) q.set("q", s.query);
    if (s.status !== "all") q.set("status", s.status);
    return "/platform/crawler-runtime?" + q;
  }
  function snapshot() {
    if (!s.synthetic) return window.RUNTIME_C_FIXTURE("https://inert.test" + pathFor());
    const all = s.dataset.filter(
      (r) =>
        (s.status === "all" || r.status === s.status) &&
        [r.id, r.error_code, r.request_id, r.trace_id].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(s.query.toLowerCase()),
        ),
    );
    const pages = Math.ceil(all.length / 25),
      page = pages ? Math.min(s.page, pages) : 1;
    return {
      ...clone(s.data),
      filters: { query: s.query || null, status: s.status === "all" ? null : s.status },
      runs: all.slice((page - 1) * 25, page * 25),
      pagination: { page, page_size: 25, total: all.length, total_pages: pages },
    };
  }
  function read() {
    if (s.pending || s.unknown) return false;
    s.pending = { kind: "read", id: ++serial, epoch };
    s.readNotice = "正在读取；未取得新快照前，原观测时间保持不变。";
    s.intents.push({ method: "GET", path: pathFor() });
    render();
    return true;
  }
  function submit() {
    if (
      s.pending ||
      s.unknown ||
      !source.expiredLeaseRisks.value.length ||
      $("#typed")?.value.trim() !== "确认回收"
    )
      return false;
    closeDialog($("#confirm-dialog"));
    s.pending = { kind: "write", id: ++serial, epoch };
    s.writeNotice = "回收请求已提交，结果尚未确认。请勿重复提交。";
    s.intents.push({ method: "POST", path: "/platform/crawler-runtime/recover-expired", body: {} });
    render();
    return true;
  }
  function complete(outcome = "success", id = s.pending?.id) {
    const p = s.pending;
    if (!p || p.id !== id || p.epoch !== epoch) return false;
    s.pending = null;
    if (p.kind === "write") {
      if (outcome === "unknown" || outcome === "timeout") {
        s.unknown = true;
        s.writeNotice =
          "回收结果未知。服务器可能已经处理，请先通过正式运维记录核对；本原型禁止自动重发。";
      } else if (outcome === "error")
        s.writeNotice = "模拟服务端明确拒绝回收，请核对权限或依赖后处理。";
      else {
        s.writeNotice = `服务端模拟返回：已回收 ${outcome === "zero" ? 0 : 1} 个过期租约。不代表操作系统进程已停止或采集任务已恢复。`;
        read();
      }
    } else if (outcome === "success") {
      s.data = snapshot();
      s.page = s.data.pagination.page;
      s.first = "";
      s.readNotice = "模拟快照已更新。示例仍可含过期占用，请以返回事实核查；未执行真实回收。";
      const u = new URL(location.href);
      u.search = new URLSearchParams({
        page: String(s.page),
        ...(s.query ? { q: s.query } : {}),
        ...(s.status !== "all" ? { status: s.status } : {}),
      });
      history.replaceState(null, "", u);
    } else {
      s.readNotice =
        (outcome === "timeout" ? "读取超过 15 秒。" : "刷新失败。") +
        (s.data.observed_at ? "保留当前已验证快照与原观测时间。" : "未取得数据，可重试。");
      if (!s.data.observed_at) s.first = "error";
    }
    render();
    return true;
  }
  function profile(p) {
    const lease = p.lease,
      expired = source.leaseExpired(p),
      failure = p.last_failure;
    return `<article class="profile-row"><div><h3>${esc(p.name)}</h3><small>${esc(p.provider_name)} · ${esc(p.code)}</small><p>${esc(p.target_domain)}</p><small>档案配置：${p.status === "active" ? "启用" : "停用"}</small></div><div><small>当前占用</small><p class="occupancy ${expired ? "risk" : ""}">${lease ? (expired ? "过期占用" : "使用中") : p.status === "active" ? "可用 · 未占用" : "已停用 · 未占用"}</p>${lease ? `<p>${esc(lease.lease_owner)}</p><small>租约到期 ${esc(source.time(lease.expires_at))}</small>${expired ? '<p class="risk">需核查重复执行风险；不等于已发现僵尸进程。</p>' : ""}` : "<p>无租约记录</p>"}</div><div><small>绑定凭证期限 · 非登录探测</small><p>${esc(p.login_status === "valid" ? "期限有效" : p.login_status === "expired" ? "期限已失效" : "未设置检测期限")}</p><p>${esc(source.expiryForecast(p))}</p>${p.login_status === "expired" ? '<a href="/platform-admin/collection?status=blocked_login">处理续期任务 →</a><small>前往全部登录受阻任务，不定位本档案。</small>' : ""}</div><div><small>最近失败 · 历史记录</small><p>${failure ? esc(source.errorText(failure.error_code)) : "暂无失败记录"}</p>${failure ? `<small>${esc(source.time(failure.occurred_at))}</small>` : ""}<small>不代表当前仍未恢复。</small></div><details><summary>查看档案与租约标识</summary><dl><div><dt>档案 ID</dt><dd>${esc(p.id)}</dd></div><div><dt>来源 ID</dt><dd>${esc(p.provider_id)}</dd></div><div><dt>占用运行 ID</dt><dd>${esc(lease?.run_id)}</dd></div></dl></details></article>`;
  }
  function cells(r, i) {
    return [
      `<strong>${esc(source.errorText(r.error_code))}</strong><small>${esc(source.time(r.started_at))}</small><button id="record-${i}" data-record="${i}">记录详情</button>`,
      "已绑定组织与工作区",
      esc(source.statusText(r.status)),
      `${r.item_count} 条结果<small>${r.page_count} 页 · ${r.detail_count} 次详情</small>`,
      r.duration_ms === null ? "—" : esc(r.duration_ms) + " 毫秒",
      esc(source.time(r.started_at)),
    ];
  }
  function render() {
    bindSource();
    const occupied = source.activeLeases.value.length,
      expired = source.expiredLeaseRisks.value.length,
      busy = Boolean(s.pending),
      d = s.data;
    $("#global-metrics").innerHTML = [
      ["档案", d.profiles.length],
      ["占用（含过期）", occupied],
      ["过期风险", expired],
      ["异常运行", d.run_metrics.abnormal],
      ["全部运行", d.run_metrics.total],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${d.observed_at ? v : "—"}</dd></div>`)
      .join("");
    $("#refresh").disabled = busy || s.unknown;
    $("#recover-open").disabled = busy || s.unknown || !expired;
    $("#recovery-help").textContent = s.unknown
      ? "回收结果未知：核对前禁用再次提交。"
      : busy
        ? "请求处理中，暂时锁定查询和回收（待审提案）。"
        : expired
          ? `观测到 ${expired} 项过期占用；回收范围为执行时全局过期租约。`
          : d.observed_at
            ? "未观测到过期租约，当前不可回收。"
            : "尚未取得快照，不能判断风险或回收范围。";
    $("#provenance").textContent =
      `${s.synthetic || s.supplement ? "补充合成边界场景" : "原始 E2E 示例数据"} · ${s.data.observed_at ? "观测 " + source.time(s.data.observed_at) : "尚无观测快照"} · 不连接服务端`;
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
    if (s.first) {
      $("#content").innerHTML =
        `<section class="fact-section"><h2>${esc({ loading: "正在读取浏览器运行", expired: "登录已过期", forbidden: "无权查看运行记录", blocked: "依赖暂不可用", error: "未能读取数据" }[s.first])}</h2><p class="empty-section">${s.first === "loading" ? "尚无快照，不将缺失数据表示为零故障。" : "未取得运行快照；请根据正式系统提示处理后重试。"}</p><button id="retry" ${busy ? "disabled" : ""}>重新读取</button></section>`;
      $("#retry").onclick = read;
      renderTools();
      return;
    }
    const pg = d.pagination;
    const snapshotScope = `当前快照：${d.filters?.query || "无关键词"} · ${d.filters?.status ? source.statusText(d.filters.status) : "全部状态"} · 第 ${pg.page} 页`;
    $("#content").innerHTML =
      `<section class="fact-section"><div class="section-heading"><div><h2>档案占用清单</h2><p>全量档案，不受运行查询影响。占用、凭证期限和最近失败分别判断。</p></div></div>${d.profiles.length ? d.profiles.map(profile).join("") : '<p class="empty-section">暂无浏览器档案元数据。</p>'}</section><section class="fact-section" id="runs-section"><div class="section-heading"><div><h2>运行台账</h2><p>全局 lease_expired 信号 ${d.run_metrics.duplicate_risk} 条；仅是重复风险线索，不是已证实重复执行。</p></div></div><form class="filters" id="filter-form"><label>运行 ID / 错误 / Request / Trace<input id="query" maxlength="160" value="${esc(s.draft)}" placeholder="搜索运行记录，不搜索档案或来源" ${busy || s.unknown ? "disabled" : ""}></label><label>运行状态<select id="status" ${busy || s.unknown ? "disabled" : ""}><option value="all">全部状态</option>${statuses.map((v) => `<option value="${v}" ${v === s.draftStatus ? "selected" : ""}>${source.statusText(v)}</option>`).join("")}</select></label><div class="actions"><button id="apply" class="primary" ${busy || s.unknown ? "disabled" : ""}>查询</button><button id="reset" type="button" ${busy || s.unknown ? "disabled" : ""}>重置</button></div></form><p id="query-error" role="alert">${esc(s.queryError || "")}</p><p class="filter-context">已提交：${s.query ? esc(s.query) : "无关键词"} · ${s.status === "all" ? "全部状态" : source.statusText(s.status)}。<br>${esc(snapshotScope)} · 匹配 ${pg.total} 条${busy ? "（正在查询，新结果尚未返回）" : ""}。</p><div class="table-tools"><label>密度<select id="density"><option value="normal">标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "取消冻结首列" : "冻结首列"}</button><details id="columns" ${s.columnsOpen ? "open" : ""}><summary>显示列</summary><div class="column-list">${headings.map((h, i) => `<label><input type="checkbox" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} ${s.hidden.length === 5 && !s.hidden.includes(i) ? "disabled" : ""}>${h}</label>`).join("")}</div></details></div>${
        d.runs.length
          ? `<div class="table-wrap"><table class="${s.freeze ? "frozen" : ""} ${s.density}"><thead><tr>${headings
              .filter((h, i) => !s.hidden.includes(i))
              .map((h) => `<th scope="col">${h}</th>`)
              .join("")}</tr></thead><tbody>${d.runs
              .map(
                (r, i) =>
                  `<tr>${cells(r, i)
                    .filter((v, n) => !s.hidden.includes(n))
                    .map((v) => `<td>${v}</td>`)
                    .join("")}</tr>`,
              )
              .join(
                "",
              )}</tbody></table></div><div class="run-cards">${d.runs.map((r, i) => `<button id="mobile-record-${i}" data-record="${i}"><strong>${source.statusText(r.status)} · ${r.item_count} 条结果</strong><span>${source.errorText(r.error_code)}</span><small>${source.time(r.started_at)} · 查看记录详情 →</small></button>`).join("")}</div>`
          : '<p class="empty-section">当前查询无运行记录。全局档案与统计仍保留。</p>'
      }<nav class="pagination" aria-label="运行记录分页"><button id="previous" ${busy || s.unknown || pg.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${pg.page} 页 / 共 ${pg.total_pages} 页 · 每页 25 条 · 共 ${pg.total} 条</span><button id="next" ${busy || s.unknown || pg.page >= pg.total_pages ? "disabled" : ""}>下一页</button></nav><p class="read-time">此结果观测于 ${esc(source.time(d.observed_at))}；租约风险按该时间计算，不随设备时钟实时跳变。</p></section>`;
    $("#query").oninput = (e) => (s.draft = e.target.value);
    $("#status").onchange = (e) => (s.draftStatus = e.target.value);
    $("#filter-form").onsubmit = (e) => {
      e.preventDefault();
      if (busy || s.unknown) return;
      const q = s.draft.trim();
      if (q.length > 160 || /[\u0000-\u001f\u007f]/.test(q)) {
        s.queryError = "查询最多 160 字符，不能含控制字符。";
        render();
        return;
      }
      s.queryError = "";
      s.query = q;
      s.status = s.draftStatus;
      s.page = 1;
      read();
    };
    $("#reset").onclick = () => {
      s.draft = s.query = "";
      s.draftStatus = s.status = "all";
      s.page = 1;
      s.queryError = "";
      read();
    };
    $("#previous").onclick = () => {
      s.page = pg.page - 1;
      read();
    };
    $("#next").onclick = () => {
      s.page = pg.page + 1;
      read();
    };
    document
      .querySelectorAll("[data-record]")
      .forEach((b) => (b.onclick = () => detail(Number(b.dataset.record), b)));
    $("#density").onchange = (e) => {
      s.density = e.target.value;
      render();
      $("#density").focus();
    };
    $("#freeze").onclick = () => {
      s.freeze = !s.freeze;
      render();
      $("#freeze").focus();
    };
    $("#columns").ontoggle = (e) => (s.columnsOpen = e.target.open);
    document.querySelectorAll("[data-column]").forEach(
      (c) =>
        (c.onchange = () => {
          const i = Number(c.dataset.column);
          s.hidden = c.checked ? s.hidden.filter((v) => v !== i) : [...s.hidden, i];
          s.columnsOpen = true;
          render();
          document.querySelector(`[data-column="${i}"]`)?.focus();
        }),
    );
    renderTools();
  }
  function renderTools() {
    $("#intents").textContent = JSON.stringify(s.intents, null, 2);
    $("#simulation-note").textContent = s.pending
      ? `模拟待返回 ${s.pending.kind === "read" ? "读取" : "回收"}。上方按钮无网络访问。`
      : "当前无待返回请求；场景与结果控件不属于正式业务界面。";
  }
  function detail(i, trigger) {
    const r = s.data.runs[i];
    if (!r) return;
    const d = $("#run-dialog");
    d.innerHTML = `<header class="dialog-header"><h2 id="run-title">运行记录详情</h2><button data-close aria-label="关闭运行详情">关闭</button></header><div class="dialog-body"><p id="run-description">只读运行事实，不触发重放、浏览器启停或凭证操作。</p><dl>${[
      ["状态", source.statusText(r.status)],
      ["采集结果", r.item_count + " 条"],
      ["页面 / 详情", r.page_count + " 页 / " + r.detail_count + " 次"],
      ["耗时", r.duration_ms === null ? "—" : r.duration_ms + " 毫秒"],
      ["开始", source.time(r.started_at)],
      ["结束", source.time(r.finished_at)],
      ["原因", source.errorText(r.error_code)],
      [
        "重复风险线索",
        r.error_code === "lease_expired" ? "核对证据" : "未发现信号，不等于保证无重复",
      ],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
      .join(
        "",
      )}</dl><details id="record-tech"><summary>技术标识（6 项）</summary><dl>${["id", "organization_id", "workspace_id", "error_code", "request_id", "trace_id"].map((k) => `<div><dt>${k}</dt><dd>${esc(r[k])}</dd></div>`).join("")}</dl></details></div><footer class="dialog-footer"><button data-close>返回运行台账</button></footer>`;
    wireDialog(d);
    openDialog(d, trigger);
  }
  function confirm() {
    bindSource();
    if (s.pending || s.unknown || !source.expiredLeaseRisks.value.length) return false;
    const d = $("#confirm-dialog");
    d.innerHTML = `<header class="dialog-header"><h2 id="confirm-title">回收所有已过期租约？</h2><button data-close aria-label="关闭回收确认">关闭</button></header><div class="dialog-body"><p id="confirm-description">仅回收服务端确认已经过期的租约。不是当前筛选记录，也不是当前这一页。</p><div class="impact"><strong>执行时的全局过期集合</strong><p>当前快照观测到 ${source.expiredLeaseRisks.value.length} 个过期档案占用，实际执行数量可能变化。</p><p>只将仍在运行的对应记录标记为超时；不会终止有效租约，不会删除运行历史、档案或凭证。</p><small>这不是停止操作系统进程，也不是重新执行采集。服务端还会清理过期调度租约。</small></div><label>请输入“确认回收”<input id="typed" autocomplete="off" aria-describedby="typed-hint"></label><p id="typed-hint">无需影响勾选。去除首尾空格后必须完全匹配。</p></div><footer class="dialog-footer"><button data-close>取消</button><button id="confirm-submit" class="primary" disabled>确认回收</button></footer>`;
    wireDialog(d);
    $("#typed").oninput = () =>
      ($("#confirm-submit").disabled = $("#typed").value.trim() !== "确认回收");
    $("#confirm-submit").onclick = submit;
    openDialog(d, $("#recover-open"));
    return true;
  }
  function wireDialog(d) {
    d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeDialog(d)));
    d.oncancel = (e) => {
      e.preventDefault();
      closeDialog(d);
    };
    d.onclick = (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          closeDialog(d);
      }
    };
    d.onkeydown = (e) => {
      if (e.key !== "Tab") return;
      const nodes = [...d.querySelectorAll("button:not(:disabled),input,summary")].filter(
        (n) => n.getClientRects().length,
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
  }
  function scene(key = "default") {
    if (!(key in scenes)) throw Error("Unknown scene " + key);
    for (const d of document.querySelectorAll("dialog[open]")) d.close();
    epoch++;
    s = {
      data: clone(original),
      query: "",
      draft: "",
      status: "all",
      draftStatus: "all",
      page: 1,
      readNotice: "",
      writeNotice: "",
      queryError: "",
      intents: [],
      pending: null,
      unknown: false,
      first: "",
      synthetic: false,
      dataset: [],
      hidden: [],
      density: "normal",
      freeze: true,
      columnsOpen: false,
    };
    history.replaceState(null, "", location.pathname);
    scrollTo(0, 0);
    $("#review-tools").open = false;
    $("#scene-picker").value = key;
    const p = s.data.profiles[0];
    if (key === "empty") {
      s.data.profiles = [];
      s.data.runs = [];
      s.data.run_metrics = { total: 0, abnormal: 0, duplicate_risk: 0 };
      s.data.pagination = { page: 1, page_size: 25, total: 0, total_pages: 0 };
    }
    if (key === "no-runs") {
      s.data.runs = [];
      s.data.run_metrics = { total: 0, abnormal: 0, duplicate_risk: 0 };
      s.data.pagination = { page: 1, page_size: 25, total: 0, total_pages: 0 };
    }
    if (key === "no-profiles") s.data.profiles = [];
    if (["loading", "expired", "forbidden", "blocked", "error"].includes(key)) {
      s.first = key;
      s.data.profiles = [];
      s.data.runs = [];
      s.data.observed_at = null;
      s.data.run_metrics = { total: 0, abnormal: 0, duplicate_risk: 0 };
    }
    if (key === "lease-active") p.lease.expires_at = "2026-08-07T20:03:00.000Z";
    if (key === "lease-free") s.data.profiles.forEach((p) => (p.lease = null));
    if (key === "profile-disabled") p.status = "disabled";
    const expiry = {
      "credential-null": null,
      "credential-invalid": "invalid",
      "credential-expired": original.observed_at,
      "credential-one-ms": new Date(Date.parse(original.observed_at) + 1).toISOString(),
      "credential-seven-days": new Date(
        Date.parse(original.observed_at) + 7 * 86400000,
      ).toISOString(),
      "credential-eight-days": new Date(
        Date.parse(original.observed_at) + 7 * 86400000 + 1,
      ).toISOString(),
    };
    if (key in expiry) {
      p.credential_expires_at = expiry[key];
      p.login_status =
        key === "credential-expired" ? "expired" : key === "credential-null" ? "unknown" : "valid";
    }
    if (key === "last-failure")
      p.last_failure = { error_code: "blocked_login", occurred_at: original.runs[0].started_at };
    if (key === "long-content") {
      p.name = "用于验证窄屏完整换行的浏览器档案名称".repeat(5);
      p.provider_name = "LongProvider".repeat(12);
      p.last_failure = {
        error_code: "unknown_".repeat(50),
        occurred_at: original.runs[0].started_at,
      };
      s.data.runs[0].trace_id = "trace_".repeat(70);
    }
    if (["paged", "page-two"].includes(key)) {
      s.synthetic = true;
      s.dataset = Array.from({ length: 26 }, (_, i) => ({
        ...clone(original.runs[i % 3]),
        id: `synthetic-run-${i + 1}`,
        trace_id: `synthetic-trace-${i + 1}`,
      }));
      s.page = key === "page-two" ? 2 : 1;
      s.data.run_metrics = { total: 26, abnormal: 8, duplicate_risk: 0 };
      s.data = snapshot();
    }
    if (key.startsWith("status-")) {
      s.synthetic = true;
      s.status = s.draftStatus = key.slice(7);
      s.dataset = [{ ...clone(original.runs[0]), status: s.status }];
      s.data.run_metrics = {
        total: 1,
        abnormal: ["blocked", "failed", "timed_out"].includes(s.status) ? 1 : 0,
        duplicate_risk: 0,
      };
      s.data = snapshot();
    }
    if (["filtered", "no-match"].includes(key)) {
      s.query = s.draft = key === "filtered" ? "TRACE-SUCCESS" : "market.example.test";
      s.data = snapshot();
    }
    if (key === "query-max") s.draft = "a".repeat(160);
    if (key === "query-invalid") {
      s.draft = "invalid";
      s.queryError = "查询最多 160 字符，不能含控制字符。";
    }
    if (key === "compact") s.density = "compact";
    if (key === "columns") s.columnsOpen = true;
    if (
      ![
        "default",
        "filtered",
        "no-match",
        "lease-expired",
        "detail",
        "detail-tech",
        "confirm",
        "confirm-wrong",
        "confirm-typed",
        "compact",
        "columns",
        "hover",
        "pressed",
        "focus",
      ].includes(key)
    )
      s.supplement = true;
    render();
    if (["loading", "refreshing", "refresh-error", "refresh-timeout"].includes(key)) {
      read();
      if (key === "refresh-error") complete("error");
      if (key === "refresh-timeout") complete("timeout");
    }
    if (key === "detail" || key === "detail-tech") {
      detail(0, $(innerWidth <= 760 ? "#mobile-record-0" : "#record-0"));
      if (key === "detail-tech") $("#record-tech").open = true;
    }
    if (
      key.startsWith("confirm") ||
      [
        "saving",
        "recovery-zero",
        "recovery-success",
        "recovery-error",
        "recovery-unknown",
        "success-refresh-error",
      ].includes(key)
    ) {
      confirm();
      if (key !== "confirm") {
        $("#typed").value = key === "confirm-wrong" ? "确认" : " 确认回收 ";
        $("#typed").dispatchEvent(new Event("input"));
      }
      if (!key.startsWith("confirm")) {
        submit();
        if (key !== "saving")
          complete(
            key === "recovery-zero"
              ? "zero"
              : key === "recovery-error"
                ? "error"
                : key === "recovery-unknown"
                  ? "unknown"
                  : "success",
          );
        if (key === "success-refresh-error") complete("error");
      }
    }
    if (key === "focus") $("#refresh").focus();
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  $("#scene-picker").onchange = (e) => scene(e.target.value);
  $("#refresh").onclick = read;
  $("#recover-open").onclick = confirm;
  document
    .querySelectorAll("[data-result]")
    .forEach((b) => (b.onclick = () => complete(b.dataset.result)));
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='/']");
    if (a) {
      e.preventDefault();
      s.intents.push({ method: "NAVIGATE", path: a.getAttribute("href") });
      renderTools();
    }
  });
  window.RUNTIME_C = { scenes, scene, read, complete, submit, state: () => clone(s) };
  scene();
})();
