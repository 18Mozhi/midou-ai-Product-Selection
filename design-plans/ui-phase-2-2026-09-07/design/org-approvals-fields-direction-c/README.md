# P34 审批治理 · 十字段与八组合 C-r1

手机模板筛选区域已获[局部批准](../../P34-MOBILE-FILTER-COMPOSITION-APPROVAL.md)：单列、帮助文字、底部重置。其他内容仍待审核，完整截图中的目录/详情不在批准范围内。本批是独立字段设计稿，不是实际 Vue 页面或生产验收；工具/图库待审标题为制图时状态。

后续批准：[手机空结果区域](../../P34-MOBILE-EMPTY-COMPOSITION-APPROVAL.md)的数量、浅灰提示、说明和清除按钮也通过，不包含折叠入口或整页。已批准原图不可替换。手机筛选区域已[局部实施到真实Vue](../../P34-MOBILE-FILTER-VUE-REVIEW.md)，空结果提案仍待实施；下文“源码不改”描述的是初版制图边界。

[字段及组合图册](gallery.html) · [离线交互](index.html) · [原页面与数据合同](../org-approvals-direction-c/README.md) · [控件图册](../org-approvals-controls-direction-c/README.md)

## 交付范围

审批与模板各五个字段：搜索、状态、工作区、资源类型、排序，逐一对应真实 v-model。67 个代表字段状态及 8 个筛选组合，桌面 1440 / 手机 390，共 150 PNG。单字段图片截取完整标签/控件/帮助区域；组合保留阅读上下文，不截断长字段说明。

| 字段 | 状态与源合同 |
| --- | --- |
| 两个搜索框 | 空值、焦点、有匹配、全空白、无结果、技术ID、200长度、220长度、链接恢复200、刷新中 |
| 审批状态 | all/pending/approved/rejected/cancelled，每个非默认选项及焦点/刷新中 |
| 模板状态 | all/published/draft/archived，每个非默认选项及焦点/刷新中；归档无结果不是表单错误 |
| 两个工作区 | all与原夹具两名称、无返回工作区、焦点/刷新中；继续按名称去重，不改为ID筛选 |
| 两个资源类型 | all/task/opportunity_decision，每个非默认选项及焦点/刷新中 |
| 审批排序 | created_desc/created_asc/title_asc/status_asc，每个非默认选项及焦点/刷新中 |
| 模板排序 | name_asc/updated_desc/nodes_desc/workspace_asc，updated_desc按current_version而非时间 |

每组四个组合：默认、五条件同时匹配、无结果、刷新中。刷新按钮禁用不等于本地筛选字段禁用；本稿保持源行为，不新设请求或锁定条件。页面无业务表单提交和弹窗。

## 视觉调整与不变项

frontend-design 用于细化 C 方向的字段层级：桌面三列、搜索占两列；手机单列。标签、输入值、帮助说明分层，输入/选择器16px、热区至少44px；新帮助通过 aria-describedby 关联。沿用上一控件子稿的蓝焦点和灰禁用，不更改旧文件或扩大其批准范围。

搜索显示当前输入长度，但不增加 maxlength、required 或错误态。现有 JavaScript 字符串长度及 slice 按 UTF-16 代码单元计算，图中中文例子每字占一位。当前可输入220位；刷新/链接恢复按现有规则读取前200位，新提示仅说明这一事实，不改变解析器或截断当前输入。无结果使用中性状态，不用红色校验错误误导用户。

工作区按已返回模板名称选择，同名合并；搜索不扩展至技术编号、模板节点。只排序已返回数据，无新后端查询。原90张页面图、244张控件图及生产源码均不改。

建议优先审核 [手机模板五条件组合](template-filters-matching-390.png) 与 [长输入提示](request-query-length-220-390.png)。原生下拉展开层由浏览器绘制，本批图片展示各个选中值，不宣称已验证所有系统下拉菜单样式。

## 使用与验证

直接打开 index.html，顶部工具选择字段或组合；选“链接恢复”会刷新当前离线页。默认可直接输入和选择，帮助文字随原渲染器更新。无需启动服务或配置环境。

- `node scripts/verify-ui-phase2-org-approvals-fields-c.mjs --smoke`：手机最小验证，不写文件。
- `node scripts/verify-ui-phase2-org-approvals-fields-c.mjs --capture`：重采150图、证据与图库。
- `node scripts/verify-ui-phase2-org-approvals-fields-c.mjs`：核对源图哈希后重放完整验证。
- `node --test tests/unit/ui-phase2-org-approvals-fields.test.mjs`：批准图、源约束、绑定与漂移检查。

已批准图禁止用重采覆盖。仅刷新真实源码绑定时，使用[保留图片的完整重验流程](../../P34-MOBILE-FILTER-VUE-REVIEW.md)，而不是 `--capture`。

完整浏览器验证为134字段状态、16组合、20字段改动回第一页流程，共170项。所有下拉选项与真实SFC模板提取结果核对；每个筛选结果完整ID序列与实际Vue脚本的computed函数比较。源码助手使用惰性getter及显式ref赋值，不是挂载Vue、watch调度或后端SQL证明。浏览器检验原生有效性、帮助关联、焦点、字号/热区、水平溢出、URL既有键和只读零请求/零存储；结束关闭浏览器，无开发服务。

## 剩余范围

除手机模板筛选区域外的具体字段/组合审核、不可用历史工作区值等更多URL恢复组合、同名工作区实际来源验证、原生下拉展开层/软键盘/缩放、父blocked/conflict状态、正式父接线/字段/容器登记、获批区域实际Vue落地及完整C Vue与权限/生命周期/后端和部署继续待办。既有查询恢复真实Vue证据独立保留，不用本离线图册代替。全73路由目标未完成。

本目录图片、图册、数据助手与验证测试均是永久交付；无API、业务规则、环境、依赖、数据库、权限或重启变更。
