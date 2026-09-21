# P67 Redis 运行实际 Vue C 组合 · 批次61

起点 main/6025c198，623 项在途变化、索引为空。本轮承接完整 73 页重设计。用户对 P57 四种取消按钮的批准已在原 button-review-r1/README 中限定记录，不扩大为 P57 整窗或 P67 视觉批准；P62/P64/P66 离页策略仍待决定。

本轮后续用户已批准 **P67 手机持久化白区 r2** 的 AOF/RDB 启用/最近结果、分隔线及部署目标说明组合，并批准 **r3 两种采样异常提示近图**（全部测量失败、客户端不支持）。2026-09-20 用户进一步集中批准 r3 资源区四种异常：探针失败“未取得资源观测”、未设置内存上限、使用量超过上限、非 `noeviction` 策略；也批准读取追踪 r3 的八种反馈：资源实测为零、首次无观测、保留旧快照的刷新失败、权限拒绝、刷新超时、登录失效、请求编号复制失败、首次失败默认折叠。批准仅覆盖这些局部区域，不含正常资源卡、上方统计、整页、真实 Redis 或恢复验收。r3 只修截图取景，不改变已批准的模板/CSS。

## 依据与实施范围

依次按 AGENTS、Feature Map、总纲 M08-02 和 P67 规格，追到 `/platform-admin/redis` → `RedisResilienceCenter.vue` → `GET /platform/operations/redis` → 当前 probe/evaluator/service/repository。该 GET 要求 platform:operate、no-store，真实环境会写观测/查看/平台审计；本地拦截不意味着真实 GET 没有持久化副作用。

ui-skills-root 选择 frontend-design，沿用待审 REDIS-C-r1 的蓝色横向边界、白色观测区、右侧部署目标；审核专用 Vite 插件以生产组件 script 为基线编译，并在预览时替换 template 为 C 方向审核布局，生产组件 script 字节等值。故图册可证明真实 script 的数据与状态接线在审核模板中可运行，不能证明生产组件的原 template 已采用此布局。手机按发现→资源→持久化→未覆盖项→采样顺序排列。原刷新、重试、登录和三个 TechnicalDetails 保留，没有新增业务表单、排序、分页、弹窗或执行按钮。

显示层明确区分：

- 当前总体状态与每个资源条自己的 warning/stop findings，不根据全局 blocked 把所有条染红。
- `redis_unavailable` 说明探针失败；零计数、100% 比例、未知持久化不作为实测正常、满额、运行时长或已关闭配置。DTO 没有 available 字段，使用真实服务输出的 finding，不猜字段。
- 已观测的 0 用量仍显示 0；没有上限与超过上限后的服务封顶比例另有说明。
- AOF everysec 是部署目标；当前探针未读取 appendfsync/bind/protected-mode，也没有恢复演练证据。AOF 写入结果可能回退为重写结果，DTO 未分离来源。
- 局部 80% 淘汰提示与服务运行 policy 分开，不改原阈值。Sentinel/Cluster=false 为固定拓扑边界，不是独立在线探测证明。
- partial 且列表空表示可能全部测量失败，不写成没有业务键；成功测得 0 字节不画占比条，标“无比例分母”。采样只比较成功测得字节，不代表整个 Redis 或访问频率。

新增永久文件：`scripts/lib/redis-page-preview.mjs`、`implementation/redis-page-preview.css`、`scripts/verify-redis-page-preview.mjs`、`tests/unit/redis-page-preview.test.mjs`。复用已有 `ui-phase2-redis-design-data.mjs`，没有修改其源逻辑、生产 Vue/CSS/外壳或安装依赖。

## 样例与验证

36 组当前 probe/evaluator/service/采样器的惰性合成输入输出，加 1 组原始 E2E，共 37 组。已有生成器只使用内存 SCAN/MEMORY/仓储替身，验证有界采样 128 键、32 轮、每批最多 16，保留原 E2E 日期及部分数据。没有 Redis socket、SQL、真实恢复、系统剪贴板或生产操作。

