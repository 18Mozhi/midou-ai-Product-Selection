# 《端到端联合流程测试报告》

## E2E-01 身份与租户

- 前置：本地/测试数据库；测试用户、组织、工作区。
- 角色：匿名→member。
- 步骤：注册→验证合同→登录→MFA（适用时）→选择组织/工作区→首页→退出。
- 预期/实际：会话、上下文、菜单和数据范围一致；本地链通过，真实邮件发送阻塞。
- 页面：P02-P12；接口：auth/me/org/context；数据：users/sessions/tokens/org/workspace/membership/context；后台：auth_delivery。
- 日志证据：AUTH tests、request/trace；结论：部分通过。

## E2E-02 选品主链

- 前置：测试成员、真实本地 MySQL/Redis/Worker/Python/Chromium，已配置可用测试来源。
- 角色：selection_manager + procurement_member。
- 步骤：趋势筛选→创建机会→提交采集→Worker 领取→Python/Playwright→解析清洗入库→机会详情→评分→利润→竞品→供应链报价→决策→任务→报表导出→审计。
- 预期/实际：本地真实桥接与业务投影通过；Amazon/1688 真实登录/验证码全周期阻塞。
- 页面：P14-P28、P46-P55、P62/P70；接口：trends/opportunities/collection/competitors/sourcing/tasks/reports；数据：趋势、机会、采集、证据、评分、利润、竞品、供应商、任务、导出、审计；后台：collection、projection、scoring、profit、monitor、sourcing、report。
- 日志证据：crawler-chain、页面批次截图、collection/log/topology；结论：部分通过。

## E2E-03 组织治理

- 前置：测试组织和至少两名测试成员。
- 角色：organization_admin、auditor。
- 步骤：邀请→成员激活合同→分配角色→创建工作区/团队→资源授权→审批模板→令牌创建/轮换/撤销→组织审计。
- 预期/实际：除真实邀请邮件外，本地 UI/API/DB/审计链通过。
- 页面：P29-P37；接口：org admin/roles/grants/tokens/audit；数据：memberships/roles/scopes/grants/tokens/audit；后台：auth_delivery/notification。
- 结论：部分通过。

## E2E-04 平台来源治理

- 前置：测试来源、固定解析样本、测试凭证档案。
- 角色：platform_operations_admin + platform_super_admin。
- 步骤：注册来源→配置版本→适配器健康→凭证档案→固定样本→回放→审批→采集任务→证据/质量→数据中心→日志/拓扑。
- 预期/实际：本地链通过；真实第三方登录/风控和长期恢复阻塞。
- 页面：P46-P55、P61-P63、P66/P70；数据：provider/config/credentials/tasks/evidence/issues/operations；后台：automatic sources、collection、core projection、crawler。
- 结论：部分通过。

## E2E-05 发布与恢复

- 前置：宝塔测试/生产维护窗、隔离恢复库、允许的备份目录。
- 角色：平台运营+审批人。
- 步骤：容量签认→安全/测试门禁→备份→发布写探针→上传运行包→宝塔重启→健康/核心链验收→失败时回滚→恢复演练。
- 预期：所有对象在宝塔可见，服务器不 Git/build，不使用隐藏服务。
- 实际：本地合同、页面和脚本存在；本轮没有生产发布/恢复授权，真实执行阻塞。
- 页面：P61-P71；接口/数据：operations/releases/backup/capacity；后台：宝塔管理任务。
- 结论：阻塞，不能写成生产通过。
