# P47 采集程序 · PROVIDER-ADAPTERS-C-r1

2026-09-09，基线 main/5d875e8。**具体图稿待审，不是生产上线或全站完成。**

48 个场景，桌面 1440×1000 / 手机 390×844 双端 96 张主图，加 15 张连续详情中下部，共 111 PNG；包括 2 张非业务审核工具图。主列表为完整页面截图，详情为视口截图并连续补齐下部。图、原型、数据和验证器均为永久交付物，不是待清理的临时测试产物。

[打开交互审核原型](index.html?review=1) · [可复查验证证据](evidence.json) · [P47 事实规格](../../page-specs/P47.md)

## 设计选择与审核顺序

先看默认桌面/手机，再看移动筛选展开、健康但无样本、运行诊断和检查结果未知。最后检查下方全状态图。C 方向保持蓝色导航和白色工作区；frontend-design 技能用于“诊断分栏”而不是四张大统计卡，手机高级筛选收起，保留搜索与来源结果优先。字体使用中文系统字体，按钮 16px / 44px，次要事实不小于 13px。

1. 五列表格分开来源、健康探针、实际采集、暂停恢复和操作；全目录摘要不随筛选改数。
2. 手机来源摘要进入原生详情窗；桌面也提供“查看诊断”，均读取已载入行，不新增详情 API。
3. 探针成功不是采集成功；运行连续失败不是探针失败；恢复入口只去 P70，不解除暂停。
4. 原 2 项与原 45 项 E2E 夹具单独展示；运行样本、结果未知和长内容明确标为合成。合成 ready 响应保留旧测试可能出现的“未登记但 ready”组合，不能用它证明真实服务会如此返回。
5. UTC 标签用于解释源组件直接切片的时间；最近成功读取使用固定审核时钟，失败保留旧时刻。不是实时生产数据。

## 操作、弹窗和边界

| 操作 | 图稿中的处理 | 不改变的边界 |
| --- | --- | --- |
| 刷新 / 首次失败重读 | 有快照则保留，首次失败显示对应状态；按钮称“重新读取状态” | GET `/api/v1/platform/provider-adapters`；不是重新登录或授权 |
| 六筛选 / 重置 / 上下页 | 搜索、五选择含排序；重置全部默认，第 1 页，每页 20 项 | 源 computed 排序与匹配；不写 URL、存储，不增请求 |
| 移动筛选展开收起 | 仅布局提案，保留值；默认收起，显示已选分类数量 | 不增加持久化偏好或业务过滤条件 |
| 列显隐 / 冻结 / 密度 | 桌面五列至少保留一列；冻结首个可见列，标准/紧凑 | 不改变来源记录和采集合同 |
| 查看诊断 / 关闭 / Escape | 一个详情窗；身份、探针、24h 运行、恢复、技术详情分区 | 无程序注册/上传/编辑、批量探针、兼容矩阵弹窗 |
| 执行健康检查 | 全局一项在途；保留输入和刷新；四结果演示 | 无 body 的 POST；真实动作需 Origin、Idempotency-Key、provider:configure，可访问网络并持久化 |
| 技术详情 | 来源 ID/代码/方式/版本/探针与运行错误/暂停及恢复时间 | 没有凭证和源内容；反馈意图编号明确不是 request_id |
| 前往采集调度 | 只在 open 且 recovery gate met 出现 | 记录导航意图 `/platform-admin/crawler-scheduler`；不在原型执行恢复 |

原型检查按钮只登记离线意图；可用审核工具切换成功、拒绝、受阻、未知场景，不会自然等待后伪造真实成功。关闭在途详情不表示取消检查。未知结果暂禁再次检查、刷新后解除本地阻止属于待审 UX 提案，不证明服务器已取消、确认或具备重试安全性。

## 实际代码证据与仍待实施的保护

- TypeScript AST 分别提取原 2 行、45 行；源组件脚本派生为 `source-logic.js`，仅在惰性桥接环境执行。13 种筛选/排序完整 ID 序列、20/20/5 分页、六项复位与夹页有核对。
- 实际 `probe` 验证无 body POST、全局 busy、按 ID 替换；实际 `load` 检查 12000ms 定时器、首次 401/403/503/500 与既有快照保留。此处没有等待真实网络超时、挂载 Vue 或执行真实鉴权。
- 已复现 PR-G03：旧 GET 返回覆盖较新 probe 版本。图稿用读写代次保护旧响应；筛选移除详情后说明原因并将焦点回到刷新按钮。这些都没有改生产组件。
- 实际服务 `summary` 验证恢复条件严格晚于暂停时间、open 条件和预算下限 0；源仓库读取已完成子查询，列表样本 SQL 有全局 LIMIT 5000，因此不把“24 小时”宣称为全部运行数据或全量 SLA。
- 浏览器执行 48 场景双端、真实控件操作、四种 probe 结果、每端 14 种读取结果、详情 Tab/Shift+Tab/Escape/返回、列工具和 320/759/760/761/768/1024 长内容及 CSS zoom2。HTTP/console/pageerror/存储均为 0。CSS zoom2 不替代浏览器原生缩放或移动辅助技术验收。

待办：具体审图；PR-G03 真正 Vue 请求/路由离开生命周期；实际 API/幂等/权限/MySQL/外发隔离/审计/探针及 P70 恢复链；完整三主题两密度与辅助技术；全 73 页实现、宝塔发布、用户签收。原型通过不能作为上述通过证明。

