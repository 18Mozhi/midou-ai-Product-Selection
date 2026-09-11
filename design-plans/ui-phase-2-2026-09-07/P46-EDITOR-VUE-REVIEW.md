# P46 四步编辑 · 实际Vue审核

2026-09-11，P46-PROVIDER-EDITOR-VUE-PREVIEW-r1，基于main/c4066487当前源码。目录104图保持不变；本批继续四步编辑窗，使用当前ProviderRuntimeSurface/ProviderRegistry和既有目录审核变换，仅新增编辑审核CSS，没有生产导入。

## 图册与布局

[134图入口](../../output/playwright/p46-provider-editor-vue-preview/index.html) · [桌面基础](../../output/playwright/p46-provider-editor-vue-preview/1440-create-step-1.png) · [手机基础上部](../../output/playwright/p46-provider-editor-vue-preview/390-create-step-1.png) / [下部](../../output/playwright/p46-provider-editor-vue-preview/390-create-step-1-bottom.png) · [执行策略](../../output/playwright/p46-provider-editor-vue-preview/761-create-step-3.png) · [发布错误与禁用](../../output/playwright/p46-provider-editor-vue-preview/390-publish-errors-bottom.png) · [编辑版本冲突](../../output/playwright/p46-provider-editor-vue-preview/390-edit-conflict.png)

按frontend-design技能设计C方向：蓝色标题/身份与步骤区，白色字段区，浅灰模板条与发布摘要；桌面左步骤/右字段，手机两列步骤导航接单列字段，底部操作在窗内滚动时保持可达。原23字段按5/6/7/5分组，没有删减或新增模型、模板业务参数、草稿存储或接口。既有动态错误就近呈现，不能把空白新建的初始错误状态误称为已交互触发。

完整编辑模板与script逐字保持；共用目录助手的两处变化仅在编辑区外，沿用“操作”表头和真实重读文案。当前form仍是自建role=dialog而非原生dialog；CSS没有增加Tab循环、背景inert或窗口代次保护，不能据此宣称完整模态无障碍已完成。

## 本批证据

390px35图，760/761/1440各33图，共134PNG。新建/编辑各四步上/下部；基础错误、范围错误、六项数值错误、公开启用条款错误、五模式模板字段、保存中、依赖失败、展开关联编号、版本冲突、编辑后新建失败、步骤焦点；390px另有568px短屏上/下部。短屏两图只证明这两处组合，不代替全部字段在软键盘下可达。

444项浏览器检查、39项当前源码LF指纹、审核变换指纹和134PNG尺寸/哈希/精确清单。全部23字段模型与首个新建请求键集合严格相等；四组字段名称/顺序、控件至少44px高/16px文字、下一步验证失败停留及直接步骤跳转、默认未启用、错误/忙碌保存按钮禁用及灰色、列表在编辑时隐藏均有检查。五模板仅验证当前模式字段清单及对应样图，不扩大为所有技术默认值/字段上下限已验收。

仅使用原definition测试记录和明确新建输入（review_source、审核来源、example.test目标）。每宽度1GET、2POST和1PUT；GET返回既有25条目录，三次写入全部在浏览器拦截并返回503/409/409，没有真实来源或数据写入，也没有成功保存后的刷新验收。写请求均有原客户端幂等头；503写请求没有安全GET那样自动重试。

手机通过原记录详情的编辑入口进入，转交后只有一个编辑窗；原详情未重新设计。新建关闭和最后Escape回新建入口、关闭按钮后Tab到第一步有实测；不将这一段等同于全部焦点循环、跨页或缓存恢复。

## 真实Vue中保留的已知问题

1. 编辑请求仍包含id/version/updated_at/terms_reviewed_at，关闭编辑再新建时这些属性仍会残留在新POST；expected_version仅编辑附加，新建没有。样例409是主动供给的失败，不代表真实后端因残留字段拒绝，也未擅自改为白名单。
2. 既有到期值2027-08-07T17:00:00.000Z被slice为datetime-local的17:00；Asia/Shanghai中提交转为2027-08-07T09:00:00.000Z。显示/提交偏移在实际Vue复现，未修改日期业务语义。
3. 本批不覆盖旧保存回调关闭新窗、保存后读取失败却提示已刷新、所有字段边界、草稿归属或路由/KeepAlive迟到结果；此前PR-G03问题和PR-G01准入差异未因此关闭。

## 复验与运行边界

```powershell
node scripts/verify-ui-phase2-provider-editor-preview.mjs
node --test tests/unit/ui-phase2-provider-editor-preview.test.mjs
```

默认只验证，--capture才重制正式图册；仅本地审核CLI参数，不是生产环境配置。复用依赖，Vite随机回环端口、关闭代理，未登记API/外部请求均失败关闭。首次宿主CSS路径的Windows反斜杠转义错误已修正，完整回放通过；视觉复核发现审核主按钮规则覆盖禁用色后，仅修正本批footer disabled选择器并补严格计算颜色断言。原失败/中间同名图片已被最终完整134图覆盖，未改原目录图册。

新增4项永久合同通过，包含编辑模板/script/23模型保持、当前源图库存、三次拒绝请求及原时区/残留边界、生产隔离。实际编辑通过Vite编译/浏览器回放；生产构建输入未改，不重复旧生产构建。API/OpenAPI、数据库、权限、.env/配置、依赖、后端/Python/插件和部署脚本均未改，配套运行契约不适用；本批未部署、无生产重启要求。

最终843项相关UI/账号/响应式回归通过，失败0；73路由/60受保护/6角色与153文件文档门禁、格式及diff空白检查通过。

134PNG、HTML/JSON为正式交付保留，无一次性文件或依赖；51281、51349、51612已检查无监听，当前验证器进程无残留。所有编辑组合继续待审，目录/其他页批准不扩展；完整编辑交互、原移动详情C重设计、真实授权/持久化和全73页宝塔交付仍未完成。
