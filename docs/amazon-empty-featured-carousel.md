# Amazon空搜索附带推荐轮播

2026-10-19T12:50:07.548Z，浏览器作业2bdb8994-7c04-44eb-a045-ec36181891bc对Waymo vehicle accessories搜索返回succeeded_empty。原DOM含s-main-slot、MAIN-MESSAGING-0的明确No results消息及拼写建议；后方loom-desktop-inline-slot_featuredasins-heading标题Customers frequently viewed下有推荐ASIN，而没有实际s-search-result。Node旧消费者拒绝页面中任意ASIN，父任务1b1e9507-f2eb-4ba4-9bea-1c58732e0216于是source_changed，触发全局Amazon来源自动停用。这是同一来源故障诊断，不将另一工作区数据计作当前工作区成果。

只兼容该已观测推荐标题、位于空消息之后的结构。保留整页验证码/产品详情/真实搜索卡片拒绝，标题之前有ASIN仍拒绝；必须浏览器succeeded_empty且空消息及建议均成立。结果始终为零，推荐商品不转为搜索事实。未知结构保持失败关闭，不能仅凭此修复直接改数据库启用来源。

永久测试覆盖推荐轮播零结果，以及未知标题、真实卡片、前置ASIN、验证码、非空状态拒绝。无新增字段、API、权限、环境、数据库迁移、依赖或Python改动；生产者结果及原证据不修改。通过固定deploy-baota.py发布并宝塔重启Node后生效，无可调参数。发布后另行核实原证据解析及来源状态；每日100验收保持未通过。

## 线上复核

提交dfe02ed1018ea432bec3c589eacf6afebc2ecb0f已按宝塔固定流程部署，退出码0，临时发布包已删除。57项相关测试、22个工作区构建及发布门禁通过。17:16:48Z只读调用线上新解析器处理数据库保留的同一原始result_json，返回0条记录，原作业状态及finished_at未修改；模块SHA256为83f80cbcd0efd93c0a700e9d1980b9553b3b5384f29f8ec587466a5e6001dead，与本地相同。

此时Amazon来源仍disabled、circuit closed，1688来源enabled/closed。北京时间10月20日本工作区整链完成仍0。原样本ac0aacd2已有11个商品及快照（数量不单独证明有效竞品门），评分65.85、利润未知、观察，评估等待automatic_cost_scope_mismatch；旧“尚无竞品”的记录不能视作最新状态。本轮未启动本地临时服务或创建临时测试文件，永久回归保留；用户verification/state.json未改动。

随后在原管理界面发起一次真实浏览器健康检查，17:17:38.182Z记录ready、版本97、25323ms、无错误。通过原来源表单仅将发布状态恢复已启用，条款原已批准，保存版本21；列表刷新、重开表单及数据库读取一致，未直接改库或清零熔断。17:18:53Z核对enabled/closed、连续失败0；恢复后另一工作区自然任务d92473d0-2c81-48c1-8e84-8147959f9340在17:18:19–17:18:43Z成功，接续任务cfe4dbbb-363a-4f46-9320-811871a043e1正在运行。此处只证明共享来源已恢复处理，不能计入本工作区整链成果；本工作区当日完成仍0。
