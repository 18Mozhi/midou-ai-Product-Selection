(() => {
  "use strict";
  const data = window.WORK_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    escape = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const statusLabels = {
      "": "全部",
      todo: "待处理",
      in_progress: "进行中",
      paused: "已暂停",
      completed: "已完成",
      cancelled: "已取消",
    },
    sortLabels = {
      priority_due: "优先级与期限",
      due_asc: "截止时间从近到远",
      updated_desc: "最近更新",
      created_desc: "最近创建",
    },
    priorityLabels = { low: "低", normal: "普通", high: "高", critical: "紧急" },
    actionLabels = {
      create: "新建任务",
      delete: "删除任务",
      pause: "批量暂停",
      resume: "批量继续",
      delay: "批量延期",
      transfer: "批量调整负责人",
      cancel: "批量取消",
    };
  const scenes = {
    normal: "01 本人队列 · 原始夹具",
    search: "02 搜索与排序展开",
    sorted: "03 已应用搜索与排序",
    no_results: "04 没有匹配结果",
    empty: "05 本人队列为空",
    readonly: "06 仅可读取",
    create_only: "07 可新建但不可更新",
    no_assign: "08 可更新但不可分配",
    member_error: "09 成员目录失败",
    loading: "10 正在读取",
    error: "11 服务读取失败",
    forbidden: "12 无权访问",
    expired: "13 登录失效",
    rate_limited: "14 请求过于频繁",
    pagination: "15 两页布局样例",
    long: "16 长中文布局样例",
    selection: "17 本页批量选择",
    paused: "18 已暂停布局样例",
    completed: "19 已完成布局样例",
    cancelled: "20 已取消布局样例",
    create: "21 新建弹窗",
    delete: "22 删除弹窗",
    pause: "23 批量暂停弹窗",
    resume: "24 批量继续弹窗",
    delay: "25 批量延期弹窗",
    transfer: "26 批量负责人弹窗",
    cancel: "27 批量取消弹窗",
    create_busy: "28 创建处理中",
    create_error: "29 创建失败保留",
    batch_error: "30 批量失败预览",
    no_eligible: "31 无可执行项",
    transfer_error: "32 转交成员目录失败",
    controls: "33 控件状态板",
  };
  let s,
    modal = null,
    triggerId = "",
    intent = [],
    draft = { title: "", description: "", priority: "normal", due_at: "" };
  const options = (labels, current) =>
    Object.entries(labels)
      .map(
        ([value, text]) =>
          `<option value="${value}" ${current === value ? "selected" : ""}>${text}</option>`,
      )
      .join("");
  function time(value) {
    return value
      ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
      : "未设置截止时间";
  }
  function synthetic(status, i = 0) {
    return {
      ...clone(data.list.data[0]),
      id: `00000000-0000-4000-8000-${String(901 + i).padStart(12, "0")}`,
      title: `${statusLabels[status]}任务布局样例 ${i + 1}`,
      status,
      due_at: null,
      sla_status: "not_set",
      progress_percent: status === "completed" ? 100 : 35,
    };
  }
  function filtered() {
    let rows = s.rows.filter(
      (r) =>
        (!s.status || r.status === s.status) &&
        (!s.query || `${r.title}\n${r.description}`.includes(s.query)),
    );
    const priorities = { critical: 1, high: 2, normal: 3, low: 4 },
      due = (v) => (v ? new Date(v).valueOf() : Infinity);
    rows.sort((a, b) =>
      s.sort === "created_desc"
        ? b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
        : s.sort === "updated_desc"
          ? b.updated_at.localeCompare(a.updated_at) || b.created_at.localeCompare(a.created_at)
          : (s.sort === "priority_due" ? priorities[a.priority] - priorities[b.priority] : 0) ||
            due(a.due_at) - due(b.due_at) ||
            0 ||
            b.created_at.localeCompare(a.created_at),
    );
    return rows;
  }
  function visible() {
    return filtered().slice((s.page - 1) * 10, s.page * 10);
  }
  function workPath() {
    const q = new URLSearchParams(s.extra);
    if (s.status) q.set("status", s.status);
    if (s.query) q.set("query", s.query);
    if (s.sort !== "priority_due") q.set("sort", s.sort);
    if (s.page > 1) q.set("page", String(s.page));
    return "/work" + (q.size ? `?${q}` : "");
  }
  function syncUrl() {
    const u = new URL(location.href);
    u.search = workPath().split("?")[1] || "";
    history.replaceState(null, "", u);
  }
  function updateFilters(values, focus) {
    Object.assign(s, values);
    if (Object.hasOwn(values, "query")) s.draftQuery = values.query;
    s.selected = [];
    s.message = "";
    s.page = Math.min(s.page, Math.max(1, Math.ceil(filtered().length / 10)));
    syncUrl();
    render();
    if (focus) document.getElementById(focus)?.focus();
  }
  function row(task) {
    const selected = s.selected.includes(task.id),
      id = escape(task.id);
    return `<article class="task ${!s.canUpdate ? "readonly" : ""} ${selected ? "selected" : ""}">
      ${s.canUpdate ? `<label class="check"><input id="select-${id}" type="checkbox" data-select="${id}" ${selected ? "checked" : ""} aria-label="选择任务：${escape(task.title)}"></label>` : ""}
      <a class="task-main" data-detail="${id}" href="/tasks/${id}?from=${encodeURIComponent(workPath())}"><div><span class="badge">${statusLabels[task.status]}</span><span class="priority">${priorityLabels[task.priority]}优先级</span><h3>${escape(task.title)}</h3><p>${escape(task.description || "无补充说明")}</p></div>
      <div class="task-facts"><strong>记录进度 ${task.progress_percent ?? 0}%</strong><div class="progress" aria-hidden="true"><span style="width:${Number(task.progress_percent) || 0}%"></span></div><p class="deadline">${escape(time(task.due_at))}${task.due_at ? `<br>${{ due_soon: "即将到期", overdue: "已逾期", on_track: "期限正常" }[task.sla_status] || "按服务端SLA展示"}` : ""}</p><span class="view-link">查看任务 →</span></div></a>
      ${s.canUpdate ? `<details class="row-actions"><summary id="more-${id}" aria-label="任务操作：${escape(task.title)}">操作</summary><button id="delete-${id}" class="danger" data-remove="${id}">删除任务</button></details>` : ""}</article>`;
  }
  function readState() {
    const labels = {
      loading: ["正在读取我的任务", "等待任务列表与本人汇总返回，尚不能判断数量。"],
      error: ["任务服务暂不可用", "本次读取失败，不能把未知结果当作空队列。"],
      forbidden: ["无权访问任务", "当前会话没有读取本页的权限。权限由服务端判定。"],
      expired: ["登录已失效", "请完成登录后重新加载。本稿不模拟登录成功。"],
      rate_limited: ["请求过于频繁", "请稍后重新加载，不猜测服务端未提供的等待时长。"],
    };
    if (labels[s.read])
      return `<section class="empty-state" ${s.read === "loading" ? 'role="status" aria-busy="true"' : 'role="alert"'}><h2>${labels[s.read][0]}</h2><p>${labels[s.read][1]}</p>${s.read === "loading" ? '<div class="loading-line"></div><div class="loading-line short"></div>' : '<button id="retry-read">重新加载</button>'}</section>`;
    return "";
  }
  function render() {
    const unknown = s.read !== "ready",
      rows = visible(),
      count = filtered().length;
    $("#app").innerHTML =
      `<div class="layout"><aside class="directory" aria-label="本人任务目录"><div><p class="eyebrow">当前工作区 · 我负责</p><h2>我的任务</h2><p>包括未到期与已结束的工作，<br>不是仅今天到期。</p></div><nav class="queues" aria-label="本人任务状态">${Object.entries(
        statusLabels,
      )
        .map(
          ([status, label]) =>
            `<button id="status-${status || "all"}" data-status="${status}" aria-pressed="${s.status === status}"><span>${label}</span><span>${
              unknown
                ? "—"
                : status
                  ? s.summary[status]
                  : Object.keys(statusLabels)
                      .filter(Boolean)
                      .reduce((n, k) => n + s.summary[k], 0)
            }</span></button>`,
        )
        .join(
          "",
        )}</nav><div class="scope-note"><p>统计范围</p><p>本人 · 当前工作区 · 全部状态。数量不随右侧搜索和翻页变化。</p></div></aside>
      <main class="surface"><header class="page-heading"><div><h1>今日工作</h1><p>查看我负责的工作，按当前队列逐项处理。</p></div>${s.canCreate ? '<button id="create-task" class="primary">＋ 新建任务</button>' : ""}</header>
      ${unknown ? "" : `<section class="scope-summary" aria-label="本人当前工作区汇总"><div><strong>${s.summary.overdue} 项逾期</strong><p>本人当前工作区全部任务</p></div><div><p>状态目录：全部汇总</p><p>任务队列：筛选结果</p></div></section>`}
      ${s.message ? `<div id="page-message" class="notice" role="status">${escape(s.message)}</div>` : ""}
      ${!s.canUpdate ? `<p class="readonly-note">当前可读取${s.canCreate ? "和新建" : ""}；选择、批量操作与删除未获授权。</p>` : ""}
      ${s.memberError && !unknown ? '<div class="notice error" role="status">任务已加载；成员目录暂不可用。调整负责人需重新加载后再试。</div>' : ""}
      ${
        unknown
          ? readState()
          : `<details class="filter" ${s.filters || s.query || s.sort !== "priority_due" ? "open" : ""}><summary id="filter-toggle">搜索与排序${s.query ? ` · ${escape(s.query)}` : ""}</summary><form id="filters"><label for="search">搜索标题或说明<input id="search" name="query" maxlength="200" value="${escape(s.draftQuery)}" placeholder="输入标题或说明"></label><label for="sort">排序<select id="sort" name="sort">${options(sortLabels, s.sort)}</select></label><div class="filter-buttons"><button class="primary" type="submit">应用</button><button type="button" id="reset">重置</button></div></form></details>
      ${
        s.selected.length
          ? `<section class="batch-bar" aria-label="本页批量操作"><p>已选本页 ${s.selected.length} 项</p>${Object.entries(
              actionLabels,
            )
              .filter(
                ([k]) => !["create", "delete"].includes(k) && (k !== "transfer" || s.canAssign),
              )
              .map(
                ([k, v]) =>
                  `<button id="batch-${k}" data-batch="${k}" class="${k === "cancel" ? "danger" : ""}">${v.replace("批量", "")}</button>`,
              )
              .join("")}<button id="clear-selection">清除选择</button></section>`
          : ""
      }
      <section class="list-heading"><div><h2>${statusLabels[s.status]}任务</h2><p>当前结果 ${count} 项 · ${sortLabels[s.sort]}</p></div>${s.canUpdate && rows.length ? `<label class="check"><input id="select-page" type="checkbox" ${rows.every((r) => s.selected.includes(r.id)) ? "checked" : ""}>选择本页 ${rows.length} 项</label>` : ""}</section>
      <div id="task-list">${rows.length ? rows.map(row).join("") : `<section class="empty-state"><h3>${s.query || s.status ? "没有符合条件的任务" : "当前没有分配给我的任务"}</h3><p>${s.query || s.status ? "调整筛选条件，或重置查看本人全部任务。" : "新建任务后可进入详情开始处理；这里不会自动加入其他人的任务。"}</p>${s.query || s.status ? '<button id="reset-empty">重置筛选</button>' : s.canCreate ? '<button id="create-empty" class="primary">新建任务</button>' : ""}</section>`}</div>
      ${count > 10 ? `<nav class="pagination" aria-label="任务分页"><button id="previous" ${s.page <= 1 ? "disabled" : ""}>上一页</button><p>第 ${s.page} / ${Math.ceil(count / 10)} 页 · 每页10项</p><button id="next" ${s.page >= Math.ceil(count / 10) ? "disabled" : ""}>下一页</button></nav>` : ""}`
      }
      ${s.scene === "controls" ? '<section aria-label="控件状态示意"><h2>控件六态</h2><div class="control-board"><button>默认</button><button class="demo-hover">悬停示意</button><button class="demo-focus">聚焦示意</button><button class="demo-active">按下示意</button><button disabled>禁用</button><button disabled aria-busy="true">处理中…</button></div><p class="hint">示意样式之外，交互测试另检查实际悬停、键盘聚焦与按下。</p></section>' : ""}
      <p class="fixture-note">离线待审稿 · ${s.synthetic ? "扩展状态为合成布局样例，不是真实任务记录。" : "原始测试响应：列表2项、汇总7项，彼此不是一致快照；未修饰成相同总数。"} 搜索和排序仅演示当前样例，不能代替服务端全量查询；日期与SLA保留夹具观测，不按今天重新计算。</p></main></div>`;
    bind();
  }
  function bind() {
    if ($("#search"))
      $("#search").oninput = (e) => {
        s.draftQuery = e.target.value;
      };
    if ($(".filter"))
      $(".filter").ontoggle = (e) => {
        if (e.target.isConnected) s.filters = e.target.open;
      };
    document
      .querySelectorAll("[data-status]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            updateFilters({ status: b.dataset.status, page: 1, read: s.read }, b.id)),
      );
    ["create-task", "create-empty"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.onclick = () => openModal("create", null, id);
    });
    document.querySelectorAll("[data-select]").forEach(
      (b) =>
        (b.onchange = () => {
          s.selected = b.checked
            ? [...s.selected, b.dataset.select]
            : s.selected.filter((id) => id !== b.dataset.select);
          render();
          document.getElementById(b.id)?.focus();
        }),
    );
    if ($("#select-page"))
      $("#select-page").onchange = (e) => {
        s.selected = e.target.checked ? visible().map((r) => r.id) : [];
        render();
        $("#select-page")?.focus();
      };
    if ($("#clear-selection"))
      $("#clear-selection").onclick = () => {
        s.selected = [];
        render();
        $("#select-page")?.focus();
      };
    if ($("#filters"))
      $("#filters").onsubmit = (e) => {
        e.preventDefault();
        updateFilters(
          { query: $("#search").value.trim(), sort: $("#sort").value, page: 1, filters: true },
          "search",
        );
      };
    if ($("#sort"))
      $("#sort").onchange = () =>
        updateFilters(
          { query: $("#search").value.trim(), sort: $("#sort").value, page: 1, filters: true },
          "sort",
        );
    ["reset", "reset-empty"].forEach((id) => {
      const b = document.getElementById(id);
      if (b)
        b.onclick = () =>
          updateFilters(
            { query: "", status: "", sort: "priority_due", page: 1, filters: true },
            "search",
          );
    });
    ["previous", "next"].forEach((id) => {
      const b = document.getElementById(id);
      if (b)
        b.onclick = () =>
          updateFilters(
            { page: s.page + (id === "next" ? 1 : -1) },
            id === "next" ? "previous" : "next",
          );
    });
    document.querySelectorAll("[data-detail]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          s.message = `离线导航预览：${a.getAttribute("href")}。详情独立属于P24，本稿不伪造详情加载成功。`;
          render();
          document.querySelector(`[data-detail="${a.dataset.detail}"]`)?.focus();
        }),
    );
    document.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () =>
          openModal(
            "delete",
            s.rows.find((r) => r.id === b.dataset.remove),
            b.id,
          )),
    );
    document
      .querySelectorAll("[data-batch]")
      .forEach((b) => (b.onclick = () => openModal(b.dataset.batch, null, b.id)));
    if ($("#retry-read"))
      $("#retry-read").onclick = () => {
        s.message = "离线重读意图已记录，未请求API，尚无新的读取结果。";
        render();
        $("#retry-read").focus();
      };
  }
  function captureDraft() {
    if (!modal) return;
    const form = $("#operation form");
    for (const node of form.querySelectorAll("[name]")) modal.values[node.name] = node.value;
    if (modal.action === "create") draft = clone(modal.values);
  }
  function closeModal() {
    captureDraft();
    const previous = modal;
    modal = null;
    $("#operation").close();
    if (previous?.action === "create") {
      delete s.extra.create;
      delete s.extra.title;
      delete s.extra.description;
      syncUrl();
    }
    document.getElementById(triggerId)?.focus();
  }
  function openModal(action, task = null, trigger = "create-task", mode = "intent") {
    if (
      (action === "create" && !s.canCreate) ||
      (action !== "create" && !s.canUpdate) ||
      (action === "transfer" && !s.canAssign)
    )
      return;
    triggerId = trigger;
    const targets = task ? [task] : visible().filter((r) => s.selected.includes(r.id));
    modal = {
      action,
      targets: clone(targets),
      eligible: targets.filter((r) => data.eligibility[action]?.includes(r.status)),
      values: action === "create" ? clone(draft) : { reason: "", due_at: "", assignee_id: "" },
      mode,
      result: "",
    };
    paintModal();
    $("#operation").showModal();
    $("#dialog-close").focus();
  }
  function paintModal() {
    const m = modal,
      create = m.action === "create",
      remove = m.action === "delete",
      busy = m.mode === "busy",
      v = m.values;
    $("#operation").innerHTML =
      `<form><header><div><p class="dialog-kicker">我的任务 · ${create ? "创建工作" : "操作确认"}</p><h2 id="dialog-title">${actionLabels[m.action]}</h2></div><button type="button" id="dialog-close" aria-label="关闭弹窗">关闭</button></header>
      <p class="dialog-intro">${create ? "把工作写清楚，再进入详情开始处理。未指定负责人时分配给当前用户。" : remove ? `将删除“${escape(m.targets[0].title)}”。任务列表不再显示，审计记录仍保留。` : "仅处理当前选中的本页任务。每项使用自己的版本与独立审计，不联动取消底层采集。"}</p>
      ${!create && !remove ? `<div class="impact" aria-label="批量影响"><div><strong>${m.targets.length}</strong><span>已选</span></div><div><strong>${m.eligible.length}</strong><span>可执行</span></div><div><strong>${m.targets.length - m.eligible.length}</strong><span>跳过</span></div></div><p class="hint">${m.action === "pause" ? "仅进行中可暂停。" : m.action === "resume" ? "仅已暂停可继续；无需填写原因。" : "已完成和已取消任务不参与本次操作。"} 关联采集 ${m.eligible.filter((r) => r.collection_task_id).length} 项（只展示关联）。</p>` : ""}
      ${create ? `<label class="field" for="title">任务标题 · 必填<input id="title" name="title" maxlength="200" required value="${escape(v.title)}" ${busy ? "readonly" : ""}></label><label class="field" for="description">说明 · 可选<textarea id="description" name="description" maxlength="5000" ${busy ? "readonly" : ""}>${escape(v.description)}</textarea></label><div class="pair"><label class="field" for="priority">优先级<select id="priority" name="priority" ${busy ? "disabled" : ""}>${options(priorityLabels, v.priority)}</select></label><label class="field" for="due_at">截止时间 · 可选<input id="due_at" name="due_at" type="datetime-local" value="${escape(v.due_at)}" ${busy ? "readonly" : ""}></label></div><p class="hint">期限为空时显示“未设置”，不会自动推算今天到期。</p>` : `${m.action !== "resume" ? `<label class="field" for="reason">${remove ? "删除" : "操作"}原因 · 必填<textarea id="reason" name="reason" required maxlength="500" ${busy ? "readonly" : ""}>${escape(v.reason)}</textarea></label>` : ""}${m.action === "delay" ? `<label class="field" for="due_at">新的截止时间 · 必填<input id="due_at" name="due_at" type="datetime-local" required value="${escape(v.due_at)}" ${busy ? "readonly" : ""}></label>` : ""}${m.action === "transfer" ? `<label class="field" for="assignee_id">当前工作区活动成员 · 必填<select id="assignee_id" name="assignee_id" required ${s.memberError || busy ? "disabled" : ""}><option value="">请选择成员</option>${s.memberError ? "" : data.members.map((r) => `<option value="${r.id}" ${v.assignee_id === r.id ? "selected" : ""}>${escape(r.label)}</option>`).join("")}</select></label>${s.memberError ? '<p class="notice error">成员目录暂不可用，不能把缺失名单当作可转交对象。请关闭后重新加载。</p>' : '<p class="hint">不提供虚构成员；演示名单只含测试成员。</p>'}` : ""}`}
      <div id="dialog-result" class="${m.result ? "notice error" : "hint"}" role="status">${escape(m.result || (busy ? "处理中场景演示。关闭只收起弹窗，不代表取消已发送操作；本稿没有发送请求。" : "此为离线图稿；提交只预览请求，不产生业务成功记录。"))}</div>
      <footer><button type="button" id="dialog-cancel">${busy ? "收起" : "返回"}</button><button class="primary ${["delete", "cancel"].includes(m.action) ? "danger" : ""}" id="confirm" ${busy || (!create && !remove && !m.eligible.length) || (m.action === "transfer" && s.memberError) ? "disabled" : ""} ${busy ? 'aria-busy="true"' : ""}>${busy ? "正在提交…" : create ? "创建任务" : remove ? "确认删除" : "确认操作"}</button></footer></form>`;
    $("#dialog-close").onclick = closeModal;
    $("#dialog-cancel").onclick = closeModal;
    $("#operation form").onsubmit = (e) => {
      e.preventDefault();
      submit();
    };
  }
  function submit() {
    if (!modal || modal.mode === "busy") return;
    captureDraft();
    const m = modal,
      v = m.values;
    const requiredText =
      m.action === "create" ? $("#title") : m.action === "resume" ? null : $("#reason");
    if (requiredText) {
      requiredText.setCustomValidity(
        requiredText.value.trim() ? "" : "请填写有效内容，不能只有空格。",
      );
      requiredText.oninput = () => requiredText.setCustomValidity("");
      if (!requiredText.reportValidity()) return;
    }
    if (!$("#operation form").reportValidity()) return;
    const requests =
      m.action === "create"
        ? [
            {
              url: "/tasks",
              method: "POST",
              body: {
                title: v.title,
                description: v.description,
                priority: v.priority,
                due_at: v.due_at ? new Date(v.due_at).toISOString() : null,
              },
            },
          ]
        : m.action === "delete"
          ? [
              {
                url: `/tasks/${m.targets[0].id}`,
                method: "DELETE",
                body: { expected_version: m.targets[0].version, reason: v.reason.trim() },
              },
            ]
          : m.eligible.map((r) => ({
              url: `/tasks/${r.id}/actions`,
              method: "POST",
              body: {
                action: m.action,
                expected_version: r.version,
                ...(m.action === "resume" ? {} : { reason: v.reason.trim() }),
                ...(m.action === "delay" ? { due_at: new Date(v.due_at).toISOString() } : {}),
                ...(m.action === "transfer" ? { assignee_id: v.assignee_id } : {}),
              },
            }));
    if (!requests.length) return;
    intent.push(...requests);
    m.result =
      m.mode === "error"
        ? "离线失败演示：没有可确认的成功回执。输入已保留；请核对结果后再决定是否重试。"
        : `已生成 ${requests.length} 项请求预览，未发送API，任务状态和列表没有改变。`;
    $("#dialog-result").textContent = m.result;
    $("#dialog-result").className = "notice" + (m.mode === "error" ? " error" : "");
  }
  $("#operation").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
  $("#operation").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.target === e.currentTarget &&
      (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    )
      closeModal();
  });
  $("#operation").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...e.currentTarget.querySelectorAll("button,input,textarea,select")].filter(
        (n) => !n.disabled && n.getClientRects().length,
      ),
      first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  function scene(name, initial = false) {
    if (!Object.hasOwn(scenes, name)) throw new Error("Unknown scene");
    if ($("#operation").open) $("#operation").close();
    modal = null;
    intent = [];
    draft = { title: "", description: "", priority: "normal", due_at: "" };
    s = {
      scene: name,
      rows: clone(data.list.data),
      summary: clone(data.summary),
      status: "",
      query: "",
      sort: "priority_due",
      page: 1,
      extra: {},
      selected: [],
      read: "ready",
      canCreate: true,
      canUpdate: true,
      canAssign: true,
      memberError: false,
      synthetic: false,
      message: "",
      filters: false,
    };
    if (["loading", "error", "forbidden", "expired", "rate_limited"].includes(name)) s.read = name;
    if (["readonly", "create_only"].includes(name)) {
      s.canUpdate = false;
      s.canAssign = false;
      s.canCreate = name === "create_only";
    }
    if (name === "no_assign") s.canAssign = false;
    if (["member_error", "transfer_error"].includes(name)) s.memberError = true;
    if (name === "search") s.filters = true;
    if (name === "sorted") {
      s.query = "证据";
      s.sort = "updated_desc";
    }
    if (name === "no_results") s.query = "不存在的样例";
    if (name === "empty") {
      s.rows = [];
      Object.keys(s.summary).forEach((k) => (s.summary[k] = 0));
      s.synthetic = true;
    }
    if (name === "pagination") {
      s.rows = Array.from({ length: 11 }, (_, i) => synthetic("todo", i));
      s.synthetic = true;
    }
    if (name === "long") {
      s.rows = [synthetic("in_progress")];
      s.rows[0].title =
        "核对供应商原始报价、交期与最小起订量，补充不同规格之间的证据差异后再提交人工复核".repeat(
          2,
        );
      s.synthetic = true;
    }
    if (["paused", "completed", "cancelled", "resume"].includes(name)) {
      const status = name === "resume" ? "paused" : name;
      s.rows = [synthetic(status)];
      s.synthetic = true;
      s.status = name === "resume" ? "" : name;
    }
    if (s.synthetic && name !== "empty") {
      Object.keys(s.summary).forEach((k) => (s.summary[k] = 0));
      s.rows.forEach((r) => s.summary[r.status]++);
    }
    if (initial) {
      const q = new URLSearchParams(location.search);
      if (q.has("status") && Object.hasOwn(statusLabels, q.get("status")))
        s.status = q.get("status");
      s.query = (q.get("query") || "").slice(0, 200);
      if (Object.hasOwn(sortLabels, q.get("sort"))) s.sort = q.get("sort");
      s.page = Math.min(
        Math.max(1, Number(q.get("page")) || 1),
        Math.max(1, Math.ceil(filtered().length / 10)),
      );
      s.extra = Object.fromEntries(
        [...q].filter(([k]) => !["status", "query", "sort", "page"].includes(k)),
      );
    }
    const action = Object.hasOwn(actionLabels, name)
      ? name
      : name.startsWith("create_") && ["create_busy", "create_error"].includes(name)
        ? "create"
        : name === "batch_error"
          ? "pause"
          : name === "no_eligible"
            ? "resume"
            : name === "transfer_error"
              ? "transfer"
              : null;
    if (
      ["selection", "no_assign"].includes(name) ||
      (action && !["create", "delete"].includes(action))
    )
      s.selected = visible().map((r) => r.id);
    s.draftQuery = s.query;
    $("#scene-picker").value = name;
    syncUrl();
    render();
    if (action) {
      if (action === "delete") {
        const d = document.querySelector(".row-actions");
        if (d) d.open = true;
      }
      openModal(
        action,
        action === "delete" ? s.rows[0] : null,
        action === "create"
          ? "create-task"
          : action === "delete"
            ? `delete-${s.rows[0].id}`
            : `batch-${action}`,
        name.endsWith("busy")
          ? "busy"
          : ["create_error", "batch_error"].includes(name)
            ? "error"
            : "intent",
      );
      if (name === "create_busy" || name === "create_error") {
        modal.values = {
          title: "复核供应商交期",
          description: "核对原始证据",
          priority: "normal",
          due_at: "",
        };
        paintModal();
      }
      if (["create_error", "batch_error"].includes(name)) {
        modal.result =
          "离线失败演示：没有可确认的成功回执，不能推断全部失败或全部成功。请保留输入并核对结果。";
        modal.values.reason = "核验后调整";
        paintModal();
      }
      $("#dialog-close").focus();
    } else if (initial && s.canCreate && s.extra.create === "1") {
      draft.title = (s.extra.title || "").slice(0, 200);
      draft.description = (s.extra.description || "").slice(0, 5000);
      openModal("create");
    }
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("");
  $("#scene-picker").onchange = (e) => scene(e.target.value);
  window.WORK_C = {
    scenes,
    scene,
    state: () => clone({ ...s, path: workPath(), modal, intent }),
    open: openModal,
  };
  scene("normal", true);
})();
