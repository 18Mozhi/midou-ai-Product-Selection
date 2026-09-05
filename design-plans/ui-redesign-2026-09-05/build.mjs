import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeSpec, dialogVariants, direction } from "./assets/design-data.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,"../..");
const catalog=JSON.parse(await readFile(path.join(repo,"apps/web/src/route-catalog.generated.json"),"utf8"));
const routes=catalog.routes;
const webSource=path.join(repo,"apps/web/src");
const mobileOnly=process.argv.includes("--mobile-only");
const slug=(value)=>value==="/"?"root":value.replace(/^\//,"").replaceAll("/","__").replaceAll(":","").replace(/[()*]/g,"").replaceAll(".","-");
const clean=(value)=>value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().replaceAll("|","\\|");
const lineAt=(source,index)=>source.slice(0,index).split("\n").length;
const rel=(value)=>value.split(path.sep).join("/");

for(const folder of ["screens/desktop","screens/mobile","boards"]) await mkdir(path.join(here,folder),{recursive:true});
await writeFile(path.join(here,"assets/catalog.generated.mjs"),`export const routes = ${JSON.stringify(routes,null,2)};\n`,"utf8");

async function listVue(root){
  const entries=await readdir(root,{withFileTypes:true}),out=[];
  for(const entry of entries){const full=path.join(root,entry.name);if(entry.isDirectory())out.push(...await listVue(full));else if(entry.name.endsWith(".vue"))out.push(full)}
  return out;
}

const buttons=[],dialogs=[];
for(const file of await listVue(webSource)){
  const source=await readFile(file,"utf8"),fileName=rel(path.relative(repo,file));
  for(const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
    const attrs=match[1],body=clean(match[2]),aria=attrs.match(/aria-label="([^"]+)"/)?.[1],dynamic=attrs.match(/:aria-label="([^"]+)"/)?.[1];
    const label=body||aria||(dynamic?`动态：${dynamic}`:"图标按钮（需运行时名称）");
    const role=/danger|destructive|delete|删除|停用|暂停|回滚/.test(`${attrs} ${label}`)?"高影响":/primary|submit/.test(attrs)?"主/提交":/icon|aria-label/.test(attrs)&&!body?"图标":"次/上下文";
    buttons.push([buttons.length+1,`${fileName}:${lineAt(source,match.index)}`,label,role]);
  }
  for(const match of source.matchAll(/<(dialog)\b([^>]*)>|<[^>]+role="dialog"[^>]*>/g)){
    const nearby=source.slice(match.index,match.index+900),title=clean(nearby.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/)?.[1]||match[0].match(/aria-label="([^"]+)"/)?.[1]||"动态弹窗");
    const kind=/Credential|凭证|密钥/.test(`${fileName} ${title}`)?"敏感资产":/Reason|理由|审核/.test(`${fileName} ${title}`)?"审计批注":/Create|Wizard|创建/.test(`${fileName} ${title}`)?"分段创建":/Detail|详情/.test(`${fileName} ${title}`)?"记录卷宗":/Confirm|Delete|删除|暂停|回滚/.test(`${fileName} ${title}`)?"高影响签章":"业务面板";
    dialogs.push([dialogs.length+1,`${fileName}:${lineAt(source,match.index)}`,title||"动态弹窗",kind]);
  }
}

const pageRows=routes.map((route,index)=>{const spec=routeSpec(route),id=String(index+1).padStart(2,"0"),name=`${id}-${slug(route.path)}.png`;return `| ${id} | ${route.title} | \`${route.path}\` | ${route.shell||"公开/账号"} | ${spec.layout} | ${spec.focal} | [桌面](screens/desktop/${name}) / [移动](screens/mobile/${name}) |`});
await writeFile(path.join(here,"page-matrix.md"),`# ScoutOps 全新 UI 重构逐页矩阵\n\n- 路由依据：\`apps/web/src/route-catalog.generated.json\`\n- 设计方向：${direction.name}\n- 覆盖：${routes.length} 条真实路由，每条均有 1440px 桌面稿与 390px 移动稿。\n- 结构切割：无全局左侧栏、无旧卡片墙、无深海蓝/极光紫主题、无大圆角。\n\n| # | 页面 | 路由 | 角色 | 全新布局 | 页面焦点 | 设计图 |\n| --- | --- | --- | --- | --- | --- | --- |\n${pageRows.join("\n")}\n`,"utf8");

