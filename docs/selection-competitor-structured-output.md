# 竞品分类结构化输出

4d49305b1d042820fef42d09d9a115a79c991dfb已正式发布，真实服务只读验证通过；普通队列中的失败案例仍待自然重试，每日100整链未验收。

## 原因和真实复现

2026-10-20 10:05北京，ESR15 Pro Max机会03817128-bd0a-4ee8-8178-a69a99515bb5已有真实主品详情，但没有独立竞品。其自动竞品任务8c225546-0edd-44e3-9c70-e990741ab99c自01:25:11.884Z创建仍queued；本工作区326 queued，其中257找主品、36详情、33竞品发现。近期领取主要为1688任务；Amazon于02:03:49恢复，不能仅凭等待认定调度失效或强清来源保护。

追查旧竞品查询586203c9-bde9-4e05-95be-884aff81f264（任务1fa107bc-9a9e-4b01-aae9-37ce4a100c0a、浏览器14a83834-0ccf-4888-8ec2-288fb1f73884）发现：浏览器succeeded，2件浏览器证据和15个解析记录已完整关联，当前实际主品B0C4K4LW4Y和14个独立候选上下文均可读取，但后端仍validation_failed。10:11用当前模型配置仅做只读分类复现，得到competitor_classification_invalid。

02:11:46.733Z返回结构逐项检查：唯一顶层classifications、14条c1–c14，第一条字段为source_ref/relation/**rationable**，其余为rationale；严格校验正确拒绝整批。没有把错误字段当正确字段或把其余候选当已完成分析。

同一真实输入只替换标准response_format为JSON Schema：02:13:04.398Z HTTP200、15157ms、14条输出全部通过原校验。随后将本地新编译分类器经内存模块载入并使用现有受限AI配置复测，02:15:24.592Z，13258ms、14条全部通过。仅验证格式和原输入绑定，没有领取任务、保存模型关系、写竞品/评分/价格或完成事件，也不能证明14份详细竞品。

## 改动与不变量

- 仅classifyCompetitors请求使用json_schema：根仅classifications；条目仅source_ref/relation/rationale，均required，根与条目additionalProperties=false，strict=true。
- source_ref枚举取本次输入已有短编号c1…，不把真实证据UUID交给模型控制；relation仍为substitute/different_use/accessory/uncertain。原中文/英文标题和全部相关性提示不变，原文仍由代码绑定。
- 请求后仍运行原全部校验：每候选恰好一次、去重/遗漏、800字符原因、原文绑定、证据指纹、当前主品、事务外模型、租约与审计复核。服务不支持或忽略schema、模型仍输出拼错/未知字段，均失败关闭。无额外修复请求，无自动JSON降级，无事后改名填字段。
- 普通情报、主品选择和1688货源分类继续使用原json_object；不改变请求次数、模型、超时、非思考参数、来源熔断、任务重试、5–10竞品数量、详情证明或评分门。

格式依据：[OpenAI Chat Completions结构化输出说明](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat)。该文档不能证明任意兼容模型支持；本项目现服务已用真实输入实测HTTP200支持此契约。

## 运维和验证

无新增环境键、依赖、API路由/浏览器字段、数据库结构或Python协议。config/env.example和配置边界同步说明AI服务要求；当前已有AI配置值不变。发布后由宝塔重启唯一Node API/Worker加载，新队列调用自然生效，不手动重放旧采集、不重置dead_letter或强写分类事件。更换模型服务需先验证同一结构化契约，不支持时保留失败状态。

定向45项分类/情报回归和Worker编译通过，新增schema字段/枚举/短引用断言及服务忽略schema时仍拒绝rationable的反例；完整构建与发布待执行。当前未创建临时文件/服务，真实服务诊断通过SSH内存执行，进程已退出，未打印凭证。

## 发布前闭环

22工作区构建、143项采集/竞品/情报/货源/完成回归、格式/静态分析/文档/路由/运行文档检查通过。最后增加不支持schema时HTTP400不得降级重试的反例，该组21项通过；仍保持全条目原校验。只读标题核验显示本次14候选均为PDU，但结构化输出不保证任意样本语义正确，不将本组返回直接计入竞品详情或每日完成。

生产Node代码发布后才会影响普通队列；旧dead_letter不自动复活，旧候选、原证据、状态和历史数据不删除，亦不把诊断结果直接写入生产。config/env.example仅加支持要求说明，没有修改AI配置值、凭证或新增开关。真实诊断均为内存调用且已退出，无本轮截图、临时脚本、日志或常驻进程，用户原verification/state.json哈希保持。

## 正式发布回执（2026-10-20 10:26，北京时间）

补充测试后144项相关回归通过。固定宝塔脚本首次在Git fetch源校验失败、尚未上传运行包；保持证书校验，仅本次命令回到既有schannel后fetch成功，重新执行同一官方流程。格式、运行文档、发布矩阵、9路径归属、22工作区构建均通过；第二次部署终端exit=0，正式版本4d49305b1d042820fef42d09d9a115a79c991dfb，临时运行包已删除。没有改全局Git/代理/驱动、关TLS校验或绕过远端源版本门。

02:26:07.543Z独立读取BUILD_SHA及3模块SHA256与发布构建一致：intelligence-product-association=a7e74f316c7c4606d40bf75e7715c9e4721a5d8f028792941aa50aa6850a1b9c；competitor-title-response-format=1054d16193ab56352d7325e721298dfc6b333bfe27f6d5a2892dacf698f9b8f3；原competitor-title-classification=13bf06fa3bc6fd3f068d3fcc508017b063b61c9ddbc87d287232a0da0ed83df3（原校验器未改）。

原失败任务1fa107bc-9a9e-4b01-aae9-37ce4a100c0a仍queued、attempt_count=1、原available_at=01:18:07.862Z，分类审计仍0，当前详细竞品0；没有将它从dead_letter复活、强制领取或写入诊断结果。今日仍1/100。02:26:38调度器running、suspected_stuck_runs=0，采集和趋势队列继续工作；实际在运行任务6d26a78c-f47b-48b8-9426-13148034c577于02:26:44自然完成另一工作区的competitor_snapshot，仅证明正常详情采集运行，不是本次分类案例自然验收。

同时补读上一型号修复：02:20:58原97评估已有94 waiting_evidence、2 queued、1 leased；Miracase已在02:08:21.878Z自然将原16.5元采购输入is_current置0，并保留原值/证据、写审计e4d13ed1-fd02-461d-9bd0-f9398516f693，错误为high_confidence_1688_match_missing。不能把旧价失效等同于找到新合格货源。

本轮未改UI/API用户字段、Python、权限或数据库，无需用户调参；Node已由宝塔加载。未启动本地验证服务或浏览器，4101/5173监听0；内存诊断进程已退出、未创建临时截图/脚本/日志，官方临时包已删，用户原状态文件未暂存。此前交付截图及历史清理拒绝目录未动。总目标保持未完成，仍需自然分类、5–10份详情及可信采购价和日百品证据。
