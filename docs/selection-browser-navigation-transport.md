# Amazon浏览器主导航传输

## 依据与范围

生产Chromium连续在initial_navigation收到主文档HTTP503，无验证码标记。
2026-10-20 20:56，同一既有代理的普通HTTP搜索返回200，包含60个实际搜索条目标记，未见
验证码标记。这不是规范化商品或整链完成证明，也不能单独证明HTTP协议就是根因。
21:00再按createAmazonBrowserExecutionRequest生成的完全相同原始网址（%20空格编码）探测，
同代理HTTP200、48个实际搜索条目标记、无验证码标记；排除了仅因搜索网址空格编码不同造成比较差异。
为区分浏览器导航与请求传输差异，增加可回退的同上下文主导航传输选项。

`AMAZON_PUBLIC_BROWSER_NAVIGATION_TRANSPORT`允许`browser`（代码默认）或`request`。
request模式仅转发同源公开Amazon主框架的原始导航请求：使用Playwright的`route.fetch`，
不设置URL、请求方法、请求头或请求体覆盖，不修改原始状态、响应头或正文，
然后通过`route.fulfill({response})`交还正在运行的同一浏览器页面。
重定向不在后端自动跟随（maxRedirects=0），不重试请求（maxRetries=0）；仍由浏览器
按实际响应处理跳转，再执行原来源/登录/验证码/HTTP错误/投递地区/解析门。
其他资源、子框架、其他站点和其他来源继续原浏览器传输。

没有伪装User-Agent、禁用TLS、拼造Cookie、替换页面内容、切换代理或注入“成功”状态。
Cookie仍属于同一服务器浏览器上下文，不能从本机导入账号。403/429/503和验证码原样呈现；
验证码仍进入人工接管，自动恢复仍要求真实搜索及同商品详情通过。
所用接口见[Playwright Route文档](https://playwright.dev/docs/api/class-route#route-fetch)。

## 配置与交付

- 宝塔本项目受限`product_scout.env`设置上述变量，按正式deploy-baota.py流程发布，
  重启Node和Python。设回browser恢复原传输，不改其他配置或凭证。
- API健康检查和Python触发的Node运行器都从服务端运行环境读取同一值。
  Python既有env-file加载器把该键传给子进程；没有新增Python任务字段、前端字段或公开API参数。
- 私有运行选项只允许已有Amazon观察计划；非Amazon计划在浏览器启动前拒绝request模式。
- 不增加服务、端口、依赖或数据库结构。失败诊断只多记录固定navigation_transport枚举。
- 本地真实Chromium回归覆盖原方法/表单体、User-Agent/请求头、Cookie、gzip正文、重定向、
  403/429/503不重试及保留验证码。接管集成测试也通过该真实导航转发链路执行。

本地测试不能代表生产恢复。发布后必须记录实际传输模式、搜索/详情、接管、来源恢复和
真实完成计数；仍未通过就保留失败，不靠HTTP200或60个条目标记签收日100个。
