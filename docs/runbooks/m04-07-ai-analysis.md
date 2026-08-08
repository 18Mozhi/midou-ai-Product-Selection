# M04-07 AI 辅助分析运维与回滚

## 宝塔上线

备份后应用 `0017g_ai_assist_m04_07.up.sql`。只在宝塔 Node Worker 受限环境配置 `AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`、`AI_TIMEOUT_MS`、`AI_RETRY_LIMIT`、`AI_ANALYSIS_POLL_MS` 和 `AI_ANALYSIS_LEASE_SECONDS`，随后在宝塔重启 Node API 与 Node Worker。密钥不得写入日志、文档或浏览器。

## 诊断与恢复

- `ai_provider_timeout`、`ai_provider_rate_limited`、`ai_provider_unavailable`：检查受限模型服务并等待 1/5/15 分钟退避；调整超时、重试或轮询后必须重启 Worker。
- `ai_output_json_invalid`、`ai_output_schema_invalid`、`ai_output_source_ref_invalid`：检查模型兼容性和提示合同；禁止手工把非法输出写成成功。
- `dead_letter`：保留原任务、输入哈希和错误码，恢复依赖后由有权用户新建分析，不改写死信记录。

## 回滚

先在页面禁用新建入口，导出请求、结果、抽检、事件和 Outbox，再由宝塔停止 Worker。确认备份可恢复后执行 down 迁移；它会删除本模块数据。回退代码与配置后由宝塔重启 API/Worker，历史机会、评分、利润和人工决策不受本模块回滚影响。
