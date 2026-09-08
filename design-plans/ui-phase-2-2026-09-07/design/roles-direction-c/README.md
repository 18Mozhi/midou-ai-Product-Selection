# ROLE-C-r1 · P31角色与权限

用户已选C方向，本页具体图稿仍待审核。独立交付48张双端图和可交互HTML，不是Vue实现、权限调整或生产部署；不覆盖任务、评分规则、原A/B研究或真实Vue基线。

[打开交互稿](index.html) · [P31规格](../../page-specs/P31.md) · [C方向记录](../../DIRECTION-DECISION-C.md)。浏览器打开本地HTML即可，不启动服务。顶部为审核工具，蓝色区域的三个分区对应现有角色/范围/授权功能，不是修改权限的开关。

## 48张双端图

24场景×1440/390。创建、延期仍是页面内表单，只有撤销原因是弹窗；没有把四种资源类型误计为四个弹窗。页面用全页PNG，撤销使用真实视口PNG。移动长表单图保持390px原始宽度，浏览器可以原尺寸查看，不以压缩字体缩短页面。

| 场景               | 桌面1440                             | 移动390                             |
| ------------------ | ------------------------------------ | ----------------------------------- |
| 角色目录与能力矩阵 | [图](1440-roles.png)                 | [图](390-roles.png)                 |
| 审计员详情         | [图](1440-role-auditor.png)          | [图](390-role-auditor.png)          |
| 技术能力展开       | [图](1440-role-technical.png)        | [图](390-role-technical.png)        |
| 角色搜索无结果     | [图](1440-role-query-empty.png)      | [图](390-role-query-empty.png)      |
| 角色目录为空       | [图](1440-roles-empty.png)           | [图](390-roles-empty.png)           |
| 能力筛选无结果     | [图](1440-matrix-empty.png)          | [图](390-matrix-empty.png)          |
| 成员数据范围       | [图](1440-scopes.png)                | [图](390-scopes.png)                |
| 成员筛选无结果     | [图](1440-scopes-empty.png)          | [图](390-scopes-empty.png)          |
| 指定资源授权       | [图](1440-grants.png)                | [图](390-grants.png)                |
| 授权技术标识展开   | [图](1440-grant-technical.png)       | [图](390-grant-technical.png)       |
| 授权状态无结果     | [图](1440-grants-filter-empty.png)   | [图](390-grants-filter-empty.png)   |
| 当前页搜索无结果   | [图](1440-grants-search-empty.png)   | [图](390-grants-search-empty.png)   |
| 无指定资源授权     | [图](1440-grants-none.png)           | [图](390-grants-none.png)           |
| 无授权但仍有角色   | [图](1440-roles-no-grants.png)       | [图](390-roles-no-grants.png)       |
| 只读授权详情       | [图](1440-grants-readonly.png)       | [图](390-grants-readonly.png)       |
| 创建任务授权       | [图](1440-create-task.png)           | [图](390-create-task.png)           |
| 创建机会授权       | [图](1440-create-opportunity.png)    | [图](390-create-opportunity.png)    |
| 创建竞品授权       | [图](1440-create-competitor.png)     | [图](390-create-competitor.png)     |
| 创建供应链授权     | [图](1440-create-sourcing.png)       | [图](390-create-sourcing.png)       |
| 创建期限错误示例   | [图](1440-create-invalid-expiry.png) | [图](390-create-invalid-expiry.png) |
| 创建中（模拟）     | [图](1440-create-busy.png)           | [图](390-create-busy.png)           |
| 延期保存中（模拟） | [图](1440-extend-busy.png)           | [图](390-extend-busy.png)           |
| 撤销原因           | [图](1440-revoke.png)                | [图](390-revoke.png)                |
| 撤销原因不足       | [图](1440-revoke-invalid.png)        | [图](390-revoke-invalid.png)        |

## 设计与边界

使用frontend-design技能，将C的蓝色范围区、白色工作面和分层圆角应用于P31三个相互独立的数据集：固定角色决定动作，成员范围决定记录，资源授权只处理单个资源例外。角色目录与详情关联阅读，能力矩阵只读；没有可勾选赋权、创建角色或编辑角色模板的伪入口。

移动角色选择与详情纵排，矩阵保留“具备/未授予”文字和独立横向滚动，不撑宽文档。范围按人展示，技术代码和UUID渐进展开。创建/延期为页面内表单，保留已有流程；撤销弹窗先说明目标再填写原因，取消/Escape返焦，Tab双向循环。

