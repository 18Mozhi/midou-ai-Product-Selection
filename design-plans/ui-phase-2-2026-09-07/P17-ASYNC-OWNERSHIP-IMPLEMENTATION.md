# P17 评分规则弹窗异步归属

## 修复范围

修复真实 `ScoreRuleConsole.vue` 的两类迟到回执竞态，保留现有规则版本、动作字段、`expected_revision`、权限、接口及服务端状态转换。

- 生命周期动作提交时捕获规则、动作、原因、回滚目标和弹窗代次。关闭后打开另一版本，不会被旧成功回执关闭或改写新弹窗；旧失败不覆盖新弹窗错误/请求编号。旧写入仍可能由服务端完成，成功后仍重读版本目录并以原动作名反馈。
- 预览保持最多一个物理 GET 在途。A 请求未结束时选择 B，B 进入可见等待状态并排队；A 的迟到结果被丢弃，随后只读取当前最新的 B。关闭排队中的目标会撤销该待发意图，旧请求完成后不会意外打开或读取已关闭的预览。
- 预览失败、分页、生命周期动作 body 和错误恢复合同不变；这里不声称隔离夹具证明真实审批、数据库或审计。
- 创建草稿 POST 绑定打开弹窗的代次。旧请求仍按原合同写入并重读目录；如果用户在请求期间关闭并重新打开创建窗，迟到成功不会关闭或清空新草稿，迟到失败不会覆盖新窗错误/请求编号。

## 验证

`node scripts/run-playwright-projects.mjs tests/e2e/ui-phase2-scoring-contracts.spec.ts tests/e2e/m04-03-scoring.spec.ts --workers=1`：桌面 Chromium 与390px手机各20/20通过（P17合同16项、M04-03页面4项）。同步更新了获准C方向的规则页桌面/手机快照，并将规则身份/覆盖率与版本入口断言对齐实际DOM。创建迟到成功/失败、非空预览缺失字段及空缺列表均有实际 Vue 回归。`npm run typecheck:web`、`npm run format:check`、`npm run verify:docs`（153项）、`npm run verify:plans`、`npm run verify:runtime-docs`及`npm run verify:release-matrix`通过。浏览器夹具为本地隔离响应，不代表真实服务端验收。

## 未覆盖

版本目录自身 KeepAlive 读生命周期、真实审批/审计/M07-03 与读屏/全局全状态门不由本批关闭。未增加自动取消或服务端重试，不改变用户已提交操作的服务器结果。
