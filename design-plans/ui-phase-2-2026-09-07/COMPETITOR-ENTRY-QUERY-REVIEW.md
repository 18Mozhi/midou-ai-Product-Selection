# P19/P20 创建入口与规则页直达弹窗 · C 方向审核

状态：待审核，不提升既有批准范围；本批只细化离线设计，不改生产。P16布局批准、五项质量门决定和此前两张待审图片均保持原范围。

## 设计与实际行为

- P19蓝色范围区“添加竞品”是本地打开创建窗；P20“新建监控规则”与空规则中的“创建第一条规则”打开规则窗。两个规则入口分别留图并验证回到刚才那个按钮，而不是按同名动作定位到第一个。
- P20正常页**没有添加竞品按钮**。真实onMounted仍会在管理者的create=1参数下打开创建窗，因此单独画三步、失败、提交中；背景和弹窗眉题明确P20，不借用P19图片。
- 原API仍是POST /competitors：market/product_url/title，以及非空时的opportunity_id。前两步只切步骤，第三步才提交。图中“已排队”不代表已取得真实快照。
- 只读者即使带create=1也没有创建弹窗，规则新建按钮也不出现。此处是源条件对应的离线样本，不替代服务端RBAC。
- URL直达没有原始创建按钮，关闭后焦点提案落在规则页标题；不凭空增加入口。原型routePreview仅在内存记录create参数的设置/清除，不改变浏览器地址、不宣称真实router/history已验证。
- 创建表单字段沿现有组件保留；上一步不清空标题。规则入口按源重置目标为空、price/decrease/1，并聚焦目标选择框。
- 提交按钮disabled/busy使用同一个在途条件；关闭与上一步提交中锁定仍是待审提案，源Vue目前允许这些操作。不能说取消能撤回已经发出的请求。
- 本批不给“打开”和前两步“下一步”编造busy/disabled图。create=1与competitor同时存在的双弹窗优先级未决定、不实施，本批只验证单create参数路径。

## 双端逐按钮状态

