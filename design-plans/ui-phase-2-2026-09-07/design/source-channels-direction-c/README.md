# P48 来源频道 · SOURCE-CHANNELS-C-r1

2026-09-09，基线 main/6afe4b8。**具体图稿待审，不是生产上线或全站完成。**

81 个场景，桌面 1440×1000 / 手机 390×844 双端 162 张主图，加 39 张连续弹窗中下部，共 201 PNG；包括 2 张非业务审核工具图。目录采用完整页面截图，四类弹窗采用视口与连续滚动截图，不能只看首图判断字段或按钮缺失。图、原型、数据与验证器为永久交付物。

[打开交互审核原型](index.html?review=1) · [可复查验证证据](evidence.json) · [P48 事实规格](../../page-specs/P48.md)

## 设计选择与审核顺序

先看默认目录、公开/登录/导入来源详情，再看采集设置三阶段、配置历史、固定样本和兼容矩阵。最后按全场景目录核对异常与按钮状态。C 方向采用蓝色导航/来源身份与白色操作区；frontend-design 技能指导“来源目录 → 当前来源事实 → 分任务处理”，不继续旧卡片墙。桌面左侧来源目录与右侧事实面并列；手机列表进入页内详情，不增加第五种弹窗，保留返回目录。当前每页 20 项完整展示，长目录需滚动。

中文系统字体、16px 表单和按钮、至少 13px 次要信息、44px 交互热区。手机筛选默认折叠，保留搜索。原型使用四种原生模态任务面：采集设置、版本回滚、固定样本、解析矩阵；蓝色身份区和白色操作区分开。已修订窄屏差异表的继承最小宽度、重绘后焦点和新窗口/新场景滚动归零，主图不从上一窗口中部开始。

## 数据口径与按钮合同

| 控件或动作 | 设计稿处理 | 保留的真实边界 |
| --- | --- | --- |
| 目录统计 / 三组 / 分页 | 原 146 项，138 自动目录、42 非谷歌自动目录、1 市场；20 项/页，末页 6 项 | 全目录统计不随筛选改变；组总数属于全过滤集，组内行属于当前页 |
| 七筛选 / 重置 | 搜索、类型、可用性、市场、语言、接入模式、排序；重置并回第一页 | 原 computed 顺序与匹配；URL q/category/availability/market/language/access_mode/sort/page；重置不清 provider_id |
| 关联来源 / 来源详情 | 精确定位已登记 ID；技术字段与策略展开；手机返回目录 | 不以当前菜单代替权限，不增加登记、采集或上传按钮 |
| 刷新 / 失败重读 | 初次读取与保留旧目录刷新分开，失败说明是否仍展示旧数据 | GET provider-sources，不是成员即时采集或 provider-sources/refresh |
| 编辑采集设置 | 频率、超时、重试、状态、原因五字段及同频/并发预览 | 1–10080 分钟、1000–120000 ms、0–10 次均整数；原因 2–500；expected_version 正整数 |
| 烟测并启用 | 停用配置保存 → 真实来源烟测 → 新版本锁启用；部分成功与未知结果单独提示 | PUT disabled → 无 body POST health-check → PUT enabled；烟测失败不声称“没有写入” |
| 匿名测试 | 已登记、原 availability automatic、public_page/public_rss 才显示 | POST health-check 无 body，可真实外发并写健康记录，不能当只读 GET |
| 版本 / 回滚 | 当前版本与历史差异、回滚原因、恢复此版本；生成新当前版本 | target_version/expected_version/reason；只对 rollback_available 展示；不覆盖历史或绕过启用校验 |
| 固定候选 | 仅 1688 已登记来源；候选原始夹具为空，演示候选明确合成 | browser_job_id 与固定的时间命名；不增加手工样本上传或名称字段 |
| 差异回放 | 展示通过、差异、失败；样本技术信息展开 | 无 body POST replays，只解析已存快照并写差异，不重新打开浏览器采集 |
| 样本复核 | 待另一管理员审批、原因、通过/驳回、本人禁用与冲突 | pending、can_review、review_version、原因 2–1000；不能自审，不自动启用来源 |
| 解析矩阵 | 来源、解析器、观测次数、成功/失败、最近观测、短/完整指纹 | GET 全适配器再按来源 ID 查找；只读，无页面内容下载，无结果不借用其他来源 |
| 登录 / 准备状态 / 来源链接 | 记录 P50 指定 provider_code/mode=login、P49 或 HTTPS 跳转意图 | 不创建凭证、登录任务或验收；外链保留 noopener noreferrer，原型拦截外发 |

