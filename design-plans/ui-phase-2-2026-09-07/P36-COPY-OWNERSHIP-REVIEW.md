# P36 复制反馈归属修复与功能验证

本次只修复 OG-G05 中的旧复制反馈串到新明文部分。手机筛选局部批准不扩大；创建组合仍待审核。整页、新 C 明文区域、真实权限和全 73 页生产交付均未完成。

## 改动与依据

`OrganizationTokenPanel.vue` 原先在 `clipboard.writeText` 完成后直接写入反馈。以 `b4fc398d9b696b1a9922e284d12d792ea7852265` 为基线，旧明文替换、清除、路径变化、停用缓存、卸载和后发请求先返回等定向测试有 14 项失败。

当前实现按复制序号、开始时的明文与路径核对归属；明文/路径同步变化、缓存停用和卸载使旧反馈失效。同一次展示里最后一次复制的反馈优先。没有取消已提交给系统的剪贴板写入，也不清空系统剪贴板。

模板、按钮文案、复制内容、四种读取权限、创建/轮换/撤销请求、父级的一次性明文生命周期不变。有效期 `ceil` 负零问题不是这次改动，不能将整个 OG-G05 标记解决。

## 验证与图册

- [28 张实际子 Vue 功能状态图](../../output/playwright/p36-copy-ownership/index.html)：390/1440 两宽度，成功/失败各六种展示变化及两种乱序，28 场景、90 检查。真实 router/KeepAlive，缓存返回核对同一 DOM，卸载返回核对新 DOM。
- `tests/unit/organization-token-copy-ownership.test.mjs`：18 项当前/基线回归，其中同步清空再赋同值由直接响应式测试覆盖。浏览器宿主批处理 props 不冒称证明这个同步细节。
- `tests/unit/ui-phase2-token-copy-ownership.test.mjs`：当前源与截图指纹、场景清单和未知源漂移拒绝。
- 当前浏览器验证直接加载生产子组件，不做源码替换。宿主模拟父级输入，所有 API/外部请求被阻止，剪贴板为延迟 Promise；图片只有无效测试文本。不是父级创建/轮换、完整 App、真实凭据、系统剪贴板、C 布局或生产验收。

## 历史证据边界

旧审核 PNG 和旧 manifest 不重写。`scripts/lib/ui-phase2-token-copy-baseline.mjs` 只接受精确 before/after 指纹并读取固定 Git 版本，供旧截图关联与原问题复现使用；未知改动失败关闭。旧设计数据 helper 继续复现旧 OG-G05，不能作为当前缺陷结论。

P36 动作映射重建自当前源；旧外部图只核对历史来源。P37/P42 历史图导入但未展示的 P36 依赖也显式核对固定基线，不把旧图重新包装为新版本验证。统一图包报告区分历史来源和当前哈希。

## 使用与运维

提交前结果：679 项相关 UI/边界/归属单元回归全部通过；`npm run build:web` 类型检查及 417 模块生产构建通过，`npm run verify:docs` 的 73 路由与 153 必需文档检查通过，样式门与 diff 空白检查通过。图包审计无来源/图片漂移，但全页完成仍为 unproven。验证端口 54350 已无监听。仅新增永久测试与 28 PNG 图册/manifest/index，无本批临时文件残留。

无需新配置、开关或调参。复测：`node --test tests/unit/organization-token-copy-ownership.test.mjs tests/unit/ui-phase2-token-copy-ownership.test.mjs`；实际浏览器：`node scripts/verify-ui-phase2-token-copy-ownership.mjs`。仅明确重建本批证据时加 `--capture`；不覆盖以前审核图。

本批未部署。生产生效须后续从干净提交按项目既定命令本地构建并经宝塔上传前端，再刷新页面；本改动本身不要求后端/Python/MySQL 重启，也无环境变量、OpenAPI、数据库或权限变更。测试宿主和浏览器均在 finally 中关闭；图册是保留交付物，不是临时截图。
