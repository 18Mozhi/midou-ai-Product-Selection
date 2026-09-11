# P44 精确断点与键盘焦点 · 独立补充审核

2026-09-11，基于4bbf1193的当前生产Vue及整页审核r2。仅补充1200/1201px边界与六个焦点目标；此前手机角色资料组合的批准保持原范围。整体布局、其他未答区域和本批新图仍待审。

## 图册与设计修订

- [修订后16图](../../output/playwright/p44-page-boundary-vue-preview/index.html)
- [修订前16图](../../output/playwright/p44-page-boundary-vue-baseline/index.html)
- [1200px上方汇总](../../output/playwright/p44-page-boundary-vue-preview/1200-default-top.png) / [1201px左侧汇总](../../output/playwright/p44-page-boundary-vue-preview/1201-default-top.png)
- [创建焦点](../../output/playwright/p44-page-boundary-vue-preview/1201-keyboard-create.png) / [导航焦点](../../output/playwright/p44-page-boundary-vue-preview/1201-keyboard-navigation.png) / [重置焦点](../../output/playwright/p44-page-boundary-vue-preview/1200-keyboard-reset.png)

每宽度8张：默认整页、首屏、创建、当前导航、邮箱、只看差异、左侧角色、搜索后的重置。前后共32张。整页布局沿用上一批，不改变1200px断点；前后两宽度的默认整页和首屏4张PNG哈希完全一致。

发现全局signal-ledger.css的html/data-design选择器覆盖低优先级审核焦点：创建及邮箱仍为深色2px，导航白色但只有2px。按frontend-design技能统一C方向焦点，在独立admin-page-boundary-preview.css中增加高限定规则：白色区域3px蓝框，蓝底导航/复选框3px白框；仅审核宿主添加p44-boundary标记。原72图、原整页审核CSS及所有生产文件均未改变。

原生Tab滚动还使1200px重置、1201px复选框的焦点轮廓靠近视口底边；补充稿增加8px纵向scroll-margin，不改变组件尺寸或布局。六目标两宽度均验证原生Tab可达、focus-visible、3px实线、颜色和轮廓留白。指标只证明所列目标，不是完整无障碍或所有控件验收。矩形边界检查允许1px小数取整误差；修订后另严格检查至少7px焦点外沿空间。

## 事实、验证与限制

复用当前生产父/详情Vue及既有审核变换，旧5项合同测试验证完整script、指令、插值和原控件不变。新增3项测试锁定前后清单、源指纹、默认像素一致、已知旧稿缺口和修订范围。前后分别44/45源指纹、238/274项浏览器检查，8项定向通过。基线检查不把未符合设计的六处颜色/粗细和两处轮廓边界记录当作通过项；修订稿新增严格断言。

浏览器观测在原生CSS有限时长过渡结束后读取；初版过早读取了过渡中的颜色，已修正采样时机并完整重制两批。32张图及清单对应最终脚本。首轮测试把CSS伪类误识别为属性，已限定到声明块，重新通过；没有放宽实际颜色或原合同检查。

每种版本、每个宽度沿用原19个拦截GET（10 accounts/8 roles/1 detail）。实际回放目录筛选/清除、6/0/3比较与重置、详情打开/Escape、创建默认/取消、失败和空状态，但本批仅对所列8状态出图。Tab穿过其他控件不等于验证其全部交互。搜索样例只用于启用重置，未点击写入；焦点检查不改URL或请求数量。所有数据为既有测试样例及明确派生的无角色/长文本/空状态，无真实权限、账号写入、数据库或审计结论。

原旧矩阵保留但没有独立过期说明的缺口仍按现状记录；不以焦点修订掩盖数据状态问题。NavigationShell/完整App、全部弹窗、其他宽度和主题/密度均未在本批扩大验收。

## 复验与运维交接

```powershell
node scripts/verify-ui-phase2-admin-page-boundary-preview.mjs --baseline
node scripts/verify-ui-phase2-admin-page-boundary-preview.mjs
node --test tests/unit/ui-phase2-admin-page-boundary-preview.test.mjs tests/unit/ui-phase2-admin-page-assembly-preview.test.mjs
```

默认只复验；需有意重制对应版本正式图时追加--capture。--baseline只控制本地审核CSS，不是生产开关。复用现有依赖，自动探测空闲本地端口；finally关闭浏览器/Vite。没有新增生产路由、API字段、配置或依赖；OpenAPI、.env、后端、Python、插件、数据库与权限均不适用。没有部署或重启，上一轮生产构建仍覆盖未变的生产源码；实际补充模板/CSS已由Vite编译并运行。

823项完整相关UI回归通过；73路由/60受保护路由/6角色、153文件文档门禁、格式和diff空白检查通过。32PNG、两份图册和两份清单是正式交付保留；没有一次性临时文件。跟踪本轮57686、57837、57883、57966、58025、58115、58208、58249端口，收尾确认全部无监听。

## 待确认

请核对补充稿的蓝色/白色焦点与留白；仅确认这六类焦点的呈现，不代表整页、所有按钮或生产验收。上轮整体编排问题继续待答，不重复提交、不推定通过。73页完整重新设计、全状态审图、生产接入及宝塔验收继续。