automatic 计数与“生产可用”源文案是目录规则，不是调度或采集证明。频率派生更新目标不是实测 SLA。缺少并发快照时原函数 active=0 回退不表示测得空闲。原自动来源的已登记对象缺配置字段时，编辑原样留空，不替它编默认值。

146 项目录、独立 smokeSource、1688 样本、配置历史、矩阵从原 E2E AST 分别提取，不拼成一次真实运行。历史响应 current_version=3 与目录版本 1 分开展示；样本保留旧 baseline 版本。候选作业、审批/探针/写入成功、长内容与异常是明确标注的合成演示，不能据此宣称真实服务成功。

## 已验证的原型与尚未实现的保护

真实 Vue 脚本派生为 source-logic.js，只在惰性桥接环境执行。12 个过滤/排序完整 ID 与分组序列、七控件复位、URL 初始恢复与 provider_id 保留、原缺字段及并发回退有核对。没有挂载 Vue，也未证明 VueRouter 前进后退同步；源组件当前没有反向 route.query watcher。

源函数惰性测试复现：保存期间更改表单可影响烟测后的第二次 PUT；旧保存完成关闭新编辑窗；写成功后的重读失败提示被成功文案覆盖。图稿的提交快照/在途冻结、窗口对象归属、读写代次、窗内失败、未知结果暂禁重写属于待审保护，并未修改生产组件。关闭窗口不代表取消写入；重新读到目录也不能证明此前未知请求已终止或可安全重试。

原型为了逐阶段审核保留成功窗口，完成按钮意图后不自动连接后端或伪造重读；目录刷新需明确执行，写成功后重读失败有独立合成场景。历史和样本读取失败保留任务窗供重试也是提案，区别于原组件失败关闭窗口。服务端真实权限、来源启用准入、版本事务、幂等与审计不得由这些前端保护替代。

浏览器覆盖双端 81 场景、四窗 Tab/Shift+Tab/Escape/焦点归还、七筛选、三阶段精确请求意图、回滚/样本创建/无 body 回放/复核、九种弹窗读取结果、六种目录刷新结果、迟到读写归属、完整指纹和外链拦截。320/759/760/761/768/1024 长内容与配置、CSS zoom2 检查通过；HTTP、console、pageerror、存储均为 0。CSS zoom2 不代替浏览器原生缩放、软键盘或辅助技术验证。

## 复验、使用与未覆盖事项

从仓库根运行 `node scripts/verify-ui-phase2-source-channels-c.mjs`，复核原数据、派生逻辑、源/PNG 指纹、精确图片清单与交互。原型修改后用相同命令加 `--capture` 重建正式图和 evidence.json；复用已安装依赖，浏览器在 finally 关闭，不启动开发服务器。

直接打开上方交互原型，选择“非业务审核场景”浏览；动作只记录离线意图，不会随时间自动伪造成功。主图和连续局部图均可逐一点击；当前无主题/密度调节入口，不把窄屏或固定 C 色板测试称为完整三主题两密度验收。

具体图稿审核、SC48/PR-G01、真实 Vue 路由/KeepAlive 生命周期、API/权限/MySQL/版本事务/审计/外发/真实烟测/双人复核、完整主题密度与辅助技术仍待实施验收。P49/P50 目的页不由本包冒充完成。没有新增 API/env/生产 CLI/依赖/数据库结构，Vue、后端、Python、OpenAPI、配置和宝塔未改，无需重启。下一设计项为 P49 的 1688 来源准备状态，全 73 页重构、部署和用户签收目标保持未完成。

