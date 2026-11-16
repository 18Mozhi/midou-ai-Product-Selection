# 账号切换：旧采集完成回执只读核对

现有 Python Crawler 将暂未提交的完成回执存于宝塔固定目录 `/www/wwwroot/ai选品/runtime/crawler-completions`；其 `quarantine` 子目录存放无法自动重投的回执。新回执可能仍在写入。停写后、切换前，在现有 BaoTa 主机通过已校验指纹的项目 SSH 连接，从固定运行目录 `/www/wwwroot/ai选品/backend` 使用现有 Node 20 和项目受限环境运行：

```sh
/www/server/nodejs/v20.19.6/bin/node --env-file=/www/wwwroot/ai选品/config/product_scout.env --input-type=module - --read-only
```

把本地 `scripts/verify-orphan-crawler-completion-spool.mjs` 原始内容送入该命令的标准输入并关闭输入；不用上传脚本。只接受生产固定回环业务连接和实际配置的固定回执目录，不打印凭据、ID、文件名或回执正文。它仅从 MySQL 只读事务读取没有关联作业但仍标记运行的记录 ID，再按回执中的精确 run ID 对账。超出安全读取上限、无法解析、临时写入仍存在时结果不可用，不能因没有打印匹配就放行。

- `matching_completion_receipt_present`：保留该回执，按原作业、原请求和原关联核对；本工具不重投。
- `no_matching_completion_receipt_observed`：只表示这一时点未发现匹配。不代表原结果成功、失败或取消，不替代停写后的原样核对和同批备份验收。
- `inconclusive` 或 `failed`：不得拿来签收。保留文件，先核对正在写入的进程、路径或格式。

2026-11-16 在当前运行主机的只读盘点：4 条无关联作业的旧运行记录；待提交、隔离、临时写入和匹配回执均为 0。请求／追踪相关作业都不是唯一匹配，原终态仍未证实；没有改写旧记录、回执或阈值，也没有重跑备份或切换生产。
