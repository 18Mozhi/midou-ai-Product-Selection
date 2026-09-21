# C 成员导航与创建选品 · 实际 Vue r3

2026-09-13；main / af239b08。开始时508项既有变更、暂存区为空；本批只新增审核宿主、
局部CSS、永久测试与图证，不修改生产业务源码。全73页目标保持开放。
用户再次确认P47手机“尚无来源/筛选无结果”两个区域通过，既有实施与批准范围保持；
不能外推为本批P16横向阶段组合或全局导航通过。

## 图稿与范围

[完整48图](../../output/playwright/shell-journey-vue-c-r3/index.html) ·
[机器证据](../../output/playwright/shell-journey-vue-c-r3/evidence.json)

实际App/Router/NavigationShell/SelectionJourney，真实入口 `/opportunities/start`。
未变换基线390/1440，C审核390/840/841/1440；包括输入、未选候选、五门通过、逐项缺失、
手机导航打开。6张基线图、42张提案图；不是旧模拟导航组合图，也不是生产服务器截图。
frontend-design用于蓝白导航与水平阶段布局；fixing-accessibility用于原生菜单焦点、
底栏可达性和受限采纳状态，不引入新依赖。

P16生产仍为原纵向阶段布局。本提案改为水平四阶段，大容器内候选/决策并排；手机底栏
按原授权项实际数量等分，不补不存在的权限入口，二级页只突出“更多”，去掉旧荧光边。
全局壳仍使用上一平台提案，新增移动端当前项指示外完整script/template与之严格一致。
生产路由、菜单条件、授权投影、请求、KeepAlive、采纳五门、观察/驳回规则均未改。

## 实际验证

- 样例从原 `tests/e2e/ui-phase2-journey-contracts.spec.ts` 经AST提取fixture/qualify/guard，
  同一组织与工作区、普通成员原三项capability、仅一项授权菜单，不虚构角色并集或组织名。
- 原两个候选明确选择后才启用合格采纳；评分/市场/竞争/成本/风险逐一设false，保持
  aggregate为true，均显示4/5并禁用采纳。此为原UI2-J07条件，不修改后端业务规则。
- 每次重开读取一次保存的旅程ID，共六次；菜单披露开关不改候选事实与决策输入草稿，
  Escape回到原触发按钮。没有验证离开真实路由后的草稿留存，不挪用旧模拟证据。
- 底部“开始下一次”实际命中不被导航遮挡；首屏内容与导航几何、横向溢出、原请求均检查。
  全部120个本地GET，无写请求、请求体、意外外网或页面运行错误；未执行创建/保存。
- r1：6组240检查48图，目检发现旧荧光强调线；r2去线后6组242检查48图，但手机质量门
  局部截图混入固定底栏。两版本原图/清单保留为迭代证据，不作当前审核入口。
- r3只调整截图：局部区居中并以顶/底命中检查确保无固定栏遮挡，生产与提案CSS均不改。
  最终6组242检查48图，166源指纹（含递归CSS），图像SHA/尺寸与所有来源有永久单测绑定。
  已目检桌面输入/合格组合、手机输入/成本缺失区域；具体组合待用户审核。
- 最小4项单测、最终22项关联（本批4+平台4+访问状态5+M02-03原9）全部通过。
  上一平台177来源/18图和访问163来源/84图仍原值一致。没有重跑或推算全库结果。
  `verify:docs`（73路由、153必需文件）、`verify:runtime-docs`、本批源码格式与diff检查通过。
  最近全库仍是1478项1309过169失败的历史快照，不能用局部通过替代发布门。

## 使用与交付

```powershell
node --test tests/unit/ui-phase2-shell-journey-vue.test.mjs
node scripts/verify-ui-phase2-shell-journey-vue-c.mjs --smoke
node scripts/verify-ui-phase2-shell-journey-vue-c.mjs
```

无参数完整回放不出图；smoke双端输入核对。`--capture`独占版本目录，当前r3已存在会
拒绝覆盖。新设计需另建版本；可调整implementation/shell-journey-vue-c.css或本批helper，
不得改旧图/旧哈希制造一致。OpenAPI、API、env、配置、权限、数据结构与依赖不涉及，
不需要生产重启。本批没有提交或部署；commit hash不适用（全库门失败、工作树混合）。

所有本批Vite/Chromium已关闭；最终54026/54060及r2的53514/53545无监听。新图、脚本、
测试和报告是审核交付物，不是临时测试垃圾。旧两项清理阻塞不重试绕过、不声称删除：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

尚未覆盖真实权限/采集/保存、AccountShell、发现/主题弹窗、组织ready装配、全部按钮和
全部73页生产验收；旧局部批准保持，新成员组合待审。
