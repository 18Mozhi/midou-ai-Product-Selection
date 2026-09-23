# P13 / P23 / P24 任务动作与弹窗合同复核

2026-09-08设计增量：[P13 WORK-C-r1](design/work-direction-c/README.md)独立33场景双端66图（2图为控件板）。源TaskWorkspace函数在VM核对筛选/页/快捷创建、创建/删除/五批量body与资格；源SQL方法在惰性pool检查本人scope与分页，不调用数据库。原夹具列表2/summary7差异明示；新布局失败保留/禁用/触控保护仅提案，未修改71候选、四定义、旧图或真实Vue，不据此注销全状态/审核/生产门。

日期：2026-09-07；盘点起点 `3ac5bea`；候选行号及指纹已按读取修复提交 `e1f7a9272b5017307754fa60aa691a8bb43b8329` 刷新。状态：源码语义已复核，运行验收部分覆盖，设计及用户审核未通过。71个局部控件及4个定义的candidateId不变，TaskWorkspace模板未改，位置整体后移66行；读取合同变化见第6节。与自动生成的 actions/dialogs/coverage 分开维护，不改全站分母。

## 1. 复核边界与证据

- P13 `/work` 为 today 模式；P23 `/tasks` 为 all 模式；P24 `/tasks/:taskId` 使用同一 TaskWorkspace 加 TaskDetailPanel。NavigationShell 动态组件装配，不能把静态 import 归属等同于运行可见。
- 直接检查 TaskWorkspace（下文 W）、TaskListPanel（L）、TaskDetailPanel（D）、TaskBatchActions（B），路径均在 `apps/web/src/components/`。四组件共71个控件/事件候选和4个dialog定义；共享壳层、全局菜单及其他组件不包含在这个局部数字中。
- API依据：`apps/api/src/business-task-routes.ts`、`business-task-service.ts`、`mysql-business-task-repository.ts`；交互依据：`apps/web/src/use-modal-dialog.ts`。现有编辑表单内联在TaskWorkspace，不存在本链路消费的TaskEditForm组件。
- 自动清单源指纹：`c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183`。下表行号仅定位；若指纹或源改变，重新对照candidateId、事件和处理函数，不机械沿用本表结论。
- 新验证入口：`tests/e2e/ui-phase2-task-contracts.spec.ts`，caseId为UI2-T01至T08；参数化共18项，桌面/移动分别执行。复用 `helpers/business-tasks.ts`，不改该共享夹具、不使已有任务图源失效。它们是隔离响应下的真实Vue合同测试，不证明持久化、数据库权限、生产数据或审计成功。

## 2. 真实范围与不可擅改事项

1. `/work` 列表请求带 `mine=true`，表示当前负责人，不是“仅今天截止”或“仅未完成”；`/tasks` 不带mine。两者均受组织、工作区和task:read约束。
2. summary SQL固定带 `assignee_id=actorId`，两页拿到的状态汇总均为本人在当前工作区的任务数。P23的列表总数与本人汇总不保证相等，不能在新稿中把它标成全工作区总量。现有页面“状态数量来自当前工作区任务事实”不够明确，正式重设计应标明本人范围；若要改变统计范围，必须另行确认业务合同。
3. 单项transfer在已结束任务上仍可见（仅canAssign），批量transfer则排除completed/cancelled；不可为了控件统一擅自合并规则。评论/编辑/删除也没有前端终态隐藏条件。
4. 关联采集任务链接按collection_task_id存在显示，并不检查当前页面的collection能力；目标路由/API仍需授权。不能把“链接存在”写成“成员已能访问底层任务”。该拒绝链待独立验收。
5. progress提交失败保留表单；现有notice在工作区外层，不是弹窗内错误区。新布局必须补充错误可发现性验收，本轮不把重试通过等同于错误提示无障碍通过。
6. 盘点时列表→详情→返回观察到额外的未筛选mine=true读取：NavigationShell按routeIdentity缓存TaskWorkspace，旧query watch没有激活态限制。此历史问题已进入第6节修复；原UI2-T05只验证本人范围和有效筛选，UI2-C01开始单独核对精确读取次数。

## 3. 局部候选→语义动作映射

