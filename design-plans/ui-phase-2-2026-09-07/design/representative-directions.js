"use strict";
// Explicitly selected facts from existing E2E fixtures; see representative-directions.md.
// This isolated prototype has no API adapter, browser storage, or business mutation.
const $ = (id) => document.getElementById(id);
const surfaces = {
  rules: {
    id: "P17",
    title: "评分规则",
    area: "决策工作区 / 规则治理",
    description: "先看规则差异，再决定下一步。评分解释不是自动决策。",
    list: "规则版本",
    hint: "把规则版本、证据配置与影响预览放在同一个工作面。",
    picks: [
      ["使用中", "当前生产评分规则", "org-v1 · 第 4 次修订"],
      ["草稿", "候选评分规则", "org-v2 · 第 1 次修订"],
    ],
  },
  roles: {
    id: "P31",
    title: "角色与权限",
    area: "组织治理 / 访问边界",
    description: "区分角色能力、数据范围与资源授权，不把它们混成一个开关。",
    list: "固定角色",
    hint: "先找到角色，再核对它能做什么。固定角色是只读目录，成员分配不在此修改。",
    picks: [
      ["固定模板", "组织管理员", "管理组织 · 管理成员"],
      ["固定模板", "审计员", "查看审计"],
    ],
  },
  status: {
    id: "P61",
    title: "系统状态",
    area: "运行观测 / 异常优先",
    description: "把异常与影响放在前面，保留每一条观测的时间和来源。",
    list: "需要关注",
    hint: "优先检查 Redis 警告和文件存储过期，再查看完整依赖。不是所有服务都已恢复。",
    picks: [
      ["警告", "Redis", "API 就绪、队列协调与实时通知"],
      ["观测过期", "文件存储", "证据保存、报表导出与采集回执"],
    ],
  },
};
const dimensions = [
  "市场需求",
  "竞争",
  "利润",
  "履约效率",
  "客户体验",
  "场景与内容适配",
  "风险",
  "数据质量",
];
let selected = null;
let roleView = "roles";
let refreshFailed = false;
let dialogKind = "";
let opener;
const badge = (text, warning = false) =>
  `<span class="badge${warning ? " warning" : ""}">${text}</span>`;
const action = (id, label, style = "") =>
  `<button type="button" data-action="${id}" class="${style}">${label}</button>`;
