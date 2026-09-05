import { dialogVariants, direction } from "./design-data.mjs";

const params = new URLSearchParams(location.search);
const board = params.get("board") || "tokens";
const variant = params.get("variant") || "confirm";
const app = document.querySelector("#app");

const frame = (no,title,subtitle,body) => `<main class="board"><header class="board-head"><div class="folio-no">${no}</div><div><p class="eyebrow">SCOUTOPS / SIGNAL LEDGER SYSTEM</p><h1>${title}</h1><p>${subtitle}</p></div><span class="version-tag">${direction.version}</span></header>${body}</main>`;

function tokens(){
  const swatches=direction.palette.map(([name,color])=>`<div class="swatch"><i style="background:${color}"></i><b>${name}</b><code>${color}</code></div>`).join("");
  return frame("S1","视觉语言：信号账页","来自选品团队的物理世界：研究纸、油墨、荧光批注、朱砂签章与可追溯账线。完全弃用旧版深色海洋、蓝紫渐变、圆角卡片和侧栏。",`<section class="board-grid"><article class="board-card wide"><h2>颜色只承担材料与语义</h2><div class="swatches">${swatches}</div></article><article class="board-card"><h2>中文编辑式字阶</h2><div class="type-spec"><span class="display">签署决定</span><span class="title">选品机会的结论标题</span><span class="body">正文承担证据解释、影响范围和明确的下一步。正文以无衬线保证密集数据可读。</span><span class="meta">SOURCE / VERIFIED / 11:24 / OP-284</span></div></article><article class="board-card"><h2>4px 空间基线</h2><div class="spacing-ruler">${[4,8,12,16,24,32].map(n=>`<i style="height:${n*2+20}px">${n}</i>`).join("")}</div><p>紧凑工具区 12px；账页段落 16–24px；主叙事区 32px。圆角固定为 0，层级只由纸张、账线和内容密度产生。</p></article><article class="board-card wide"><h2>产品签名：信号带 + 决策签章</h2><div class="signature-demo"><div><span>当前范围</span><strong>米多贸易 / 新品工作区</strong></div><div style="background:var(--signal)"><span>NEXT DECISION</span><strong>利润依据缺失，先创建补采任务</strong></div><div><span>SIGN-OFF</span><strong style="color:var(--vermillion)">待签署 / OP-284</strong></div></div></article></section>`);
}

function buttons(){
  const line=(label,cls="")=>`<div class="button-line"><button class="btn ${cls}">${label}</button><button class="btn ${cls} hover-state">悬停</button><button class="btn ${cls} focus-state">键盘聚焦</button><button class="btn ${cls}" disabled>不可用</button><button class="btn ${cls}"><i class="loading-mark"></i>处理中</button></div>`;
  return frame("S2","按钮：行动块而非装饰胶囊","所有按钮使用矩形边界与明确动词；一个页面只有一个朱砂主行动。44px 是最小触控热区，按下缩放 0.97。",`<section class="board-card" style="margin-top:24px"><div class="button-section"><p class="eyebrow">01 / PRIMARY ACTION</p><h2>唯一主行动</h2><p>用于签署决定、创建选品、提交审批。箭头表示完成后进入下一业务节点。</p>${line("创建选品","btn-primary")}</div><div class="button-section"><p class="eyebrow">02 / SIGNAL ACTION</p><h2>上下文提示行动</h2><p>用于补齐资料、处理待办，不与全页主行动竞争。</p>${line("补齐利润依据","btn-signal")}</div><div class="button-section"><p class="eyebrow">03 / SECONDARY</p><h2>可逆次操作</h2><p>筛选、查看、保存草稿、导出等可逆动作。</p>${line("查看来源记录")}</div><div class="button-section"><p class="eyebrow">04 / DESTRUCTIVE</p><h2>高影响动作</h2><p>暂停、删除、回滚均进入“影响清单 + 签章确认”。</p>${line("暂停组织","btn-danger")}</div><div class="button-section"><p class="eyebrow">05 / QUIET & ICON</p><h2>低权重与图标操作</h2><div class="button-line"><button class="btn btn-quiet">取消</button><button class="btn-link">查看完整记录 →</button><button class="icon-action" aria-label="关闭">×</button><button class="icon-action" aria-label="更多操作">•••</button></div></div></section>`);
}

