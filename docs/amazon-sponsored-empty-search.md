# Amazon 无结果搜索与视频广告隔离

## 已确认根因

2026-11-25 正式任务4691b2b0保存的原生DOM哈希为
df82921113e5d4775a371959ae2cb13399aa7ca8bb99ecedf8ac60df6361525b。
真实搜索没有 s-search-result，在 s-main-slot 中明确显示无结果标题和拼写建议；
提示位于 MAIN-MESSAGING-2，前面 MAIN-VIDEO_MULTI_PRODUCT-1 的三个 ASIN 均属于 sbv-video-multi-product 广告。
旧识别只支持消息槽0，并拒绝广告里的 ASIN，遂把真实空搜索误判 source_changed，原自动保护停用了来源v30。
回放使用正式主机内的已有证据；交付记录只保存结构化形状和哈希，不保存页面、商品正文、Cookie或截图副本。

## 最小兼容规则

保留原消息槽0识别。新增分支同时要求：

- 原结果为 succeeded_empty 且 item_count 严格为数字0；原URL、关键词、两个证据及哈希校验通过。
- 存在原生 s-main-slot，消息槽精确为 MAIN-MESSAGING-2，content-id 为 messaging-messages-no-results。
- 完整闭合的消息区内有原生无结果标题和拼写建议。
- 消息之前恰好一个完整闭合的视频槽1，含 sbv-video-multi-product 及明确 Sponsored 标签。
- 仅该广告区的 ASIN 可排除；区外任何 ASIN、任何 s-search-result、商品标题或验证信号仍拒绝。

只返回零事实，不提取广告商品，也不把空搜索当有商品的健康检查成功。
详情即使返回这种搜索页面仍失败。未知槽位、缺标签、截断、冲突、验证、错商品及错查询不放宽。

## 详情诊断

amazon_detail_ready 超时的既有 detail_state 增加 document_path_kind，固定枚举为
product/search/home/login/checkpoint/other。只保留类别，不输出URL、路径原文、ASIN、关键词或页面文本；
不改变失败状态、等待时间、重试、地区/匿名校验或白名单。后端保存及消费原 stderr_diagnostic，公共API字段不变。

## 验证与发布

同一份真实保存结果在正式主机只读回放：BASELINE source_changed，MODIFIED 零事实且无解析错误，ROLLBACK source_changed。
定向反例覆盖广告外ASIN、普通搜索结果、错槽/标签、截断、验证码、商品页、非零计数、身份及证据哈希。

通过正式协调器 --collection-sponsored-empty-only 发布两个固定模块，
expected-previous-sha 为1b622274a6871d9d1ac3986223359b539a82aa76，
expected-module-sha256 为fb13c6635537fe69e6a4a30e07396a71f6b47c657a70c8855f89d69e7aca79e0。
只重启宝塔 Node ai选品，保护已发布的Python断连修复及MySQL定位；不动1688、AI、并发、数据库及死信。
--collection-sponsored-empty-rollback 从bab6cad44原Git源重建这两个模块，
回退的 expected-module-sha256 为7f408dc06ebb737acbb4328d95f24e8cd78aea1af4229aa820ab27ecf7c49074。
不创建生产备份或回退副本。无新增配置、依赖或用户调参项。

来源仍须保持停用，直至真实搜索有商品、同一商品详情通过后按原审计流程恢复；旧v29健康不能用于恢复v30。


## checkpoint 验证页不是商品超时

v31恢复后自然详情的安全路径枚举连续显示checkpoint，页头地区仍匹配，但没有商品标题；
这与之前只检查DOM验证码标记导致的timeout归类相符，不是邮编错误的证据，也不能据此放宽详情选择器。
引擎仅对原Amazon计划、精确https://www.amazon.com来源下的/checkpoint/路径增加验证阻断信号。
没有人工接管上下文时立即返回既有blocked_captcha/零事实，不消耗详情等待预算；
已有健康检查人工上下文时复用原超时、权限、匿名及固定主机限制，让操作者看到现场。
不自动认领、点击、解题、登录、导入Cookie、换出口、放行新主机或绕过原站验证。

--collection-checkpoint-only 只发布 packages/playwright-crawler/dist/index.js，
expected-previous-sha 仍为1b622274a6871d9d1ac3986223359b539a82aa76，
expected-module-sha256 为d206cdd51447eaee72db5e279de770bb4f39dc1b7f4838067ed14498640d6b4b。
沿用原领取暂停/四次连续排空/持有者恢复门禁；未排空不得重启，不修改租约。
只重启Node并要求Python身份不变；源/模型/1688/并发不变。
--collection-checkpoint-rollback 的预期哈希为906716a733d1ff03dcc497a22a49b3aa337e91c55923abe66b4c7c461c58e7e2，
从8df438999原Git源重建，不回退刚修好的空搜索、SQL或Python模块。
此修复只纠正阻断归类、接入既有人工作业，不等于已通过真实验证或所有详情已恢复。
