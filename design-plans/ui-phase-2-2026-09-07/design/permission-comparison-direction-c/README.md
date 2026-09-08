# P45 平台角色权限比较 · PERMISSION-C-r1

2026-09-09，C方向具体图稿待审。44场景 × 1440/390两视口，共88PNG（含2张非业务审核工具图）。这是离线设计提案，不是Vue实现或生产页面。初始视口1440×1000、390×844；fullPage图片总高度不等于设备视口高度。

[打开可交互审核稿](index.html?review=1) · [规格](../../page-specs/P45.md) · [源码/图片证据](evidence.json)

## 设计与事实边界

frontend-design指导结构重排：蓝色角色上下文栏与白色逐项比较，去掉旧页数字卡墙。C色板为#254a9c/#ffffff/#edf1f6/#202c3d/#58677b/#8c3c32；系统中文字体，标题28px、控件16px、说明至少13px；触控至少44px，键盘可见焦点。1440横向三列，工作区不足1100改逐条双角色标签，不足760转单列。容器宽度适配修正200% CSS放大时固定列溢出。手机角色说明使用原生details展开，角色名/自身能力数常驻；不是弹窗或权限编辑。长说明不删减事实。

原始三角色从tests/e2e/m06-01-platform-accounts.spec.ts精确提取：目录3角色/7项去重能力；默认运营/安全并集6项、6差异；超级/运营并集7项、4差异；同运营0差异/3全部。筛选结果、所选并集、全目录去重及角色自身能力总数分别展示。未知能力沿用“其他平台权限/其他能力”，不编新能力名称。单角色、空能力、未知能力、长文案是合成边界；09:20/09:24为审核时钟，状态不是实际API返回。

GET /api/v1/platform/roles源路由先执行platform:superadmin授权、no-store，服务转交listRoles("platform")；仓库active平台角色LEFT JOIN能力并投影。不取账号概览、不依据按钮判定权限。当前没有保存、角色编辑、原因窗、分页或浏览器存储。管理管理员仍是P44链接；离线稿指向上一批P44图稿，不冒称真实Vue路由。

## 输入、按钮与只读状态

- 两角色select、名称/编码搜索、分组、只看差异；允许同角色。搜索初始化80字、分组初始化40字。仅查询/分组非空才启用重置，单改角色或show_all不启用；重置恢复固定运营/安全及只差异。
- 保留源码边界：目录仅超级角色时，重置后默认角色不存在，提示重新选择，不默默替换角色。未知URL角色在初始化/目录变化时回退首两项，这与重置后无目录变化不同。
- 五URL键left_role/right_role/show_all/capability_query/capability_group初始化和replace，默认省略、其他参数保留。P44嵌入不持久化。原组件无route.query反向watch；同实例前进后退/缓存恢复未证明，file URL刷新测试不是VueRouter证据。
- 刷新、重新加载、重新检查共用GET意图；处理中禁用防重入，有旧目录时可调整本地比较。初读失败/超时与成功零角色分开，刷新失败保留矩阵及旧时间。源码权限/会话错误也保留旧矩阵：稿中加旧数据范围说明，不宣称当前访问仍被允许或生产安全已修复。
- 默认/悬停/聚焦/按下/禁用/刷新中有图；纯本地筛选和只读跳转没有业务提交中。手机说明点击/Enter展开关闭；零业务弹窗，焦点圈闭、原因校验和写入成功不适用。刷新为离线挂起，使用审核场景选择查看结果，不会发真实请求。

## 全部截图

