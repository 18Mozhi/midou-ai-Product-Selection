# P59 读取状态 r2 · 区域待审

[查看16张双端图](index.html) · [原捕获清单](manifest.json) · [完整验证与使用说明](../../../design-plans/ui-phase-2-2026-09-07/P59-READ-STATES-BATCH23.md)

每个宽度包含loading、expired、forbidden、rate_limited、blocked、error、refreshing、retained-error八状态。手机加载与依赖受阻白色区域已请求审核，其他区域/全部按钮/整页/真实权限均不因此批准。数据为本地样例，不是真实登录恢复或授权。

捕获HEAD4f0bf488及本批工作树；16图、165来源、424项原捕获结果。后续只给驱动helper增加文字对比度断言，当前428项通过；唯一来源差异为scripts/lib/security-read-state-preview.mjs，另164份含全部视觉源码仍匹配，图片哈希全部一致。原manifest不重绑、不改写成新428项结果。

加载说明不再提前暗示API/MySQL故障，左对齐标题、灰色技术详情与蓝色重读采用C审核样式。权限/失效不新增区域内按钮，仍保留原顶部刷新；保留数据错误红字对比度通过，未改色。

无参数原布局验证或 `--read-states` 不生成文件。将来 `--capture-read-states r3` 只创建新目录；本包保留供审核，不部署，无需常驻预览服务。r1为修复前诊断，不覆盖其图或旧批准。
