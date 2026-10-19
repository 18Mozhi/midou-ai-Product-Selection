# 采集保护与历史健康检查分开显示

2026-10-19真实采集总览显示Amazon正常，但只读来源表与Worker表证明其runtime circuit仍open。原总览只读取provider_adapter_health，旧ready和检查失败0不能表达Worker后续熔断。14:46使用新编译仓库实际产生的SELECT在生产MySQL5.7执行，245行/21ms/写入0：Amazon旧检查2026-10-18T15:15:18.898Z为ready，当前open、连续失败5、原因validation_failed、打开时间2026-10-19T00:10:09.501Z；1688当前closed/0，旧健康检查时间仍保留。

GET /platform/collection/console的sources只读投影复用既有适配器接口字段名：runtime_circuit_state、runtime_consecutive_failures、runtime_last_error_code、runtime_circuit_opened_at。通过provider_id左连接既有provider_runtime_circuits，不修改库结构；无运行行返回null，不编造closed或0。原health_status、consecutive_failures、last_checked_at不变，分别仍是最近健康检查事实。来源本来就是平台全局定义，任务/质量/尝试/死信的原组织、工作区、来源与时间范围不变。

桌面分列配置、采集保护、最近健康检查；手机摘要显示当前熔断并明确“上次检查”。open显示已暂停（熔断），closed只显示未熔断而非保证健康，null显示采集保护未观测。实际熔断来源优先进入原前8条；技术详情保留原错误码、熔断时间和健康检查失败数。原重放、确认、权限、审计、分页、焦点、失效读取与来源恢复规则均不改变，不清除熔断或改写历史失败。

无新环境变量、依赖、配置、路由或Python输入，env.example不适用；OpenAPI和feature map同步现有GET响应的四个可空字段。官方deploy-baota.py发布后由宝塔重启Node加载API，并刷新采集总览加载前端；无需调参数。页面事实准确不等于来源恢复、全站UI签收或每日100品达标。

5项服务/仓库定向检查通过；无记录的四个运行字段均null，旧ready/0与当前open/7可并存且各自保留。真实HTTP合成持久层验证平台权限与响应，原截获响应测试覆盖操作失败/失效读取/重放；6项定向复查和最终50项桌面/390px浏览器检查通过。初轮样式调整期间手机重放勾选超时，固定代码后单独复查与全量重跑均通过，未弱化确认断言。22工作区完整构建及文档/运行一致性/静态分析/格式/发布矩阵门通过；截图仅新增circuit名称两张，历史commerce截图未改。

本轮3个临时测试输出目录删除被自动审批策略拒绝，未重试或绕过，路径见.artifacts/selection-production-20261018/collection-circuit-cleanup-handoff.json并串接前轮清理链。4167/5237测试服务已退出，未新增常驻进程；verification/state.json原有用户修改保持未暂存。

## 发布与恢复回读

c64c2231已通过官方发布前检查和22工作区构建，但初次发布命令公网验收阶段失败，最后错误是本地TLS EOF。没有据此重复部署：SSH实测3306已通、4101拒绝；本项目启动日志有两条结构化ECONNREFUSED、address=127.0.0.1、port=3306，证明Node启动时数据库不可用，不是仅公网观测异常。未证实本次是OOM，不把旧故障原因套用到本次。

先将本项目原日志归档到/www/wwwroot/ai选品/runtime/evidence/deploy-c64c2231-startup-db-refused-20261019.log（0640），再调用宝塔restart_project.py nodejs ai选品，退出0、4101恢复。15:01:58官方verify_public在原TLS验证下全部通过：live/ready/available/version/knownRoute/missingRoute/browserHelper。随后调用同一发布脚本cleanup_source清理本次rollback材料；本地临时部署包也已由原上下文清理。没有降低TLS验证、改动MySQL全局参数或启动面板外服务。

真实Chrome1920px总览第一条Amazon显示已暂停（熔断）/连续失败5，历史正常检查仍为2026/10/18 23:15:18；390px可见摘要同样写明已暂停与上次检查正常，无横向溢出。已恢复视口并关闭验证标签。15:00:32本工作区今日completed_count仍0，Amazon仍open/validation_failed，1688 closed的健康时间仍旧记录，不宣称本次探测六节点成功。人工重启恢复只证明当前服务已恢复，不证明依赖故障后的不间断自愈；该真实缺口仍需继续处理。本文回执为文档提交，无需再次部署。

15:03线上编译仓库SHA256为7cd339a29e098d9e6832efd537e46bb180978ffe0b9b8422fa5b0f8a52529b90，与本地一致；同一新查询再次只读返回245行/21ms，两个来源的运行状态与页面一致。没有写入采集业务事实。
