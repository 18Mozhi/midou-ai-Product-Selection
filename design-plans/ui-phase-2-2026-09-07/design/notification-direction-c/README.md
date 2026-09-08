# P26 通知中心 · C 方向 r1 审核包

2026-09-08 · NOTIFICATION-C-r1 · **具体图稿待用户审核**。本批是独立 HTML/CSS/JS 设计，不是已上线 Vue，不代表全73页完成。

[打开交互稿](index.html) · [来源数据与源码合同](data.js) · [图像与源码指纹](evidence.json)

## 设计重点

蓝色分类目录 / 白色收件箱，移除旧版四张同权数字卡。未读总数辅助阅读，处理状态保留为独立筛选，列表与原始条数不混为一谈。详情采用正文阅读区与通知处理区，来源入口为主要动作；手机先正文与来源、再状态操作。两类原生弹窗保留，未新增确认、批量关闭、标未读或邮件服务。

C方向使用 #254a9c 蓝、#202c3d 正文、#edf1f6 背景、白工作面；中文无衬线、辅助文字至少13px、按钮至少16px、主要触控区44px。手机分类五列与汇总重新排列，正常场景首条标题进入390×844首屏。错误提示在窗内顶部，长窗标题/关闭固定可见；控件提供悬停、焦点、按下、禁用/忙碌反馈，减少动态效果设置关闭入场动画。这些是本稿设计选择，不是旧样式约束。

## 范围与事实边界

- 路由P26 /notifications；member当前组织、工作区、接收人，已有notification:read。源码scope与投递过滤保持，不在原型冒充真实鉴权。
- 原始数据从m05-03-notifications.spec.ts的实际setup响应提取：列表1组、代表同根因3条；独立汇总total3、task1、approval2。保留这个差异，不编造一致数据库快照；原meta.page_size100，而当前Vue固定请求20。
- 列表meta.total计筛选后分组；汇总是全接收范围原始通知条数。原型过滤是本地夹具演示，不等于后端聚合实测。21组分页、未读、处理中/关闭、缺失/未知和长文等均明确标合成。
- 打开已读详情不写；打开未读自动产生read意图，未拿到响应仍显示未读。read_ack是单独标明的合成回执快照，不是实际提交成功。单条动作只作用代表通知，不是逐条处理整个根因组。
- 全部已读POST不带body、筛选或IDs，作用于当前组织/工作区当前接收人的全部已投递未读通知；不能用当前列表范围解释。处理动作start/close/reopen不更改read_at，更不是审批通过或任务完成。
- 来源只使用有效内部action_route并加from；外部、双斜线和空路径无入口。点击只显示离线导航预览，不访问目标页；目标权限未验。
- 偏好使用既有五个布尔字段和expected_version；email_enabled强制false，无系统事件开关。取消后草稿保留；源码保存中仍可取消/Escape，关窗不撤销请求。详情忙碌则禁关闭/Escape，这个差异没有抹平。
- SSE只失效并回读API；重连触发受beginRealtimeReconnect限制，无独立30秒轮询。连接徽标均标示意，浏览器没有实际EventSource或存储写入。
- 按钮提交仅记录意图，不伪造状态、版本、计数或保存成功；失败/在途结果为显式合成。偏好保存后重新读取失败、迟到结果、跨范围和SSE覆盖草稿等完整真实链仍待办。

## 全套本批图

45场景×双端=90主图（其中2张为非业务控件状态板），另8张长内容下部，合计98PNG。不是98个页面，也不是全站动作/状态已覆盖。