const pageAdvice=routes.map((route,index)=>{const s=routeSpec(route);return `## ${String(index+1).padStart(2,"0")} · ${route.title}（\`${route.path}\`）\n\n- 页面任务：${s.job}\n- 全新布局：${s.layout}；视觉焦点是“${s.focal}”。\n- 按钮：${s.recommendations[0]}\n- 布局：${s.recommendations[1]}\n- 细节与移动端：${s.recommendations[2]}\n`}).join("\n");
await writeFile(path.join(here,"FULL-RECOMMENDATIONS.md"),`# ScoutOps 全套 UI / 布局 / 样式 / 效果重构建议\n\n## 0. 重构结论\n\n本稿不是旧 UI 的换色或微调。旧版的深色海洋主题、蓝紫强调、固定左侧栏、等权指标卡、圆角面板、证据轨构图全部停用。新方向“${direction.name}”把产品定义为跨境选品团队的决策编辑台：市场噪声进入信号目录，真实资料进入账页，最终动作以可追溯签章完成。\n\n## 1. 全局设计语言\n\n- **使用者**：刚看完市场/竞品/供应链变化，马上要分配任务、审批或记录决定的选品经理、采购成员和治理人员。\n- **物理隐喻**：研究纸、油墨、荧光批注、朱砂签章、版本账线。\n- **产品签名**：页面上方的“信号带”持续显示范围、核验时间、待处理量和数据状态；高影响动作进入“影响清单 + 决策签章”。\n- **导航**：桌面从左侧树形栏改为顶部身份条和横向模块索引；页面内部只显示当前任务的章节索引。\n- **布局**：列表使用连续账页；详情使用卷宗；规则使用版本簿；管理端使用异常优先的运营台账。\n- **视觉**：米白纸张为主，油墨黑建立层级，朱砂仅用于唯一主行动，荧光绿只标出当前范围与待决事项。\n- **字体**：中文衬线承担标题和结论，无衬线承担正文与控件，等宽字体承担编号、时间、版本和状态。\n- **边界**：0 圆角、无渐变、无装饰性阴影；结构由账线、纸张层和密度变化形成。\n\n## 2. 组件与交互合同\n\n- 主按钮每页最多 1 个，44px 最小热区，文案使用动作 + 对象，完成后进入下一节点时显示箭头。\n- 次按钮不使用品牌色；危险按钮使用深红并强制进入影响确认，不用普通浏览器 confirm。\n- 输入框使用内嵌灰纸层；错误、帮助、字符限制紧贴字段，不在页面顶部统一堆放。\n- 列表筛选、选中数量、批量操作与结果总数保持同一视觉水平线；移动端变成全屏筛选页。\n- 弹窗不使用圆角悬浮卡片，统一为“编号、动作标题、影响清单、输入/校样、审计字段、操作区”。\n- 加载、空、错、无权限、离线、受阻、会话过期、恢复八态都必须说明影响、保留内容和恢复动作。\n- 动效只使用 opacity/transform：按钮 120–160ms，面板 220ms；高频表格和命令入口不做入场动效。\n\n## 3. 响应式合同\n\n- 1440px：身份条 + 横向模块索引；内容最大宽度 1380px；主次区域按页面任务不对称分配。\n- 390px：页面变成行动卷轴；数据表变成字段化记录；详情签章区移到正文之后；底部命令坞固定 4 个高频入口 + 更多。\n- 触控目标不小于 44×44px；固定底栏预留安全区；标题、操作区、长路由和技术编号不得造成横向滚动。\n\n## 4. 逐页建议\n\n${pageAdvice}\n## 5. 审核后实施顺序\n\n1. 先锁定全局导航、令牌、按钮、表单、状态和弹窗合同。\n2. 再实现登录/范围选择、今日行动、机会列表与详情四条首要流程。\n3. 然后迁移成员、组织治理和平台运营页面模板。\n4. 最后跑现有桌面/390px E2E、无障碍、构建和真实路由验收，并同步蓝图与 Feature Map。\n`,"utf8");

const linkFor=(loc)=>{const [file,line]=loc.split(":");return `[${loc}](${path.posix.join("../..",file)}#L${line})`};
await writeFile(path.join(here,"button-inventory.md"),`# 按钮逐项清单\n\n扫描到 ${buttons.length} 个真实 \`<button>\`。所有按钮保留现有业务语义，但视觉统一进入“行动块”系统：默认、悬停、键盘聚焦、按下、禁用、处理中六态；44px 最小热区；图标按钮必须有可读名称。完整图见 [按钮系统](boards/button-system.png)。\n\n| # | 源码位置 | 当前文字或表达式 | 新层级 |\n| --- | --- | --- | --- |\n${buttons.map(([id,loc,label,role])=>`| ${id} | ${linkFor(loc)} | ${label} | ${role} |`).join("\n")}\n`,"utf8");
await writeFile(path.join(here,"dialog-inventory.md"),`# 弹窗逐项清单\n\n扫描到 ${dialogs.length} 个 \`<dialog>\` / \`role="dialog"\` 实例。统一重构为“编辑式决策面板”，要求：动作标题、影响清单、取消可达、Esc 语义、失败留在原位、技术字段折叠。10 类完整图位于 \`boards/dialog-*.png\`。\n\n| # | 源码位置 | 当前标题 | 新面板类型 |\n| --- | --- | --- | --- |\n${dialogs.map(([id,loc,title,kind])=>`| ${id} | ${linkFor(loc)} | ${title} | ${kind} |`).join("\n")}\n`,"utf8");