字段与动作依据OrganizationRolePanel、OrganizationAdminCenter、AuditedReasonDialog及use-audited-reason：

- 创建字段：工作区、资源类型、精确UUID、同组织活动目标成员、动作、500字原因、到期时间。创建初态为当前工作区、opportunity、首项只读动作和7天后期限，保持已有父组件初始化；资源编号/目标成员/原因不预填。类型切换重置为该类首项动作，不沿用上一类型的已选动作。
- task只含task:read/task:update；opportunity只含opportunity:read/opportunity:decide；competitor只含competitor:read；sourcing只含sourcing:read/supplier_quote:manage/cost:confirm。没有下载、导出、凭证或任务重放，也不增加跨组织身份。
- 延期仍是500字变更原因和新期限；不推断必须大于旧期限，不新增生产业务规则。期限沿当前代码校验未来且不超过30天，浏览器最小值为校验时钟后1分钟。设计不改变POST/PATCH方法、expected_version或后端Guard。
- 撤销使用原初始值“撤销指定资源授权”，trim后至少2字；原组件没有maxlength，所以不套用其他表单的500字限制。确认只演示关闭，不撤销实际授权，也不虚构审计成功。
- 创建/延期模拟忙碌时，提交、延期、撤销及状态筛选保持禁用；改变资源类型或动作不能清除忙碌态。类型/字段本身是否可编辑沿现有控件，不自作主张改变业务权限。
- 无授权、某状态无授权、当前页搜索无结果、角色搜索无结果、角色目录为空分别呈现；零授权不清空角色或矩阵。授权搜索仍只针对当前页，不变成全组织搜索。

## 样本与时间说明

data.js是人工核对后的`tests/e2e/m06-01-organization-admin.spec.ts`明确子集，原源文件及所有设计/验证源哈希存于evidence.json。哈希检验只证明当前源未漂移，不证明自动抽取了全部业务事实。

两种角色、三项能力来自原角色目录；三个成员来自members.items（包含原测试的锁定账号记录，未推断其可登录或可被授权）；可授权目标只有grant-targets返回的陈采购，不把全部成员当候选。成员范围计数0/0/1/2按原成员scope计算，当前会话组织范围单独展示；不使用其他组织摘要的128成员等数字代替本页面目录。

唯一授权来自activeGrant，resource_id尾号624、授权625、第1版，原因“采购团队核对供应报价”，到期2026-09-01 18:00。effective_status=active来自历史隔离返回，不代表该授权当前在线有效。状态计数对应原隔离GET的all/active一条、expired/revoked零条；并未查询线上库或证明跨页。

为稳定演示未来/30天边界，明确选用**2026-08-28 18:00北京时间**作为设计校验时钟，初始期限由其加7天得到2026-09-04 18:00。这是验证时钟，不是接口观测时间、当前实际时间或业务默认值；顶部工具与证据均记录它。生产仍应按真实运行时钟计算，未改任何环境变量或业务期限。

## 复验与运维

```text
node scripts/verify-ui-phase2-roles-c.mjs --capture
node scripts/verify-ui-phase2-roles-c.mjs
```

capture生成48张永久图/evidence，无参数只读核对图片/源码哈希和双端24场景。浏览器验证角色/能力/范围/授权筛选与重置、零授权保留角色、矩阵独立滚动、四类动作及切换、目标白名单、UUID、未来/30天期限、取消保留、只读隐藏、忙碌态、原因最小长度/初值/无虚构上限、焦点循环/返焦。非复选控件16px/44px和文字13px起有计算尺寸检查；复选框20px配44px标签行。HTTP/控制台错误/存储均为0，不等于真实RBAC、API或全读屏验收。

只使用已有Playwright与指标助手；finally关闭浏览器，无测试服务、依赖安装、运行配置或重启需求。所有新图、HTML和证据均为永久交付，本批没有临时测试文件遗留。

## 待审和未完成

请审核三分区区分、角色与矩阵密度、页面内授权表单和撤销风险提示。六角色全目录、复杂能力域、多授权分页/长文本、所有状态/按钮六态、三主题/密度、中间断点/缩放、真实API/版本冲突/审计/权限以及Vue实现仍待完成。完整73页、全站部署和用户验收没有完成，不改coverage审批或冻结分母。此稿可继续审核，不能作为生产权限设计已验收的证明。
