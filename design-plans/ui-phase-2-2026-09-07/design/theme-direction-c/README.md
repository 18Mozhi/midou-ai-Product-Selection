# 主题浮层 · THEME-C-r1

C方向已选，具体配色、名称、浮层与行为改进待审。独立HTML提案，不是Vue迁移或生产发布。

[打开交互稿](index.html) · [全部证据](evidence.json) · [导航主体](../shell-direction-c/README.md) · [搜索与创建](../discovery-direction-c/README.md)

## 全新视觉与兼容映射

| 保留的主题ID | 当前源码名称 | 本稿提议名称 | C方向视觉 |
| --- | --- | --- | --- |
| deep-ocean | 信号纸 | 目录蓝 | #254a9c蓝色目录，纯白工作面，冷灰分隔 |
| aurora-purple | 档案纸 | 冷雾蓝 | #365d78灰蓝目录，#f8fbfd冷白工作面 |
| cloud-white | 净页白 | 净页白 | #f1f5fa浅色目录，蓝色动作，纯白内容 |

本稿不保留旧暖纸/朱砂视觉，不新增或迁移持久化ID。名称与caption为待审显示文案，不冒充当前生产定义。全部为浅色主题，不擅自增加深色模式。frontend-design用于统一C方向目录分区、主题缩略图与控件层级；这不是仅给旧界面换色。

主体装配位只展示文字、背景、分隔线和焦点，不填假业务数据，也不计任何Pxx业务图。18场景×1440/390，共36图。

## 每个控件与状态

| 项目 | 合同与本稿边界 |
| --- | --- |
| 主题按钮 | 明确aria-expanded/controls，打开非模态命名区域；不是dialog，不遮断背景，不把Tab困在面板。 |
| 三主题选择 | aria-pressed标识当前项；成员/组织选择即应用并PUT，保存期间关闭浮层，失败恢复旧值。没有额外确认或新的API字段。 |
| 平台选择 | 只本机沿用，真实applyTheme只缓存合法主题ID；本地审核稿刻意不写storage。 |
| 关闭 | 新增显式关闭、Escape返焦、外部点击和键盘离开关闭，属于待审UI可达性提议，不宣称原Vue已有。 |
| 更多外观设置 | 保留/settings/theme，提案导航时关闭浮层；HTML只记录目标，不执行真实路由，不证明平台无业务范围时能保存。 |
| 读取失败 | 当前壳层使用静默读取失败，保持当前界面；无version时选择会先GET，仍失败则按现有逻辑提交expected_version=0。本稿保留并说明，不伪称已恢复服务。 |
| 六类保存失败 | 401/403/409/429/500/503当前壳层统一失败提示和回滚，不用本地场景编造不同服务端恢复动作。 |
| 平台提示 | 展示当前源文案“选择业务范围后会同步到账号偏好”；这不证明平台新选择自动写入账号，真实后续是范围切换后的读取/用户保存合同。文案准确性仍需Vue实施阶段核对。 |
| 焦点样式示例 | 仅审核工具，不创建实体，不新增业务按钮。 |

## 明确未完成：保存竞态

永久助手在隔离DOM/cache适配器中执行真实useNavigationShellTheme，使用Vue ref，不访问网络：

1. GET得到deep-ocean，version=1。
2. 先选择aurora-purple，再选择cloud-white，两次PUT均带expected_version=1。
3. 后一次PUT先成功并返回cloud-white/version=2。
4. 前一次PUT随后失败，当前源恢复deep-ocean，覆盖最新意图；并非已修复。

evidence.knownGap保存复现结果。脚本对已知现状作断言是为了记录缺口，不是将错误结果当作验收成功。UI2-SH03要求“不让较早响应覆盖较新选择”，仍未通过；后续需在真实Vue隔离响应下补red→fix→green和跨shell/卸载测试。此轮不改运行源码，未扩大为未知权限/数据规则。

交互稿一次演示一个保存流程，连续点击时只提示上述未完成边界；不得把这项审核工具限制当作生产单飞锁或竞态修复。场景切换的本地计时清理也不是源代码的请求归属证明。

## 全部图

| 场景 | 图 |
| --- | --- |
| member-open | [1440](1440-member-open.png) · [390](390-member-open.png) |
| organization-open | [1440](1440-organization-open.png) · [390](390-organization-open.png) |
| platform-open | [1440](1440-platform-open.png) · [390](390-platform-open.png) |
| deep-ocean-open | [1440](1440-deep-ocean-open.png) · [390](390-deep-ocean-open.png) |
| aurora-purple-open | [1440](1440-aurora-purple-open.png) · [390](390-aurora-purple-open.png) |
| cloud-white-open | [1440](1440-cloud-white-open.png) · [390](390-cloud-white-open.png) |
| saving | [1440](1440-saving.png) · [390](390-saving.png) |
| saved | [1440](1440-saved.png) · [390](390-saved.png) |
| failed-401 | [1440](1440-failed-401.png) · [390](390-failed-401.png) |
| failed-403 | [1440](1440-failed-403.png) · [390](390-failed-403.png) |
| failed-409 | [1440](1440-failed-409.png) · [390](390-failed-409.png) |
| failed-429 | [1440](1440-failed-429.png) · [390](390-failed-429.png) |
| failed-500 | [1440](1440-failed-500.png) · [390](390-failed-500.png) |
| failed-503 | [1440](1440-failed-503.png) · [390](390-failed-503.png) |
| read-failed-silent | [1440](1440-read-failed-silent.png) · [390](390-read-failed-silent.png) |
| platform-local | [1440](1440-platform-local.png) · [390](390-platform-local.png) |
| read-before-save | [1440](1440-read-before-save.png) · [390](390-read-before-save.png) |
| known-race | [1440](1440-known-race.png) · [390](390-known-race.png) |

## 验证、使用与交付

仓库根目录运行 `node scripts/verify-ui-phase2-theme-c.mjs`，只读核对源指纹、原主题/通知文本、截图哈希，执行三壳层×三主题选择、版本请求、六失败回滚、非模态键盘/关闭、字号与触控区域检查，并复现未修复竞态。加 `--capture` 才刷新本目录永久PNG与evidence。已有Playwright/TypeScript/Vue依赖直接复用，不安装依赖、不启动服务，浏览器finally关闭。

测试不涵盖真实后端幂等审计、本机缓存持久化、真实网络重试、屏幕阅读器、全部浏览器或全站主题迁移。原Vue、API/OpenAPI、数据库、权限、配置、依赖、coverage、旧图及审批均不变，无需生产重启。AccountShell、全73页新视觉、真实实现与部署仍待继续。
