# M06-05 宝塔运维与回滚

P60批次27：`node scripts/verify-open-page-preview.mjs --action-results`验证实际Vue操作/读取双结果；`--capture-action-results rN`独占创建审核目录，当前r2十四图。52GET/12PATCH/4POST均为浏览器本地拦截，无真实保存或投递。成功操作与刷新结果/追踪分开；“重新读取列表”只GET，读取中禁用，恢复后仍保留。15000ms、重试、接口和权限未改，无新配置。未部署，未来批准后由宝塔发布前端并刷新浏览器，不需本批额外后端重启。边界与临时包清理受阻见 `design-plans/ui-phase-2-2026-09-07/P60-ACTION-RESULTS-BATCH27.md`。

P60批次26补充：`node scripts/verify-open-page-preview.mjs --read-states`四组读取/恢复检查；`--capture-read-states rN`独占创建新审核包，当前r2为20图。超时使用原应用15000ms计时器，API重试与权限保持；首次失败不重复提示，有旧快照才说明保留。708项/108次模拟GET，不实际发送或写入。C状态CSS/96px手机底部留白仅审核宿主；实际Vue反馈与语义修正尚未部署。未来批准后仅需宝塔发布前端和浏览器刷新，本批无后端重启、迁移或新配置。写成功后刷新失败覆盖提示等剩余项见 `design-plans/ui-phase-2-2026-09-07/P60-READ-STATES-BATCH26.md`。

P60批次25补充：`node scripts/verify-open-page-preview.mjs --details`运行三类详情12样例、四宽/两动效1556项，无文件输出；`--capture-details rN`独立创建新图包，当前r2有24图。96次本地GET，全部行确认只取消、无管理写入或外部回调。旧无参/创建模式保留。审核CSS、分组和3秒测试焦点绘制等待均非生产配置，无新增环境变量、迁移或重启；完整边界见 `design-plans/ui-phase-2-2026-09-07/P60-DETAIL-COMPOSITION-BATCH25.md`。

## P60 本地 C 审核验证（2026-09-15，非部署）

`node scripts/verify-open-page-preview.mjs` 启动临时回环审核宿主，双端134项验证后关闭，无文件输出。`--capture-review rN` 首次创建 `output/playwright/p60-page-composition-rN` 并拒绝覆盖；当前r2有26张实际Vue图。原E2E合成数据，6次模拟GET，创建只核对确认并取消，阻断未知/写入/外部请求。生产入口不导入审核组件/CSS，不改环境、接口、权限、密钥或Worker配置；无部署、迁移和重启要求。范围见 `design-plans/ui-phase-2-2026-09-07/P60-PAGE-COMPOSITION-BATCH24.md`，不能替代下列真实运维验收。

## 生产运维

1. 在宝塔备份 MySQL 后执行 `0023_open_platform_m06_05.up.sql`。
2. 在宝塔 Node API 与 Node Worker 项目设置 `OPEN_API_*`、`WEBHOOK_DELIVERY_*`；两者必须使用同一 `CREDENTIALS_MASTER_KEY` 和 `CREDENTIALS_MASTER_KEY_VERSION`。保存后重启 API 与 Worker，配置不是动态读取。
3. Web 站点反向代理需同时放行 `/api/v1` 与 `/open/v1` 到同一 Node API；不得新增面板外服务。
4. 用具备 `platform_token:manage` 的平台安全管理员访问 `/platform-admin/open-platform`。若菜单未出现但管理接口可访问，检查 `config/route-catalog.json` 与生成产物是否一致，不要临时提升为平台超级管理员。创建、轮换或撤销 API Client 前先核对“令牌权限风险预览”的组织、授权能力、分钟配额和访问后果；当前只能显示 `status:read`，若出现未开放 scope 应停止操作并检查发布版本。创建/轮换密钥后立即保存一次性明文；日志和工单只记录 Client 前缀或 Webhook 指纹。
5. 调用 `/open/v1/status` 时发送 `Authorization: Bearer <secret>`、当前 Unix 秒 `X-ScoutOps-Timestamp` 和每请求唯一 nonce。收到 409 时不得复用 nonce；429 按分钟窗口退避。
6. 页面顶部总数不受当前分页截断；Client、Webhook 和投递分别支持最长 120 字搜索、状态筛选、排序、10/20/50 每页和前后翻页。筛选条件保存在 URL。400 表示 UUID 或筛选参数非法，503 表示 MySQL 等直接依赖不可用；页面超时或 503 时会保留上次成功结果，先按请求 ID 查 API 日志再重试。
7. 在宝塔 Worker 日志按 request_id/trace_id 排查投递；页面提交测试后应出现 queued，Worker 领取后出现 leased，再进入 succeeded、retry_scheduled 或 dead_letter。死信只能从页面携带原因重放，原 delivery 与事件历史必须保留。目标 DNS 解析到任何私网地址都会被阻止。

390px 页面验收时，当前数据类型最多显示一页摘要卡片且没有横向宽表；数据类型切换区可横向滚动，详情抽屉仅保留当前状态允许的测试、启停、轮换、撤销和重放动作，确认弹窗必须支持 Escape、焦点圈定与焦点返回。Client 前缀、Webhook 指纹、原始错误代码、各类 ID 与 request_id 默认不出现在主界面，展开“技术详情”后可用于日志关联。桌面常见分辨率应使用完整宽度表格，不得把两个主表压缩在同一行。

调节：默认 Client 有效期 90 天、配额 60/min（最大 1000/min）、时间容差 300 秒、nonce 保留 600 秒、投递轮询 2000ms、lease 60 秒、超时 10000ms。修改后必须重启对应宝塔 Node 项目。

回滚：先停止开放入口和 Worker 投递，回退 Web/API/Worker；确认无需保留 Client、Webhook、usage 与投递审计后，执行 `0023_open_platform_m06_05.down.sql`。该 down 会删除 M06-05 表，属于数据删除操作，必须先导出审计与死信证据。若需保留历史，只回退代码并停用端点，不执行 down。
