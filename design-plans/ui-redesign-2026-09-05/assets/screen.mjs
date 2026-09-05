import { routes } from "./catalog.generated.mjs";
import { routeSpec, navGroups } from "./design-data.mjs";

const params = new URLSearchParams(location.search);
const routePath = params.get("route") || "/home";
const route = routes.find((item) => item.path === routePath) || routes[0];
const spec = routeSpec(route);
const app = document.querySelector("#app");
const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[char]);

const hash = [...route.path].reduce((total, char) => total + char.charCodeAt(0), 0);
const sample = (seed, floor, spread) => floor + ((hash + seed * 37) % spread);
const shellKey = route.shell || (route.path === "/me" ? "account" : null);
const nav = navGroups[shellKey] || [];

function brand() {
  return `<div class="brand-lockup"><span class="brand-seal">选</span><span>SCOUTOPS / 智能选品</span></div>`;
}

function topShell() {
  if (!shellKey) return "";
  const active = Math.min(nav.length - 1, Math.abs(hash) % Math.max(1, nav.length));
  return `<header class="identity-strip">${brand()}<div class="identity-scope"><span>${esc(spec.scope)}</span><i class="scope-rule"></i><span>${route.shell === "platform_admin" ? "平台运营管理员" : route.shell === "organization_admin" ? "组织管理员" : "选品经理"}</span></div><div class="identity-tools"><button class="tool-btn">⌕ 全局检索</button><button class="tool-btn alert">通知</button><button class="tool-btn">林 ▾</button></div></header><nav class="module-index" aria-label="主模块"><span class="index-brand">${route.shell === "platform_admin" ? "PLATFORM INDEX" : route.shell === "organization_admin" ? "GOVERNANCE INDEX" : "WORK LEDGER"}</span>${nav.map((item, index) => `<button class="nav-item ${index === active ? "active" : ""}"><span class="nav-num">${String(index + 1).padStart(2,"0")}</span>${item}</button>`).join("")}</nav>`;
}

function bottomDock() {
  if (!shellKey) return "";
  const labels = route.shell === "platform_admin" ? ["警戒","组织","采集","运行","更多"] : route.shell === "organization_admin" ? ["治理","成员","范围","审计","更多"] : ["今日","机会","任务","通知","更多"];
  return `<nav class="bottom-dock" aria-label="移动端命令坞">${labels.map((label,index)=>`<button class="dock-item ${index===0?"active":""}"><span class="dock-icon">${["⌂","◇","≡","○","＋"][index]}</span>${label}</button>`).join("")}</nav>`;
}

function folio() {
  const index = routes.indexOf(route) + 1;
  return `<header class="folio-head"><div class="folio-no">${String(index).padStart(2,"0")}</div><div class="folio-main"><p class="eyebrow">${esc(spec.layout)} · ${esc(route.path)}</p><h1>${esc(route.title)}</h1><p class="job">${esc(spec.job)}</p></div><div class="folio-actions"><button class="btn">${esc(spec.secondary)}</button><button class="btn btn-primary">${esc(spec.primary)}</button></div></header>`;
}

function tape() {
  return `<section class="signal-tape" aria-label="当前业务信号"><div class="tape-cell signal"><span>当前范围 / SCOPE</span><strong>${esc(spec.scope)}</strong></div><div class="tape-cell"><span>上次核验 / VERIFIED</span><strong>${sample(1,1,8)} 分钟前 · ${sample(2,2,5)} 个来源</strong></div><div class="tape-cell"><span>待处理 / QUEUE</span><strong>${sample(3,4,27)} 项 · ${sample(4,1,6)} 项今日到期</strong></div><div class="tape-cell ${sample(5,0,3)===0?"issue":""}"><span>数据状态 / DATA</span><strong>${sample(5,0,3)===0?"1 项需要复核":"可用于当前决定"}</strong></div></section>`;
}

const rows = [
  ["防晒服趋势升温", "东南亚站点 · 7 个来源", "+18.4%", "林然"],
  ["车载收纳袋机会", "美国站 · 利润资料待补", "74 / 100", "周宁"],
  ["便携榨汁杯竞品变化", "价格下调 6% · 2 小时前", "需复核", "陈嘉"],
  ["露营灯供应报价", "3 家供应商 · 含税价", "¥ 28.60", "唐敏"],
  ["宠物清洁工具", "证据完整 · 风险中等", "68 / 100", "罗宜"],
];

