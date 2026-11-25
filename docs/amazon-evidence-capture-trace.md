# Amazon 详情证据提取分步定位

正式双路健康检查1792已证明Node与Python搜索各解析48条；随后同商品Node详情在extract_items超时，item_count=1，Python详情未继续。
这不是商品详情验收通过，也不能据此解除熔断。旧日志只定位到循环，不能证明是截图、DOM或地区头失败。

本次只给原captureEvidence增加固定步骤回调，失败日志补充evidence_operation：dom_fragment、body_fallback、delivery_header、screenshot、screenshot_recompress。
保留原诊断不输出request_id/trace_id的隐私边界；以既有健康传输回执及单一全局运行关联诊断。不输出页面、商品、URL、Cookie、错误原文或用户输入。

DOM选择、地区头要求、250000字节边界、真实JPEG截图及800000字节上限、降质重拍、解析错误、总时限、身份/匿名/邮编保护均不改。
保留所有失败；即使item_count已有1，任何必需证据步骤失败仍不得ready。它是定位增强，实际根因修复尚待正式同请求日志确认。

5个实际本地浏览器故障注入分别证明步骤归因、原timeout结果、无部分证据成功、只有一次本地拦截请求、敏感错误文本不进入日志。
原有详情就绪集成也须通过。测试响应是本地样本，不代表正式采集通过。

## 精确发布与恢复

只替换packages/playwright-crawler/dist/index.js，旧哈希必须为已上线906716a733d1ff03dcc497a22a49b3aa337e91c55923abe66b4c7c461c58e7e2。
保护已上线Worker维护暂停、双路健康模块、Python及1688模块。常规完整四次全零排空通过后，只经宝塔重启ai选品 Node；无需Python重启或任何新配置。

```powershell
python -B scripts/deploy-account-baota.py --collection-capture-trace-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 906716a733d1ff03dcc497a22a49b3aa337e91c55923abe66b4c7c461c58e7e2
```

明确需要恢复原引擎时，使用同入口--collection-capture-trace-rollback，expected-module-sha256为本次精确候选3974d5cf0afa8916814105df00b851534a6428a3bede325b51e8d97244ee6e0d；从Git重建旧模块，不创建正式备份。
这不是首次加载，不重新运行maintenance_bootstrap。SSH只传无损压缩且有最终参数长度上限的源码包，不上传临时脚本。
无API/OpenAPI、环境变量、权限、依赖、数据库、并发或Python输入变更。上线后按同一健康请求查看分步日志，再修真实失败点，不调大超时或降低标准。
