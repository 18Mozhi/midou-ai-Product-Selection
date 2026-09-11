# P50 · 登录材料缓存停用实际 Vue 实施 r1

## 本批范围

修复 `/platform-admin/credentials` 被真实 `NavigationShell` 的 `KeepAlive(max=12)` 缓存时，离页仍保留敏感编辑器和异步读取的问题。生产 `CredentialAssetCenter.vue` 已增加停用/激活生命周期；C 方向蓝白样式仍只由审核宿主注入。**未调用真实浏览器助手、后端、加密、数据库或生产环境，未部署。**

`wshobson/interaction-design` 用于约束中断与连续性：离页使当前编辑会话失效并清理材料，不让迟到回执在缓存实例中复活；只有被离页中断的只读资料加载在返回后重新发起。

## 已实施行为

- `onDeactivated` 终止三项凭证资料 GET，递增读取代次并记录需要恢复读取。
- 登录材料与编辑器代次同时失效，助手请求通过 `AbortSignal` 中止；登录窗、通用资产/轮换/档案窗和撤销目标关闭。
- 清空登录 payload、文件名、通用资产秘密、保存阶段、编辑器返焦引用和材料反馈。
- `onActivated` 只在离页时确有未完成读取的情况下重新执行既有三项 GET；普通缓存返回不额外读取。
- 旧读取的成功、错误和 `finally` 均不能覆盖返回后的新读取状态。

## 实际证据

- [8 图总览](../../output/playwright/p50-credential-login-cache-review/index.html)：已准备文件离页、助手读取离页后迟到两种状态 × 390/760/1024/1440。
- [机器证据](../../output/playwright/p50-credential-login-cache-review/evidence.json)：8 次真实 App/Router/NavigationShell/KeepAlive 运行、128 项检查、8 张 PNG、172 个实际加载源码哈希。
- 两种图证每次只执行导航、会话、三项凭证资料 GET 和一个空平台概览 GET；零写入、零外链、零真实助手，合成材料不回显、不进入本地/会话存储或 Cookie。
- 第三个真实路由回归专门延迟首次三项 GET：离页后旧批次失效，返回重新发起三项 GET，并显示新批次资产资料。
- M03-02 全文件桌面与 390px 共 28/28 通过，其中本批三个 KeepAlive 场景为 6/6。
- 复验图证：`node --test tests/unit/ui-phase2-credential-login-cache.test.mjs`。重建：`node scripts/verify-ui-phase2-credential-login-material.mjs --suite=cache --capture`。

## 变更边界

- 未改 API 地址、方法、字段、重试次数、权限、文件格式/大小、数据库、加密、环境变量或依赖；OpenAPI、`.env.example` 与迁移不适用。
- 普通缓存返回仍复用当前成功快照，不额外 GET；只有被中断读取会恢复。
- 本批没有为离页中的写请求制定新规则；登录两段写入已有会话归属保护，通用资产/轮换/档案/撤销的在途写归属仍需独立验证。

## 待审与未覆盖

本批只申请两张缓存返回后的“全新材料状态”审核，不代表 P50 页面、七种保存生命周期、真实助手、真实 API/加密/MySQL、权限或生产验收。通用资产/轮换/档案/撤销在途写、深链重复激活政策、主题/密度和全 73 页继续后续处理。