function decisionRows(count=5) {
  return rows.slice(0,count).map((row,index)=>`<article class="decision-row"><span class="row-index">${String(index+1).padStart(2,"0")}</span><div class="row-main"><strong>${row[0]}</strong><p>${row[1]}</p></div><div class="row-value"><strong>${row[2]}</strong><span class="status-mark ${index===2?"risk":index===1?"warn":""}">${index===2?"CHECK":index===1?"WAIT":"READY"}</span></div><span class="row-owner">${row[3]}<br/>${index+1}h 前</span></article>`).join("");
}

function desk() {
  return `${tape()}<div class="workspace"><section class="ledger-sheet"><header class="section-head"><div><p class="eyebrow">DECISION QUEUE</p><h2>${esc(spec.sections[0])}</h2></div><span class="section-count">05 / ${sample(6,12,38)}</span></header>${decisionRows()}</section><aside class="annotation-sheet"><section class="annotation urgent"><div class="label"><span>NEXT DECISION</span><b>01</b></div><h3>先补齐利润依据</h3><p>车载收纳袋已有市场与竞争证据，但头程费用仍使用旧版本。</p><span class="stamp">待签署</span></section><section class="annotation"><div class="label"><span>CHANGE NOTE</span><b>2 分钟前</b></div><h3>3 条信号跨过门槛</h3><p>排序变化来自真实来源更新，不含 AI 推断值。</p></section><section class="annotation"><div class="label"><span>DATA CHECK</span><b>86%</b></div><h3>来源可用</h3><p>最近一次采集完成；一个登录型来源等待续期。</p></section></aside></div>`;
}

function filters() {
  return `<section class="filters"><button class="filter"><span>查询 / SEARCH</span><strong>搜索标题、编号或负责人</strong></button><button class="filter"><span>状态</span><strong>需要处理 ▾</strong></button><button class="filter"><span>负责人</span><strong>全部成员 ▾</strong></button><button class="filter"><span>更新时间</span><strong>最近 7 天 ▾</strong></button><button class="btn btn-signal">筛选 · ${sample(7,12,44)}</button></section>`;
}

function table(kind="ledger") {
  const headers = kind === "audit" ? ["#","事件与对象","操作者","结果","发生时间"] : ["#",spec.sections[0],"状态","指标","负责人"];
  return `${filters()}<section class="ledger-sheet" style="margin-top:16px"><div class="bulk-strip"><b>已选 2 项</b><button class="btn">批量分配</button><button class="btn">导出选中</button><span style="margin-left:auto">共 ${sample(8,48,190)} 条</span></div><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row,index)=>`<tr><td>${String(index+1).padStart(2,"0")}</td><td class="title-cell">${kind==="audit"?["更新评分规则","导出组织数据","暂停采集来源","签署机会决定","邀请组织成员"][index]:row[0]}<br/><span style="color:var(--pencil);font-weight:400">${kind==="audit"?"对象 / "+["RULE-17","EXP-204","SRC-1688","OP-284","INV-038"][index]:row[1]}</span></td><td><span class="status-mark ${index===2?"risk":index===1?"warn":""}">${index===2?"需处理":index===1?"等待":"已核验"}</span></td><td class="metric">${kind==="audit"?["成功","已完成","已暂停","已记录","待接受"][index]:row[2]}</td><td>${kind==="audit"?["林然","周宁","陈嘉","唐敏","罗宜"][index]:row[3]}<br/><span style="color:var(--pencil)">${index+1}h 前</span></td></tr>`).join("")}</tbody></table></section>`;
}

function form() {
  return `<section class="form-sheet">${spec.sections.map((section,index)=>`<article class="form-step"><div class="step-no">${String(index+1).padStart(2,"0")}</div><div class="step-body"><p class="eyebrow">${index===0?"REQUIRED":index===1?"SCOPE":"CONFIRM"}</p><h2>${esc(section)}</h2><p>${["输入真实关键词、ASIN 或商品链接；系统不会用演示结果代替采集。","选择站点、时间范围和允许使用的来源。","核对预计时限、数据范围和失败后的恢复路径。"][index]}</p>${index===0?`<div class="field-grid"><div class="field wide"><label>选品输入</label><input value="便携露营灯" /></div><div class="field"><label>目标站点</label><select><option>Amazon US</option></select></div><div class="field"><label>归属负责人</label><select><option>林然</option></select></div></div>`:index===1?`<div class="choice-row"><button class="choice active"><b>公开市场信号</b><span>热点、搜索与竞品变化</span></button><button class="choice"><b>供应链报价</b><span>1688 与已有供应商</span></button><button class="choice"><b>内部判断</b><span>人工假设，明确标记</span></button></div>`:`<div class="impact-manifest"><span>首个真实结果</span><strong>P95 ≤ 180 秒；无结果或受阻会明确说明</strong></div>`}</div></article>`).join("")}<div style="display:flex;justify-content:flex-end;gap:8px;padding:18px 24px"><button class="btn">${esc(spec.secondary)}</button><button class="btn btn-primary">${esc(spec.primary)}</button></div></section>`;
}