function services() {
  return `<div class="service-grid">${[
    ["Node API", "就绪", "0.1.0 · abcdef123456", "20:00", false],
    ["MySQL", "健康", "最近一次韧性检查", "20:00", false],
    ["Redis", "警告", "最近一次韧性检查", "19:59", true],
    ["文件存储", "观测过期", "最近一次存储检查", "18:00", true],
    ["Node Worker", "就绪", "1 个实例 · 1 个活动任务", "20:00", false],
    ["Python Crawler", "就绪", "1 个实例 · 0 个活动运行", "20:00", false],
  ]
    .map(
      ([name, state, detail, time, warning]) =>
        `<article class="service">${badge(state, warning)}<h3>${name}</h3><p>${detail}</p><time>2026-08-18 ${time} 北京时间</time></article>`,
    )
    .join("")}</div>`;
}
function rulesDetail() {
  const draft = selected === 1;
  return `<section class="card"><header class="section-head"><div>${badge(draft ? "草稿 / 未生效" : "使用中")}<h2>${draft ? "候选评分规则" : "当前生产评分规则"}</h2><p>${draft ? "org-v2 · 修订 1" : "org-v1 · 修订 4"}</p></div></header>
    <dl class="facts"><div><dt>推荐阈值</dt><dd>${draft ? 78 : 75}<small> / 100</small></dd></div><div><dt>观察阈值</dt><dd>${draft ? 58 : 55}<small> / 100</small></dd></div><div><dt>已配置维度</dt><dd>3<small> 个隔离样本维度</small></dd></div></dl>
    <h3>评分构成</h3><div class="weight-list">${[
      ["市场需求", 40],
      ["竞争", 30],
      ["利润", 30],
    ]
      .map(
        ([label, weight]) =>
          `<div class="weight-row"><span>${label}</span><i><b style="width:${weight}%"></b></i><strong>${weight}%</strong></div>`,
      )
      .join("")}</div>
    <div class="warning-box"><strong>配置仍有缺口</strong><p>样本未配置风险维度。此处提示缺失，不把不完整的配置渲染成已经就绪。</p></div>
    ${draft ? `<div class="actions">${action("preview", "查看影响预览")}${action("submit", "提交审批", "primary")}</div>` : `<p class="note">使用中版本不可直接编辑。创建新草稿后，沿现有审批与启用流程变更。</p>`}
    <p class="note">本方向稿展示当前样本的查看、新建及草稿提交；批准、驳回、启用、回滚及其他角色仍按 P17 完整规格补齐。</p></section>`;
}
function rolesDetail() {
  const auditor = selected === 1;
  return `<section class="card"><header class="section-head"><div>${badge("固定模板 / 只读")}<h2>${auditor ? "审计员" : "组织管理员"}</h2><p>本页不创建自定义角色，也不在前端改变权限。</p></div></header>
    <div class="scope-strip">当前会话数据范围：组织范围</div>
    <table class="matrix"><caption>能力对照 · 隔离样本只有两种角色</caption><thead><tr><th scope="col">业务能力</th><th scope="col">组织管理员</th><th scope="col">审计员</th></tr></thead><tbody><tr><th scope="row">管理组织</th><td>具备</td><td>未授予</td></tr><tr><th scope="row">管理成员</th><td>具备</td><td>未授予</td></tr><tr><th scope="row">查看审计</th><td>未授予</td><td>具备</td></tr></tbody></table>
    <p class="note">以上是所选角色目录中的能力，不代表成员最终可访问所有组织资源；实际访问还需后端数据范围与资源授权校验。</p>
    <div class="actions">${action("grants", "查看指定资源授权")}</div></section>`;
}
function grantsDetail() {
  return `<section class="card"><header class="section-head"><div>${badge("指定资源 / 非角色定义")}<h2>资源授权</h2><p>这是隔离夹具的历史状态，不是当前线上授权。</p></div>${action("grant", "＋ 新增授权", "primary")}</header>
    <div class="reason-summary"><h3>陈采购 · 选品机会</h3><p>采购团队核对供应报价</p></div>
    <dl class="facts"><div><dt>工作区</dt><dd><small>新品决策工作区</small></dd></div><div><dt>版本</dt><dd>1</dd></div><div><dt>样本有效期</dt><dd><small>2026-09-01 18:00 北京时间</small></dd></div></dl>
    <div class="actions">${badge("查看机会")}${badge("决策机会")}</div>
    <p class="note">最长 30 天。撤销只影响这一条指定资源授权，不改角色能力或数据范围。</p>
    <div class="actions">${action("revoke", "撤销此授权", "danger")}${action("roles", "返回角色目录")}</div></section>`;
}
function statusDetail() {
  const redis = selected === 0;
  return `<section class="card"><header class="section-head"><div>${badge(redis ? "依赖警告" : "观测过期", true)}<h2>${redis ? "Redis" : "文件存储"}</h2><p>观测于 2026-08-18 ${redis ? "19:59" : "18:00"} 北京时间</p></div>${action(refreshFailed ? "recover" : "refresh-fail", refreshFailed ? "重试刷新" : "演示刷新失败", "primary")}</header>
    ${refreshFailed ? `<div class="warning-box failure" role="alert"><strong>刷新未成功</strong><p>已保留上次成功的数据，以下观测不代表新的检查结果。可以重试，不需要离开当前异常。</p></div>` : ""}
    <div class="warning-box"><strong>影响范围</strong><p>${redis ? "API 就绪、队列协调、限流与实时通知；同时关联 Node Worker 与 Python Crawler。" : "证据保存、报表导出与采集回执暂存；同时关联 Node Worker 与 Python Crawler。"}</p></div>
    <h3>完整依赖快照</h3><p class="note">刷新恢复只代表读取成功，不会把依赖的 warning 或 stale 改成健康。</p>${services()}
    <p class="note">目标入口：${redis ? "/platform-admin/redis" : "/platform-admin/files"}。此原型不跳转线上管理页，不提供服务启停或恢复操作。</p></section>`;
}
function render() {
  const key = $("surface").value;
  const surface = surfaces[key];
  const brief = $("direction").value === "brief";
  const mobile = matchMedia("(max-width:800px)").matches;
  document.body.dataset.direction = $("direction").value;
  $("page-title").textContent = surface.title;
  $("area-label").textContent = surface.area;
  $("page-description").textContent = surface.description;
  $("spec-link").href = `../page-specs/${surface.id}.md`;
  document
    .querySelectorAll("[data-surface]")
    .forEach((node) =>
      node.setAttribute("aria-current", node.dataset.surface === key ? "page" : "false"),
    );
  const showDetail = selected !== null;
  $("main").innerHTML =
    `<div class="toolbar"><p>${brief ? "B / 全宽概览，进入后专注当前事项" : "A / 对象队列与详情并读，减少来回跳转"}</p>${key === "rules" ? action("create", "新建草稿", "primary") : key === "roles" ? action("grants", "指定资源授权") : ""}</div>
    <div class="workbench"><section class="explorer" ${showDetail && (brief || mobile) ? "hidden" : ""}><div class="explorer-head"><h2>${surface.list}</h2><span>02</span></div>${surface.picks.map(([state, title, subtitle], index) => `<button type="button" class="pick" data-pick="${index}" aria-pressed="${selected === index}">${badge(state, key === "status")}<strong>${title}</strong><small>${subtitle}</small><span class="pick-arrow" aria-hidden="true">→</span></button>`).join("")}</section>
    <section class="detail" ${!showDetail && brief ? "hidden" : ""}>${showDetail ? `${action("back", "← 返回目录", "back")}${key === "rules" ? rulesDetail() : key === "roles" ? (roleView === "grants" ? grantsDetail() : rolesDetail()) : statusDetail()}` : `<div class="empty-focus"><span class="small-mark" aria-hidden="true">↗</span><h2>${key === "rules" ? "让每次规则变更，都有清楚的依据。" : key === "roles" ? "先看清边界，再安排协作。" : "从异常开始，找到影响链路。"}</h2><p>${surface.hint}</p></div>`}</section></div>`;
}
function openDialog(kind, target) {
  dialogKind = kind;
  opener = target;
  $("form-feedback").hidden = true;
  $("preview-submit").hidden = kind === "preview";
  $("modal-title").textContent = {
    create: "新建评分规则草稿",
    preview: "规则影响预览",
    submit: "提交候选规则审批",
    grant: "新增指定资源授权",
    revoke: "撤销指定资源授权",
  }[kind];
  if (kind === "create") {
    $("modal-body").innerHTML =
      `<p class="note">不填默认阈值或权重；保存草稿不会自动生效。</p><div class="form-grid"><label>版本代码<input name="version_code" required /></label><label>规则名称<input name="name" required /></label><label>推荐阈值<input name="recommend" type="number" min="0" max="100" step="0.01" required /></label><label>观察阈值<input name="observe" type="number" min="0" max="100" step="0.01" required /></label></div><h3>配置评分维度</h3><p class="note">至少 2 个正权重维度、总和 100，至少 1 个必填。</p>${dimensions.map((name, index) => `<div class="dimension"><strong>${name}</strong><label>权重<input name="weight-${index}" aria-label="${name}权重" type="number" min="0" max="100" step="0.01" value="0" required /></label><label>证据组<select aria-label="${name}证据组"><option value="other">其他</option><option value="market">市场</option><option value="competition">竞争</option><option value="cost">成本</option></select></label><label>必填<input name="required-${index}" aria-label="${name}必填" type="checkbox" /></label></div>`).join("")}`;
  } else if (kind === "preview") {
    $("modal-body").innerHTML =
      `<div class="scope-strip">只读预览 · 本页 1 条隔离样本 · 未写入机会</div><h3>便携式智能净水杯机会</h3><div class="compare-score"><div><span>当前评分 / org-v1</span><strong>80.2</strong></div><b aria-hidden="true">→</b><div><span>预计评分 / org-v2</span><strong>78.4</strong></div></div><div class="warning-box"><strong>变化 −1.80</strong><p>推荐状态不变，证据覆盖 100%，样本缺失字段为空。</p></div><p class="note">只解释规则变化对已知样本的影响，不替代人工决策。其他分页及错误态仍待完善。</p>`;
  } else if (kind === "grant") {
    $("modal-body").innerHTML =
      `<p class="note">演示仅包含现有“选品机会”授权路径，其他资源类型按 P31 规格另补。</p><label>资源类型<select name="resource_type"><option value="opportunity">选品机会</option></select></label><label>资源编号<input name="resource_id" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}" placeholder="从真实资源详情复制 UUID" /></label><label>目标成员<select name="member" required><option value="">选择同组织活动成员</option><option value="00000000-0000-4000-8000-000000000612">陈采购 · 隔离样本</option></select></label><fieldset><legend>最小必要动作</legend><label class="check-option"><input type="checkbox" name="actions" value="opportunity:read" />查看机会</label><label class="check-option"><input type="checkbox" name="actions" value="opportunity:decide" />决策机会</label></fieldset><label>业务原因<textarea name="reason" required maxlength="500"></textarea></label><label>到期时间<input name="expires_at" type="datetime-local" required /></label><p class="note">时间必须晚于当前且不超过 30 天。本表不创建真实授权。</p>`;
  } else {
    $("modal-body").innerHTML =
      `<div class="reason-summary"><h3>${kind === "submit" ? "候选评分规则 · org-v2" : "陈采购 · 选品机会授权"}</h3><p>${kind === "submit" ? "提交后等待有权限的人员审批，不会自动启用。" : "只撤销这一条指定资源授权；不会修改角色模板。"}</p></div><label>业务原因<textarea name="reason" required maxlength="500"></textarea></label>`;
  }
  $("modal").showModal();
  const initial = $("modal-body").querySelector("input,textarea,select");
  (initial || $("close-modal")).focus();
}
$("main").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.pick !== undefined) {
    selected = Number(button.dataset.pick);
    roleView = "roles";
    render();
    $("main").querySelector(".back").focus();
    return;
  }
  const command = button.dataset.action;
  if (["create", "preview", "submit", "grant", "revoke"].includes(command)) {
    openDialog(command, button);
    return;
  }
  if (command === "back") {
    const previous = selected;
    selected = null;
    render();
    $("main").querySelector(`[data-pick="${previous}"]`).focus();
  }
  if (command === "grants") {
    selected = 0;
    roleView = "grants";
    render();
  }
  if (command === "roles") {
    roleView = "roles";
    render();
  }
  if (command === "refresh-fail" || command === "recover") {
    refreshFailed = command === "refresh-fail";
    render();
    $("main")
      .querySelector(`[data-action="${refreshFailed ? "recover" : "refresh-fail"}"]`)
      .focus();
  }
});
$("modal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  let error = form.checkValidity() ? "" : "请补齐必填信息，并检查输入范围。";
  const data = new FormData(form);
  if (!error && data.has("reason") && !String(data.get("reason")).trim())
    error = "请填写业务原因。";
  if (!error && dialogKind === "create") {
    const weights = dimensions.map((_, index) => Number(data.get(`weight-${index}`)));
    if (!String(data.get("version_code")).trim() || !String(data.get("name")).trim())
      error = "请填写版本代码和规则名称。";
    else if (Number(data.get("recommend")) <= Number(data.get("observe")))
      error = "推荐阈值必须高于观察阈值。";
    else if (
      weights.filter((value) => value > 0).length < 2 ||
      Math.round(weights.reduce((sum, value) => sum + value, 0) * 100) / 100 !== 100
    )
      error = "至少配置 2 个正权重维度，权重总和必须为 100。";
    else if (!weights.some((value, index) => value > 0 && data.has(`required-${index}`)))
      error = "至少设置 1 个已启用维度为必填。";
  }
  if (!error && dialogKind === "grant") {
    if (!data.getAll("actions").length) error = "至少选择一个最小必要动作。";
    const remaining = new Date(String(data.get("expires_at"))).getTime() - Date.now();
    if (!(remaining > 0 && remaining <= 30 * 86400000))
      error = "到期时间必须晚于当前，且不超过 30 天。";
  }
  $("form-feedback").textContent =
    error || "预览校验通过；没有发送请求，没有保存或改变任何业务事实。";
  $("form-feedback").hidden = false;
  if (error) form.querySelector(":invalid")?.focus();
});
$("close-modal").addEventListener("click", () => $("modal").close());
$("cancel-modal").addEventListener("click", () => $("modal").close());
$("modal").addEventListener("close", () => opener?.focus());
$("modal").addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    $("modal").querySelectorAll(
      "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
    ),
  ).filter((node) => node.getClientRects().length);
  const first = focusable[0],
    last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
function reset() {
  selected = null;
  roleView = "roles";
  refreshFailed = false;
  render();
}
$("surface").addEventListener("change", reset);
$("direction").addEventListener("change", reset);
document.querySelectorAll("[data-surface]").forEach((node) =>
  node.addEventListener("click", () => {
    $("surface").value = node.dataset.surface;
    reset();
  }),
);
matchMedia("(max-width:800px)").addEventListener("change", render);
reset();