## 全场景主图

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原146项来源目录 | [查看](1440-default.png) | [查看](390-default.png) |
| 移动筛选展开 | [查看](1440-filters.png) | [查看](390-filters.png) |
| 名称排序 | [查看](1440-name.png) | [查看](390-name.png) |
| 待配置优先 | [查看](1440-attention.png) | [查看](390-attention.png) |
| 最近成功排序 | [查看](1440-recent.png) | [查看](390-recent.png) |
| 搜索Amazon | [查看](1440-query.png) | [查看](390-query.png) |
| 业务类型 | [查看](1440-category.png) | [查看](390-category.png) |
| 手动来源 | [查看](1440-availability.png) | [查看](390-availability.png) |
| 市场 | [查看](1440-market.png) | [查看](390-market.png) |
| 语言 | [查看](1440-language.png) | [查看](390-language.png) |
| 接入模式 | [查看](1440-access-mode.png) | [查看](390-access-mode.png) |
| 组合筛选 | [查看](1440-combined.png) | [查看](390-combined.png) |
| 无匹配结果 | [查看](1440-no-match.png) | [查看](390-no-match.png) |
| 第二页 | [查看](1440-page-two.png) | [查看](390-page-two.png) |
| 末页 | [查看](1440-page-eight.png) | [查看](390-page-eight.png) |
| provider_id精确定位 | [查看](1440-linked.png) | [查看](390-linked.png) |
| 关联来源缺失 | [查看](1440-linked-missing.png) | [查看](390-linked-missing.png) |
| 公开页面详情 | [查看](1440-detail-public.png) | [查看](390-detail-public.png) |
| 登录来源详情 | [查看](1440-detail-login.png) | [查看](390-detail-login.png) |
| 导入来源详情 | [查看](1440-detail-import.png) | [查看](390-detail-import.png) |
| 合成未登记来源 | [查看](1440-detail-unregistered.png) | [查看](390-detail-unregistered.png) |
| 合成长来源 | [查看](1440-long-content.png) | [查看](390-long-content.png) |
| 初次加载 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 空目录 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 登录过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 依赖受阻 | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| 读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 刷新保留目录 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败保留目录 | [查看](1440-refresh-error.png) | [查看](390-refresh-error.png) |
| 编辑登录来源 | [查看](1440-config.png) | [查看](390-config.png) |
| 原夹具缺配置字段 | [查看](1440-config-missing.png) | [查看](390-config-missing.png) |
| 启用前烟测提示 | [查看](1440-config-smoke.png) | [查看](390-config-smoke.png) |
| 配置字段错误 | [查看](1440-config-invalid.png) | [查看](390-config-invalid.png) |
| 停用配置保存中 | [查看](1440-config-saving.png) | [查看](390-config-saving.png) |
| 真实烟测进行中 | [查看](1440-config-testing.png) | [查看](390-config-testing.png) |
| 启用写入中 | [查看](1440-config-enabling.png) | [查看](390-config-enabling.png) |
| 停用已保存烟测失败 | [查看](1440-config-partial.png) | [查看](390-config-partial.png) |
| 配置冲突 | [查看](1440-config-error.png) | [查看](390-config-error.png) |
| 配置结果未知 | [查看](1440-config-unknown.png) | [查看](390-config-unknown.png) |
| 配置保存成功 | [查看](1440-config-success.png) | [查看](390-config-success.png) |
| 写成功目录重读失败 | [查看](1440-config-reload-error.png) | [查看](390-config-reload-error.png) |
| 配置历史 | [查看](1440-versions.png) | [查看](390-versions.png) |
| 历史加载 | [查看](1440-versions-loading.png) | [查看](390-versions-loading.png) |
| 无历史版本 | [查看](1440-versions-empty.png) | [查看](390-versions-empty.png) |
| 历史读取失败 | [查看](1440-versions-error.png) | [查看](390-versions-error.png) |
| 回滚进行中 | [查看](1440-rollback-busy.png) | [查看](390-rollback-busy.png) |
| 回滚版本冲突 | [查看](1440-rollback-conflict.png) | [查看](390-rollback-conflict.png) |
| 回滚生成新版本 | [查看](1440-rollback-success.png) | [查看](390-rollback-success.png) |
| 原审批样本 | [查看](1440-samples.png) | [查看](390-samples.png) |
| 合成候选作业 | [查看](1440-samples-candidate.png) | [查看](390-samples-candidate.png) |
| 无固定样本 | [查看](1440-samples-empty.png) | [查看](390-samples-empty.png) |
| 样本加载 | [查看](1440-samples-loading.png) | [查看](390-samples-loading.png) |
| 样本读取失败 | [查看](1440-samples-error.png) | [查看](390-samples-error.png) |
| 固定候选中 | [查看](1440-sample-create-busy.png) | [查看](390-sample-create-busy.png) |
| 已固定待核对 | [查看](1440-sample-create-success.png) | [查看](390-sample-create-success.png) |
| 差异回放中 | [查看](1440-sample-replay-busy.png) | [查看](390-sample-replay-busy.png) |
| 合成回放通过 | [查看](1440-sample-passed.png) | [查看](390-sample-passed.png) |
| 合成回放差异 | [查看](1440-sample-changed.png) | [查看](390-sample-changed.png) |
| 合成解析失败 | [查看](1440-sample-failed.png) | [查看](390-sample-failed.png) |
| 合成创建人不可自审 | [查看](1440-sample-self.png) | [查看](390-sample-self.png) |
| 合成已批准 | [查看](1440-sample-approved.png) | [查看](390-sample-approved.png) |
| 合成已驳回 | [查看](1440-sample-rejected.png) | [查看](390-sample-rejected.png) |
| 审批写入中 | [查看](1440-sample-review-busy.png) | [查看](390-sample-review-busy.png) |
| 审批冲突 | [查看](1440-sample-review-error.png) | [查看](390-sample-review-error.png) |
| 样本技术详情 | [查看](1440-sample-technical.png) | [查看](390-sample-technical.png) |
| 原兼容观测 | [查看](1440-matrix.png) | [查看](390-matrix.png) |
| 矩阵加载 | [查看](1440-matrix-loading.png) | [查看](390-matrix-loading.png) |
| 无页面观测 | [查看](1440-matrix-empty.png) | [查看](390-matrix-empty.png) |
| 来源无适配器记录 | [查看](1440-matrix-missing.png) | [查看](390-matrix-missing.png) |
| 矩阵请求失败 | [查看](1440-matrix-error.png) | [查看](390-matrix-error.png) |
| 合成四种兼容状态 | [查看](1440-matrix-states.png) | [查看](390-matrix-states.png) |
| 完整页面指纹 | [查看](1440-matrix-technical.png) | [查看](390-matrix-technical.png) |
| 匿名测试中 | [查看](1440-probe.png) | [查看](390-probe.png) |
| 合成匿名探针通过 | [查看](1440-probe-ready.png) | [查看](390-probe-ready.png) |
| 合成匿名探针受阻 | [查看](1440-probe-blocked.png) | [查看](390-probe-blocked.png) |
| 匿名探针请求失败 | [查看](1440-probe-error.png) | [查看](390-probe-error.png) |
| 键盘焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 非业务审核工具 | [查看](1440-review-tools.png) | [查看](390-review-tools.png) |