function docket() {
  return `<section class="docket"><nav class="docket-index" aria-label="卷宗章节">${spec.sections.concat(["变更记录"]).map((item,index)=>`<button class="docket-tab ${index===0?"active":""}">${item}</button>`).join("")}</nav><article class="docket-copy"><p class="eyebrow">DECISION DOSSIER · OP-${sample(10,180,800)}</p><h2>${route.path.includes("task")?"采集任务正在等待来源登录":"建议进入小批量验证"}</h2><p class="lead">市场热度和竞争空档已达到当前工作区门槛；利润仍需使用最新头程费用复算。结论来自 7 条可追溯证据，AI 仅负责摘要。</p><div class="evidence-note"><b>市场信号 / 01</b><p>近 14 天搜索增速 18.4%，来自两个公开来源，最近核验于 11:24。</p></div><div class="evidence-note"><b>竞争变化 / 02</b><p>头部商品价格中位数稳定，评价增速下降，存在中档定位空间。</p></div><div class="evidence-note"><b>利润缺口 / 03</b><p>头程费用版本已超过 30 天，需要补齐后才能形成最终建议。</p></div></article><aside class="signature-panel"><p class="eyebrow">SIGN-OFF</p><h3>决定签章</h3><div class="impact-line"><span>当前建议</span><strong>小批量验证 / 200 件</strong></div><div class="impact-line"><span>依据完整度</span><strong>${sample(11,72,22)}% · 7 条证据</strong></div><div class="impact-line"><span>风险等级</span><strong>中等 · 1 项待补</strong></div><div class="impact-line"><span>决定后动作</span><strong>创建采购询价与补采任务</strong></div><span class="stamp">待签署</span><button class="btn btn-primary">${esc(spec.primary)}</button><button class="btn">${esc(spec.secondary)}</button></aside></section>`;
}

function rules() {
  return `${filters()}<div class="workspace"><section class="ledger-sheet"><header class="section-head"><div><p class="eyebrow">VERSION LEDGER</p><h2>${esc(spec.sections[0])}</h2></div><span class="section-count">V.08 / ACTIVE</span></header>${decisionRows(4)}</section><aside class="annotation-sheet"><section class="annotation urgent"><div class="label"><span>CANDIDATE VERSION</span><b>V.09</b></div><h3>权重调整待预演</h3><p>市场增速 +8%，供应稳定性 -8%；预计 18 条机会排序变化。</p><button class="btn" style="margin-top:14px;width:100%">查看前后差异</button></section><section class="annotation"><div class="label"><span>CHANGE OWNER</span><b>林然</b></div><h3>变更理由</h3><p>旺季前提高供应稳定性门槛，避免无法按期补货。</p></section></aside></div>`;
}

function matrix() {
  const rowsM=[["查看组织","●","●","●","●"],["修改成员","—","●","●","●"],["读取密钥","—","—","—","●"],["导出审计","—","○","●","●"],["重放任务","—","—","●","●"]];
  return `<div class="matrix-wrap"><section class="matrix-grid"><div class="matrix-cell head">能力 / 角色</div>${["普通成员","组织管理员","运营管理员","超级管理员"].map(x=>`<div class="matrix-cell head">${x}</div>`).join("")}${rowsM.flatMap(row=>row.map((cell,index)=>`<div class="matrix-cell ${index===0?"axis":cell==="●"?"yes":cell==="○"?"partial":"no"}">${cell}</div>`)).join("")}</section></div><section class="signal-tape"><div class="tape-cell signal"><span>图例</span><strong>● 允许 / ○ 条件允许 / — 拒绝</strong></div><div class="tape-cell"><span>影响成员</span><strong>${sample(12,34,140)} 人</strong></div><div class="tape-cell"><span>待发布版本</span><strong>V.12 · 1 项变化</strong></div><div class="tape-cell"><span>默认策略</span><strong>拒绝</strong></div></section>`;
}

