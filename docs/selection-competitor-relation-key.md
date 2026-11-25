# 竞品相关性证明的主键定位

## 改动与边界

`selectionCompetitorRelevanceSql` 在原 BINARY subquery_id 校验之前增加
`q_relation.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.subquery_id')) USING ascii)`。
正式 MySQL 5.7 的 collection_subqueries.id 为 CHAR(36)/ascii_general_ci；新增等式仅供主键定位。
原 BINARY 残余条件逐字节验证身份，大小写、外来账号、历史链、指纹、原证据、最新分类及最低五个详情证明全部保留。
原条件成立时 ASCII 主键转换无损；转换碰撞仍会被原 BINARY 条件拒绝。

无新增环境变量、API 字段、配置、依赖、索引或数据库写入，不调并发、轮询或任务顺序。
共享数据库包由 Node API/Worker 消费；前端、插件、Python 的输入输出不变。

## 已观察证据

同一个只读一致性快照、冻结 NOW(3)、同输入 SQL_NO_CACHE 回放：旧查询24553ms，
新增主键定位1676ms，恢复旧查询24583ms，三次结果行数及 SHA256 完全相同。
Handler_read_next 从5494344降至315240；EXPLAIN 显示 q_relation 使用 PRIMARY/eq_ref，
n_relation 从账号/provider 范围扫描175行改为 PRIMARY/eq_ref 单行定位。
这是指定候选查询的验证，不代表全部锁压力或整体吞吐已解决。
DBA 原有受限身份执行三次只读阻塞链采样均为空；不据此排除间歇锁等待，也不以全局累计/漂移指标替代阻塞链。

定向测试固定原 SQL 全文哈希：只移除新增定位条件后必须与原谓词一致。
既有两项账号迁移前的组织/工作区断言在原版和修改版同样失败，不能声称全库测试全绿。

## 单模块发布与回退

仅从干净、已验证且已推送 main 的提交，通过正式协调器执行：

```powershell
python -B scripts/deploy-account-baota.py --collection-relation-key-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 91c303c724e6b2acfc92370c8cd1ab9edf797e8566e7439292085ef8ab823a87
```

只替换 backend/packages/database/dist/selection-completion-policy.js，校验当前全部采集修复与趋势投影覆盖，
只通过宝塔重启 Node ai选品；不重启 Python、不修改 AI 节点、1688、数据库或备份任务。
无需用户调参。发布后回读模块哈希、服务健康及自然任务，不手动领取或重放死信。
若需回退，使用同一协调器 `--collection-relation-key-rollback`，expected-module-sha256 为候选模块哈希
4319719331111246d1c3bc29853d78e711768b52d1b8c2c47a1b7bc2143cfd48；从944d0c7d原 Git 源本地重建原模块，
不创建生产回退副本，不回退其他模块。

## 发布后异常（不能视为完整发布成功）

模块已安装并由 Node 加载，但协调器在 Node 重启返回后检测到 Python 身份变化而拒绝验收。
Python 日志显示领取租约的 urllib 调用发生 RemoteDisconnected，未被现有 URLError/TimeoutError 分支捕获；
既有守护机制随后自动恢复进程。没有执行额外 Python 重启，不绕过身份保护或重复发布。
本地将该已证实异常映射到现有 crawler_api_unavailable，复用原最多四次传输重试和退避；
心跳仍最多一次，退出/停止、幂等键、租约及完成回执格式不变，不捕获任意业务异常。
该 Python 修复先本地验证；生产应用仍须获得明确 Python 发布/恢复授权。

## 已授权的 Python 单模块恢复

用户已明确允许修复并通过宝塔恢复 ai选品-python。协调器新增
`--collection-python-transport-only` / `--collection-python-transport-rollback`，
沿用相同 expected-previous-sha；发布时 expected-module-sha256 为
8b229dcb7477ca4fca69a68bd8f0f12d6a597798486e9dd5a53e0901ddd6d7b5，回退时为
396d2e9cd3fa944fb8f469998bd00598c5861e0bb64d7f68a3b5905335a4cad0。
从干净提交的 Git 原字节仅替换 python/scoutops_crawler/runtime_transport.py，
原模块从 a62ef7b95 Git 源恢复，无生产副本。
仅调用宝塔 Python ai选品-python 重启命令，要求 Python 新身份且 Node API/Worker 身份保持；
同时保护已安装的竞品主键定位、趋势投影、全部采集修复和其他 Python 核心模块。
没有新增调参项，API 短暂断连仍采用原有最大四次传输重试与主循环退避。