前缀全部为 `task.`。`{x}` 表示下面显式列举的变体，不是任意动作；事件中转不另外算用户按钮。输入模型和原生HTML校验另列在弹窗合同。行号与现有自动候选一一对应，重复按钮/表单按同一语义ID归并。

| 组件行 | 语义ID（省略task.） | 入口/处理与结果 |
| --- | --- | --- |
| W792 | list.create.open | canCreate，showCreate=true；同壳头入口可在详情存在 |
| W798 | view.business | setView，清status/page，保留query/sort |
| W801 | view.exports | mode=all且report:read；GET /report-exports |
| W836 | read.retry | 错误区load；列表/详情/导出按当前分支重读 |
| W864 | batch.{x}.open/submit/close，batch.field.change | 子组件事件中转，不是独立控件 |
| W882 | list.select/status/search/reset/create.open/delete.open | 子组件事件中转，不是独立控件 |
| W908 | export.manage | 跳/reports |
| W921 | export.open | 跳/reports?report=report_type，不是文件下载 |
| W936 | list.page.previous | 页>1可用；清选择、URL更新 |
| W938 | list.page.next | 页<pageCount可用；清选择、URL更新 |
| W940 | editor.close | 原生cancel→handleCreateCancel→closeTaskEditor |
| W945 | editor.{create,edit}.submit | 表单submit→create函数，按editing选择POST/PATCH |
| W965 | editor.close | 取消按钮；busy禁用；清快捷创建query |
| W966 | editor.{create,edit}.submit | 表单提交按钮；busy禁用，不另算业务动作 |
| W972 | detail.{x}，editor.edit.open，delete.open，comment.submit | 详情事件中转，field更新只是本地模型 |
| W999 | delete.close | 原生cancel→清目标及原因 |
| W1005 | delete.submit | 表单submit→removeTask |
| W1017 | delete.close | 取消按钮，busy禁用 |
| W1018 | delete.submit | 确认按钮，busy禁用 |
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
| task.editor.create | W940，新建 | 标题1–200、说明≤5000、priority四值、可选本地期限→ISO或null；POST /tasks，不传负责人则服务端使用actor | closeTaskEditor清create/title/description query；成功清表单并load；失败保持输入 |
| task.editor.edit | W940，编辑 | PATCH /tasks/id；含原assignee_id、expected_version、固定reason=更新任务内容，期限转换同上 | 取消不写；成功重读；不改原负责人 |
| task.delete | W999，删除 | DELETE /tasks/id，expected_version+trim原因1–500 | 取消清原因；详情删除成功replace(returnPath)，列表删除则load；失败保留 |
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

旧m05-01测试继续保留只读/update角色、重复创建/评论/完成、状态/分页等覆盖；旧截图及本轮测试不抵扣最终新设计图。剩余：导出分支完整业务链、关联采集授权、所有输入校验、批量部分失败及resume成功、提交中竞态、成员目录失效、版本冲突与全部错误/终态、三主题/两密度/断点/无障碍、真实后端、生产和用户签收。G0未冻结，P13/P23/P24不可标为完整验收通过。

## 6. 读取生命周期修复与后续证据刷新

修复限定TaskWorkspace的读编排，不改模板、CSS或任务写入字段。只在mounted、active与当前routePath归属均满足时读取；单一post监听消除taskId与query监听的重复触发。离开/卸载或下一轮读取取消旧GET，read对象与当前路由key共同校验结果归属，连同错误、requestId、分页meta及成员目录一起保护。完成动作后的详情与成员读取使用新归属，写请求本身不被取消或自动重放。

`ui-phase2-task-cache.spec.ts`包含UI2-C01两列表入口、C02迟到详情200/404、C03详情ID切换及导出隔离、C04迟到列表200/403、C05成员目录在动作刷新后续读，共8项。C02/C04故意让目标GET忽略AbortSignal，再释放旧响应，验证归属检查不依赖网络取消成功。它们不证明真实生产或跨租户持久化权限。

产品源改变使旧全局sourceFingerprint与旧Vue基线证据不再代表当前源。e1f7a92提交后已重新生成清单，按稳定candidateId校正本表，任务Vue基线18图及隔离CSS研究18图由原采集脚本实际重采、各14个语义案例通过。旧版材料可从Git历史追溯，没有只改图哈希冒充新采图。独立A/B原型样式和夹具未改；原脚本的proposal流程顺带复验并重采任务12图，其他76图未重画。它们仍待用户审核，不以本次修复推定风格通过。

