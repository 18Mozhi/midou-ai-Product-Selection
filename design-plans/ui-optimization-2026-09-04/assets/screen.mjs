import { routes } from "./catalog.generated.mjs";
import { routeSpec, shells, direction } from "./design-data.mjs";

const params = new URLSearchParams(location.search);
const path = params.get("route") || "/home";
const route = routes.find((item) => item.path === path) || routes.find((item) => item.path.includes("pathMatch"));
const spec = routeSpec(route);
document.title = `${spec.title} · ${direction.name}`;

const h = (tag, cls, content = "") => `<${tag}${cls ? ` class="${cls}"` : ""}>${content}</${tag}>`;
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function topbar() {
  return `<header class="topbar"><div class="brand"><span class="brand-mark">选</span><span>智能选品 <small>${spec.shell === "platform_admin" ? "平台治理" : spec.shell === "organization_admin" ? "组织治理" : "决策工作台"}</small></span></div><div class="scope"><span>${spec.shell === "platform_admin" ? "范围　平台全局" : "组织　米多贸易"}</span><span>${spec.shell === "platform_admin" ? "角色　平台管理员" : "工作区　新品决策"}</span></div><div class="top-actions"><button class="search-btn">⌕　搜索</button>${spec.shell !== "platform_admin" ? '<button class="btn-primary create-btn">＋ 创建选品</button>' : '<button class="btn-primary create-btn">＋ 新建组织</button>'}<button class="icon-btn" aria-label="通知">○</button><button class="icon-btn" aria-label="个人菜单">◎</button></div></header>`;
}

function sidebar() {
  const items = shells[spec.shell] || shells.account;
  return `<aside class="sidebar"><h2>${spec.shell === "platform_admin" ? "平台管理后台" : spec.shell === "organization_admin" ? "组织管理后台" : "成员工作台"}</h2><p>${spec.shell === "platform_admin" ? "平台角色授权范围" : "当前组织业务范围"}</p><nav class="nav">${items.map((item, i) => `<a class="${i === 0 || item === spec.title ? "active" : ""}" href="#">${esc(item)}</a>`).join("")}</nav></aside>`;
}

function evidenceRail() {
  return `<section class="evidence-rail" aria-label="证据轨"><div class="evidence-cell"><span>当前范围</span><strong>${spec.shell === "platform_admin" ? "平台全局 · 脱敏聚合" : "米多贸易 · 新品决策"}</strong></div><div class="evidence-cell"><span>主要来源</span><strong>${spec.path.includes("sourcing") ? "公开供应商页面" : spec.path.includes("competitor") ? "竞品快照" : "3 个已启用来源"}</strong></div><div class="evidence-cell"><span>新鲜度</span><strong>2 分钟前更新</strong></div><div class="evidence-cell"><span>可信度</span><strong style="color:var(--green)">已核验 · 86%</strong></div></section>`;
}

const metricData = [
  ["需要处理", spec.administrative ? "7" : "4", "+2 今日"], ["运行中", spec.administrative ? "18" : "6", "状态稳定"],
  ["数据新鲜度", "94%", "+3.2%"], ["风险项", spec.path.includes("security") ? "3" : "1", "需确认"],
];

