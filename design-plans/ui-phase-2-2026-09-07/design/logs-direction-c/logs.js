(() => {
  const D = window.LOG_DATA,
    L = window.LOG_SOURCE,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "—").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    app = document.querySelector("#app"),
    modal = document.querySelector("#modal"),
    cols = ["时间", "运行面", "事件", "状态", "资源", "异常处理", "技术详情"];
  let S,
    seq = 0,
    modalReturn;
  const btn = (id, text, extra = "") =>
      `<button type="button" id="${id}" ${extra}>${text}</button>`,
    dl = (pairs) =>
      `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`,
    sourceName = (v) => (v ? L.sourceName(v) : "全部运行面"),
    key = (r) => r.source + ":" + r.id;
  function reset() {
    if (modal.open) modal.close();
    modal.innerHTML = "";
    document.body.className = "";
    S = {
      dataset: "current",
      data: clone(D.datasets.current),
      draft: { query: "", source: "" },
      applied: { query: "", source: "" },
      url: { keep: "review" },
      selected: L.chains(D.datasets.current.items)[0].traceId,
      settings: {},
      read: null,
      readError: "",
      first: "",
      writes: [],
      reads: [],
      exportPending: null,
      exportMessage: "",
      dialog: null,
      navigation: [],
    };
  }
  const chains = () => L.chains(S.data.items),
    selected = () => chains().find((c) => c.traceId === S.selected),
    settings = () =>
      S.settings[S.selected] ??
      (S.settings[S.selected] = { hidden: [], freeze: true, density: "standard" });
  function filtered(target) {
    const q = target.query.toLocaleLowerCase();
    const rows = D.datasets[S.dataset].items.filter((r) => {
      const fields =
        r.source === "api"
          ? [r.event_type, r.resource_type, r.resource_id, r.request_id, r.trace_id]
          : r.source === "worker"
            ? [r.event_type, r.task_id, r.request_id, r.trace_id, r.error_code]
            : [r.id, r.status, r.error_code, r.request_id, r.trace_id];
      return (
        (!target.source || r.source === target.source) &&
        fields.some((v) =>
          String(v ?? "")
            .toLocaleLowerCase()
            .includes(q),
        )
      );
    });
    return {
      ...clone(D.datasets[S.dataset]),
      items: clone(rows),
      summary: {
        total: rows.length,
        ...Object.fromEntries(
          ["api", "worker", "crawler"].map((s) => [s, rows.filter((r) => r.source === s).length]),
        ),
      },
    };
  }
  function read() {
    const id = ++seq,
      target = { query: S.draft.query.trim().slice(0, 120), source: S.draft.source };
    S.read = { id, target };
    S.url = {
      keep: "review",
      ...(target.query ? { query: target.query } : {}),
      ...(target.source ? { source: target.source } : {}),
    };
    S.reads.push({
      path: "/platform/management",
      query: {
        domain: "logs",
        ...(target.query ? { query: target.query } : {}),
        ...(target.source ? { status: target.source } : {}),
      },
    });
    S.readError = "";
    render();
    return id;
  }
  function completeRead(outcome = "success", id = S.read?.id) {
    if (!S.read || S.read.id !== id) return false;
    const target = S.read.target;
    S.read = null;
    if (outcome === "success") {
      S.data = filtered(target);
      S.applied = clone(target);
      S.first = "";
      if (!selected()) S.selected = chains()[0]?.traceId || null;
    } else {
      S.readError = S.first
        ? "读取未完成，尚无成功日志。请恢复会话、权限或依赖后重试。"
        : `${outcome === "forbidden" ? "当前读取被拒绝；旧记录不证明当前授权。" : "读取未完成。"}以下仍为上次成功范围，目标筛选未得到新结果。`;
      if (S.first === "loading") S.first = "error";
    }
    render();
    return true;
  }
  function form(p = "") {
    return `<form id="${p}filters" class="filter-form"><label for="${p}query">检索条件<input id="${p}query" maxlength="120" value="${esc(S.draft.query)}" placeholder="请求、链、事件或错误码"/></label><label for="${p}source">运行面<select id="${p}source">${["", "api", "worker", "crawler"].map((s) => `<option value="${s}" ${s === S.draft.source ? "selected" : ""}>${sourceName(s)}</option>`).join("")}</select></label>${btn(p + "reset", "重置", S.read || (!S.draft.query.trim() && !S.draft.source) ? "disabled" : "")}<button id="${p}apply" ${S.read ? "disabled" : ""}>检索</button></form>`;
  }
  function bindFilters(root, p = "") {
    const updateReset = () =>
      (root.querySelector(`#${p}reset`).disabled =
        Boolean(S.read) || (!S.draft.query.trim() && !S.draft.source));
    root.querySelector(`#${p}query`).oninput = (e) => {
      S.draft.query = e.target.value;
      updateReset();
    };
    root.querySelector(`#${p}source`).onchange = (e) => {
      S.draft.source = e.target.value;
      updateReset();
    };
    root.querySelector(`#${p}filters`).onsubmit = (e) => {
      e.preventDefault();
      if (S.read) return;
      if (modal.open) close();
      read();
    };
    root.querySelector(`#${p}reset`).onclick = () => {
      if (S.read) return;
      S.draft = { query: "", source: "" };
      if (modal.open) close();
      read();
    };
  }
  function links(r) {
    if (!L.isException(r)) return "—";
    const pairs = [
      [L.taskLink(r), "查看关联任务"],
      [L.providerLink(r), "查看关联来源"],
    ].filter(([href]) => href);
    return pairs.length
      ? pairs.map(([href, title]) => `<a href="${esc(href)}" data-link>${title}</a>`).join("")
      : '<span class="small">暂无可定位对象</span>';
  }
  const status = (r) =>
    `<span class="status ${L.isException(r) ? "exception" : ""}">${esc(L.logStatusName(r.status))}</span>`;
  const technical = (r) =>
    `<details class="row-tech"><summary>技术详情</summary>${dl([
      ["记录ID", r.id],
      ["原始事件名", r.event_type],
      ["原始状态", r.status],
      ["资源ID", r.resource_id || "未提供"],
      ["请求ID", r.request_id || "未提供"],
      ["链ID", r.trace_id || "缺失（未合并其他记录）"],
    ])}</details>`;
  function eventDetail(r) {
    return `${dl([
      ["时间", L.when(r.occurred_at)],
      ["运行面", L.sourceName(r.source)],
      ["事件", L.eventName(r.event_type)],
      ["状态", L.logStatusName(r.status)],
      ["资源", L.resourceName(r.resource_type)],
      ["来源名称", r.provider_name || "未关联"],
      ["错误代码", r.error_code || "未提供"],
    ])}<h3>异常处理</h3><div class="actions">${links(r)}</div>${technical(r)}`;
  }
  function table(c) {
    const set = settings(),
      visible = cols.map((_, i) => i).filter((i) => !set.hidden.includes(i));
    return `<div class="desktop"><div class="table-tools"><details class="column-menu"><summary>列设置</summary><fieldset><legend>本条链的显示列</legend>${cols.map((v, i) => `<label><input type="checkbox" data-col="${i}" ${set.hidden.includes(i) ? "" : "checked"} ${visible.length === 1 && visible[0] === i ? "disabled" : ""}/>${v}</label>`).join("")}</fieldset></details>${btn("freeze", set.freeze ? "首列已冻结" : "首列未冻结", `aria-pressed="${set.freeze}"`)}<label for="density">密度<select id="density"><option value="standard" ${set.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${set.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-scroll"><table class="${set.density}"><thead><tr>${visible.map((i) => `<th class="${set.freeze && i === visible[0] ? "frozen" : ""}">${cols[i]}</th>`).join("")}</tr></thead><tbody>${c.items
      .map((r) => {
        const values = [
          esc(L.when(r.occurred_at)),
          esc(L.sourceName(r.source)),
          `<strong>${esc(L.eventName(r.event_type))}</strong>${L.eventName(r.event_type) !== r.event_type ? `<code>${esc(r.event_type)}</code>` : ""}${r.error_code ? `<p>${esc(r.error_code)}</p>` : ""}`,
          status(r),
          `${esc(L.resourceName(r.resource_type))}${r.provider_name ? `<p>${esc(r.provider_name)}</p>` : ""}`,
          links(r),
          technical(r),
        ];
        return `<tr data-event="${esc(key(r))}" data-exception="${L.isException(r)}">${visible.map((i) => `<td class="${set.freeze && i === visible[0] ? "frozen" : ""}">${values[i]}</td>`).join("")}</tr>`;
      })
      .join(
        "",
      )}</tbody></table></div><p class="small">表格可横向滚动；列设置仅作用于本条链，不改变导出字段。</p></div><div class="mobile event-list">${c.items.map((r) => `<button type="button" data-detail="${esc(key(r))}" aria-haspopup="dialog"><strong>${esc(L.eventName(r.event_type))}</strong><small>${esc(L.sourceName(r.source))} · ${esc(L.when(r.occurred_at))}</small>${status(r)}<small>查看完整事件</small></button>`).join("")}</div>`;
  }
  function workspace() {
    const c = selected();
    if (!c)
      return (
        '<section class="empty"><h2>没有匹配事件</h2><p>调整检索条件或运行面。零条仍是一次成功读取，不代表全平台无事件。</p>' +
        btn("retry", "重新加载") +
        "</section>"
      );
    return `<section class="workspace" id="work" tabindex="-1"><header class="chain-head"><h2>${c.items.length} 个当前返回事件 · ${c.exceptionCount} 个异常</h2><p class="range">${esc(L.when(c.startedAt))} 至 ${esc(L.when(c.endedAt))}；仅组内首末时刻，不计算完整链耗时。</p><details id="trace"><summary>${c.traceId.startsWith("missing:") ? "链ID缺失：查看本地分组键" : "查看完整链ID"}</summary><code>${esc(c.traceId)}</code>${c.traceId.startsWith("missing:") ? '<p class="small">此键由来源和记录ID生成，不是服务端trace_id。</p>' : ""}</details></header>${table(c)}</section>`;
  }
  function render() {
    const active = document.activeElement,
      id = active?.id,
      focusChain = active?.dataset?.chain;
    document.querySelector("#chains").innerHTML = S.first
      ? "<p>尚未读取链目录</p>"
      : chains()
          .map(
            (c, i) =>
              `<button type="button" data-chain="${esc(c.traceId)}" ${c.traceId === S.selected ? 'aria-current="page"' : ""}><strong>${c.traceId.startsWith("missing:") ? "链ID缺失" : esc(c.traceId.length > 16 ? c.traceId.slice(0, 10) + "…" + c.traceId.slice(-7) : c.traceId)}</strong><small>${c.items.length} 个事件 / ${c.exceptionCount} 个异常</small><small>${c.sources.map(L.sourceName).join("、")}</small></button>`,
          )
          .join("") || "<p>本次没有返回事件</p>";
    app.innerHTML = `<p class="small">${S.dataset === "original" ? "原E2E三事件、双链夹具（过滤响应在原测试中未随输入变化）" : "合成事件扩展，非生产日志"}</p><div class="toolbar"><p>最多200条脱敏运营事件，无分页或时间范围查询。</p><div class="actions">${btn("export", "导出当前筛选", S.read || S.exportPending ? "disabled" : "")}${btn("refresh", S.read ? "读取中…" : "刷新日志", S.read ? 'disabled aria-busy="true"' : "")}</div></div><div class="desktop">${form()}</div><div class="mobile">${btn("mobile-filter", "筛选链路日志", 'aria-haspopup="dialog"')}</div><p class="scope">${S.first ? "尚无成功范围" : `已读：${esc(S.applied.query || "无关键词")} / ${sourceName(S.applied.source)}`}。输入草稿不改变已读事件。</p>${S.read ? `<p class="notice" role="status">目标：${esc(S.read.target.query || "无关键词")} / ${sourceName(S.read.target.source)}，正在读取。${S.first ? "尚无成功日志。" : "下方保留上次成功范围。"}</p>` : ""}${S.readError ? `<p class="notice error" role="status">${esc(S.readError)}</p>` : ""}${S.exportMessage ? `<p class="notice" role="status">${esc(S.exportMessage)}</p>` : ""}${S.navigation.length ? `<p class="notice">审核工具：拟跳转 ${esc(S.navigation.at(-1))}。未打开目标页。</p>` : ""}
    ${
      S.first
        ? `<section class="empty"><h2>${{ loading: "正在读取链路日志", timeout: "首次读取超时", forbidden: "读取权限被拒绝", expired: "会话已过期", rate_limited: "读取暂时受限", error: "日志读取未完成" }[S.first]}</h2><p>尚无成功数据，不展示示例计数。</p>${btn("retry", "重新加载", S.read ? "disabled" : "")}</section>`
        : `<div class="counts"><div><strong>${S.data.summary.total ?? S.data.items.length}</strong><span>当前返回事件</span></div><div><strong>${chains().length}</strong><span>本次分组</span></div>${["api", "worker", "crawler"].map((s) => `<span>${L.sourceName(s)} ${S.data.summary[s] ?? 0}</span>`).join("")}</div>${S.data.items.length === 200 ? '<p class="notice warn">已达到200条上限，较早事件可能被截断；不代表这条链完整。</p>' : ""}${workspace()}<details class="tech" id="query-tech"><summary>本次读取及范围</summary>${dl(
            [
              ["更新时间", L.when(S.data.observed_at)],
              ["请求ID", "synthetic-read-only"],
              ["模拟URL", JSON.stringify(S.url)],
              ["GET映射", "URL source 对应请求 status"],
            ],
          )}<p class="small">API不推测任务/来源；Worker无单一来源；Crawler只有真实返回的关联ID才提供跳转。</p></details>`
    }
    ${S.read ? `<section class="simulation"><p>审核工具：模拟本次GET结果</p><div class="actions">${btn("read-success", "模拟读取成功")}${btn("read-error", "模拟读取失败")}</div></section>` : ""}${S.exportPending ? `<section class="simulation"><p>审核工具：模拟POST导出结果；不会写审计或生成文件。</p><div class="actions">${btn("export-success", "模拟收到CSV")}${btn("export-error", "模拟导出失败")}${btn("export-unknown", "模拟结果未知")}</div></section>` : ""}`;
    document.querySelectorAll("[data-chain]").forEach(
      (n) =>
        (n.onclick = () => {
          const top = document.querySelector("#chains").scrollTop;
          const left = document.querySelector("#chains").scrollLeft;
          S.selected = n.dataset.chain;
          render();
          document.querySelector("#chains").scrollTop = top;
          document.querySelector("#chains").scrollLeft = left;
          document.querySelector("#work").focus({ preventScroll: true });
          if (innerWidth <= 760) document.querySelector("#work").scrollIntoView();
        }),
    );
    document.querySelector("#refresh").onclick = read;
    document.querySelector("#export").onclick = openReason;
    document.querySelector("#mobile-filter").onclick = () => open("filter");
    if (document.querySelector("#retry")) document.querySelector("#retry").onclick = read;
    bindFilters(app);
    bindLinks(app);
    app
      .querySelectorAll("[data-detail]")
      .forEach((n) => (n.onclick = () => open("detail", n.dataset.detail)));
    app.querySelectorAll("[data-col]").forEach(
      (n) =>
        (n.onchange = () => {
          const set = settings(),
            i = Number(n.dataset.col);
          if (set.hidden.includes(i)) set.hidden = set.hidden.filter((v) => v !== i);
          else if (set.hidden.length < 6) set.hidden.push(i);
          render();
          document.querySelector(".column-menu").open = true;
          document.querySelector(`[data-col="${i}"]`).focus();
        }),
    );
    if (document.querySelector("#freeze")) {
      document.querySelector("#freeze").onclick = () => {
        settings().freeze = !settings().freeze;
        render();
      };
      document.querySelector("#density").onchange = (e) => {
        settings().density = e.target.value;
        render();
      };
    }
    if (S.read) {
      document.querySelector("#read-success").onclick = () => completeRead();
      document.querySelector("#read-error").onclick = () => completeRead("error");
    }
    if (S.exportPending) {
      for (const v of ["success", "error", "unknown"])
        document.querySelector("#export-" + v).onclick = () => completeExport(v);
    }
    const target = id
      ? document.getElementById(id)
      : focusChain
        ? [...document.querySelectorAll("[data-chain]")].find((n) => n.dataset.chain === focusChain)
        : null;
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (id)
      document
        .querySelector(innerWidth <= 760 ? "#mobile-filter" : "#query")
        .focus({ preventScroll: true });
  }
  function bindLinks(root) {
    root.querySelectorAll("[data-link]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          S.navigation.push(a.getAttribute("href"));
          if (modal.open) close();
          render();
        }),
    );
  }
  function open(kind, eventKey, target) {
    modalReturn =
      document.activeElement?.id || document.activeElement?.dataset?.detail || "mobile-filter";
    S.dialog = { kind, eventKey, ...(target ? { target: clone(target) } : {}) };
    modal.dataset.kind = kind;
    let title, desc, content;
    if (kind === "filter") {
      title = "筛选链路日志";
      desc = "关闭保留草稿，检索才读取。URL使用source，GET映射为status。";
      content = form("m-");
    }
    if (kind === "detail") {
      const r = S.data.items.find((r) => key(r) === eventKey);
      title = L.sourceName(r.source) + " · " + L.eventName(r.event_type);
      desc = "完整脱敏事件，关联入口仅来自实际返回ID。";
      content = eventDetail(r);
    }
    if (kind === "reason") {
      title = "填写日志导出原因";
      desc = "提交后重新读取此范围最新200条并记审计，不是当前画面固定快照。";
      content = `<div class="reason-range">冻结目标：${esc(S.dialog.target.query || "无关键词")} / ${sourceName(S.dialog.target.source)}</div><form id="reason-form" novalidate><label for="reason">导出原因（2–300字）<textarea id="reason" maxlength="300" aria-describedby="reason-help">导出当前链路日志用于故障排查</textarea></label><p id="reason-help" class="small">去首尾空白后校验；只导出固定12列，不含原始metadata、payload、Cookie或stderr。</p><p id="reason-error" class="field-error" hidden></p><footer class="actions">${btn("cancel", "取消")}<button id="submit" class="primary">确认导出</button></footer></form>`;
    }
    modal.innerHTML = `<header><h2 id="modal-title">${esc(title)}</h2>${btn("close", "关闭")}</header><p id="modal-desc">${desc}</p>${content}`;
    modal.querySelector("#close").onclick = close;
    if (kind === "filter") bindFilters(modal, "m-");
    if (kind === "reason") {
      modal.querySelector("#cancel").onclick = close;
      modal.querySelector("#reason-form").onsubmit = (e) => {
        e.preventDefault();
        submitExport();
      };
    }
    bindLinks(modal);
    modal.showModal();
    modal.querySelector(kind === "reason" ? "#reason" : "#close").focus();
  }
  // Capture the export target before the reason form; never read an edited draft at submit time.
  function openReason() {
    if (S.read || S.exportPending || S.dialog) return;
    open("reason", undefined, S.applied);
  }
  function close() {
    if (modal.open) modal.close();
    modal.innerHTML = "";
    S.dialog = null;
    render();
    const target =
      document.getElementById(modalReturn) ||
      [...document.querySelectorAll("[data-detail]")].find((n) => n.dataset.detail === modalReturn);
    (target || document.querySelector(innerWidth <= 760 ? "#mobile-filter" : "#export")).focus({
      preventScroll: true,
    });
  }
  function submitExport() {
    if (S.dialog?.kind !== "reason" || S.exportPending) return false;
    const reason = modal.querySelector("#reason").value.trim(),
      error = modal.querySelector("#reason-error"),
      input = modal.querySelector("#reason");
    if (reason.length < 2 || reason.length > 300) {
      error.hidden = false;
      error.textContent = "请填写2–300字的导出原因。";
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "reason-help reason-error");
      input.focus();
      return false;
    }
    const target = clone(S.dialog.target),
      id = ++seq;
    close();
    S.exportPending = {
      id,
      body: { query: target.query, ...(target.source ? { source: target.source } : {}), reason },
    };
    S.writes.push({
      path: "/platform/management/logs/exports",
      method: "POST",
      body: clone(S.exportPending.body),
    });
    S.exportMessage = "正在模拟导出；服务器会重新读取目标范围，并非导出当前DOM。";
    render();
    return id;
  }
  function completeExport(outcome = "success", id = S.exportPending?.id) {
    if (!S.exportPending || S.exportPending.id !== id) return false;
    S.exportPending = null;
    S.exportMessage =
      outcome === "success"
        ? "模拟已收到CSV响应；真实流程将交给浏览器下载，不等于用户已保存。此原型没有写入审计或创建文件。"
        : outcome === "unknown"
          ? "导出结果未知，服务可能已处理。不要自动重复提交；本页没有持久重试键。"
          : "模拟导出失败，未收到CSV响应；没有生成文件。";
    render();
    return true;
  }
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  modal.addEventListener("click", (e) => {
    const r = modal.getBoundingClientRect();
    if (
      e.target === modal &&
      (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    )
      close();
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const ns = [
        ...modal.querySelectorAll("button:not(:disabled),input,select,textarea,a[href],summary"),
      ].filter((n) => n.getClientRects().length),
      a = ns[0],
      b = ns.at(-1);
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault();
      b.focus();
    } else if (!e.shiftKey && document.activeElement === b) {
      e.preventDefault();
      a.focus();
    }
  });
  const scenes = {
    default: "链索引与事件证据",
    original: "原始三事件双链夹具",
    missing: "缺失trace逐条分组",
    large: "200条截断窗口",
    long: "长链ID、错误码和来源",
    empty: "成功零记录",
    loading: "首次读取",
    timeout: "首次15秒超时",
    forbidden: "首次权限拒绝",
    expired: "首次会话过期",
    rate_limited: "首次限流",
    error: "首次依赖错误",
    "read-pending": "读取中保留旧范围",
    "read-error": "失败保留上次范围",
    "read-forbidden": "权限失败与旧记录边界",
    "filter-open": "手机全屏筛选",
    "filter-draft": "草稿未应用",
    "filter-max": "120字查询边界",
    "no-match": "检索零匹配",
    "trace-open": "完整链编号",
    "query-open": "本次查询与范围",
    "ids-open": "完整事件技术字段",
    "columns-open": "七列设置",
    "columns-min": "只保留最后一列",
    "freeze-off": "取消首列冻结",
    compact: "紧凑事件表",
    dark: "深色代表稿",
    contrast: "高对比代表稿",
    hover: "刷新悬停",
    pressed: "刷新按下",
    focus: "键盘焦点",
    "export-reason": "导出原因与冻结范围",
    "export-invalid": "原因不足两字",
    "export-max": "300字原因",
    "export-over": "超过300字程序边界",
    "export-pending": "导出在途",
    "export-success": "收到响应不等于保存",
    "export-error": "导出失败",
    "export-unknown": "导出结果未知",
    "export-draft": "草稿不改变导出范围",
    "navigation-task": "关联任务意图",
    "navigation-provider": "关联来源意图",
    "large-last": "200条最后事件可达",
  };
  for (const s of ["api", "worker", "crawler"]) scenes["source-" + s] = "运行面：" + sourceName(s);
  for (const s of ["api", "worker", "crawler"])
    scenes["detail-" + s] = "完整" + sourceName(s) + "事件";
  for (const s of ["api", "worker", "crawler"])
    scenes["detail-tech-" + s] = sourceName(s) + "事件技术展开";
  scenes["long-detail"] = "长事件详情与技术正文";
  for (const status of D.statuses)
    scenes["status-" + status] = "事件状态：" + L.logStatusName(status);
  function scene(k) {
    reset();
    if (["original", "missing", "large", "long", "empty"].includes(k)) S.dataset = k;
    if (k === "large-last") S.dataset = "large";
    if (k === "long-detail") S.dataset = "long";
    S.data = clone(D.datasets[S.dataset]);
    S.selected = chains()[0]?.traceId;
    if (["loading", "timeout", "forbidden", "expired", "rate_limited", "error"].includes(k))
      S.first = k;
    if (k.startsWith("source-")) {
      S.draft.source = k.slice(7);
      read();
      completeRead();
    }
    if (k === "no-match") {
      S.draft.query = "no-such-event";
      read();
      completeRead();
    }
    if (
      ["filter-draft", "export-draft", "read-pending", "read-error", "read-forbidden"].includes(k)
    ) {
      S.draft = { query: "trace-shared", source: "crawler" };
      if (k.startsWith("read-")) {
        read();
        if (k !== "read-pending") completeRead(k === "read-forbidden" ? "forbidden" : "error");
      }
    }
    if (k === "filter-max") S.draft.query = "x".repeat(120);
    if (k.startsWith("status-")) {
      const r = S.data.items.find((r) => r.status === k.slice(7));
      S.selected = r.trace_id;
    }
    if (k === "compact") settings().density = "compact";
    if (k === "columns-min") settings().hidden = [0, 1, 2, 3, 4, 5];
    if (k === "freeze-off") settings().freeze = false;
    if (["dark", "contrast"].includes(k)) document.body.className = k;
    render();
    if (k === "filter-open") open("filter");
    if (k === "loading") read();
    if (k.startsWith("detail-") || k === "long-detail") {
      open(
        "detail",
        key(
          S.data.items.find(
            (r) => r.source === (k === "long-detail" ? "crawler" : k.split("-").at(-1)),
          ),
        ),
      );
      if (k.startsWith("detail-tech-") || k === "long-detail")
        modal.querySelector(".row-tech").open = true;
    }
    if (k === "trace-open") document.querySelector("#trace").open = true;
    if (k === "query-open") document.querySelector("#query-tech").open = true;
    if (k === "ids-open") {
      if (innerWidth <= 760) open("detail", key(selected().items[0]));
      document.querySelectorAll(".row-tech").forEach((n) => (n.open = true));
      if (innerWidth > 760) document.querySelector(".table-scroll").scrollLeft = 1e7;
    }
    if (k === "columns-open" || k === "columns-min")
      document.querySelector(".column-menu").open = true;
    if (k.startsWith("export-")) {
      openReason();
      if (k === "export-invalid" || k === "export-over") {
        modal.querySelector("#reason").value = k === "export-invalid" ? "x" : "x".repeat(301);
        submitExport();
      }
      if (k === "export-max") modal.querySelector("#reason").value = "查".repeat(300);
      if (["export-pending", "export-success", "export-error", "export-unknown"].includes(k)) {
        submitExport();
        if (k !== "export-pending") completeExport(k.slice(7));
      }
    }
    if (k.startsWith("navigation-")) {
      const r = S.data.items.find((r) => r.source === "crawler");
      S.navigation.push(k === "navigation-task" ? L.taskLink(r) : L.providerLink(r));
      render();
    }
    if (k === "focus") document.querySelector("#refresh").focus();
    if (k === "large-last") document.querySelector(".table-scroll").scrollTop = 1e7;
    document.querySelector("#scene").value = k;
    scrollTo(0, 0);
  }
  document.querySelector("#scene").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.querySelector("#scene").onchange = (e) => scene(e.target.value);
  window.LOG_C = {
    scene,
    scenes,
    state: () => clone(S),
    read,
    completeRead,
    openReason,
    submitExport,
    completeExport,
  };
  scene("default");
})();
