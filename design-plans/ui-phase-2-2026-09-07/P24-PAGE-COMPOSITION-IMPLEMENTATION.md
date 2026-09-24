# P24 任务详情 C 方向生产实施

## 范围

将用户已批准的 P24 C 方向接入真实 `/tasks/:taskId` 路由：蓝色任务标题、事实卷宗、权限操作区、活动与评论；桌面采用事实/操作双列，390px 移动端改为单列。原生暂停、取消、延期、转交、进度动作弹窗沿用已部署的 `TaskActionDialog` 实现。

## 保留的运行合同

- 详情继续通过 `GET /tasks/{taskId}` 与 `GET /tasks/member-options` 读取；返回目录仍使用既有 `returnPath`。
- 任务事实继续消费既有服务响应；阶段、阻塞与下一负责人沿用现有 TaskWorkspace 派生逻辑。
- 所有写操作仍由 TaskWorkspace 持有，TaskDetailPanel 仅发出原有 emit；动作名、字段、`expected_version`、权限谓词、读后刷新与审计流程未改。
- 404、读取错误、会话失效及无权限状态继续使用原状态渲染；本批不新增 API、路由、权限、字段、数据库结构或依赖。

## 实施内容

- TaskWorkspace 在直达详情态显示任务语境标题和返回目录入口，不改变目录/今日工作视图。
- TaskDetailPanel 从侧栏式详情改为 dossier 主内容，集中展示版本/来源、状态/进度、期限、负责人、阻塞、采集关联、技术信息及活动/评论。
- 当前有效主操作与“更多任务操作”按既有 `canUpdate`、`canAssign` 及终态条件显示；只读角色没有写入入口。
- 新增仅作用于 `.task-detail-route` 的桌面与移动排版、键盘焦点样式；既有动作弹窗样式保持并与新详情布局共用。
- 更新 M05-01 桌面/移动浏览器快照，作为这次经批准的视觉变化基线。

## 验证证据

- `node --test tests/unit/task-detail-page-preview.test.mjs`：通过。
- `npm run typecheck:web`：通过。
- `node scripts/run-playwright-projects.mjs tests/e2e/m05-01-business-tasks.spec.ts --update-snapshots`：桌面 23/23、390px 移动 23/23 通过；包含只读权限、直达/404、五类动作弹窗、评论、任务中心读写行为。
- 页面级测试采用仓库隔离响应；不证明真实登录身份、RBAC、数据库写入、并发版本冲突、生产错误率或 M07-03 正式验收。

## 发布状态

本实施记录不以本地构建或夹具测试代表部署。commit、push、宝塔部署、线上版本 SHA 与资源核验结果将在发布完成后追加。
