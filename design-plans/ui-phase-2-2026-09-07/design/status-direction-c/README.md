# P61 · 系统状态 C方向正式提案

版本 STATUS-C-r1，待用户审核。用户已选择C方向，不代表通过本页。此为独立HTML设计图稿，不是真实Vue、生产状态或恢复报告。

[打开交互稿](index.html) · [图像与源码哈希](evidence.json) · [页面规格](../../page-specs/P61.md)

## 设计变化

依照 frontend-design 技能采用清晰目录、蓝色范围区和白色工作面：首屏先展示需核查项、每项采样与可能影响，而非先铺满健康卡片。完整依赖按访问入口/共享依赖/异步执行组成目录；会话退化和业务汇总独立分区，不把不同范围的数值混为全站健康指标。移动端使用两列分区按钮与纵向事实清单，不缩小桌面拓扑图。

保留6项依赖及其文字关系、7个唯一管理目标、全部现有汇总字段和技术详情。不增加服务启停、修复、配置、确认弹窗或权限能力；本页不存在业务模态，其他管理目标页的弹窗不计入本批。

## 全部46张图

1440×1000 / 390×844视口，截图保留完整页面；长图高度大于视口，不把整张长图压入一屏作为移动设计。顶部场景与模拟结果选择器、底部说明属于审核工具，不进入未来生产页面。20个业务/读取/边界场景和3个控件状态各有双端证据。

| 场景                        | 桌面                                | 手机                               |
| --------------------------- | ----------------------------------- | ---------------------------------- |
| 需核查：Redis警告、文件过期 | [图](1440-attention.png)            | [图](390-attention.png)            |
| 完整六项依赖目录            | [图](1440-dependencies.png)         | [图](390-dependencies.png)         |
| 当前浏览器会话              | [图](1440-session.png)              | [图](390-session.png)              |
| 汇总、采集任务、来源        | [图](1440-activity.png)             | [图](390-activity.png)             |
| 技术详情展开                | [图](1440-technical.png)            | [图](390-technical.png)            |
| 刷新中且禁用，保留观测      | [图](1440-refresh-busy.png)         | [图](390-refresh-busy.png)         |
| 刷新网络失败，保留观测      | [图](1440-refresh-failed.png)       | [图](390-refresh-failed.png)       |
| 刷新超时，保留观测          | [图](1440-refresh-timeout.png)      | [图](390-refresh-timeout.png)      |
| 重试成功，依赖仍警告        | [图](1440-recovered.png)            | [图](390-recovered.png)            |
| 首次读取中，无成功数据      | [图](1440-initial-loading.png)      | [图](390-initial-loading.png)      |
| 首次网络失败                | [图](1440-initial-network.png)      | [图](390-initial-network.png)      |
| 首次服务返回错误            | [图](1440-initial-server.png)       | [图](390-initial-server.png)       |
| 首次权限错误                | [图](1440-initial-permission.png)   | [图](390-initial-permission.png)   |
| 首次超时，无数据可保留      | [图](1440-initial-timeout.png)      | [图](390-initial-timeout.png)      |
| 缺失Redis观测               | [图](1440-missing-redis.png)        | [图](390-missing-redis.png)        |
| 六项观测均缺失              | [图](1440-missing-all.png)          | [图](390-missing-all.png)          |
| 采集与来源无记录            | [图](1440-counts-empty.png)         | [图](390-counts-empty.png)         |
| 没有需核查依赖              | [图](1440-no-warnings.png)          | [图](390-no-warnings.png)          |
| 当前会话正在重连            | [图](1440-session-reconnecting.png) | [图](390-session-reconnecting.png) |
| 当前会话暂无事件            | [图](1440-session-zero.png)         | [图](390-session-zero.png)         |
| 刷新悬停                    | [图](1440-refresh-hover.png)        | [图](390-refresh-hover.png)        |
| 刷新键盘聚焦                | [图](1440-refresh-focus.png)        | [图](390-refresh-focus.png)        |
| 刷新按下                    | [图](1440-refresh-pressed.png)      | [图](390-refresh-pressed.png)      |

## 事实与推导边界

