# 浏览器助手运行包换行一致性

准备选品重构发布候选时，主工作区与独立干净发布工作树的同版本构建暴露差异：浏览器助手的 manifest.json 和 service-worker.js 原始换行不同，使生成ZIP变动并令发布树不再干净。解压核对确认内容仅有LF/CRLF差异，依赖版本相同，ZIP时间固定为1980年；不将其误判为业务或依赖差异。

browserHelperSourceEntries 对固定白名单中的3份UTF-8文本统一CRLF为LF，打包与 assertBrowserHelperArchive 使用同一规范内容。ZIP文件名、目录、文件白名单、权限、消息协议、Cookie/Token边界、下载地址和客户端操作不变；低层ZIP读写与完整内容匹配校验不放宽。生成的当前版本压缩包随源码提交，旧Git版本及既有备份不重写。

新增端到端打包回归：分别从LF和CRLF临时源码生成ZIP，要求完整ZIP字节相同、跨输入风格验证通过；修改非换行内容后必须拒绝。原站点限制和不回传ERP令牌、当前公开ZIP与源文件匹配检查保留。临时夹具根目录由测试记录并在finally删除，不创建浏览器或服务。

验证记录（2026-10-17）：browser-helper-contract、deployment-migration、release-change-ownership及M03-02定向测试共16项通过；build:web通过（Vite14.99秒）；格式、运行文档、73路由/153文档、发布矩阵及本地宝塔部署预检通过。预检输出中的production_deployed是既有模块状态，不代表本次候选已部署。无残留scoutops-helper-eol临时夹具目录。

这是发布构建工具与静态下载包的修复，不修改选品逻辑、数据库、API字段、AI配置或服务器凭证。无新增环境变量、依赖或配置，OpenAPI、环境示例、Node/Python消费者无对应运行契约变化。使用现有 npm run build:web 自动生成规范ZIP；单独交付只需发布前端下载文件并刷新，无后端重启要求。整个重构版本的累计后端发布要求仍按各阶段记录执行。

独立工作树仅进行Git提交文本规范化，未改全局Git设置或提交内容；原主目录verification/state.json保持原样。正式推送和宝塔发布尚未执行，旧ed5c5561离线候选在该问题修复后应由新提交的候选替代，不作为正式发布包直接上传。
