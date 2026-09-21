# P49 审核入口的捕获版本状态

2026-09-13，main/af239b08、496 项既有工作树变更、暂存为空。上一轮实际预览整合是进展；
本轮继续维护可供用户审核的真实图证边界，完整73页C重构/状态/宝塔/签收目标不缩减。

## 改动

[审核入口](../../output/playwright/p49-current-review-r2/index.html)现在标为“捕获版本 · r2 ·
待审核”，显著说明当前源码已有后续改动、P47分页焦点已修复、原图没有重新拍摄。
五组各显示一处后续来源变化，并提供 review.json 版本差异链接。frontend-design 技能用于
将版本提示放在原图前，沿用入口冷灰蓝样式；不改产品图、实际App或待审页内构图。

生成器固定五份原manifest的完整SHA，然后逐文件校验来源。只有一个确切的历史分支：
`apps/web/src/components/ProviderAdapterCenter.vue`，捕获51c0ba、当前24a3b2。复用上轮
逆向函数，移除完整分页补丁后全文必须等于捕获SHA。其他来源仍逐文件直接核对；未知
文件、捕获版本、当前修改、坏清单和批准篡改都失败关闭。不批量更新旧预期SHA。

review.json在原schemaVersion=1增加总包及每组 `sourceMatchesCurrent`，每组增加
`sourceChanges`，记录file/capturedSha/currentSha/lineage。当前五组及总包均为false；
这表示捕获版本可核对，但不等于当前源码一致。生成CLI和浏览器验证器都消费这些字段，
不是只改文案。逆向仅用于核对旧来源，不替换运行Vue，不证明当前像素或当前行为相同。

## 使用与验证

```powershell
node scripts/build-ui-phase2-acceptance-review-r2.mjs --check
node scripts/verify-ui-phase2-acceptance-review-r2.mjs
```

--check现在校验原捕获证据、明确版本差异及生成入口是否同步。成功并同时输出
`sourceMatchesCurrent:false`是预期结果，不是当前实现/生产门通过。--write只更新
index.html/review.json；不会重拍或修改原五包manifest/PNG。未知漂移仍停止生成。

审核工具在截图前重建并比对入口与JSON。--capture按当前版本状态选择独立
`review-proof-versioned`目录，独占创建、拒绝覆盖；原review-proof不动。当前新目录已存在，
重复capture会拒绝。普通无参数验证不创建临时目录、不开Vite或生产服务。

- 最小4项通过：路径安全、全部图证/状态、已知来源逆向及未知漂移、五份manifest完整固定。
- 关联10个文件55项全部通过（14119.3917ms）：含原P49五组143历史图、r2原143图，以及
  P47当前分页/预览保护；未把历史图测试当成新的当前截图或实网验收。
- 1440/390审核工具通过：版本提示、每组变更数量、五组键盘开合、原尺寸链接、版本JSON
  链接往返、零溢出/页面错误/外部HTTP；浏览器finally关闭。
- 三张新工具图为两宽度全入口和390版本提示区域，记录在
  [工具证据](../../output/playwright/p49-current-review-r2/review-proof-versioned/evidence.json)，
  包含index与summary全文SHA；桌面全图及手机提示已目视核对。
- 原五份r2manifest、143产品PNG与原两张工具PNG保留；不把三张新工具图算成产品状态新增。

本轮仅工具/测试/文档变动，不重复此前产品构建、分页实页捕获或全库测试。最近完整全库
仍为1478项1309通过/169失败，不按55项定向通过推算新全库数量；上轮两项P47旧包来源门
也未在本轮豁免。完整重构、业务状态、真实权限/探针及生产验收尚未完成。

## 未改与收尾

未改生产Vue/CSS、API/OpenAPI、路由、权限、数据库、环境变量、依赖或用户批准记录。
没有新的用户业务决定；原P49页内审核仍指原图，不自动扩大到导航壳或当前实现。
本轮未部署、未重启、未提交；全库门未过，工作树既有混合修改继续保留。

三张新工具图及更新后的入口是正式审核交付，非临时文件；本轮无临时脚本/下载/服务，
浏览器已关闭。历史删除受限目录 `output/playwright/p47-c-e2e-temp` 与
`C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`
保留，不绕过删除限制。
