# P46 历史图证比较修复

2026-09-13；main / af239b08，开始时513项既有变更、暂存区为空。全73页目标保持，
不改页面、已批准区域、生产逻辑或部署。P16成员组合r3及其他已发起审核仍待具体回复。

## 原因与修复范围

新跑P46结构/反馈11项单测，5过6失败。失败不是同一个问题：旧版本解析链不足以覆盖
全部当前源码；更重要的是原baseline清单与后来重拍的current清单被当成同轮对照。
反馈current40张全部不同于原提交，结构current132张中59张不同。字体从
`Microsoft YaHei UI, Microsoft YaHei`变为`Microsoft YaHei`，还有共享组件变化，
不能称为小像素噪声、不能增加容差。两份baseline仍等于各自原提交。

新增只读 `scripts/lib/ui-phase2-provider-historical-capture.mjs`，固定四份完整manifest：

| 阶段 | 原提交 | 图数 | 来源数 |
| --- | --- | --- | --- |
| 反馈 baseline | f2e3d775e27e178f15507f97632539c7a9118694 | 40 | 42 |
| 反馈 implemented | f2e3d775e27e178f15507f97632539c7a9118694 | 40 | 43 |
| 结构 baseline | 52099bc3e489b5224d3bd3553d7dac3ec3136ae6 | 132 | 164 |
| 结构 implemented | 52099bc3e489b5224d3bd3553d7dac3ec3136ae6 | 132 | 165 |

Git批量按字节长度读取原来源与PNG，拒绝缺失、截断、额外数据、未知阶段/路径；返回独立
manifest和图像Buffer。结构层额外只准读取原keyboard-baseline，仍由既有完整版本SHA核对。
反馈baseline按原宿主规则仅Registry使用已固定的前版本，其他来源不做替换。

两原测试保留完整script/template、CSS作用域、模型/事件、主题、网络、焦点、P47隔离、
图片数量/尺寸/SHA及原像素对照断言。只将历史来源/清单/PNG读取绑定到捕获时提交；
原33张完全一致和三处精确栅格边缘差值断言未放宽。已批准两张手机反馈图仍核对本地原SHA。

后续两重拍包没有删除、覆盖或冒充原图：53/173来源、40/132图，当前各有P47组件和palette
两处变化。既有palette-evidence测试固定两份重拍manifest，逐图校验，通过精确P47逆向
核对pre-refresh版本，其余所有来源仍读当前原文件并核对。为此给历史解析器接入已有的
完整分页逆向：24a3b2 → 51c0ba → pre-mobile → pre-refresh，任一未知改动仍失败关闭。
该解析器不进入运行中Vue，不改变生产分页、刷新或空态。新增分页修改负例和旧输入支持测试。

## 验证记录

- 修复前两个P46文件11项：5过6失败；修复后11项全部通过，包含所有原比较断言。
- 新读取器、P47历史解析及既有palette验证13项通过，覆盖UTF-8/二进制、截断、未知路径、
  独立缓存、旧版本支持、未知分页改动拒绝，以及P44原四包和P46后续两包的全来源/全图。
- 首个程序化全量启动仅报告259文件级结果，没有真实用例汇总，已明确作废，不算通过。
  正式全量改用 `node --test --test-concurrency=8 tests/unit/*.test.mjs`，仅附临时JSON输出器，
  不改变测试、断言或超时。最终结果与清理状态以本记录后续段落为准。

最终全量：259文件、1499项，1352通过/147失败/0取消/0跳过，exit1，371537ms。
汇总完整，但工具截断中段19条失败，保留128条后仅复跑对应24文件：150项131过19失败，
没有修改断言或产品源码。两段合并147条（同名不同文件保留），来源逐条标记在
[机器记录](P46-HISTORICAL-EVIDENCE-UNIT-RESULT.json)，不是伪称单轮未截断的完整清单。
按测试名归一化比较上一169失败记录，22个旧失败名消失、没有新失败名；两轮之间包含
此前批次，不将全部减少归因于本轮，也不把无新失败名宣称为全库无回归。

`verify:docs`（73路由/153必需文件）、`verify:runtime-docs`、本批格式和diff检查通过。
正式全量/补跑都已退出；临时报告器已删除，格式fixture
`C:\Users\23136\AppData\Local\Temp\scoutops-code-style-XuldRC`已确认不存在。
本轮没有新截图、没有遗留自建服务，不重复全套测试来补已经完成的汇总。

本批不需要新浏览器截图：改的是历史证据读取，不是视觉实现。重拍包不能作为当前生产
验收证明；最新实际平台壳/P46回访及P16成员壳验证仍是各自独立审核宿主证据。

## 使用与未完成范围

```powershell
node --test tests/unit/ui-phase2-provider-structure-implementation.test.mjs tests/unit/ui-phase2-provider-feedback-implementation.test.mjs
node --test tests/unit/ui-phase2-provider-historical-capture.test.mjs tests/unit/ui-phase2-adapter-historical-source.test.mjs tests/unit/ui-current-palette-evidence.test.mjs
```

本批无需调整生产参数、API/OpenAPI、env、数据库、权限、依赖或重启服务；没有真实读写业务。
原脚本/源码/图稿保留，不能将历史解析器用于当前生产或修改哈希来隐藏漂移。
没有新增审核批准、没有部署；全库发布门与73页整体验收未完成，commit hash不适用。

本轮临时文件仅 `output/tmp/p46-unit-reporter-20260913.mjs`，已删除；单测自己的
隔离格式fixture由原测试finally清理并确认。此前以下两个目录仍保留，不绕过已有删除限制：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`
