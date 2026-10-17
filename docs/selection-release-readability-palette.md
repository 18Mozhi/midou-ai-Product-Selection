# 发布复核中的可读性与配色修复

独立发布工作树c867271e完整22工作区构建及75提交/853路径归属检查通过，但整套unit检查暴露三类此前定向检查未覆盖的问题，候选包已标记validation_failed，不作为可发布版本。

opportunity-decision-panel.css在窄屏保留5处12px文字，低于现有通用13px下限，统一提高到13px，不给设计检查增加例外。桌面已有更高优先级样式显示16px，因此浏览器检查使用实际可读性下限>=13px，不强制把较大字体缩成13px。

任务横幅删除后，task-workspace-tokens.css留下4个未被生产源引用的色值，删除on-primary-muted、blue-soft、white-border、white-wash。现有精确“声明集合=引用集合”检查保留，固定数量从47调整为实际43，不使用忽略白名单。

选品配色检查只读取旧主CSS和导航，漏掉已拆分的OpportunityDetailInsights.vue。补入实际组件后发现警告提示引用了未定义的两项页面色值，改用已有共享--so-warning与--so-warning-soft；保留仍在错误提示中使用的danger/danger-pale，不删除有效颜色。新检查扫描真实使用者，22项页面配色声明与引用继续精确相等。

64项设计/配色/主题定向检查已通过，包括两个原本漏扫拆分组件的检查。原独立工作树整套已结束，3143项中3027通过、116失败、0跳过，638.83秒；其中88项直接报告ENOENT。不能将定向结果称为整套通过。另发现干净检出缺少旧评审测试依赖的被忽略output/playwright材料，产生ENOENT；不伪造历史证据、不跳过检查，也不把原主工作区旧评审材料误称为当前生产验收。

组件scriptSetup和template与改前HEAD字节一致，仅样式改变；P18只更新该组件的sourceHashes与dependencyHashes，审批字段保留。没有新增业务规则、API、数据结构、依赖、环境变量或Python输入。OpenAPI和环境示例无对应变更，发布本项前端静态包后刷新生效，孤立此项无需Node/Python重启。整个重构的累计发布要求仍按各阶段记录执行，当前未部署。

最终检查到73项缺失旧评审输入，均已核对在原工作区存在；独立检出不会自动携带这些被忽略材料。修复后在原工作区使用原有材料整套复测，不复制或重造历史证据。扩大浏览器初轮桌面78/81通过，另3项为旧决策导航名及已退休AI页签的测试假设；将其对齐当前“决策记录/选品详情分区”名称，AI旧链接须回到商品事实且不请求旧分析API。生产流程不为过期测试恢复AI页签。

自动审批拒绝单文件临时日志清理，返回blocked by policy，无更细原因，未换方法重试。保留C:/Users/23136/AppData/Local/Temp/scoutops-release-c867271e-unit-bb8d32b117f441af82f765838d1dcc05.tap。运行日志不进入Git或部署包；失败摘要已另存离线候选unit-validation.json。

独立unit运行还在独立工作树output/playwright生成14个未跟踪的临时捕获目录。核对创建时间、固定父目录、无Git跟踪文件后，自动审批拒绝递归清理，返回blocked by policy；未绕过或重试。精确路径清单保存在.artifacts/release-candidates/selection-rebuild-c867271e5f69-20261017/temporary-artifact-inventory.json；这些输出不代表历史评审通过，不发布、不提交，也未覆盖原工作区同名历史资料。


最终复测：原工作区3180项unit全部通过，0失败、0跳过，1066.94秒。代码与文档在整套运行期间冻结；终态退出码0后才更新此记录。扩大选品浏览器回归关闭截图更新，桌面81/81、手机81/81，共162项通过。前端typecheck/build通过（Vite16.57秒），格式709生产文件、73路由/153文档、运行文档、发布矩阵、包体199资源检查通过。上述结果验证本轮实现，不代表生产、每天100品或无历史输入的全新检出可完整运行旧评审测试。

本轮新增的legible-recommendation-detail-20261017两端PNG为永久回归交付，旧PNG保持原字节。测试服务4117/5187与整套测试进程均已退出。单测内部scoutops-helper-eol-eUUX9m夹具由finally删除，已检查路径不存在。原verification/state.json保持29ab3761860d03f2a90dc356b4511d6054f66ad856feae165330d07b96c50c2c，排除提交。

自动审批还拒绝最终单测日志和以下五个浏览器临时目录的清理，返回blocked by policy，未给更细原因，未换方式重试。保留：

- C:/Users/23136/AppData/Local/Temp/scoutops-release-readability-primary-unit-09c3bf32e81f4fee89638a7ba3953d54.tap
- C:/Users/23136/AppData/Local/Temp/scoutops-release-legibility-baseline-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-release-legibility-baseline-final-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-release-legibility-final-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-release-legibility-recheck-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-release-legibility-verified-20261017

这些材料与上面的14目录及首轮日志均不进入Git或部署包。候选打包临时目录scoutops-candidate-package-c867271e-pqk5uo1k已由新建TemporaryDirectory上下文正常删除；没有重试任何被拒绝的路径。c867271e旧候选保留失败结论，修复提交后需生成新候选，不能直接重用旧包。