| 场景 | 1440×1000 | 390×844 |
| --- | --- | --- |
| 01 收件箱 · 原始响应 | [桌面](1440-normal.png) | [手机](390-normal.png) |
| 02 任务筛选 · 原始响应无匹配 | [桌面](1440-category_task.png) | [手机](390-category_task.png) |
| 03 审批筛选 | [桌面](1440-category_approval.png) | [手机](390-category_approval.png) |
| 04 竞品筛选 · 无匹配 | [桌面](1440-category_competitor.png) | [手机](390-category_competitor.png) |
| 05 系统筛选 · 无匹配 | [桌面](1440-category_system.png) | [手机](390-category_system.png) |
| 06 未处理筛选 | [桌面](1440-workflow_open.png) | [手机](390-workflow_open.png) |
| 07 处理中筛选 · 合成 | [桌面](1440-workflow_progress.png) | [手机](390-workflow_progress.png) |
| 08 已关闭筛选 · 合成 | [桌面](1440-workflow_closed.png) | [手机](390-workflow_closed.png) |
| 09 仅未读 · 合成 | [桌面](1440-unread.png) | [手机](390-unread.png) |
| 10 空收件箱 · 合成 | [桌面](1440-empty.png) | [手机](390-empty.png) |
| 11 正在读取 | [桌面](1440-loading.png) | [手机](390-loading.png) |
| 12 读取失败 | [桌面](1440-error.png) | [手机](390-error.png) |
| 13 无权读取 | [桌面](1440-forbidden.png) | [手机](390-forbidden.png) |
| 14 登录失效 | [桌面](1440-expired.png) | [手机](390-expired.png) |
| 15 请求频繁 | [桌面](1440-rate_limited.png) | [手机](390-rate_limited.png) |
| 16 版本冲突 | [桌面](1440-version_conflict.png) | [手机](390-version_conflict.png) |
| 17 消息详情 · 已读未处理 | [桌面](1440-detail.png) | [手机](390-detail.png) |
| 18 未读详情 · 自动已读意图 | [桌面](1440-detail_unread.png) | [手机](390-detail_unread.png) |
| 19 自动已读处理中 · 合成 | [桌面](1440-read_busy.png) | [手机](390-read_busy.png) |
| 20 自动已读失败 · 合成 | [桌面](1440-read_error.png) | [手机](390-read_error.png) |
| 21 已读响应结果 · 合成快照 | [桌面](1440-read_ack.png) | [手机](390-read_ack.png) |
| 22 处理中详情 · 合成 | [桌面](1440-detail_progress.png) | [手机](390-detail_progress.png) |
| 23 已关闭详情 · 合成 | [桌面](1440-detail_closed.png) | [手机](390-detail_closed.png) |
| 24 无来源入口 · 合成 | [桌面](1440-detail_missing.png) | [手机](390-detail_missing.png) |
| 25 未知严重程度/资源 · 合成 | [桌面](1440-detail_unknown.png) | [手机](390-detail_unknown.png) |
| 26 技术详情 | [桌面](1440-detail_technical.png) | [手机](390-detail_technical.png) |
| 27 长正文 · 合成 | [桌面](1440-detail_long.png) | [手机](390-detail_long.png) |
| 28 开始处理中 · 合成 | [桌面](1440-start_busy.png) | [手机](390-start_busy.png) |
| 29 开始处理失败 · 合成 | [桌面](1440-start_error.png) | [手机](390-start_error.png) |
| 30 关闭通知失败 · 合成 | [桌面](1440-close_error.png) | [手机](390-close_error.png) |
| 31 重新打开失败 · 合成 | [桌面](1440-reopen_error.png) | [手机](390-reopen_error.png) |
| 32 详情读取失败 · 合成 | [桌面](1440-detail_error.png) | [手机](390-detail_error.png) |
| 33 全部已读 · 意图 | [桌面](1440-all_read_intent.png) | [手机](390-all_read_intent.png) |
| 34 全部已读处理中 · 合成 | [桌面](1440-all_read_busy.png) | [手机](390-all_read_busy.png) |
| 35 全部已读失败 · 合成 | [桌面](1440-all_read_error.png) | [手机](390-all_read_error.png) |
| 36 通知偏好 | [桌面](1440-preferences.png) | [手机](390-preferences.png) |
| 37 偏好关闭草稿 | [桌面](1440-preferences_off.png) | [手机](390-preferences_off.png) |
| 38 偏好保存中 · 合成 | [桌面](1440-preferences_busy.png) | [手机](390-preferences_busy.png) |
| 39 偏好保存失败 · 合成 | [桌面](1440-preferences_error.png) | [手机](390-preferences_error.png) |
| 40 偏好版本冲突 · 合成 | [桌面](1440-preferences_conflict.png) | [手机](390-preferences_conflict.png) |
| 41 偏好保存意图 | [桌面](1440-preferences_intent.png) | [手机](390-preferences_intent.png) |
| 42 实时连接中 · 示意 | [桌面](1440-connecting.png) | [手机](390-connecting.png) |
| 43 实时重连 · 示意 | [桌面](1440-reconnecting.png) | [手机](390-reconnecting.png) |
| 44 二十一组分页 · 合成 | [桌面](1440-pagination.png) | [手机](390-pagination.png) |
| 45 控件状态板（非业务页） | [桌面](1440-controls.png) | [手机](390-controls.png) |
| 27 长正文 · 合成 · 下部 | [桌面](1440-detail_long-bottom.png) | [手机](390-detail_long-bottom.png) |
| 20 自动已读失败 · 合成 · 下部 | [桌面](1440-read_error-bottom.png) | [手机](390-read_error-bottom.png) |
| 26 技术详情 · 下部 | [桌面](1440-detail_technical-bottom.png) | [手机](390-detail_technical-bottom.png) |
| 38 偏好保存中 · 合成 · 下部 | [桌面](1440-preferences_busy-bottom.png) | [手机](390-preferences_busy-bottom.png) |

