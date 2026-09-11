# P44 手机同角色结果 · 生产源码接入

2026-09-11。接续67cb00f3的比较控件，实施已批准的[无差异结果](P44-MOBILE-NO-DIFFERENCE-APPROVAL.md)与[同角色显示全部](P44-MOBILE-SAME-ROLE-ALL-APPROVAL.md)。UI技能延续C方向，原批准PNG不重写；分组、搜索无结果、角色资料及整页不借此扩大批准。

## 实际改动与范围

PlatformRoleComparison.vue仅在根section增加展示class绑定：双方角色存在、代码相同、没有搜索/分组条件且不持久化比较时启用。两处真实父调用已核对：管理员比较不持久化，权限页明确persist-selection=true。此标记不决定允许/拒绝动作；完整script、原模板内容、按钮、v-model、返回事实和接口保持。

PlatformAdminComparisonMobile.css保留全部已接入控件规则，新增同角色结果规则，限定既有C标记、账号管理容器和不超过760px。数量提示为浅灰带，空结果为浅灰左边线说明，显示全部为白色单列能力事实及逐条分隔。名称、分组、拥有/无和差异原样输出。搜索、分组、不同角色、P45、桌面、上方资料不接入这些规则。390px是批准图宽度，760px是实现断点，不推定其他宽度获批。

外围和根容器仍可能呈现旧主题，不能把局部接入图称为整页C；本批没有遮掉未重构区域。角色资料在本轮另获局部批准，但尚未接入生产，见独立批准记录。

## 图册与真实回放

- [基线48图](../../output/playwright/p44-mobile-results-implementation/baseline/index.html)：精确67cb00f3比较Vue与手机CSS。
- [当前48图](../../output/playwright/p44-mobile-results-implementation/current/index.html)：当前生产组件/CSS，无审核模板或样式覆盖。
- [390px无差异](../../output/playwright/p44-mobile-results-implementation/current/390-admins-same-role-empty.png) / [390px显示全部](../../output/playwright/p44-mobile-results-implementation/current/390-admins-same-role-all.png)。本地实际Vue加拦截HTTP样例，未部署。

两路径、390/760/761/1440四宽度，前后各48PNG，共96PNG及两图册/两清单。每组合回放同角色空结果→显示全部3项→搜索0项→清空恢复3项→平台治理分组1项→重置6项。此处分组1项为同一运营角色，不能混同先前运营对安全的分组2项审核图。

基线148项、当前234项浏览器检查，前后各36源LF指纹。P44每宽度2GET且比较不写URL；P45保留URL及角色重读，每宽度7GET。只拦截原accounts/roles的GET，意外网络/错误均为0，无真实写入。旧控件、资料和未接入状态的计算样式与基线比较，展示class另覆盖48种角色存在/同异/筛选/持久化组合。

初次读取落在过渡起点：共享减少动态效果规则仍设0.01ms全属性过渡。验证先触发布局并等待稳定后再断言，不改变生产动画规则或降低颜色断言。基线处理Vue外部CSS查询后缀，并核对浏览器实际注入的CSS修订，不能只登记旧哈希。焦点检查真实Tab及稳定后的几何/样式，不宣称原生焦点PNG跨浏览器逐像素一致。

## 历史来源、复验与使用

新增精确67cb00f3来源关联，只登记比较Vue和手机CSS的before/after SHA。既有P39–P44图据此核对历史来源，未知修订仍失败关闭；当前结果回归直接读取真实文件。静态合同增加第五项明确Vue修订，仍检查35源/128候选/24模型。原图、制图时状态和批准边界均保留。

```powershell
node scripts/verify-ui-phase2-platform-account-contract.mjs
node --test tests/unit/ui-phase2-admin-mobile-results-implementation.test.mjs
node scripts/verify-ui-phase2-admin-mobile-results-implementation.mjs --baseline
node scripts/verify-ui-phase2-admin-mobile-results-implementation.mjs
```

默认不写图；有意重制本批正式图时在后两条追加--capture。脚本使用空闲本地端口并在finally关闭浏览器/服务，不连接生产、不安装依赖。

## 收尾与未覆盖

32项直接检查、806项相关UI回归、前端类型检查与Vite生产构建通过；角色资料批准记录新增的两项定向检查另行通过。文档门禁（73路由、153必需文件）、格式门禁及diff空白检查通过。已核对本轮20个验证端口无监听，无新增临时验证文件；96PNG和图册/清单为正式交付物保留，既有构建输出按项目用途保留。原102包15069PNG源/图片漂移为0，未重新制图或扩大原批准。

线上生效需重新构建前端并经既定宝塔部署流程发布；本轮不部署、不重启。没有新增配置、环境变量、依赖、API/OpenAPI、数据库或权限规则；后端、Python、插件、部署配置不涉及此次样式链。完整App、其他主题密度、真实权限、其他字段/按钮/弹窗、整页及全73页宝塔交付仍未完成。
