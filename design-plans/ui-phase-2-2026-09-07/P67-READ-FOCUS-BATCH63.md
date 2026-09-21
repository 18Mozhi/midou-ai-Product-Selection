# P67 读取焦点连续性 · 批次63

起点 main/6025c198，636项在途变化、索引为空。批62已修追踪编号归属；本批继续P67真实Vue的重试焦点。用户对批62追踪图、批61探针失败资源图和旧验证门修订的选择尚未返回，本批不把它们视为批准，也不改失效检查。

## 事实、问题与最小修复

依据AGENTS、Feature Map、总纲M08-02、P67规格以及实际`RedisResilienceCenter.vue`。路由仍为`/platform-admin/redis`，读取仍需要`platform:operate`，真实GET会写观测/查看/平台审计；本地验证只拦截请求。

焦点检查在修改前以1440/390、两种动效四组实际Vue复现：从首次错误或保留快照的“重新核验”触发读取后，该重试按钮被条件渲染移除，焦点没有交给持续存在的顶部刷新按钮。此时键盘用户会失去可预期的操作位置。

使用 fixing-accessibility 技能做最小修复：

- 添加三个原生button引用，并在`load()`的单飞判断之后、清除旧提示之前，只在当前焦点确实位于被移除的重试按钮时转交到顶部刷新按钮。
- 转交要求两端连接、可见、未在inert树；焦点设置失败不滚动；若目标被遮挡或不在视口才居中滚动。用户已经把焦点移到别的元素时不抢回。
- 顶部刷新在等待期间保留原生可聚焦button，改用`aria-disabled`/`aria-busy`说明暂不可用；原有`controller`单飞守卫继续拒绝鼠标、Enter、空格与程序化重复触发。
- 审核C样式将等待按钮显示为不透明灰底和蓝色3px焦点环；生产基础CSS同样覆盖aria-disabled的等待视觉。没有改15秒、请求、超时、编号、权限或缓存规则。

新增永久`tests/unit/redis-read-focus.test.mjs`与`scripts/verify-redis-read-focus.mjs`。前者覆盖重试/保留重试交接、无必要滚动、用户移焦、隐藏/断开/inert、焦点失败、遮挡滚动及单飞顺序；后者用实际Vue核对键盘行为。

## 验证与审核图

- 34项P67页面/追踪/焦点合同测试通过；加共享TechnicalDetails复制合同共41项通过。
- 实际页面1440/390 × reduce/no-preference：112项焦点检查、28次本地GET；默认P67页面复归1342项/148次GET，追踪复归204项/40次GET。合计1658项浏览器检查、216次本地GET。
- 等待时Enter、Space和`click()`均不新增读取；成功/失败后保留顶部焦点；用户主动移到二级导航后，成功、失败及未聚焦的程序化重试都不抢回。无外部请求、写请求、下载或浏览器错误。
- `npm run build:web`（含vue-tsc）和`node scripts/verify-frontend-budget.mjs`通过；资源预算253。默认业务37个惰性样例的指纹在批62后保持不变。
- [焦点r1图册](../../output/playwright/p67-read-focus-r1/index.html)含双端10PNG/173来源指纹：首次重试焦点、等待、完成，及保留快照重试焦点、等待。图只用于视觉审核；r1不是真实Redis、权限、审计或完整键盘验收。

本批提请仅审核手机顶部刷新按钮的两种状态：等待时灰色按钮的蓝色焦点框，以及完成后蓝色按钮仍保留焦点。当前问题未回答即待审；不包含标题、整页、所有交互或真实Redis验收。

## 运行、范围与收尾

复验：

```
node --test tests/unit/redis-read-focus.test.mjs tests/unit/redis-trace-ownership.test.mjs tests/unit/redis-page-preview.test.mjs tests/unit/ui-phase2-technical-copy.test.mjs
node scripts/verify-redis-read-focus.mjs
node scripts/verify-redis-trace-ownership.mjs
node scripts/verify-redis-page-preview.mjs
```

`--capture-review rN`只创建新目录。无环境变量、配置、API、OpenAPI、数据库、后端/Worker/Python、Redis策略、权限、离页策略变更；无需重启或部署。未来正式更新前端静态构建后浏览器重新加载即可，本项不需要重启Redis或Node。

既有API覆盖225/258对旧223/256、M08旧风格图名与历史外壳图册指纹问题仍未按用户授权修订；不暂存、不提交、commit hash不适用，未部署。新图册/测试/验证器是交付物；无一次性临时文件，Vite与Chromium均finally关闭。前批`output/playwright/p65-read-states-r1`（36文件）及`output/playwright/p65-table-controls-r1`（13PNG）仍受清理策略阻止，未绕过。P67的首次错误/权限区、探针失败资源区、追踪区、离页保活、主题/密度/读屏、真实权限/审计/恢复及整页签收仍未完成。
