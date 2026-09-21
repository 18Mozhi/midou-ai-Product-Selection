# P34 登录已失效 · 实际 Vue C 组合 r1

本包为本地隔离审核，不是生产部署或真实登录验收。权限白区的局部批准不扩展到本包。

## 展示与行为

仅原父组件 `view === 'approvals' && state === 'expired'` 时加入白色登录提示区。
“登录已失效”和“重新登录后返回当前页面。”取自现有 NavigationShell 的失效说明。
复用权限白区蓝白样式，但另有登录状态标记、标题和说明，不把401称为权限拒绝。
原生折叠详情保留原 `notice`、`requestId`，重新加载仍调用原 `load()`。
不增加登录跳转、自动认证、接口、权限、重试、数据结构或依赖；父script原文保持。
后台401仍按原状态撤下子内容，不以`!data`作为展示条件，也不宣称目录为空。

冒烟先发现测试选择器前缀误替换，已改为完整选择器匹配。随后原生Tab检查发现按钮底部
844.34375超出844高视口，中心命中底部“角色与权限”导航。本状态按钮增加
`scroll-margin-block: 100px`，使原生焦点滚动避开遮挡；不由测试主动滚动代替Tab。
共享权限CSS、已批准图和其他分支不改。新测试的CSS匹配也兼容格式化换行。

## 审核图与证据

- [手机失效默认区域](../../output/playwright/p34-expired-vue-c-r1/background-approvals-session-expired-390.png)
- [手机展开与重读焦点](../../output/playwright/p34-expired-vue-c-r1/background-approvals-session-expired-reload-focus-390.png)
- [桌面首次失效](../../output/playwright/p34-expired-vue-c-r1/initial-approvals-session-expired-1440.png)
- [截图与源哈希清单](../../output/playwright/p34-expired-vue-c-r1/evidence.json)

两个父读取接口、首次/后台、七类失败、1440×1000和390×844矩阵；新增八组401原生
Enter展开、Tab可见焦点、Enter重读，同时保留原八组403及其余检查。
截图是指定视口内区域，不宣称完整长页、全部主题或软键盘覆盖。API本地拦截，恢复阶段
使用可读取样例，不证明真实重新登录或RBAC。新组合、其他未批区域、生产和全73页仍待。

## 复现与收尾

`node scripts/verify-ui-phase2-org-approvals-expired-vue.mjs --smoke`：手机401/403八组，不写图。
默认无参数：两宽完整矩阵，不写图。`--capture`：写独占目录
`output/playwright/p34-expired-vue-c-r1`；已有目录及未知/重复/组合参数均拒绝。
`node --test tests/unit/ui-phase2-org-approvals-expired-vue.test.mjs`核对模板、脚本不变、固定
驱动、旧检查保留、源/图片哈希、矩阵及防覆盖。

本轮结果：手机冒烟8组261项、44父GET、零写入；正式56组1062项、96PNG、190源哈希，
两宽各168父GET，合计336父GET、零写入。当前与前序四文件24项定向测试全通过。
全部15个P34关联测试文件63项57通过、6失败，仍是旧signal-ledger.css/NavigationShell.vue
历史哈希门禁；不据本批通过宣称整体转绿。文档153文件、路由73/受保护60/角色6、运行文档、
本批格式与diff检查通过。已目视检查手机展开/焦点和桌面首次失效图。

既有依赖、本机随机端口、finally关闭浏览器和服务。仅本地预览/验证/审核材料，无生产源、
OpenAPI、环境、数据库或服务修改，无需重启，未部署。正式审核图保留，冒烟不写临时文件。
历史清理被拒的`p34-approvals-vue-c-r1/r2/r3`、`p34-parent-current-c-r1`等不重试删除。
旧六项历史共享源哈希失败不改预期、不跳过；工作区混合变更保留，commit hash不适用。
本轮六个验证端口49521/50955/57876/58088/58765/60856已独立确认无监听，浏览器与服务关闭。
新增六个永久文件，工作区680→686项，暂存区为空。96PNG为正式交付图保留，本轮未产生
待删临时文件；历史残留及受限清理目录原样保留。