| 场景 | 桌面 | 移动 |
| --- | --- | --- |
| 默认六差异 | [桌面](1440-default.png) | [移动](390-default.png) |
| 运营/安全全部并集 | [桌面](1440-all.png) | [移动](390-all.png) |
| 同角色无差异 | [桌面](1440-same-differences.png) | [移动](390-same-differences.png) |
| 同角色全部能力 | [桌面](1440-same-all.png) | [移动](390-same-all.png) |
| 超级/运营四差异 | [桌面](1440-super-operations.png) | [移动](390-super-operations.png) |
| 超级/运营七并集 | [桌面](1440-super-operations-all.png) | [移动](390-super-operations-all.png) |
| 交换左右 | [桌面](1440-reverse.png) | [移动](390-reverse.png) |
| 编码大小写搜索 | [桌面](1440-code-search.png) | [移动](390-code-search.png) |
| 名称搜索 | [桌面](1440-name-search.png) | [移动](390-name-search.png) |
| 安全治理 | [桌面](1440-group-security.png) | [移动](390-group-security.png) |
| 采集治理 | [桌面](1440-group-collection.png) | [移动](390-group-collection.png) |
| 通知与报表 | [桌面](1440-group-reports.png) | [移动](390-group-reports.png) |
| 搜索与分组 | [桌面](1440-combined.png) | [移动](390-combined.png) |
| 无匹配 | [桌面](1440-no-match.png) | [移动](390-no-match.png) |
| 未知URL分组 | [桌面](1440-unknown-group.png) | [移动](390-unknown-group.png) |
| 平台治理 | [桌面](1440-group-platform.png) | [移动](390-group-platform.png) |
| 合成单角色 | [桌面](1440-single-role.png) | [移动](390-single-role.png) |
| 单角色全部能力 | [桌面](1440-single-role-all.png) | [移动](390-single-role-all.png) |
| 单角色重置缺失 | [桌面](1440-single-reset.png) | [移动](390-single-reset.png) |
| 合成空能力 | [桌面](1440-empty-capabilities.png) | [移动](390-empty-capabilities.png) |
| 合成未知能力 | [桌面](1440-unknown-capabilities.png) | [移动](390-unknown-capabilities.png) |
| 合成长名称/说明 | [桌面](1440-long-content.png) | [移动](390-long-content.png) |
| 移动说明展开 | [桌面](1440-role-descriptions.png) | [移动](390-role-descriptions.png) |
| 初次读取中 | [桌面](1440-loading.png) | [移动](390-loading.png) |
| 零角色 | [桌面](1440-empty.png) | [移动](390-empty.png) |
| 初读失败 | [桌面](1440-error.png) | [移动](390-error.png) |
| 初读超时 | [桌面](1440-timeout.png) | [移动](390-timeout.png) |
| 初读权限错误 | [桌面](1440-forbidden.png) | [移动](390-forbidden.png) |
| 初读会话错误 | [桌面](1440-expired.png) | [移动](390-expired.png) |
| 旧矩阵刷新中 | [桌面](1440-refreshing.png) | [移动](390-refreshing.png) |
| 刷新失败 | [桌面](1440-refresh-error.png) | [移动](390-refresh-error.png) |
| 刷新超时 | [桌面](1440-refresh-timeout.png) | [移动](390-refresh-timeout.png) |
| 刷新权限错误保留旧矩阵 | [桌面](1440-refresh-forbidden.png) | [移动](390-refresh-forbidden.png) |
| 刷新会话错误保留旧矩阵 | [桌面](1440-refresh-expired.png) | [移动](390-refresh-expired.png) |
| 读取中改变比较 | [桌面](1440-refresh-selection.png) | [移动](390-refresh-selection.png) |
| 读取恢复成功 | [桌面](1440-refreshed.png) | [移动](390-refreshed.png) |
| 五URL条件 | [桌面](1440-url-restored.png) | [移动](390-url-restored.png) |
| 无效角色回退 | [桌面](1440-url-invalid.png) | [移动](390-url-invalid.png) |
| 80字查询 | [桌面](1440-query-boundary.png) | [移动](390-query-boundary.png) |
| 仅改角色/开关重置禁用 | [桌面](1440-reset-disabled.png) | [移动](390-reset-disabled.png) |
| 按钮悬停 | [桌面](1440-hover.png) | [移动](390-hover.png) |
| 键盘焦点 | [桌面](1440-focus.png) | [移动](390-focus.png) |
| 按钮按下 | [桌面](1440-pressed.png) | [移动](390-pressed.png) |
| 非业务审核工具 | [桌面](1440-review-tool.png) | [移动](390-review-tool.png) |

## 验证与使用

仓库根目录执行 `node scripts/verify-ui-phase2-permission-comparison-c.mjs`：核对当前源码/原型LF SHA-256、数据及88PNG哈希，再跑双端交互和精确清单；无参数不重写图片。修改后加 `--capture` 重新采图，人工检查并再次无参数验证。data.js由永久helper从原夹具提取，不手改事实。

helper执行实际Vue的computed/ref和手动watch回调，15种完整行结果与原型对照；实际loadPlatformRoles惰性函数检查single-flight、12000ms abort回调（未等待12秒网络）、旧矩阵/时间及空结果；实际仓库方法由pool返回合成行，核对参数与投影，不执行SQL。浏览器每视口18条离线读取结果链、控件、URL刷新、零弹窗、布局/字号/触控和部分Tab/展开；320/759/760/761/768/1024/1100/1101及200% CSS zoom有界检查。HTTP/console/pageerror/存储0，浏览器finally关闭，不启动服务。

不是Vue挂载、MySQL、RBAC允许/拒绝、审计、完整历史/卸载、软键盘/屏幕阅读器、三主题两密度或生产验收。范围说明、手机说明展开和异常可读性只为待审提案。业务源码/API/OpenAPI/env/依赖/迁移未改，无部署或重启。88图、原型、永久验证器是交付物，不是临时测试产物。

## 审核与下一步

请按PERMISSION-C-r1评价角色区、逐项比较、手机说明展开及旧数据提示。未回复不算通过。W05八路由已有各自首轮稿，不代表PA-W05或全站通过；下一W06从P46来源设置继续出图，具体稿获审后进入对应Vue实现。全73页实现、真实验证、宝塔部署与签收未完成。
