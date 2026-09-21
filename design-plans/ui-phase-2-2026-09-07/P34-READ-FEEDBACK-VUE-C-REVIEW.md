# P34 其余读取反馈 · 实际 Vue C 组合 r1

本轮补齐当前七类父读取矩阵中尚未采用C反馈的32组：首次503/网络/409，以及后台
500/503/409/429/网络失败。旧权限/登录预览及已批首次500/429分支不改。
本包是本地隔离设计与交互证据，不是生产接入、真实权限或整页批准。

## 展示和行为

实际 `OrganizationAdminCenter.vue` 的整个script保持原文，只在审批页加入后置展示分支：
原blocked/conflict代表子内容未展示；原ready/empty且noticeKind=error代表保留内容。
首次状态使用现有“组织数据暂不可用”或“数据版本已变化”，说明内容未显示不代表目录为空。
后台状态使用“审批内容未能更新”，明确仍显示上次内容，只提示使用原页头“刷新数据”。
首次仅保留原“重新加载”调用load，后台不增加按钮，不改变原background读取方式。
原notice和requestId用原生details展示，真实网络说明、409覆盖提示与编号均逐项核对。
既有浅蓝提示/白区CSS按局部分支复用，原重复状态隐藏；恢复按钮增加100px焦点滚动留白，
与前一批失效反馈已证实的底部导航遮挡问题一致。没有全局样式、权限、重试或业务规则修改。

## 图与审阅范围

- [手机首次网络失败/重读焦点](../../output/playwright/p34-read-feedback-vue-c-r1/initial-approvals-network-unavailable-reload-focus-390.png)
- [手机后台网络失败/展开详情及保留内容](../../output/playwright/p34-read-feedback-vue-c-r1/background-approvals-network-unavailable-details-390.png)
- [手机后台429默认反馈](../../output/playwright/p34-read-feedback-vue-c-r1/background-approvals-rate-limited-390.png)
- [桌面首次409反馈](../../output/playwright/p34-read-feedback-vue-c-r1/initial-approvals-version-conflict-1440.png)
- [完整160图、194源哈希与检查清单](../../output/playwright/p34-read-feedback-vue-c-r1/evidence.json)

截图为1440×1000/390×844视口区域，不是完整长页。详情截图可能裁到上方页头，不据此
申请页头批准。键盘恢复焦点图单独保留，以可视区域和中心命中检查排除导航遮挡。
新图待审；既有局部批准不扩展到整个160图包或其他状态。所有API本地拦截，409属于合成
错误分类样例，不新增真实API返回约定；未覆盖真实断网、登录、RBAC、软键盘、全部主题、
跨路由/请求竞态及生产验收。全73页C重构目标保持开放。

## 验证与复现

`node scripts/verify-ui-phase2-org-approvals-read-feedback-vue.mjs --smoke`：手机20组，571检查，
128父GET零写入，不写图。无参数运行完整矩阵、不写图；`--capture`写独占
`output/playwright/p34-read-feedback-vue-c-r1`，已有目录、未知/重复/组合参数均启动前拒绝。
固定上一批驱动哈希，保留其全部check表达式、请求/重试样例及56场景结果；新图不覆盖旧图。
正式56组1606检查、160PNG、194源哈希，两宽各168父GET合计336，零写入和页面异常。
新增32组原生Enter展开、首次Tab到重读/后台Shift+Tab回原刷新、Enter恢复；详情不触发读取。
`node --test tests/unit/ui-phase2-org-approvals-read-feedback-vue.test.mjs`核对模板/脚本不变、
旧驱动断言、源与图片哈希、矩阵和防覆盖。

本批与前两批3文件17项定向测试全通过；全部16个P34关联文件68项62通过、6失败，仍为
既有signal-ledger.css/NavigationShell.vue历史源哈希门禁，不修改预期或跳过。
文档153文件、路由73/受保护60/角色6、运行文档、本批格式、diff检查通过。
手机首次网络重读焦点、后台网络展开/保留内容已目视检查。另核对首次加载仍是原410px
居中留白/单行提示，尚未细化C加载区域，作为下一项；不以本批覆盖代表整页完成。

## 收尾

仅永久预览脚本/局部CSS、验证和审核资料，不改生产代码/API/OpenAPI/env/数据库/依赖。
无需重启、未部署。正式160PNG为用户要求的交付图保留；冒烟不写临时文件。
本机随机端口服务与浏览器finally关闭，端口50852/52000收尾已独立确认无监听。
历史清理被拒目录（含p34-approvals-vue-c-r1/r2/r3、p34-parent-current-c-r1）保持不动。
混合工作区和历史失败保留，不擅自暂存或提交，commit hash不适用。
本轮新增六个永久文件，工作区686→692项，暂存区为空，无本轮待删临时文件。