function topology() {
  return `<section class="topology"><article class="node signal"><p class="eyebrow">ENTRY</p><h3>宝塔网站</h3><p>静态前端与反向代理<br/>midouai.medouai.com</p><span class="status-mark">正常</span></article><div class="connector">→</div><article class="node"><p class="eyebrow">NODE RUNTIME</p><h3>API + Worker</h3><p>单一宝塔 Node 项目<br/>MySQL / Redis 协调</p><span class="status-mark warn">关注队列</span></article><div class="connector">→</div><article class="node"><p class="eyebrow">PYTHON RUNTIME</p><h3>采集执行器</h3><p>宝塔 Python 项目<br/>受控浏览器采集</p><span class="status-mark">正常</span></article></section>${tape()}`;
}

function states() {
  return `<div class="workspace"><section class="ledger-sheet"><header class="section-head"><h2>状态核对入口</h2><span class="section-count">08 STATES</span></header>${decisionRows(5)}</section><aside class="annotation-sheet"><section class="annotation urgent"><h3>状态必须带下一步</h3><p>加载、空、错、无权限、离线、受阻和恢复都不能只显示一句技术文案。</p><span class="stamp">系统规则</span></section></aside></div>`;
}

function notFound() {
  return `<section style="min-height:560px;display:grid;place-items:center;text-align:center"><div><p class="eyebrow">RECOVERY PAGE · 404</p><div style="font:900 150px/.8 var(--serif);letter-spacing:-.09em;color:var(--rule-strong)">404</div><h2 style="font:800 34px var(--serif);margin:22px 0 8px">这张账页不存在</h2><p style="color:var(--pencil);max-width:480px;line-height:1.7">地址可能已经变更。已保留你的组织和工作区范围，可以安全返回最近页面。</p><div style="display:flex;justify-content:center;gap:8px;margin-top:22px"><button class="btn">${esc(spec.secondary)}</button><button class="btn btn-primary">${esc(spec.primary)}</button></div></div></section>`;
}

function auth() {
  const isChooser = spec.kind === "chooser" || spec.kind === "onboarding";
  return `<main class="auth-stage"><section class="auth-story">${brand()}<h1>${isChooser?"先定范围，\n再开始判断":"判断先于\n追逐热点"}</h1><p>${esc(spec.job)}。系统会保留真实来源、时间和责任人，不把摘要当成事实。</p><div class="auth-proof"><div><span>数据边界</span><strong>组织 / 工作区隔离</strong></div><div><span>来源原则</span><strong>真实记录可回溯</strong></div><div><span>安全策略</span><strong>默认拒绝</strong></div></div></section><section class="auth-form"><div class="auth-panel"><p class="eyebrow">${esc(spec.layout)} · ${esc(route.path)}</p><h2>${esc(route.title)}</h2><p>${esc(spec.job)}</p>${isChooser?`<div class="choice-row"><button class="choice active"><b>米多贸易</b><span>选品经理 · 4 个工作区</span></button><button class="choice"><b>个人空间</b><span>仅自己可见</span></button></div><div class="field" style="margin-top:14px"><label>工作区</label><select><option>新品决策 / Amazon US</option></select></div>`:`<div class="field"><label>${route.path.includes("mfa")?"6 位动态口令":"邮箱或用户名"}</label><input value="${route.path.includes("mfa")?"284 719":"linran@example.com"}" /></div><div class="field"><label>${route.path.includes("forgot")||route.path.includes("verify")?"验证说明":"密码"}</label><input type="${route.path.includes("forgot")||route.path.includes("verify")?"text":"password"}" value="${route.path.includes("forgot")?"将发送到已验证邮箱":"scoutops2026"}" /></div>`}<button class="btn btn-primary">${esc(spec.primary)}</button><div class="auth-meta"><button class="btn-link">${esc(spec.secondary)}</button><span>安全连接 · 请求已保护</span></div></div></section></main>`;
}

function body() {
  if (["auth","gateway","chooser","onboarding"].includes(spec.kind)) return auth();
  if (spec.kind === "form") return frame(form());
  if (spec.kind === "docket" || spec.kind === "approval") return frame(docket());
  if (spec.kind === "rules") return frame(rules());
  if (spec.kind === "matrix") return frame(matrix());
  if (spec.kind === "topology") return frame(topology());
  if (spec.kind === "states") return frame(states());
  if (spec.kind === "notfound") return frame(notFound());
  if (["ledger","explore","admin","audit","inbox","report"].includes(spec.kind)) return frame(table(spec.kind));
  return frame(desk());
}

function frame(content) {
  return `<main class="app-frame">${topShell()}<section class="page-wrap">${folio()}${content}</section>${bottomDock()}</main>`;
}

app.innerHTML = body();
