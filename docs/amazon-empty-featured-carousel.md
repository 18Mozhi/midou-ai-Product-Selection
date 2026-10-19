# Amazon空搜索附带推荐轮播

2026-10-19T12:50:07.548Z，浏览器作业2bdb8994-7c04-44eb-a045-ec36181891bc对Waymo vehicle accessories搜索返回succeeded_empty。原DOM含s-main-slot、MAIN-MESSAGING-0的明确No results消息及拼写建议；后方loom-desktop-inline-slot_featuredasins-heading标题Customers frequently viewed下有推荐ASIN，而没有实际s-search-result。Node旧消费者拒绝页面中任意ASIN，父任务1b1e9507-f2eb-4ba4-9bea-1c58732e0216于是source_changed，触发全局Amazon来源自动停用。这是同一来源故障诊断，不将另一工作区数据计作当前工作区成果。

只兼容该已观测推荐标题、位于空消息之后的结构。保留整页验证码/产品详情/真实搜索卡片拒绝，标题之前有ASIN仍拒绝；必须浏览器succeeded_empty且空消息及建议均成立。结果始终为零，推荐商品不转为搜索事实。未知结构保持失败关闭，不能仅凭此修复直接改数据库启用来源。

永久测试覆盖推荐轮播零结果，以及未知标题、真实卡片、前置ASIN、验证码、非空状态拒绝。无新增字段、API、权限、环境、数据库迁移、依赖或Python改动；生产者结果及原证据不修改。通过固定deploy-baota.py发布并宝塔重启Node后生效，无可调参数。发布后另行核实原证据解析及来源状态；每日100验收保持未通过。
