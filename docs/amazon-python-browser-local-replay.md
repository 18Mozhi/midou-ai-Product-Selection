# Amazon Python 到浏览器的本地链路核查（2026-11-26）

## 当前结论与边界

现有两组同 ASIN 成功/失败记录（B0H8GWY1HV、B0GZWQC78M）除展示链接外，
执行计划一致。失败记录为 `amazon_detail_ready`：主文档 HTTP200、商品路径正确、
邮编匹配且 document_state=complete，但 item/title 节点不存在。成功记录保留了
带 productTitle 的 DOM。失败回执没有原始响应，不能据此区分源站空壳和后续 DOM 变化。

本次不修改运行代码、不发布、不重启、不连接业务库、不请求 Amazon/1688，
也不调整并发、重试、邮编、代理、白名单、验证码或商品完成标准。
此前未提交的诊断候选保持原样；本项不是自动任务超时已修复或来源实采验收。

## 实际覆盖的链路

`tests/integration/amazon-curl-browser-byte-parity.test.mjs` 使用真实 Chromium 和
现有固定依赖 curl_cffi 0.7.4，运行以下链路，不再以假 Session 或预制 stdio 结果代替读取：

本地 HTTP 服务 → curl 流 → 原 `fetch_document` → 原 JSON/base64 协议 →
原 `installPublicHttpTransport` → 真实 `route.fulfill` → Chromium DOM。

唯一目的地改写在测试专属 Session 工厂内：把自有测试 URL 映射到动态端口的
127.0.0.1。生产原点校验、超时、stream=True、verify=True、禁止重定向、
响应大小限制、读流、解码头过滤、base64 和 Node 转传均执行现有实现。
浏览器只把该自有顶层导航交给 stdio，其他请求全部中止；不导入生产 Cookie/档案。
没有关闭 TLS 验证：本地端点本身是 HTTP，因此不覆盖真实 TLS、代理出口、HTTP2
或 Amazon 风控。测试环境与正式 Linux/Node20/Python3.12 不等价。

## 七项验证与发现

1. 普通 UTF-8 HTML：Python 解码结果、Node fulfill 输入与 Chromium 读取字节哈希一致；
   中文/重音标题、邮编、内联脚本执行和两条独立 Set-Cookie 均保留。
2. gzip + 压缩 Content-Length：curl 解压，原 helper 删除编码/长度，Chromium 收到
   正确解码内容及长度，没有二次解压。
3. 延迟分块：先发送页头，延迟后发送标题；完整标题仍进入 DOM，不只交付首块。
4. gzip 延迟分块：使用 Z_SYNC_FLUSH 分段压缩，延迟标题仍完整保留。
5. UTF-16LE + BOM/charset：Python 与 Node fulfill 原始字节哈希一致，标题正常解析。
   Playwright/CDP `response.body()` 对文本返回 UTF-8；该哈希不同不是传输丢失。
   首次测试错误地比较了两种编码的字节，核对当前 Playwright 实现及实际文本后，
   改为在 fulfill 处校验原始字节、在 CDP 处校验 UTF-8 文本，未改运行代码。
6. 完整 HTTP200 空壳：只发送匿名/邮编页头、没有标题；原 helper 忠实传递，
   浏览器 document_state=complete、邮编存在但没有 productTitle，重现历史失败的
   已知 DOM 形状。它说明该形状与源响应缺主体相容，不证明真实故障就是此原因。
7. 分块中途断流：实际 curl 迭代报错，helper 返回失败，Node 中止导航；
   没有向 Chromium fulfill 一个完整 HTTP200，也没有隐式第二次请求。

因此，在上述受控表示和故障条件下，没有复现原 helper 的“仅取首块”、普通压缩
重复解码或 base64 截断。不能把这个范围的通过推广成所有线上响应均完整。
UTF-8 原文标记也不是通用解析器：UTF-16、脚本或注释中的同名字符串必须单独解释。
不凭这种标记降低 DOM/同商品证据校验，不增加自动回退或重试。

## 使用与后续

无需安装依赖或启动生产服务，复用项目已有 Python、curl_cffi0.7.4、Playwright：

```powershell
node --test tests/integration/amazon-curl-browser-byte-parity.test.mjs
python -B -m unittest discover -s apps/crawler/tests -p test_public_http.py
```

本地 HTTP 服务与浏览器在每例 finally 关闭；不创建持久浏览器档案，测试 helper 禁写
Python 字节码。源码、永久回归及外部验证账本保留；执行策略阻止清理时，明确记录
残留缓存，不换工具或换壳绕过。
无 API/env/schema/运行合同变化，OpenAPI、.env.example、前端和生产 Python 消费者无需修改；
无需重启或重新配置服务。下一步仍需真实失败的源响应形状与最终 DOM 对照，
当前不发布、不重启的边界保持，不为取得该证据擅自执行线上候选或重新健康探测。
