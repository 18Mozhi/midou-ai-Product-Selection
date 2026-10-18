# Amazon列表完整商品标题

真实竞品任务cc3f8819的12条搜索记录把每张卡片第一个h2品牌行Transformers当作商品标题。只读原始证据显示，同一卡片另有与当前ASIN的/dp/链接关联的完整名称，例如Studio Series Bumblebee, Age of Extinction Deluxe Class 5-Inch Converting Action Figure, Robot Toys for 8+。11条候选因输入仅含品牌而被分类为different_use；这是历史模型结果，不能作为完整标题下的有效相关性结论。

搜索解析先选择与同站当前ASIN商品链接关联的完整h1/h2：兼容标题包裹链接和链接包裹标题，读取整个标题正文而非首个span。忽略脚本、注释、图片链接及其他ASIN或外站链接；原无链接标题回退继续保留。详情productTitle和JSON-LD事实优先级不变。没有扩大到描述、评价、品牌词补全或AI生成标题。

Amazon适配器版本升为amazon-public-product-adapter-v19，既有parserVersion合同不变，不修改来源配置。Worker仅为Amazon证据身份增加真实normalizer_version，取自标准化输出的adapter_version。相同任务/原始字节/规范化版本保持幂等；新规范化版本进入既有不可变证据和record_version链，不复用旧错误标题的哈希，不删除或覆盖历史内容。其他来源身份规则不变。字段名、API、表结构、权限、配置和依赖不变。

通过官方宝塔脚本发布运行包并重启Node项目ai选品后，对后续采集和自然重试生效。无需修改来源parserVersion、配置开关或单独重启Python。旧已完成任务、旧分类和评分不强行改写；仍须用新采集/新证据和真实相关性验证，再取得5–10个有效竞品详情。只读重放的正确标题不计入整链商品完成数。
