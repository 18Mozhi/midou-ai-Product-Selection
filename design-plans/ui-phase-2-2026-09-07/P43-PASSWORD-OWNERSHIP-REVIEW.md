# P43 改密确认与回执归属 · 实际 Vue 对照

2026-09-11，起点 main/b93caa7f，干净工作树。复用 Playwright 技能和项目已安装的浏览器/Vite，不新增依赖，不操作真实账号。

[旧版40图](../../output/playwright/p43-password-lifecycle/baseline/index.html) · [当前40图](../../output/playwright/p43-password-lifecycle/current/index.html) · [当前清单](../../output/playwright/p43-password-lifecycle/current/evidence.json)

## 已证实的问题与边界

真实父子Vue与原生弹窗：A提交改密后等待时可取消密码窗、关闭A详情，再打开B详情或重新打开A详情。原成功回执无条件写detailOpen=false，会关闭这个新详情；失败会写入已失效密码窗的内部错误状态。后者不冒充B密码窗可见错误，因为等待时“强制改密”入口被busy禁用，正常用户不能立即打开第二个密码窗。

A取自现有E2E原始样例；B是明确添加的第二账号测试对象，使用测试邮箱、空组织关系和会话，不是实际权限结果。全局汇总沿用原样例，不以两条合成记录计算真实平台数量。所有GET/POST在本地拦截，无强点禁用按钮、无修改内部Vue状态、无真实账号/数据库写入。

## 最小生产修复

仅resetPassword复用现有captureDetailAction，在打开原因确认时绑定详情代次、用户和路由。失效原因回调不发请求；失效错误不写密码反馈；已发送请求成功后仅原详情仍有效时关闭密码与详情。原POST目标构造、temporary_password/reason字段、幂等、列表重读、成功通知、密码保留和后端账号恢复active语义不改。模板、创建流程及其他父函数逐字不变，父源码843行，仍低于原850行门槛。

仅取消密码窗但仍停留于原详情的情况，原成功关闭详情行为保留；本次不擅自把“取消密码窗”解释为取消已发送的改密或要求保留详情。原因取消、敏感字段清空策略和后端安全规则没有重定义。

## 证据

390/1440两端，正常、只关密码、关闭详情、重开同账号、换第二账号，成功/失败交叉：修复前后各20场景220检查40PNG。原账号每场景一个POST；成功后原列表重读和成功通知保持，第二账号零写入。旧成功关闭替换详情、当前保留替换详情逐项反证；旧图不覆盖、不标为新版通过。

直接回归执行实际resetPassword、原因函数和usePlatformUserDetail，覆盖失效确认、不同/同一账号重开、路由往返、缓存停用/卸载、selected缺失和迟到成功/失败。这里的路由/生命周期与失效确认注入是直接函数回归，不伪称都已由真实浏览器历史操作复现；浏览器只证明上述五条实际弹窗路径，不是完整App/KeepAlive、真实权限、密码哈希、SQL/事务、会话撤销或MFA验收。

## 历史与当前

`ui-phase2-password-baseline.mjs` 只允许父组件从b93caa7f时点ec3f2b65接续到a1ba7d5a；旧创建、目录、改密和原因图按已捕获源码保留。更早组织/创建快照链逐级核对，未知版本报错。当前改密证据直接读取当前源，不替换旧源码来通过当前回归；当前静态合同仍34源/128候选/24模型，不扩大为全部运行时分母。

## 复验与交付

```powershell
node scripts/verify-ui-phase2-user-password-lifecycle.mjs --baseline
node scripts/verify-ui-phase2-user-password-lifecycle.mjs
node --test tests/unit/platform-user-password-ownership.test.mjs tests/unit/ui-phase2-user-password-lifecycle.test.mjs
# 正式重拍才追加 --capture；两个目录分离，不覆盖此前图包。
```

无需调参，无API/OpenAPI/路由/环境变量/依赖/数据库/权限变更，因此后端、Python和插件不改。未部署、无需当前生产重启，未来仍需本地构建与既有宝塔发布门禁。80PNG、两图册/清单和永久测试属于正式交付物，服务与浏览器在finally关闭；最终构建、端口和Git收尾结果见本轮记录。

P43具体C布局仍待用户审核；完整壳层历史/缓存、敏感字段清理、写后读取失败反馈、三主题两密度、完整无障碍及全73页重构和宝塔真实验收仍待，不将本次代码修复扩成页面批准。

## 本轮收尾验证

- 定向回归36项通过；相关UI回归787项通过、0失败。当前静态合同8页/128候选/24模型/34源，66个链接核对通过。
- `npm run build:web`通过（含类型检查）；`npm run verify:docs`通过（73路由、153必需文档）；`npm run format:check`与`git diff --check`通过。
- 已人工查看390宽换账号成功回执前后图：旧版关闭B详情，当前保留B详情。该对照仅证明回执归属，不替代用户视觉审核。
- 本轮两个浏览器验证进程均退出0；54740、54950端口无监听。未新增一次性临时文件，80PNG及两套图册/清单为正式交付物予以保留；未部署或重启生产。