function metrics() { return `<div class="metric-grid">${metricData.map(([a,b,c]) => `<div class="metric"><span>${a}</span><strong>${b}</strong><em>${c}</em></div>`).join("")}</div>`; }
function actionList() { return `<div class="action-list">${["补齐关键证据后再决定", "检查来源延迟并确认影响", "复核最近一次规则命中"].map((x,i)=>`<div class="action-row"><span class="signal">${i+1}</span><div><strong>${x}</strong><small>${spec.title} · ${i===0?"高优先级":"建议处理"}</small></div><time>${i+2} 分钟前</time></div>`).join("")}</div>`; }
function sections() { return `<div class="section-grid">${spec.sections.map((name,i)=>`<section class="card section-card"><span class="index">0${i+1} / ${i===0?"FOCUS":"CONTEXT"}</span><h3>${esc(name)}</h3><p>${i===0?"集中呈现需要立即判断的信息和明确下一步。":i===1?"展示来源、范围、版本与更新时间，不用记忆上一页。":"复杂内容按需展开，默认保持首屏安静。"}</p></section>`).join("")}</div>`; }
function table() { return `<section class="card table-card"><div class="table-head"><span>对象</span><span>状态</span><span>负责人</span><span>最近更新</span><span>操作</span></div>${["高增长居家收纳趋势", "AI 个护细分机会", "户外照明竞品变化", "供应商报价待确认", "采集来源质量问题"].map((name,i)=>`<div class="table-row"><div><strong>${name}</strong><small>${spec.title} · 真实范围内数据</small></div><span class="status ${i===3?"attention":""}">${i===3?"待确认":"已核验"}</span><span>${["陈宇航","林青","周可","未分配","平台运维"][i]}</span><span>${i+2} 分钟前</span><button class="btn-link">查看 →</button></div>`).join("")}</section>`; }
function toolbar() { return `<div class="toolbar"><input aria-label="搜索" placeholder="搜索${esc(spec.title)}中的名称、负责人或状态"><select><option>全部状态</option></select><select><option>最近 7 天</option></select><button>筛选</button></div>`; }
function detail() { return `<div class="split"><section class="card summary"><span class="pill">${spec.status}</span><h2>${spec.title}：高潜家居场景</h2><p>${spec.job}。当前结论基于 3 个来源、12 条不可变证据和最近一次成本版本。</p><div class="tabs"><button class="active">结论</button><button>证据</button><button>成本</button><button>风险</button></div>${actionList()}</section><aside class="card"><div class="card-head"><h2>决策摘要</h2><span class="pill">证据充分</span></div><div class="metric"><span>综合可信度</span><strong>86</strong><em>建议继续观察</em></div><div class="timeline" style="margin-top:16px"><div class="timeline-item"><i></i><div><strong>来源事实已更新</strong><p>2 分钟前 · 3 个来源</p></div></div><div class="timeline-item"><i></i><div><strong>利润仍缺 1 项成本</strong><p>需要人工补齐物流费</p></div></div></div></aside></div>`; }
function form() { return `<section class="card"><div class="stepper"><div class="step active"><b>STEP 01</b>${spec.sections[0]}</div><div class="step"><b>STEP 02</b>${spec.sections[1]}</div><div class="step"><b>STEP 03</b>${spec.sections[2]}</div></div><div class="form-grid"><div class="field"><label>名称</label><input value="${esc(spec.title)}示例"></div><div class="field"><label>负责人</label><select><option>陈宇航</option></select></div><div class="field full"><label>范围与说明</label><textarea>当前操作只作用于已显示的组织、工作区和业务对象。</textarea></div><div class="field"><label>生效时间</label><input value="立即生效"></div><div class="field"><label>审计原因</label><input placeholder="说明本次变更原因"></div></div></section>`; }
function topology() { return `<section class="card topology"><div class="node"><span>01 / TRAFFIC</span><h3>宝塔网站入口</h3><p>单一公开入口，展示最近心跳和业务影响。</p></div><i class="edge"></i><div class="node"><span>02 / CORE</span><h3>Node 统一后端</h3><p>API 与 Worker 的真实运行角色，不宣称多节点。</p></div><i class="edge"></i><div class="node"><span>03 / CRAWLER</span><h3>Python 采集</h3><p>登录型浏览器作业、档案租约与终态回执。</p></div></section>`; }
function dashboard() { return `${metrics()}<div class="dashboard-grid"><section class="card hero-card"><div><p class="eyebrow">TODAY / VERIFIED</p><h2>${spec.title}首先处理什么？</h2><p>${spec.job}，优先显示业务影响、证据质量和负责人。</p><button class="btn-primary">${esc(spec.primary)}</button></div><div class="signal-ring"><b>${spec.administrative?"7":"4"}</b></div></section><section class="card"><div class="card-head"><h2>优先行动</h2><span class="pill">实时</span></div>${actionList()}</section></div><div style="height:14px"></div>${sections()}`; }
function workbench() {
  if (["detail"].includes(spec.kind)) return detail();
  if (["wizard","settings","rules","checklist","release"].includes(spec.kind)) return `${metrics()}${form()}`;
  if (spec.kind === "topology") return topology();
  if (["dashboard","admin-dashboard","ops-dashboard"].includes(spec.kind)) return dashboard();
  return `${metrics()}${toolbar()}${table()}`;
}

