# P33 C 创建流程 · 实际状态图 r2

2026-09-13，main / af239b08b69f7d97cd0372f9840a70009eeef0c7，起点642项前序变更、暂存为空。
本轮从取消焦点推进到实际创建请求和回执状态，仍是本地Vue审核，未操作生产。

## 实现与依据

已按AGENTS→Feature Map→总纲M06及P33规格追踪子组件submitCreate、父createTeam/submit/
load、api-client、后端route/service/repository和OpenAPI的真实创建合同。
沿用E2E十团队、活动成员样例；新增行根据同一字段合同在本地内存构造。POST回执仅含
仓储实际返回的id/name/status/version，不把旧E2E中的完整列表行当成API必要回执。

可访问性技能用于四字段aria-describedby、表单aria-busy，以及位于忙碌表单之外的
role=status说明。frontend-design用于C蓝色进度提示、白色错误区/红边和弱化追踪编号。
所有script、模型、事件、必填/字数限制与上轮焦点预览完全一致；父组件未经变换。
既有C布局、上一轮8张焦点图、r4原图以及已批P47空态不改。

## 当前28图

每个场景包含390/840/841/1440四宽。下面列桌面/手机入口；840和841同场景文件在相同
目录，完整列表与hash、selector、实际captureViewport见[证据](../../output/playwright/p33-create-states-r2/evidence.json)。

| 场景 | 手机390 | 桌面1440 | 解释 |
| --- | --- | --- | --- |
| 保存中表单 | [图](../../output/playwright/p33-create-states-r2/390-saving.png) | [图](../../output/playwright/p33-create-states-r2/1440-saving.png) | 取消/提交禁用，字段仍可编辑是原规则 |
| 保存中提示 | [图](../../output/playwright/p33-create-states-r2/390-saving-status.png) | [图](../../output/playwright/p33-create-states-r2/1440-saving-status.png) | 新增独立忙碌说明 |
| 请求失败提示 | [图](../../output/playwright/p33-create-states-r2/390-write-failure.png) | [图](../../output/playwright/p33-create-states-r2/1440-write-failure.png) | 本地500空响应触发真实客户端回退文案 |
| 失败后字段保留 | [图](../../output/playwright/p33-create-states-r2/390-retained-form.png) | [图](../../output/playwright/p33-create-states-r2/1440-retained-form.png) | 四字段完整保留，不擅自指认某字段错误 |
| 创建成功提示 | [图](../../output/playwright/p33-create-states-r2/390-success.png) | [图](../../output/playwright/p33-create-states-r2/1440-success.png) | 201及后续读取成功，显示写请求追踪 |
| 新团队进入目录 | [图](../../output/playwright/p33-create-states-r2/390-created-team.png) | [图](../../output/playwright/p33-create-states-r2/1440-created-team.png) | 真实子组件搜索新增本地行；不发明自动选中新团队 |
| **已知错误，不可验收** | [问题图](../../output/playwright/p33-create-states-r2/390-known-refresh-failure-overwrite.png) | [问题图](../../output/playwright/p33-create-states-r2/1440-known-refresh-failure-overwrite.png) | 创建成功但重读失败，旧成功提示覆盖失败，OG-G02仍开放 |

交互视口始终1000px高；区域截图临时加高至1000–1225px再恢复，逐张断言不与固定手机
底栏相交。不是全部短屏验收，也没有用裁图/隐藏底栏掩盖遮挡。

## 验证结果与修订记录

- 首次手机27项通过。四宽r1捕获136项/28图，实拍发现父提示区仍有旧米色红字。
  r1清单/28图保留为正式问题证据，不宣称它们仍与当前CSS/驱动一致。
- r2局部通知样式不改文字或API处理；新增白底/深蓝/红边、追踪排版、成功浅蓝三项颜色检查。
- 首次r2手机检查误读成功背景的过渡首帧。实际getAnimations证明即使减少动态效果仍有
  两个0.01ms运行中过渡；等待其finished后颜色正确。修正的是验证时序，不改页面动效。
  失败预检与内存探查都未生成文件。修正后手机30项通过。
- 最终r2四宽148项，其中28项为正式区域无遮挡检查；28PNG、183完整来源；44本机GET、
  12次仅浏览器拦截的POST，**0真实后端/数据库写入**。所有服务在finally关闭。
- 原生必填拦截与焦点、原body四字段trim、双击仅1POST、忙碌取消禁用、字段保持可编辑、
  失败四字段保留、人工重试的新幂等键、成功增加到11行及写追踪、保留原团队选择均核对。
- 最终九份关联测试55/55通过，0跳过/取消，约33.43秒；包含旧图不可变、当前183来源/
  28图及焦点组合来源校验。Prettier、153文件文档门禁（73路由/60受保护/6角色）和
  运行文档一致性通过；六个本轮端口已核对无监听。

500空响应是明确的本地故障注入，不说明真实业务500一定意味着未写入；本轮不实现自动
重试、不验证服务端幂等/事务。已知刷新覆盖缺陷通过断言复现，不混作正确性通过。
成员写入等待切对象的另一OG-G02问题、成功关闭焦点、权限中断/跨路由、未知结果核对、
后台审计/真实MySQL及用户生产验收仍未完成。

```powershell
node scripts/verify-ui-phase2-teams-create-states.mjs --smoke
node scripts/verify-ui-phase2-teams-create-states.mjs
# 当前r2已存在，捕获命令会在启动前拒绝覆盖
node scripts/verify-ui-phase2-teams-create-states.mjs --capture
node --test tests/unit/ui-phase2-teams-create-states.test.mjs
```

## 收尾与审核边界

新增helper、局部CSS、永久验证/测试及本记录，同步P33规格、计划、进度、Feature Map与
运维说明。无生产导入、API/OpenAPI字段、数据库、环境变量、依赖或权限变化；后端、
Worker、Python消费方未改，无生产重启需求。未暂存、提交或部署，commit hash不适用，
工作区含前序混合实现且全局门禁未通过；本轮不重跑或推算全库现时失败数。

本轮无临时文件/日志/失败截图遗留。两套28图及清单是正式交付，历史问题包与清理受限
目录未触碰。端口58691、58872、59122、59182、59235、59276在finally关闭后独立核对。
本批只提请审阅保存中与请求失败的视觉区域；已知刷新覆盖图禁止当作通过稿。
P33整体布局、其余按钮/弹窗与完整73页/生产目标继续，不扩大任何前序批准。
