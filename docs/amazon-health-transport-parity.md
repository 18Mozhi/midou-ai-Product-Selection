# Amazon 恢复门禁：Node 与 Python 两条真实支路

## 确认范围

用户已确认：两条支路都必须完成真实搜索及同一商品详情；验证页保持受阻并转人工处理。
此前 Node 健康检查通过不能代替 Python curl 生产支路验收，旧健康版本1790只代表当时的浏览器检查。
自然任务的原链接、en-US语言及America/New_York时区已只读核对；两条失败链接均会按原规则规范为精确ASIN路径。
路径诊断已明确出现checkpoint，但这不单独证明传输是唯一原因，仍需同输入真实对照。

## 实现

1. 保留原账号归属、匿名档案、条款、robots、租约、总截止时间及代理策略。
2. Node支路按既有navigationTransport设置搜索storage box；Python支路用生产已有curl helper搜索同一关键词。
3. 从两份已解析搜索事实中选共同ASIN；没有共同商品即不通过，不将广告、空搜索或HTTP200视为事实。
4. 两条支路依次读取这个共同商品的详情，均须身份相符；任一失败、验证码、缺事实或取消均不能ready，也不回退另一支路冒充成功。
5. 仍使用既有独占档案租约，每次完成回执后才进入下一步；没有并行采集、新重试、超时或并发调参。

Python支路复用已有Playwright publicHttpRuntime适配器，而不是新服务：
解释器 `/www/server/pyporject_evn/versions/3.12.13/bin/python3.12`，
脚本 `/www/wwwroot/ai选品/python/scoutops_crawler/public_http.py`。
两条路径固定于现行项目部署规则，不能由HTTP请求指定；测试同时对照deploy-baota.py中的正式路径常量防止漂移。
原curl_cffi版本、原请求/响应传输、TLS校验、地区缓存、Cookie边界和白名单均不变。

每次完成产生固定枚举的amazon_health_transport_result日志，只含browser/python、search/detail、
原运行/请求/追踪标识、状态、计数和错误码；不含商品ID、URL、页面、Cookie、口令或代理凭证。
既有健康检查按钮、响应字段、熔断恢复入口及自动恢复消费者不变，但ready含义加强为四步全过。
1688和AI服务不改。

## 验证与运行边界

本地测试覆盖共同商品选择、Python空结果/不同商品、任一路详情缺失或错商品、验证码、取消、
真实加密空档案物化与清理、四次租约完成，以及生产Python传输选项确实进入原引擎。
合成测试不是正式双路验收。Node健康模块上线须仅通过正式协调器重启Node；Python无需重启或安装依赖。
当前首次加载维护暂停能力的方案仍待确认，不绕过原四次连续全零排空标准。
上线后必须重新执行健康检查并核对同一请求的四条运行/传输记录，旧单支路健康记录不得作为新的恢复证据。

现有发布包装器还修复了诊断丢失：只允许原trend_和account_release_内部错误码通过，
未知异常仍仅显示类型，不输出原文。排空诊断已复现account_release_worker_drain_timeout；
12次有界诊断后自己的领取暂停已解除，没有安装文件或重启服务。

## 本轮本地结果（2026-11-25）

- API构建通过；新增7项双路测试全部通过。
- 同输入回放：Python遇验证页时，旧健康模块误报ready，新模块返回degraded / blocked_captcha；独立副本执行回退后重新出现旧行为，源文件哈希恢复一致。
- Amazon定向单测180项：179通过，1项历史失败；用HEAD旧健康模块与新模块分别执行amazon-observation-lineage.test.mjs，均仅同一条旧organization/workspace断言失败，没有新增失败。不是全库单测通过。
- 浏览器集成8项、账号发布工具67项全部通过；运行文档、发布矩阵和本次代码格式检查通过。
- 本轮未发布、未重启；正式双支路真实搜索/同商品详情和审计恢复仍待上线后完成。不得用这些合成回放替代正式验收。

## 精确两模块发布与恢复入口

仅允许协调器替换 `apps/api/dist/amazon-public-browser-health.js` 与
`packages/playwright-crawler/dist/index.js`；后者同时带入已本地验证的checkpoint人工接管识别。
Node/Python传输适配器和Python helper只核对哈希并保护，不上传，不安装依赖，不重启Python。
趋势投影、报表、调度器、SQL优化及已有1688模块保持原哈希。

以下是门禁通过后的操作入口，不是已经执行的发布。源码须为干净、已验证且与origin/main一致的提交；
现有正式模块必须匹配8df4389996d0ad16c3ff478ddcc2d0eb64295eef对应的两项哈希。
任何漂移、缺文件、四次连续全零失败或非本项目身份均拒绝安装。
首次加载维护暂停能力尚未批准，不能使用这些入口绕过原排空标准。

```powershell
python -B scripts/deploy-account-baota.py --collection-dual-health-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 c86f7b72c16ec20b8d454004906bdcbc4c0c11574ff1cafd5f3ce7f5c74989f1
```

成功安装后只经宝塔重启 `ai选品` Node；接口、Worker均须换成新进程且Python进程身份不变。
正式验收须使用同一健康请求的四条 `amazon_health_transport_result`，确认browser/python各有search/detail，
并核对实际同商品事实及全部运行回执。验证页不得ready，继续原人工流程；不会自动解除来源熔断。

需要明确回退时，仍要求同样排空和精确候选哈希，只从Git重建旧的两模块，不创建部署备份：

```powershell
python -B scripts/deploy-account-baota.py --collection-dual-health-rollback --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 7969cb57ac7b6c978fc42eaa11b3c1a04839b67b1d121e0b5dafc10d5b3a16fd
```

回退恢复的是旧单支路健康实现，不满足新的双支路恢复标准；不能拿其ready审计恢复Amazon。
操作仍需符合当时维护窗口授权；本轮只验证本地发布计划，不执行以上命令。

本轮发布路径定向6项通过；与原账号发布工具合跑73项全部通过。运行文档与发布矩阵检查通过。
旧协调器拒绝dual_health；新协调器给出精确两模块正反清单；独立副本回退后恢复旧拒绝行为，回退哈希一致。
这些是本地计划与字节证明，不代表已经连接、安装或通过正式采集验收。
