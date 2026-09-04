import { dialogVariants, direction } from "./design-data.mjs";
const params = new URLSearchParams(location.search), board = params.get("board") || "tokens", variant = params.get("variant") || "confirm";
const app = document.querySelector("#app");
const shell = (title, subtitle, body) => `<main class="board"><header class="board-head"><div><p class="eyebrow">${direction.name} / UI SYSTEM</p><h1>${title}</h1><p>${subtitle}</p></div><span class="pill">审核稿 v1</span></header>${body}</main>`;

function tokens(){
  const swatches = direction.palette.map(([name,color])=>`<div class="swatch"><i style="background:${color}"></i><strong>${name}</strong><code>${color}</code></div>`).join("");
  return shell("视觉系统与设计语言","克制的深海作业环境；颜色只承担行动、状态和风险语义。",`<section class="board-grid"><div class="board-card wide"><h2>颜色语义</h2><div class="swatches">${swatches}</div></div><div class="board-card"><h2>字体层级</h2><div class="type-stack"><b style="font-size:36px">页面标题 36 / 750</b><b style="font-size:24px">模块标题 24 / 700</b><span style="font-size:16px">正文与控件 16 / 400</span><small>元数据 13 / 500</small></div></div><div class="board-card"><h2>空间与圆角</h2><div class="spacing-demo"><i>4</i><i>8</i><i>12</i><i>16</i><i>24</i><i>32</i></div><p>4px 基线；控件 8px、卡片 12px、弹窗 18px。</p></div><div class="board-card wide"><h2>产品签名：证据轨</h2><section class="evidence-rail"><div class="evidence-cell"><span>当前范围</span><strong>米多贸易 · 新品决策</strong></div><div class="evidence-cell"><span>主要来源</span><strong>3 个已启用来源</strong></div><div class="evidence-cell"><span>新鲜度</span><strong>2 分钟前更新</strong></div><div class="evidence-cell"><span>可信度</span><strong style="color:var(--green)">已核验 · 86%</strong></div></section></div></section>`);
}
function buttons(){
  const states=(label,cls="")=>`<div class="button-line"><button class="${cls}">${label}</button><button class="${cls} hover">悬停</button><button class="${cls} focus">聚焦</button><button class="${cls}" disabled>不可用</button><button class="${cls}"><span class="spinner"></span>处理中</button></div>`;
  return shell("按钮与操作层级","每页一个高强调主操作；高频、危险、批量和图标操作均有独立语义。",`<section class="board-card"><div class="button-section"><h2>主操作</h2><p>页面目标的唯一强行动，例如“创建选品”“记录决策”。</p>${states("创建选品","btn-primary")}</div><div class="button-section"><h2>次操作</h2><p>查看、导出、保存筛选等可逆操作。</p>${states("查看详情")}</div><div class="button-section"><h2>危险操作</h2><p>停用、删除、回滚等必须进入影响确认。</p>${states("暂停组织","btn-danger")}</div><div class="button-section"><h2>文字与图标操作</h2><p>只用于低权重跳转；图标按钮必须始终有可读名称。</p><div class="button-line"><button class="btn-link">查看证据 →</button><button class="btn-quiet">取消</button><button class="icon-btn" aria-label="通知">○</button><button class="icon-btn" aria-label="更多操作">•••</button></div></div></section>`);
}
function states(){
  const items=[
    ["loading","正在读取真实数据","保留页面骨架，明确正在加载的对象。"], ["empty","当前范围暂无记录","解释为什么为空，并给出有权限的下一步。"],
    ["error","读取失败","说明影响范围、恢复动作与请求标识。"], ["forbidden","没有查看权限","保留当前位置，提供返回安全页面的入口。"],
    ["expired","登录状态已过期","说明未保存内容是否保留，再引导重新登录。"], ["offline","网络已断开","保留已显示事实，恢复后自动校对更新时间。"],
    ["blocked","流程被外部条件阻断","写清阻断来源、已完成部分和可执行动作。"], ["recovered","连接已恢复","确认数据已重新同步，不用用户手动刷新。"],
  ];
  return shell("页面状态系统","状态不是空白占位，而是带有范围、原因和恢复动作的工作节点。",`<section class="state-grid">${items.map(([type,title,copy],i)=>`<article class="state-card ${type}"><span class="state-icon">${["↻","○","!","×","⌛","⌁","Ⅱ","✓"][i]}</span><div><p class="eyebrow">${type}</p><h2>${title}</h2><p>${copy}</p><button class="${i===2||i===6?"btn-primary":""}">${i===1?"创建第一条":i===3?"返回上一页":i===4?"重新登录":i===5?"重试连接":i===7?"继续工作":"重新加载"}</button></div></article>`).join("")}</section>`);
}
function dialog(){
  const item=dialogVariants.find(x=>x[0]===variant)||dialogVariants[0];
  const danger=item[0]==="confirm"||item[0]==="credential";
  return `<main class="dialog-stage"><section class="underlay"><div class="topbar"><div class="brand"><span class="brand-mark">选</span><span>智能选品</span></div></div><div class="fake-page"><p class="eyebrow">WORKSPACE</p><h1>组织与平台治理</h1><div class="metric-grid"><div class="metric"><span>活动成员</span><strong>96</strong></div><div class="metric"><span>待处理</span><strong>7</strong></div><div class="metric"><span>风险项</span><strong>1</strong></div><div class="metric"><span>审计记录</span><strong>1,238</strong></div></div></div></section><div class="scrim"></div><dialog open class="modal"><header><div><p class="eyebrow">${item[1]}</p><h2>${item[2]}</h2></div><button class="icon-btn" aria-label="关闭">×</button></header><p class="modal-copy">${item[3]}</p><div class="impact"><span>影响范围</span><strong>${item[4]}</strong></div>${item[0]==="wizard"?'<div class="stepper"><div class="step active"><b>01</b>组织身份</div><div class="step active"><b>02</b>首位管理员</div><div class="step"><b>03</b>影响确认</div></div>':item[0]==="preview"?'<div class="diff"><del>权重 20% · 命中 12 条</del><ins>权重 28% · 命中 18 条</ins></div>':`<div class="field"><label>${item[0]==="reason"?"变更理由":item[0]==="credential"?"需要加密保存的内容":"确认信息"}</label><textarea placeholder="输入必要信息，不要求记忆上一页内容"></textarea></div>`}<details><summary>查看技术详情</summary><p class="mono">request_id · scope · version</p></details><footer><button class="btn-quiet">取消</button><button class="${danger?"btn-danger":"btn-primary"}">${danger?"确认并继续":"保存并继续"}</button></footer></dialog></main>`;
}
app.innerHTML=board==="tokens"?tokens():board==="buttons"?buttons():board==="states"?states():dialog();
