(() => {
  const D = window.COLLECTION_C_DATA,
    O = D.original,
    $ = (id) => document.getElementById(id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (v = "") =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const C = window.COLLECTION_C_SOURCE({
    ref: (value) => ({ value }),
    computed: (f) => ({
      get value() {
        return f();
      },
    }),
    nextTick: () => Promise.resolve(),
    onMounted: () => {},
    onBeforeUnmount: () => {},
    watch: () => {},
    useRoute: () => ({ query: {} }),
    useRouter: () => ({}),
    defineProps: () => ({ apiBaseUrl: "inert" }),
    createApiClient: () => () => Promise.reject(new Error("inert source reader not callable")),
    ApiClientError: class extends Error {},
    window: {},
    document: {},
    HTMLElement,
    AbortController,
    URLSearchParams,
  });
  const scenes = {
    default: "原始三任务队列",
    paged: "独立50/1分页夹具",
    "page-two": "第二页与服务端总量",
    filtered: "当前页匹配",
    "filter-empty": "当前页无匹配",
    "filter-space": "空格不作trim",
    loading: "首次读取",
    empty: "服务端空结果",
    expired: "首次401",
    forbidden: "首次403",
    blocked: "首次依赖受阻",
    error: "首次读取失败",
    refreshing: "保留快照刷新",
    "refresh-error": "刷新失败保留快照",
    "refresh-timeout": "15秒超时保留快照",
    columns: "七列设置",
    compact: "紧凑密度",
    preview: "移动记录预览",
    "preview-technical": "移动记录技术详情",
    "detail-loading": "详情读取中可关闭",
    "detail-error": "详情读取失败留窗",
    detail: "原始死信详情",
    "detail-rss": "独立RSS三分类夹具",
    "detail-robots": "robots判定展开",
    "detail-history": "执行尝试和事件",
    "detail-technical": "完整技术标识",
    "reason-empty": "重放原因未填写",
    "reason-one": "重放原因不足两字",
    "reason-filled": "重放原因可提交",
    "reason-limit": "重放原因500字符",
    confirm: "重放确认预览",
    "confirm-typed": "确认短语已满足",
    replaying: "正在创建新任务",
    "replay-error": "重放明确拒绝",
    "replay-unknown": "重放结果未知",
    "replay-success": "新任务已创建（原返回夹具）",
    "replay-refresh-error": "创建成功与列表重读失败分开",
    "missing-detail": "缺少子查询与历史",
    "long-content": "长来源和缺失字段",
    focus: "键盘焦点",
    hover: "按钮悬停",
    pressed: "按钮按下",
    tools: "审核工具面板",
  };
  for (const status of D.statuses)
    scenes["state-" + status] = "独立状态变体 / " + (D.labels[status] || status);
  let s,
    generation = 0,
    serial = 0,
    pending = null,
    confirmSnapshot = null,
    returnId = "",
    fromList = false;
  const safeTime = (v) => (v ? C.time(v) : "未记录");
  const label = (v) => C.label(v);
  const short = (id) => String(id).slice(-6);
  const badge = (v) =>
    `<span class="status ${["dead_letter", "failed_terminal", "blocked_login", "blocked_captcha", "blocked_robots"].includes(v) ? "warning" : ""}">${esc(label(v))}</span>`;
  const notice = (text) => (text ? `<div class="notice warning">${esc(text)}</div>` : "");
  function derive() {
    C.tasks.value = s.items;
    C.query.value = s.query;
    C.detail.value = s.detail;
    C.page.value = s.page;
    C.total.value = s.total;
    return C;
  }
  function updateURL(kind = "replace", task) {
    const url = new URL(location.href);
    if (s.page > 1) url.searchParams.set("page", s.page);
    else url.searchParams.delete("page");
    if (s.status !== "all") url.searchParams.set("status", s.status);
    else url.searchParams.delete("status");
    if (task) url.searchParams.set("task", task);
    else url.searchParams.delete("task");
    history[kind + "State"]({}, "", url);
  }
  const dataset = () => (s.paged ? [...D.pageOne, O.tasks[1]] : O.tasks);
  function render() {
    const focus = document.activeElement?.id;
    const opened = [...document.querySelectorAll("#content details[open]")].map((n) => n.id);
    const c = derive(),
      rows = c.filtered.value,
      m = c.metrics.value;
    $("query").value = s.query;
    $("status").value = s.status;
    $("status").disabled = s.listBusy;
    $("refresh").disabled = s.listBusy;
    $("refresh").textContent = s.listBusy ? "正在刷新…" : "刷新任务";
    $("provenance").textContent =
      (s.synthetic ? "独立合成状态；非实时任务" : "原始 E2E 三任务夹具；非实时任务") +
      "。不推断未返回事实。";
    $("range").textContent =
      `服务端共 ${s.total} 个任务 · 已读第 ${s.loadedPage} 页 / ${s.items.length} 条 · 本页匹配 ${rows.length} 条`;
    $("metrics").innerHTML = Object.entries({
      处理中: m.active,
      部分完成: m.warnings,
      "受阻 / 死信 / 终止": m.blocked,
      可用结果: m.evidence,
    })
      .map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`)
      .join("");
    $("write-notice").innerHTML = notice(s.writeNotice);
    $("read-notice").innerHTML = notice(s.readNotice);
    if (["loading", "expired", "forbidden", "blocked", "error"].includes(s.initial)) {
      const copy = {
        loading: ["正在读取任务队列", "本页数据尚未就绪，不展示模拟为实时的统计。"],
        expired: ["登录已失效", "读取返回401；恢复会话后再读取，不自动重放任务。"],
        forbidden: ["没有采集任务权限", "读取返回403；请核对 collection:replay 权限。"],
        blocked: ["读取暂时受阻", "依赖或网络不可用，请稍后重新读取。"],
        error: ["任务列表未能读取", "请重新读取；不能据读取失败认定任务执行失败。"],
      }[s.initial];
      $("content").innerHTML =
        `<section class="empty"><h3>${copy[0]}</h3><p>${copy[1]}</p><button id="retry-list" ${s.initial === "loading" ? "disabled" : ""}>重新读取</button></section>`;
    } else {
      const headers = ["任务", "范围", "状态 / 覆盖", "子查询", "可用结果", "更新 / 错误", "操作"];
      const first = headers.findIndex((_, i) => !s.hidden.includes(i));
      const tools = `<div class="table-tools"><details id="columns"><summary>列设置</summary><fieldset><legend>至少保留一列</legend>${headers.map((v, i) => `<label class="check"><input type="checkbox" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} ${!s.hidden.includes(i) && s.hidden.length === 6 ? "disabled" : ""}/>${v}</label>`).join("")}</fieldset></details><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "首列已冻结" : "首列未冻结"}</button><label>表格密度<select id="density"><option value="standard">标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div>`;
      const tableRows = rows
        .map((t, i) => {
          const cells = [
            `<strong>任务 ${short(t.id)}</strong><small>${esc(t.priority)} / 第 ${t.attempt_count} 次</small>`,
            `组织 ${short(t.organization_id)}<small>工作区 ${short(t.workspace_id)}</small>`,
            `${badge(t.status)}<small>${esc(label(t.coverage_status))}</small>`,
            `${t.successful_subquery_count} 成功<small>${t.failed_subquery_count} 失败 / ${t.blocked_subquery_count} 受阻</small>`,
            `${t.available_result_count} 条<small>${esc(t.missing_fields.length ? "缺 " + t.missing_fields.join("、") : "字段完整")}</small>`,
            `${esc(safeTime(t.updated_at))}<small>${esc(t.last_error_code || "无错误")}</small>`,
            `<button id="task-${i}" data-task="${t.id}">查看</button>`,
          ];
          return `<tr>${cells.map((v, i) => `<td ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === first ? "frozen" : ""}">${v}</td>`).join("")}</tr>`;
        })
        .join("");
      $("content").innerHTML =
        tools +
        `<div class="table-wrap"><table class="${s.density === "compact" ? "compact" : ""}"><thead><tr>${headers.map((h, i) => `<th ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === first ? "frozen" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div><div class="task-cards">${rows.map((t, i) => `<button class="task-card" id="record-${i}" data-record="${t.id}">${badge(t.status)}<strong>任务 ${short(t.id)} / ${t.available_result_count} 条可用结果</strong><small>覆盖${esc(label(t.coverage_status))} · ${esc(safeTime(t.updated_at))}</small><small>${esc(t.missing_fields.length ? "缺 " + t.missing_fields.join("、") : "字段完整")}</small><span>查看记录</span></button>`).join("")}</div>` +
        (!rows.length
          ? `<section class="empty"><h3>${s.items.length ? "本页没有匹配任务" : "当前服务端条件下没有任务"}</h3><p>${s.items.length ? "文本只搜索当前页的标识和错误码，不代表其他页没有结果。" : "保留查询入口便于更换状态（待实施提案）；这里没有创建普通采集任务的入口。"}</p><button id="clear-query">清除本页筛选</button><button id="reset-status" ${s.listBusy ? "disabled" : ""}>查看全部状态</button></section>`
          : "");
    }
    $("pagination").innerHTML =
      s.total > 50
        ? `<button id="previous" ${s.page <= 1 || s.listBusy ? "disabled" : ""}>上一页</button><span>第 ${s.page} / ${Math.max(1, Math.ceil(s.total / 50))} 页 · 本页 ${s.items.length} 条</span><button id="next" ${s.page >= Math.ceil(s.total / 50) || s.listBusy ? "disabled" : ""}>下一页</button>`
        : "";
    for (const id of opened) if ($(id)) $(id).open = true;
    if (focus && $(focus) && !$("detail").open) $(focus).focus({ preventScroll: true });
  }
  const tech = (t, id = "technical") =>
    `<details id="${id}"><summary>技术标识与关联信息</summary><dl class="meta">${[
      ["任务 ID", t.id],
      ["组织 ID", t.organization_id],
      ["工作区 ID", t.workspace_id],
      ["请求 ID", t.request_id],
      ["错误码", t.last_error_code || "—"],
    ]
      .map(([l, v]) => `<div><dt>${l}</dt><dd><code>${esc(v)}</code></dd></div>`)
      .join("")}</dl></details>`;
  function detailRender() {
    const focused = document.activeElement?.id,
      scroll = $("detail").scrollTop;
    const type = s.panel,
      t = s.preview || s.detail?.task || s.items.find((t) => t.id === s.target);
    let content = "";
    const header = `<header class="dialog-header"><div><h2 id="detail-title">${type === "preview" ? "任务记录" : s.detailLoading ? "正在读取任务详情" : s.detailIssue ? "任务详情未能读取" : "任务 " + short(s.target)}</h2><p id="detail-description">${t ? esc(label(t.status)) + " / " : ""}仅查看合成记录；关闭不会取消已发送的重放。</p></div><button id="detail-close" aria-label="关闭任务详情">关闭</button></header>`;
    if (type === "preview")
      content = `<div class="preview-body">${badge(t.status)}<dl class="meta">${[
        ["覆盖", label(t.coverage_status)],
        [
          "子查询",
          `${t.successful_subquery_count} 成功 / ${t.failed_subquery_count} 失败 / ${t.blocked_subquery_count} 受阻`,
        ],
        ["可用结果", t.available_result_count + " 条"],
        ["缺失字段", t.missing_fields.join("、") || "字段完整"],
        ["更新时间", safeTime(t.updated_at)],
      ]
        .map(([l, v]) => `<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`)
        .join(
          "",
        )}</dl><div class="actions"><button id="full-detail" class="primary">打开完整任务详情</button></div>${tech(t, "record-technical")}</div>`;
    else if (s.detailLoading || s.detailIssue)
      content = `<div class="detail-loading">${s.detailLoading ? "<h3>等待当前任务的数据</h3><p>最长 15 秒；不会显示上一条任务详情。</p>" : `<div role="alert">${esc(s.detailIssue)}</div><button id="retry-detail">重试当前任务详情</button>`}</div>`;
    else if (s.detail) {
      derive();
      const d = s.detail,
        a = C.recoveryAction.value;
      const history = (items, kind) =>
        items.length
          ? items
              .map(
                (v, i) =>
                  `<article class="history-item"><strong>${kind === "attempt" ? `第 ${esc(v.attempt_number ?? i + 1)} 次 / ${esc(label(v.status))}` : `${esc(C.cell(v.event_type))} / ${esc(label(v.from_status))} → ${esc(label(v.to_status))}`}</strong><p>${kind === "attempt" ? `执行器 ${esc(C.cell(v.worker_id || v.lease_owner))} / 开始 ${esc(C.cell(v.started_at))} / 完成 ${esc(C.cell(v.finished_at))}` : `${esc(C.cell(v.actor_type))} / ${esc(C.cell(v.actor_id))} / ${esc(C.cell(v.occurred_at))}`}</p>${kind === "attempt" ? `<small>${esc(v.error_code || "无错误")}</small>` : ""}</article>`,
              )
              .join("")
          : `<p>尚无${kind === "attempt" ? "执行尝试" : "状态事件"}。</p>`;
      content =
        `<div class="detail-top"><div class="task-context">${badge(d.task.status)}<dl><div><dt>覆盖状态</dt><dd>${esc(label(d.task.coverage_status))}</dd></div><div><dt>可用结果</dt><dd>${d.task.available_result_count} 条</dd></div><div><dt>已返回尝试 / 事件</dt><dd>${d.attempts.length} / ${d.events.length}</dd></div><div><dt>更新时间</dt><dd>${esc(safeTime(d.task.updated_at))}</dd></div></dl><p>子查询事实优先。覆盖不足不形成推荐结论，记录缺失不补猜。</p><a href="#source-facts">子查询覆盖</a><a href="#history-attempts">执行与事件</a><a href="#technical">关联标识</a></div><div class="detail-content">${notice(s.replayIssue)}${s.returnFixtureNotice ? notice("原E2E重放响应夹具仍含旧尝试/死信；此图按返回原样展示，不冒称新任务数据库履历。") : ""}` +
        (a
          ? `<section class="recovery" aria-label="建议恢复动作"><strong>${esc(a.label)}</strong><p>${esc(a.description)}</p><a href="${a.kind === "replay" ? "#replay-section" : a.to}">${a.kind === "replay" ? "填写原因并重放" : esc(a.label)}</a></section>`
          : "") +
        `<section id="source-facts"><h3>子查询覆盖</h3>${d.subqueries.length ? d.subqueries.map((q, i) => `<article class="subquery"><header><div><strong>${esc(q.provider_name)}</strong><small>${q.is_required ? "必需来源" : "可选来源"}</small></div>${badge(q.status)}</header><p>结果 ${q.available_result_count} 条 / ${esc(C.subqueryDurationText(q.started_at, q.finished_at))}</p><small>开始 ${esc(q.started_at ? safeTime(q.started_at) : "未记录")} / 完成 ${esc(q.finished_at ? safeTime(q.finished_at) : "未记录")}</small><small class="missing">${esc(q.missing_fields.length ? "缺失 " + q.missing_fields.join("、") : "无缺失字段")}</small><small>${esc(q.error_code || "无错误")}</small>${q.result_kind ? `<p>${esc(C.resultKindText(q.result_kind))}</p>` : ""}${q.robots_decision ? `<details id="robots-${i}"><summary>robots 判定：${esc(C.robotsDecisionText(q.robots_decision))}</summary><small>判定版本 ${esc(q.robots_decision.decision_version)} / User-agent ${esc(q.robots_decision.matched_user_agent || "未命中分组")}</small></details>` : ""}<small>${esc(C.subqueryRetryText(d.task, q.retryable))}</small></article>`).join("") : "<p>未返回子查询；不推断来源或可用性。</p>"}</section><section id="history-attempts"><details id="attempts"><summary>执行尝试 / ${d.attempts.length}</summary>${history(d.attempts, "attempt")}</details><details id="events"><summary>状态事件 / ${d.events.length}</summary>${history(d.events, "event")}</details></section><section><h3>死信记录</h3>${d.dead_letter ? `<div class="history-item"><strong>${esc(C.cell(d.dead_letter.error_code || d.dead_letter.status))}</strong><p>进入死信：${esc(C.cell(d.dead_letter.created_at || d.dead_letter.updated_at))}</p><p>状态：${esc(label(C.cell(d.dead_letter.status)))}</p>${d.dead_letter.replay_reason ? `<p>重放原因：${esc(d.dead_letter.replay_reason)}</p>` : ""}</div>` : "<p>该任务没有死信记录。</p>"}</section>${tech(d.task)}` +
        (d.task.status === "dead_letter"
          ? `<section id="replay-section" class="replay-form"><h3>人工重放</h3><label>重放原因<textarea id="reason" rows="3" maxlength="500" required aria-describedby="reason-help" ${s.saving ? "disabled" : ""}>${esc(s.reason)}</textarea></label><small id="reason-help">说明恢复条件和重放原因，trim 后至少 2 字，最多 500 字符。已输入 <span id="reason-count">${s.reason.trim().length}</span> / 500。</small><button id="preview-replay" class="primary" ${s.saving || s.unknown || s.reason.trim().length < 2 ? "disabled" : ""}>${s.saving ? "正在创建重放任务…" : "人工重放"}</button><small>将创建新的 scheduled 任务，保留原任务、尝试、死信和审计。</small></section>`
          : "") +
        "</div></div>";
    }
    const openIds = [...$("detail").querySelectorAll("details[open]")].map((n) => n.id);
    $("detail").innerHTML = header + content;
    for (const id of openIds) if ($(id)) $(id).open = true;
    if (focused && $("detail").open && !$("confirm").open)
      $(focused)?.focus({ preventScroll: true });
    $("detail").scrollTop = scroll;
  }
  function showRecord(id, trigger) {
    generation++;
    pending = null;
    returnId = trigger || returnId;
    s.preview = clone(s.items.find((t) => t.id === id));
    s.panel = "preview";
    s.target = id;
    s.detail = null;
    s.detailIssue = "";
    s.detailLoading = false;
    detailRender();
    $("detail").showModal();
    $("detail").scrollTop = 0;
    $("detail-close").focus({ preventScroll: true });
  }
  function requestDetail(id, { url = true, trigger = "", initial = false } = {}) {
    generation++;
    pending = null;
    confirmSnapshot = null;
    if ($("confirm").open) $("confirm").close();
    if (trigger) returnId = trigger;
    s.panel = "full";
    s.preview = null;
    s.target = id;
    s.detail = null;
    s.detailIssue = "";
    s.detailLoading = true;
    s.reason = "";
    s.replayIssue = "";
    s.unknown = false;
    s.saving = false;
    s.returnFixtureNotice = false;
    if (url) {
      fromList = true;
      updateURL("push", id);
    } else if (initial) fromList = false;
    pending = { id: ++serial, generation, kind: "detail", target: id };
    s.intents.push({ method: "GET", path: `/platform/collection/tasks/${id}` });
    $("detail").replaceChildren();
    detailRender();
    if (!$("detail").open) $("detail").showModal();
    $("detail").scrollTop = 0;
    $("detail-close").focus({ preventScroll: true });
  }
  function closeDetail(sync = true) {
    const wasPreview = s.panel === "preview";
    if (s.saving) s.writeNotice = "已离开重放窗口，不能据此认定服务端请求已取消；请核对任务状态。";
    generation++;
    pending = null;
    confirmSnapshot = null;
    if ($("confirm").open) $("confirm").close();
    $("confirm").replaceChildren();
    $("detail").close();
    $("detail").replaceChildren();
    s.panel = null;
    s.detail = null;
    s.detailLoading = false;
    s.detailIssue = "";
    s.reason = "";
    s.saving = false;
    if (sync && !wasPreview) {
      if (fromList) {
        fromList = false;
        history.back();
      } else updateURL("replace");
    }
    render();
    $(returnId)?.focus({ preventScroll: true });
  }
  function read({ changed = false } = {}) {
    if (s.listBusy || pending) return false;
    s.listBusy = true;
    s.readNotice = "";
    const params = new URLSearchParams({ page: String(s.page), page_size: "50" });
    if (s.status !== "all") params.set("status", s.status);
    pending = {
      id: ++serial,
      generation,
      kind: "list",
      page: s.page,
      status: s.status,
      focus: document.activeElement?.id,
      changed,
    };
    s.intents.push({ method: "GET", path: "/platform/collection/tasks?" + params });
    render();
    return true;
  }
  function previewReplay() {
    if (
      s.saving ||
      s.unknown ||
      s.reason.trim().length < 2 ||
      !s.detail ||
      s.detail.task.status !== "dead_letter"
    )
      return false;
    confirmSnapshot = { generation, target: s.detail.task.id, reason: s.reason.trim() };
    $("confirm").innerHTML =
      `<header class="dialog-header"><div><h2 id="confirm-title">重放这个死信任务？</h2><p id="confirm-description">复制原内部子查询，创建新的 scheduled 任务；原任务改为 manually_replayed。</p></div></header><div class="dialog-body"><div class="confirm-target"><strong>确认目标</strong><code>${esc(confirmSnapshot.target)}</code><p>原因（本次固定快照）</p><p id="preview-reason">${esc(confirmSnapshot.reason)}</p></div><p>原任务、全部尝试、死信与审计事件保留，不覆盖历史结果。本原型不执行真实重放。</p><label class="field">输入“确认重放”继续<input id="typed" autocomplete="off"/></label><small>沿用当前单任务确认合同：只需确认短语，没有影响勾选框。</small></div><footer class="dialog-footer"><div class="actions"><button id="cancel-confirm">取消</button><button id="confirm-replay" class="primary" disabled>确认重放</button></div></footer>`;
    $("confirm").showModal();
    $("confirm").scrollTop = 0;
    $("cancel-confirm").focus({ preventScroll: true });
    return true;
  }
  function replay() {
    if (
      !confirmSnapshot ||
      confirmSnapshot.generation !== generation ||
      s.saving ||
      pending ||
      $("typed")?.value.trim() !== "确认重放"
    )
      return false;
    const snapshot = clone(confirmSnapshot);
    confirmSnapshot = null;
    $("confirm").close();
    $("confirm").replaceChildren();
    s.saving = true;
    s.replayIssue = "";
    pending = {
      id: ++serial,
      generation,
      kind: "replay",
      target: snapshot.target,
      reason: snapshot.reason,
    };
    s.intents.push({
      method: "POST",
      path: `/platform/collection/tasks/${snapshot.target}/replay`,
      body: { reason: snapshot.reason },
    });
    detailRender();
    return true;
  }
  function complete(outcome = "success", id = pending?.id) {
    if (!pending || pending.id !== id || pending.generation !== generation) return false;
    const op = pending;
    pending = null;
    if (op.kind === "list") {
      s.listBusy = false;
      if (outcome === "success") {
        const all = dataset().filter((t) => op.status === "all" || t.status === op.status);
        s.total = all.length;
        s.items = clone(all.slice((op.page - 1) * 50, op.page * 50));
        s.loadedPage = op.page;
        s.loadedStatus = op.status;
        s.initial = s.items.length ? "ready" : "empty";
        s.readNotice = "模拟列表读取完成。";
      } else s.readNotice = "列表重读失败；以下仍为上次已读范围，不能当作当前筛选的新结果。";
      render();
      if (document.activeElement === document.body && op.focus)
        $(op.focus)?.focus({ preventScroll: true });
      return true;
    }
    if (op.kind === "detail") {
      s.detailLoading = false;
      if (outcome === "success") {
        if (op.target === O.ids.dead) s.detail = clone(O.detail);
        else if (op.target === O.ids.task) s.detail = clone(D.rss);
        else {
          const task = s.items.find((t) => t.id === op.target);
          s.detail = task
            ? { task: clone(task), subqueries: [], attempts: [], events: [], dead_letter: null }
            : null;
        }
        if (!s.detail) s.detailIssue = "没有该任务的合成详情；不借用其他任务记录。";
      } else s.detailIssue = "当前任务详情读取失败（合成404 / 503）；没有显示上一条任务数据。";
      detailRender();
      $("detail-close")?.focus({ preventScroll: true });
      return true;
    }
    s.saving = false;
    if (outcome === "success") {
      s.detail = clone(D.replayResult);
      s.target = s.detail.task.id;
      s.reason = "";
      s.returnFixtureNotice = true;
      updateURL("replace", s.target);
      s.writeNotice = "已创建新的重放任务（模拟）；原任务与历史保留。这不是执行成功。";
      detailRender();
      render();
      read();
    } else {
      s.unknown = outcome === "unknown";
      s.replayIssue =
        outcome === "unknown"
          ? "重放结果未知，可能已创建新任务；先核对任务与审计，不直接重复提交。"
          : "重放请求被明确拒绝；保留原因，核对当前死信状态和依赖后再试。";
      detailRender();
      $("detail").scrollTop = 0;
    }
    return true;
  }
  function scene(key) {
    if (!scenes[key]) throw new Error("Unknown scene");
    if ($("confirm").open) $("confirm").close();
    if ($("detail").open) $("detail").close();
    $("detail").replaceChildren();
    $("confirm").replaceChildren();
    $("content").replaceChildren();
    document.activeElement?.blur();
    generation++;
    pending = null;
    confirmSnapshot = null;
    returnId = "";
    fromList = false;
    s = {
      items: clone(O.tasks),
      page: 1,
      loadedPage: 1,
      total: 3,
      status: "all",
      loadedStatus: "all",
      query: "",
      initial: "ready",
      listBusy: false,
      readNotice: "",
      writeNotice: "",
      intents: [],
      hidden: [],
      freeze: true,
      density: "standard",
      panel: null,
      detail: null,
      reason: "",
      replayIssue: "",
      saving: false,
      unknown: false,
      synthetic: key !== "default",
      paged: false,
    };
    const url = new URL(location.href);
    url.search = "";
    history.replaceState({}, "", url);
    window.scrollTo(0, 0);
    $("scope").open = innerWidth > 760;
    $("summary").open = innerWidth > 760;
    $("review-tools").open = key === "tools";
    if (["paged", "page-two"].includes(key)) {
      s.paged = true;
      s.total = 51;
      s.page = key === "page-two" ? 2 : 1;
      s.loadedPage = s.page;
      s.items = clone(s.page === 1 ? D.pageOne : [O.tasks[1]]);
      updateURL();
    }
    if (key === "filtered") s.query = "PARSE_FAILED";
    if (key === "filter-empty") s.query = "not-in-this-page";
    if (key === "filter-space") s.query = " ";
    if (["loading", "expired", "forbidden", "blocked", "error", "empty"].includes(key)) {
      s.initial = key;
      s.items = [];
      s.total = 0;
    }
    if (key === "loading" || key === "refreshing") s.listBusy = true;
    if (key === "refresh-error" || key === "refresh-timeout")
      s.readNotice =
        key === "refresh-timeout"
          ? "列表读取超过15秒，保留上一次完整快照。"
          : "列表刷新失败，保留上次快照；服务端总数不是本页筛选数。";
    if (key === "compact") s.density = "compact";
    render();
    if (key === "columns") $("columns").open = true;
    if (["preview", "preview-technical"].includes(key)) {
      showRecord(O.ids.dead);
      if (key === "preview-technical") $("record-technical").open = true;
    }
    const detailKeys = [
      "detail",
      "detail-loading",
      "detail-error",
      "detail-rss",
      "detail-robots",
      "detail-history",
      "detail-technical",
      "reason-empty",
      "reason-one",
      "reason-filled",
      "reason-limit",
      "confirm",
      "confirm-typed",
      "replaying",
      "replay-error",
      "replay-unknown",
      "replay-success",
      "replay-refresh-error",
      "missing-detail",
      "long-content",
    ];
    if (detailKeys.includes(key) || key.startsWith("state-")) {
      s.panel = "full";
      s.target = O.ids.dead;
      s.detail = clone(O.detail);
      s.detailLoading = false;
      s.detailIssue = "";
      if (key === "detail-loading") {
        s.detail = null;
        s.detailLoading = true;
      }
      if (key === "detail-error") {
        s.detail = null;
        s.detailIssue = "任务详情依赖不可用；请重试当前任务。";
      }
      if (["detail-rss", "detail-robots"].includes(key)) {
        s.detail = clone(D.rss);
        s.target = O.ids.task;
      }
      if (key === "missing-detail")
        s.detail = {
          task: clone(O.tasks[1]),
          subqueries: [],
          attempts: [],
          events: [],
          dead_letter: null,
        };
      if (key === "long-content") {
        s.detail.subqueries[0].provider_name = "长来源名称与跨市场数据采集记录".repeat(6);
        s.detail.subqueries[0].missing_fields = [
          "supplier.minimum_order_quantity".repeat(8),
          "market.price",
        ];
      }
      if (key.startsWith("state-")) {
        const status = key.slice(6);
        s.detail = {
          task: { ...clone(O.tasks[2]), status, last_error_code: null, coverage_status: null },
          subqueries: [],
          attempts: [],
          events: [],
          dead_letter: null,
        };
        s.target = s.detail.task.id;
        if (status === "dead_letter") {
          s.detail = clone(O.detail);
          s.target = O.ids.dead;
        }
      }
      if (key === "reason-one") s.reason = "单";
      if (
        [
          "reason-filled",
          "confirm",
          "confirm-typed",
          "replaying",
          "replay-error",
          "replay-unknown",
        ].includes(key)
      )
        s.reason = "来源依赖已恢复，重新核对采集结果";
      if (key === "reason-limit") s.reason = "审核".repeat(250);
      if (key === "replaying") s.saving = true;
      if (key === "replay-error")
        s.replayIssue = "服务器明确拒绝（合成409），请核对任务是否仍为死信。";
      if (key === "replay-unknown") {
        s.unknown = true;
        s.replayIssue = "结果未知，可能已经创建新任务；请先核对，不要直接重复提交。";
      }
      if (["replay-success", "replay-refresh-error"].includes(key)) {
        s.detail = clone(D.replayResult);
        s.target = s.detail.task.id;
        s.returnFixtureNotice = true;
        s.writeNotice = "新的 scheduled 任务已创建（原返回夹具）；不表示执行成功。";
        if (key === "replay-refresh-error") s.readNotice = "列表重读失败；以下列表是上一次快照。";
        render();
      }
      updateURL("replace", s.target);
      detailRender();
      $("detail").showModal();
      $("detail").scrollTop = 0;
      $("detail-close").focus({ preventScroll: true });
      if (key === "detail-history") {
        $("attempts").open = true;
        $("events").open = true;
      }
      if (key === "detail-technical") $("technical").open = true;
      if (key === "detail-robots") $("robots-0").open = true;
      if (["confirm", "confirm-typed"].includes(key)) {
        previewReplay();
        if (key === "confirm-typed") {
          $("typed").value = "确认重放";
          $("confirm-replay").disabled = false;
        }
      }
    }
    if (key === "focus") $("refresh").focus();
    $("scene-picker").value = key;
  }
  $("status").innerHTML =
    '<option value="all">全部状态</option>' +
    D.filterStatuses
      .map((v) => `<option value="${v}">${v === "draft" ? "草稿" : esc(D.labels[v])}</option>`)
      .join("");
  $("scene-picker").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  document.addEventListener("click", (e) => {
    const n = e.target.closest("button,a");
    if (!n || n.disabled) return;
    if (n.tagName === "A" && n.getAttribute("href")?.startsWith("/")) {
      e.preventDefault();
      s.intents.push({ method: "NAVIGATE", path: n.getAttribute("href") });
      return;
    }
    if (n.dataset.task) {
      requestDetail(n.dataset.task, { trigger: n.id });
      return;
    }
    if (n.dataset.record) {
      showRecord(n.dataset.record, n.id);
      return;
    }
    if (n.dataset.outcome) {
      complete(n.dataset.outcome);
      return;
    }
    if (["refresh", "retry-list"].includes(n.id)) {
      read();
      return;
    }
    if (n.id === "detail-close") {
      closeDetail();
      return;
    }
    if (n.id === "full-detail") {
      requestDetail(s.target);
      return;
    }
    if (n.id === "retry-detail") {
      requestDetail(s.target, { url: false });
      return;
    }
    if (n.id === "preview-replay") {
      previewReplay();
      return;
    }
    if (n.id === "cancel-confirm") {
      confirmSnapshot = null;
      $("confirm").close();
      $("confirm").replaceChildren();
      $("preview-replay")?.focus();
      return;
    }
    if (n.id === "confirm-replay") {
      replay();
      return;
    }
    if (n.id === "clear-query") {
      s.query = "";
      render();
      return;
    }
    if (n.id === "reset-status") {
      s.status = "all";
      s.page = 1;
      s.query = "";
      updateURL();
      read({ changed: true });
      return;
    }
    if (n.id === "freeze") {
      s.freeze = !s.freeze;
      render();
      return;
    }
    if (n.id === "previous" || n.id === "next") {
      s.page += n.id === "next" ? 1 : -1;
      s.query = "";
      updateURL();
      read({ changed: true });
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "query") {
      s.query = e.target.value;
      render();
    }
    if (e.target.id === "reason") {
      s.reason = e.target.value;
      $("reason-count").textContent = s.reason.trim().length;
      $("preview-replay").disabled = s.saving || s.unknown || s.reason.trim().length < 2;
    }
    if (e.target.id === "typed")
      $("confirm-replay").disabled = e.target.value.trim() !== "确认重放";
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.id === "status") {
      s.status = n.value;
      s.page = 1;
      s.query = "";
      updateURL();
      read({ changed: true });
    }
    if (n.id === "density") {
      s.density = n.value;
      render();
    }
    if (n.dataset.column !== undefined) {
      const i = Number(n.dataset.column);
      s.hidden = n.checked ? s.hidden.filter((v) => v !== i) : [...s.hidden, i];
      render();
    }
    if (n.id === "scene-picker") scene(n.value);
  });
  for (const id of ["detail", "confirm"]) {
    $(id).addEventListener("cancel", (e) => {
      e.preventDefault();
      if (id === "confirm") $("cancel-confirm").click();
      else closeDetail();
    });
    $(id).addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...$(id).querySelectorAll(
          "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href],summary",
        ),
      ].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
      const target =
        e.shiftKey && document.activeElement === nodes[0]
          ? nodes.at(-1)
          : !e.shiftKey && document.activeElement === nodes.at(-1)
            ? nodes[0]
            : null;
      if (target) {
        e.preventDefault();
        target.focus();
      }
    });
    $(id).addEventListener("click", (e) => {
      if (e.target !== $(id)) return;
      const r = $(id).getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        if (id === "confirm") $("cancel-confirm").click();
        else closeDetail();
      }
    });
  }
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search),
      id = params.get("task");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) requestDetail(id, { url: false });
    else closeDetail(false);
  });
  window.COLLECTION_C = {
    scenes,
    scene,
    read,
    complete,
    requestDetail,
    close: closeDetail,
    previewReplay,
    replay,
    state: () =>
      clone({
        ...s,
        pending: pending ? { id: pending.id, kind: pending.kind } : null,
        confirmSnapshot,
      }),
  };
  scene("default");
})();
