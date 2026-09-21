# P67 读取追踪归属与披露 · 批次62

起点 main/6025c198、630项工作区变化、索引为空。上一轮完成P67真实Vue组合与三处限定区域批准，属于进展；本轮自动继续不视为用户批准。P67探针失败资源区域仍待审，P62/P64/P66离页策略仍待决定。

## 原因与实际修改

按AGENTS→Feature Map→总纲M08-02→P67规格，追到RedisResilienceCenter、共享ApiClient、Redis路由和TechnicalDetails。当前Redis GET返回request_id/trace_id，真实读取写MySQL观测/查看/审计；本轮全用本地拦截，没有真实Redis/MySQL操作。

原Vue的成功快照、普通读取失败和超时共用requestId；旧快照保留时，新失败编号覆盖页脚旧快照编号，三个披露又同名“技术详情”。12项新增测试先全部失败，其中直接证据为快照预期`snapshot-original`，实际变成`failure-new`。

最小修改生产Vue：

- 成功返回用requestId，失败用readFailureId；重读清除前次失败，不重贴保留快照的编号。
- 超时使用本次真实发出的关联ID；未知异常不假造失败ID。ApiClient缺少响应ID时使用已发送ID的既有规则不改。
- 401/403清除数据时同步清快照ID，失败ID只留在本次失败披露。
- null响应没有快照，但可显示该次成功读取的编号，名称为“本次读取追踪”；下一次无快照读取开始时清掉这个旧空响应编号。
- 保留原单飞、15秒、保活/卸载、状态和权限规则；没有新增读取、重试、API字段或审计。

fixing-accessibility技能用于清楚命名并复用原生details/summary。三个显示位置不变：刷新失败、首次状态、成功页脚；首次状态位置在空成功/失败两种TechnicalDetails模板间二选一，因此静态声明4个、实际最多3个位置，不是新增模态。

C审核样式另外修正失败正文旧字体/颜色继承、复制按钮继承手机整行宽度：正文使用现有C字体与中性蓝灰；复制保持白底蓝字、44px高和自然宽度。只作用审核CSS，不改生产布局和已经批准的持久化/采样区域。r1保留为该样式修订对照，当前用r2。

## 验证与图

新增`tests/unit/redis-trace-ownership.test.mjs`（13项）和`scripts/verify-redis-trace-ownership.mjs`。相关原审核测试与共享复制测试合计27项通过。覆盖首次/保留/限流/未知失败、401/403、真实已发ID、空响应转换和卸载迟到归属。惰性来源生成器同步检查新字段，但没有改变业务数据。

37组原数据集JSON指纹改前改后完全一致：`705ec8e4bfad8c86a7148d529f095f9afda77ff2b4a9f0f35696d918fbd061b7`。旧离线数据/源码指纹/已批准历史图不重写；旧图册不是当前源码证据，当前默认回归使用实际Vue验证器。

- 1440/390 × reduce/no-preference：追踪204项检查、40次本地GET；原37数据集回归1342项/148次GET。合计1546项浏览器检查、188次本地GET。
- 实际原生Enter披露、44px次级复制、成功/拒绝/迟到复制、首次错误、保留快照、无响应编号回退、本次真实15秒前端超时、401/403、null→失败→成功均核对。普通失败使用本地400映射到既有unavailable分支；不冒称真实503依赖故障验收。
- 剪贴板被本地替身接管；分别核对失败消费者复制新ID、快照消费者复制旧ID，复制拒绝在本地显示，迟到回执不能给新快照标“已复制”。没有写系统剪贴板。
- `npm run build:web`（包括vue-tsc）通过；`node scripts/verify-frontend-budget.mjs`通过，253资源。后续只改审核CSS，未重复未变化的生产构建。
- [追踪r2图册](../../output/playwright/p67-trace-ownership-r2/index.html)：双端22PNG/173来源指纹，每端11图，含首次折叠/展开/复制拒绝、快照、保留失败与旧快照、超时、权限/失效、空响应、空响应后的失败。区域截图核对可见字段边界和中心命中；r1同22图留作对照。

本批提请仅审核手机“本次失败读取追踪”和“快照读取追踪”两区域的名称、编号排列、次级复制与留白；数据为本地样例。没有回答就待审，不扩大到真实剪贴板、权限、全页或生产。之前批准的持久化r2与两种采样异常r3保持原有限定范围。

## 复验与运行交接

仓库根目录：

```
node --test tests/unit/redis-trace-ownership.test.mjs tests/unit/redis-page-preview.test.mjs tests/unit/ui-phase2-technical-copy.test.mjs
node scripts/verify-redis-trace-ownership.mjs
node scripts/verify-redis-page-preview.mjs
```

无参数验证不产出截图。仅生成新审核修订时用`node scripts/verify-redis-trace-ownership.mjs --capture-review rN`，目录必须不存在。当前无需调节环境变量，无需服务重启。本轮未部署；未来正式发布通过原本地构建+宝塔部署流程更新静态资源，浏览器重新加载后读取修复代码，不需要为本项重启Redis或后端。

未改API/OpenAPI、后端/Worker/Python、配置/env、权限、数据库、Redis策略、共享复制实现、保活规则；不适用外部合同迁移。Feature Map/规格/运维/审核入口同步当前前端语义。首次读取错误布局、等待/重试焦点连续性、保活离页、完整读屏/主题/密度、真实权限审计/恢复和73页整体交付仍未完成。

## 提交与清理边界

既有API覆盖225/258对223/256、M08旧风格文件名断言、历史外壳图册源码指纹问题仍存在；其失败原因未变化，未重复运行或改写历史证据。新相关测试/构建通过不代表完整验证全绿。依规则不暂存、不提交，commit hash不适用，未部署。

本轮未创建一次性测试文件；新测试/验证器和两版追踪图册属于交付物。构建更新项目必需dist/browser-helper产物，保留不当临时文件删除。Vite与Chromium由finally关闭，无常驻服务。之前`output/playwright/p65-read-states-r1`（36文件）、`output/playwright/p65-table-controls-r1`（13PNG）清理受工具策略阻止，仍保留，未绕过。

收尾复核：r2共22张PNG与173来源SHA全部一致；相对批61已登记apps源码，只有RedisResilienceCenter发生本轮变更。格式、相关diff空白、Feature Map解析通过；6个本轮验证端口与相关验证Node进程均无残留。636项工作区变化、索引为空；两个前批临时目录仍存在，未删除任何未知归属文件。