## 7. 01adf4d后的稳定源码映射

日期2026-09-08；本次从main/01adf4d核对。五个关联组件的完整LF归一内容均与原合同引用的e1f7a9272b5017307754fa60aa691a8bb43b8329一致；以下4个文件在本合同范围内。先比较完整文件hash，再核对原表所在精确位置的事件/属性及候选类型；不是按最近行号或全局相同标签猜配。原行号表作为历史来源保留，本表给出可复核candidateId及旧行号/语义，不改变旧业务规则或审核结论。

| 文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/TaskWorkspace.vue | 13f899b89bdfeb5d7cd261b87dbff89cd90f757e5a16997cd79ccd654647db7f |
| apps/web/src/components/TaskListPanel.vue | b38e915146cf5b96f7ee9895bd9942eefaacee8913fa2872f83e575f334af72f |
| apps/web/src/components/TaskDetailPanel.vue | c0ff4c54a81e08d86e18e479a1db93654713963632b032e7cfcb97c80e5631b6 |
| apps/web/src/components/TaskBatchActions.vue | 7511df92c2a324a561c8dd1fdc7a5de1434b2b40438600ed757c6e057f68811d |

共75个源候选：71个控件/事件、4个原生dialog定义。同一个dialog位置可分别有cancel事件候选和dialog-definition，二者不是重复业务；定义不能代替各变体的提交/关闭/焦点验收。下表业务前缀沿用task.；原语义中的{x}/{action}严格只代表前述显式变体，不扩展成任意动作。

