# P36 正式交互、字段与实施证据登记

当前追加：[复制反馈归属修复](P36-COPY-OWNERSHIP-REVIEW.md)。P36.json从当前生产源重新生成，动作/字段/容器分母不变；已交截图的组件与fixture helper用固定b4fc398d历史指纹核对，不再称为当前源码图。新复制行为有独立实际子Vue回归；原批准范围不变，下文保留登记时事实。

后续状态：[查询历史恢复修复](P36-QUERY-RESTORATION-REVIEW.md)更新当前子组件source hash，25源位置及动作/字段/容器分母不变。三提案清单的script关联现在为query-sync-only；原图和批准保留，下文描述为登记批次当时的边界。

状态：source-reviewed-not-runtime-accepted，整页批准仍 pending-user-review。起点HEAD为c380b995，保留前一轮未提交的手机筛选实装及来源关联；本批不再改生产代码，也不改P35。全局颜色门的既有P35失败仍未解决，不自动提交。

## 当前源码与动作边界

从 `/org-admin/tokens` → OrganizationAdminCenter → OrganizationTokenPanel，逐项覆盖25个父/子源位置：19组语义，12组本页动作、2组转发、5组他页排除。三类写入是创建、轮换、撤销，不按每行令牌或每个scope重复计算。

| 合同组                    | 真实含义                        | 关键边界                                                        |
| ------------------------- | ------------------------------- | --------------------------------------------------------------- |
| OG-REFRESH / OG-RETRY     | 原load读取summary/tokens        | 真实GET可更新到期状态；不声称数据库纯读                         |
| OG-K-CREATE               | 内联form/submit共用submitCreate | 精确name/scopes/ttl_days/reason；成功重置90/空scope，失败留草稿 |
| OG-K-SCOPE / OG-K-TTL     | 四scope和四期限快捷             | 仅改创建草稿，实际等待仍可编辑                                  |
| OG-K-ROTATE / OG-K-REVOKE | 子函数prop转到tokenAction       | 原因确认后POST action/expected_version/reason，取消不发送       |
| OG-K-COPY / OG-K-DISMISS  | 复制明文/清本次明文             | 关闭不是撤销；旧复制迟到反馈OG-G05仍未修复                      |
| OG-K-FILTER / OG-K-PAGE   | 原重置与本地6条分页             | 默认条件下重置不强制第一页，条件变化才由watch复位               |
| OG-TECH                   | 原生details技术信息             | 无请求、无复制、不是业务弹窗                                    |

两组转发覆盖父原因窗submit/cancel两个扫描身份及tokenAction里的独立ask。实际三函数prop单独核对：create-token、perform-token-action、dismiss-secret；不能因不属于Vue事件而遗漏。父传busy为busy||refreshing，tokens只在data为数组时使用。

排除P34首次500/429专有失败组件、P29资料表单、P30成员事件、P31资源授权事件及通用非令牌原因入口。P36不套用其他页已批准的白色失败区；令牌原因是空初始值，不是通用action字符串。

## 字段与容器

7个子v-model和6个明确排除的父资料v-model，共13个调用方模型。createForm.scopes是checked/change组，另行登记，不伪造为第8个v-model。共享reason模型、原生窗口/表单/按钮共6个共享源位置作为消费证据单列，不加入本页25个父/子源分母。

调用方结构共6处、9种上下文：父资料form排除、父共享原因组件轮换/撤销、子安全aside、子说明aside、子创建form三种上下文、子预览aside。不是6个业务弹窗；创建是行内表单，共享原因窗才是轮换/撤销弹窗。真实共享原因minimum默认2、无maxlength，提案500字上限仍未批准为规则。

## 图片与实际实施关联

- [正式JSON](action-reviews/P36.json)：每个源签名、条件、父转发、字段、容器及图路径/宽度/SHA逐项登记。
- [354张控件图](../../output/playwright/p36-controls-review/index.html)：44变体分为30子控件、2父读取、6共享原因消费、6便利提案。对应344原生状态图及10组合图；提案无真实源入口，已选/禁用等变体不重复计源码。
- [196张字段组合图](../../output/playwright/p36-fields-review/index.html)：7模型、1scope组、2共享原因上下文分别绑定；156字段图和40组合图完整对应。
- [10张实际子Vue筛选图](../../output/playwright/p36-mobile-filters-vue/index.html)：沿用前轮290检查/56非目标像素比较的既有证据，没有重采。新增永久图册和actualVueMobileFilters关联，使统一审核入口可直达该批实际图。
- [手机局部批准](P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md)仍仅四字段/帮助/底部重置。创建组合与控件视觉问题待答，注册动作不能授予批准。

原112张整体图、354/196独立图及10实际图均保留，本轮不改变任何PNG或证据清单。独立包schema不等于统一六态证据：本页12动作的72通用视觉槽仍not-mapped，不以此宣称缺少72张图，也不以已有大图宣称全部按钮验收。

## 验证与维护

```powershell
node scripts/build-ui-phase2-org-token-review.mjs --check
node --test tests/unit/ui-phase2-org-token-review.test.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
node scripts/build-ui-phase2-review-evidence.mjs --check
node scripts/verify-ui-phase2-review.mjs
```

只有在审查真实源和证据后，才用生成器--write重建P36.json及真实筛选图册。通用动作审计--write更新报告；图包指纹审核先于统一入口重建。缺失源、错误转发/prop/POST方法、错字段/容器/图片和越权批准会被检查拒绝；真实源函数离线演算继续区分三body、草稿行为和已知OG-G05，不调用真实API或系统剪贴板。

本轮6项新定向测试通过，连同前轮实装5项共11项通过；全部ui-phase2单测通过。通用动作审计更新为37登记页、757唯一源位置、738语义组、610路由动作/68转发；整页批准仍0。原102通用图包/15069PNG来源及图片零漂移；该通用计数不把独立output目录的图片重复计入。统一入口实际Vue关联从4到5，不等于5页验收完成。

Playwright核对双端73路由入口、P36实际图册链接与10图加载、审核意见存储/导出、键盘与无溢出。初次新增测试错误地假设卡片展示具体scope，实际卡片只显示统一免责声明；已按真实UI核对免责声明与索引中的P36具体scope，未为测试改用户审核界面。

没有新增生产配置、API、权限、env、依赖、数据库结构或后端消费合同；无重启和部署。本批新产物为永久JSON、报告及图册，未生成新PNG或基线副本。审核导出的两份临时文件由download.delete清理，浏览器和本地服务关闭；旧材料与前轮未提交改动保留。

剩余：P35颜色修复授权、P36其他区域与父级错误/刷新完整实测、URL历史/组织切换/KeepAlive、真实后端与生产验证，及余下全73页C实施/审核/部署。已知全局颜色测试失败不因本轮UI专项通过而消失；当前不提交，commit hash不适用。
