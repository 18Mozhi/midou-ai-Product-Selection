# P57 弹窗 r1：修复前对照，不作为当前批准图

2026-09-14，32组本地真实Vue弹窗/路由检查通过后捕获的4张局部图。逐图检查发现手机取消失败的错误区被第六个1fr网格行拉伸，故本包仅保留为优化前证据，不提交用户批准；当前图见[dialog-review-r2](../dialog-review-r2/README.md)。

原4张PNG和manifest不修改。`capture-source.mjs`保存原驱动字节，SHA-256与manifest内`scripts/verify-platform-notification-dialogs.mjs`原指纹一致；原`apps/web/src/platform-notifications.css`与Git `1a969fd52d536defeec1fbc49dfc76ed4d3f7bab`该文件原始字节一致。其余登记的加载来源未因r2样式修复而改变。存档源码仅供核验，不是继续运行的当前入口。

这是合成数据、内存响应和实际组件的局部图，没有真实取消/发送，未包含完整App壳层、完整滚动内容或全部主题/角色。36份加载来源指纹不是完整构建依赖清单。本包为永久前后对照交付，不是一次性临时截图。
