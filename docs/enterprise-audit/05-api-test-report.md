# 《接口清单及逐接口测试报告》

## 1. 清单边界

`docs/openapi.yaml` 是逐接口清单，当前包含 223 个 path、256 个 HTTP operation。完整方法、参数、响应、错误码和安全方案不在本报告重复复制，以避免文档漂移；`npm run verify:docs` 和 `verify:route-artifacts` 负责合同一致性。

## 2. 逐接口结果解释

每个 operation 的状态必须由下面证据之一证明：对应 `tests/mXX-*` 的 API/合同测试、`tests/integration` 的真实 MySQL/Redis/Worker 链、逐页真实请求记录、或生产/测试环境验收日志。仅在 OpenAPI 出现不等于通过。

| API 组             | 主要路径                                                       | 正常/参数/未登录/无权        | 跨租户/幂等/并发             | 超时/依赖/数据库异常           | 结论                 |
| ------------------ | -------------------------------------------------------------- | ---------------------------- | ---------------------------- | ------------------------------ | -------------------- |
| 健康与拓扑         | `/health/**`、`/platform/operations/**`                        | 合同与页面通过               | 平台权限                     | 生产故障注入阻塞               | 部分通过             |
| 认证               | `/auth/**`、`/me/password`、`/me/mfa/**`、`/me/sessions/**`    | API/合同测试通过             | 会话/MFA 单次消费通过        | 真实邮件依赖阻塞               | 部分通过             |
| 租户上下文         | `/org/memberships`、workspaces/teams、`/auth/context`          | 通过                         | 跨组织拒绝、上下文一致性通过 | 生产大租户容量未压测           | 通过（容量除外）     |
| 授权与资源授权     | `/me/authorization`、roles、resource-grants                    | 通过                         | 组织/工作区/资源范围通过     | DB 故障注入非全接口            | 部分通过             |
| 组织治理           | `/org/admin/**`、audit                                         | 页面/API 测试通过            | 幂等、版本冲突、隔离通过     | 邮件邀请外部阻塞               | 部分通过             |
| 趋势               | `/trends/**`                                                   | 正常/缺参/权限通过           | 刷新/治理幂等与读写隔离通过  | 真实来源依赖部分阻塞           | 部分通过             |
| 机会/评分/利润     | `/opportunities/**`、score/cost/profit                         | 正常/边界/权限通过           | 幂等/并发/数据范围通过       | 第三方采集阻塞                 | 部分通过             |
| 竞品               | `/competitors/**`、monitor-rules                               | 本地通过                     | 重复采集/动作幂等通过        | 真实平台登录/风控阻塞          | 部分通过             |
| 供应链             | `/sourcing/**`、cost rules/rates/reviews                       | 本地通过                     | 幂等/审批/权限通过           | 真实 1688 阻塞                 | 部分通过             |
| 任务与审批         | `/tasks/**`                                                    | 通过                         | 状态机、并发、终态幂等通过   | 长期超时演练未生产验证         | 通过（生产演练除外） |
| 通知/SSE           | `/notifications/**`、preferences、`/realtime/events`           | 站内通过                     | 用户隔离/批量幂等通过        | 邮件依赖阻塞                   | 部分通过             |
| 自动化             | `/automations/**`、subscriptions/reviews                       | 通过                         | 执行幂等/权限通过            | 外部通知动作受渠道阻塞         | 部分通过             |
| 报表               | `/reports/**`、`/report-exports/**`                            | 通过                         | 幂等生成/短期下载授权通过    | 超大导出未压测                 | 部分通过             |
| 来源与适配器       | `/platform/providers/**`、provider-sources/**                  | 本地合同通过                 | 版本/回放/审批幂等通过       | 第三方真实生命周期阻塞         | 部分通过             |
| 凭证与浏览器运行   | credential-assets、crawler-profiles/runtime                    | 密文/轮换/撤销合同通过       | 租约/版本/平台权限通过       | 真实 Cookie/验证码阻塞         | 部分通过             |
| 采集任务           | collection tasks/console/internal crawler runtime              | 本地全链通过                 | 领取/心跳/完成/重放幂等通过  | 第三方和生产重启全周期部分阻塞 | 部分通过             |
| 数据质量/证据      | data-quality/evidence/download                                 | 通过                         | 组织隔离/短期授权通过        | 大文件/磁盘故障阻塞            | 部分通过             |
| 平台账号/内容/消息 | dashboard/management/**                                        | 页面/API 测试通过            | 超级权限/审计/幂等通过       | 邮件动作受 Provider 阻塞       | 部分通过             |
| 备份/发布/韧性     | operations backup/releases/topology/redis/mysql/files/capacity | 本地合同与页面通过           | 高危动作原因/幂等通过        | 生产故障、恢复、发布阻塞       | 部分通过             |
| 安全               | security operations/audit                                      | 权限、脱敏、会话处置通过     | 跨租户/审计通过              | 真实攻击与生产故障非全覆盖     | 部分通过             |
| 开放平台           | platform/open/**                                               | 参数/scope/配额/签名合同通过 | nonce/重放/幂等通过          | 真实外部接收端阻塞             | 部分通过             |
| 商业运营           | commercial plans/assignments/usage                             | 通过                         | 幂等/审计/权限通过           | 支付/发票不在范围              | 通过（范围内）       |

## 3. 必测维度执行状态

| 维度                       | 当前证据                                     | 结论                                |
| -------------------------- | -------------------------------------------- | ----------------------------------- |
| 正常请求、缺参、类型、边界 | API/合同/页面测试覆盖核心组                  | 核心通过；不能推定所有 256 操作     |
| 未登录、无权限             | 会话守卫、能力守卫与 E2E                     | 广泛覆盖                            |
| 跨租户                     | tenancy、RBAC、resource grants、业务仓储测试 | 核心写读链通过                      |
| 重复/并发/幂等             | idempotency migrations、状态机和批次回归     | 核心写链通过                        |
| 超时/第三方失败            | 可控注入与 Worker 状态                       | 本地覆盖；真实外部阻塞              |
| 数据库异常                 | 关键路径错误合同                             | 未逐 256 操作断开数据库，标记未验证 |
| 返回结构/状态码/错误码     | OpenAPI + envelope contract                  | 通过合同校验                        |
| 分页/排序/筛选             | 页面批次与 repository 测试                   | 有列表的核心接口通过                |
| 日志和审计                 | request_id/trace_id、audit/outbox            | 核心写链通过                        |

## 4. 问题记录

### API-001（P2）逐 256 操作异常注入证据仍待补齐

- 模块：全接口；类型：测试覆盖。
- 描述：schema 3 已为 OpenAPI 的 256 个操作生成唯一 `method_path_v1` ID，并逐项记录正常、鉴权、参数、幂等和故障测试 ID/最近结果；当前证据仍不能证明每个操作都执行过数据库断开、超时和第三方失败，未执行维度保持 `not_run`。
- 复现：对照 `docs/openapi.yaml` 与测试中的请求路径；接口覆盖页不得把“已注册”当“已实测”。
- 预期：每个 operationId 有正常、鉴权、参数、幂等及适用故障用例 ID。
- 实际：256/256 均可机器审计；核心业务组有证据，长尾管理/运维操作的幂等、并发与故障维度仍存在 `not_run`。
- 证据：OpenAPI、`tests/`、`/platform-admin/api-coverage`。
- 涉及文件/接口/数据：全 OpenAPI；无单一表。
- 影响：发布信心；严重度：P2。
- 建议：在隔离故障环境和明确维护窗中继续填充现有 manifest，不新建平行清单；覆盖页只读取同提交、同指纹的实测结果。
- 验收：256/256 operation 至少有正常+未登录/无权+参数合同；写接口再有幂等/并发，依赖型接口有故障用例或明确不适用。
