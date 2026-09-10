# P36 创建组合 · 原父子 Vue 与 C 审核样式

## 当前结果与批准边界

从干净 `main/af056d31` 继续。先核对获批项：P36 手机筛选、P16 布局、P31 控件/延期、P32 恢复、P34 已批局部均已有 Vue 实施，不重复计数。本批推进 P36 尚待审的创建组合，版本 `P36-CREATE-VUE-PREVIEW-r1`。

[32 张实际 Vue 组合图](../../output/playwright/p36-create-vue-preview/index.html) · [原始证据](../../output/playwright/p36-create-vue-preview/evidence.json) · [手机默认](../../output/playwright/p36-create-vue-preview/390-default.png) · [桌面默认](../../output/playwright/p36-create-vue-preview/1440-default.png)

创建组合仍待用户审核；只提交手机默认组合问题，不把已批筛选扩为创建批准，不把未回复算通过。这是原父子脚本和原字段约束配合审核模板/CSS的结果，不是生产页面已启用 C 创建表单。

## 构图与实际源码

采用既有 org-token-fields 图稿中的字段顺序：名称、期限与四个快捷值、四项读取范围、创建原因、提交。桌面名称/期限并列，权限双列；核对摘要位于右侧。1100px 以下摘要移至底部，760px 以下字段与权限单列。圆角白色表单、明确字段边界和蓝色主按钮替代旧账页表单外观。不是把旧布局仅换色。

`scripts/lib/ui-phase2-token-create-preview.mjs` 用 Vue 模板 AST 定位唯一创建 form，保留全部原节点、directive、handler、原生约束及绑定表达式，仅重排原节点、增加两个容器、替换页眉 CREATE 文案。完整 scriptSetup 逐字保留。父 OrganizationAdminCenter 无修改，实际发起初次读取、创建 POST、失败提示、成功后重读与清空草稿。

`implementation/token-create-preview.css` 仅由审核宿主加载，尚未加入生产 import。审核宿主把工作台改为上下排列，为创建区提供完整宽度；这不是已批准的整页/列表布局。截图只裁出创建表单。父失败提示仍在原表单外，本批未把它搬入字段，也没有伪造就地服务错误。

技能：frontend-design 用于原图与实际节点顺序、分区、字重、控件边界和移动排列；Playwright 复用仓库现有 Vite/Chromium 验证并出图，无安装依赖。原图片包的 Token 概念与总览仅用于定位结构，当前外观以用户已选 C 及 P36 字段稿为准。

## 验证范围

390 / 760 / 761 / 1440 四宽度，152 项登记检查，8 状态 × 4 宽度 = 32 PNG：默认、缺少读取范围、无效期限、全选四范围、名称焦点、提交等待、失败后草稿、模拟成功清空。

- 原 name required/120、reason required/500、ttl required/1–365 不变；0、366、小数、空值由实际浏览器拦截，不发 POST。未加 novalidate、自定义服务端规则或名称空白前端校验。
- 四 scope 默认不选，缺少时原就地错误显示；选择后清除，30/90/180/365 快捷值保持原逻辑。
- DOM/完整 Tab 顺序与视觉一致；文本字段、按钮、scope label 触控 ≥44px、字号 ≥16px，无页面横向溢出。
- 等待期间仅原提交按钮禁用，字段仍可编辑；500 后保留后续草稿，没有明文；再手动提交成功后清名称/原因/scope、期限恢复90。
- 两次 POST 保持精确 path/name/scopes/ttl_days/reason、trim 与幂等键。首次两 GET，模拟成功再两 GET。所有 HTTP 由测试拦截器控制；没有真实请求或数据库写入。模拟 secret 明确为 `SYNTHETIC_NOT_A_TOKEN_FOR_UI_REVIEW`，不是有效凭据，不触碰系统剪贴板。
- 35 项已加载源码/辅助输入指纹、变换后模板哈希、32 PNG 指纹单独绑定。原已批筛选 PNG 与生产 import 未改。

首次目检发现旧 signal-ledger.css 的 `[class*="-create"]` 会给普通容器着主色并加粗，虽行为检查通过却产生橙红底。只将本批两个新容器改为 `p36-form-*`，清除审核区继承的旧间距/边框，并增加真实计算颜色/字重检查。未修改共享生产选择器，不把初轮图保留为最终证据。已在同一路径重拍全部32图。

## 复用与收尾

```powershell
node scripts/verify-ui-phase2-token-create-preview.mjs
node --test tests/unit/ui-phase2-token-create-preview.test.mjs
# 只有明确需要更新本批图片时运行：
node scripts/verify-ui-phase2-token-create-preview.mjs --capture
```

无参数运行真实回归但不写图片；源/图完整性由单测核对。验证器监听回环随机端口、关闭后端代理、拒绝未拦截 API，finally 清理浏览器与 Vite。端口52831/52996均已结束。32PNG与HTML/JSON为正式交付，未创建一次性文件；没有删除历史材料。

没有生产 Vue/CSS、API/OpenAPI、后端/Worker/Python、权限、数据库、环境、依赖、部署或重启变化。未改应用源码，不重复前端生产构建。本批临时审核服务不是生产运行能力。

创建组合与按钮状态待审；父失败区域的新 C、真实权限/限额/幂等/审计、真实一次性密钥生命周期、缓存/跨范围/迟到写入、长文/短屏/软键盘/主题密度和整页仍须继续。全73页实际C接入、真实验收与宝塔签收目标保持，不能用本批32图或152检查替代完整交付。

最终验证：4项新增定向单测、657项相关UI/归属/组件边界测试全部通过；73路由与153必需文档、格式门、脚本语法及diff空白检查通过。原102图包/15069PNG主图审计零来源与图片漂移，本批32图独立，不增加已批准页面计数。无需生产重启，所有本轮浏览器/服务已关闭。
