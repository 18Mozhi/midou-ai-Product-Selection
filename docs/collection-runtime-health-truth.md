# 采集保护与历史健康检查分开显示

2026-10-19真实采集总览显示Amazon正常，但只读来源表与Worker表证明其runtime circuit仍open。原总览只读取provider_adapter_health，旧ready和检查失败0不能表达Worker后续熔断。14:46使用新编译仓库实际产生的SELECT在生产MySQL5.7执行，245行/21ms/写入0：Amazon旧检查2026-10-18T15:15:18.898Z为ready，当前open、连续失败5、原因validation_failed、打开时间2026-10-19T00:10:09.501Z；1688当前closed/0，旧健康检查时间仍保留。

GET /platform/collection/console的sources只读投影复用既有适配器接口字段名：runtime_circuit_state、runtime_consecutive_failures、runtime_last_error_code、runtime_circuit_opened_at。通过provider_id左连接既有provider_runtime_circuits，不修改库结构；无运行行返回null，不编造closed或0。原health_status、consecutive_failures、last_checked_at不变，分别仍是最近健康检查事实。来源本来就是平台全局定义，任务/质量/尝试/死信的原组织、工作区、来源与时间范围不变。

桌面分列配置、采集保护、最近健康检查；手机摘要显示当前熔断并明确“上次检查”。open显示已暂停（熔断），closed只显示未熔断而非保证健康，null显示采集保护未观测。实际熔断来源优先进入原前8条；技术详情保留原错误码、熔断时间和健康检查失败数。原重放、确认、权限、审计、分页、焦点、失效读取与来源恢复规则均不改变，不清除熔断或改写历史失败。

无新环境变量、依赖、配置、路由或Python输入，env.example不适用；OpenAPI和feature map同步现有GET响应的四个可空字段。官方deploy-baota.py发布后由宝塔重启Node加载API，并刷新采集总览加载前端；无需调参数。页面事实准确不等于来源恢复、全站UI签收或每日100品达标。

5项服务/仓库定向检查通过；无记录的四个运行字段均null，旧ready/0与当前open/7可并存且各自保留。真实HTTP合成持久层验证平台权限与响应，原截获响应测试覆盖操作失败/失效读取/重放；6项定向复查和最终50项桌面/390px浏览器检查通过。初轮样式调整期间手机重放勾选超时，固定代码后单独复查与全量重跑均通过，未弱化确认断言。22工作区完整构建及文档/运行一致性/静态分析/格式/发布矩阵门通过；截图仅新增circuit名称两张，历史commerce截图未改。

本轮3个临时测试输出目录删除被自动审批策略拒绝，未重试或绕过，路径见.artifacts/selection-production-20261018/collection-circuit-cleanup-handoff.json并串接前轮清理链。4167/5237测试服务已退出，未新增常驻进程；verification/state.json原有用户修改保持未暂存。
