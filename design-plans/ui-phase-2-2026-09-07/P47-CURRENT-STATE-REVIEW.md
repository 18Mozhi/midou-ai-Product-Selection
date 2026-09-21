# P47 · 当前访问状态与筛选分页复核

## 本次解决什么

空态焦点实施后，原访问/分页预览 helper 的 Vue 导入行锚点不再匹配。已实际重现两项编译
测试失败（`Unique ... preview anchor`，1 不等于 2），不是浏览器证明了业务回归。
另两项证据测试仍把旧图源哈希声明为当前源码，需重新拍摄而不能直接换哈希。
本次仅解决这四项具体冲突，不推定其余全库失败无害。

采用 fixing-accessibility 的局部焦点约束。未修改生产组件、接口、权限、路由、数据库、
依赖或样式；不调整生产重试/超时/并发，不扩大既有审核批准。

## 当前与历史分开

原 `p47-access-review`（60 图）及 `p47-filter-pagination-review`（36 图）保留原 manifest、
driver、helper、CSS 和每张图片。新增测试固定两套存档，禁止用当前重拍覆盖。

新预览仅接受已精确验证的生产 SHA，通过原空态变更的逆变换调用原 helper，再把当前
空态函数、绑定及单次 nextTick 导入完整保留在新预览中。剥离访问/分页提案增量后，script
严格等于当前实际组件；AST 同时核对空态函数原文。未知源码改动拒绝执行，CRLF 不算漂移。
baseline 使用未经变换的实际 App；review 包含当前空态修复，不是旧源码冒充当前渲染。
新 runner 固定旧 runner 的 SHA，只在内存组合，不落临时执行脚本。当前 manifest 绑定实际
原始源码和递归导入的调色板，不使用逆变换哈希冒充当前源。

## 实际图与验证

| 当前图册                                                                            | 本地样例与覆盖                                                | 结果                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| [访问状态](../../output/playwright/p47-access-current-review/index.html)            | 401/403/429/503/500，390/760/1440；原 App、状态面板与登录路由 | 30 组、411 检查、60 PNG、178 源 |
| [筛选分页](../../output/playwright/p47-filter-pagination-current-review/index.html) | 原 45 行样例，20/20/5；五选择、搜索、首末页及单结果           | 6 组、162 检查、36 PNG、178 源  |

访问状态保留原 1/1/3/3/1 初读次数，显式恢复仅一次 GET；提案 401 进入 `/login`，不重读
适配器。拒绝/限流/依赖恢复时提案回持续标题，当前 baseline 的失焦仍如实保留。普通 500
六组邻近像素比较五组为 0，390 action 为 27 像素/最大色阶差 2，在原 64/2 容差内；未改容差，
不宣称全部逐像素相同。无写请求、请求体或未知外网调用。

分页原样 baseline 的首末页 disabled 仍失焦 BODY，提案回页码状态；分页修复未实施生产。
新加六项检查证明空结果清除后两种模式都保留实际搜索焦点。六模型恢复、全局目录事实、
原 20 条页大小均不变，筛选/分页/清除不新增 GET。不能用审核提案通过宣称生产分页已修复。

18 项关联单测通过，覆盖两组当前源码/图片、存档不可变、原样空态函数及既有空态修复。
本次未改应用代码/依赖，沿用上一轮前端构建与资源预算通过的结果，不重复构建。
未重复全库测试：上轮 1316 项中 198 项失败是历史运行结果，不能凭本次四项转绿推算最新总数。
全库失败、未审状态、真实权限/探针与全 73 页交付仍未完成，未提交、未部署，commit hash 不适用。

## 复验与收尾

- `node scripts/verify-ui-phase2-provider-adapter-current-states.mjs --state=access --capture`
- `node scripts/verify-ui-phase2-provider-adapter-current-states.mjs --state=filter-pagination --capture`
- `node --test tests/unit/ui-phase2-provider-adapter-access.test.mjs tests/unit/ui-phase2-provider-adapter-filter-pagination.test.mjs tests/unit/ui-phase2-adapter-current-state-preview.test.mjs tests/unit/ui-phase2-provider-adapter-empty.test.mjs`

无新增业务参数；`--state` 是仅供本地审核的脚本选项，不影响生产。OpenAPI、环境文件、
后端/Worker/Python 消费方与运行重启均不适用。新图包为正式审核交付物，不是临时文件；
没有临时图片/日志/草稿脚本。Vite 和 Chromium 已自动关闭，本轮端口 64500、64575、64513、64710。
当前图只更新验证基底，不表示用户重新批准或扩大旧批准；访问状态、分页提案仍待各自审核。
