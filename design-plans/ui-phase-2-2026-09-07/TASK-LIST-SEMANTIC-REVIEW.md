# P23 全部任务：逐项审核与实施缺口

2026-09-10，基线main/779d0390。沿用户已选C方向，使用ui-skills-root/frontend-design按真实入口和表单职责核对；具体P23稿未批准，本批不改生产。

[目录两视口](design/task-direction-c/README.md) · [表单与异常两视口](design/task-direction-c-forms/README.md) · [逐项清单](action-reviews/P23.json) · [原任务合同](task-contract-review.md)

## 本页实际范围

P23是`/tasks`、mode=all、无taskId；与P13共享TaskWorkspace/TaskListPanel/TaskBatchActions的48个源位置，但逐页归属不同。本页39组：33个页面动作、5个事件/定义关联、1个P24详情排除。全局独立源位置不因再核对同一源码而增加，不能将逐页组总和称作全站独立按钮数。

6个v-model为新建4字段、删除原因与搜索草稿；排序、选中、批量原因/时间/负责人通过事件控制，另列在动作清单。3处原生dialog对应新建、删除、五批量共7变体；4个form只是结构，不多算弹窗。P23普通列表只可新建/删除与批量，编辑入口在P24详情；共享图册中的edit不能当作P23已实现入口。

| 区域/按钮 | 必须保留的实际语义 | 现有图与缺口 |
| --- | --- | --- |
| 新建及空列表创建 | task:create；打开保留草稿，首次create=1可预填标题/说明 | create；不添加负责人字段或默认期限 |
| 业务/导出切换 | mode=all；导出另需report:read；切换清status/page、保留query/sort | 当前两个C图包无对应导出视图，不能用报表页抵扣 |
| 列表与摘要 | 列表不带mine，summary仍是本人当前工作区任务；meta.total单独使用 | list/empty；不能标成同一总量 |
| 状态/搜索/排序/重置 | 六状态、四sort；排序change立即带当前trim搜索草稿；重置清筛选及选择 | list/empty仅单条样本，不证明多页排序 |
| 本页/单行/清除选择 | task:update；本页tasks.map(id)，不是全部搜索结果 | list；混合任务、多页选择还缺图 |
| 查看任务/行菜单 | 查看通过/tasks/id并保留完整from；菜单才是删除入口 | list；详情不是P23本地弹窗 |
| 上一页/下一页 | total>10显示，边界disabled；清选择并replace页码 | 源存在，C稿尚无真实多页布局 |
| 删除确认/取消/Escape | 原因trim且必填，DELETE带目标版本；请求中取消与Escape均阻止关闭 | delete；实际Vue E2E覆盖请求中Escape、成功回包和列表刷新 |
| 五批量入口 | pause仅进行中、resume仅已暂停，delay/transfer/cancel排除终态；transfer另需task:assign | 五个batch-*图；单样本继续可执行0，不能改图为可执行1 |
| 批量字段/确认/返回 | resume无原因；其余原因，delay时间，transfer真实成员；逐任务POST/版本/审计，不增加批量接口 | 确认时冻结目标/资格快照；在途筛选变化不改影响计数，函数级busy守卫阻止重入 |
| 重新加载 | 根据当前列表/导出分支重读；不是登录/申请权限 | error/forbidden/expired/rate_limited；not_found仅P24详情404 |
| 创建或管理导出 | 链接/reports，不在此页POST | 缺P23对应图 |
| 查看导出任务 | 链接/reports?report=report_type，不是文件下载，也不是按export id定位 | 排队位置/ETA未知保留null，不编造进度 |

两图包共60PNG是共享P23/P24和审核board的总数，不是P23独占60图。本页明确关联目录、筛选空、新建、删除、五批量及四种读取错误；不借P24详情/编辑/进度/not_found图补页内缺口。194个代表视觉槽尚未逐selector映射，不等于恰好缺194张图。所有主题密度、动态行、长内容及错误可发现性仍待具体审核。

## 本轮新增源证据

运行`node scripts/verify-ui-phase2-task-list-review.mjs`，先复用已有5路由变更、7写入body、5类批量资格与惰性SQL构造检查，再检查P23差异。它只提取真实函数/变量到内存；传输、读取归属边界和模态环境被隔离，不是重新验证完整Vue生命周期。

1. all模式列表准确带page/page_size/status/query/sort，不带mine；并行summary和后续成员目录仍独立。夹具列表、summary及meta.total并非一致数据库快照，不合并解释。
2. 有report:read时导出只读/report-exports；无权限直接返回业务视图且零API；空队列位置/ETA不补值。
3. 当前api函数对404在无taskId时置error，有taskId才置not_found。因此共享不存在图属于P24，不是P23适用状态。
4. 删除请求现在在发出前固定目标/版本/原因；原生Escape在busy时被阻止，成功回包仅关闭仍由本请求拥有的弹窗并刷新来源列表。P23真实Vue E2E覆盖在途Escape与回包闭环；本地夹具不证明持久化删除或生产权限。

批量逐项请求始终使用同一份动作、原因、期限、负责人和目标版本快照；此次补齐了真实Vue在途路由变化和重复form submit测试，并让弹窗的所选/可执行/跳过计数保持该快照。逐项部分失败仍按原有反馈处理，不改变状态资格、API或幂等/版本合同。

既有读取已有active、路由归属、read key与Abort保护；本轮不把写入风险泛化为读取无隔离。P22的读取问题不套到TaskWorkspace。跨组织作用域、缓存返回、真实权限/SQL及后台任务行为继续按原测试边界验证。

## 验证、使用与剩余

Playwright技能下复用已有`verify-ui-phase2-task-c.mjs`和`verify-ui-phase2-task-c-forms.mjs`无capture复验：16+44旧图来源/图哈希、双端8+22场景、13表单、样本字段/批量资格/焦点/校验、零HTTP/错误通过；未修改或重拍旧图。人工查看390-batch-resume，确认0项可执行文案，未声称全图人工审阅。

新清单通过全源候选、完整合同键、事件转发目标、6模型/7结构/15变体关联检查；没有把P13已关联源重复计新增。全局24页局部语义审核、510独立源位置、486逐页组，剩49页；不是全站动作分母冻结、具体批准或部署完成。

新脚本无参数，运行内存检查；既有动作审计无参数只读、`--write`生成报告。API/OpenAPI、生产Vue/CSS、后端/Worker/Python、env/配置、SQL/迁移、依赖、权限与宝塔未改，无部署或重启要求。无新一次性文件/截图/日志/服务，新增验证器和文档为永久交付；浏览器finally关闭。历史3个工具拒绝清理文件不重试或提交：`output/playwright/p16-layout-20260910/.last-run.json`、`output/playwright/ui-phase2-competitor-races-20260909/playwright.config.ts`、后者目录的`results/.last-run.json`。

下一P24详情同级核对，再补各页真实缺稿与具体审核。P16按钮、P22/P23图稿仍待用户批准，全站实际重构和最终宝塔签收尚未完成。
