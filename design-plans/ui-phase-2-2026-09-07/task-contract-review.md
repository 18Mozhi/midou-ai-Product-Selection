# P13 / P23 / P24 任务动作与弹窗合同复核

日期：2026-09-07；实施起点 `3ac5bea`；产品源版本 `d9427bceb0701eafe7f105f02b70f04c829db483`。状态：源码语义已复核，运行验收部分覆盖，设计及用户审核未通过。与自动生成的 actions/dialogs/coverage 分开维护，不改全站分母。

## 1. 复核边界与证据

- P13 `/work` 为 today 模式；P23 `/tasks` 为 all 模式；P24 `/tasks/:taskId` 使用同一 TaskWorkspace 加 TaskDetailPanel。NavigationShell 动态组件装配，不能把静态 import 归属等同于运行可见。
- 直接检查 TaskWorkspace（下文 W）、TaskListPanel（L）、TaskDetailPanel（D）、TaskBatchActions（B），路径均在 `apps/web/src/components/`。四组件共71个控件/事件候选和4个dialog定义；共享壳层、全局菜单及其他组件不包含在这个局部数字中。
- API依据：`apps/api/src/business-task-routes.ts`、`business-task-service.ts`、`mysql-business-task-repository.ts`；交互依据：`apps/web/src/use-modal-dialog.ts`。现有编辑表单内联在TaskWorkspace，不存在本链路消费的TaskEditForm组件。
- 自动清单源指纹：`57721ceb995017a83adbcb523125576b3bdd28dfa1c1b59d468c2ad431bb022f`。下表行号仅定位；若指纹或源改变，重新对照candidateId、事件和处理函数，不机械沿用本表结论。
- 新验证入口：`tests/e2e/ui-phase2-task-contracts.spec.ts`，caseId为UI2-T01至T08；参数化共18项，桌面/移动分别执行。复用 `helpers/business-tasks.ts`，不改该共享夹具、不使已有任务图源失效。它们是隔离响应下的真实Vue合同测试，不证明持久化、数据库权限、生产数据或审计成功。

## 2. 真实范围与不可擅改事项

1. `/work` 列表请求带 `mine=true`，表示当前负责人，不是“仅今天截止”或“仅未完成”；`/tasks` 不带mine。两者均受组织、工作区和task:read约束。
2. summary SQL固定带 `assignee_id=actorId`，两页拿到的状态汇总均为本人在当前工作区的任务数。P23的列表总数与本人汇总不保证相等，不能在新稿中把它标成全工作区总量。现有页面“状态数量来自当前工作区任务事实”不够明确，正式重设计应标明本人范围；若要改变统计范围，必须另行确认业务合同。
3. 单项transfer在已结束任务上仍可见（仅canAssign），批量transfer则排除completed/cancelled；不可为了控件统一擅自合并规则。评论/编辑/删除也没有前端终态隐藏条件。
4. 关联采集任务链接按collection_task_id存在显示，并不检查当前页面的collection能力；目标路由/API仍需授权。不能把“链接存在”写成“成员已能访问底层任务”。该拒绝链待独立验收。
5. progress提交失败保留表单；现有notice在工作区外层，不是弹窗内错误区。新布局必须补充错误可发现性验收，本轮不把重试通过等同于错误提示无障碍通过。
6. 列表→详情→返回实际观察到额外的未筛选mine=true列表读取。NavigationShell按routeIdentity缓存TaskWorkspace，后者query watch没有激活态限制，缓存页仍会响应路由变化。返回后的有效读取能恢复原筛选；UI2-T05分别断言首次/返回读取及所有列表请求的mine范围，不宣称无额外请求。后续优先修复缓存页非激活读取并补三个入口切换、组织范围及迟到响应回归；本轮仅登记证据，不改产品生命周期或使已有图源失效。

## 3. 局部候选→语义动作映射

前缀全部为 `task.`。`{x}` 表示下面显式列举的变体，不是任意动作；事件中转不另外算用户按钮。输入模型和原生HTML校验另列在弹窗合同。行号与现有自动候选一一对应，重复按钮/表单按同一语义ID归并。

