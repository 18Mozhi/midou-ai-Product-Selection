# 米豆 ERP 商品导入运行说明

## 用户操作

1. 在 Chrome 登录 `https://medou.medouai.com/#/ProductList`。
2. 从“选品机会 → 从 ERP 导入”下载并按说明加载 ai选品浏览器助手。
3. 点击“从当前浏览器读取”。扩展只在本机读取 ERP `localStorage.token`，使用该值调用已确认的 `POST https://medo2.mozhiz.cn/store/product/getSheinProductList`，向 ai选品发送商品行、来源网址和抓取时间，不发送令牌。
4. 没有安装助手时可上传该接口返回的 `list` 数组或商品数组 JSON。每次限 1–500 条。

导入创建可查看详情的采集任务，保存每条原始 ERP 记录、规范化记录和字段来源；再生成选品机会、真实 ASIN 对应的 Amazon 待采集竞品，以及找货记录。找货详情会展示 ERP 中真实存在的供应商编码和历史参考成本，并明确标记它不是已确认报价；没有 ASIN、价格、排名、供应商商品页、MOQ、交期或所在地时保持缺失，不补 0 或演示值。

## 宝塔发布与验证

1. 只在宝塔备份 `product_scout` 后部署；固定目录部署脚本会以业务账号按白名单幂等应用 `database/migrations/0042_erp_product_import.up.sql` 和规则调度所需的 `0043_trend_rule_collection_schedule.up.sql`。
2. 本地构建后按项目部署脚本上传 `frontend/backend/python`；不得在服务器 Git 拉取或构建。
3. 通过宝塔重启统一 Node 后端“ai选品”。Python 爬虫没有新增进程或环境变量。
4. 验证 `/api/v1/health/ready`，再用普通成员导入一小批真实 ERP 商品，检查任务详情、证据、机会图片、ASIN 竞品和找货缺失说明。

日志、审计、API 响应和最终交接均不得打印 ERP Authorization、Cookie、凭证密文或商品原始证据正文。
