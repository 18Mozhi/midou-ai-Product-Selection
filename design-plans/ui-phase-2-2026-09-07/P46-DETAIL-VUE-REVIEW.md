# P46 手机来源详情 · 实际Vue审核

2026-09-11，P46-PROVIDER-DETAIL-VUE-PREVIEW-r1，基于main/30bd5373。继续目录104图、编辑134图之后的手机详情；原两批图册不覆盖。使用当前ProviderRuntimeSurface、ProviderRegistry详情插槽与ResponsiveDataView，详情模板和脚本保持，仅新增独立审核CSS，没有生产导入。

## 图册与设计

[68图入口](../../output/playwright/p46-provider-detail-vue-preview/index.html) · [手机默认上部](../../output/playwright/p46-provider-detail-vue-preview/390-normal-default.png) / [下部](../../output/playwright/p46-provider-detail-vue-preview/390-normal-facts-bottom.png) · [空条款与技术资料](../../output/playwright/p46-provider-detail-vue-preview/390-blocked-technical.png) · [长名称](../../output/playwright/p46-provider-detail-vue-preview/760-long-default.png) · [详情转编辑](../../output/playwright/p46-provider-detail-vue-preview/390-editor-handoff.png)

按frontend-design技能延续C方向：蓝色来源身份、白色事实清单、浅灰技术信息展开区；390单列、760双列事实。保留9项业务事实与5项技术事实，原“编辑来源”位于业务事实之后、技术详情之前。body级审核class覆盖Teleport抽屉，不改共享组件或其他页面。关闭按钮44px、编辑按钮48px；蓝底关闭焦点白色，白底控件焦点蓝色。长名称与URL允许换行，不缩略真实事实。

## 证据范围

390/760px分别35/33图，共68PNG、232浏览器检查、40项当前源码LF指纹及变换指纹。10种单记录供给：原未启用、原待复核受阻，以及已启用准入完整、登录模式、导入、人工、条款过期、条款拒绝、草稿、长文本变体。每种拍默认、底部、技术展开；另有关闭/技术焦点、转编辑，390另有568px短屏上下部。使用既有测试记录与显式变体，不是生产来源事实或真实权限验收。

所有9+5字段逐项核对，当前状态与执行门禁分开；“准入完整不代表采集成功”保留。空条款显示未登记，到期按原Asia/Shanghai显示2027/8/8 01:00:00，不掩盖上一批编辑提交的时区问题。两宽度各10次providers GET被浏览器拦截，无写请求、意外网络或页面异常；URL保持原查询。不强行显示桌面隐藏的详情入口，不据此声称761/1440或全部断点完成。

实际详情打开使背景inert、初始聚焦关闭，Tab/Shift+Tab边界循环、Escape回原记录并释放inert通过。转编辑关闭旧详情，只剩一个编辑窗，释放背景，焦点和code属于所选来源。

## 尚未完成：编辑关闭焦点

两宽度从详情转编辑后关闭编辑，activeElement均为BODY，未回原记录。当前edit保存的触发器来自已卸载详情按钮；closeEditor尝试聚焦该失联元素。此观察独立于通过检查记录，不能把BODY当作合格焦点返回，也不能以详情自身Escape通过代替整条链路通过。本批仅审核CSS，未改生产焦点；下一实施批需补有存活目标的焦点恢复及回归。旧字段残留、时区偏移、异步窗口归属/刷新、完整模态无障碍仍未关闭。

## 复验与交付边界

```powershell
node scripts/verify-ui-phase2-provider-detail-preview.mjs
node --test tests/unit/ui-phase2-provider-detail-preview.test.mjs
```

默认只验证，--capture重制本批正式图册，仅本地审核CLI参数。复用依赖、随机回环Vite端口，未登记请求失败关闭；真实Vue经过编译与浏览器回放。生产构建输入未变，不重复生产构建。新永久合同覆盖实际插槽/script保持、当前源与精确图库、字段/只读网络/有限焦点检查、生产隔离及已知焦点缺口。

API/OpenAPI、数据库、权限、.env/配置、依赖、后端/Python/插件与部署脚本均未改，无生产重启或部署要求。68PNG与HTML/JSON为正式审核交付保留，不是临时截图；本批不产生一次性测试文件。新详情组合待审，旧页和编辑批准不外推；整页、真实授权/保存/采集与全73页宝塔交付仍未完成。

最终4项定向合同及847项相关UI/账号/响应式回归通过，失败0；73路由/60受保护/6角色与153文件文档门禁、格式及diff空白检查通过。首次新增合同误写插槽名details，按实际detail修正后复测通过，不涉及组件变更。预览端口52980确认无监听，验证器Node进程无残留。已展示手机默认上下两图并请求限定布局审核，未收到该组合批准前保持待审。