| 源candidateId | 当前行 | 类型 | 原行号记录 | 既有语义 / 实际入口 |
| --- | --- | --- | --- | --- |
| apps/web/src/components/TaskWorkspace.vue#2bed49a2c7d63100.1 | 799 | control | W792 | list.create.open：canCreate，showCreate=true；同壳头入口可在详情存在 |
| apps/web/src/components/TaskWorkspace.vue#833987c8ccb75906.1 | 805 | control | W798 | view.business：setView，清status/page，保留query/sort |
| apps/web/src/components/TaskWorkspace.vue#3bec3ec2402b1420.1 | 808 | control | W801 | view.exports：mode=all且report:read；GET /report-exports |
| apps/web/src/components/TaskWorkspace.vue#6a22c249121aeb4d.1 | 843 | control | W836 | read.retry：错误区load；列表/详情/导出按当前分支重读 |
| apps/web/src/components/TaskWorkspace.vue#4910da2c0141bbb4.1 | 871 | event-binding | W864 | batch.{x}.open/submit/close，batch.field.change：子组件事件中转，不是独立控件 |
| apps/web/src/components/TaskWorkspace.vue#1673cf0154d40da1.1 | 889 | event-binding | W882 | list.select/status/search/reset/create.open/delete.open：子组件事件中转，不是独立控件 |
| apps/web/src/components/TaskWorkspace.vue#2f03957c77c45e54.1 | 915 | control | W908 | export.manage：跳/reports |
| apps/web/src/components/TaskWorkspace.vue#7080532cf7836b46.1 | 928 | control | W921 | export.open：跳/reports?report=report_type，不是文件下载 |
| apps/web/src/components/TaskWorkspace.vue#c4a35037858480fb.1 | 943 | control | W936 | list.page.previous：页>1可用；清选择、URL更新 |
| apps/web/src/components/TaskWorkspace.vue#a0fa8a0a8fe3a4f1.1 | 945 | control | W938 | list.page.next：页<pageCount可用；清选择、URL更新 |
| apps/web/src/components/TaskWorkspace.vue#4caa7d3977955464.1 | 947 | event-binding | W940 | editor.close：原生cancel→handleCreateCancel→closeTaskEditor |
| apps/web/src/components/TaskWorkspace.vue#e394f71c3c789c95.1 | 952 | form-event | W945 | editor.{create,edit}.submit：表单submit→create函数，按editing选择POST/PATCH |
| apps/web/src/components/TaskWorkspace.vue#012988ab20dde0d0.1 | 972 | control | W965 | editor.close：取消按钮；busy禁用；清快捷创建query |
| apps/web/src/components/TaskWorkspace.vue#eede115bf64bea46.1 | 973 | control | W966 | editor.{create,edit}.submit：表单提交按钮；busy禁用，不另算业务动作 |
| apps/web/src/components/TaskWorkspace.vue#cbfab60ce6b6b514.1 | 979 | event-binding | W972 | detail.{x}，editor.edit.open，delete.open，comment.submit：详情事件中转，field更新只是本地模型 |
| apps/web/src/components/TaskWorkspace.vue#184beea2f6fd5456.1 | 1006 | event-binding | W999 | delete.close：原生cancel→清目标及原因 |
| apps/web/src/components/TaskWorkspace.vue#a7d1ecc8ced537b9.1 | 1012 | form-event | W1005 | delete.submit：表单submit→removeTask |
| apps/web/src/components/TaskWorkspace.vue#060b9320f351ee05.1 | 1024 | control | W1017 | delete.close：取消按钮，busy禁用 |
| apps/web/src/components/TaskWorkspace.vue#e2b1aba214c4cb9e.1 | 1025 | control | W1018 | delete.submit：确认按钮，busy禁用 |
| apps/web/src/components/TaskListPanel.vue#2a0d4451e2faa34a.1 | 72 | control | L72 | list.status：全部/todo/in_progress/paused/completed/cancelled六个显式变体 |
| apps/web/src/components/TaskListPanel.vue#ac860f86ea23bb4c.1 | 83 | control | L83 | list.search.disclose：原生details展开/关闭，无API写入 |
| apps/web/src/components/TaskListPanel.vue#d344bde9e31f9f8c.1 | 88 | form-event | L88 | list.search.apply：搜索trim，带当前sort；重置page与选中项 |
| apps/web/src/components/TaskListPanel.vue#faf2a52b6a6f528b.1 | 99 | event-binding | L99 | list.sort：四个sort白名单，选择即应用当前搜索草稿 |
| apps/web/src/components/TaskListPanel.vue#b79994ab2dc7702d.1 | 114 | control | L114 | list.search.apply：与L88同一表单提交 |
| apps/web/src/components/TaskListPanel.vue#1b36eaf01847b9f2.1 | 115 | control | L115 | list.reset：清status/query/sort/page与选中项，保留其他query |
| apps/web/src/components/TaskListPanel.vue#9960c69204257423.1 | 120 | event-binding | L120 | list.select.page：canUpdate且有任务，选中/清空本页 |
| apps/web/src/components/TaskListPanel.vue#2cb28f705efccf29.1 | 131 | control | L131 | list.select.clear：有选中时清空 |
| apps/web/src/components/TaskListPanel.vue#86b8060a633774c0.1 | 145 | control | L145 | list.reset：无结果态重置入口，同L115 |
| apps/web/src/components/TaskListPanel.vue#c92b78a436786dc5.1 | 146 | control | L146 | list.create.open：无任务且无筛选且canCreate，新建入口 |
| apps/web/src/components/TaskListPanel.vue#fe99684a58d4750c.1 | 151 | event-binding | L151 | list.select.row：canUpdate，单行checkbox不等于详情跳转 |
| apps/web/src/components/TaskListPanel.vue#a32f374b623fc146.1 | 158 | control | L158 | list.detail.open：/tasks/id?from=route.fullPath |
| apps/web/src/components/TaskListPanel.vue#a52d2fd8d2453f5a.1 | 180 | control | L180 | list.row-menu：canUpdate，原生details，局部删除入口 |
| apps/web/src/components/TaskListPanel.vue#b4c8f55424911113.1 | 181 | control | L181 | delete.open：askRemove(row)，清删除原因 |
| apps/web/src/components/TaskDetailPanel.vue#0513954362e80472.1 | 61 | control | D61 | detail.return：只接受/work、/tasks及其query，否则/tasks |
| apps/web/src/components/TaskDetailPanel.vue#a450361745c05a56.1 | 91 | control | D91 | detail.collection.open：有collection_task_id，跳平台采集页；权限由目标裁决 |
| apps/web/src/components/TaskDetailPanel.vue#1c008f867673db60.1 | 107 | control | D107 | detail.technical.toggle：原生details，账号/任务编号渐进展示 |
| apps/web/src/components/TaskDetailPanel.vue#f293cf86b53f5f82.1 | 123 | control | D123 | detail.start：canUpdate+todo；直接POST动作，无原因弹窗 |
| apps/web/src/components/TaskDetailPanel.vue#86ef5792f91935ac.1 | 131 | control | D131 | detail.resume：canUpdate+paused；直接POST动作 |
| apps/web/src/components/TaskDetailPanel.vue#41b7ff02cd9481cd.1 | 139 | control | D139 | detail.complete：canUpdate+todo/in_progress/paused；直接POST动作 |
| apps/web/src/components/TaskDetailPanel.vue#d15fb86b9a1883f9.1 | 146 | control | D146 | detail.progress.open：canUpdate且未结束；预填进度及说明 |
| apps/web/src/components/TaskDetailPanel.vue#d0b869ee32723b5a.1 | 154 | control | D154 | detail.more.toggle：canUpdate或canAssign，原生details |
| apps/web/src/components/TaskDetailPanel.vue#5f5bf5a382300046.1 | 156 | control | D156 | detail.pause.open：canUpdate+in_progress |
| apps/web/src/components/TaskDetailPanel.vue#8a192d8df4bae23e.1 | 164 | control | D164 | detail.delay.open：canUpdate且未结束 |
| apps/web/src/components/TaskDetailPanel.vue#b841d884628a5445.1 | 172 | control | D172 | detail.transfer.open：canAssign，不自行附加终态限制 |
| apps/web/src/components/TaskDetailPanel.vue#be1075cbce90c814.1 | 180 | control | D180 | editor.edit.open：canUpdate，预填selected事实 |
| apps/web/src/components/TaskDetailPanel.vue#a6808a15ac396ea9.1 | 183 | control | D183 | detail.cancel.open：canUpdate且未结束 |
| apps/web/src/components/TaskDetailPanel.vue#7ac1d2b58faaa7e3.1 | 192 | control | D192 | delete.open：canUpdate，目标为selected |
| apps/web/src/components/TaskDetailPanel.vue#ed8efea9c40be3fa.1 | 212 | form-event | D212 | comment.submit：canUpdate；POST comments，非空、最多2000 |
| apps/web/src/components/TaskDetailPanel.vue#164700beea75a50a.1 | 213 | event-binding | D213 | comment.change：本地草稿input，busy禁用；不落浏览器存储 |
| apps/web/src/components/TaskDetailPanel.vue#3b0242c6256a5a86.1 | 221 | control | D221 | comment.submit：与D212同一表单提交，busy禁用 |
| apps/web/src/components/TaskDetailPanel.vue#46e431fb8f9cec9e.1 | 225 | event-binding | D225 | detail.{x}.close：原生cancel→closeAction，五变体共用 |
| apps/web/src/components/TaskDetailPanel.vue#950c1a9d40721d87.1 | 231 | form-event | D231 | detail.{x}.submit：submitTaskAction，五变体按action构造字段 |
| apps/web/src/components/TaskDetailPanel.vue#fd868cd01ff93343.1 | 248 | event-binding | D248 | detail.transfer.assignee.change：成员目录select→本地模型 |
| apps/web/src/components/TaskDetailPanel.vue#5223264cc91ca9cd.1 | 261 | event-binding | D261 | detail.delay.due.change：datetime-local→本地模型 |
| apps/web/src/components/TaskDetailPanel.vue#d5c7036343c5823b.1 | 271 | event-binding | D271 | detail.progress.percent.change：数字0–100，整数步进 |
| apps/web/src/components/TaskDetailPanel.vue#9548ae8bcbbf6e9e.1 | 288 | event-binding | D288 | detail.progress.note.change：必填说明，最多500 |
| apps/web/src/components/TaskDetailPanel.vue#3d37f15c32bb38a7.1 | 299 | event-binding | D299 | detail.{pause,cancel,delay,transfer}.reason.change：必填原因，最多500 |
| apps/web/src/components/TaskDetailPanel.vue#fbcbfc84994eaf3e.1 | 308 | control | D308 | detail.{x}.close：返回按钮，无写入；不同于取消任务动作 |
| apps/web/src/components/TaskDetailPanel.vue#c74a96fead2d3bc1.1 | 309 | control | D309 | detail.{x}.submit：与D231同一表单提交，busy禁用 |
| apps/web/src/components/TaskBatchActions.vue#dcc3dd67cea16d16.1 | 41 | control | B41 | batch.pause.open：有选中且canUpdate，预览in_progress可执行项 |
| apps/web/src/components/TaskBatchActions.vue#8c9d3d93d6a0168a.1 | 42 | control | B42 | batch.resume.open：有选中且canUpdate，预览paused可执行项 |
| apps/web/src/components/TaskBatchActions.vue#238f1a6251ae9783.1 | 43 | control | B43 | batch.delay.open：有选中且canUpdate，未结束项可执行 |
| apps/web/src/components/TaskBatchActions.vue#5694b69e2e543c38.1 | 44 | control | B44 | batch.transfer.open：另需canAssign，未结束项可执行 |
| apps/web/src/components/TaskBatchActions.vue#70c47404dd2cc51e.1 | 47 | control | B47 | batch.cancel.open：canUpdate，未结束项可执行 |
| apps/web/src/components/TaskBatchActions.vue#446106c89d9d1204.1 | 49 | event-binding | B49 | batch.{x}.close：原生cancel→close，不清选中项 |
| apps/web/src/components/TaskBatchActions.vue#e81628577b69db40.1 | 55 | form-event | B55 | batch.{x}.submit：confirmBatch，逐任务POST，不存在批量API |
| apps/web/src/components/TaskBatchActions.vue#d4003ff11f44d9cc.1 | 80 | event-binding | B80 | batch.reason.change：resume之外必填原因，最多500 |
| apps/web/src/components/TaskBatchActions.vue#0fc52b5608263ef6.1 | 88 | event-binding | B88 | batch.delay.due.change：延期必填日期 |
| apps/web/src/components/TaskBatchActions.vue#f7f3da8b759864b6.1 | 97 | event-binding | B97 | batch.transfer.assignee.change：转交必选现有成员 |
| apps/web/src/components/TaskBatchActions.vue#99031a2db9919db6.1 | 109 | control | B109 | batch.{x}.close：返回按钮，保留选择，无写入 |
| apps/web/src/components/TaskBatchActions.vue#83d4d6c6f2015e2f.1 | 110 | control | B110 | batch.{x}.submit：busy或无eligible禁用 |

