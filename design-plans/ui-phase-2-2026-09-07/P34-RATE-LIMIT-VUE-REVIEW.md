# P34 手机首次限流 · 已批准白区真实Vue实施

2026-09-10，main / d2d566c2fceeef6ab1754f409475e2cf7582b8ef起点。[用户批准](P34-MOBILE-RATE-LIMIT-COMPOSITION-APPROVAL.md)只覆盖手机首次限流白色区域，本批按此局部接入，不扩大为后台限流、桌面或生产验收。

## 实施与使用

仅P34、state=rate_limited、尚无data、最近HTTP429、视口<=760px时显示。父组件独立else-if继续使用OrganizationApprovalFirstFailure，传静态标题“请求过于频繁”，原notice/action_hint与真实requestId不改。共享组件新增可选title，默认仍“组织后台暂不可用”；500分支原样保留。复用原CSS/颜色/触控尺寸，没有新动画或全局样式。

按钮只emit reload，两个白区入口都转发原load()。未改变api-client的自动尝试、限流规则、GET合同、权限、幂等、倒计时或数据保留规则；未添加复制、申请权限或其他动作。提示中的接口真实处理建议可能与审核稿占位文案换行不同，不用通用文案掩盖服务端建议。新图中的编号来自隔离响应，不写入生产源。

## 真实图与验证

[手机限流](../../output/playwright/p34-rate-limit-vue/approvals-429-390.png) · [真实追踪展开](../../output/playwright/p34-rate-limit-vue/approvals-trace-390.png) · [760px边界](../../output/playwright/p34-rate-limit-vue/approvals-429-760.png) · [8图与证据](../../output/playwright/p34-rate-limit-vue/evidence.json)。原批准PNG保持不变。

真实App/父子组件配隔离HTTP，390/760/761/1440四断点176项检查，52项内存基线像素对比。基线服务同时替换父组件与白区组件为上次提交，断言两者确实经过基线转换；不拿当前子组件冒充旧基线。500白区、其他401/403/404/409/503、桌面、顶部、成功态、后台429及相邻成员/工作区429对应图保持一致。summary和approvals分别限流，均维持原3次目标GET尝试，另一读取只一次；手动成功恢复时两读取各一次，查询及无关URL保留、原生焦点可用、旧重复提示隐藏。

完整父读取矩阵仍56场景、712检查、64真实图，已重采本次429变化。零页面错误、外部请求和业务写入。严格反向差异校验只允许父展示标记与429分支、共享标题这两文件的精确变更，拒绝业务函数或500默认标题变化。26份旧提案来源关联由新基线证据更新，但旧图、旧检查和批准均不改；不是把旧提案重标成生产验收。

## 历史证据与当前证据

原`p34-first-failure-vue`的8图/evidence保持字节不变，明确固定在d2d566c2限流接入前提交。其单测仍验证当时完整源哈希、156检查和原PNG；当前500未变由本次52项基线对比另证。旧first-failure验证器/刷新器是该旧提交的专用工具，不在本次树上继续冒充“429仍未变化”的验证。当前接续命令如下：

```powershell
node scripts/verify-ui-phase2-org-approvals-rate-limit-vue.mjs --smoke
node scripts/verify-ui-phase2-org-approvals-rate-limit-vue.mjs --capture
node scripts/verify-ui-phase2-org-approvals-rate-limit-vue.mjs
node scripts/verify-ui-phase2-org-approvals-parent.mjs --capture
node scripts/refresh-ui-phase2-rate-limit-bindings.mjs --write
node scripts/refresh-ui-phase2-rate-limit-bindings.mjs
```

smoke不写图；capture更新本次实图，不覆盖批准提案；默认按当前源/PNG复验。来源刷新器先检查整张依赖图与当前两份真实证据，再更新已知来源，遇到无关漂移失败关闭。无新增运行参数或依赖。

## 未改、后续与运维

本次仅两个Vue文件发生展示变化。API/OpenAPI、后端/Worker/Python生产者消费者、MySQL、环境变量、依赖和CSS都不变。未部署，目前无需重启；上线仍按既有本地构建与宝塔部署流程，浏览器刷新加载新静态资源，不宣称零停机或真实权限验收。

顶部、网络白区及其他状态审核继续；权限r2仅措辞获批未实施，目录/详情及73页全套C与生产签收未完成。使用frontend-design复用已批准的阅读层级，Playwright复用现有依赖作实际交互与基线比较，没有因测试方便缩小全站目标。

## 提交前结果

定向单测通过；除此前已通过且未变更的全库格式门用例外，其余单元测试全量重跑通过，所有本次改动代码另经Prettier检查。Vue类型检查/前端构建、254资产体积门、391文件静态检查、153必需文档与运行文档一致性通过。35页动作登记仍为0页整体批准；102设计包/15069原PNG零漂移，审核入口双端筛选、焦点、来源关联、导出、无横溢出和零页面错误通过。

隔离服务端口52416/52469（冒烟）、52582/52704（完整基线/当前）、52947（父矩阵）均在finally关闭；审核浏览器与临时下载也自动清理。8新实图及evidence、重采父矩阵图是永久审核交付，基线图只在内存。旧500实图完全保留；追踪展开图如含原站点固定导航边缘，仍是实际页面取证，不因此修改未获批的导航区域。