await writeFile(path.join(here,"README.md"),`# ScoutOps 全新 UI 重构审核包\n\n## 审核入口\n\n启动静态服务后打开 \`index.html\`。审核台包含 ${routes.length} 个真实路由的桌面与移动稿、3 张基础系统板和 ${dialogVariants.length} 张弹窗板。\n\n## 这版与旧版的关系\n\n旧版视觉和布局不作为继承基础。本包重新定义导航、页面模板、颜色、字体、按钮、表单、状态、弹窗和移动端结构；只保留真实路由、业务任务、权限范围与按钮/弹窗源码清单作为事实依据。\n\n## 建议审核顺序\n\n1. \`boards/design-system.png\`：先确认整体风格是否彻底脱离旧版。\n2. \`screens/desktop/12-home.png\`、\`15-opportunities.png\`、\`18-opportunities__opportunityId.png\`：确认首页、列表和详情三种核心构图。\n3. \`screens/mobile/12-home.png\` 与 \`18-opportunities__opportunityId.png\`：确认移动端不是桌面缩小版。\n4. \`boards/button-system.png\`、\`state-system.png\` 与 10 张弹窗板：确认细节合同。\n5. 再按审核台筛选逐页查看 73 条路由。\n\n## 文件说明\n\n- \`FULL-RECOMMENDATIONS.md\`：全局与逐页优化建议。\n- \`page-matrix.md\`：路由、角色、全新布局、焦点和图片索引。\n- \`button-inventory.md\`：每一个真实按钮的源码位置和新层级。\n- \`dialog-inventory.md\`：每一个真实弹窗的源码位置和新类型。\n- \`screens/desktop\` / \`screens/mobile\`：逐路由设计图。\n- \`boards\`：视觉、按钮、状态与弹窗设计板。\n\n## 重新生成与验证\n\n\`node design-plans/ui-redesign-2026-09-05/build.mjs\`\n\n\`node design-plans/ui-redesign-2026-09-05/verify.mjs\`\n+`,"utf8");

await writeFile(path.join(here,"README.md"),(await readFile(path.join(here,"README.md"),"utf8")).replace(/\n\+\s*$/,"\n"),"utf8");
const contentTypes={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".md":"text/markdown; charset=utf-8"};
const server=createServer(async(request,response)=>{try{const url=new URL(request.url,"http://127.0.0.1"),requested=decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname),file=path.resolve(here,`.${requested}`);if(!file.startsWith(here)||!existsSync(file))throw new Error("not found");response.writeHead(200,{"content-type":contentTypes[path.extname(file)]||"application/octet-stream"});response.end(await readFile(file))}catch{response.writeHead(404);response.end("not found")}});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});

async function capture(url,file,viewport,captureMobile=false){const page=await browser.newPage({viewport,deviceScaleFactor:1});await page.goto(url,{waitUntil:"networkidle"});if(captureMobile)await page.evaluate(()=>document.documentElement.classList.add("capture-shot"));await page.screenshot({path:file,fullPage:true});await page.close()}
for(let start=0;start<routes.length;start+=4){const batch=routes.slice(start,start+4);await Promise.all(batch.flatMap((route,offset)=>{const id=String(start+offset+1).padStart(2,"0"),name=`${id}-${slug(route.path)}.png`,url=`${base}/screen.html?route=${encodeURIComponent(route.path)}`;return mobileOnly?[capture(url,path.join(here,"screens/mobile",name),{width:390,height:844},true)]:[capture(url,path.join(here,"screens/desktop",name),{width:1440,height:1000}),capture(url,path.join(here,"screens/mobile",name),{width:390,height:844},true)]}));process.stdout.write(`pages ${Math.min(start+4,routes.length)}/${routes.length}\n`)}
for(const [board,file] of mobileOnly?[]:[["tokens","design-system.png"],["buttons","button-system.png"],["states","state-system.png"]]) await capture(`${base}/system.html?board=${board}`,path.join(here,"boards",file),{width:1440,height:1000});
for(const [id] of mobileOnly?[]:dialogVariants) await capture(`${base}/system.html?board=dialog&variant=${id}`,path.join(here,"boards",`dialog-${id}.png`),{width:1440,height:1000});
await browser.close();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
console.log(`generated ${mobileOnly?routes.length:routes.length*2+3+dialogVariants.length} images, ${buttons.length} buttons, ${dialogs.length} dialogs`);
