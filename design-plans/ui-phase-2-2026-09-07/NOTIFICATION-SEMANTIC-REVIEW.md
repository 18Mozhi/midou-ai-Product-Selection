# P26 通知中心逐项语义审核

2026-09-10 P26真实读取修复：[读取批次归属说明](P26-READ-BATCH-REVIEW.md)。列表、汇总、偏好同批请求共享有效期，旧批次、首个失败后的同批回包及销毁后的读取不再写入分页、诊断或最终结果。12项源测试含7项读取回归/正常检查与5项仍复现的写入/草稿边界，不能称全部归属问题已修。四套468张图随源码重验，未改变布局、审核批准或接口；未部署。以下“读取meta/error未修”等为此前批次记录，以本说明为准。

2026-09-10字段/诊断增量：[70张新图](design/notification-forms-direction-c/README.md)包含34字段、10偏好窗反馈和26页级诊断；5字段由Vue AST核对，5错误样本经真实client/api隔离执行，编号为合成。页级诊断补4代表槽，另6组12槽按当前源码无呈现严格登记，现85有图/12源码无状态/3待核对。3槽是分页busy和含原生cancel接线的偏好关闭disabled/busy；不为填数改原条件。原图和7项真实归属缺口不变。

2026-09-10导航增量：[导航与关闭图册](design/notification-navigation-direction-c/README.md)新增240双端图，26控件变体、52次离线点击。11语义组51代表状态新增明确映射；现81已映射、19未映射，14额外源入口严格绑定，页级诊断仍待。额外偏好关闭图标仅提案、不增源码动作；下文70槽为此前批次。源码7项归属缺口仍未修。

状态：源码核对完成，图稿与真实实现/生产验收未完成。用户的 P16 布局批准不覆盖本页。

## 范围与图册

[动作登记](action-reviews/P26.json)将当前 NotificationCenter.vue 的23处候选归为19组：17个页面动作、2个窗口定义接线，其中6个动作可能写入。6个 v-model、2个原生 dialog 和1个内嵌 form 均绑定源码指纹及 useModalDialog 依赖；form不是第三个弹窗。

[基础图册](design/notification-direction-c/README.md)98PNG和[提交按钮图册](design/notification-controls-direction-c/gallery.html)60PNG继续使用，不新增图数。五个提交按钮的默认、悬停、焦点、按下、禁用、忙碌形成30个严格状态引用，禁用/忙碌共用pending场景。还有70个代表状态槽未映射；这不等于缺70张图，也不代表已映射部分获批。其他入口、字段、全变体和组合需继续细化。

## 动作语义

| 入口 | 当前真实行为与重设计边界 |
| --- | --- |
| 通知偏好 | busy禁用入口；保留当前ref，不自动还原草稿 |
| 全部已读 | POST /notifications/actions，无body，不受当前分类/状态/未读筛选限制；范围为当前组织/工作区/接收人 |
| 分类、状态、未读、分页 | 更新URL再读取；分类5项、处理状态4项、每页20；不是业务状态写入；分页只按首尾禁用 |
| 重新加载 | 并行读取列表、汇总、偏好；五类错误页可见，无busy禁用 |
| 消息列表/深链 | GET详情后，未读自动POST read+expected_version；不能当作纯只读操作。列表入口busy阻止，深链openById无同等保护 |
| 详情关闭 | 按钮与Escape在busy时均拒绝关闭；关闭清notification/notification_id，保留筛选 |
| 来源链接 | 仅允许以单斜线开头的站内地址，追加from；不猜测缺失来源 |
| 开始处理/关闭/重新打开 | 各自按open/非closed/closed显示，POST action+expected_version；只修改通知状态，不操作来源任务 |
| 两处技术详情 | 原生details，分别显示页级requestId和资源/根因键；不是同一个诊断对象 |
| 偏好取消/Escape | busy仍可关闭，保留ref，不取消已经发出的PUT |
| 偏好保存 | 原生form提交PUT /me/notification-preferences；五布尔值、version及expected_version，邮件强制false；成功关闭并重读 |

## 字段与窗口

未读checkbox只控制过滤。偏好包含站内、邮件、任务、审批、竞品五项，邮件永久disabled且服务端拒绝启用。其他字段当前没有统一busy锁；load会重新赋值偏好。详情窗的未读/处理中/已关闭、缺来源、长正文等是同窗变体；偏好的等待/错误/冲突也是同窗变体。现有就近错误图是提案，不等于真实Vue已消除被弹窗遮挡的页级错误。

## 已复现的归属缺口与特征测试

新增 tests/unit/ui-phase2-notification-ownership.test.mjs 提取实际setup执行受控时序，使用真实Vue ref/computed，替换路由/API/modal/lifecycle。以下7项通过表示现状得到复现，**不表示缺口已经修复**：

1. 旧列表返回不覆盖新行，但旧meta.total仍可改写新分页总数及共享requestId。
2. 旧列表失败仍可把新ready页面改成error。
3. A的自动已读迟到成功可把后来打开的B替换回A。
4. A的workflow部分回执可合并进当前B，产生id为A、标题为B的混合对象；部分字段形状来自真实repository。
5. load会覆盖偏好窗中未保存的字段；SSE也调用该load，但本测试不声称实测SSE投递。
6. 偏好保存后取消再打开，新窗口会被旧成功回调关闭；请求body仍是原快照。
7. 普通列表打开和详情关闭受busy保护，而直接openById仍可进入B。

这些是本次设计必须显式跟踪的交付缺口。真实修复需逐项补归属保护和挂载/服务回归；不能通过改文案、离线图或特征测试通过消除待办。本轮没有改变生产代码或业务规则。

## 验证、使用与剩余工作

运行 node --test tests/unit/ui-phase2-notification-ownership.test.mjs 验证上述源特征；运行 node scripts/verify-ui-phase2-notification-controls-c.mjs 验证60离线观察及图源指纹。动作/表面审计检查候选全覆盖、合同别名、字段顺序和精确控件状态关联。VM测试不证明DOM焦点、真实请求、数据库、通知送达或生产权限隔离。

继续：其他按钮/字段与弹窗状态图、具体布局/控件审核、真实Vue组合及上述异步缺口修复、角色/主题/密度/响应式和真实服务验证。没有新增接口、配置、数据库、权限、依赖或进程；无需环境变量调整、重启或部署。第二阶段整体仍未完成。
