(() => {
  "use strict";
  const D = window.MEMBERS_C_DATA,
    $ = (s) => document.querySelector(s),
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      ),
    role = (v) => D.roleLabels[v] || "自定义角色",
    scope = (v) => D.scopeLabels[v] || "指定范围",
    clock = () => new Date(D.now).valueOf(),
    date = (v) => (v ? new Date(v).toLocaleString("zh-CN", { hour12: false }) : "数据不足"),
    effective = (m) =>
      m.status !== "active"
        ? m.status
        : ["locked", "disabled"].includes(m.account_status)
          ? m.account_status
          : "active",
    statuses = {
      active: "正常使用",
      disabled: "已停用",
      locked: "已锁定",
      pending_delivery: "等待邮件服务",
      pending_acceptance: "等待接受",
      expired: "已过期",
      revoked: "已撤销",
    };
  let state, returnFocus;
  const scenes = {
    normal: "组织成员 / 原始夹具",
    search: "姓名搜索",
    filter_locked: "锁定账号筛选",
    filter_role: "角色筛选",
    filter_team: "团队筛选",
    filter_empty: "筛选无结果",
    members_empty: "成员列表为空",
    multipage: "11成员 / 合成分页",
    page_two: "第二页",
    long_member: "长姓名与邮箱",
    disabled_locked: "成员停用且账号锁定",
    multiple_roles: "多角色与多范围",
    filters_open: "筛选展开",
    loading: "首次读取",
    error: "服务错误",
    blocked: "服务不可用",
    expired: "登录失效",
    forbidden: "无权访问",
    rate_limited: "请求频繁",
    refreshing: "后台刷新",
    refresh_error: "刷新失败保留成员",
    invite_empty: "邀请记录为空",
    invite_expired: "失效邀请",
    invite_acceptance: "等待接受",
    invite_revoked: "已撤销邀请",
    invite_boundary: "邀请到期边界",
    invite_form: "邀请表单草稿",
    invite_invalid: "非法邮箱与重复合并",
    invite_partial: "合成逐条部分失败",
    invite_busy: "邀请处理中",
    invite_interrupted: "合成403中断与未处理邮箱",
    invite_success: "合成已创建待投递",
    reason_disable: "禁用成员原因",
    reason_restore: "恢复成员原因",
    reason_role: "角色分配原因",
    reason_revoke: "撤销邀请原因",
    reason_short: "原因不足2字",
    reason_long: "长原因",
    action_busy: "确认后处理中",
    action_conflict: "确认后版本冲突",
    self_forbidden: "后端拒绝自身禁用",
    last_admin: "后端拒绝最后管理员变更",
    technical: "成员技术详情",
    hover: "创建邀请悬停",
    pressed: "创建邀请按下",
    focus: "创建邀请键盘焦点",
    controls: "审核工具（非业务界面）",
  };
  function base() {
    return {
      items: clone(D.members.items),
      invitations: clone(D.members.invitations),
      filters: { query: "", status: "", role: "", team: "", sort: "name_asc" },
      page: 1,
      tab: "pending",
      form: { emails: "", role_code: "member", reason: "" },
      selections: Object.fromEntries(D.members.items.map((m) => [m.id, m.roles[0] || "member"])),
      results: [],
      busy: "",
      pending: null,
      dialog: null,
      notice: "",
      noticeKind: "info",
      pageState: "ready",
      mode: "intent",
      intents: [],
      filtersOpen: innerWidth > 650,
      scene: "normal",
      provenance: "原有E2E夹具：3条成员，不以治理摘要128人冒充本页完整成员；非生产数据。",
    };
  }
  function log(url, method = "GET", body) {
    state.intents.push({ url, method, ...(body === undefined ? {} : { body }) });
    $("#intent-log").textContent = JSON.stringify(state.intents, null, 2);
  }
  function technical(value) {
    return `<details class="technical"><summary>技术详情</summary><code>${esc(value)}</code></details>`;
  }
  function notice() {
    return state.notice
      ? `<div id="feedback" class="notice" tabindex="-1" role="${state.noticeKind === "error" ? "alert" : "status"}" data-kind="${state.noticeKind}"><p>${esc(state.notice)}</p>${technical("request_id: synthetic-review-only\n不是实际请求或审计结果")}</div>`
      : "";
  }
  function badge(code) {
    return `<span class="status" data-tone="${["disabled", "locked", "expired", "revoked"].includes(code) ? "warning" : "plain"}">${statuses[code] || "其他状态"}</span>`;
  }
  function filtered() {
    const f = state.filters,
      q = f.query.trim().toLowerCase();
    return state.items
      .filter(
        (m) =>
          (!q ||
            String(m.email).toLowerCase().includes(q) ||
            String(m.display_name || "")
              .toLowerCase()
              .includes(q)) &&
          (!f.status || effective(m) === f.status) &&
          (!f.role || m.roles.includes(f.role)) &&
          (!f.team || m.teams?.includes(f.team)),
      )
      .sort((a, b) =>
        f.sort === "joined_desc"
          ? new Date(b.joined_at) - new Date(a.joined_at)
          : f.sort === "status_asc"
            ? effective(a).localeCompare(effective(b), "zh-CN")
            : String(a.display_name || a.email).localeCompare(
                String(b.display_name || b.email),
                "zh-CN",
              ),
      );
  }
  function options(values, current, empty) {
    return `${empty ? `<option value="">${empty}</option>` : ""}${values.map(([v, label]) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(label)}</option>`).join("")}`;
  }
  function memberSection() {
    const f = state.filters,
      all = filtered(),
      count = Math.max(1, Math.ceil(all.length / 10));
    state.page = Math.min(state.page, count);
    const rows = all.slice((state.page - 1) * 10, state.page * 10),
      teams = [...new Set(state.items.flatMap((m) => m.teams || []))];
    return `<section id="member-section" class="paper" tabindex="-1"><header class="section-head"><div><h3>组织成员</h3><small>筛选 ${all.length} / ${state.items.length} 人；第 ${state.page} / ${count} 页</small></div></header><details id="filters-panel" class="filter-panel" ${state.filtersOpen ? "open" : ""}><summary>成员筛选</summary><div class="filters"><label for="filter-query">搜索<input id="filter-query" data-filter="query" type="search" value="${esc(f.query)}" placeholder="姓名或邮箱"></label><label for="filter-status">状态<select id="filter-status" data-filter="status">${options(
      [
        ["active", "正常使用"],
        ["disabled", "已停用"],
        ["locked", "已锁定"],
      ],
      f.status,
      "全部状态",
    )}</select></label><label for="filter-role">角色<select id="filter-role" data-filter="role">${options(
      D.roles.map((r) => [r, role(r)]),
      f.role,
      "全部角色",
    )}</select></label><label for="filter-team">团队<select id="filter-team" data-filter="team">${options(
      teams.map((t) => [t, t]),
      f.team,
      "全部团队",
    )}</select></label><label for="filter-sort">排序<select id="filter-sort" data-filter="sort">${options(
      [
        ["name_asc", "姓名 / 邮箱升序"],
        ["joined_desc", "最近加入"],
        ["status_asc", "状态优先"],
      ],
      f.sort,
    )}</select></label><button data-reset>重置筛选</button></div></details><p class="filter-summary">${esc([f.query ? `搜索：${f.query}` : "", f.status ? `状态：${statuses[f.status]}` : "", f.role ? `角色：${role(f.role)}` : "", f.team ? `团队：${f.team}` : ""].filter(Boolean).join("；") || "未设置筛选；仅筛选已加载的当前组织成员。")}</p>${
      rows.length
        ? rows
            .map(
              (m) =>
                `<article class="member" data-member="${esc(m.id)}"><div><h3>${esc(m.display_name || m.email)}</h3>${m.display_name ? `<p>${esc(m.email)}</p>` : ""}${badge(effective(m))}<p>成员关系：${statuses[m.status] || "其他"}；账号：${statuses[m.account_status] || "其他"}</p></div><div class="member-scope"><p>当前角色：${m.roles.map(role).join("、") || "尚未分配角色"}</p><p>团队：${esc(m.teams?.join("、") || "未加入团队")}</p><p>数据范围：${m.scopes.map(scope).join("、") || "无数据范围"}</p>${technical(`成员 ID：${m.id}\nversion: ${m.version}\n加入时间：${date(m.joined_at)}`)}</div><div class="member-actions"><label for="role-${esc(m.id)}">选择 ${esc(m.display_name || m.email)} 的角色</label><div class="role-action"><select id="role-${esc(m.id)}" data-selection="${m.id}">${options(
                  D.roles.map((r) => [r, role(r)]),
                  state.selections[m.id] || m.roles[0] || "member",
                )}</select><button data-action="role" data-id="${m.id}" ${state.busy ? "disabled" : ""}>分配角色</button></div><button class="${m.status === "active" ? "danger" : ""}" data-action="${m.status === "active" ? "disable" : "restore"}" data-id="${m.id}" ${state.busy ? "disabled" : ""}>${m.status === "active" ? "禁用成员" : "恢复成员"}</button></div></article>`,
            )
            .join("")
        : `<div class="empty"><h3>${state.items.length ? "没有符合条件的成员" : "暂无成员记录"}</h3><p>${state.items.length ? "调整或重置筛选，不代表组织没有成员。" : "本次返回没有成员；邀请入口仍按原能力边界提供。"}</p>${state.items.length ? "<button data-reset>重置筛选</button>" : ""}</div>`
    }${count > 1 ? `<nav class="pagination" aria-label="成员分页"><button data-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>上一页</button><span>第 ${state.page} / ${count} 页</span><button data-page="${state.page + 1}" ${state.page >= count ? "disabled" : ""}>下一页</button></nav>` : ""}<p class="sample-note">${esc(state.provenance)}</p></section>`;
  }
  function invitationSection() {
    const pending = state.invitations.filter(
        (i) =>
          ["pending_delivery", "pending_acceptance"].includes(i.status) &&
          new Date(i.expires_at) > clock(),
      ),
      expired = state.invitations.filter(
        (i) => ["expired", "revoked"].includes(i.status) || new Date(i.expires_at) <= clock(),
      ),
      visible = state.tab === "pending" ? pending : expired;
    return `<section id="invitation-section" class="paper invitation-paper" tabindex="-1"><header class="section-head"><div><h3>邀请成员</h3><small>每个邮箱独立创建邀请，不是整批原子操作。</small></div></header><div class="invite-layout"><form id="invite-form" class="invite-form"><label for="invite-emails">邮箱（每行一个）</label><textarea id="invite-emails" name="emails" required autocomplete="off" placeholder="name@company.com" aria-describedby="invite-help">${esc(state.form.emails)}</textarea><small id="invite-help">支持换行、逗号或分号分隔；重复邮箱会合并。</small><label for="invite-role">角色</label><select id="invite-role" name="role_code" required>${options(
      D.roles.map((r) => [r, role(r)]),
      state.form.role_code,
    )}</select><label for="invite-reason">原因</label><textarea id="invite-reason" name="reason" required maxlength="500">${esc(state.form.reason)}</textarea><button id="invite-submit" class="primary" ${state.busy ? "disabled" : ""}>${state.busy === "invite" ? "正在创建…" : "创建邀请"}</button><small>未配置邮件服务时保持“等待邮件服务”，不表示邮件已发送。</small>${state.results.length ? `<ul class="results" aria-label="邀请结果">${state.results.map((r) => `<li data-status="${r.status}"><b>${esc(r.email)}</b><span>${esc(r.message)}</span></li>`).join("")}</ul>` : ""}</form><div class="invite-records"><h3>邀请记录</h3><nav class="tabs" aria-label="邀请状态"><button data-tab="pending" aria-pressed="${state.tab === "pending"}">待接受 ${pending.length}</button><button data-tab="expired" aria-pressed="${state.tab === "expired"}">已失效 ${expired.length}</button></nav>${visible.length ? visible.map((i) => `<article class="invitation"><b>${esc(i.email)}</b><small>${role(i.role_code)}</small><small>期限 ${date(i.expires_at)}</small><div class="invite-actions">${badge(i.status)}${state.tab === "pending" ? `<button data-action="revoke" data-id="${i.id}" ${state.busy ? "disabled" : ""}>撤销邀请</button>` : ""}</div></article>`).join("") : `<p class="empty">${state.tab === "pending" ? "暂无待接受邀请。" : "暂无已失效邀请。"}</p>`}</div></div></section>`;
  }
  function render() {
    const titles = {
      loading: "正在读取当前组织数据…",
      error: "组织后台暂不可用",
      blocked: "组织数据暂不可用",
      expired: "登录已失效",
      forbidden: "无权管理当前组织",
      rate_limited: "请求过于频繁",
    };
    $("#workspace").innerHTML =
      `<header class="page-head"><div><h2>成员管理</h2><p>核对身份、角色和范围，再执行有原因的变更。</p></div><button id="refresh" ${state.busy === "refresh" || state.pageState === "loading" ? "disabled" : ""}>${state.busy === "refresh" ? "正在刷新…" : "刷新数据"}</button></header>${notice()}${state.pageState === "ready" ? memberSection() + invitationSection() : `<section class="paper empty"><h3>${titles[state.pageState]}</h3><p>读取当前组织成员及治理摘要；不跨组织获取数据。</p>${state.pageState === "loading" ? "" : "<button id='retry'>重新加载</button>"}</section>`}`;
    $("#scene-picker").value = state.scene;
    $("#filters-panel")?.addEventListener("toggle", (e) => {
      if (e.target.isConnected) state.filtersOpen = e.target.open;
    });
    $("#invite-form")?.addEventListener("submit", invite);
    $("#invite-form")?.addEventListener("input", (e) => {
      if (e.target.name) state.form[e.target.name] = e.target.value;
    });
    $("#invite-form")?.addEventListener("change", (e) => {
      if (e.target.name) state.form[e.target.name] = e.target.value;
    });
  }
  function openReason(action, id) {
    const item = (action === "revoke" ? state.invitations : state.items).find((x) => x.id === id);
    if (!item || state.busy) return;
    const selectedRole = state.selections[id] || item.roles?.[0] || "member",
      title =
        action === "role"
          ? `分配${role(selectedRole)}`
          : { disable: "禁用成员", restore: "恢复成员", revoke: "撤销邀请" }[action];
    returnFocus = document.activeElement;
    state.dialog = { action, item: clone(item), role: selectedRole, title };
    $("#reason-title").textContent = title + "原因";
    $("#reason-target").innerHTML =
      `<strong>${esc(item.display_name || item.email)}</strong><p>${esc(item.email)}</p><p>${action === "restore" ? "仅恢复组织成员关系，不解除账号锁定。" : action === "role" ? `当前角色：${item.roles.map(role).join("、")}；拟分配：${role(selectedRole)}。角色分配替换该成员已有角色。` : action === "disable" ? "将停用该组织成员关系；自身和最后管理员限制由后端核验。" : "撤销当前邀请，不删除已有成员或账号。"}</p><p>依据当前记录第 ${item.version} 版提交。</p>`;
    $("#reason-input").value = title;
    $("#reason-confirm").disabled = false;
    $("#reason-dialog").showModal();
    $("#reason-input").focus();
    $("#reason-dialog").scrollTop = 0;
  }
  function closeReason() {
    state.dialog = null;
    $("#reason-dialog").close();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  function submitReason(e) {
    e.preventDefault();
    const reason = $("#reason-input").value.trim();
    if (reason.length < 2 || reason.length > 500 || !state.dialog) return;
    const d = clone(state.dialog),
      body = {
        ...(d.action === "role" ? { role_code: d.role } : { action: d.action }),
        expected_version: d.item.version,
        reason,
      },
      url =
        d.action === "revoke"
          ? `/org/admin/invitations/${d.item.id}/actions`
          : `/org/admin/members/${d.item.id}/${d.action === "role" ? "roles" : "actions"}`;
    closeReason();
    log(url, "POST", body);
    state.pending = { kind: "action", dialog: d };
    if (state.mode === "hold") state.busy = "action";
    else {
      state.pending = null;
      state.notice = "仅记录变更意图。原因窗已关闭，成员、角色和邀请事实未被修改。";
      state.noticeKind = "info";
    }
    render();
    $("#feedback")?.focus();
  }
  function invite(e) {
    e.preventDefault();
    if (state.busy) return;
    const raw = state.form.emails
        .split(/[\n,;]+/)
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
      unique = [...new Set(raw)],
      reason = state.form.reason.trim(),
      valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
    if (!unique.length || !reason || reason.length > 500) {
      state.notice = "请填写邮箱、角色和1–500个字符的邀请原因。";
      state.noticeKind = "error";
      render();
      return;
    }
    const accepted = unique.filter(valid);
    state.results = unique
      .filter((v) => !valid(v))
      .map((email) => ({ email, status: "error", message: "邮箱格式无效" }));
    if (state.mode === "intent") {
      for (const email of accepted) {
        log("/org/admin/invitations", "POST", { email, role_code: state.form.role_code, reason });
        state.results.push({ email, status: "pending", message: "仅记录邀请意图，未创建或发送" });
      }
      state.notice = `审核意图：${accepted.length}个合法邮箱，${unique.length - accepted.length}个无效邮箱，重复${raw.length - unique.length}条已合并。`;
      state.noticeKind = "info";
    } else if (accepted.length) {
      state.pending = {
        kind: "invite",
        emails: accepted,
        index: 0,
        role_code: state.form.role_code,
        reason,
      };
      state.busy = "invite";
      sendNext();
    }
    render();
  }
  function sendNext() {
    const p = state.pending;
    log("/org/admin/invitations", "POST", {
      email: p.emails[p.index],
      role_code: p.role_code,
      reason: p.reason,
    });
  }
  function complete(outcome) {
    const p = state.pending;
    if (!p) return false;
    if (p.kind === "invite") {
      state.results.push({
        email: p.emails[p.index],
        status: outcome === "success" ? "success" : "error",
        message:
          outcome === "success"
            ? "合成响应：已创建待投递邀请"
            : outcome === "forbidden"
              ? "合成403：无权创建，处理中断"
              : "合成请求失败",
      });
      p.index++;
      if (outcome === "forbidden")
        for (const email of p.emails.slice(p.index))
          state.results.push({ email, status: "pending", message: "尚未处理，未发起请求" });
      if (p.index < p.emails.length && outcome !== "forbidden") {
        sendNext();
        render();
        return true;
      }
      state.form = {
        emails: state.results
          .filter((r) => r.status !== "success")
          .map((r) => r.email)
          .join("\n"),
        role_code: p.role_code,
        reason: state.results.some((r) => r.status !== "success") ? p.reason : "",
      };
      state.notice =
        outcome === "forbidden"
          ? "合成权限中断：失败与尚未处理邮箱保留，不显示整批成功。原型未向服务发送邮件。"
          : "合成逐邮箱处理结束；已创建不等于已发送。";
      state.noticeKind = outcome === "forbidden" ? "error" : "info";
    } else {
      state.notice =
        outcome === "success"
          ? "合成写响应已确认；列表尚未重读，仍显示原始事实。"
          : "合成变更失败：请刷新核验当前版本。原因窗已关闭，重新打开会回到默认原因。";
      state.noticeKind = outcome === "success" ? "info" : "error";
    }
    state.pending = null;
    state.busy = "";
    render();
    $("#feedback")?.focus();
    return true;
  }
  function reset() {
    state.filters = { query: "", status: "", role: "", team: "", sort: "name_asc" };
    state.page = 1;
    render();
  }
  function scene(name) {
    if (!(name in scenes)) throw new Error("Unknown scene");
    if ($("#reason-dialog").open) $("#reason-dialog").close();
    state = base();
    state.scene = name;
    $("#intent-log").textContent = "仅记录意图，不访问服务。";
    $("#review-tools").hidden = name !== "controls";
    $("#review-toggle").setAttribute("aria-expanded", String(name === "controls"));
    for (const link of document.querySelectorAll(".directory a"))
      link.setAttribute("aria-current", String(link.hash === "#member-section"));
    if (!["normal", "technical", "controls"].includes(name))
      state.provenance = "合成审核状态；不代表真实成员、权限或投递结果。";
    if (name === "search") state.filters.query = "陈";
    if (name === "filter_locked") state.filters.status = "locked";
    if (name === "filter_role") state.filters.role = "procurement_member";
    if (name === "filter_team") state.filters.team = "采购协作组";
    if (name === "filter_empty") state.filters.query = "不存在的名字";
    if (name === "members_empty") state.items = [];
    if (["multipage", "page_two"].includes(name)) {
      state.items = Array.from({ length: 11 }, (_, i) => ({
        ...clone(D.members.items[1]),
        id: `synthetic-member-${i}`,
        display_name: `合成成员 ${String(i + 1).padStart(2, "0")}`,
        email: `member-${i + 1}@example.test`,
      }));
      if (name === "page_two") state.page = 2;
    }
    if (name === "long_member") {
      state.items[1].display_name = "跨境采购与新品证据核验成员".repeat(3);
      state.items[1].email = "long-member-".repeat(8) + "@example.test";
    }
    if (["disabled_locked", "reason_restore"].includes(name)) state.items[2].status = "disabled";
    if (name === "multiple_roles") {
      state.items[1].roles = ["member", "procurement_member"];
      state.items[1].scopes = ["own", "team", "workspace"];
    }
    if (name === "filters_open") state.filtersOpen = true;
    if (["loading", "error", "blocked", "expired", "forbidden", "rate_limited"].includes(name))
      state.pageState = name;
    if (name === "refreshing") state.busy = "refresh";
    if (name === "refresh_error") {
      state.notice = "合成刷新失败，保留上次成员与邀请记录。";
      state.noticeKind = "error";
    }
    if (name === "invite_empty") state.invitations = [];
    if (name === "invite_expired") state.tab = "expired";
    if (name === "invite_acceptance") state.invitations[0].status = "pending_acceptance";
    if (name === "invite_revoked") {
      state.invitations[0].status = "revoked";
      state.tab = "expired";
    }
    if (name === "invite_boundary") {
      state.invitations[0].expires_at = D.now;
      state.tab = "expired";
      state.notice =
        "合成到期边界：邀请已进入失效分组；状态仍按原返回pending_delivery显示，不伪改后端字段。";
    }
    if (
      [
        "invite_form",
        "invite_invalid",
        "invite_partial",
        "invite_busy",
        "invite_interrupted",
        "invite_success",
      ].includes(name)
    )
      state.form = {
        emails: "first@example.test\nsecond@example.test",
        role_code: "member",
        reason: "核验后邀请协作成员",
      };
    if (name === "invite_invalid") {
      state.form.emails = "FIRST@example.test;first@example.test;bad";
      state.results = [{ email: "bad", status: "error", message: "邮箱格式无效" }];
    }
    if (name === "invite_partial") {
      state.form.emails = "second@example.test";
      state.results = [
        { email: "first@example.test", status: "success", message: "合成响应：已创建待投递邀请" },
        { email: "second@example.test", status: "error", message: "合成409：已有成员或邀请" },
      ];
    }
    if (name === "invite_busy") {
      state.busy = "invite";
      state.results = [
        { email: "first@example.test", status: "pending", message: "合成在途请求：结果未确认" },
      ];
    }
    if (name === "invite_interrupted") {
      state.results = [
        { email: "first@example.test", status: "error", message: "合成403：无权创建邀请" },
        { email: "second@example.test", status: "pending", message: "尚未处理，未发起请求" },
      ];
      state.notice =
        "合成权限中断：保留失败与尚未处理邮箱，不将未处理项丢弃。此保护仅提案，真实403页面归属仍待验证。";
      state.noticeKind = "error";
    }
    if (name === "invite_success") {
      state.results = [
        { email: "first@example.test", status: "success", message: "合成响应：已创建待投递邀请" },
      ];
      state.form.emails = "";
      state.form.reason = "";
    }
    if (name === "action_busy") state.busy = "action";
    if (["action_conflict", "self_forbidden", "last_admin"].includes(name)) {
      state.notice = {
        action_conflict: "合成409：成员版本已变化，未确认变更；请刷新后核验。",
        self_forbidden: "合成409：不能禁用自身，请由另一位组织管理员处理。",
        last_admin: "合成409：不能移除最后一位活动组织管理员，请先分配另一位管理员。",
      }[name];
      state.noticeKind = "error";
    }
    render();
    window.scrollTo(0, 0);
    if (name.startsWith("reason_")) {
      const action =
          name === "reason_restore"
            ? "restore"
            : name === "reason_role"
              ? "role"
              : name === "reason_revoke"
                ? "revoke"
                : "disable",
        item =
          action === "revoke"
            ? state.invitations[0]
            : action === "restore"
              ? state.items[2]
              : state.items[1];
      if (action === "role") state.selections[item.id] = "selection_manager";
      openReason(action, item.id);
      if (name === "reason_short") {
        $("#reason-input").value = "短";
        $("#reason-confirm").disabled = true;
      }
      if (name === "reason_long")
        $("#reason-input").value = "核验成员关系与业务分工，记录本次调整依据。".repeat(20);
    }
    if (name === "technical") $(".member details").open = true;
  }
  $("#scene-picker").innerHTML = Object.entries(scenes)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join("");
  $("#scene-picker").addEventListener("change", (e) => scene(e.target.value));
  $("#review-toggle").addEventListener("click", () => {
    $("#review-tools").hidden = !$("#review-tools").hidden;
    $("#review-toggle").setAttribute("aria-expanded", String(!$("#review-tools").hidden));
  });
  $("#reason-form").addEventListener("submit", submitReason);
  $("#reason-input").addEventListener("input", () => {
    $("#reason-confirm").disabled = $("#reason-input").value.trim().length < 2;
  });
  $("#reason-close").addEventListener("click", closeReason);
  $("#reason-cancel").addEventListener("click", closeReason);
  $("#reason-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    closeReason();
  });
  $("#reason-dialog").addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...e.currentTarget.querySelectorAll("button,textarea")].filter(
        (n) => !n.disabled,
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
  document.addEventListener("input", (e) => {
    const n = e.target;
    if (!n.dataset.filter) return;
    const pos = n.selectionStart;
    state.filtersOpen = $("#filters-panel").open;
    state.filters[n.dataset.filter] = n.value;
    state.page = 1;
    render();
    const replacement = $("#" + n.id);
    replacement.focus();
    if (pos != null) replacement.setSelectionRange(pos, pos);
  });
  document.addEventListener("change", (e) => {
    const n = e.target;
    if (n.dataset.selection) state.selections[n.dataset.selection] = n.value;
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a");
    if (!b || b.disabled) return;
    if (b.dataset.action) openReason(b.dataset.action, b.dataset.id);
    if (b.hasAttribute("data-reset")) reset();
    if (b.dataset.page) {
      state.page = Number(b.dataset.page);
      render();
    }
    if (b.dataset.tab) {
      state.tab = b.dataset.tab;
      render();
    }
    if (["refresh", "retry"].includes(b.id)) {
      log("/org/admin/summary");
      log("/org/admin/members");
      state.notice = "仅记录读取意图；本稿未访问服务，原成员与邀请保持不变。";
      state.noticeKind = "info";
      render();
    }
    if (b.tagName === "A" && b.closest(".directory")) {
      e.preventDefault();
      const target = $(b.hash);
      if (target) {
        for (const a of document.querySelectorAll(".directory a"))
          a.setAttribute("aria-current", String(a === b));
        target.scrollIntoView({ block: "start", behavior: "instant" });
        target.focus({ preventScroll: true });
      }
    }
  });
  scene("normal");
  window.MEMBERS_C = {
    scenes,
    scene,
    complete,
    setMode: (mode) => {
      if (!["intent", "hold"].includes(mode)) throw new Error("Invalid mode");
      state.mode = mode;
    },
    state: () => clone(state),
  };
})();