function states(){
  const items=[
    ["01","正在核对真实数据","保留账页结构并写明正在读取的范围。","loading"],
    ["02","当前范围没有记录","解释为空原因，只提供有权限的下一步。","empty"],
    ["03","数据读取失败","保留已显示事实，给出恢复动作和关联编号。","error"],
    ["04","没有查看权限","不泄露对象信息，返回最近安全页面。","forbidden"],
    ["05","网络已经断开","页面保留最后核验时间，恢复后自动校对。","offline"],
    ["06","流程被来源阻断","说明阻断来源、已完成部分和负责人。","blocked"],
    ["07","会话已经过期","明确未保存输入是否保留，再引导登录。","expired"],
    ["08","连接已经恢复","确认同步范围和更新时间，无需手动刷新。","recovered"],
  ];
  return frame("S3","状态：每个中断都有恢复路径","状态不是空白页；每一种状态必须同时回答发生了什么、影响什么、保留了什么、现在能做什么。",`<section class="state-grid">${items.map(([no,title,copy,type])=>`<article class="state-card ${type}"><div class="state-code">${no}</div><div class="state-body"><p class="eyebrow">${type.toUpperCase()}</p><h2>${title}</h2><p>${copy}</p><button class="btn ${type==="error"||type==="blocked"?"btn-primary":""}">${type==="empty"?"创建第一条":type==="forbidden"?"返回安全页面":type==="expired"?"重新登录":type==="offline"?"再次连接":"重新核对"}</button></div></article>`).join("")}</section>`);
}

function dialog(){
  const item=dialogVariants.find(([id])=>id===variant)||dialogVariants[0];
  const [id,kind,title,copy,impact,action]=item;
  const danger=id==="confirm"||id==="credential";
  let content=`<div class="field"><label>${id==="reason"?"变更理由":id==="credential"?"敏感内容":"确认信息"}</label><textarea placeholder="只输入完成当前动作所需的信息"></textarea></div>`;
  if(id==="wizard") content=`<div class="mini-steps"><div class="mini-step active"><b>01</b>组织身份</div><div class="mini-step active"><b>02</b>首位管理员</div><div class="mini-step"><b>03</b>最终签收</div></div><div class="field" style="margin-top:14px"><label>管理员邮箱</label><input value="admin@example.com" /></div>`;
  if(id==="preview"||id==="source") content=`<div class="modal-review"><div class="review-pane"><span>当前版本 / CURRENT</span><b>${id==="preview"?"市场权重 20% · 命中 12 条":"频率 30 分钟 · 超时 60 秒"}</b></div><div class="review-pane new"><span>候选版本 / PROPOSED</span><b>${id==="preview"?"市场权重 28% · 命中 18 条":"频率 15 分钟 · 超时 90 秒"}</b></div></div>`;
  if(id==="filter") content=`<div class="choice-row"><button class="choice active"><b>待评估</b><span>18 条</span></button><button class="choice active"><b>利润 ≥ 25%</b><span>24 条</span></button><button class="choice"><b>风险低</b><span>9 条</span></button></div>`;
  if(id==="detail"||id==="task"||id==="message") content=`<div class="modal-review"><div class="review-pane"><span>上下文</span><b>${id==="detail"?"证据字段缺失来源时间":id==="task"?"机会 OP-284 / 缺少头程费用":"组织管理员 / 站内 + 邮件"}</b></div><div class="review-pane new"><span>下一步</span><b>${action}</b></div></div>`;
  return `<main class="dialog-stage"><div class="dialog-underlay"><section class="page-wrap"><header class="folio-head"><div class="folio-no">42</div><div class="folio-main"><p class="eyebrow">ORGANIZATION LEDGER</p><h1>组织详情</h1><p class="job">查看组织状态、边界与关键治理记录</p></div></header></section></div><div class="dialog-scrim"></div><dialog open class="decision-modal"><header class="modal-head"><span class="modal-index">${String(dialogVariants.indexOf(item)+1).padStart(2,"0")}</span><div class="modal-title"><p class="eyebrow">${kind}</p><h1>${title}</h1></div><button class="modal-close" aria-label="关闭">×</button></header><p class="modal-copy">${copy}</p><div class="impact-manifest"><span>影响清单 / IMPACT</span><strong>${impact}</strong></div><div class="modal-content">${content}</div><details class="tech-fold"><summary>展开技术与审计字段</summary><p class="mono">request_id · scope · object_id · version</p></details><footer class="modal-footer"><span class="risk-note">${danger?"此动作不可直接撤销":"保存失败时保留当前输入"}</span><div class="actions"><button class="btn">取消</button><button class="btn ${danger?"btn-danger":"btn-primary"}">${action}</button></div></footer></dialog></main>`;
}

app.innerHTML=board==="tokens"?tokens():board==="buttons"?buttons():board==="states"?states():dialog();
