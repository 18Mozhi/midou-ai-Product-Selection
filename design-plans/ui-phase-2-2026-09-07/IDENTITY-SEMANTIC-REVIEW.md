# P01–P09 身份与入驻逐页审核入口

状态：C方向已选，具体页面待审。本轮是源码语义与既有图稿对应，不是新页面上线，也不重复制图。基线 `43749fc3`。

## 设计依据与范围

- 审核面：根入口、登录/注册/找回/邮箱验证/重置/MFA、组织工作区选择、三步引导。
- 依据：实际 `App.vue → route.meta.view → 四个Vue组件`；[原行为合同](identity-onboarding-contract-review.md)和[既有C方向图稿](design/identity-direction-c/README.md)。C稿仍是提案，旧生产Signal Ledger不能反向限制用户已选择的完全重构方向。
- 已选设计方向：白身份栏、蓝任务/范围区、白工作面；不复用旧营销轨道。不新增SSO、二维码/复制能力、确认密码或不存在的弹窗。
- 所属与消费者：LocalIdentity跨六路径共用模式状态；根页使用UiStatePanel；TenancyChooser以组织/工作区两级选择，OnboardingGuide仅局部三步。依赖源码指纹在各页surfaceReview中绑定。
- Explicit exceptions：None documented。功能与生命周期差异属于真实实现验收项，不当作新发现的视觉优化直接修改。

## 按页审图与行为对应

| 页 | 源入口及模式 | 审核图 / 逐项清单 |
| --- | --- | --- |
| P01 根入口 | 自动landing、失败重试；共享次按钮没有监听 | [桌面](design/identity-direction-c/1440-p01-blocked.png) / [手机](design/identity-direction-c/390-p01-blocked.png) / [清单](action-reviews/P01.json) |
| P02 登录 | 普通、MFA挑战、首次设置三分支 | [桌面](design/identity-direction-c/1440-p02-idle.png) / [手机](design/identity-direction-c/390-p02-idle.png) / [清单](action-reviews/P02.json) |
| P03 注册 | 成功局部verify，URL不变，邮件入队不等于送达 | [桌面](design/identity-direction-c/1440-p03-queued.png) / [手机](design/identity-direction-c/390-p03-queued.png) / [清单](action-reviews/P03.json) |
| P04 找回 | 通用受理，不确认账号存在 | [桌面](design/identity-direction-c/1440-p04-accepted.png) / [手机](design/identity-direction-c/390-p04-accepted.png) / [清单](action-reviews/P04.json) |
| P05 邮箱验证 | 初始verify且有token才自动确认；无重发按钮 | [桌面](design/identity-direction-c/1440-p05-error.png) / [手机](design/identity-direction-c/390-p05-error.png) / [清单](action-reviews/P05.json) |
| P06 重置 | 只输入新密码；源缺token仍提交后端 | [桌面](design/identity-direction-c/1440-p06-success.png) / [手机](design/identity-direction-c/390-p06-success.png) / [清单](action-reviews/P06.json) |
| P07 MFA | 首次GET、内联绑定/确认/停用；不把未知当未启用 | [桌面](design/identity-direction-c/1440-p07-read-error.png) / [手机](design/identity-direction-c/390-p07-read-error.png) / [清单](action-reviews/P07.json) |
| P08 范围选择 | 无组织创建本人空间、无工作区返回目录，两者不混同 | [桌面](design/identity-direction-c/1440-p08-empty.png) / [手机](design/identity-direction-c/390-p08-empty.png) / [清单](action-reviews/P08.json) |
| P09 引导 | 直达/上下步/跳过/结束；无进度落库 | [桌面](design/identity-direction-c/1440-p09-step-3.png) / [手机](design/identity-direction-c/390-p09-step-3.png) / [清单](action-reviews/P09.json) |

上述是审核起点，不代表每页只有一个状态；完整188张既有图按原图册查看。每个语义组列源位置、显示/禁用条件、处理函数、动态变体、相关场景和未验证项。

## 不能按初始画面排除的动作

P02–P07共有18个源候选位置。六份JSON是不同路径的适用性记录，**不是108个独立按钮**。publicQueryModes包含login/register/forgot/verify/reset，且局部注册/登录/忘记密码按钮不改URL；注册成功可以进入verify，登录结果可以进入challenge或security-setup。因此“注册页”不是只有注册动作。

普通MFA管理只由P07初始mode进入，其他身份路径需跨RouterLink才能到达，不能拿P07管理图冒充P02原地管理。首次设置中的start/confirm同handler仍可从登录结果进入。旧sessions没有路径/query/模板切换入口，明确排除，但不删除源码。P07登录后的同path MFA链接也不保证重挂载。

邮箱确认 `ID-EMAIL-CONFIRM` 是挂载自动动作，单列automaticActions，不伪造按钮候选；局部switchMode不调用confirmEmail。整个身份组件13处v-model展开16输入实例，另P08组织搜索1处；三个结构容器（身份aside/form、团队aside）不是三个弹窗。本批四个Vue没有原生弹窗，MFA/种子/验证结果是内联模式。

本批38个唯一源位置关联96个按路由累计语义组（重复共享组包含其中），不冻结全站去重分母。全局现在12页有此级清单，其余61页待同级核对。六态仍保守未映射，原四类代表控件图没有逐action selector合同；本轮不会借关联补成“通过”。

## 待审核差异与完整实现缺口

1. 原邮箱失败仍显示“正在验证邮箱”；C图已改失败标题。原MFA读取初值false在加载/失败时仍显示未启用；C图单列未知。只证明提案明确，不证明源组件修复。
2. 原MFA和首次设置是form外button，无普通表单的required或忙碌禁用；源mode切换、停用后敏感ref仍保留。C稿统一busy/清演示字段不得替代真实秘密清理、会话撤销、请求归属和权限验证。
3. P08设置会话期间仍可返回组织；两个GET任一失败整体失败，最近组织先记录。P09小数step仍可使page undefined。这些影响真实链，按原实施验收卡处理，不本轮顺手改生产行为。

所有辅助入口、动态行、全部字段/主题/密度、当前URL下连续切模式、真实Vue、服务端鉴权/SQL/邮件/Cookie仍未整体验收。用户具体批准与G0–G5保持。

## 验证与交接

```powershell
node --test tests/unit/ui-phase2-identity-review.test.mjs
node scripts/verify-ui-phase2-identity-review.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

新检查核源码字面模式白名单、模板切换入口、App路径key、目录准入与逐候选适用性；15项正反例防止漏自动动作、误排共享login、虚构mfa/sessions可达和冒认六态。CLI复用16组实际setup隔离请求测试，不访问真实服务。全局审核验证九清单完整源身份/合同/字段/容器与双端图片存在，图指纹另用交付审计；不重跑未修改的旧浏览器稿冒充新视觉验收。

只新增审核清单、验证工具、必要报告与文档；产品源码、API/OpenAPI、数据库/迁移、配置/.env、权限、安全规则、依赖和宝塔服务不改，无部署或重启。脚本无新增配置参数。未创建临时文件或服务，保留永久清单/测试；不删除旧图。审核时请写页面编号、场景及通过/修改意见，不能把C方向选择作为逐页通过。
