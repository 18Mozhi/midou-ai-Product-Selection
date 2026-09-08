(() => {
  "use strict";
  const D = window.ACCOUNT_OVERVIEW_C_DATA,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
      );
  const scenes = {
    normal: "默认 · 原单条夹具",
    many: "12组织 · 合成",
    long: "长名称与编号",
    zero_counts: "零成员零工作区",
    empty: "平台无组织",
    filtered_empty: "筛选无组织",
    email_query: "邮箱查询 · 本页仅组织",
    active: "正常组织筛选",
    archived: "已停用组织筛选",
    disabled: "已停用账号状态 · 无组织",
    loading: "首次读取中",
    error: "首次读取失败",
    timeout: "首次读取超时",
    refreshing: "后台读取中",
    refresh_failed: "新条件失败 · 旧事实",
    refresh_forbidden: "权限错误 · 保留旧快照",
    refresh_expired: "登录过期 · 保留旧快照",
    draft_changed: "条件已改但未查询",
    columns: "桌面列设置",
    one_column: "桌面仅剩一列",
    compact: "桌面紧凑密度",
    unfrozen: "取消冻结",
    filter_open: "移动筛选抽屉",
    preview: "移动组织预览",
    preview_technical: "移动预览技术详情",
    create_user: "新建普通用户",
    create_member: "创建并加入组织",
    create_operations: "新建运营管理员",
    create_security: "新建安全管理员",
    create_super: "新建超级管理员",
    create_error: "创建失败保留输入",
    create_busy: "创建处理中",
    create_success: "创建成功反馈",
    create_refresh_error: "创建成功但重读失败",
    create_invalid: "表单校验失败",
    create_reopened: "重新打开空表单",
    hover: "刷新悬停",
    focus: "刷新聚焦",
    pressed: "刷新按下",
    controls: "按钮六态 · 审核工具",
  };
  const routes = {
    organizations: "/platform-admin/organizations",
    users: "/platform-admin/users",
    admins: "/platform-admin/admins",
    create: "/platform-admin/organizations/new",
  };
  const label = (v) => ({ active: "正常使用", disabled: "已停用", archived: "已停用组织" })[v] ?? v;
  const badge = (v) => `<span class="status ${esc(v)}">${esc(label(v))}</span>`;
  const freshForm = () => ({
    email: "",
    temporary_password: "",
    platform_role_code: "",
    organization_id: "",
    organization_role_code: "member",
  });
  let s,
    sequence = 0,
    owner = 0,
    dialogOwner = 0,
    returnFocus;
  const matches = (row, filter) =>
    `${row.name} ${row.slug}`
      .toLocaleLowerCase()
      .includes(filter.query.trim().toLocaleLowerCase()) &&
    (!filter.status || row.status === filter.status);
  const pendingDraft = () => s.query.trim() !== s.facts.query || s.status !== s.facts.status;
  function scene(name = "normal") {
    owner++;
    dialogOwner++;
    s = {
      name,
      data: clone(D.overview),
      base: clone(D.overview),
      query: "",
      status: "",
      facts: { query: "", status: "" },
      state: "ready",
      pending: null,
      readMode: "success",
      writeMode: "success",
      write: null,
      intents: [],
      navigation: [],
      message: "",
      error: "",
      hidden: [],
      freeze: true,
      density: "standard",
      form: freshForm(),
      createError: "",
      dialog: null,
      active: true,
    };
    if (["many", "long", "active", "archived", "disabled", "zero_counts"].includes(name)) {
      s.base.organizations = clone(D.expanded);
      s.base.summary.organizations = 12;
      s.base.summary.active_organizations = 9;
      s.data = clone(s.base);
    }
    if (name === "long") {
      s.data.organizations = s.data.organizations.slice(0, 2);
      s.data.organizations[0].id = "synthetic-" + "abcdef0123456789".repeat(8);
      s.base = clone(s.data);
    }
    if (name === "zero_counts") {
      s.data.organizations = [clone(D.expanded[0])];
      s.base = clone(s.data);
    }
    if (name === "empty") {
      s.data.organizations = [];
      s.data.summary.organizations = 0;
      s.data.summary.active_organizations = 0;
      s.base = clone(s.data);
    }
    if (["filtered_empty", "email_query"].includes(name)) {
      s.query = name === "email_query" ? "buyer@example.test" : "未命中样本";
      s.data.organizations = [];
      s.facts = { query: s.query, status: "" };
    }
    if (["active", "archived", "disabled"].includes(name)) {
      s.status = name;
      s.facts.status = name;
      s.data.organizations = s.base.organizations.filter((r) => matches(r, s.facts));
    }
    if (["loading", "error", "timeout"].includes(name)) s.state = name;
    if (name === "refreshing") s.pending = { id: ++sequence, owner, facts: clone(s.facts) };
    if (name.startsWith("refresh_") && name !== "refreshing") {
      s.error = name;
      if (name === "refresh_failed") s.query = "另一组织";
    }
    if (name === "draft_changed") s.query = "尚未查询";
    if (name === "one_column") s.hidden = [0, 1, 2, 3];
    if (name === "compact") s.density = "compact";
    if (name === "unfrozen") s.freeze = false;
    if (name === "create_success")
      s.message = "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
    if (name === "create_refresh_error") {
      s.message = "账号已创建；首次登录必须修改临时密码。";
      s.error = "write_refresh_error";
    }
    const url = new URL(location.href);
    url.searchParams.delete("query");
    url.searchParams.delete("status");
    if (s.query) url.searchParams.set("query", s.query);
    if (s.status) url.searchParams.set("status", s.status);
    history.replaceState({}, "", url);
    render();
    if (["filter_open", "preview", "preview_technical"].includes(name) && innerWidth <= 760) {
      if (name === "filter_open") openFilter();
      else
        openPreview(
          s.data.organizations[0],
          document.querySelector(".record"),
          name === "preview_technical",
        );
    }
    if (name.startsWith("create_") && !["create_success", "create_refresh_error"].includes(name)) {
      openCreate();
      if (name !== "create_user" && name !== "create_reopened")
        Object.assign(s.form, {
          email: "synthetic@example.test",
          temporary_password: "SyntheticOnly-12",
        });
      if (name === "create_member")
        Object.assign(s.form, {
          organization_id: D.overview.organizations[0].id,
          organization_role_code: "organization_admin",
        });
      const role = {
        create_operations: "platform_operations_admin",
        create_security: "platform_security_admin",
        create_super: "platform_super_admin",
      }[name];
      if (role) s.form.platform_role_code = role;
      if (name === "create_error") s.createError = "合成创建请求失败，输入已保留。请核对后重试。";
      if (name === "create_invalid") {
        s.form.email = "不是邮箱";
        s.form.temporary_password = "short";
        s.createError = "请填写有效邮箱，临时密码至少12个字符。";
      }
      if (name === "create_busy") s.write = { id: ++sequence, owner: dialogOwner, body: body() };
      drawCreate();
    }
  }
  function nav(path) {
    s.navigation.push(path);
    document.querySelector("#navigation-result").textContent =
      `审核跳转意图：${path}。P41创建与P42详情按各自独立路由继续设计；关闭实际回组织列表，不承诺回本概览。`;
  }
  function filterHTML() {
    return `<form class="filters" id="filter-form"><label for="query"><span class="label">组织名称或标识</span><input id="query" value="${esc(s.query)}" maxlength="120" autocomplete="off"></label><label for="status"><span class="label">账号状态</span><select id="status">${[
      ["", "全部状态"],
      ["active", "正常使用"],
      ["disabled", "已停用"],
      ["archived", "已停用组织"],
    ]
      .map(([v, l]) => `<option value="${v}" ${s.status === v ? "selected" : ""}>${l}</option>`)
      .join(
        "",
      )}</select></label><button class="primary" id="search" ${s.pending ? "disabled" : ""}>搜索</button><button id="reset" type="button" ${s.pending || (!s.query.trim() && !s.status) ? "disabled" : ""}>重置</button><p class="filter-note">此区域只显示组织记录；用户邮箱请到用户管理查询。两种停用状态保留不同值。</p></form>`;
  }
  function scopeText(f) {
    return `${f.query ? `名称/标识包含「${f.query}」` : "未限定名称"} / ${f.status ? label(f.status) + "（" + f.status + "）" : "全部状态"}`;
  }
  function tableHTML() {
    const cols = ["组织", "成员", "工作区", "状态", "操作"],
      first = cols.findIndex((_, i) => !s.hidden.includes(i));
    const cell = (html, i, tag = "td") =>
      `<${tag} ${s.hidden.includes(i) ? "hidden" : ""} class="${s.freeze && i === first ? "frozen" : ""}">${html}</${tag}>`;
    return `<div class="toolbar"><details id="columns" ${["columns", "one_column"].includes(s.name) ? "open" : ""}><summary>列设置</summary><div class="columns">${cols.map((v, i) => `<label for="column-${i}"><input type="checkbox" id="column-${i}" data-column="${i}" ${s.hidden.includes(i) ? "" : "checked"} ${!s.hidden.includes(i) && s.hidden.length === 4 ? "disabled" : ""}>${v}</label>`).join("")}</div></details><button id="freeze" aria-pressed="${s.freeze}">${s.freeze ? "首列已冻结" : "首列未冻结"}</button><label for="density">密度<select id="density"><option value="standard" ${s.density === "standard" ? "selected" : ""}>标准</option><option value="compact" ${s.density === "compact" ? "selected" : ""}>紧凑</option></select></label></div><div class="table-wrap"><table id="organizations" class="${s.density}"><thead><tr>${cols.map((v, i) => cell(v, i, "th")).join("")}</tr></thead><tbody>${s.data.organizations.map((r) => `<tr data-record="${esc(r.id)}">${[`<strong>${esc(r.name)}</strong><small>${esc(r.slug)}</small>`, `${r.member_count} 人`, `${r.workspace_count} 个`, badge(r.status), `<button data-detail="${esc(r.id)}" ${s.write ? "disabled" : ""}>查看详情</button>`].map((v, i) => cell(v, i)).join("")}</tr>`).join("")}</tbody></table></div><div class="mobile-list">${s.data.organizations.map((r) => `<button class="record" data-preview="${esc(r.id)}" aria-haspopup="dialog"><strong>${esc(r.name)}</strong><span class="record-meta">${badge(r.status)}<span>${r.member_count} 人 / ${r.workspace_count} 个工作区</span></span><small>查看预览</small></button>`).join("")}</div><p class="footer-note">本次返回 ${s.data.organizations.length} 条，接口每类最多200条。没有全库分页；成员计数含全部关系状态，工作区计数未限活动状态。</p>`;
  }
  function render() {
    const activeId = document.activeElement?.id;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    const sum = s.data.summary,
      hasData = !["loading", "error", "timeout"].includes(s.state);
    document.querySelector("#app").innerHTML =
      `<div class="review"><span>P39 / ACCOUNT-OVERVIEW-C-r1 · 独立提案，未上线</span><div class="review-picker"><label for="scene">审核场景</label><select id="scene">${Object.entries(
        scenes,
      )
        .map(([v, l]) => `<option value="${v}" ${s.name === v ? "selected" : ""}>${l}</option>`)
        .join(
          "",
        )}</select></div></div><header class="topbar"><div class="brand">ScoutOps</div><p>平台全局 / 超级管理员</p></header><div class="layout"><aside class="directory"><div class="directory-head"><h2>平台组织与账号</h2><p>全局规模，不随右侧筛选变化</p></div><nav aria-label="管理入口">${[
        [
          "organizations",
          "组织管理",
          sum.active_organizations + " / " + sum.organizations,
          "正常 / 全部",
        ],
        ["users", "用户管理", sum.active_users + " / " + sum.users, "可登录 / 全部"],
        ["admins", "管理员管理", sum.platform_admins, "拥有平台后台权限"],
      ]
        .map(
          ([key, title, count, desc]) =>
            `<a href="${routes[key]}" data-nav="${routes[key]}"><span class="nav-title">${title}<span aria-hidden="true">↗</span></span>${hasData ? `<b class="counts">${count}<small>${desc}</small></b>` : "<small>尚未取得汇总</small>"}</a>`,
        )
        .join(
          "",
        )}</nav><p class="foot">只核对平台聚合与组织记录，不展示成员工作区业务内容。</p></aside><main class="work"><header class="page-head"><div><h1>组织与账号概览</h1><p>核对规模，找到组织，再进入对应管理页。</p></div><div class="actions"><button class="primary" id="create-org">新建组织</button><button id="create-user">新建用户</button></div></header>${s.name === "controls" ? `<div class="six-states"><button>默认</button><button class="forced-hover">悬停</button><button class="forced-focus">聚焦</button><button class="forced-pressed">按下</button><button disabled>禁用</button><button disabled>读取中…</button></div>` : ""}${s.message ? `<div class="notice" role="status">${esc(s.message)}</div>` : ""}${s.error ? `<div class="notice error" role="alert"><b>${s.error === "write_refresh_error" ? "创建已成功，但列表未能重新读取" : "读取失败，保留上次成功的数据"}</b><p>当前输入：${esc(scopeText({ query: s.query, status: s.status }))}；旧事实：${esc(scopeText(s.facts))}。${["refresh_forbidden", "refresh_expired"].includes(s.error) ? "源页面权限/登录失败也保留数据，该风险仍待处理。" : "没有取得新结果；请勿把旧列表当新条件结果。"}</p><button id="retry">重新读取</button></div>` : ""}<section class="surface"><header class="section-head"><div><h2>组织记录</h2><p class="sub">组织名称、成员、工作区与状态</p></div><button id="refresh" ${s.pending || s.write || s.state === "loading" ? "disabled" : ""}>${s.pending || s.state === "loading" ? "正在刷新…" : "刷新数据"}</button></header>${innerWidth > 760 ? `<div class="inline-filters">${filterHTML()}</div>` : `<button class="filter-trigger" id="filter-trigger" aria-haspopup="dialog">账号筛选${s.query.trim() || s.status ? " · " + (Number(Boolean(s.query.trim())) + Number(Boolean(s.status))) + " 项已选" : ""}</button>`}${hasData ? `<div class="scope-line"><span>已读取条件：${esc(scopeText(s.facts))}</span><span>审核固定时钟 2026-09-09 10:00 CST</span><span>${pendingDraft() ? "输入已改变，尚未取得对应结果" : "原测试/合成数据，非生产"}</span></div>${s.data.organizations.length ? tableHTML() : `<div class="empty"><h3>${s.facts.query || s.facts.status ? "没有符合当前条件的组织" : "还没有组织"}</h3><p class="sub">${s.name === "email_query" ? "本页只呈现组织结果，不会将邮箱命中展示为用户行。" : "调整组织名称、标识或状态后重试；页头的新建入口仍可使用。"}</p><div class="actions">${s.facts.query || s.facts.status ? '<button id="clear-filter">清除筛选</button>' : ""}</div></div>`}` : `<div class="empty" role="status"><h3>${s.state === "loading" ? "正在读取组织与账号" : s.state === "timeout" ? "读取超过12秒" : "暂时无法读取平台账号"}</h3><p class="sub">${s.state === "loading" ? "正在取得平台汇总及组织记录。" : "没有取得可用快照，请重新读取。"}</p>${s.state !== "loading" ? '<div class="actions"><button id="retry-initial">重新加载</button></div>' : ""}</div>`}</section><p id="navigation-result" class="navigation-result">审核工具拦截跨页跳转，不发起真实API或创建账号。</p><p class="boundary">概览正文只有组织；创建组织进入P41，查看组织详情进入P42。创建用户使用本页五字段弹窗。所有具体稿待审，不能把方向选择当上线批准。</p></main></div><dialog id="modal" aria-labelledby="modal-title"></dialog>`;
    document.querySelector("#scene").onchange = (e) => scene(e.target.value);
    document.querySelector("#create-org").onclick = () => nav(routes.create);
    document.querySelector("#create-user").onclick = openCreate;
    document.querySelectorAll("[data-nav]").forEach(
      (a) =>
        (a.onclick = (e) => {
          e.preventDefault();
          nav(a.dataset.nav);
        }),
    );
    document.querySelectorAll("#refresh,#retry,#retry-initial").forEach((b) => (b.onclick = read));
    document.querySelector("#clear-filter")?.addEventListener("click", reset);
    document.querySelector("#filter-trigger")?.addEventListener("click", openFilter);
    bindFilters();
    document
      .querySelectorAll("[data-detail]")
      .forEach((b) => (b.onclick = () => nav(routes.organizations + "/" + b.dataset.detail)));
    document.querySelectorAll("[data-preview]").forEach(
      (b) =>
        (b.onclick = () =>
          openPreview(
            s.data.organizations.find((r) => r.id === b.dataset.preview),
            b,
          )),
    );
    document.querySelectorAll("[data-column]").forEach(
      (n) =>
        (n.onchange = () => {
          const i = Number(n.dataset.column);
          if (s.hidden.includes(i)) s.hidden = s.hidden.filter((v) => v !== i);
          else if (s.hidden.length < 4) s.hidden.push(i);
          render();
          document.querySelector("#columns").open = true;
          document.querySelector("#column-" + i).focus();
        }),
    );
    document.querySelector("#freeze")?.addEventListener("click", () => {
      s.freeze = !s.freeze;
      render();
      document.querySelector("#freeze").focus();
    });
    document.querySelector("#density")?.addEventListener("change", (e) => {
      s.density = e.target.value;
      render();
      document.querySelector("#density").focus();
    });
    if (s.dialog === "create") {
      modal("新建用户或平台管理员", "", "create", document.querySelector("#create-user"));
      drawCreate();
      if (activeId) document.getElementById(activeId)?.focus();
    } else if (s.dialog === "filter" && innerWidth <= 760) {
      openFilter();
      if (activeId) document.getElementById(activeId)?.focus();
    }
  }
  function bindFilters() {
    const form = document.querySelector("#filter-form");
    if (!form) return;
    const input = form.querySelector("#query"),
      status = form.querySelector("#status"),
      resetButton = form.querySelector("#reset");
    const edit = () => {
      s.query = input.value;
      s.status = status.value;
      resetButton.disabled = Boolean(s.pending) || (!s.query.trim() && !s.status);
    };
    input.oninput = edit;
    status.onchange = edit;
    form.onsubmit = (e) => {
      e.preventDefault();
      edit();
      if (s.dialog === "filter") close();
      apply();
    };
    resetButton.onclick = reset;
  }
  function apply() {
    const u = new URL(location.href);
    if (s.query.trim()) u.searchParams.set("query", s.query.trim());
    else u.searchParams.delete("query");
    if (s.status) u.searchParams.set("status", s.status);
    else u.searchParams.delete("status");
    history.replaceState({}, "", u);
    read();
  }
  function reset() {
    s.query = "";
    s.status = "";
    if (s.dialog === "filter") {
      document.querySelector("#query").value = "";
      document.querySelector("#status").value = "";
    }
    apply();
  }
  function read() {
    if (s.pending || !s.active) return;
    const facts = { query: s.query.trim(), status: s.status },
      p = new URLSearchParams();
    if (facts.query) p.set("query", facts.query);
    if (facts.status) p.set("status", facts.status);
    s.pending = { id: ++sequence, owner, facts };
    s.intents.push({ method: "GET", path: "/platform/accounts?" + p });
    s.error = "";
    if (s.state !== "ready") s.state = "loading";
    render();
    if (s.readMode !== "hold") completeRead(s.readMode);
  }
  function completeRead(result = "success", id = s.pending?.id) {
    const request = s.pending;
    if (!request || request.id !== id || request.owner !== owner || !s.active) return false;
    s.pending = null;
    if (result === "success") {
      s.data = clone(s.base);
      s.data.organizations = s.base.organizations.filter((r) => matches(r, request.facts));
      s.facts = request.facts;
      s.state = "ready";
      s.error = "";
    } else if (s.state === "ready")
      s.error =
        result === "forbidden"
          ? "refresh_forbidden"
          : result === "expired"
            ? "refresh_expired"
            : "refresh_failed";
    else s.state = result === "timeout" ? "timeout" : "error";
    render();
    return true;
  }
  function modal(title, html, kind, trigger) {
    s.dialog = kind;
    returnFocus = trigger ?? document.activeElement;
    const d = document.querySelector("#modal");
    d.className = kind === "preview" ? "preview" : kind === "filter" ? "filter-dialog" : "";
    d.innerHTML = `<header class="dialog-head"><h2 id="modal-title">${title}</h2><button id="close-modal" aria-label="关闭${title}">关闭</button></header><div class="dialog-body">${html}</div>`;
    d.showModal();
    d.querySelector("#close-modal").onclick = close;
    d.oncancel = (e) => {
      e.preventDefault();
      close();
    };
    d.onkeydown = (e) => {
      if (e.key !== "Tab") return;
      const items = [...d.querySelectorAll("button,input,select,summary,a[href]")].filter(
          (n) => !n.disabled && n.getClientRects().length,
        ),
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    d.onclick = (e) => {
      const r = d.getBoundingClientRect();
      if (
        s.dialog !== "create" &&
        e.target === d &&
        (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      )
        close();
    };
    d.querySelector("#close-modal").focus();
  }
  function close() {
    const kind = s.dialog;
    s.dialog = null;
    dialogOwner++;
    document.querySelector("#modal").close();
    returnFocus?.isConnected && returnFocus.focus();
    if (kind === "create" && s.write) {
      s.message = "创建请求已发出；关闭窗口不会撤销请求，请勿重复创建。";
      document.querySelector("#navigation-result").textContent = s.message;
    }
  }
  function openFilter() {
    modal("账号筛选", filterHTML(), "filter", document.querySelector("#filter-trigger"));
    bindFilters();
  }
  function openPreview(r, trigger, technical = false) {
    modal(
      "组织预览",
      `<h3>${esc(r.name)}</h3><dl><dt>组织标识</dt><dd>${esc(r.slug)}</dd><dt>成员</dt><dd>${r.member_count} 人</dd><dt>工作区</dt><dd>${r.workspace_count} 个</dd><dt>状态</dt><dd>${badge(r.status)}</dd></dl><button id="open-detail" class="primary" ${s.write ? "disabled" : ""}>打开组织详情</button><details ${technical ? "open" : ""}><summary>技术详情</summary><dl><dt>组织UUID</dt><dd>${esc(r.id)}</dd></dl></details><p class="scope">此窗只读。组织详情属于P42，关闭详情实际回组织列表。</p>`,
      "preview",
      trigger,
    );
    document.querySelector("#open-detail").onclick = () => {
      close();
      nav(routes.organizations + "/" + r.id);
    };
  }
  function openCreate() {
    dialogOwner++;
    s.form = freshForm();
    s.createError = "";
    modal("新建用户或平台管理员", "", "create", document.querySelector("#create-user"));
    drawCreate();
  }
  function drawCreate() {
    const d = document.querySelector("#modal"),
      f = s.form;
    d.querySelector(".dialog-body").innerHTML =
      `<p class="sub">创建后首次登录必须修改临时密码；平台管理员还必须绑定MFA。</p>${s.createError ? `<p class="inline-error" id="create-error" role="alert">${esc(s.createError)}</p>` : ""}<form id="user-form"><div class="user-fields"><label for="email">邮箱<input id="email" type="email" required maxlength="254" value="${esc(f.email)}" autocomplete="off"></label><label for="temporary_password">临时密码<input id="temporary_password" type="password" required minlength="12" maxlength="128" value="${esc(f.temporary_password)}" autocomplete="new-password"><small>12–128字符；仅用于本次创建，不写入浏览器存储。</small></label><fieldset class="field-group"><legend>授权与组织归属</legend><label for="platform_role_code">平台角色<select id="platform_role_code">${[
        ["", "普通用户"],
        ["platform_operations_admin", "运营管理员"],
        ["platform_security_admin", "安全管理员"],
        ["platform_super_admin", "超级管理员"],
      ]
        .map(
          ([v, l]) =>
            `<option value="${v}" ${f.platform_role_code === v ? "selected" : ""}>${l}</option>`,
        )
        .join(
          "",
        )}</select></label><label for="organization_id">加入组织<select id="organization_id"><option value="">暂不加入组织</option>${s.data.organizations.map((r) => `<option value="${esc(r.id)}" ${f.organization_id === r.id ? "selected" : ""} ${r.status !== "active" ? "disabled" : ""}>${esc(r.name)}${r.status !== "active" ? "（已停用）" : ""}</option>`).join("")}</select><small>选项来自本次筛选后的组织结果，最多200项；已停用不可选。</small></label>${f.organization_id ? `<label for="organization_role_code">组织角色<select id="organization_role_code"><option value="member" ${f.organization_role_code === "member" ? "selected" : ""}>普通成员</option><option value="organization_admin" ${f.organization_role_code === "organization_admin" ? "selected" : ""}>组织管理员</option></select></label>` : ""}</fieldset></div><footer class="dialog-footer"><button type="button" id="cancel-create">取消</button><button class="primary" id="confirm-create" ${s.write ? "disabled" : ""}>${s.write ? "创建中…" : "确认创建"}</button></footer></form>`;
    d.querySelectorAll("input,select").forEach((n) => {
      n.addEventListener("input", () => {
        s.form[n.id] = n.value;
      });
      n.addEventListener("change", () => {
        s.form[n.id] = n.value;
        if (n.id === "organization_id") {
          drawCreate();
          d.querySelector("#organization_id").focus();
        }
      });
    });
    d.querySelector("#cancel-create").onclick = close;
    d.querySelector("#user-form").onsubmit = (e) => {
      e.preventDefault();
      create();
    };
  }
  function body() {
    return {
      ...s.form,
      organization_id: s.form.organization_id || null,
      platform_role_code: s.form.platform_role_code || null,
    };
  }
  function create() {
    if (s.write) return;
    s.createError = "";
    s.write = { id: ++sequence, owner: dialogOwner, body: body() };
    s.intents.push({ method: "POST", path: "/platform/accounts/users", body: clone(s.write.body) });
    drawCreate();
    if (s.writeMode !== "hold") completeWrite(s.writeMode);
  }
  function completeWrite(result = "success", id = s.write?.id) {
    const request = s.write;
    if (!request || id !== request.id) return false;
    s.write = null;
    const current = s.active && request.owner === dialogOwner && s.dialog === "create";
    if (!current && s.active && s.dialog === "create") {
      const confirm = document.querySelector("#confirm-create");
      if (confirm) {
        confirm.disabled = false;
        confirm.textContent = "确认创建";
      }
    }
    if (result === "error") {
      if (current) {
        s.createError = "创建失败，输入已保留。核对后重试。";
        drawCreate();
      }
      return true;
    }
    s.message = "账号已创建；首次登录必须修改临时密码，平台管理员还必须绑定 MFA。";
    s.intents.push({
      method: "GET",
      path:
        "/platform/accounts?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries({ query: s.query.trim(), status: s.status }).filter(([, v]) => v),
          ),
        ),
    });
    if (result === "refresh_error") s.error = "write_refresh_error";
    if (current) {
      close();
      render();
      document.querySelector("#create-user").focus();
    }
    // A late result must not close or repaint a newer creation form; real write remains acknowledged in state.
    return true;
  }
  window.ACCOUNT_OVERVIEW_C = {
    scenes,
    scene,
    state: () => clone(s),
    read,
    completeRead,
    completeWrite,
    openCreate,
    create,
    close,
    setReadMode: (m) => {
      s.readMode = m;
    },
    setWriteMode: (m) => {
      s.writeMode = m;
    },
    leave: () => {
      owner++;
      dialogOwner++;
      s.active = false;
      s.pending = null;
      document.querySelector("#modal")?.close();
      s.dialog = null;
    },
    activate: () => {
      s.active = true;
    },
  };
  scene();
})();
