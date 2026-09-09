# P26 通知操作逐态 · C 方向待审

2026-09-10：[P26逐项源码审核](../../NOTIFICATION-SEMANTIC-REVIEW.md)已绑定23源入口、6字段和两窗。evidence的actionVisualReferences升级为pageId/scope/selector/states精确映射，五写按钮30代表状态引用；60PNG数量和图稿未增加。其余70代表状态槽待核对，7项源码特征测试是缺口复现，不代表生产已修。

新增独立控件图册，继承原 NOTIFICATION-C-r1 数据、布局和离线控制器，不修改原 98 图或生产 Vue。打开 [图册](gallery.html) 审核，或在 [交互稿](index.html) 选择操作、提交反馈，点击“查看”后操作业务按钮。页面顶部工具只用于审稿，不是产品功能。

## 本批范围

五个提交控件 × 六态 × 桌面 1440 / 手机 390 = 60 PNG。六态为默认、真实悬停、键盘焦点、真实按下、等待、失败。禁用和忙碌共用当前源码的 busy 条件，不为无字段操作编造“填写不完整禁用”。等待时新增动作专属文字、ARIA busy 和尊重减少动态效果设置的等待标识，仅用于本提案。

| 源合同         | 操作     | 实际边界                                                                                     |
| -------------- | -------- | -------------------------------------------------------------------------------------------- |
| AN-N-START     | 开始处理 | 仅 open；POST 单条 actions，action=start、expected_version                                   |
| AN-N-CLOSE     | 关闭通知 | 非 closed；同接口 action=close，不关闭关联任务或审批                                         |
| AN-N-REOPEN    | 重新打开 | closed；同接口 action=reopen，关闭态夹具为合成                                               |
| AN-N-ALL-READ  | 全部已读 | POST /notifications/actions，无 body；不是当前筛选或当前页                                   |
| AN-N-PREF-SAVE | 保存偏好 | PUT /me/notification-preferences，保留原 version、expected_version，email_enabled 强制 false |

失败场景保持通知事实与偏好内容，再次点击只生成相同请求预览。等待状态阻止重复意图。详情 Escape 等待锁定；偏好 Escape 仍允许关闭且不撤销等待，其他偏好字段仍可编辑，已经捕获的请求不随编辑改变。邮件始终禁用，不声称实际邮件投递。

## 依据与未覆盖

依据 `apps/web/src/components/NotificationCenter.vue`、原审批通知合同、原型证据以及 `buildNotificationDesignData` 的真实源函数隔离结果。继承原列表 1 组 / 组内 3 条、汇总与分组口径及 page_size 夹具差异，不把合成状态当生产数据。

打开未读通知自动 read，不是第六个手动提交按钮；不得添加“标记未读”。本批复验原型 read_busy 的自动意图和关闭锁，但源路由/深链直接 openById 不设置 busy，不能据此宣称所有入口生命周期一致。

读取代次、副作用 requestId/total 的晚到覆盖、SSE 重载覆盖偏好草稿、当前选中详情的写回归属、偏好关闭后的结果归属仍需实际 Vue 专项处理。本批没有增加结果完成模拟，不将静态等待与失败场景称作真实异步生命周期或服务验收。偏好等待关闭后的焦点恢复未在本批验收。

其他入口、筛选、分页、关闭、来源、技术详情、全字段状态和主题未算本批完成。P26 尚无完整逐源动作注册表，本批局部映射不提高全站已审页数。P16 的整体布局批准不外推为 P26 或全部按钮批准。

## 可复验

仓库根目录运行 `node scripts/verify-ui-phase2-notification-controls-c.mjs --smoke` 做 30 项定向观察；`--capture` 生成 60 张永久交付图；无参数检查来源/PNG 哈希并重跑 60 项双端观察。每项检查真实原生状态、44px 点击尺寸、16px 字号、中心命中、页面/弹窗无横向溢出、请求/事实不变；另查重复提交、失败重试、关闭差异、邮件禁用、自动 read、HTTP 0、存储空、页面脚本错误 0。浏览器在 finally 关闭。

图册、PNG、证据和验证器均为永久审核交付，不是临时测试文件。未改 API/OpenAPI、env、数据库、依赖、权限、后端/Worker/Python 或宝塔；无需重启，未部署。具体视觉批准、真实实现与全站部署签收继续待办。