- 新增 7 项模板编译、script 等值、命名分区、动作与显示合同检查通过。
- 扩展到 M08-02 与共享外壳，共 22 项检查，20 通过、2 失败。不能称扩展测试全绿。
- 失败一：`tests/m08-02/redis-single-instance-resilience.test.mjs:511` 仍要求架构文档包含 `61_平台运营-概览.jpg` 等旧风格参考名称；测试及架构文档相对 HEAD 未变，未补造旧图引用。
- 失败二：共享外壳历史 r2 证据要求当前 `BackupRecoveryCenter.vue` 等于旧图册指纹。该文件当前 SHA 与批59图册一致，非本轮修改；不覆盖历史证据消除差异。
- 既有 API 覆盖 225 路径/258 操作与旧 223/256 断言不符仍待处理；两个输入相对 HEAD 未变，未重复运行。
- 实际 App：1440/390 × reduce/no-preference，r2 共 1,292 项检查；r3 增加取景遮挡检查后共 1,342 项，两版均各有 148 个本地 Redis GET；37 组总体结论、发现数、采样行数、资源独立颜色等级、失败占位、零分母、横溢均核对。原生技术详情 Enter 展开/关闭、编号、可见焦点、44px 控件通过。没有页面异常、外部请求、写请求或下载。
- r1 看图发现旧标题衬线字体和页脚右对齐继承；r2 显式规定标题字体/字重与页脚左对齐，并增加浏览器断言。r1 保留修订对照，不是当前审核基线。

本轮不宣称逐条业务文案、每个像素、所有读屏/缩放/主题/密度、首次失败/权限/完整刷新焦点及保活生命周期均已验证。r2 采样区域截图发现固定导航遮住部分标题；r3 按原生 sticky 导航的 top/高度预留空间，短区域检查视口及可见文字中心命中，过长区域回到页顶改截整页，并在 manifest.scope 标明范围，不隐藏导航冒充无覆盖。另补两种异常短区域。外壳二级导航本轮未重构、不在本次区域批准范围。

## 审核图与使用

当前入口：[实际 Vue r3 图册](../../output/playwright/p67-page-composition-r3/index.html)，30 PNG / 173 来源指纹。每端 15 图：默认整页、持久化、原始采样、追踪，五个资源边界、四个采样边界，以及两种采样异常近图。超过视口可用高度的原“区域”文件实际为整页，清单 scope 已注明。37 个数据集都执行页面检查，不等于每个数据集都已截图或批准。旧离线 61 场景 126 图不是本轮实际 Vue 全状态验收。

手机持久化白区 r2 和两种采样异常浅灰提示 r3 已批准，范围分别记录。现在提请审核 r3 手机探针失败的资源区域：标题、浅灰提示、未观测与占位值说明；不含整页/其他失败状态、真实 Redis、权限或生产验收。未回答保持待审。

复验：`node --test tests/unit/redis-page-preview.test.mjs`；`node scripts/verify-redis-page-preview.mjs` 无参数不输出文件。仅生成新修订时使用 `node scripts/verify-redis-page-preview.mjs --capture-review rN`，目标目录必须不存在，不覆盖旧版。无需调整环境变量或重启服务。

## 收尾与未完成

未改生产 API/OpenAPI、配置、环境、数据库、权限、Worker/Python、Redis 判门/采样/离页规则；Feature Map 和相关文档仅同步审核进度。未部署、未重启；生产源码未变化，不重复生产构建。由于上述验证阻碍且工作区仍含大量既有改动，不暂存/提交，commit hash 不适用。

三版图册和永久验证脚本是交付物，保留，r1/r2 为修订对照；r2 已批准的持久化图仍保留。无新建一次性测试文件；本地 Vite 与浏览器均由 finally 关闭。之前 `output/playwright/p65-read-states-r1`（36 文件）及 `output/playwright/p65-table-controls-r1`（13 PNG）清理受工具策略阻止，未重试绕过，仍需处理。目录搜索过宽的本轮 rg 进程已明确停止，无业务进程受影响。

P67 待继续：首次读取/错误与权限状态、刷新追踪编号归属、等待与重试焦点、保活离页行为、全主题/密度/读屏以及真实权限与恢复证据；P67 整页批准及完整 73 页实施/部署/签收未完成。

收尾复核：r3 的30图/173来源指纹全部一致，r2已批准的CSS未变；前批159个已登记apps源文件无漂移。格式、相关diff空白与Feature Map解析通过；6个本轮验证端口已无监听，Vite/浏览器均关闭。630项工作区变化、索引为空；两个既有P65受阻临时目录仍存在。审核回复后的文档记账不触发重复执行未变化的代码验证。
