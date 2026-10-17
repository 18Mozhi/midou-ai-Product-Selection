# 删除快捷入口接口中的退休任务创建

成员端已删除手动任务创建，但DiscoveryService仍向task:create持有者返回task快捷项，指向/tasks?create=1。删除该项和三种shell优先级列表中的task，避免接口继续宣传失效手动流程。

保留发起找货、邀请成员、创建工作区和配置来源条目及其能力过滤、相对排序。仅删除已退休任务项，不改变其他入口的权限、路由或语义。历史GET /api/v1/me/quick-actions保留原请求、响应DTO、会话/shell校验、private,no-store和关联编号；没有业务写入。当前浏览器搜索组件已不读取该接口，全局搜索、任务详情深链与组织审批不变。

定向验证包含真实DiscoveryService三个shell的完整列表/仅task:create/无权限输入，以及Fastify注入实际路由加真实服务的六个请求，确认返回空列表或保留管理项、无task项、无缓存和request_id保留；鉴权为既有隔离stub，不代表生产RBAC验收。M02-05共9项通过，API与Backend构建通过。

本项改变历史导航列表内容，没有新增字段、环境变量、配置或依赖，也不访问数据库。OpenAPI、Feature Map和M02-05说明同步；Contracts类型、Python任务输入和前端无对应结构变更。发布API/Backend运行包后，通过宝塔重启Node项目ai选品生效，不需要Python重启；未部署。旧UI阶段的前端静态更新要求不替代本项Node重启。

现有宝塔重启命令：`/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品`。本轮只完成本地变更，不执行发布或重启。

扩大验证：M02-05、既有任务业务合同及生产API探针回归共14项通过；73路由/153文档与运行文档检查通过。未重跑前端浏览器测试，因为当前前端不调用该接口、无前端代码变更；现有任务和审批深链继续保留。本项不代表/work、/tasks通用目录已退休，也不代表每日100个真实整链通过。

没有创建临时文件、浏览器或监听服务，应用注入实例由finally关闭。原verification/state.json保持原字节，不提交。