| 源candidateId | 当前行 | 类型 | 业务dialogId / 变体 |
| --- | --- | --- | --- |
| apps/web/src/components/TaskWorkspace.vue#8bf4c56bada725b4.1 | 947 | dialog-definition | task.editor.create / task.editor.edit（2变体） |
| apps/web/src/components/TaskWorkspace.vue#078999112ae5397e.1 | 1006 | dialog-definition | task.delete（1变体） |
| apps/web/src/components/TaskDetailPanel.vue#dfce0d7d3dc167b7.1 | 225 | dialog-definition | task.action.progress / pause / cancel / delay / transfer（5变体） |
| apps/web/src/components/TaskBatchActions.vue#6b0b774adfa59ad6.1 | 49 | dialog-definition | task.batch.pause / resume / delay / transfer / cancel（5变体） |

本次只完善源码归属：本文件全部75个现行候选有精确ID、行、类型和源hash；测试保证它们与当前扫描集合相等，而不是只验证计数。原表语义/现有请求仍为依据，不用源码签名声称真实后端、权限、幂等或全状态已运行。13个弹窗变体、列表/本人摘要口径、单项/批量transfer条件差异、父子事件中转继续按前述合同逐项验证，未覆盖项不因映射补齐注销。

运行node scripts/audit-ui-phase2-contracts.mjs --json可查看records/sourceClaims/unreferenced；新增永久断言核对本范围全部候选、源hash、历史行号表与新表的对应，退出成功仅代表静态对账。本次不重复未变化的产品构建/业务E2E，不出正式新图、不连接生产，不刷新旧清单/图hash或用户审核状态；F00方向仍待审，正式设计和F04b运行时覆盖继续。
