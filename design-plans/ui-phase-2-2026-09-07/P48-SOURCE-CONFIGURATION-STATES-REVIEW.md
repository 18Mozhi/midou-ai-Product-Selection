# P48 · 编辑采集设置保存与烟测状态实际 Vue r1

## 本批范围

以当前真实路由 `/platform-admin/providers/sources`、ProviderSourceCenter 的 `save()`、ProviderSourceConfigurationDialog、ApiClientError 映射和 M03-07 fixture 为准。本批在上一批字段布局上继续覆盖直接保存与公开来源启用链路的 11 个状态；审核宿主精确变换父/子两个真实 SFC，并用本地受控响应执行实际 PUT/POST。**所有写入只命中本地浏览器拦截响应；生产 SFC、API、权限、数据库、环境、依赖及线上数据均未改，未部署。**

pbakaus/clarify 用于统一状态层级：第一句话说明当前结果，第二句话说明已经保留或尚未发生的事实，第三层才提供恢复动作和折叠技术编号。文案不再把烟测或二次启用失败误写为“本次没有保存”。

## 直接保存状态

- `saving`：显示“正在保存采集设置”，字段、状态、原因、关闭和取消进入禁用状态，不虚构百分比或完成时间。
- `success`：显示“采集设置已保存”，保留当前窗和更新后的配置版本，由操作者点击“完成”后返回目录。
- `failed`：明确“采集设置未能保存”，字段保持可编辑，主动作改为“重新保存”。
- `conflict`：409 单独显示“配置已经更新，请重新读取”，说明其他操作已产生新版本，主动作是“关闭后重新读取”。

## 公开来源启用状态

- `saving_disabled`：先保存停用配置，来源仍停用。
- `smoke_testing`：第一段 PUT 已完成并显示新版本；真实健康检查执行期间来源仍停用。
- `enabling`：健康检查已通过，第二段 PUT 正在写入启用状态。
- `success`：两段 PUT 和一次健康检查完成，显示“烟测通过，来源已启用”。
- `partial / health result`：烟测返回未通过，显示真实 `last_error_code`，并明确停用配置已保存。
- `partial / health request`：健康检查服务请求失败，保留服务给出的恢复提示和技术编号，停用配置不回滚。
- `partial / second PUT`：烟测已经通过但启用写入失败，明确来源仍停用并要求重新读取最新配置。

所有成功链路固定验证请求顺序为 `PUT disabled(expected_version=1) → POST health-check → PUT enabled(expected_version=2)`；第一段之后的失败不宣称零写入。表单快照固定在提交时，避免烟测期间继续编辑导致第二段 PUT 使用漂移值。

## 反馈与焦点

- 进行中使用浅蓝反馈区和 `aria-busy=true`；成功为绿色，部分保存/冲突为橙色，未写入失败为红色，并始终带文字结论。
- 终态焦点进入反馈标题，错误技术编号使用原生折叠区；窗口继续保持打开，避免结果出现在已关闭窗外。
- 进行中关闭入口与字段禁用；终态 Escape 关闭并把焦点归还原“编辑采集设置”按钮。
- 手机底部提示随状态变化，不再在成功后继续说“保存后会生成”，也不在部分保存后给出错误承诺。

## 实际证据

- [49 图总览](../../output/playwright/p48-source-configuration-states-review/index.html)：390/760/1024/1440 下 11 个状态共 44 张主图，390px 另含 5 张展开技术详情图。
- [机器证据](../../output/playwright/p48-source-configuration-states-review/evidence.json)：44 次实际 App 运行、632 项检查、49 张 PNG、61 个实际加载源码哈希。
- 每组先做 1 次目录 GET；之后只向本地拦截层发出该场景所需 PUT/POST。全部写请求具有 Idempotency-Key，无额外目录重读、未知网络、外链或运行错误。
- 44 组逐项断言捕获阶段、终态、`aria-busy`、字段禁用、窗内结果、幂等键、公开来源状态/版本顺序、健康检查次数、水平溢出和终态焦点归还。

复验：`node --test tests/unit/ui-phase2-provider-source-configuration-states.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-source-configuration-states.mjs --capture`。随机端口已关闭，正式图包保留。

## 待审与未覆盖

本批只申请保存、烟测和部分保存反馈的视觉、文案与窗内交互审核。没有执行真实 API/MySQL/外部来源烟测；关闭终态后如何安全重读目录、跨来源迟到响应归属、保存期间更换来源、真实 401/403、超时和完整 SC48/PR-G01 仍需后续验证。配置历史、固定样本和兼容矩阵三个任务窗也未在本批覆盖。
