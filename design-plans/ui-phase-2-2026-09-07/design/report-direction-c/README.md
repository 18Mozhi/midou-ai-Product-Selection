# P28 报表与导出 · REPORT-C-r1

状态：C 方向独立审核稿，具体页面尚未获审；不是 Vue 实现、全站完成或部署证明。

[打开交互原型](index.html)。直接打开文件即可，无需启动服务。顶部“审核场景”切换合成状态，查看按钮记录的请求意图。业务区没有日期筛选、取消、删除或 PDF/Excel 操作。

## 构图与技能取舍

frontend-design 用于按已选 C 方向建立蓝色类型目录、白色报表阅读面和独立文件队列。色板为目录蓝 #254a9c、深蓝 #193b80、正文 #202c3d、辅助 #58677b、底色 #edf1f6、分隔 #dbe1e9；内容面纯白。中文使用 Microsoft YaHei UI / Microsoft YaHei；左对齐，字号层级 25/23/19/16/14/13，操作控件至少 16px、44px 热区。1440 桌面左目录，390 手机蓝色横向类型导航。分布采用横条配真实读数，不以最小柱高夸大零值。

计划复核：不沿用旧纵柱图和同规格卡片堆叠；推荐状态与采纳决策拆开，不相加。团队使用组织人数与本工作区任务两种明确口径，不发明“绩效分”。下载与再生成放在文件队列，唯一详情窗容纳生命周期/期限/队列依据。截图目检后删除详情重复 ETA 和内部权限代码，保留关闭与底部主动作。

## 事实边界

- 原始三类报表、四条导出及新记录响应从现有 m05-06 E2E 的 AST/回调提取，data.js 与源执行结果深比较；不是生产数据。
- 原团队夹具 summary 为 6 人、29 完成，三条 series 合计 22。不补造其余成员、不宣称明细完整。原导出 ETA 在 8 月，校验时钟为 2026-09-08 08:00；保留并标注旧样本，不改成假“当前”时间。
- COUNT 0 有效；AVG/observed_at null 为数据不足。无分布不使有效汇总失效；空报表仍允许按原权限提交 CSV。
- 当前范围最近最多 100 条导出，不是完整历史。队列位置为全局 Worker 顺序，样本为最多 20 次成功完整耗时中位数，ETA 不是 SLA；无样本不编分钟数。
- 源 UI 以 expired 标签或时间到期显示再生成；服务仅以时间到期或 dead_letter 接受。标签 expired 但时间未到的合成差异场景明确会被拒绝，不修改契约。
- 每个操作只记录意图；hold/failure 为控制态，不连接服务。regenerated 场景是明确标注的合成 202 响应，新 ID 与旧记录并存，不算实际写入成功。

## 控件与唯一弹窗

| 控件 | 本稿表现与实际契约 |
| --- | --- |
| 三类报表 | report 参数；opportunity 默认省略，读取 /reports/:type，无日期参数 |
| 重新加载、刷新状态 | 仅记录报表和导出列表 GET；刷新失败保留已读内容 |
| 导出当前报表 CSV | POST /report-exports，精确 {report_type, format: "csv"}；空报表不额外禁止 |
| 查看详情 | export 参数及 GET /report-exports/:id；关闭/Escape 保留其他 query |
| 关闭 | 原生 dialog、返回焦点；关闭不声称取消已提交操作；404/无权走页面提示并清详情参数，不伪造记录窗 |
| 下载 | 仅列表 succeeded 且未到期；只记原始文件 GET 意图，不生成下载文件 |
| 重新生成 | bodyless POST /report-exports/:id/regenerate；处理中禁同记录重复；冲突窗内错误、新记录受控展示 |
| 技术详情 | 可键盘展开；错误码和合成关联 ID，不含凭证 |
| 在任务中心查看 | 记录 /tasks?view=exports 导航，不把导出加入业务任务 |

## 图片目录

共 41 场景 × 2 端 = 82 主图（含 2 张非业务审核工具图），另 8 张长窗底部图，共 **90 PNG**。普通页整页；弹窗使用实际视口；底部图补充初始图未完整露出的内容。所有图片、脚本和证据是永久审核交付，不是临时测试产物。

