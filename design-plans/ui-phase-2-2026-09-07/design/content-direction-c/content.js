(() => {
  const D = window.CONTENT_DATA,
    app = document.querySelector("#app"),
    modal = document.querySelector("#modal");
  const clone = (v) => structuredClone(v),
    esc = (s) =>
      String(s ?? "—").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const name = (s) => D.stateNames[s] ?? s ?? "—";
  const time = (s) => (s ? new Date(s).toLocaleString("zh-CN") : "—");
  const columns = [
    "主题",
    "归属",
    "市场 / 语言",
    "信号 / 来源",
    "热度 / 置信度",
    "展示状态",
    "审核操作",
  ];
  const scenes = {
    default: "默认工作台 · 原 E2E 样例",
    loading: "首次读取中",
    empty: "空结果 · 拟保留查询统计",
    "first-error": "首次读取失败",
    refreshing: "保留快照刷新中",
    "retained-error": "刷新失败保留旧数据",
    "first-timeout": "首次读取超时",
    "retained-timeout": "已有快照读取超时",
    "filter-draft": "筛选草稿",
    "filter-active": "已应用展示中筛选",
    "filter-archived": "已归档可读筛选",
    "filter-long": "120 字搜索边界",
    "filter-empty": "筛选无结果",
    "filter-pending": "目标筛选等待 · 原快照归属",
    "filter-error": "目标筛选失败 · 原快照归属",
    "page-first": "合成分页第一页",
    "page-last": "合成分页最后页",
    "page-pending": "翻页等待保留原页",
    "page-error": "翻页失败原页归属",
    "page-corrected": "服务端校正越界页",
    detail: "完整事实详情",
    technical: "技术信息展开",
    "long-detail": "长标题与归属详情",
    "missing-detail": "缺失事实不补造",
    "archived-detail": "归档内容只读状态",
    settings: "七列视图设置",
    "one-column": "至少一列",
    compact: "紧凑密度",
    frozen: "首列冻结",
    dark: "深色主题",
    contrast: "高对比主题",
    focus: "键盘焦点",
    hover: "悬停",
    pressed: "按下",
    "review-active": "恢复展示审核",
    "review-irrelevant": "标记无关审核",
    "review-stale": "标记过期审核",
    "reason-empty": "原因空值",
    "reason-one": "原因不足两字",
    "reason-spaces": "仅空白原因",
    "reason-min": "原因两字边界",
    "reason-max": "原因300字边界",
    "reason-over": "程序赋值超长保护",
    "same-status": "同状态仍可提交 · 明确提示",
    "review-pending": "审核提交中",
    "review-error": "审核失败 · 弹窗内保留原因",
    "review-conflict": "版本冲突 · 重新读取",
    "review-forbidden": "无权错误提示 · 不伪造专属状态",
    "review-unknown": "结果未确认 · 不自动重试",
    "review-success": "模拟写入与刷新均成功",
    "success-refresh-error": "模拟写入成功但刷新失败",
    "closed-pending": "关闭不取消已发审核",
    "new-review-old-result": "旧结果不关闭新审核",
    cancelled: "取消未提交审核",
    "insufficient-data": "数据不足不等于事实可靠",
    "unknown-status": "未知状态原值保留",
    "source-boundary": "源码与拟议改动边界",
  };
  let s, opener;
  const notice = (text, type = "") =>
    text ? `<div class="notice ${type}" role="status">${esc(text)}</div>` : "";
  function reset() {
    if (modal.open) modal.close();
    modal.replaceChildren();
    opener = null;
    s = {
      key: "default",
      data: clone(D.original),
      phase: "ready",
      message: "",
      query: "",
      status: "",
      snapshot: { query: "", status: "" },
      draftQuery: "",
      draftStatus: "",
      pending: null,
      calls: [],
      write: null,
      review: null,
      dialog: "",
      columns: columns.map(() => true),
      compact: false,
      frozen: false,
      synthetic: false,
      requestedPage: 1,
    };
    document.documentElement.className = "";
  }
  function render() {
    const data = s.data,
      p = data.pagination,
      loaded = s.phase !== "loading" && s.phase !== "error";
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">ScoutOps<div class="small">平台运营</div></div><div class="nav-caption">治理与质量</div><div class="active">内容管理</div><div class="side-note"><small>跨组织热点<br>只处理展示状态<br>不编辑来源事实</small></div></aside><main><header class="header content-heading"><div><p class="eyebrow">P56 / CONTENT OPERATIONS</p><h1>内容管理</h1><p class="muted">核对热点事实，再决定如何展示。</p></div><span class="review">C 方向 · 待审核 · 离线演示</span></header>${
      loaded
        ? `<div class="scope" aria-label="同查询全部状态统计">${Object.entries(data.summary)
            .map(
              ([k, v]) =>
                `<div><strong>${esc(v)}</strong>${k === "total" ? "查询匹配总量" : esc(name(k))}</div>`,
            )
            .join(
              "",
            )}</div><p class="summary-description">统计仅随搜索词变化，不随状态筛选变化。当前列表：${esc(name(s.snapshot.status) || "全部状态")} · ${p.total} 条匹配记录。</p>`
        : ""
    }<div class="workspace"><div class="toolbar"><div><h2>热点内容</h2><small>搜索范围：标题、分类、市场；按最近观测时间倒序</small></div><div class="actions"><button id="open-filter">筛选${s.snapshot.query || s.snapshot.status ? " · 已应用" : ""}</button><button id="settings">视图设置</button><button id="refresh" ${s.pending ? "disabled" : ""}>${s.pending ? "读取中…" : "刷新"}</button></div></div>${s.snapshot.query ? notice(`当前快照搜索：${s.snapshot.query}`) : ""}${notice(s.message, s.message.includes("失败") || s.message.includes("冲突") ? "error" : "warn")}${s.phase === "loading" ? `<div class="empty" role="status"><h3>正在读取内容</h3><p>尚无可用快照，统计与内容不预填。</p></div>` : s.phase === "error" ? `<div class="empty"><h3>暂时无法读取内容</h3><p>请检查读取提示，重试不会修改内容状态。</p><button id="retry">重新读取</button></div>` : !data.items.length ? `<div class="empty"><h3>没有匹配的内容</h3><p>可调整标题、分类、市场或状态条件。上方计数为本次查询全部状态统计。</p><button id="empty-reset">清除筛选并读取</button></div>` : records()}${loaded ? `<div class="pagination"><span>第 ${p.page} / ${p.total_pages} 页 · 每页最多 ${p.page_size} 条</span><div class="actions"><button id="previous" ${s.pending || p.page <= 1 ? "disabled" : ""}>上一页</button><button id="next" ${s.pending || p.page >= p.total_pages ? "disabled" : ""}>下一页</button></div></div>` : ""}</div><div class="observed"><span>读取时间：${loaded ? esc(time(data.observed_at)) : "尚未读取"}</span><span>${s.synthetic ? "合成边界数据，非生产记录" : "原 E2E 样例：仅 1 行，135 为夹具计数，非生产数据"}</span></div><p class="draft-note">仅供设计审核：所有“提交 / 读取”均在内存模拟，不发请求、不写审计。空结果保留统计、请求快照与审核反馈隔离是拟议改动，尚未进入 Vue。</p><section class="scene-review"><label for="scene-picker">审核场景<select id="scene-picker">${Object.entries(
      scenes,
    )
      .map(([k, v]) => `<option value="${k}" ${k === s.key ? "selected" : ""}>${v}</option>`)
      .join(
        "",
      )}</select></label><div class="actions"><button id="mock-success">模拟成功响应</button><button id="mock-error">模拟失败响应</button><button id="boundaries">查看源码边界</button></div><small>演示控件不属于生产页面。</small></section></main></div>`;
    bind("open-filter", () => open("filter"));
    bind("settings", () => open("settings"));
    bind("refresh", () => read());
    bind("retry", () => read());
    bind("empty-reset", () => {
      s.query = s.status = "";
      read(1);
    });
    bind("previous", () => read(p.page - 1));
    bind("next", () => read(p.page + 1));
    document.querySelectorAll("[data-detail]").forEach(
      (b) =>
        (b.onclick = () => {
          s.selected = Number(b.dataset.detail);
          open("detail");
        }),
    );
    document
      .querySelectorAll("[data-review]")
      .forEach((b) => (b.onclick = () => begin(Number(b.dataset.row), b.dataset.review)));
    bind("mock-success", () => (s.write ? finishWrite("success") : complete("success")));
    bind("mock-error", () => (s.write ? finishWrite("error") : complete("error")));
    bind("boundaries", () => open("boundaries"));
    document.querySelector("#scene-picker").onchange = (e) => scene(e.target.value);
  }
  function records() {
    const cells = (r, i) => [
      `<button class="title" data-detail="${i}">${esc(r.title)}</button><small>${esc(r.category || "未提供分类")}</small>`,
      `${esc(r.organization_name)}<small>${esc(r.workspace_name)}</small>`,
      `${esc(r.market)}<small>${esc(r.language)}</small>`,
      `${esc(r.signal_count)} 条信号<small>${esc(r.source_count)} 个来源</small>`,
      `${esc(r.heat_value)}<small>${esc(name(r.confidence_status))}</small>`,
      `<span class="pill ${D.statuses.includes(r.status) ? r.status : ""}">${esc(name(r.status))}</span><small>v${esc(r.version)}</small>`,
      `<div class="actions">${["active", "irrelevant", "stale"].map((v) => `<button data-review="${v}" data-row="${i}" ${r.status === v || s.write ? "disabled" : ""}>${v === "active" ? "设为展示" : v === "stale" ? "标记过期" : "标记无关"}</button>`).join("")}</div>`,
    ];
    return `<div class="table-wrap desktop ${s.compact ? "compact" : ""} ${s.frozen ? "freeze" : ""}"><table><caption class="small">当前行状态的直接入口禁用；审核表单仍允许选择原状态。</caption><thead><tr>${columns.map((v, i) => (s.columns[i] ? `<th class="${s.columns.every(Boolean) ? (i === 0 ? "ledger-title" : i === 6 ? "ledger-actions" : i === 1 ? "ledger-facts" : "ledger-small") : ""}" scope="col">${v}</th>` : "")).join("")}</tr></thead><tbody>${s.data.items
      .map(
        (r, i) =>
          `<tr>${cells(r, i)
            .map((v, n) => (s.columns[n] ? `<td>${v}</td>` : ""))
            .join("")}</tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><div class="mobile ${s.compact ? "compact" : ""}">${s.data.items.map((r, i) => `<article class="card"><span class="pill ${D.statuses.includes(r.status) ? r.status : ""}">${esc(name(r.status))}</span><h3>${esc(r.title)}</h3><p class="small">${esc(r.organization_name)} / ${esc(r.workspace_name)}</p><div class="facts-strip"><span><strong>${esc(r.signal_count)}</strong> 信号</span><span><strong>${esc(r.source_count)}</strong> 来源</span><span><strong>${esc(r.heat_value)}</strong> 热度</span></div><p class="small">${esc(r.market)} · ${esc(r.category || "未分类")} · ${esc(name(r.confidence_status))}</p><div class="actions"><button data-detail="${i}">完整事实</button><button data-row="${i}" data-review="${r.status === "stale" ? "active" : "stale"}" ${s.write ? "disabled" : ""}>审核状态</button></div></article>`).join("")}</div>`;
  }
  function bind(id, fn) {
    const b = document.getElementById(id);
    if (b) b.onclick = fn;
  }
  function read(page = s.data.pagination.page) {
    if (s.pending) return;
    s.pending = { query: s.query, status: s.status, page };
    s.calls.push({
      method: "GET",
      path: `/platform/management?${new URLSearchParams({ domain: "content", page: String(page), page_size: "20", ...(s.query ? { query: s.query } : {}), ...(s.status ? { status: s.status } : {}) })}`,
    });
    s.message = `正在读取：${s.query || "全部搜索"} / ${name(s.status) || "全部状态"} / 第${page}页。当前内容仍属于上次成功快照。`;
    render();
  }
  function complete(outcome) {
    if (!s.pending) return;
    if (outcome === "error")
      s.message = `读取失败：${s.pending.query || "全部搜索"} / ${name(s.pending.status) || "全部状态"} / 第${s.pending.page}页。保留上次成功列表与页码，未把目标范围当成已加载。`;
    else {
      const p = s.pending;
      s.query = p.query;
      s.status = p.status;
      s.snapshot = { query: p.query, status: p.status };
      s.phase = "ready";
      s.synthetic = true;
      if (outcome === "empty") {
        s.data.items = [];
        s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 1 };
        if (p.status) {
          s.data.summary[p.status] = 0;
          s.data.summary.total = D.statuses.reduce((sum, key) => sum + s.data.summary[key], 0);
        } else s.data.summary = Object.fromEntries(Object.keys(s.data.summary).map((k) => [k, 0]));
      } else if (s.fixturePages) synthPage(Math.min(p.page, 2));
      else {
        s.data = clone(D.original);
        if (p.status) {
          s.data.items[0].status = p.status;
          s.data.pagination.total = s.data.summary[p.status];
          s.data.pagination.total_pages = Math.max(1, Math.ceil(s.data.pagination.total / 20));
        }
        s.data.pagination.page = Math.min(p.page, s.data.pagination.total_pages);
      }
      s.message = "模拟读取完成；请求范围与返回快照已绑定。";
    }
    s.pending = null;
    render();
  }
  function close() {
    const prior = s.dialog;
    s.dialog = "";
    if (modal.open) modal.close();
    modal.replaceChildren();
    if (prior === "review") s.review = null;
    render();
    const target = opener?.id
      ? document.getElementById(opener.id)
      : document.querySelector("[data-detail]");
    (target && target.getClientRects().length
      ? target
      : document.querySelector("#open-filter")
    )?.focus();
  }
  function open(kind) {
    if (!modal.open) opener = document.activeElement;
    s.dialog = kind;
    renderDialog();
    if (!modal.open) modal.showModal();
    modal.scrollTop = 0;
    (
      modal.querySelector("textarea, input:not([type=checkbox]), select") ??
      modal.querySelector("button")
    )?.focus({ preventScroll: true });
  }
  function header(title, description) {
    return `<header><h2 id="dialog-title">${title}</h2><button id="close-modal" aria-label="关闭弹窗">关闭</button></header><p id="dialog-description" class="muted">${description}</p>`;
  }
  function renderDialog() {
    const r = s.data.items[s.selected ?? 0] ?? D.original.items[0];
    if (s.dialog === "filter")
      modal.innerHTML = `${header("筛选内容", "筛选只读取内容；搜索不匹配组织、工作区或正文。关闭保留草稿，应用才更新请求范围。")}<form id="filter-form"><div class="form-row"><label for="query">标题 / 分类 / 市场</label><input id="query" maxlength="120" value="${esc(s.draftQuery)}" /></div><div class="form-row"><label for="status">展示状态</label><select id="status"><option value="">全部状态</option>${D.statuses.map((k) => `<option value="${k}" ${s.draftStatus === k ? "selected" : ""}>${name(k)}</option>`).join("")}</select></div><p class="small">统计总量仅受搜索影响；列表匹配数同时受状态影响。</p><footer><button type="button" id="reset">重置并读取</button><button type="button" id="cancel">取消</button><button type="submit" id="apply" class="primary">应用筛选</button></footer></form>`;
    else if (s.dialog === "detail")
      modal.innerHTML = `${header("内容事实", "当前列表行的只读详情，无独立详情请求；展示值不代表来源可靠性或自动审核结论。")}<section><h3>${esc(r.title)}</h3><div class="facts-strip"><span><strong>${esc(r.signal_count)}</strong> 信号</span><span><strong>${esc(r.source_count)}</strong> 来源</span><span><strong>${esc(r.heat_value)}</strong> 热度</span></div><dl class="kv">${[
        ["当前状态", name(r.status)],
        ["分类", r.category],
        ["市场 / 语言", `${r.market ?? "—"} / ${r.language ?? "—"}`],
        ["置信度", name(r.confidence_status)],
        ["组织", r.organization_name],
        ["工作区", r.workspace_name],
        ["最近观测", time(r.last_seen_at)],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || "—")}</dd>`)
        .join(
          "",
        )}</dl><details class="technical" id="technical"><summary>技术信息</summary><dl class="kv"><dt>内容 ID</dt><dd>${esc(r.id)}</dd><dt>读取版本</dt><dd>${esc(r.version)}</dd></dl><p class="small">无正文编辑、归档写入或独立证据详情接口。</p></details></section><footer>${["active", "irrelevant", "stale"].map((v) => `<button data-target="${v}" ${v === r.status || s.write ? "disabled" : ""}>${v === "active" ? "设为展示" : v === "stale" ? "标记过期" : "标记无关"}</button>`).join("")}</footer>`;
    else if (s.dialog === "settings")
      modal.innerHTML = `${header("内容视图", "仅改变本次离线图稿的展示，不写入账号偏好。七列至少保留一列，手机摘要保持事实完整。")}<section>${columns.map((v, i) => `<label class="check"><input type="checkbox" data-column="${i}" ${s.columns[i] ? "checked" : ""} />${v}</label>`).join("")}<label class="check"><input id="compact" type="checkbox" ${s.compact ? "checked" : ""} />紧凑密度</label><label class="check"><input id="freeze" type="checkbox" ${s.frozen ? "checked" : ""} />冻结首列</label></section><footer><button id="cancel">完成</button></footer>`;
    else if (s.dialog === "review") {
      const v = s.review;
      modal.innerHTML = `${header("审核热点内容", "只修改展示状态。原因将进入审核记录；本页为离线模拟，不会实际写入。")}<section class="review-title"><h3>${esc(v.item.title)}</h3><p class="small">${esc(v.item.organization_name)} / ${esc(v.item.workspace_name)} · 当前${esc(name(v.item.status))} · v${esc(v.item.version)}</p></section><form id="review-form"><div class="form-row"><label for="target">目标状态</label><select id="target" ${s.write ? "disabled" : ""}>${["active", "irrelevant", "stale"].map((k) => `<option value="${k}" ${v.status === k ? "selected" : ""}>${name(k)}</option>`).join("")}</select></div><div id="same-notice">${v.status === v.item.status ? notice("目标与当前状态相同。现有后端允许提交，并仍递增版本、写入审核记录。", "warn") : ""}</div><div class="form-row"><label for="reason">审核依据</label><textarea id="reason" required minlength="2" maxlength="300" rows="4" aria-describedby="reason-help reason-error" ${s.write ? "disabled" : ""}>${esc(v.reason)}</textarea><div class="reason-help" id="reason-help"><span>去除首尾空白后 2–300 字</span><span id="reason-count"></span></div><p class="reason-error" id="reason-error" aria-live="polite"></p></div>${notice(v.error, "error")}${s.write ? notice("正在提交已冻结的目标、版本和原因。关闭只隐藏窗口，不代表取消请求。", "warn") : ""}<footer><button type="button" id="cancel">${s.write ? "关闭（不取消请求）" : "取消"}</button>${v.conflict ? '<button type="button" id="review-refresh">关闭并重新读取</button>' : ""}<button id="submit" type="submit" class="primary">${s.write ? "提交中…" : "确认审核（模拟）"}</button></footer></form>`;
    } else
      modal.innerHTML = `${header("源码事实与拟议改动", "以下是原代码惯性和新稿待审行为的区别，不能把离线图稿当成生产修复证明。")}<dl class="kv"><dt>现有事实</dt><dd>四状态读取、三状态写入；原因2–300，携带读取版本；同状态可提交。</dd><dt>现有风险</dt><dd>请求中编辑搜索词可能改变成功URL归属；stop不使序号失效；重复审核、旧结果关闭新弹窗、写成功覆盖刷新失败已在无网络源码适配器中复现。</dd><dt>本稿提案</dt><dd>绑定请求快照、单次提交、弹窗实例归属、弹窗内错误、未知结果不自动重试、写入与刷新双结果、空列表仍呈现查询统计。</dd><dt>尚未完成</dt><dd>Vue实现、真实权限/会话/同源/幂等键与数据库审计验证、缓存返回、生产部署、用户签收。</dd></dl><footer><button id="cancel">知道了</button></footer>`;
    bind("close-modal", close);
    bind("cancel", close);
    if (s.dialog === "filter") {
      document.querySelector("#query").oninput = (e) => (s.draftQuery = e.target.value);
      document.querySelector("#status").onchange = (e) => (s.draftStatus = e.target.value);
      document.querySelector("#filter-form").onsubmit = (e) => {
        e.preventDefault();
        if (s.pending) return;
        s.query = s.draftQuery.trim();
        s.status = s.draftStatus;
        close();
        read(1);
      };
      bind("reset", () => {
        if (s.pending) return;
        s.query = s.status = s.draftQuery = s.draftStatus = "";
        close();
        read(1);
      });
      document.querySelector("#apply").disabled = Boolean(s.pending);
      document.querySelector("#reset").disabled = Boolean(s.pending);
    }
    if (s.dialog === "detail")
      modal
        .querySelectorAll("[data-target]")
        .forEach((b) => (b.onclick = () => begin(s.selected ?? 0, b.dataset.target)));
    if (s.dialog === "settings") {
      modal.querySelectorAll("[data-column]").forEach(
        (b) =>
          (b.onchange = () => {
            const i = Number(b.dataset.column);
            if (!b.checked && s.columns.filter(Boolean).length === 1) {
              b.checked = true;
              return;
            }
            s.columns[i] = b.checked;
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
    if (s.dialog === "review") {
      document.querySelector("#reason").oninput = (e) => {
        s.review.reason = e.target.value;
        validation();
      };
      document.querySelector("#target").onchange = (e) => {
        s.review.status = e.target.value;
        document.querySelector("#same-notice").innerHTML =
          s.review.status === s.review.item.status
            ? notice("目标与当前状态相同；仍允许提交并写入审核记录。", "warn")
            : "";
      };
      document.querySelector("#review-form").onsubmit = (e) => {
        e.preventDefault();
        submit();
      };
      bind("review-refresh", () => {
        close();
        read();
      });
      validation();
    }
    if (modal.open && !modal.contains(document.activeElement))
      (
        modal.querySelector(
          "textarea:not(:disabled),input:not(:disabled):not([type=checkbox]),select:not(:disabled)",
        ) ?? modal.querySelector("button:not(:disabled)")
      )?.focus({ preventScroll: true });
  }
  function validation() {
    const len = s.review.reason.trim().length,
      invalid = len < 2 || len > 300;
    document.querySelector("#reason-count").textContent = `${len} / 300`;
    document.querySelector("#reason-error").textContent = invalid
      ? "请填写 2–300 字的具体审核依据。"
      : "";
    document.querySelector("#reason").setAttribute("aria-invalid", String(invalid));
    document.querySelector("#submit").disabled =
      invalid || Boolean(s.write) || Boolean(s.review.conflict) || Boolean(s.review.unknown);
  }
  function begin(i, status) {
    if (s.write) return;
    s.selected = i;
    s.review = { item: clone(s.data.items[i]), status, reason: "", token: Symbol("review") };
    open("review");
  }
  function submit() {
    const r = s.review;
    if (
      !r ||
      s.write ||
      r.conflict ||
      r.unknown ||
      r.reason.trim().length < 2 ||
      r.reason.trim().length > 300
    )
      return;
    s.write = {
      token: r.token,
      item: clone(r.item),
      body: { status: r.status, expected_version: r.item.version, reason: r.reason.trim() },
    };
    s.calls.push({
      method: "PATCH",
      path: `/platform/management/content/${r.item.id}`,
      body: clone(s.write.body),
    });
    render();
    renderDialog();
  }
  function finishWrite(outcome) {
    if (!s.write) return;
    const w = s.write,
      owns = s.review?.token === w.token;
    s.write = null;
    const text = {
      error: "审核失败（模拟）：未确认状态更新，原因已保留。",
      conflict: "版本冲突（模拟）：内容已变化，请重新读取后审核。",
      forbidden: "权限错误提示（模拟）：请确认会话与 platform:operate 权限。",
      unknown: "结果尚未确认（模拟）：不自动重试，请先重新读取核实。",
    }[outcome];
    if (text) {
      s.message = text;
      if (owns) {
        s.review.error = text;
        s.review.conflict = outcome === "conflict";
        s.review.unknown = outcome === "unknown";
      }
    } else {
      s.message =
        outcome === "refresh-error"
          ? "模拟写入已成功；列表刷新失败，当前列表仍是旧快照。请重新读取，勿重复提交。"
          : "模拟写入与列表刷新均成功；未产生真实审核或审计记录。";
      if (outcome !== "refresh-error") {
        const row = s.data.items.find((v) => v.id === w.item.id);
        if (row) {
          if (row.status !== w.body.status) {
            if (D.statuses.includes(row.status)) s.data.summary[row.status]--;
            s.data.summary[w.body.status]++;
          }
          row.status = w.body.status;
          row.version++;
          if (s.snapshot.status && s.snapshot.status !== row.status) {
            s.data.items = s.data.items.filter((v) => v.id !== row.id);
            s.data.pagination.total--;
            s.data.pagination.total_pages = Math.max(1, Math.ceil(s.data.pagination.total / 20));
            s.data.pagination.page = Math.min(
              s.data.pagination.page,
              s.data.pagination.total_pages,
            );
          }
        }
        s.synthetic = true;
      }
      if (owns) {
        s.review = null;
        s.dialog = "";
        modal.close();
        modal.replaceChildren();
      }
    }
    render();
    if (s.dialog) renderDialog();
    else document.querySelector("#refresh")?.focus();
  }
  function synthPage(page) {
    s.synthetic = true;
    s.fixturePages = true;
    s.data = {
      ...clone(D.original),
      pagination: { page, page_size: 20, total: 21, total_pages: 2 },
      summary: { total: 21, active: 18, irrelevant: 1, stale: 1, archived: 1 },
      items: Array.from({ length: page === 1 ? 20 : 1 }, (_, i) => ({
        ...clone(D.original.items[0]),
        id: `synthetic-${(page - 1) * 20 + i + 1}`,
        title: `合成内容 ${(page - 1) * 20 + i + 1} · 便携照明主题`,
      })),
    };
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene " + key);
    reset();
    s.key = key;
    if (key === "loading") {
      s.phase = "loading";
      s.pending = {};
    }
    if (["empty", "filter-empty"].includes(key)) {
      s.data.items = [];
      s.data.summary = Object.fromEntries(Object.keys(s.data.summary).map((k) => [k, 0]));
      s.data.pagination = { page: 1, page_size: 20, total: 0, total_pages: 1 };
      s.synthetic = true;
      if (key === "filter-empty") s.query = "合成无结果";
    }
    if (["first-error", "first-timeout"].includes(key)) {
      s.phase = "error";
      s.message = key.endsWith("timeout")
        ? "读取超时；尚无成功快照可保留。"
        : "读取失败；请稍后重试。";
    }
    if (["retained-error", "retained-timeout"].includes(key))
      s.message = "读取失败或超时；上次成功内容仍可查看，读取时间未更新。";
    if (key.startsWith("page-")) {
      synthPage(["page-last", "page-corrected"].includes(key) ? 2 : 1);
      if (key === "page-corrected")
        s.message = "请求第9999页；模拟服务端返回第2页，展示与页码以返回值为准。";
    }
    if (key === "one-column") s.columns = columns.map((_, i) => i === 0);
    if (key === "compact") s.compact = true;
    if (key === "frozen") s.frozen = true;
    if (["dark", "contrast"].includes(key)) document.documentElement.className = key;
    if (key === "insufficient-data") {
      s.data.items[0].confidence_status = "insufficient_data";
      s.data.items[0].heat_value = 0;
      s.synthetic = true;
    }
    if (key === "unknown-status") {
      s.data.items[0].status = "unrecognized_demo";
      s.synthetic = true;
    }
    if (key === "long-detail") {
      s.data.items[0].title = "合成边界：" + "户外照明多语言热点与来源观察记录 / ".repeat(14);
      s.data.items[0].organization_name = "合成长组织名称".repeat(9);
      s.synthetic = true;
    }
    if (key === "missing-detail") {
      for (const k of [
        "category",
        "market",
        "language",
        "signal_count",
        "source_count",
        "heat_value",
        "confidence_status",
        "last_seen_at",
      ])
        s.data.items[0][k] = null;
      s.synthetic = true;
    }
    if (key === "archived-detail") {
      s.data.items[0].status = "archived";
      s.synthetic = true;
    }
    if (key === "filter-active" || key === "filter-archived") {
      s.status = key.endsWith("active") ? "active" : "archived";
      s.data.items[0].status = s.status;
      s.data.pagination = {
        page: 1,
        page_size: 20,
        total: s.status === "active" ? 90 : 1,
        total_pages: s.status === "active" ? 5 : 1,
      };
      s.synthetic = true;
    }
    s.snapshot = { query: s.query, status: s.status };
    s.draftQuery = s.query;
    s.draftStatus = s.status;
    render();
    if (["filter-pending", "filter-error"].includes(key)) {
      s.query = "照明";
      s.status = "archived";
      read(1);
      if (key === "filter-error") complete("error");
    }
    if (["refreshing", "page-pending", "page-error"].includes(key)) {
      read(key.startsWith("page") ? 2 : 1);
      if (key === "page-error") complete("error");
    }
    if (["detail", "technical", "long-detail", "missing-detail", "archived-detail"].includes(key)) {
      open("detail");
      if (key === "technical") document.querySelector("#technical").open = true;
    }
    if (key.startsWith("filter-") && ["filter-draft", "filter-long"].includes(key)) {
      s.draftQuery = key === "filter-long" ? "字".repeat(120) : " 照明 ";
      s.draftStatus = "stale";
      open("filter");
    }
    if (key === "settings") open("settings");
    if (key === "source-boundary") open("boundaries");
    if (key === "focus") document.querySelector("#refresh").focus();
    if (
      key.startsWith("review-") ||
      key.startsWith("reason-") ||
      [
        "same-status",
        "success-refresh-error",
        "closed-pending",
        "new-review-old-result",
        "cancelled",
      ].includes(key)
    ) {
      if (key === "review-active") s.data.items[0].status = "stale";
      begin(
        0,
        key === "review-active" ? "active" : key === "review-irrelevant" ? "irrelevant" : "stale",
      );
      s.review.reason =
        key === "reason-empty"
          ? ""
          : key === "reason-one"
            ? "一"
            : key === "reason-spaces"
              ? "   "
              : key === "reason-min"
                ? "过期"
                : key === "reason-max"
                  ? "字".repeat(300)
                  : key === "reason-over"
                    ? "字".repeat(301)
                    : "样例：已核对当前来源，热点观察时间已过，标记为过期。";
      if (key === "same-status") s.review.status = s.review.item.status;
      renderDialog();
      if (
        [
          "review-pending",
          "review-error",
          "review-conflict",
          "review-forbidden",
          "review-unknown",
          "review-success",
          "success-refresh-error",
          "closed-pending",
          "new-review-old-result",
        ].includes(key)
      ) {
        submit();
        if (key === "closed-pending") {
          close();
          s.message = "窗口已关闭，但已发出的模拟审核仍待结果；关闭不等于取消。";
          render();
        } else if (key === "new-review-old-result") {
          // Boundary demonstration: a new instance may exist after navigation, even if ordinary entry buttons are disabled.
          s.review = {
            item: { ...clone(D.original.items[0]), title: "另一条合成内容 · 新弹窗" },
            status: "irrelevant",
            reason: "新审核草稿",
            token: Symbol("new-review"),
          };
          finishWrite("success");
        } else if (key !== "review-pending")
          finishWrite(
            key === "success-refresh-error" ? "refresh-error" : key.replace("review-", ""),
          );
      }
      if (key === "cancelled") {
        close();
        s.message = "已取消未提交的审核，未产生模拟 PATCH。";
        render();
      }
    }
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
      ...modal.querySelectorAll(
        "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
      ),
    ].filter((n) => n.getClientRects().length);
    if (
      (!e.shiftKey && document.activeElement === nodes.at(-1)) ||
      (e.shiftKey && document.activeElement === nodes[0])
    ) {
      e.preventDefault();
      (e.shiftKey ? nodes.at(-1) : nodes[0])?.focus();
    }
  });
  window.CONTENT_C = {
    scenes,
    scene,
    complete,
    finishWrite,
    submit,
    state: () => ({
      ...s,
      review: s.review ? { ...s.review, token: undefined } : null,
      write: s.write ? { ...s.write, token: undefined } : null,
    }),
  };
  scene("default");
})();
