# P47 · 会话、权限与依赖访问状态 r1

## 设计与真实路径

起点 `main/7691b467`，实际 App / ProviderAdapterCenter / 共享 UiStatePanel。使用 frontend-design 保持已批准 C 方向的冷灰白工作区与蓝色主动作；fixing-accessibility 核对状态公告、原生按钮、44px、键盘与异步焦点。独立 Vite transform 只作用审核 host，**生产组件、共享状态组件、API、权限和部署均未改**。

状态来自现有 failure 映射：401 expired、403 forbidden、429/503 blocked，普通 500 error 作为邻近隔离对照。实际 `/login` 路由已在 `apps/web/src/router.ts` 与 LocalIdentity 注册；没有猜新地址。

| 状态 | 新标题与说明 | 动作 |
| --- | --- | --- |
| 401 会话过期 | 请重新登录后继续；为保护账号，当前页面未展示采集状态。重新登录后可以继续。 | 重新登录，实际 Vue Router 进入 `/login`，不再错误重读 adapters |
| 403 权限不足 | 当前无法查看采集状态；当前权限还不能读取这些内容。权限调整后，可以重新读取。 | 保留只读重新读取；本地权限恢复样例后显示原两条目录 |
| 429/503 受阻 | 暂时无法读取最新状态；读取已安全停止，没有显示推测数据。服务恢复后可以重新读取。 | 保留只读重新读取；429/503 原三次安全 GET 不变 |

文案沿用用户在 P34 已通过的温和权限语气，但本批仍需独立审核；没有把 P34 批准外推到 P47。隐藏共享状态组件的英文眉题和符号，使用 4px 状态边线区分：会话蓝、权限灰、受阻暖棕。追踪编号仍由 UiStatePanel 的 `sanitizeCorrelationId` 清洗，本批只把米色继承框改为透明冷灰分隔行。

UiStatePanel 原 secondary 在 P47 现有 C CSS 中不可见，本批确认每个状态只有一个有效按钮。普通 error 不匹配新 CSS，六张前后图片尺寸一致；本轮最终重跑为 0 像素差，验证器仍保留最多 64 像素/2 色阶的明确字体栅格容差，不宣称任意重跑都字节相同。

## 交互与无障碍证据

- [60 图总览](../../output/playwright/p47-access-review/index.html)：基线/审核 × 390/760/1440 × 401/403/429/503/500 × 状态与动作，共 30 组、411 项检查。
- [证据清单](../../output/playwright/p47-access-review/evidence.json)：170 个当前原始源和全部 PNG 的 SHA-256/尺寸，含 6 组邻近 500 像素隔离结果。
- 所有初始失败均无概要/目录假数据，aria-live 保持 assertive；操作可键盘触发并至少 44px，无横向溢出。
- 403/普通 500 各 1 次 GET；429/503 原安全重试 3 次。非 expired 状态本地恢复只多 1 次显式 GET；无 POST、请求体或未知网络。
- 401 审核稿进入实际 LocalIdentity 登录界面，provider-adapters GET 数不增加。基线仍记录旧「重新读取状态」路径，未把旧错误行为伪装成通过。
- 403/429/503 的按钮在恢复成功后消失；基线焦点落 BODY，审核稿在调用原 load 前聚焦持续存在的 P47 标题 header（tabindex -1、preventScroll、可见轮廓），结算后不抢焦点。普通 500 保持旧行为以证明新 handler 隔离。

复验：`node --test tests/unit/ui-phase2-provider-adapter-access.test.mjs`。重建：`node scripts/verify-ui-phase2-provider-adapter-access.mjs --capture`。本地失败与恢复样例不是实网登录、真实权限、限流、依赖或探针验收；也不覆盖真实网络中断、全读屏或登录后 return-to 策略。

所有 Vite/Chromium 已关闭。最终证据端口 53358/53507；此前视觉调整与容差探测端口也经 finally 关闭。正式图包保留，无临时草稿、日志或测试数据文件。

## 待审与开放项

390px 三张访问状态待用户审核，仅确认文案和区域组合；登录动作、焦点提案、其他宽度、整页与生产仍需分别验收。读取中、刷新失败、首次读取失败仍待答复；空态焦点、跨页检查锁、真实探针及全 73 页继续开放。
