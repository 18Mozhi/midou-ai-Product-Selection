# P34 实际 Vue C 整页预览 r4

日期：2026-09-13。状态：本地审核稿，新增整体结构待审，不代表全页或生产验收。

## 本轮范围

实际 App / OrganizationAdminCenter / OrganizationApprovalPanel 和既有 C 导航壳组合，
通过 Vite 内存转换加载局部模板与 CSS，未覆盖生产 Vue。桌面采用蓝色双视图目录、
概要/指标与白色阅读区；手机采用横向视图切换和单列内容。清理本页刷新、目录、详情、
分页和提示的旧暖色残留；不重新设计共享导航壳，不将壳内其他颜色算作本页批准。

模板详情增加明确“变更前/变更后”文字；原有选中模板在目录翻页后继续显示时，
增加“当前详情来自其他目录页。翻页不会自动切换已选模板。”，不改变选择行为。

## 不变合同与审核边界

- 原子组件整个 script、全部事件/模型表达式、两条 RouterLink 和 SFC 原样式保持。
- 请求筛选/模板筛选各五项、8/6 分页、工作区名称去重、版本号排序及查询键不改。
- GET 接口、返回结构、原序号 diff 算法、审批权限、业务审批入口不改。
- P34 只读，零本页业务弹窗，未增加创建、发布、撤回或审批操作。
- 已通过手机模板筛选/空态的子树与 390/760 样式签名保持；签名不是逐像素相等。
- 原手机首次 500/429 区域继续复用；没有由本轮推定权限文案或其他失败区域已通过。
- 未修改生产、后端、OpenAPI、环境、依赖、数据库；无部署/重启要求。

## 审核图片与数据来源

正式包：[r4 evidence](../../output/playwright/p34-approvals-vue-c-r4/evidence.json)，58 张 PNG。
宽度：390 / 760 / 761 / 840 / 841 / 1440。默认画面高度 1000；五类详情场景为展示完整
详情临时增高 viewport（1000–4000），不是普通手机首屏或软键盘/短屏验收。
每张图包含截图时的真实视口，不裁剪成独立假组件。普通默认图不包含全部纵向页面。

| 场景 | 来源/范围 |
| --- | --- |
| requests-default / request-technical | 仓库既有样例 10 条记录，8/2 分页、Enter 展开技术详情 |
| templates-default / template-detail | 既有 2 模板，选中有上一版本的模板查看实际 diff |
| first-version | 既有首版本样例，无上一版本说明 |
| template-empty | 输入无匹配；手机既有清除并回焦点搜索 |
| mixed-version-diff | 明确合成 8 模板，实际仓库纯函数生成变更/新增/移除及四字段变化，包含数值 0 |
| unchanged-version | 合成已有上一版本且无节点变化；不是首版本 |
| cross-page-selection | 合成 6/2 分页，保留已选详情并提示来自另一页 |
| first-500 / first-429 | 390/760 既有失败区域；六宽均验证重读恢复，不测试真实限流 |

桌面默认：[图片](../../output/playwright/p34-approvals-vue-c-r4/1440-templates-default.png)。
手机默认：[图片](../../output/playwright/p34-approvals-vue-c-r4/390-requests-default.png)。
手机详情：[图片](../../output/playwright/p34-approvals-vue-c-r4/390-template-detail.png)。
多节点合成对照：[图片](../../output/playwright/p34-approvals-vue-c-r4/1440-mixed-version-diff.png)。

## 验证与使用

`node scripts/verify-ui-phase2-org-approvals-vue-c.mjs` 无参数跑完整矩阵、不写图。
`--smoke` 跑手机原/改版；`--capture` 写正式 r4 目录，已有目录即在启动服务前失败关闭。
只接受一个 smoke/capture 参数，未知或组合参数拒绝。不新增依赖，随机 localhost 端口，
拦截全部 API，禁止意外请求，finally 关闭浏览器和 Vite。

最终实际浏览器：2 基线 + 6 改版 = 8 组，224 项检查、58 图、179 源哈希，128 本地 GET，
零 POST/真实写入/意外请求/页面运行错误。检查范围包含分页、键盘进入视图、技术展开、
原手机清除回焦、原样式签名、局部配色、500/429 首次失败与恢复。
新增单测绑定完整脚本/指令/链接/已批子树、转换可逆与编译、源文件和每张 PNG 的哈希。
此范围不是完整生命周期、真实后端/RBAC、全73页或生产验证。

### 本轮收尾实测

新6项定向单测全通过。12个P34关联测试文件共45项，39通过、6失败；失败均停在历史
图包共享源哈希与当前文件不符，不能算通过，也没有改旧图包哈希掩盖差异：

- mobile-filters:31、review:154 首个差异为 `apps/web/src/signal-ledger.css`。
- parent-c:59、parent:10、permission-tone-r2:6、rate-limit-vue:57 首个差异为
  `apps/web/src/components/NavigationShell.vue`。

这两个生产文件本轮没有编辑；当前r4的179源哈希另行全部通过。这里只定位每个失败的
首个断言，不宣称历史图包没有其他差异；旧全矩阵需后续按真实源重新验证。
格式、文档153项、73路由产物、运行文档一致性和diff空白检查通过。
本轮21个临时监听端口均确认关闭，无服务交接/重启需求。未运行全仓生产验证。

## 仍待完成

整体布局具体审核、剩余控件状态与父级失败/刷新组合、完整交互/生命周期、真实权限与
生产链路。其他页面和之前未答审核项保持未完成。当前混合阶段工作树不暂存、不部署；
commit hash 不适用（关联验证仍失败，且工作树混有前序阶段改动，未暂存）。

本轮临时产物清理被工具策略拒绝，未重试或绕过。以下三个中间目录仍保留，合计174张
PNG和3份evidence.json，不作正式审核包；正式交付是r4的58张图。

- `output/playwright/p34-approvals-vue-c-r1`
- `output/playwright/p34-approvals-vue-c-r2`
- `output/playwright/p34-approvals-vue-c-r3`

没有删除其他历史图片、用户文件或依赖。若需删除中间目录，需要允许该精确清理的工具
策略或用户在本机手工清理；没有占用进程需要停止。