主图中无弹窗页面按整页截图，可能高于视口高度；弹窗按当前视口截图。下部图用于补充长内容末端，不作为独立业务场景。

## 交互审核路径

1. 打开交互稿，在分类、处理状态、仅未读间切换；清除筛选或分页时检查URL与组数。下方“审核工具”可切换全部45种场景，切换场景会重置离线草稿。
2. 打开消息：先看阅读/处理分离，再看来源入口。展开技术详情才出现内部键与ID；按Escape关闭后保留筛选。
3. 在详情里试开始处理、关闭通知、重新打开；只记录源合同意图。失败不改状态，处理中禁重复提交和关窗。
4. 打开偏好：取消并重新打开检查草稿保留，邮件始终禁用。保存意图不冒充成功；忙碌取消不会撤销请求。
5. 优先审核布局、阅读顺序、主次操作、两弹窗、手机与异常反馈。用户选择C仅批准方向，未自动批准本稿或生产发布。

## 验证证据与限制

永久数据助手执行真实Vue函数的离线VM片段：read/已读不写、三处理动作、全部已读、偏好PUT、筛选query、忙碌closeDetail、来源路径与文案fallback；六类写入body与原型逐一比对。生产验证器拒绝非法版本与email=true。惰性SQL适配器检查list分组在分页前、summary与markAll的接收范围、投递条件与markAll无筛选条件；没有运行MySQL事务/审计或验证真实并发、幂等。

connectRealtime源码使用惰性EventSource/storage适配器检查游标、失效回读与重复重连守卫；并未建立真实SSE连接。实际Vue的loadGeneration仅保护部分成功结果，meta/错误/详情/自动read迟到、KeepAlive范围和偏好草稿覆盖仍是AN-G02/G03/G06待办，没有被图稿验证关闭。

浏览器验证：45场景双端、98图、六类源body、真实悬停/按下/键盘焦点、Tab边界/Escape/返回焦点、邮件禁用和草稿、正常/空/异常/长内容、页面与弹窗横向溢出、字体和热区。附加320/768/780/781/1024与390×667的五个代表场景。HTTP请求、console/page错误、cookies/localStorage/sessionStorage均为0。capture后再运行无参数源/数据/图哈希及交互复验。

```powershell
node scripts/verify-ui-phase2-notification-c.mjs --capture
node scripts/verify-ui-phase2-notification-c.mjs
npm run verify:docs
npm run verify:runtime-docs
npm run verify:static-analysis
npm run format:check
git diff --check
```

上述两条设计命令复用现有Playwright，不装依赖，不起开发服务；--capture更新本包永久图片和evidence，另一个模式只校验。浏览器/上下文finally关闭。98图、4源码/数据文件、README/evidence和两验证脚本为永久交付，不是临时文件；本批没有临时服务或临时材料。旧图、历史清理受阻材料均不动。

未修改真实Vue/API/OpenAPI/数据库/Worker/权限/邮件/配置/依赖，不部署、不重启，运行参数不变。全角色范围、实际API/数据库/SSE/审计、完整成功与迟到响应、三主题/密度、原生200%缩放及真实屏幕阅读器/生产验收尚未完成。下一项W03自动化与报表等未设计工作面；P26具体审稿和全73页实施、部署、用户签收目标继续保留。
