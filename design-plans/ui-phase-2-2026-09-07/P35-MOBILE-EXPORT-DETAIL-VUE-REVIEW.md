# P35 手机导出详情 · 已批准组合的真实 Vue 实施

从干净 main/d401ec95 继续，依据[仅手机详情组合批准](P35-MOBILE-EXPORT-DETAIL-APPROVAL.md)。使用 frontend-design 将C稿的类型/状态、行数、两项时间与技术详情排列接入当前子组件；不是整页批准或生产发布。

[24张实际子Vue图册](../../output/playwright/p35-export-detail-vue/index.html) · [完整验证证据](../../output/playwright/p35-export-detail-vue/evidence.json)。数据来自原m06-01夹具；long/unknown/missing是明确合成的边界场景。不把截图示例当作真实组织或真实导出结果。

## 实际变更与使用

OrganizationDataPanel只增加根节点data-export-detail-c标记和惰性CSS引用，原script、模板数据绑定、10个动作位置完全不改。org-data-export-detail.css全部限定在max-width760与该标记内的导出列表；采用局部C色值、白底分隔、类型/名称/状态左列、行数右列、两项时间并列、原生details在下方。样式只影响列表存在时的手机详情，不改变桌面、工作区视图、筛选、空结果、分页和父级状态。

沿用原状态文字、count规则、row_count为null与0的区别、父fmt时间格式与ID。未知状态在样式上使用中性提示，不假装成功；不修改其原文字或筛选值。技术详情仍是原生summary，默认收起，Enter/Space/鼠标可开合；没有新增按钮、下载、API、文件URL、质量分或业务弹窗。

外观调整位置为apps/web/src/org-data-export-detail.css，局部变量前缀--export-detail-*；没有新增运行配置、环境变量或API字段。正常使用仍在/org-admin/data切到导出履历，手机查看记录并展开技术详情。

## 验证与保留边界

548项实际子Vue检查、24图、14项不可变d401ec95基线像素对比。使用相同main样式和真实Vue Router宿主，原父组件fmt表达式通过AST提取；虚拟基线SFC确实被加载，基线无新标记，因此不会误用新样式。390/760/761/1440检查工作区、空目录、筛选空；761/1440正常导出也逐像素不变。不是实际App/NavigationShell/父HTTP链、真实RBAC、SQL或生产验收。

11场景包括正常、原UI2零/null、长名称、未知类型/状态、缺失时间、queued/leased/retry_scheduled/succeeded/dead_letter/expired；另单独截取已完成0行，保证与尚未生成不是同一张图。手机检查白底、18px标题、16px操作文字、44px热区、各字段位置、页宽和字段内部不裁切。行数栏目检后补足96px最小阅读空间（窄列时不超过列宽），防止长状态文字紧贴边缘。长名称完整换行，不省略原名称。其他状态的新实图仍待用户审核。

所有场景键盘展开/收起、鼠标打开、原始数据及URL不变、零业务按钮/下载链接/弹窗、零API/外部请求与持久化存储检查通过。八项P35定向单测覆盖源差异、CSS范围、批准PNG、548/14/24证据和旧图保留。新增CSS范围测试曾因格式化换行误判选择器，修正为空白归一化后通过，不放宽选择器作用范围。

原94张布局图及192张控件图字节不变。两个旧evidence仅更新此子组件来源哈希；严格逆向差异先证明唯一变化为样式标记/引用，单测与d401ec95原清单比较，拒绝其他字段/PNG/批准变化。旧图依然是离线提案，不替代本批实际子Vue证据。

```powershell
node scripts/verify-ui-phase2-org-data-export-detail.mjs --smoke
node scripts/verify-ui-phase2-org-data-export-detail.mjs --capture
node scripts/verify-ui-phase2-org-data-export-detail.mjs
node --test tests/unit/ui-phase2-org-data-export-detail.test.mjs tests/unit/ui-phase2-org-data-controls.test.mjs
```

默认命令核对当前源/PNG哈希后重新执行；--capture更新独立24图，不授予批准。复用现有依赖；本地验证端口通过只读占用检查选择空闲端口后strictPort启动，不接管其他服务；Vite与浏览器均finally关闭。源码和样式最终确认后进行产品构建/预算、静态、文档和第二阶段单测收尾。

## 部署与未覆盖

未部署、未重启生产。本次只有前端样式，正式发布需本地构建并按既有python scripts/deploy-baota.py宝塔流程上传，不需迁移或新的后端/Python配置；本轮不执行发布。API/OpenAPI、后端/Worker/Python生产者消费者、权限、数据库、env、依赖及重试合同未改，因此不新增相关字段或运行参数。

P35其他区域/全页C布局、字段组合、真实父级生命周期/完整URL历史、全主题/密度/原生缩放/真实业务与生产验收继续待完成。当前批准只限那张手机详情组合，不扩展到桌面、其他状态、73页全站或整页通过。

24PNG、图册/evidence、脚本与永久单测均为交付物；不保留一次性验证脚本、基线虚拟文件、测试日志或临时服务。原批准图不可覆盖；正常产品dist与浏览器助手包属于既有构建输出，不作为临时文件删除。

## 最终收尾结果

最后一版CSS后54项手机最小验证、548项完整采集及默认复验通过；tests/unit/ui-phase2*.test.mjs全部通过（dot报告，退出码0）。原47场景/11排序与188控件状态/44点击复验通过。Vue类型检查与414模块构建通过；最后的行数间距调整后单独重建前端、255资产预算、391静态检查、153文档/73路由和运行说明通过。原102包15069PNG来源/图片无漂移，35页正式动作登记数量不提升；新增24图由独立实际子Vue证据负责，不提升整页完成度。

本轮验证端口57044、57085、57390、57514、57539、57869、58074、58108、58618均已检查无监听，浏览器与Vite均关闭。output/playwright/p35-export-detail-vue精确26项永久文件（24PNG与index/evidence），没有失败采集的额外图或临时脚本遗留。无生产发布、服务重启或数据库操作。