## 长窗口连续局部图

以下按场景、视口和滚动顺序排列，与对应主图一起审核。

- [1440-sample-create-busy-bottom.png](1440-sample-create-busy-bottom.png)
- [1440-sample-create-success-bottom.png](1440-sample-create-success-bottom.png)
- [1440-sample-passed-bottom.png](1440-sample-passed-bottom.png)
- [1440-sample-changed-bottom.png](1440-sample-changed-bottom.png)
- [1440-sample-failed-bottom.png](1440-sample-failed-bottom.png)
- [1440-matrix-states-bottom.png](1440-matrix-states-bottom.png)
- [390-config-bottom.png](390-config-bottom.png)
- [390-config-missing-bottom.png](390-config-missing-bottom.png)
- [390-config-smoke-bottom.png](390-config-smoke-bottom.png)
- [390-config-invalid-bottom.png](390-config-invalid-bottom.png)
- [390-config-saving-bottom.png](390-config-saving-bottom.png)
- [390-config-testing-bottom.png](390-config-testing-bottom.png)
- [390-config-enabling-bottom.png](390-config-enabling-bottom.png)
- [390-config-partial-bottom.png](390-config-partial-bottom.png)
- [390-config-error-bottom.png](390-config-error-bottom.png)
- [390-config-unknown-bottom.png](390-config-unknown-bottom.png)
- [390-config-success-bottom.png](390-config-success-bottom.png)
- [390-config-reload-error-bottom.png](390-config-reload-error-bottom.png)
- [390-versions-bottom.png](390-versions-bottom.png)
- [390-rollback-busy-bottom.png](390-rollback-busy-bottom.png)
- [390-rollback-conflict-bottom.png](390-rollback-conflict-bottom.png)
- [390-rollback-success-bottom.png](390-rollback-success-bottom.png)
- [390-samples-bottom.png](390-samples-bottom.png)
- [390-samples-candidate-bottom.png](390-samples-candidate-bottom.png)
- [390-sample-create-busy-bottom.png](390-sample-create-busy-bottom.png)
- [390-sample-create-success-bottom.png](390-sample-create-success-bottom.png)
- [390-sample-replay-busy-bottom.png](390-sample-replay-busy-bottom.png)
- [390-sample-passed-bottom.png](390-sample-passed-bottom.png)
- [390-sample-changed-bottom.png](390-sample-changed-bottom.png)
- [390-sample-failed-bottom.png](390-sample-failed-bottom.png)
- [390-sample-self-bottom.png](390-sample-self-bottom.png)
- [390-sample-approved-bottom.png](390-sample-approved-bottom.png)
- [390-sample-rejected-bottom.png](390-sample-rejected-bottom.png)
- [390-sample-review-busy-bottom.png](390-sample-review-busy-bottom.png)
- [390-sample-review-error-bottom.png](390-sample-review-error-bottom.png)
- [390-sample-technical-bottom.png](390-sample-technical-bottom.png)
- [390-matrix-states-part-1.png](390-matrix-states-part-1.png)
- [390-matrix-states-bottom.png](390-matrix-states-bottom.png)
- [390-matrix-technical-bottom.png](390-matrix-technical-bottom.png)

