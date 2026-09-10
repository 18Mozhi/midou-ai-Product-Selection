# P34 手机首次500失败 · 已批准白色区域的真实Vue实施

2026-09-10，基线main / d815f74b57bfdb5eb7ea514098fd948d129c8133。按[用户局部批准](P34-MOBILE-FIRST-FAILURE-COMPOSITION-APPROVAL.md)，实施首次失败白色恢复区；不扩大到其他父状态、顶部或整页。

## 实施范围与使用

仅当view=approvals、state=error、尚无data、最近读取失败HTTP状态=500且宽度不超过760px时生效。父组件新增的lastReadFailureStatus仅供呈现判断，不参与请求、权限或重试规则。其他4xx/5xx、401/403、后台刷新失败、有旧数据的失败、桌面和相邻页面保持原显示。

新增OrganizationApprovalFirstFailure：白底圆角恢复区、明确非空数据结论、折叠真实requestId和蓝色重新加载。接口真实userMessage与actionHint在主说明区保留，不用提案里的通用文字覆盖具体处理建议；无requestId时不显示空追踪入口，更不显示审核夹具标签。实际文案长度造成自然换行，不声称与静态占位文案逐像素相同。

按钮只emit reload，父仍调用原load()。加载开始后错误区撤下、刷新禁用，成功恢复原筛选；没有新增API、定时器、状态重试策略、登录、申请权限、复制或其他业务动作。原notice的alert角色保留；手机隐藏旧重复错误区及旧内联notice，桌面继续原样显示。新组件默认不显示，CSS仅在P34明确data标记与760px媒体范围启用。

局部颜色文件只声明作用于该组件的语义变量，未修改全站token。frontend-design用于还原获批区域的阅读层级、白色背景与蓝色恢复操作，Playwright复用已有依赖验证真实App/父子组件。

## 真实截图

[手机默认失败](../../output/playwright/p34-first-failure-vue/approvals-500-390.png) · [手机真实追踪展开](../../output/playwright/p34-first-failure-vue/approvals-trace-390.png) · [760px边界](../../output/playwright/p34-first-failure-vue/approvals-500-760.png) · [完整8图与证据](../../output/playwright/p34-first-failure-vue/evidence.json)

两个真实读取入口分别模拟500，错误说明和请求ID来自隔离HTTP响应，不是生产用户数据。原批准PNG和权限r1/r2图都未覆盖；本图是实施证据，不代表新的整页获批。

## 验证与证据维护

四断点390/760/761/1440共156检查、8张永久实图；两个Vite隔离进程分别使用提交前父组件和当前组件，52个内存像素对比覆盖顶部、桌面500、401/403/404/409/429/503、成功/后台500和成员/工作区初始500。基线图片不落盘。键盘Space恢复验证只发summary与approvals各一次，模板查询和无关URL键保留。无页面错误、未匹配/外部请求或业务写入。

完整父读取验证仍56失败恢复场景、712检查、64实图，已重采实际实现后的证据并补新组件/CSS传递来源。旧设计稿不重采：专用刷新器先反向移除精确获批呈现差异并逐字比对父源，再确认旧验证脚本只增加3个依赖来源；引用的26份旧证据保留除sourceHashes以外的全部内容和PNG。依赖图整体校验后更新来源，拒绝无关文件或未知中间值；这不是旧图全量重新验收。

首次来源刷新遇到嵌套证据引用，已停止并修正为先完整验证依赖图再写入；恢复只接受基线或已证明的目标哈希，没有放宽为任意漂移。当前控件合同新增F按钮54b14787946c2f69.1及C转发5ae31bc55551b1dc.1，均归入既有OG-RETRY；F追踪折叠479570dac45574ea.1归入OG-TECH。P29–P33明确将新父转发列为P34专属排除位置，各页业务动作数量不变。

```powershell
node scripts/verify-ui-phase2-org-approvals-first-failure-vue.mjs --smoke
node scripts/verify-ui-phase2-org-approvals-first-failure-vue.mjs --capture
node scripts/verify-ui-phase2-org-approvals-parent.mjs --capture
node scripts/refresh-ui-phase2-first-failure-bindings.mjs --write
node scripts/refresh-ui-phase2-first-failure-bindings.mjs
```

前两验证器提供默认不写图复验；第三命令重采实际父级，不是重采批准提案。刷新器专用于本次精确差异，不是通用绕过来源检查的工具。执行时使用现有依赖，服务自动探测空闲端口并在finally关闭。

## 未改与待办

顶部刷新、权限区域整体、r2措辞生产实施、其余父状态/目录详情及73页全站尚未完成。[手机首次限流白色区域](P34-MOBILE-RATE-LIMIT-COMPOSITION-APPROVAL.md)在本轮获得单独组合批准，原PNG和SHA固定；尚未接入真实Vue，不扩展本次500条件。API/OpenAPI、后端生产者/消费者、数据库、环境变量和依赖不变；不需要新增配置。未部署，目前无需重启；上线仍须按既有本地构建和宝塔流程，不能以本地通过代替生产验收。

## 提交前收尾

真实父级712项、局部156项与52项基线像素检查通过；P31既有控件54项、P32恢复94项复验通过。Vue类型检查、前端构建、254资产体积门、391文件静态检查、153必需文档门和运行文档一致性检查通过。102设计包、15069张原提案PNG来源/图像漂移均为0；审核入口双端的筛选、焦点、导出、来源关联、无横溢出及零页面错误通过。

全套单测曾发现P29隔离夹具缺少新增的呈现ref；仅补对应ref，既有断言不变，定向复测通过。随后除已通过且未变更的code-style-gate.test.mjs外，其余单元测试全量重跑通过；新改夹具、刷新器和测试文件另经Prettier检查通过。来源刷新器额外反向验证该夹具只有这一行变化，旧图和旧检查结果仍保留。未安装依赖，未启动生产服务；隔离Vite和审核浏览器均自动关闭，审核导出的临时下载已删除。8张新实图及证据、重采的父级实图是永久审核交付，不是待清理测试垃圾。
