# P44 手机可授权账号目录 · 生产源码接入

2026-09-11，基线d9a28316。实施[已批准的手机目录组合](P44-MOBILE-DIRECTORY-APPROVAL.md)：标题说明、两条账号身份/角色资料及查看详情入口。按UI技能沿用C方向字体、层级、白底记录、分隔及留白；不把批准扩为筛选按钮、弹窗、桌面或整页。

## 改了什么 / 没改什么

PlatformAccountCenter.vue只在原筛选前加入管理员目录静态header，并导入PlatformAdminDirectoryMobile.css。完整script、原模板内容/事件/v-model、父子详情调用与数据读取保持；新增header只在admins分支生成，默认隐藏，只在既有signal-ledger且当前管理员导航、不超过760px时显示。

新样式只覆盖该header与其同级管理员记录容器：16px边距、22px标题、白底连续记录、蓝灰身份状态与查看入口；长邮箱按原数据换行。原比较样式、筛选折叠按钮、更新时间、摘要、导航、桌面和其他页面不变。此处未重构全局背景，实际图仍有原网格/米色上下文，不称为整页C。

原“查看详情”仍先打开移动预览，再点“打开账号详情”读取账号详情；不悄悄改成直接跳转。桌面保留直接详情。平台管理员总数仍来自全局summary，不等于当前可授权账号条数；无平台角色账号没有被排除。

## 真实回放与图册

- [修改前30图](../../output/playwright/p44-mobile-directory-implementation/baseline/index.html)
- [当前生产源码30图](../../output/playwright/p44-mobile-directory-implementation/current/index.html)
- [390px目录](../../output/playwright/p44-mobile-directory-implementation/current/390-admins-directory.png) / [长邮箱](../../output/playwright/p44-mobile-directory-implementation/current/390-admins-long.png)

三路径admins/users/permissions，四宽度390/760/761/1440。基线116项、当前134项浏览器检查；36/37个源LF指纹，新增的一项为目录CSS。每侧30PNG：管理员默认/键盘焦点/详情/长邮箱/恢复，手机额外预览；用户及权限页各默认对照。共60PNG和四个图册/清单，均为正式交付材料。

使用真实父/记录/共享预览与详情组件及生产样式，不叠加审核CSS或更换模板；基线父源码严格来自d9a28316。新验证脚本本身纳入源指纹。HTTP只拦截现有accounts/roles及既有买家详情GET；管理员每宽度7GET（初始2、详情1、长邮箱查询2、恢复2），P43/P45各1GET，零意外网络、零页面错误、无真实写入。

与已批图一致，第二条无角色账号从既有user样例明确派生，不改变全局摘要；长邮箱与三角色组合为显式测试样例。完整详情样例只属于第二条buyer，因此验证先检查第一条的真实Tab焦点，再对第二条回放完整详情，不用buyer详情冒充admin账号。P43宿主initialTab=users、P44/P45为admins，与navigation-shell-route-state.ts真实映射核对。最初宿主误选账号及页签的失败已修正并重新采集，不归因为生产问题。

## 保护范围与历史证据

逐项比较旧摘要/导航/筛选按钮/更新时间/比较区及原弹窗计算样式、内容、GET参数；桌面、P43/P45的目录样式保持。手机新增标题及边距会改变流式布局位置，不能把局部样式不变说成整屏像素完全一致。

新增精确父源码历史关联仅将本次after映射到d9a28316的before；未知源码不会被替换成已批版本，旧证据的严格指纹比较仍拒绝未知漂移。当前新目录测试直接读取真实源码。旧控件/结果/资料PNG和批准记录均保留，不重新制图或扩大批准。

三条旧业务回归原先断言父模板完全不变，现只在旧预期模板中插入精确批准header，再与当前完整模板相等比较；运行时及函数提取依然直接使用当前源码，不以历史源码替代业务验证。新增标题之外的原事件/绑定保持严格检查。当前静态合同新增CSS依赖为36源，128动作候选与24模型绑定不变。

## 复验、使用与上线

```powershell
node scripts/verify-ui-phase2-admin-mobile-directory-implementation.mjs --baseline
node scripts/verify-ui-phase2-admin-mobile-directory-implementation.mjs
node --test tests/unit/ui-phase2-admin-mobile-directory-implementation.test.mjs
node scripts/verify-ui-phase2-platform-account-contract.mjs
```

默认不写文件；需要有意重制本批正式图时追加--capture。脚本自动选择空闲端口，finally关闭浏览器/服务。没有产品新配置或环境变量，也不安装/升级依赖。

本轮不部署、不重启；线上生效需前端构建后按既有宝塔部署流程发布。API/OpenAPI、后端、Python、插件、数据库、权限与部署配置未改，因为没有改变这些生产/消费契约。全站背景与布局、剩余按钮/弹窗/状态审核、完整App与真实权限、全73页宝塔交付继续待完成。

## 验证与清理

39项定向检查、修订后的45项业务回归及815项完整相关UI回归通过；前端类型检查与Vite生产构建、73路由/153文件文档门禁、格式与diff空白检查均通过。原102包15069PNG审计源/图片漂移均为0，整页完成仍未证明。跟踪本轮验证端口53824、53871、53971、54053、54130、54219、54432，结束前复核均无监听。没有新增一次性临时文件；60PNG与图册/清单作为正式交付保留，失败回放的同名中间图已由完整成功回放覆盖，目录清单逐项检查不允许额外文件。既有用户文件/构建输出/测试样例未删除。
