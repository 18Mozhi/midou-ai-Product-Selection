# P38 来源预览与表格设置 · C 细化稿

状态：具体组合待审，非真实Vue或生产验收。2026-09-11，main/c380b995起点；保留既有P36/P37未提交工作。使用frontend-design细化信息层级、蓝色焦点、字段间距与短屏关闭操作，再用Playwright核对原生交互。

[可操作原型](index.html) · [16张组合图](../../../../output/playwright/p38-provider-compositions/index.html) · [28组检查及源/图hash](../../../../output/playwright/p38-provider-compositions/evidence.json)

## 本批范围

本子稿加载原PLATFORM-OVERVIEW-C-r1的数据、控制器和基础样式，不修改原文件、91张图或原evidence。只增独立detail.css和展示增强detail.js：手机只读来源预览，桌面来源表格工具。其他页头、指标、趋势与告警区域不重设计；双端异常摘要局部像素与原稿逐字节一致。

手机：白色阅读面与蓝色顶线；标题、关闭按钮固定在可滚动窗顶部。成功/失败并列，观测次数和最近观测独立；技术字段留在浅灰折叠区，长编号换行。关闭按钮真实默认/焦点/悬停/按下状态，不伪造无业务依据的禁用或等待。10图含折叠/展开、未知状态、长字段顶部/底部和568px短屏；不包含软键盘或原生200%缩放证明。

桌面：四列显示设置、至少保留一列的就近帮助、已选但禁用标记；首个可见列冻结与密度仍是原本地显示操作。6图含默认、展开、最后一列、冻结焦点、取消冻结和紧凑密度；移动端没有这组桌面工具，不为它伪造手机设置图。

## 真实来源与提案边界

源追踪：P38规格→PlatformDashboard.vue→ResponsiveDataView.vue和TableViewControls.vue。真实父字段为状态、success_count/failed_count、observed_count、last_observed_at及技术id/code；shared preview关闭和列工具均来自既有入口，没有新增业务按钮、来源测试或启停动作。

数字来自原测试夹具，观测时间仍2026-08-08。每次打开对照原对象逐字段检验，不改成当日生产数据。critical在真实父显示“未知”，原C稿同时在技术区披露原始状态；本子稿保留该既有提案，不擅自把critical映射为“严重”。只读窗口范围文字、原始状态披露、原生dialog模态/焦点循环是原C提案，不宣称真实共享Vue已实现。本次新增就近帮助和复合可访问名称同样待审。

## 复验与使用

```powershell
node scripts/verify-ui-phase2-platform-provider-detail.mjs --smoke
node scripts/verify-ui-phase2-platform-provider-detail.mjs
node --test tests/unit/ui-phase2-platform-provider-detail.test.mjs
```

smoke只手机、不写文件；默认双端检查已有图/源hash、不重拍；需要明确更新当前稿才用`--capture`。在原型右上审核工具选择原场景后，滚到“来源健康”；手机点击来源，桌面操作列设置/冻结/密度。场景切换器是审核工具，不是拟新增生产功能。

28组浏览器断言包括：原字段/技术值与名称、初始焦点、Tab双向循环、Escape关闭返回、短屏关闭可见、四列原值/最后一列保护、冻结第一可见列、密度不变更行数、零HTTP/浏览器异常。16图源hash绑定；另4永久测试验证原91图/基线清单和三个真实Vue文件未改、CSS局部作用域及声明范围。模拟页面不调用真实API；真实GET存在读取审计事务，不能从此离线验证宣称生产读取无写入。

## 交付与未完成

图与index/evidence共18文件保留在`output/playwright/p38-provider-compositions/`，都是审核交付。未创建临时文件、日志、下载、开发服务器；所有测试浏览器finally关闭，复用现有依赖，不安装新包。

本批没有修改生产Vue/API/OpenAPI/权限/数据库/env/依赖或部署流程，不需重启；feature map仅增加提案入口。既有P35颜色门授权仍待答，混合工作树未提交/未部署，commit hash不适用。仅请求手机折叠来源预览组合审核，其他图、整页、真实Vue及全73页实施/部署继续待完成；未答不等于同意。

收尾复核：新稿无参数复验28组通过，第二阶段UI测试566/566通过；73路由、153必需文档及运行说明检查通过，git diff --check通过。生产/依赖未变，未重复前轮生产构建或已知未变的P35失败门。完成的是本批局部图稿与证据，不是整页或全站完成。

最后格式门发现图册HTML生成行超过640字符，已仅拆分模板行；重新捕获16图、28组浏览器检查及4项定向测试通过，格式门通过。没有调整预览构图或用户已看到的字段内容，未把格式修复当作新的视觉版本批准。
