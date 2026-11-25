# Amazon 人工接管画面字体阻塞修复

正式检查1800中，两路搜索48+48及Node同商品详情1条通过，Python同商品详情进入验证页，记录handoff opened后终止，未恢复来源。该正式回执本身不能证明接管退出的内部原因。

本地以自有拦截HTML和延迟字体运行真实Chromium，已复现旧manual-handoff.ts在page.screenshot等待document.fonts.ready，5000ms后退出且没有info.json/frame.jpg；保留原blocked_captcha，不把画面缺失当成功。

## 修复

仅Amazon引擎向既有waitForManualCaptcha提供内部可选captureFrame回调，复用已验证captureAmazonViewport：真实当前视口JPEG、质量75、原5000ms时限、1280×720坐标不变。不修改页面样式或字体、不取消请求、不合成画面；非Amazon或未传回调者仍执行原page.screenshot。

复现修复后，字体仍loading、原验证节点和页面字体不变，但真实JPEG与会话元信息可供管理员查看；不会自动创建claim.json/command.json，也不会自动输入、解题或宣称ready。取消后仍是blocked_captcha，目录正常清理。

人工claim、同源/密码框保护、精确验证主机、限定命令、会话归属、过期/取消、匿名/邮编/商品及四步恢复门禁均不改。无外部API/OpenAPI、环境变量、依赖、并发、数据库、Python输入或1688变更。captureFrame是Node模块内部函数参数，不来自请求。

## 发布与回退

只发布packages/playwright-crawler/dist/index.js及manual-handoff.js，精确原哈希分别2cf245a14bd71ea04e215f08987eebee9ed5c832b4395022374752beb7ede0ac、ffa26b08d94045aa795b48d03d769fc49186386e9bb3c5553e68dbc39bbedccf；候选分别281f1e129d7f195e8a8a02efd795611d57fa18060ef8a64ba4c733170ea32708、07b96e7579182b7a333aa5b29b77cd63e87a88c8e6b2d5069db7ed09ad530990。

完整四次连续全零和最终复核后，仅宝塔重启ai选品 Node，保留Python PID和其他模块；不创建正式备份，不重跑首次加载。

```powershell
python -B scripts/deploy-account-baota.py --collection-manual-frame-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 2cf245a14bd71ea04e215f08987eebee9ed5c832b4395022374752beb7ede0ac
```

恢复原模块时同入口使用--collection-manual-frame-rollback，expected-module-sha256必须为候选引擎281f1e129d7f195e8a8a02efd795611d57fa18060ef8a64ba4c733170ea32708，从Git4b7217f42重建两模块。画面可见只是人工入口验收，不是采集成功；源站验证由用户操作，两条传输的真实搜索及同一商品详情全部通过后才走审计恢复。
