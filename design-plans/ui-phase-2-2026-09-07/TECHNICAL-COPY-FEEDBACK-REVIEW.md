# 共享技术详情：复制失败与反馈归属

2026-09-11，起点 main / e704cd24。frontend-design 用于将失败说明保持为技术详情内的就地文字，Playwright 验证实际 Vue，而非用独立 HTML 控制器代替。完整 C 重设计仍未完成；这不是整页或生产验收。

## 实际修改

`TechnicalDetails.vue` 捕获浏览器拒绝及 Clipboard API 不可用，显示“暂时无法复制请求编号，可以选中上方内容后手动复制。”提示按实际点击的字段名变化，不展示浏览器异常原文。再次点击清除旧反馈，成功仍显示“已复制”约 1500ms，然后恢复“复制”。

每次复制与当前内容代次关联；新操作、展示行变化、KeepAlive 停用或卸载使旧结果失效，清理成功反馈计时器。不会把上一个编号的成功或失败显示到新内容上。已发出的系统复制不可撤销，本修改只隔离界面回执，不宣称取消了复制。

原复制文字 `String(value)`、字段过滤（保留 0）、原生 details、按钮事件及普通状态模板/样式保持，只有失败时增加 `role=status` 文字。没有自动复制、剪贴板读取、备用复制服务、浏览器权限申请、持久化或网络调用。

## 审核图与证据

[8 张实际 Vue 图册](../../output/playwright/technical-copy-feedback/index.html) · [机器证据](../../output/playwright/technical-copy-feedback/evidence.json)

| 组合 | 手机 | 桌面 |
| --- | --- | --- |
| 请求编号复制失败及键盘焦点 | [查看](../../output/playwright/technical-copy-feedback/390-denied.png) | [查看](../../output/playwright/technical-copy-feedback/1440-denied.png) |
| 重试成功 | [查看](../../output/playwright/technical-copy-feedback/390-retry-success.png) | [查看](../../output/playwright/technical-copy-feedback/1440-retry-success.png) |
| 链路编号复制失败 | [查看](../../output/playwright/technical-copy-feedback/390-trace-denied.png) | [查看](../../output/playwright/technical-copy-feedback/1440-trace-denied.png) |
| 更换内容后清除反馈 | [查看](../../output/playwright/technical-copy-feedback/390-changed-content.png) | [查看](../../output/playwright/technical-copy-feedback/1440-changed-content.png) |

组件在 P38 C 预览样式的白色区域中挂载，不是完整 P38 路由。所有编号和行数为明确标记的样例，使用可控剪贴板替身，不接触系统剪贴板。390/760/761/1440 共 16 组实际浏览器检查，包含拒绝、API 缺失、精确复制内容、重试、计时恢复、内容变化、乱序回执、真实 KeepAlive 停用、焦点保留和无外部请求/页面异常。四宽度普通态与 Git e704cd24 的实际旧 Vue 同位置截图逐字节一致。

P38 原实际 Vue 验证器另将复制拒绝从“预期未捕获错误”改为“就地反馈且无 pageerror”，共 36 组；其余 403 快照观察保持未通过。原 42 张 P38 图、18 张控制区图和 16 张来源局部图不作新批准。

## 影响链与边界

15 个直接模板消费文件仍未修改：BackupRecoveryCenter、CapacityBoundaryCenter、CollectionOperationsConsole、CollectionRuntimeCenter、CommercialOperationsCenter、CrawlerSchedulerCenter、FileResilienceCenter、MySqlResilienceCenter、PlatformDashboard、PlatformDataCenter、PlatformGovernanceCenter、RedisResilienceCenter、ReleaseRolloutCenter、RuntimeTopologyCenter、SecurityOperationsCenter。共享组件证据不能代替这 15 个页面的完整业务回归。

13 个绑定此共享源码的 C 提案包重新运行原验证器与截图捕获；它们仍是历史 HTML 提案，不能升级为实际 Vue 或权限证据。六份合同表仅更新 TechnicalDetails 的当前哈希并标注历史描述的边界。平台概览和发布提案中的旧“复制拒绝未捕获”源函数检查同步为实际处理分支。

重捕获覆盖 13 套提案的 2190 张图，另复验 P38 的 42/18/16 张原图。最终相对 e704cd24 共 29 张图有微小栅格差异，尺寸均一致，每张 1–152 个像素、最大单通道差 13；包括 P38 读取中图 31 像素、最大差 2。精确哈希、像素数和边界见 [本轮逐图记录](technical-copy-capture-review.json)。已解码逐张核对，最大差异样本亦目视对照；不新增全局误差容忍，不算用户批准。先前共享焦点图证仍按其历史版本核对，新的精确前后版本链另由本轮测试覆盖，未覆盖或未记录的变化仍失败。

## 复验与运行交接

```powershell
node --test tests/unit/ui-phase2-technical-copy.test.mjs tests/unit/ui-phase2-technical-copy-evidence.test.mjs
node scripts/verify-technical-copy-feedback.mjs
node scripts/verify-ui-phase2-platform-overview-vue-preview.mjs
```

`--capture` 只重建对应审核目录。无配置或用户调节项，继续使用技术详情里的原“复制”按钮即可。无 API/后端/Worker/Python/数据库、OpenAPI、环境变量、依赖、鉴权或权限规则修改，Feature Map 仅补前端变更和验证入口。

本轮未部署；后续批准版本按既定本地构建与宝塔上传流程发布，用户刷新前端即可。此修复本身无需后端、Worker 或 Python 重启，发布器的实际停服行为仍需按发布门核对。

前端类型检查先发现浏览器计时器被 Node 的 Timeout 类型覆盖，改为明确的数字句柄后复测通过；按最终源码重新捕获全部上述图证。最终 `build:web` 与前端体积门通过，主提案审计仍 102 包/15069 图，来源与图片漂移为零；这只证明材料完整性，不代表整页完成。

最终全量 `tests/unit/*.test.mjs`：854/854 通过，无跳过；包含本轮 7 项复制行为测试、4 项图证/消费边界测试及旧图证版本链回归。复用已安装依赖与构建缓存，没有安装或升级依赖。测试自带格式临时样例已清理，隔离浏览器、Vite 和各捕获进程均已退出；仅保留审核交付和项目必需构建输出。

所有测试浏览器和临时 Vite 在 finally 关闭；虚拟旧组件只存在于 Vite 内存模块，不创建源目录临时文件。8 张图、索引、机器证据、测试和验证脚本为永久交付，非临时垃圾。当前新失败组合与 P38 原控件/布局问题均保留各自的待审范围，不默认通过。P38 403 旧快照策略及全站设计、实际接口/权限和生产验收仍待处理。
