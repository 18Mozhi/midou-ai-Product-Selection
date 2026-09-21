# P58 · 创建重试内容与幂等键诊断

## 风险已复现，尚未修复

原生产 Vue 与当前 C 预览均存在以下风险：创建 Alpha 已落入模拟事务，但响应丢失；客户端
收到 status=0，允许改为 Beta 并沿用原键。后端回放 Alpha 的旧结果，不保存 Beta，页面却进入
成功态并用 Beta 搜索目录；C 双结果区还会显示 Beta 的“草稿已创建”。

这不是后端拒绝新内容的冲突提示：当前同键回放直接返回旧 id，不比较第二次的有效业务内容。

| 首次请求实际状态 | 客户端状态 | 改为 Beta 后沿用原键 | 实际保存内容 |
| --- | --- | --- | --- |
| Alpha 已提交，响应丢失 | status=0 / blocked | 回放原结果，成功提示但 Beta 查询无记录 | 仅 Alpha |
| 请求进入服务前丢失 | status=0 / blocked | 执行第二次内容，成功提示且查到 Beta | 仅 Beta |

同样的客户端错误不能判断第二次是重试还是新操作；一次 GET 无记录也不能证明首次失败，不能
自动换键重新创建。现有静态原型的“冻结内容与原键”仍只是提案，不代表客户端已实现。

## 源码证据及边界

永久测试直接转译当前源码，不依赖 dist：

- CommercialOperationsCenter 的 createPlan/load/call/setNotice/normalizedData/emptyData；
- api-client 的请求和错误包装；
- CommercialService 的 createPlan 校验与规范化；
- MySqlCommercialRepository 的 createPlan/op/tx/audit。

当前 C 案例通过现有 focus → outcome → write → layout 转换获得，未手写另一份创建算法。
SQL 由有限内存适配器接管，未知 SQL/模块导入立即失败；fetch 完全在进程内模拟。
GET 仅为 alpha/beta 两个简单样例生成合成目录，不执行仓储 read 或真实 SQL。
没有真实 HTTP、MySQL、凭证、行锁、并发隔离、持久化耐久性、鉴权或审计验收。

六项诊断确认：同键改内容回放旧 id；原内容同键不重复；新键代表新操作；失败事务在适配器中
回滚；生产 Vue 和 C 预览都可误报新内容成功；提交前/提交后丢响应会造成不同实际结果。
每次首次网络错误均为 status=0/blocked，POST 没有被 API client 自动重发。

额外合同事实：首次 createPlan 返回 id/status/version；op 保存 id/version，回放另加
idempotent_replay，不保证含 status。后续不能凭空要求回放一定提供 status 字段。
通用错误中的“安全读取重试”也不能解释为系统已经重试了 POST。

## 待确认与后续实施

建议结果未知时冻结本次请求，仅允许用户显式按原键、原内容重试；确认结果前禁止把修改内容
作为重试或自动换键。关闭/重开和离页返回应保留原提交状态。该选择影响未知结果时的编辑与
提交行为，需要用户确认后实施；仅暂停此行为分支，不扩大为其他页面不能继续。

确认后需完整覆盖原提交快照、未知反馈、重开/离页归属、重试再次失败、真正的新操作入口、
真实幂等/权限/事务，不能只禁用一个按钮就宣称完成。

## 复验与收尾

`node --test tests/unit/ui-phase2-commercial-create-retry-diagnostic.test.mjs`

6 项通过仅表示准确复现风险，不是修复通过；文件和测试名均标记 DIAGNOSTIC。后续修复时应
转换成安全行为验收断言，不把缺陷永久当成期望行为。

本轮仅新增永久诊断测试和文档/地图记录。生产 Vue、预览实现、API 客户端、后端、数据库、
OpenAPI、env、依赖及已有 24/42/66/30 图包未改；无需重启，未部署。
未创建临时文件、图像、日志或服务。全库门禁未通过，本批未提交，commit hash 不适用。