| 组件行 | 语义ID（省略task.） | 入口/处理与结果 |
| --- | --- | --- |
| W726 | list.create.open | canCreate，showCreate=true；同壳头入口可在详情存在 |
| W732 | view.business | setView，清status/page，保留query/sort |
| W735 | view.exports | mode=all且report:read；GET /report-exports |
| W770 | read.retry | 错误区load；列表/详情/导出按当前分支重读 |
| W798 | batch.{x}.open/submit/close，batch.field.change | 子组件事件中转，不是独立控件 |
| W816 | list.select/status/search/reset/create.open/delete.open | 子组件事件中转，不是独立控件 |
| W842 | export.manage | 跳/reports |
| W855 | export.open | 跳/reports?report=report_type，不是文件下载 |
| W870 | list.page.previous | 页>1可用；清选择、URL更新 |
| W872 | list.page.next | 页<pageCount可用；清选择、URL更新 |
| W874 | editor.close | 原生cancel→handleCreateCancel→closeTaskEditor |
| W879 | editor.{create,edit}.submit | 表单submit→create函数，按editing选择POST/PATCH |
| W899 | editor.close | 取消按钮；busy禁用；清快捷创建query |
| W900 | editor.{create,edit}.submit | 表单提交按钮；busy禁用，不另算业务动作 |
| W906 | detail.{x}，editor.edit.open，delete.open，comment.submit | 详情事件中转，field更新只是本地模型 |
| W933 | delete.close | 原生cancel→清目标及原因 |
| W939 | delete.submit | 表单submit→removeTask |
| W951 | delete.close | 取消按钮，busy禁用 |
| W952 | delete.submit | 确认按钮，busy禁用 |
| L72 | list.status | 全部/todo/in_progress/paused/completed/cancelled六个显式变体 |
| L83 | list.search.disclose | 原生details展开/关闭，无API写入 |
| L88 | list.search.apply | 搜索trim，带当前sort；重置page与选中项 |
| L99 | list.sort | 四个sort白名单，选择即应用当前搜索草稿 |
| L114 | list.search.apply | 与L88同一表单提交 |
| L115 | list.reset | 清status/query/sort/page与选中项，保留其他query |
| L120 | list.select.page | canUpdate且有任务，选中/清空本页 |
| L131 | list.select.clear | 有选中时清空 |
| L145 | list.reset | 无结果态重置入口，同L115 |
| L146 | list.create.open | 无任务且无筛选且canCreate，新建入口 |
| L151 | list.select.row | canUpdate，单行checkbox不等于详情跳转 |
| L158 | list.detail.open | /tasks/id?from=route.fullPath |
| L180 | list.row-menu | canUpdate，原生details，局部删除入口 |
| L181 | delete.open | askRemove(row)，清删除原因 |
| D61 | detail.return | 只接受/work、/tasks及其query，否则/tasks |
| D91 | detail.collection.open | 有collection_task_id，跳平台采集页；权限由目标裁决 |
| D107 | detail.technical.toggle | 原生details，账号/任务编号渐进展示 |
| D123 | detail.start | canUpdate+todo；直接POST动作，无原因弹窗 |
| D131 | detail.resume | canUpdate+paused；直接POST动作 |
| D139 | detail.complete | canUpdate+todo/in_progress/paused；直接POST动作 |
| D146 | detail.progress.open | canUpdate且未结束；预填进度及说明 |
| D154 | detail.more.toggle | canUpdate或canAssign，原生details |
| D156 | detail.pause.open | canUpdate+in_progress |
| D164 | detail.delay.open | canUpdate且未结束 |
| D172 | detail.transfer.open | canAssign，不自行附加终态限制 |
| D180 | editor.edit.open | canUpdate，预填selected事实 |
| D183 | detail.cancel.open | canUpdate且未结束 |
| D192 | delete.open | canUpdate，目标为selected |
| D212 | comment.submit | canUpdate；POST comments，非空、最多2000 |
| D213 | comment.change | 本地草稿input，busy禁用；不落浏览器存储 |
| D221 | comment.submit | 与D212同一表单提交，busy禁用 |
| D225 | detail.{x}.close | 原生cancel→closeAction，五变体共用 |
| D231 | detail.{x}.submit | submitTaskAction，五变体按action构造字段 |
| D248 | detail.transfer.assignee.change | 成员目录select→本地模型 |
| D261 | detail.delay.due.change | datetime-local→本地模型 |
| D271 | detail.progress.percent.change | 数字0–100，整数步进 |
| D288 | detail.progress.note.change | 必填说明，最多500 |
| D299 | detail.{pause,cancel,delay,transfer}.reason.change | 必填原因，最多500 |
| D308 | detail.{x}.close | 返回按钮，无写入；不同于取消任务动作 |
| D309 | detail.{x}.submit | 与D231同一表单提交，busy禁用 |
| B41 | batch.pause.open | 有选中且canUpdate，预览in_progress可执行项 |
| B42 | batch.resume.open | 有选中且canUpdate，预览paused可执行项 |
| B43 | batch.delay.open | 有选中且canUpdate，未结束项可执行 |
| B44 | batch.transfer.open | 另需canAssign，未结束项可执行 |
| B47 | batch.cancel.open | canUpdate，未结束项可执行 |
| B49 | batch.{x}.close | 原生cancel→close，不清选中项 |
| B55 | batch.{x}.submit | confirmBatch，逐任务POST，不存在批量API |
| B80 | batch.reason.change | resume之外必填原因，最多500 |
| B88 | batch.delay.due.change | 延期必填日期 |
| B97 | batch.transfer.assignee.change | 转交必选现有成员 |
| B109 | batch.{x}.close | 返回按钮，保留选择，无写入 |
| B110 | batch.{x}.submit | busy或无eligible禁用 |

