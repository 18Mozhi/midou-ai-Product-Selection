# Amazon 必需截图等待定位

正式1795和1796均为Node/Python搜索各48条后，同商品Node详情的必需screenshot超时；Python详情未继续，来源仍暂停。item_count=1不是详情成功。

在既有amazon_browser_step_failed事件中，仅截图操作补充screenshot_wait_phase固定枚举：font_wait、after_font_ready、before_font_wait、unavailable。它只解释Playwright自带Call log中固定里程碑，不输出错误原文、URL、请求/追踪标识、商品、Cookie或用户输入。先去掉日志SGR颜色，避免真实终端彩色日志无法归因；未知格式明确unavailable。

本地真实Chromium的被拦截字体延迟可复现font_wait，并保留timeout、item_count1、无完整证据，不伪装成功。该复现证明诊断可用，不证明正式端也是字体问题；必须查看正式同一健康请求日志后才能决定修复。

不改变截图选项、总时限、DOM/图片体积和哈希、身份/匿名/邮编校验、白名单、传输、Python、1688、并发、数据库或配置。API/OpenAPI和Python输入契约无变化，无新环境变量或依赖。

## 精确正式发布

只替换packages/playwright-crawler/dist/index.js，原模块3974d5cf0afa8916814105df00b851534a6428a3bede325b51e8d97244ee6e0d；保留Worker维护暂停、双路健康检查、SQL和所有其他模块。使用常规完整四次连续全零排空，只重启宝塔ai选品 Node；不重新运行首次加载。

```powershell
python -B scripts/deploy-account-baota.py --collection-screenshot-wait-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 3974d5cf0afa8916814105df00b851534a6428a3bede325b51e8d97244ee6e0d
```

需要恢复时，同入口使用--collection-screenshot-wait-rollback，expected-module-sha256必须为精确候选5d16516ed7f8019c15d9cfb81ffe6e1271e49c9e39fcd3d250ffa475ccde64f3，从Git提交0c72858重建原模块，不创建正式备份。不允许靠诊断字段就恢复；Node和Python都必须真实搜索及同商品详情通过后才能走现有审计恢复流程。
