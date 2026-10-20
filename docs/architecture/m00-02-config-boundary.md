# M00-02 配置边界

Node API/Worker 通过 `@scoutops/config` 读取并校验应用、MySQL、Redis、AI、文件和安全配置；Python Crawler 使用同名字段的独立启动校验。生产环境的数据库密码、会话密钥和 AES 主密钥缺失时必须拒绝启动。

浏览器只允许 `VITE_API_BASE_URL`。`DB_*`、`REDIS_*`、`AI_*`、文件绝对路径和任何密钥不得进入前端构建。`/health/version` 只返回版本、构建 SHA 和不含密钥值的配置指纹。

配置错误只输出字段名、错误码与调整方式，不输出传入值。配置变更需要在宝塔对应项目的受限环境中完成并重启相应进程；不直接改数据库，不创建面板外服务。

COMPETITOR_REFRESH_INTERVAL_SECONDS 是 Node Worker 专用重采间隔，默认 3600 秒，范围 300–604800；不下发浏览器。与既有 AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT 一起控制周期详情刷新，配置修改需宝塔重启 Node。见 `../selection-product-refresh.md`。

竞品标题分类的现有AI服务须支持Chat Completions的response_format=json_schema和strict结构化输出；调用仍使用上述AI配置，无新增环境键。仅约束分类字段与已有关系枚举，原完整性/原文绑定/语义质量门保留，不自动降级为json_object或修补模型拼错字段。更换服务前验证同一契约，Node代码发布后由宝塔重启加载。见 `../selection-competitor-structured-output.md`。