- 基准响应及会话样本逐字段来自 `tests/e2e/m06-02-platform-dashboard.spec.ts` 的 system status 用例。脚本通过TypeScript AST定位对象并与设计数据深比较，不手填另一组相似指标。观测日期2026-08-18，响应20:00、Redis19:59、文件18:00，均为中国标准时间；0.1.0/abcdef123456属于测试样本，不是当前发布版本。
- 六项依赖/fallback/影响/href与 `platform-status-topology.ts` 导出定义深比较。受影响服务按现有广度遍历传递：Redis关联API/Worker/Crawler，文件关联Worker/Crawler。这是核查范围，不是已发生故障或自动恢复结论。
- `PlatformManagementCenter.vue` / `use-platform-status.ts` 是刷新与失败保留的依据；请求仍为GET `/platform/management?domain=status`。真实15秒超时、AbortController、离页停止与sequence不在此HTML重实现验证，450ms只用于展示本地过渡。页面读取的HTTP 403提示不等于路由守卫或真实权限已通过。
- `mysql-platform-dashboard-repository.ts` 提供summary、services、collections、sources和observed_at。服务过期由现有5分钟判断产生；本稿按历史返回状态展示，不按今天重算历史图。汇总数据库正常不覆盖单项观测；不增加健康百分比。
- 会话8次打开+2次重连=10次事件，重连率20.00%，降级轮询2次。沿 `realtime-client-metrics.ts` 基点取整算法；零事件是既有算法的0.00%，不是100%健康。刷新管理数据不能重置会话样本。
- 缺失单项/全部、空计数、无告警、重连中与零事件是显式标记的边界演示，由克隆样本裁剪/替换，非生产记录。原基准对象保持不变。无告警场景只为检查空提示，不宣称历史过期文件已经修复。
- 网络/服务/权限错误使用注明模拟结果的本地说明，不伪造后端error code、请求编号或状态码；技术编号仅为真实测试包中的 `m06-02-e2e`。
- 一个拟议文案修正：真实composable目前首次超时也说“保留上次成功数据”，稿中无数据时改为“尚无成功数据可保留”。仅列为待审设计，未修改生产逻辑/超时/权限合同。

## 每个动作如何审核

| 动作           | 入口与结果                             | 限制                                                             |
| -------------- | -------------------------------------- | ---------------------------------------------------------------- |
| 分区切换×4     | 蓝色目录按钮，保留观测、错误和读取状态 | 同页结构变更；不改路由/API，不写存储                             |
| 刷新数据       | 页标题右侧/移动全宽；busy禁用且单飞    | 读取中不清空已有观测；结果由顶部审核工具选择                     |
| 重新加载       | 首次失败页                             | 成功后进入数据区，原依赖警告仍在；加载时隐藏此次按钮             |
| 异常“进入处理” | 每个非healthy/ready节点                | 保留其实际href；只报告目标，不导航或运行操作                     |
| 六项依赖“查看” | 完整依赖目录                           | 正确对应拓扑、MySQL、Redis、文件或调度；缺失节点保留fallback入口 |
| 查看实时拓扑   | 依赖目录底部                           | `/platform-admin/topology`                                       |
| 查看任务详情   | 业务汇总                               | `/platform-admin/collection/overview`                            |
| 管理来源配置   | 业务汇总                               | `/platform-admin/providers/sources`                              |
| 技术详情       | 数据区页尾                             | 原生details/summary，鼠标与键盘展开/收起；无弹窗、无提交         |

刷新默认/hover/focus/active/disabled/busy已出图；分区、链接、技术详情用同一C焦点/触控基础规范，异步中与禁用态对无异步或无禁用条件的动作不编造。后续完整控件对照、主题、密度、中间断点、200%缩放与真实Vue各状态仍待完成，不能据此表称全站全部按钮已经验收。

## 验证与使用

在仓库根目录：

```text
node scripts/verify-ui-phase2-status-c.mjs --capture
node scripts/verify-ui-phase2-status-c.mjs
```

第一条仅用于经审核源码变化后的永久图稿重采；第二条只读核对源码/46图哈希并执行双端交互，漂移失败时不得直接重采掩盖原因。复用现有Playwright和TypeScript依赖，不安装依赖、不启动服务。脚本finally关闭浏览器。

验证覆盖：样本/拓扑合同、20场景与3控件状态、16px控件/13px最小文本/44px触控、页面无横溢出、7个唯一真实管理目的地、错误保留与重试、单飞、模拟场景切换防旧结果覆盖、会话数据独立、技术详情键盘和全部分区。HTTP/控制台错误/存储写入均为0；这不是生产网络、真实权限、服务器健康或完整无障碍认证。

本批无API字段、配置、环境变量、迁移或生产源代码修改，因此OpenAPI、`.env.example`、生产重启不适用。图和脚本为永久交付，无新临时测试文件。正式Vue迁移须在具体稿获审后对照同状态重新验证；全73页、壳层、生产发布与最终签收继续按原计划，审批和coverage不自动通过。
