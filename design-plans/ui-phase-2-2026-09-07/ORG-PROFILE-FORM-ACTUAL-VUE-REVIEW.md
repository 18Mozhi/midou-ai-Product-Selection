# 组织资料 · 校验与保存冲突 r3

2026-09-13，待审核，不扩大组织概览r2、刷新/读取状态或其他区域批准。

## 本批交付

[r3 22张图册](../../output/playwright/org-profile-form-vue-c-r3/index.html) / [机器证据](../../output/playwright/org-profile-form-vue-c-r3/evidence.json)：390/1440、旧读取状态提案/新表单提案，共4组190检查、180来源SHA。24个本地请求中20 GET、4 PATCH；PATCH全部由浏览器路由拦截，返回原M06-01 409样例，未发往生产。

实际App/Router/NavigationShell/OrganizationAdminCenter。依据总纲4.1、组件原生约束、submit函数、api-client以及 `tests/e2e/m06-01-organization-admin.spec.ts` 原版本冲突对象。guard/profile/summary/workspaces及409响应均精确提取现有样例，不编造字段、权限或成功响应。

## 字段与按钮

| 区域 | 核对与图证 |
| --- | --- |
| 名称必填 | [手机](../../output/playwright/org-profile-form-vue-c-r3/review-390-name-required.png)，保留maxlength120；灰色原名称是原有placeholder，不是当前输入值 |
| 时区必填 | [手机](../../output/playwright/org-profile-form-vue-c-r3/review-390-timezone-required.png)，保留maxlength64 |
| 变更原因必填 | [手机](../../output/playwright/org-profile-form-vue-c-r3/review-390-reason-required.png)，保留maxlength500 |
| Logo HTTPS | [手机](../../output/playwright/org-profile-form-vue-c-r3/review-390-logo-https.png)，保留原type/url/pattern/max2048及原自定义提示；允许留空 |
| 保留天数 | [低于30](../../output/playwright/org-profile-form-vue-c-r3/review-390-retention-low.png) / [高于3650](../../output/playwright/org-profile-form-vue-c-r3/review-390-retention-high.png)，直接读取原min/max，不新增规则 |
| 默认工作区 | 原required、选项和内部ID不变；原样例已有有效选项，没有伪造用户不能选中的空选项交互 |
| 保存等待 | [手机](../../output/playwright/org-profile-form-vue-c-r3/review-390-saving.png)，原按钮禁用文案，新增自身焦点到表单标题，不重复提交 |
| 版本冲突 | [手机反馈](../../output/playwright/org-profile-form-vue-c-r3/review-390-conflict.png) / [保留草稿](../../output/playwright/org-profile-form-vue-c-r3/review-390-draft-after-conflict.png)，不自动重提/重读，不冒充保存成功 |

新增可见行内错误、aria-invalid、错误/帮助文字关联、独立标题标签及必要的红色状态。错误信息读取原生ValidityState/validationMessage，必填和上下界仅中文说明，未修改ValidityState、setCustomValidity、novalidate或preventDefault。原Logo invalid/input处理不变。

表单与旧稿逐字段对照原native标签，required/maxlength/min/max/pattern/v-model等完整相同。脚本移除本批展示/焦点函数后逐字等于上一读取状态稿；表单外仅将两处“本次读取追踪”更名为“本次操作追踪”，避免保存冲突被错称为读取。表单提交包装保持原path/PATCH/form/expected_version，不改变原submit和后续逻辑。

## 修复与验证过程

1. 提示层首轮使用捕获阶段微任务，出现改正后的输入再次变空；实际DOM记录value空、valid=false。修复为input/change冒泡观察，invalid仍捕获，展示同步延后到0ms任务，在原生及Vue处理完成后读取，永不写字段value/model；回填检查逐项通过，失联节点不再写提示。
2. 起始模板字符串嵌套语法错误在浏览器启动前修复，未涉及生产。
3. r1/r2原生校验气泡遮挡局部截图；r2 Escape仍有残影。r3先验证原生错误焦点，再以真实Tab离开字段，等待250ms原生提示淡出，截图展示持续的行内错误，并加8px留白。此250ms仅截图驱动等待，不是产品延迟/超时配置；字段图**不是仍聚焦的错误状态图**。
4. r3双端smoke114检查，完整新旧4组190检查。6类无效输入均零PATCH、仍由浏览器聚焦错误字段；改正后value正确、valid=true、ARIA错误清除。
5. 每组唯一PATCH完整等于原资料字段+expected_version3，幂等/request头仅记录是否存在。等待禁用期间重复Enter不新增请求；409后保留名称和原因、state=ready、按钮可用，summary不重读，不自动PATCH重试。
6. 旧稿双端保存焦点落BODY；新稿为H3。包装函数按焦点所属×连接×inert 8组合验证只跟随自身提交按钮，且原submit参数/返回值不变。已检查生成的表单焦点图；不代表所有滚动位置/视口的全量焦点几何验收。
7. 最终本批5项、组织读取4项、刷新4项、组织r2 3项、平台壳4项、成员/P16 4项、访问状态5项、M02-03 9项，共38/38通过。原三组组织包与平台/成员包来源、图片指纹仍通过，本批未覆盖旧包。
8. route-artifacts 73路由、文档153必需文件、runtime-docs、Prettier及定向diff检查通过，暂存区为空。

## 使用与未覆盖

`node scripts/verify-ui-phase2-org-profile-form-vue-c.mjs --smoke` 双端无图；无参数新旧四组无图；`--capture` 独占当前r3目录，已有则拒绝覆盖。

r1/r2各22图与manifest作为遮挡反例保留；其中来源对应旧版本，不再宣称与当前driver一致。r3是当前22图审核入口。所有native字段交互仍有原生校验气泡；本批没有关闭浏览器校验。

未验证真实保存、数据库版本更新、审计/outbox、成功后重读失败、并发修改安全或其他HTTP保存失败；没有提交成功样例，因此不能声称真实保存/审计完成。主题偏好仍本地500回退。未改变成功刷新覆盖草稿的现有策略，该产品决策仍待用户答复；不修改依赖/API/OpenAPI/env/持久化格式/权限。

使用frontend-design明确错误层级与等待样式，fixing-accessibility关联字段错误并核对原生焦点。生产Vue未编辑，无生产重启或部署。

## 收尾

本轮创建3个版本共66张永久审核/反例图，无一次性临时文件；Vite/Chromium均finally关闭。用过端口62706、62790、62841、63099、63126、63354、63376、63536、63594、63618，最终监听数量为0。

旧清理受阻目录仍保留，本轮不绕过删除限制：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

起点main/af239b08b69f7d97cd0372f9840a70009eeef0c7、538条既有改动。只追加当前审核材料，不暂存其他修改。未重跑/推算全库，上一1499/1352/147仍为历史快照；全73页与发布门未完成，混合工作区未解除，不提交部署，commit hash不适用。