| 场景 | 桌面 1440 | 手机 390 |
| --- | --- | --- |
| opportunity | [查看](1440-opportunity.png) | [查看](390-opportunity.png) |
| trend | [查看](1440-trend.png) | [查看](390-trend.png) |
| team | [查看](1440-team.png) | [查看](390-team.png) |
| empty | [查看](1440-empty.png) | [查看](390-empty.png) |
| no_series | [查看](1440-no_series.png) | [查看](390-no_series.png) |
| long_email | [查看](1440-long_email.png) | [查看](390-long_email.png) |
| zero_series | [查看](1440-zero_series.png) | [查看](390-zero_series.png) |
| loading | [查看](1440-loading.png) | [查看](390-loading.png) |
| error | [查看](1440-error.png) | [查看](390-error.png) |
| expired | [查看](1440-expired.png) | [查看](390-expired.png) |
| forbidden | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| rate_limited | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| blocked | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| exports_empty | [查看](1440-exports_empty.png) | [查看](390-exports_empty.png) |
| refreshing | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| refresh_error | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| create_busy | [查看](1440-create_busy.png) | [查看](390-create_busy.png) |
| create_error | [查看](1440-create_error.png) | [查看](390-create_error.png) |
| detail_succeeded | [查看](1440-detail_succeeded.png) | [查看](390-detail_succeeded.png) |
| detail_queued | [查看](1440-detail_queued.png) | [查看](390-detail_queued.png) |
| detail_leased | [查看](1440-detail_leased.png) | [查看](390-detail_leased.png) |
| detail_retry | [查看](1440-detail_retry.png) | [查看](390-detail_retry.png) |
| detail_no_sample | [查看](1440-detail_no_sample.png) | [查看](390-detail_no_sample.png) |
| detail_expired | [查看](1440-detail_expired.png) | [查看](390-detail_expired.png) |
| detail_dead | [查看](1440-detail_dead.png) | [查看](390-detail_dead.png) |
| detail_unknown | [查看](1440-detail_unknown.png) | [查看](390-detail_unknown.png) |
| detail_zero | [查看](1440-detail_zero.png) | [查看](390-detail_zero.png) |
| detail_boundary | [查看](1440-detail_boundary.png) | [查看](390-detail_boundary.png) |
| detail_status_mismatch | [查看](1440-detail_status_mismatch.png) | [查看](390-detail_status_mismatch.png) |
| detail_not_found | [查看](1440-detail_not_found.png) | [查看](390-detail_not_found.png) |
| detail_forbidden | [查看](1440-detail_forbidden.png) | [查看](390-detail_forbidden.png) |
| regenerate_busy | [查看](1440-regenerate_busy.png) | [查看](390-regenerate_busy.png) |
| regenerate_error | [查看](1440-regenerate_error.png) | [查看](390-regenerate_error.png) |
| regenerated | [查看](1440-regenerated.png) | [查看](390-regenerated.png) |
| download_busy | [查看](1440-download_busy.png) | [查看](390-download_busy.png) |
| download_error | [查看](1440-download_error.png) | [查看](390-download_error.png) |
| download_409 | [查看](1440-download_409.png) | [查看](390-download_409.png) |
| download_410 | [查看](1440-download_410.png) | [查看](390-download_410.png) |
| download_503 | [查看](1440-download_503.png) | [查看](390-download_503.png) |
| technical | [查看](1440-technical.png) | [查看](390-technical.png) |
| controls | [查看](1440-controls.png) | [查看](390-controls.png) |
| detail_queued / 底部 | [查看](1440-detail_queued-bottom.png) | [查看](390-detail_queued-bottom.png) |
| detail_status_mismatch / 底部 | [查看](1440-detail_status_mismatch-bottom.png) | [查看](390-detail_status_mismatch-bottom.png) |
| technical / 底部 | [查看](1440-technical-bottom.png) | [查看](390-technical-bottom.png) |
| regenerate_error / 底部 | [查看](1440-regenerate_error-bottom.png) | [查看](390-regenerate_error-bottom.png) |

## 复验

在仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-report-c.mjs --capture
node scripts/verify-ui-phase2-report-c.mjs
```

第一条更新永久图和证据；第二条不改图，核对源/数据/图哈希后重跑交互。复用已有 Playwright，无安装或新服务。源 Vue 脚本在惰性 ref/router/transport 中执行三个 CSV body、无 body 再生成、关闭 query、新 ID、null/0 和 inclusive expiry；不是挂载 Vue 或完整响应性测试。真实 SQL 经惰性 pool 检查组织成员与工作区任务口径；真实 ReportService 经惰性仓库/文件读取检查 409/410/503 顺序和再生成边界，不访问数据库或磁盘导出文件。

浏览器覆盖三类型、空与已有汇总、零条长、下载人工重试/忙碌、再生成忙碌/失败/旧记录保留、历史/刷新/非法 query、原生 dialog 加显式 Tab 两端循环/Escape/返焦、可见错误、44px/16px 控件与 13px 辅助文字、页面与弹窗无横向溢出。1440/390 全场景；768/1024 仅团队/长邮箱/队列/错误四场景检查，不称全断点完备。HTTP/console/pageerror=0，cookies/localStorage/sessionStorage 为空，browser/context finally 关闭。

## 尚未完成

RP-G01–G04 和 F03-G05 保持待办：完整异步归属与跨范围/KeepAlive、不同记录并发、原生 200% 缩放、全部主题/密度/角色、真实 Vue 整合、API/MySQL/幂等竞争/Worker 期限清理、CSV 防注入与行数上限、真实文件字节和生产部署签收。本轮未重跑现有真实下载夹具用例；原型下载仅意图，不能当文件测试通过。不存在/无权不另造详情弹窗，沿源代码清参提示。

未改 apps/、API/OpenAPI、数据库/迁移、权限、环境参数、依赖或生产服务，无重启要求。下一设计工作面是 W04 P29 组织治理；用户仍可要求修改本页，不能将 C 方向选择当作具体图批准。