detail的x为progress/pause/cancel/delay/transfer；batch的x为pause/resume/delay/transfer/cancel。API写入均经createApiClient，并由服务端同源、幂等及权限检查；前端隐藏不是授权证明。

## 4. 四个定义、十三个弹窗变体

| dialogId | 源与变体 | 输入及提交合同 | 取消/成功/失败 |
| --- | --- | --- | --- |
| task.editor.create | W874，新建 | 标题1–200、说明≤5000、priority四值、可选本地期限→ISO或null；POST /tasks，不传负责人则服务端使用actor | closeTaskEditor清create/title/description query；成功清表单并load；失败保持输入 |
| task.editor.edit | W874，编辑 | PATCH /tasks/id；含原assignee_id、expected_version、固定reason=更新任务内容，期限转换同上 | 取消不写；成功重读；不改原负责人 |
| task.delete | W933，删除 | DELETE /tasks/id，expected_version+trim原因1–500 | 取消清原因；详情删除成功replace(returnPath)，列表删除则load；失败保留 |
| task.action.{x} | D225，共5变体 | POST /tasks/id/actions，共有action+expected_version。progress只加percent/note；pause/cancel加reason；delay加reason/due_at；transfer加reason/assignee_id | 打开预填事实，原因每次清空；成功关闭并GET详情；失败不关闭；不自动提升version |
| task.batch.{x} | B49，共5变体 | 同一actions端点逐项发送各自version；resume无reason；其余对应原因/期限/成员 | 显示选中/可执行/跳过/关联数；取消保留选择；完成后显示成功/失败/跳过，清选择并load；部分失败不伪装全成功 |

所有原生dialog使用useModalDialog/showModal；Escape请求关闭并归还入口焦点。只有新建/删除的取消按钮受busy限制，动作/批量返回及Escape未统一busy限制；待提交中关闭/重开竞态验收，不宣称已具备统一锁定合同。不同关闭行为不得仅因换视觉自动改变。

## 5. 本轮用例与尚未验证的边界

| caseId | 明确证明 | 不证明 |
| --- | --- | --- |
| UI2-T01 ×5 | 各单项表单取消无写入、焦点归还、各自准确字段和版本、成功关闭并重读 | MySQL状态改变、完整键盘链、全部权限/终态 |
| UI2-T02 ×3 | start/resume/complete各自前置状态入口、精确请求、不额外弹出原因表单 | 真实版本冲突、不同auto_score_status结果 |
| UI2-T03 | 503后进度草稿保留，可再次提交同一输入 | 弹窗内错误可发现性、409版本刷新、离线恢复 |
| UI2-T04 ×5 | 批量取消无写入且保留选择；pause跳过todo；resume无eligible禁用；delay/transfer/cancel分别带逐项version | resume成功、部分失败、双提交/执行中关闭、真实审计 |
| UI2-T05 | /work首次/返回读取带原筛选；观察到的列表请求均带mine=true；中文URL按编码比较 | 没有缓存页额外读取、列表/本人汇总业务口径变更 |
| UI2-T06 | 快捷创建预填及取消只移除创建query、零POST | 所有表单有效/无效组合 |
| UI2-T07 | 编辑准确PATCH、删除取消零DELETE、重开原因清空、删除返回原列表 | 夹具不保存PATCH，下一GET仍version2；不证明新版本持久化 |
| UI2-T08 | 首次404后点击重载成功读取详情、不调用列表/汇总/写API | 401/403/429与真实过期会话 |

旧m05-01测试继续保留只读/update角色、重复创建/评论/完成、状态/分页等覆盖；旧截图及本轮测试不抵扣最终新设计图。剩余：导出分支、关联采集授权、所有输入校验、批量部分失败及resume成功、提交中竞态、成员目录失效、版本冲突与全部错误/终态、三主题/两密度/断点/无障碍、真实后端、生产和用户签收。G0未冻结，P13/P23/P24不可标为完整验收通过。
