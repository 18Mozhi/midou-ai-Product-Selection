# P44 管理员详情 · 实际Vue状态审核

2026-09-11，P44-ADMIN-DETAIL-VUE-PREVIEW-r1，基于3ad9030f当前源码。补充管理员测试样例的详情组合，不沿用此前P44入口回放中的buyer详情来证明管理员身份。全部为隔离审核，不是生产授权或上线验收。

## 正式图册与设计

[94图入口](../../output/playwright/p44-admin-detail-vue-preview/index.html) · [桌面默认](../../output/playwright/p44-admin-detail-vue-preview/1440-normal-default.png) · [手机上部](../../output/playwright/p44-admin-detail-vue-preview/390-normal-default.png) / [手机底部](../../output/playwright/p44-admin-detail-vue-preview/390-normal-actions.png) · [停用账号底部](../../output/playwright/p44-admin-detail-vue-preview/390-disabled-actions.png)

按frontend-design技能沿用C方向：蓝色邮箱身份区、白色四项事实摘要、组织与角色/登录会话/平台角色分区和底部访问操作。桌面左右分区，手机单列滚动；真实管理员入口重新挂载当前父/详情Vue，不复制旧图。默认样例没有组织关系或会话，因此以明确空状态展示，不添加虚构记录。

视觉复核发现共用旧审核CSS将“恢复登录”也染成红色。本批独立助手仅按原按钮文案已有的selected.status !== active条件追加呈现class，独立CSS把未禁用恢复按钮设为蓝底白字；停用/改密/撤销原红色和禁用灰色保持。完整script、事件、原disabled条件和接口均不变。旧P43/P44审核助手、CSS及全部历史图不覆盖，也没有生产导入。

## 覆盖与样例来源

390/760/761/1440四宽度分别26/24/22/22图。八种样例均有默认与底部：原管理员、仅需改密、仅需MFA、两者均需、停用、三平台角色、无平台角色、长邮箱；原样例另有首次等待、四项事实、会话/平台角色分区、关闭焦点、读取失败和重试等待，手机另有原预览/完整UUID，390px另有568px短屏上下部。

管理员样例从既有m06-01-platform-accounts.spec.ts的“administrator write failures stay inside their active dialogs”详情对象按AST精确抽取，id与overview.admins[0]一致。原两安全标记为false、组织与会话为空。其余七种为明确合成变体：只改变已有安全标记、账号状态、selected.roles或邮箱；列表与详情身份/状态同时保持一致，全局summary不变。没有混入买家详情，未改变原E2E文件或编造新接口字段。

747项浏览器检查，每宽度26GET：8账号、8角色、10同一管理员详情，含一次500失败及原重试。检查邮箱/弹窗可访问名称匹配所选管理员、两安全标记的OR结果、零关系/零会话说明、selected.roles对应授撤按钮、停用后的角色及加入组织禁用、恢复/停用原文案及颜色、失败隐藏旧事实、重试回到同一管理员、Escape保持admins路由并关闭全部已开详情层。所有请求本地拦截，无POST或外部请求。

角色来自所选列表记录，这是当前组件的真实数据路径；不是通过按钮反推后端权限。自我停用/撤销超级管理员、真实角色目录一致性、状态恢复、会话/改密/加入组织提交均没有执行，不能把按钮可见或禁用等同于真实授权允许/拒绝。详情样例为空，也不替代非空关系、非空会话或全部写入生命周期的验收。

## 验证与复验

46项当前源码LF指纹、两份审核变换指纹、94PNG指纹及精确文件清单。新增4项定向与原整页5项合同共9项通过；只剔除精确新增的呈现class后逐项比对所有原指令、表达式和控件属性，完整script一致。负向测试最初改到了同名emit类型声明，已修正为破坏实际模板事件锚点并验证失败关闭，没有放宽合同。

```powershell
node scripts/verify-ui-phase2-admin-detail-preview.mjs
node --test tests/unit/ui-phase2-admin-detail-preview.test.mjs tests/unit/ui-phase2-admin-page-assembly-preview.test.mjs
```

默认只复验，需有意重制本批图时追加--capture。重用当前依赖，动态空闲端口，仅本地审核宿主，finally关闭浏览器/Vite。最初94图已经由恢复颜色修订后的完整回放覆盖；保留最终清单，不保留一次性失败图。

831项完整相关UI回归通过；73路由/60受保护路由/6角色、153文件文档门禁、格式与diff空白检查通过。生产代码、路由、API/OpenAPI、数据库、权限、配置/.env、依赖、后端/Python/插件和部署脚本未改；相关运行配套不适用。本批未部署、无生产重启要求；生产构建输入未变，不重复原已通过构建，审核模板/CSS已经由Vite编译和实际浏览器验证。

94PNG、图册及清单为正式交付保留，无一次性临时文件。61017、61282、61448端口均已核对无监听。当前默认详情布局和新增恢复颜色待审；此前目录、角色资料、创建、焦点或整页的局部批准不扩展。全73页设计/实现、完整App/真实权限与宝塔交付继续，未声明整体完成。