function publicPage() {
  const isAuth = spec.kind === "auth";
  return `<main class="public-shell"><header class="public-head"><div class="brand"><span class="brand-mark">选</span><span>智能选品</span></div><span class="pill">${direction.name}</span></header><div class="auth-layout"><section class="auth-story"><p class="eyebrow">SIGNAL TO DECISION</p><h1>${isAuth ? "让增长，\n更有确定性" : esc(spec.title)}</h1><p>${esc(spec.job)}。每一步都保留范围、来源与下一步，不用猜测系统正在做什么。</p><div class="auth-points"><div class="auth-point">真实来源<br>不补造数据</div><div class="auth-point">明确范围<br>不混淆权限</div><div class="auth-point">安全恢复<br>不丢失上下文</div></div></section><section class="auth-card"><p class="eyebrow">${esc(spec.title)}</p><h2>${isAuth ? "欢迎回到智能选品" : esc(spec.focus)}</h2><p>${esc(spec.job)}</p>${spec.kind === "chooser" ? `<div class="chooser-grid"><div class="choice selected"><strong>米多贸易</strong><small>新品决策工作区 · 普通成员</small></div><div class="choice"><strong>我的选品空间</strong><small>仅本人可见 · 组织管理员</small></div></div>` : spec.kind === "onboarding" ? `<div class="stepper"><div class="step active"><b>01</b>输入信号</div><div class="step active"><b>02</b>查看证据</div><div class="step active"><b>03</b>作出决定</div></div>` : `<div class="field"><label>${spec.path.includes("reset")?"新密码":"账号（邮箱或用户名）"}</label><input placeholder="name@company.com 或用户名"></div><div class="field"><label>${spec.path.includes("forgot")?"验证方式":"密码"}</label><input type="password" placeholder="输入安全信息"></div>`}<div class="auth-actions"><button class="btn-primary">${esc(spec.primary)}</button><button>${esc(spec.secondary)}</button></div><div class="auth-links"><a href="#">安全说明</a><a href="#">需要帮助？</a></div></section></div></main>`;
}

function appPage() { return `<main class="app-frame">${topbar()}<div class="layout">${sidebar()}<section class="content"><header class="page-head"><div><div class="breadcrumb">${spec.shell === "platform_admin" ? "平台后台" : spec.shell === "organization_admin" ? "组织后台" : "决策工作台"}　/　${esc(spec.title)}</div><p class="eyebrow">${spec.administrative ? "GOVERNED WORKSPACE" : "DECISION WORKSPACE"}</p><h1>${esc(spec.title)}</h1><p class="job">${esc(spec.job)}</p></div><div class="head-actions"><button>${esc(spec.secondary)}</button><button class="btn-primary">${esc(spec.primary)}</button></div></header>${evidenceRail()}${workbench()}</section></div><nav class="bottom-nav"><a class="active" href="#">◇<br>${esc(spec.title.slice(0,4))}</a><a href="#">✓<br>任务</a><a href="#">↗<br>趋势</a><a href="#">◎<br>机会</a><a href="#">☰<br>更多</a></nav></main>`; }

document.querySelector("#app").innerHTML = spec.shell || spec.kind === "settings" && spec.path === "/me" ? appPage() : publicPage();