### 1440px

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 添加竞品入口 | [查看](design/competitor-direction-c/1440-control-create-open-default.png) | [查看](design/competitor-direction-c/1440-control-create-open-hover.png) | [查看](design/competitor-direction-c/1440-control-create-open-focus.png) | [查看](design/competitor-direction-c/1440-control-create-open-pressed.png) | 本批不制图 | 本批不制图 |
| P20 新建规则入口 | [查看](design/competitor-direction-c/1440-control-rule-open-default.png) | [查看](design/competitor-direction-c/1440-control-rule-open-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-open-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-open-pressed.png) | 本批不制图 | 本批不制图 |
| P20 空规则 / 创建第一条规则 | [查看](design/competitor-direction-c/1440-control-rule-open-empty-default.png) | [查看](design/competitor-direction-c/1440-control-rule-open-empty-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-open-empty-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-open-empty-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第三步 / 确认并开始采集 | [查看](design/competitor-direction-c/1440-control-p20-create-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-pressed.png) | [查看](design/competitor-direction-c/1440-control-p20-create-disabled.png) | [查看](design/competitor-direction-c/1440-control-p20-create-busy.png) |
| P20 创建弹窗 / 右上关闭 | [查看](design/competitor-direction-c/1440-control-p20-create-close-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-close-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-close-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-close-pressed.png) | [查看](design/competitor-direction-c/1440-control-p20-create-close-disabled.png) | [查看](design/competitor-direction-c/1440-control-p20-create-close-busy.png) |
| P20 创建弹窗 / 上一步 | [查看](design/competitor-direction-c/1440-control-p20-create-previous-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-previous-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-previous-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-previous-pressed.png) | [查看](design/competitor-direction-c/1440-control-p20-create-previous-disabled.png) | [查看](design/competitor-direction-c/1440-control-p20-create-previous-busy.png) |
| P20 第一步 / 取消 | [查看](design/competitor-direction-c/1440-control-p20-create-cancel-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-cancel-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-cancel-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-cancel-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第一步 / 下一步 | [查看](design/competitor-direction-c/1440-control-p20-create-next-link-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-link-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-link-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-link-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第二步 / 下一步 | [查看](design/competitor-direction-c/1440-control-p20-create-next-market-default.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-market-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-market-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-create-next-market-pressed.png) | 本批不制图 | 本批不制图 |

### 390px

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 添加竞品入口 | [查看](design/competitor-direction-c/390-control-create-open-default.png) | [查看](design/competitor-direction-c/390-control-create-open-hover.png) | [查看](design/competitor-direction-c/390-control-create-open-focus.png) | [查看](design/competitor-direction-c/390-control-create-open-pressed.png) | 本批不制图 | 本批不制图 |
| P20 新建规则入口 | [查看](design/competitor-direction-c/390-control-rule-open-default.png) | [查看](design/competitor-direction-c/390-control-rule-open-hover.png) | [查看](design/competitor-direction-c/390-control-rule-open-focus.png) | [查看](design/competitor-direction-c/390-control-rule-open-pressed.png) | 本批不制图 | 本批不制图 |
| P20 空规则 / 创建第一条规则 | [查看](design/competitor-direction-c/390-control-rule-open-empty-default.png) | [查看](design/competitor-direction-c/390-control-rule-open-empty-hover.png) | [查看](design/competitor-direction-c/390-control-rule-open-empty-focus.png) | [查看](design/competitor-direction-c/390-control-rule-open-empty-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第三步 / 确认并开始采集 | [查看](design/competitor-direction-c/390-control-p20-create-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-pressed.png) | [查看](design/competitor-direction-c/390-control-p20-create-disabled.png) | [查看](design/competitor-direction-c/390-control-p20-create-busy.png) |
| P20 创建弹窗 / 右上关闭 | [查看](design/competitor-direction-c/390-control-p20-create-close-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-close-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-close-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-close-pressed.png) | [查看](design/competitor-direction-c/390-control-p20-create-close-disabled.png) | [查看](design/competitor-direction-c/390-control-p20-create-close-busy.png) |
| P20 创建弹窗 / 上一步 | [查看](design/competitor-direction-c/390-control-p20-create-previous-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-previous-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-previous-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-previous-pressed.png) | [查看](design/competitor-direction-c/390-control-p20-create-previous-disabled.png) | [查看](design/competitor-direction-c/390-control-p20-create-previous-busy.png) |
| P20 第一步 / 取消 | [查看](design/competitor-direction-c/390-control-p20-create-cancel-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-cancel-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-cancel-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-cancel-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第一步 / 下一步 | [查看](design/competitor-direction-c/390-control-p20-create-next-link-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-link-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-link-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-link-pressed.png) | 本批不制图 | 本批不制图 |
| P20 第二步 / 下一步 | [查看](design/competitor-direction-c/390-control-p20-create-next-market-default.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-market-hover.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-market-focus.png) | [查看](design/competitor-direction-c/390-control-p20-create-next-market-pressed.png) | 本批不制图 | 本批不制图 |

## P20独立完整场景

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 商品链接 | [查看](design/competitor-direction-c/1440-rules-create-link.png) | [查看](design/competitor-direction-c/390-rules-create-link.png) |
| 市场信息 | [查看](design/competitor-direction-c/1440-rules-create-market.png) | [查看](design/competitor-direction-c/390-rules-create-market.png) |
| 确认采集 | [查看](design/competitor-direction-c/1440-rules-create-confirm.png) | [查看](design/competitor-direction-c/390-rules-create-confirm.png) |
| 失败保留 | [查看](design/competitor-direction-c/1440-rules-create-error.png) | [查看](design/competitor-direction-c/390-rules-create-error.png) |
| 提交中 | [查看](design/competitor-direction-c/1440-rules-create-busy.png) | [查看](design/competitor-direction-c/390-rules-create-busy.png) |
| 只读直达不弹窗 | [查看](design/competitor-direction-c/1440-rules-create-readonly.png) | [查看](design/competitor-direction-c/390-rules-create-readonly.png) |

## 覆盖与防止跨页混算

9控件变体42状态×双端＝84图，6新整页×双端＝12图，共96新PNG。竞品包从586到682PNG、66整页场景、58控件变体268状态/536双端实例。

P19打开入口新增4代表槽；P20规则入口4、创建确认/关闭/上一步18，共新增26槽。P19尚余20/P20尚余8，共28；四个额外变体（空规则入口/第一步取消/两个下一步）不增加语义动作数。恢复变体仍按上一批登记，不能把全页或主题批准从图片数量推导出来。

同一个CP-CREATE-*在P19/P20必须绑定不同截图。P20的visualStateReferences显式带pageId，读取evidence.pageActionVisualReferences.P20；缺少本页证据时失败关闭，禁止回退到P19同名键。原actionVisualReferences保留兼容已有稿，additionalControlVariants继续精确校验额外变体。

审计新增页面声明、目标pageId、缺页/缺动作、selector，以及手机图page/state/action/selector损坏检查；所有58单元用例通过。该变更只影响本地审核格式，不是生产API字段或新依赖。

## 验证和限制

先运行单元用例，再smoke；smoke通过536双端控件实例、无HTTP/页面错误。检查入口Enter/聚焦/默认字段/关闭回原位置，P20三步本地切换、标题保留、最终精确POST/在途重入与Escape锁定、URL直达无创建按钮、只读不弹窗、关闭清内存create并回规则标题。完整截图及目检结果记录到PROGRESS。

未证明所有字段边界、主题密度、错误/成功后的完整异步生命周期、浏览器真实query/history、双query优先级、后端事务或全站控件验收。没有批准任何完整页面；全站其他52页同级语义与重设计落地/部署仍待。

使用：直接打开交互原型，场景选择“P20 · create=1”系列。最小检查`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`；完整复验不带参数；需要有意重画才加`--capture`。单元用例`node --test tests/unit/ui-phase2-action-coverage.test.mjs`；动作审计`node scripts/audit-ui-phase2-action-coverage.mjs`。

[交互原型](design/competitor-direction-c/index.html) · [全部图册](design/competitor-direction-c/gallery.html) · [恢复按钮](COMPETITOR-RECOVERY-STATE-REVIEW.md) · [语义核对](COMPETITOR-SEMANTIC-REVIEW.md) · [进度与验证](PROGRESS.md)

## 交付边界

完整capture通过682图、536双端控件实例、原有9源码/5边界检查与12屏宽×5代表场景，HTTP/页面错误0，最低文字对比5.33419。仅目检390-rules-create-busy与1440-control-rule-open-empty-focus；未声称全部人工审阅。原两张待审采集busy/删除focus与2a27160e字节哈希相同。

动作审计首次发现迁移场景关联时误写了不存在的rules-create-invalid（对应旧P19校验错误图）。移除这条无证据引用后复验通过；P20非法URL/全部字段错误视觉仍未覆盖，不能借旧图算已完成。现P19剩20/P20剩8代表槽；52页同级语义仍待。

UI Skills用于C方向主次与直达弹窗上下文；Playwright复用既有脚本和依赖。只改离线原型、验证器/审计库及永久测试、图稿和文档。未改生产Vue/CSS、API/OpenAPI、后端/Worker/Python、数据库/迁移、env/配置、依赖、安全、权限或部署，无调参和重启要求。

新增PNG都是正式审核交付，不是临时测试输出；无新临时文件/服务，浏览器由finally关闭。此前output/playwright/ui-phase2-competitor-races-20260909清理被拒的残留仍保留，不绕过；详见进度。
