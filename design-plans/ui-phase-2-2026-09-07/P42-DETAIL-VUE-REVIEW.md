# P42 组织详情与原因确认 · 实际Vue审核 r1

待用户审核。起点 `main/73d04832`；承接P40列表、P41创建，复用真实父级、详情、共享原因窗脚本和既有隔离Vue宿主。不是生产接入，也不把此前未答审核视为通过。

[打开42张图册](../../output/playwright/p42-detail-preview/index.html) · [来源与检查证据](../../output/playwright/p42-detail-preview/evidence.json)

## 本批设计与边界

按 `frontend-design` 的明确层级与非对称构图，延续已选C方向：桌面蓝色组织身份/状态/两项数量在左，白色资料与技术折叠在右；停用/恢复独立于保存，手机改为顶部蓝色身份和单列字段，滚动时底部保存/关闭可达。保留原生dialog、头尾关闭、三字段与原因确认流程。

整个详情及原因script保留；详情原指令均保留，只增加用于危险按钮颜色的 `:data-danger` 展示绑定。共享原因窗仅增加静态class与标题包装，创建用户/重置密码部分不动。原因窗仍不显示目标名称，因为原接口没有目标身份prop；不伪造已冻结目标或审计承诺。

仅审核模板修正两种事实表达：缺失成员/工作区数量显示“尚未读取”，实际0保留；目标缺失说明为“本次组织列表没有返回这个目标”，不据此断言删除或无权。生产组件原缺失数量回退1、原文案仍未修改。本批状态未知值仍按原逻辑提供恢复，不新增状态规则。

## 图与验证

390/699/700/701/1024/1440六宽度正常图；390/1440各有底部、技术展开、非法天数、保存原因、原因必填、保存中/失败/成功、停用原因/成功、恢复原因/成功、0计数/缺失计数/未知状态/超长身份/缺失目标，共17张补图；390另有600px短屏顶部/底部。合计42张永久审核图。

141项浏览器检查通过：真实深链原生弹窗、三字段原约束、44px控件和16px输入、无横向溢出、原因取消不写入及焦点归还、必填阻止确认、原因先关闭再等待写入、失败保留字段、输入清错、模拟成功重读身份、停用与恢复、缺失目标重读概览及返回无query列表、Escape和短屏底部可达。已人工查看桌面/手机正常、手机底部与原因图。

所有GET/PATCH/POST在浏览器发出前拦截，无真实组织写入；390/1440各有四个模拟写入：PATCH失败500、PATCH成功200、停用POST200、恢复POST200，均保留原幂等键。PATCH只有name/timezone/data_retention_days/reason，POST只有status/reason；没有新增expected_version或接口字段。其他宽度无写入。长身份是超限鲁棒性测试数据，不是认可的写入长度。

保存等待时原逻辑仅禁用保存/状态按钮，字段和关闭仍可用。本批没有修复确认时selected/表单读取的目标漂移，没有验证在途离页/切组织/连续写入归属或成功后重读失败；模拟成功不证明真实持久化、权限或审计。

## 复验与使用

```text
node scripts/verify-ui-phase2-organization-detail-preview.mjs
node scripts/verify-ui-phase2-organization-detail-preview.mjs --capture
node --test tests/unit/ui-phase2-organization-detail-preview.test.mjs tests/unit/ui-phase2-organization-create-preview.test.mjs tests/unit/ui-phase2-organization-list-preview.test.mjs
```

默认只检查不重写图；`--capture`重生成当前图册/证据。12项定向测试通过，校验完整script/指令边界、源漂移失败关闭、源和PNG散列、准确模拟请求、P40/P41旧证据及生产文件不变。预览样式无生产导入，不新增依赖。

本批均为永久图稿、记录和回归检查，没有临时文件；浏览器context、browser和Vite在finally关闭，63021/63723已无监听。格式检查首次发现验证脚本排版问题，局部格式化后重新捕获141检查/42图并校验散列。旧P38忽略诊断文件不是本批产物，未触碰。API/OpenAPI、后端/Python、数据库、权限、环境变量及配置未变，与本批隔离模板无关；无部署或重启要求。

## 待确认与后续

本次手机详情布局组合待审；三原因与其他状态不随这一问自动通过。完整App/NavigationShell/KeepAlive、三主题/密度、200%缩放/软键盘、完整Tab循环、所有按钮hover/pressed、真实权限及写入生命周期仍未验收。全73页C方向实施、宝塔部署和最终用户签收继续，不能以局部图数或测试数宣称整体完成。
