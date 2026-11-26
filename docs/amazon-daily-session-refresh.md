# Amazon 每日地区证明与有效详情会话更新

## 本地确认的缺陷

2026-11-26只读对照星星的 `can_list_task.py`、`front_cookie_state.py` 调用链：
有效详情在身份、标题、主图等证据通过后，会保留原会话正常响应更新的 Cookie。
这是已有自有会话的更新，不是导入另一项目或更换身份绕过验证。

智能选品原 `withDailyAmazonDelivery.save` 只在首次首页地区准备后写入一次。
缓存命中后立即释放锁；后续详情正常 Set-Cookie 虽进入当前 BrowserContext，
上下文关闭后就丢失，下一任务重新注入当天的最初快照。“地区每天重读一次”
由此被错误地实现成了“全天反复恢复同一旧会话”。

真实 Chromium、自有拦截页面、同一 ASIN 的本地输入可稳定复现：
首页给匿名 seed1，第一次有效详情把会话更新为 seed2；第二任务仍用 seed1，
得到邮编正确但无标题的 HTTP200，最后超时。修复后第二任务携带 seed2，
两次详情均成功、首页仍只访问一次。不请求真实 Amazon 或使用星星 Cookie。
这确认了一个实现缺陷，并不证明全部历史线上超时都由会话轮换造成；
历史失败没有原始响应，正式实采仍需独立验证。

## 修复范围与保护

- 原 `save` 与按北京时间每日一次的 HOME/GLUX 准备不变。
- 新增内部可选 `DailyAmazonDelivery.refresh`。仅在详情完成取证后，当前 URL
  与唯一 `input#ASIN` 都匹配原 ASIN、有非空 productTitle，再复核原验证码/登录/
  robots、严格匿名链接及邮编，才尝试更新同一匿名缓存。
- 搜索、失败、验证码、错误邮编、缺失/重复/不匹配身份均不提交该更新。
  这不改变原采集结果或后续业务解析合同，不把缺失证据计为成功。
- 保持原匿名 Cookie 校验、域名边界和 `.www.amazon.com` 精确缩窄规则，
  不写认证 Cookie、不导入外部 Cookie、不扩大白名单。
- 使用已有锁文件/原子写入；更新锁忙即跳过，不等待、不抢锁；对最初读取字节做
  比较并交换，旧任务不得覆盖更新的会话；跨北京时间午夜不刷新昨天的证明。
  version1 文件格式、身份/出口/邮编散列键、权限与大小限制不变。
- 普通缓存写入失败仅记录固定事件 `amazon_delivery_session_refresh_failed` /
  `reason=cache_unavailable`，不丢弃已经取证的详情，不记录异常、Cookie 或正文。
  原锁归属/文件安全检查保持失败关闭。

不复制星星登录 Cookie、不复制其宽松 TLS 参数，不增代理、重试、超时、并发、
HTTP入口、环境变量、数据库字段或依赖；1688、AI 等待和死信不变。

## 验证和运行交接

```powershell
npm run build:playwright-crawler
node --test tests/unit/amazon-daily-session-refresh.test.mjs tests/integration/amazon-daily-session-refresh.test.mjs
```

覆盖正常轮换、一次首页、验证码/邮编/身份拒绝、认证/外域 Cookie 拒绝、
并行旧快照保护、不抢忙锁、午夜、作用域隔离和缓存失败不丢弃证据。
另运行现有每日配送、地区、请求、接管、详情及真实 curl 字节链路回归。
本地夹具及精确回滚不替代真实源站验收。

本次只做本地修改和验证，不发布、不重启、不操作数据库或1688。
无公开 API/env/Python任务合同变更，OpenAPI、.env.example和前端无需修改。
今后另获发布授权时才走项目正式协调入口，常驻 Node 必须加载新模块；
Python 每任务启动的 Node 子进程读取新包，无 Python 源码修改或 Python 重启要求。
本次不新增发布通道，不直接覆盖正式文件，不以此解除来源熔断。
