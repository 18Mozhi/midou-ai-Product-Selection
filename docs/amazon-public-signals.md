> 当前版本为 `amazon-public-product-v4` / `amazon-public-product-adapter-v6`，在下述公开指标基础上增加有限评价节选；旧版本说明为历史记录。详见 [公开评价样本](amazon-public-review-samples.md)。

# Amazon 免费公开信号

2026-10-17 继续落实用户要求的商品、销售、评价与广告数据。当前交付只读取页面已经公开展示的信号，不把页面购买提示当成精确成交量，不从公开标记推断广告花费、曝光或点击。

## 真实页面依据

通过用户 Chrome 新建的研究页查看 `https://www.amazon.com/s?k=portable+fan`，核对真实搜索卡片与商品 `B0F43SPZCY` 的详情后关闭研究标签。没有修改用户原有标签页、购物车或账号设置。

- 搜索商品购买提示在叶子 `span.a-color-secondary` 中，观察到 `10K+ bought in past month`、`3K+ bought in past month`、`400+ bought in past month`。
- 广告标记出现在 `.puis-sponsored-label-text` 内；观察到的广告视频组件 `data-asin` 为空，不伪造其商品身份，也不把它附加到前一个普通搜索商品。
- 详情主区域是 `div#centerCol`；购买提示 `span#social-proofing-faceout-title-tk_bought` 包含两个嵌套 span；评价计数在 `span#acrCustomerReviewText`，真实值包含括号与千位分隔。
- 详情 `Best Sellers Rank` 行有多个类目排名；当前保留第一条排名和原文，不将第二个细分类目第一名冒充全站第一名。搜索顺序与类目排名是不同字段。
- [Amazon 官方论坛说明](https://sellercentral.amazon.com/seller-forums/discussions/t/edbbaf07-471d-4770-825f-c8546837f653)确认购买提示可能按周或月展示，也不保证每次可见。原文缺失不能写成零。

普通 Web 工具本次返回 503。随后使用服务器现有受限代理和采集网络配置，先对实际 Amazon 搜索 URL 核对 robots，结果允许；一次只读请求得到 HTTP 200，返回公开 HTML 由本地新解析器实际解析出五个商品、五条购买提示。这个检查没有启用来源、创建采集任务或写入数据，也不能代替持续队列验收。没有绕过验证码、登录、站点限制或付费墙。

## 实现与字段

解析版本为 `amazon-public-product-v3`，适配器为 `amazon-public-product-adapter-v5`。搜索结果按自身 div 的配对闭合边界切分，跳过注释与脚本中的伪标签，修复旧版把后一广告或页尾内容收入前一商品证据的情况。详情优先本品身份与主区域；其他 ASIN 的 JSON-LD 不替换当前主品。

新增规范化字段 `sales_badge_text`、`sales_badge_quantity_lower_bound`、`sales_badge_period`、`sponsored`、`best_seller_rank`、`best_seller_rank_text`。只解析已见到的整数或千位分隔数字、可选 K、加号、购买和周/月格式；无法确认的格式保留未知。K 下限乘 1000，检查安全整数；没有反推上限、增长率或精确销量。

JSON-LD 与 HTML 合并时，原始证据包同时保存原 JSON-LD 商品对象、对应商品区域 HTML 和排名行，不能只保存 JSON-LD 却给 HTML 补充字段挂空证据。纯 JSON-LD 无补充区域时保留原内容类型。来源路径与新解析版本进入原有字段 provenance；不新增表或迁移。

`GET /competitors` 和详情的 `latest_snapshot.public_signals` 为服务端只读投影：购买提示、已观察的广告标记、类目排名。读取绑定同组织/工作区、商品 ASIN、Provider、规范化记录和原始证据 ID；只返回字段白名单，不返回原始 HTML、其他载荷或内部路径。没有新采集的历史快照返回 null，历史不回填虚构值。现有快照写 API 不增加可写字段。

主品及最多十个竞品的对比表显示购买下限、排名与广告标记；未知单独显示“未采集”，并说明精确销量与广告花费没有采集。原“评论数”改为更准确的“评价数”，兼容来源混用 ratings/reviews 的现有计数。自动主品相关性选择排除已明确标记为广告的搜索记录，不把未知当成已证明无广告。

## 使用与部署

无新增依赖或环境变量。继续使用后台现有 Amazon 采集、来源审核与网络配置。API 启动的既有目录同步会写入新 parser 版本及可选字段，保留来源原启停状态；当前新适配器拒绝旧版本配置，不能将新结果标成 v2。若目录尚未同步，在后台按现有来源目录刷新流程核对，再以真实样本检查新版本。重新启用来源仍须满足原审批、健康、robots、限速和熔断条件。

本地构建后使用固定宝塔部署脚本上传，重启唯一 Node 项目：

`/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品`

Python 不因本项重启。当前未部署、未启用生产来源、未修改生产数据或配置。评分权重、利润公式和质量门不因新增字段自动改变；有限公开评价节选已补充，见 `docs/amazon-public-review-samples.md`；通用品类费用、全量评价、广告历史、实际持续采集及每日百品仍需继续完成。

## 验证

单测覆盖真实标记结构、嵌套详情提示、相邻广告与页尾隔离、JSON-LD/HTML 联合证据、本品 ASIN、非法格式、未知值、旧配置拒绝和响应白名单；八个浏览器用例覆盖桌面与 390px 手机上的主品/竞品信号、缺失和独立滚动表格。列表与详情的两段完整新查询已在 MySQL 5.7 的只读事务中 EXPLAIN 并实际执行，不写入数据；不以模拟页面签收生产采集。