## 复验与使用

从仓库根运行 `node scripts/verify-ui-phase2-provider-adapters-c.mjs`：只读复核数据、派生逻辑、源指纹、PNG 指纹、精确截图清单及交互。仅在原型修改后使用同命令加 `--capture` 重建正式图和证据；复用已安装依赖，不启动开发服务。浏览器/context 在 finally 关闭。可直接打开 `index.html?review=1` 选场景；不要把本目录上传为生产应用。

无新 API/env/CLI 生产选项/依赖/数据库迁移。Vue、后端、Python、OpenAPI、配置和宝塔均未改；无需重启。本包下一设计项 P48 来源渠道。

## 全场景主图

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 默认双来源 | [查看](1440-default.png) | [查看](390-default.png) |
| 移动筛选展开 | [查看](1440-filters.png) | [查看](390-filters.png) |
| 原45项目录 | [查看](1440-catalog.png) | [查看](390-catalog.png) |
| 名称排序 | [查看](1440-name.png) | [查看](390-name.png) |
| 最近检查排序 | [查看](1440-recent.png) | [查看](390-recent.png) |
| 代码搜索 | [查看](1440-query-code.png) | [查看](390-query-code.png) |
| 版本搜索 | [查看](1440-query-version.png) | [查看](390-query-version.png) |
| 错误码搜索 | [查看](1440-query-error.png) | [查看](390-query-error.png) |
| 模式筛选 | [查看](1440-mode.png) | [查看](390-mode.png) |
| 来源状态 | [查看](1440-status.png) | [查看](390-status.png) |
| 登记状态 | [查看](1440-registration.png) | [查看](390-registration.png) |
| 健康筛选 | [查看](1440-health.png) | [查看](390-health.png) |
| 组合筛选 | [查看](1440-combined.png) | [查看](390-combined.png) |
| 筛选无结果 | [查看](1440-no-match.png) | [查看](390-no-match.png) |
| 第二页 | [查看](1440-page-two.png) | [查看](390-page-two.png) |
| 末页 | [查看](1440-page-three.png) | [查看](390-page-three.png) |
| 加载中 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 无来源 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权限 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 依赖受阻 | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| 读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 刷新保留快照 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败 | [查看](1440-refresh-error.png) | [查看](390-refresh-error.png) |
| 刷新过期 | [查看](1440-refresh-expired.png) | [查看](390-refresh-expired.png) |
| 刷新拒绝 | [查看](1440-refresh-forbidden.png) | [查看](390-refresh-forbidden.png) |
| 诊断详情 | [查看](1440-detail.png) | [查看](390-detail.png) |
| 技术详情 | [查看](1440-detail-technical.png) | [查看](390-detail-technical.png) |
| 健康无样本 | [查看](1440-detail-healthy.png) | [查看](390-detail-healthy.png) |
| 检查中 | [查看](1440-probing.png) | [查看](390-probing.png) |
| 详情检查中 | [查看](1440-detail-probing.png) | [查看](390-detail-probing.png) |
| 合成通过仍暂停 | [查看](1440-probe-ready.png) | [查看](390-probe-ready.png) |
| 合成受阻 | [查看](1440-probe-blocked.png) | [查看](390-probe-blocked.png) |
| 合成请求拒绝 | [查看](1440-probe-error.png) | [查看](390-probe-error.png) |
| 合成结果未知 | [查看](1440-probe-unknown.png) | [查看](390-probe-unknown.png) |
| 详情结果未知 | [查看](1440-detail-unknown.png) | [查看](390-detail-unknown.png) |
| 结果移出筛选 | [查看](1440-filtered-away.png) | [查看](390-filtered-away.png) |
| 合成运行样本 | [查看](1440-runtime.png) | [查看](390-runtime.png) |
| 合成运行诊断 | [查看](1440-runtime-detail.png) | [查看](390-runtime-detail.png) |
| 零值 | [查看](1440-zero-values.png) | [查看](390-zero-values.png) |
| 长内容 | [查看](1440-long-content.png) | [查看](390-long-content.png) |
| 列工具（桌面） | [查看](1440-columns.png) | [查看](390-columns.png) |
| 紧凑密度（桌面） | [查看](1440-compact.png) | [查看](390-compact.png) |
| 首列隐藏（桌面） | [查看](1440-first-hidden.png) | [查看](390-first-hidden.png) |
| 键盘焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 非业务审核工具 | [查看](1440-review-tools.png) | [查看](390-review-tools.png) |

## 连续详情中下部

| 详情 | 桌面下部 | 手机中部 / 下部 |
| --- | --- | --- |
| 来源诊断 | [下部](1440-detail-bottom.png) | [下部](390-detail-bottom.png) |
| 健康无样本 | [下部](1440-detail-healthy-bottom.png) | [下部](390-detail-healthy-bottom.png) |
| 检查中 | [下部](1440-detail-probing-bottom.png) | [中部](390-detail-probing-part-1.png) / [下部](390-detail-probing-bottom.png) |
| 技术详情 | [下部](1440-detail-technical-bottom.png) | [中部](390-detail-technical-part-1.png) / [下部](390-detail-technical-bottom.png) |
| 未知结果 | [下部](1440-detail-unknown-bottom.png) | [中部](390-detail-unknown-part-1.png) / [下部](390-detail-unknown-bottom.png) |
| 运行诊断 | [下部](1440-runtime-detail-bottom.png) | [下部](390-runtime-detail-bottom.png) |
