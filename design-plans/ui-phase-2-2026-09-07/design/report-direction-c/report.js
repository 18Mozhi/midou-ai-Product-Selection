(() => {
  "use strict";
  const D = window.REPORT_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    $ = (s) => document.querySelector(s),
    escape = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    format = (v) =>
      v == null ? "数据不足" : typeof v === "number" ? v.toLocaleString("zh-CN") : String(v),
    date = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "数据不足"),
    active = ["queued", "leased", "retry_scheduled"],
    statusLabels = {
      queued: "排队中",
      leased: "生成中",
      retry_scheduled: "等待重试",
      succeeded: "可下载",
      dead_letter: "生成失败",
      expired: "已过期",
    },
    expired = (v) =>
      v.status === "expired" || new Date(v.expires_at).valueOf() <= new Date(D.now).valueOf(),
    regenerateAllowed = (v) => expired(v) || v.status === "dead_letter",
    downloadAllowed = (v) => v.status === "succeeded" && !expired(v);
  let state, focusReturn;
  const scenes = {
    opportunity: "机会分析 / 原有测试样本",
    trend: "趋势分析 / 原有测试样本",
    team: "团队绩效 / 原有测试样本",
    empty: "空报表 / 零计数与缺失均值",
    no_series: "已有汇总 / 无分布数据",
    long_email: "长成员邮箱 / 合成排版样本",
    zero_series: "分布为零 / 合成边界",
    loading: "首次加载",
    error: "服务错误",
    expired: "登录失效",
    forbidden: "无权读取",
    rate_limited: "请求频繁",
    blocked: "依赖不可用",
    exports_empty: "无导出记录",
    refreshing: "后台刷新 / 保留报表",
    refresh_error: "刷新失败 / 保留报表",
    create_busy: "创建 CSV / 提交中",
    create_error: "创建 CSV / 提交失败",
    detail_succeeded: "详情 / 可下载文件",
    detail_queued: "详情 / 排队中",
    detail_leased: "详情 / 生成中",
    detail_retry: "详情 / 等待重试",
    detail_no_sample: "详情 / 无 ETA 样本",
    detail_expired: "详情 / 已过期",
    detail_dead: "详情 / 最终失败",
    detail_unknown: "详情 / 未知状态",
    detail_zero: "详情 / 零行文件",
    detail_boundary: "详情 / 到期边界",
    detail_status_mismatch: "详情 / 状态过期但时间未到",
    detail_not_found: "详情 / 记录不存在",
    detail_forbidden: "详情 / 无权读取",
    regenerate_busy: "重新生成 / 提交中",
    regenerate_error: "重新生成 / 冲突失败",
    regenerated: "重新生成 / 合成新记录响应",
    download_busy: "列表下载 / 进行中",
    download_error: "列表下载 / 网络失败",
    download_409: "列表下载 / 未就绪",
    download_410: "列表下载 / 已过期",
    download_503: "列表下载 / 文件缺失",
    technical: "技术详情展开",
    controls: "审核控制面板（非业务界面）",
  };
  function base() {
    return {
      type: "opportunity",
      report: clone(D.reports.opportunity),
      exports: clone(D.exports),
      selected: null,
      pageState: "ready",
      notice: "",
      modalError: "",
      busy: "",
      busyId: "",
      intents: [],
      mode: "intent",
      fixture: "原有 E2E 样本；时间固定为 2026-09-08 08:00。ETA 原样保留，不代表当前排队承诺。",
      scene: "opportunity",
    };
  }
  const status = (item) => (expired(item) ? "已过期" : statusLabels[item.status] || "状态待确认");
  function badge(item) {
    return `<span class="status" data-tone="${expired(item) || item.status === "dead_letter" ? "fail" : active.includes(item.status) || item.status === "succeeded" ? "blue" : "plain"}">${status(item)}</span>`;
  }
  function technical(text) {
    return `<details class="technical"><summary>技术详情</summary><code>${escape(text)}</code></details>`;
  }
  function notice(text, modal = false) {
    return `<div class="${modal ? "modal-notice" : "notice"}" data-error="true" role="status"><strong>${modal ? "操作未完成" : "请注意"}</strong><p>${escape(text)}</p>${technical("request_id: synthetic-review-only\n不对应真实服务请求")}</div>`;
  }
  function intent(url, method = "GET", body) {
    state.intents.push({ url, method, ...(body === undefined ? {} : { body }) });
    $("#intent-log").textContent = JSON.stringify(state.intents, null, 2);
  }
  function query(exportId, type = state.type, replace = false) {
    const url = new URL(location.href);
    if (type === "opportunity") url.searchParams.delete("report");
    else url.searchParams.set("report", type);
    if (exportId) url.searchParams.set("export", exportId);
    else url.searchParams.delete("export");
    history[replace ? "replaceState" : "pushState"]({}, "", url);
  }
  function summary() {
    const s = state.report.summary;
    return state.type === "opportunity"
      ? `共 ${format(s.total)} 个机会，已采纳 ${format(s.adopted)} 个，证据完整 ${format(s.complete_coverage)} 个。`
      : state.type === "trend"
        ? `共 ${format(s.total)} 个趋势主题，累计 ${format(s.signals)} 条信号，平均置信度 ${format(s.average_confidence)}。`
        : `当前组织 ${format(s.members)} 名活跃成员，关联当前工作区 ${format(s.total)} 项任务，已完成 ${format(s.completed)} 项、逾期 ${format(s.overdue)} 项。`;
  }
  function reportBody() {
    if (state.pageState === "loading")
      return `<section class="paper report-body" aria-busy="true"><h3>正在聚合报表事实…</h3><p class="muted">请等待当前组织和工作区的数据返回。</p><div class="loading-line"></div><div class="loading-line"></div></section>`;
    if (state.pageState !== "ready") {
      const titles = {
        error: "报表服务暂不可用",
        expired: "登录已失效",
        forbidden: "无权读取报表",
        rate_limited: "请求过于频繁",
        blocked: "报表服务暂不可用",
      };
      return `<section class="paper failure"><h3>${titles[state.pageState]}</h3><p>${escape(state.notice)}</p><button data-load>重新加载</button></section>`;
    }
    const r = state.report,
      maximum = Math.max(1, ...r.series.map((v) => Number(v.value) || 0));
    return `<section class="paper"><div class="scope"><div><small>统计范围</small><b>${state.type === "team" ? "组织活跃成员 / 当前工作区任务" : "当前组织与工作区的已落库记录"}</b><p>${state.type === "team" ? "成员数按组织统计；任务仅关联本工作区、未删除且分配给这些成员的记录。" : "当前接口没有日期筛选；缺失均值保持“数据不足”，不补成零。"}</p></div><div><small>数据截至</small><b>${date(r.observed_at)}</b></div></div><div class="report-body"><p class="conclusion">${summary()}</p><dl class="fact-grid">${Object.entries(
      r.summary,
    )
      .map(
        ([k, v]) =>
          `<div class="fact"><dt>${escape(D.metricLabels[state.type][k] || k)}</dt><dd>${escape(format(v))}</dd></div>`,
      )
      .join(
        "",
      )}</dl><section class="distribution"><h3>${state.type === "team" ? "成员已完成任务" : state.type === "opportunity" ? "推荐状态分布" : "趋势状态分布"}</h3><p>${state.type === "opportunity" ? "推荐状态与采纳决策是不同维度，请勿相加。" : state.type === "team" ? "条长比较返回的完成数量，不代表成员绩效评分。" : "按返回的状态分组；动量与置信度保持源值，不推算预测收益。"}</p>${r.series.length ? r.series.map((v) => `<div class="bar-row"><span>${escape(state.type === "team" ? v.label : D.seriesLabels[state.type][v.label] || "其他")}</span><div class="track" aria-hidden="true"><span style="width:${Math.max(0, (Number(v.value) / maximum) * 100)}%"></span></div><b>${escape(format(v.value))}</b></div>`).join("") : `<div class="empty"><h3>暂无分布数据</h3><p>没有分组明细不代表已有汇总无效。业务记录产生后按当前范围汇总；仍可提交 CSV 导出。</p></div>`}</section><p class="sample-note">${escape(state.fixture)}${state.type === "team" && state.scene === "team" ? " 此测试夹具汇总为 6 名成员、29 项完成；仅返回 3 条成员明细，值合计 22。图中不伪造其余记录。" : ""}</p></div></section>`;
  }
  function queueHint(item) {
    if (expired(item)) return "文件已过期；重新生成会创建新记录。";
    if (item.status === "dead_letter") return "自动重试已结束，可重新生成。";
    if (active.includes(item.status))
      return item.queue_position == null
        ? "系统正在异步处理；队列位置尚未返回。"
        : `全局队列第 ${item.queue_position} 位；${item.estimated_completion_at ? `预计 ${date(item.estimated_completion_at)} 完成（估算）` : "暂无可用完成时间估算"}`;
    return item.row_count == null
      ? "等待生成"
      : `${item.row_count} 行 / ${item.byte_size == null ? "文件大小待返回" : `${item.byte_size} 字节`}`;
  }
  function render() {
    $("#types").innerHTML = Object.entries(D.labels)
      .map(
        ([t, label]) =>
          `<button data-type="${t}" aria-pressed="${state.type === t}">${label}</button>`,
      )
      .join("");
    $("#workspace").innerHTML =
      `<header class="page-head"><div><h2>${D.labels[state.type]}</h2><p>事实分析与异步 CSV 导出</p></div><button class="primary" data-create ${state.busy === "create" ? "disabled" : ""}>${state.busy === "create" ? "正在提交…" : "导出当前报表 CSV"}</button></header>${state.notice ? notice(state.notice) : ""}${reportBody()}<section class="queue"><header class="section-head"><div><h3>导出记录</h3><p>当前范围最近最多 100 条；文件到期后由 Worker 清理。</p></div><div class="head-actions"><button data-refresh ${state.busy === "refresh" ? "disabled" : ""}>${state.busy === "refresh" ? "正在刷新…" : "刷新状态"}</button><a href="/tasks?view=exports" data-tasks>在任务中心查看</a></div></header>${state.exports.length ? state.exports.map((item) => `<article class="export-row" data-record="${escape(item.id)}">${badge(item)}<div class="export-info"><b>${escape(D.labels[item.report_type])} CSV</b><p>${escape(queueHint(item))}</p><small>有效期至 ${date(item.expires_at)}</small>${active.includes(item.status) && item.queue_position != null ? `<small>${item.estimate_sample_size ? `估算依据：全局最近 ${item.estimate_sample_size} 次成功导出的中位完成耗时，非 SLA。` : "尚无成功导出样本，不显示虚构分钟数。"}</small>` : ""}</div><div class="row-actions">${downloadAllowed(item) ? `<button class="primary" data-download="${item.id}" ${state.busy === "download" && state.busyId === item.id ? "disabled" : ""}>${state.busy === "download" && state.busyId === item.id ? "正在下载…" : "下载"}</button>` : regenerateAllowed(item) ? `<button data-regenerate="${item.id}" ${state.busy === "regenerate" && state.busyId === item.id ? "disabled" : ""}>${state.busy === "regenerate" && state.busyId === item.id ? "正在提交…" : "重新生成"}</button>` : ""}<button data-detail="${item.id}">查看详情</button></div></article>`).join("") : `<div class="empty"><h3>尚无导出任务</h3><p>使用“导出当前报表 CSV”创建异步任务。这里没有文件，不代表报表没有事实。</p></div>`}</section>`;
    renderDetail();
    $("#scene-picker").value = state.scene;
    $("#scene-note").textContent = scenes[state.scene];
  }
  function renderDetail() {
    const modal = $("#export-detail"),
      item = state.selected;
    if (!item) {
      if (modal.open) modal.close();
      return;
    }
    $("#detail-title").textContent = `${D.labels[item.report_type]}导出详情`;
    $("#detail-content").innerHTML =
      `${state.modalError ? notice(state.modalError, true) : ""}${badge(item)}<p>${escape(active.includes(item.status) && !expired(item) && item.queue_position != null ? "文件尚未生成，完成时间估算见下方队列信息。" : queueHint(item))}</p><dl class="detail-grid"><div><dt>数据行数</dt><dd>${item.row_count ?? "等待生成"}</dd></div><div><dt>文件大小</dt><dd>${item.byte_size == null ? "等待生成" : `${item.byte_size} 字节`}</dd></div><div class="wide"><dt>文件有效期</dt><dd>${date(item.expires_at)}</dd></div></dl>${item.queue_position != null ? `<section class="estimate"><h3>全局队列第 ${item.queue_position} 位</h3><p>预计完成：${item.estimated_completion_at ? date(item.estimated_completion_at) : "暂无可用估算"}</p><p>${item.estimate_sample_size ? `基于全局最近 ${item.estimate_sample_size} 次成功导出的中位完成耗时。` : "尚无成功导出样本。"}队列位置来自全局处理顺序；页面仅展示当前组织与工作区的导出记录。估算不是 SLA。</p></section>` : ""}<p class="dialog-copy">${downloadAllowed(item) ? "下载入口保留在列表中；关闭详情后下载文件。" : regenerateAllowed(item) ? "重新生成会创建新的导出记录；不会覆盖当前记录和旧文件。" : "等待异步处理或手动刷新。这里没有取消、删除或强制完成操作。"}</p>${item.last_error_code ? technical(item.last_error_code) : ""}<p class="sample-note">${escape(state.fixture)}</p>`;
    $("#detail-footer").innerHTML =
      `<span>仅限当前组织与工作区</span>${regenerateAllowed(item) ? `<button class="primary" data-regenerate="${item.id}" ${state.busy === "regenerate" && state.busyId === item.id ? "disabled" : ""}>${state.busy === "regenerate" && state.busyId === item.id ? "正在提交…" : "重新生成"}</button>` : ""}`;
    if (!modal.open) {
      modal.showModal();
      $("#detail-close").focus();
      modal.scrollTop = 0;
    }
  }
  function open(item) {
    focusReturn = document.activeElement;
    state.selected = clone(item);
    state.modalError = "";
    query(item.id);
    intent(`/report-exports/${item.id}`);
    renderDetail();
    $("#export-detail").scrollTop = 0;
  }
  function close() {
    state.selected = null;
    state.modalError = "";
    query();
    renderDetail();
    if (focusReturn?.isConnected) focusReturn.focus();
  }
  function action(kind, id) {
    if (
      (kind === "create" && state.busy === "create") ||
      (kind === "download" && state.busy === "download")
    )
      return;
    const item = state.exports.find((v) => v.id === id) || state.selected;
    if (
      (kind === "download" && !downloadAllowed(item)) ||
      (kind === "regenerate" && !regenerateAllowed(item))
    )
      return;
    if (kind === "regenerate" && state.busy === kind && state.busyId === id) return;
    intent(
      kind === "create"
        ? "/report-exports"
        : `/report-exports/${id}/${kind === "download" ? "download" : "regenerate"}`,
      kind === "download" ? "GET" : "POST",
      kind === "create" ? { report_type: state.type, format: "csv" } : undefined,
    );
    if (state.mode === "hold") {
      state.busy = kind;
      state.busyId = id || "";
    } else if (state.mode === "failure") {
      const message =
        kind === "regenerate"
          ? "当前文件仍在有效期内或仍在处理中，未创建新记录。合成 409 响应；请刷新核验。"
          : kind === "download"
            ? "下载连接失败。可再次点击下载；本次未接收文件。合成错误响应。"
            : "导出提交失败，未确认创建新任务。可手动重试；合成错误响应。";
      if (state.selected && kind === "regenerate") state.modalError = message;
      else state.notice = message;
    } else
      state.notice =
        "审核原型仅记录动作意图；未提交任务、未下载文件、未更改业务状态。可展开顶部审核场景查看。";
    render();
    if (state.modalError) $("#export-detail").scrollTop = 0;
  }
  function scene(name) {
    if (!(name in scenes)) throw new Error(`Unknown scene: ${name}`);
    if ($("#export-detail").open) $("#export-detail").close();
    state = base();
    state.scene = name;
    $("#intent-log").textContent = "尚未触发动作。所有动作仅记录意图，不访问服务。";
    $("#review-controls").hidden = name !== "controls";
    $("#review-toggle").setAttribute("aria-expanded", String(name === "controls"));
    if (["trend", "empty"].includes(name)) state.type = "trend";
    if (["team", "long_email"].includes(name)) state.type = "team";
    state.report = clone(D.reports[state.type]);
    if (
      ![
        "opportunity",
        "trend",
        "team",
        "controls",
        "detail_succeeded",
        "detail_queued",
        "detail_leased",
        "detail_expired",
      ].includes(name)
    )
      state.fixture = "合成审核状态，仅用于布局与交互边界；不代表真实业务或服务结果。";
    if (name === "empty") {
      Object.keys(state.report.summary).forEach(
        (k) => (state.report.summary[k] = k.startsWith("average") ? null : 0),
      );
      state.report.series = [];
      state.report.observed_at = null;
      state.exports = [];
    }
    if (name === "no_series") state.report.series = [];
    if (name === "zero_series") state.report.series[0].value = 0;
    if (name === "long_email")
      state.report.series[0].label = `${"very-long-member-name-".repeat(5)}@example.test`;
    if (["loading", "error", "expired", "forbidden", "rate_limited", "blocked"].includes(name)) {
      state.pageState = name;
      state.notice =
        name === "loading"
          ? ""
          : {
              expired: "请恢复登录后重新加载。",
              forbidden: "当前身份缺少 report:read，请联系管理员核验权限。",
              rate_limited: "请稍后手动重试，不会自动重复提交导出。",
            }[name] || "未能读取报表，请稍后重新加载。合成失败状态。";
      if (name === "loading") state.exports = [];
    }
    if (name === "exports_empty") state.exports = [];
    if (name === "refreshing") state.busy = "refresh";
    if (name === "refresh_error")
      state.notice = "刷新失败，保留上次读取的报表和导出记录；请手动刷新。";
    if (name === "create_busy") state.busy = "create";
    if (name === "create_error") state.notice = "导出提交失败，尚未确认创建新任务；可手动重试。";
    const detailNames = [
      "detail_succeeded",
      "detail_queued",
      "detail_leased",
      "detail_retry",
      "detail_no_sample",
      "detail_expired",
      "detail_dead",
      "detail_unknown",
      "detail_zero",
      "detail_boundary",
      "detail_status_mismatch",
      "regenerate_busy",
      "regenerate_error",
      "technical",
    ];
    if (detailNames.includes(name)) {
      let item = clone(
        D.exports[
          name === "detail_queued" || name === "detail_no_sample"
            ? 3
            : name === "detail_leased" || name === "detail_retry"
              ? 1
              : ["detail_expired", "regenerate_busy", "regenerate_error", "technical"].includes(
                    name,
                  )
                ? 2
                : 0
        ],
      );
      if (name === "detail_retry") {
        item.status = "retry_scheduled";
        item.last_error_code = "synthetic_dependency_unavailable";
      }
      if (name === "detail_no_sample") {
        item.estimated_completion_at = null;
        item.estimate_sample_size = 0;
      }
      if (name === "detail_dead") {
        item.status = "dead_letter";
        item.last_error_code = "synthetic_export_retry_exhausted";
        item.row_count = null;
        item.byte_size = null;
      }
      if (name === "detail_unknown") item.status = "synthetic_unknown";
      if (name === "detail_zero") {
        item.row_count = 0;
        item.byte_size = 22;
      }
      if (name === "detail_boundary") item.expires_at = D.now;
      if (name === "detail_status_mismatch") {
        item.status = "expired";
        state.modalError =
          "合成不一致样本：状态为 expired，但时间尚未到期。现有前端显示重新生成，API 会拒绝。该契约差异保留待实施核验。";
      }
      if (name === "regenerate_busy") {
        state.busy = "regenerate";
        state.busyId = item.id;
      }
      if (name === "regenerate_error")
        state.modalError =
          "当前导出仍可用或仍在处理中（合成 409）；未创建新记录。请关闭详情并刷新状态。";
      if (name === "technical") item.last_error_code = "synthetic_report_export_file_missing";
      state.exports = state.exports.map((v) => (v.id === item.id ? item : v));
      state.selected = item;
    }
    if (["detail_not_found", "detail_forbidden"].includes(name))
      state.notice =
        name === "detail_not_found"
          ? "链接中的导出记录不存在或不在当前工作区。已清理详情参数，保留报表类型。"
          : "无法读取该导出记录。已关闭详情并清理详情参数；请核验权限。";
    if (name === "regenerated") {
      state.selected = clone(D.replacement);
      state.exports = [clone(D.replacement), ...state.exports];
      state.notice = "合成 202 响应：新的团队绩效导出进入队列。旧记录未覆盖；不是实际提交结果。";
    }
    if (name === "download_busy") {
      state.busy = "download";
      state.busyId = D.exports[0].id;
    }
    if (name.startsWith("download_") && name !== "download_busy")
      state.notice = {
        download_error: "下载连接失败，请手动重试；尚未接收文件。",
        download_409: "文件尚未就绪（409），请刷新后等待完成。",
        download_410: "文件已到期（410），请刷新状态后重新生成。",
        download_503: "文件缺失或共享目录不可用（503）；请联系管理员核验存储，或创建新的导出。",
      }[name];
    query(state.selected?.id, state.type, true);
    render();
    window.scrollTo(0, 0);
    if (name === "technical") $("#detail-content details").open = true;
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([key, value]) => `<option value="${key}">${value}</option>`)
    .join("");
  $("#scene-picker").addEventListener("change", (e) => scene(e.target.value));
  $("#review-toggle").addEventListener("click", () => {
    $("#review-controls").hidden = !$("#review-controls").hidden;
    $("#review-toggle").setAttribute("aria-expanded", String(!$("#review-controls").hidden));
  });
  $("#detail-close").addEventListener("click", close);
  $("#export-detail").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [
        ...e.currentTarget.querySelectorAll("button:not(:disabled),summary,a[href]"),
      ].filter((n) => n.getClientRects().length),
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  });
  $("#export-detail").addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b || b.disabled) return;
    if (b.dataset.type) {
      if (state.type === b.dataset.type) return;
      state.type = b.dataset.type;
      state.report = clone(D.reports[state.type]);
      state.pageState = "ready";
      query(state.selected?.id);
      intent(`/reports/${state.type}`);
      render();
      $("#types").querySelector(`[data-type="${state.type}"]`).focus();
    }
    if (b.hasAttribute("data-create")) action("create");
    if (b.dataset.download) action("download", b.dataset.download);
    if (b.dataset.regenerate) action("regenerate", b.dataset.regenerate);
    if (b.dataset.detail) open(state.exports.find((v) => v.id === b.dataset.detail));
    if (b.hasAttribute("data-refresh") || b.hasAttribute("data-load")) {
      intent(`/reports/${state.type}`);
      intent("/report-exports");
      state.notice = "仅记录读取意图；审核原型没有连接服务。现有报表保留。";
      render();
    }
    if (b.hasAttribute("data-tasks")) {
      e.preventDefault();
      intent("/tasks?view=exports", "NAVIGATE");
      state.notice = "已记录前往任务中心的导航意图；此独立审核稿不会打开生产页面。";
      render();
    }
  });
  function restore() {
    const q = new URLSearchParams(location.search),
      t = q.get("report");
    state.type = Object.hasOwn(D.labels, t) ? t : "opportunity";
    state.report = clone(D.reports[state.type]);
    const id = q.get("export");
    state.selected = state.exports.find((v) => v.id === id) || null;
    if (id && !state.selected) {
      state.notice = "链接中的导出记录不存在或不在当前工作区。";
      query(undefined, state.type, true);
    }
    render();
  }
  window.addEventListener("popstate", restore);
  state = base();
  restore();
  window.REPORT_C = {
    scenes,
    scene,
    setMode: (mode) => {
      if (!["intent", "hold", "failure"].includes(mode)) throw new Error("Invalid review mode");
      state.mode = mode;
    },
    state: () => clone({ ...state, path: location.pathname + location.search }),
  };
})();
