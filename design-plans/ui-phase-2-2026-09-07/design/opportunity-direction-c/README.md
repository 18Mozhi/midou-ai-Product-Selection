# P15 机会列表 · OPPORTUNITY-C-r1

状态：C 方向已选，本批具体稿待审核。60 场景 × 双端 = 120 张主图，另补 6 张长弹窗下部图，共 126 张。独立 HTML，不是生产 Vue、P18 详情或用户验收。

[打开交互原型](index.html) · [证据与哈希](evidence.json) · [页面规格](../../page-specs/P15.md) · [源码合同](../../opportunity-contract-review.md)

## 构图与使用

采用 frontend-design 的层级与空间组织方法：蓝色四队列目录、白色候选工作面；筛选摘要按已应用范围显示，写入动作分为创建选品导航、底部手工/ERP入口及选中后批量条。手机重新排为单列证据摘要，缺图提示与选择框同时保留；不继承原先大筛选网格或暖色账条。

顶部“审核场景”切换静态场景。列表按钮、筛选、六类弹窗可交互，所有导航只显示意图；ERP 只读取用户在原型中选择的本机 JSON 到内存，绝不上传。不要把真实敏感文件放入演示。忙碌截图为固定状态；从非忙碌场景点击提交可演示 400ms 本地返回。

## 合同与提案边界

- 四队列保留 recommended / rule_candidates / evidence_pending / all，不填未读取的其他队列总数，不把规则命中当采纳。recommended 旧 M04-02 测试数据用于绘制 86 分等事实，不证明当前自动评估支持护肤品。
- 源码函数在永久助手中实际执行：创建四字段、三类批量 items/版本/trim 原因/负责人、legacy scope=all、应用/重置/切队列/翻页 query，以及 ERP 文件数组/list 与固定来源网址。展示事实逐列与实际 rowFacts 执行结果深比较。
- all 且 opportunity:decide 才有选择、导入和手工入口；指派还需成员选项。读取失败与成功空成员分别呈现。P16 创建选品、P14 管理规则与 P18 详情导航保留精确路径和 from；不在本稿伪造目标页完成。
- 源码 OP06 已隔离复现：记住 2 个 ID、当前列表仅 1 个时，实际 POST 只含 1 个。本稿显示本页可执行数、未包含数及实际名称/版本；不扩成跨页写入。所有选择均不在本页时禁用执行，翻页保留记忆，换队列清空。
- 七字段筛选保留字段名/枚举/限制。原组件 activeFilterCount 读可变草稿，未应用编辑也会影响计数；提案分离草稿/已应用。本地筛选返回是明确合成示例，不证明真实查询结果。桌面也用按需筛选弹窗是待审布局变化。
- 手工取消保留父草稿，成功只展示返回 ID 导航意图；批量打开清草稿、失败保留，成功清选择。归档非删除，复核非采纳。后端 1–50/UUID/版本/同源/幂等与事务仍需真实验证。
- ERP 数量 1–500，文件选择即导入，browser 请求 erp.products.read(limit)，文件模式不带 total，浏览器模式保留 total。文件结构校验、弹窗错误就地可达、提交中防重复为提案保护；关闭 ERP 保留进行中请求，不声称取消。返回计数不代表已确认采购成本。
- 源码列表无图片 error handler，本稿“图片暂不可用”为合成错误展示；没有实际远程图片加载验证，也不使用商品插画补造事实。
- 原生 dialog、唯一标题、焦点返回/Tab 循环、busy 关闭保护、失败输入保留属于独立原型提案；尚未迁入真实组件。合成页面、异步400ms和本地文件并不构成 API、权限、数据库、跨工作区或 ERP 助手验收。

## 主图

| 场景 | 1440 × 1000 | 390 × 844 |
| --- | --- | --- |
| 待我采纳 | [桌面](1440-recommended.png) | [手机](390-recommended.png) |
| 规则命中候选 | [桌面](1440-rule-candidates.png) | [手机](390-rule-candidates.png) |
| 采集中 | [桌面](1440-evidence-pending.png) | [手机](390-evidence-pending.png) |
| 全部机会 | [桌面](1440-all.png) | [手机](390-all.png) |
| 只读全部机会 | [桌面](1440-readonly.png) | [手机](390-readonly.png) |
| 展开五项配置 | [桌面](1440-setup-open.png) | [手机](390-setup-open.png) |
| 配置就绪不等于商品通过 | [桌面](1440-setup-ready.png) | [手机](390-setup-ready.png) |
| 配置读取失败 | [桌面](1440-setup-unknown.png) | [手机](390-setup-unknown.png) |
| 成员读取失败 | [桌面](1440-members-failed.png) | [手机](390-members-failed.png) |
| 成员成功返回空 | [桌面](1440-members-empty.png) | [手机](390-members-empty.png) |
| 长名称 | [桌面](1440-long-name.png) | [手机](390-long-name.png) |
| 图片加载失败 | [桌面](1440-image-failed.png) | [手机](390-image-failed.png) |
| 第二页 | [桌面](1440-page-two.png) | [手机](390-page-two.png) |
| 本页多选 | [桌面](1440-selected.png) | [手机](390-selected.png) |
| 跨页保留选择 | [桌面](1440-cross-page.png) | [手机](390-cross-page.png) |
| 选择均不在本页 | [桌面](1440-hidden-selection.png) | [手机](390-hidden-selection.png) |
| 筛选空草稿 | [桌面](1440-filter-open.png) | [手机](390-filter-open.png) |
| 筛选未应用 | [桌面](1440-filter-edited.png) | [手机](390-filter-edited.png) |
| 七项已应用 | [桌面](1440-filtered.png) | [手机](390-filtered.png) |
| 筛选无结果 | [桌面](1440-empty-filtered.png) | [手机](390-empty-filtered.png) |
| 全部机会为空 | [桌面](1440-empty-all.png) | [手机](390-empty-all.png) |
| 待采纳为空 | [桌面](1440-empty-recommended.png) | [手机](390-empty-recommended.png) |
| 规则候选为空 | [桌面](1440-empty-candidates.png) | [手机](390-empty-candidates.png) |
| 采集中为空 | [桌面](1440-empty-pending.png) | [手机](390-empty-pending.png) |
| 只读空列表 | [桌面](1440-empty-readonly.png) | [手机](390-empty-readonly.png) |
| 列表加载中 | [桌面](1440-loading.png) | [手机](390-loading.png) |
| 读取失败 | [桌面](1440-error.png) | [手机](390-error.png) |
| 登录过期 | [桌面](1440-expired.png) | [手机](390-expired.png) |
| 无访问权限 | [桌面](1440-forbidden.png) | [手机](390-forbidden.png) |
| 请求受阻 | [桌面](1440-blocked.png) | [手机](390-blocked.png) |
| 创建空表单 | [桌面](1440-create-open.png) | [手机](390-create-open.png) |
| 创建草稿 | [桌面](1440-create-edited.png) | [手机](390-create-edited.png) |
| 创建提交中 | [桌面](1440-create-busy.png) | [手机](390-create-busy.png) |
| 创建失败保留 | [桌面](1440-create-failed.png) | [手机](390-create-failed.png) |
| 创建成功跳转提示 | [桌面](1440-create-saved.png) | [手机](390-create-saved.png) |
| 指派影响预览 | [桌面](1440-assign-open.png) | [手机](390-assign-open.png) |
| 指派已填 | [桌面](1440-assign-edited.png) | [手机](390-assign-edited.png) |
| 指派提交中 | [桌面](1440-assign-busy.png) | [手机](390-assign-busy.png) |
| 指派失败 | [桌面](1440-assign-failed.png) | [手机](390-assign-failed.png) |
| 指派成功 | [桌面](1440-assign-saved.png) | [手机](390-assign-saved.png) |
| 复核影响预览 | [桌面](1440-review-open.png) | [手机](390-review-open.png) |
| 复核已填 | [桌面](1440-review-edited.png) | [手机](390-review-edited.png) |
| 复核提交中 | [桌面](1440-review-busy.png) | [手机](390-review-busy.png) |
| 复核失败 | [桌面](1440-review-failed.png) | [手机](390-review-failed.png) |
| 复核成功 | [桌面](1440-review-saved.png) | [手机](390-review-saved.png) |
| 归档影响预览 | [桌面](1440-archive-open.png) | [手机](390-archive-open.png) |
| 归档已填 | [桌面](1440-archive-edited.png) | [手机](390-archive-edited.png) |
| 归档提交中 | [桌面](1440-archive-busy.png) | [手机](390-archive-busy.png) |
| 归档失败 | [桌面](1440-archive-failed.png) | [手机](390-archive-failed.png) |
| 归档成功 | [桌面](1440-archive-saved.png) | [手机](390-archive-saved.png) |
| ERP 导入 | [桌面](1440-erp-open.png) | [手机](390-erp-open.png) |
| ERP 数量已填 | [桌面](1440-erp-edited.png) | [手机](390-erp-edited.png) |
| ERP 读取导入中 | [桌面](1440-erp-busy.png) | [手机](390-erp-busy.png) |
| ERP 关闭仍在进行 | [桌面](1440-erp-closed-busy.png) | [手机](390-erp-closed-busy.png) |
| 已打开 ERP 登录页 | [桌面](1440-erp-login-opened.png) | [手机](390-erp-login-opened.png) |
| ERP 登录失效 | [桌面](1440-erp-login-required.png) | [手机](390-erp-login-required.png) |
| 助手未就绪 | [桌面](1440-erp-helper-missing.png) | [手机](390-erp-helper-missing.png) |
| ERP JSON 无效 | [桌面](1440-erp-file-invalid.png) | [手机](390-erp-file-invalid.png) |
| ERP 导入失败 | [桌面](1440-erp-failed.png) | [手机](390-erp-failed.png) |
| ERP 导入返回计数 | [桌面](1440-erp-saved.png) | [手机](390-erp-saved.png) |

常规工作面为全页截图；弹窗主图只截当前视口，避免将视口外未遮罩内容当作真实模态效果。超过视口的弹窗另见下部图：

- [390-filter-open-lower.png](390-filter-open-lower.png)
- [390-filter-edited-lower.png](390-filter-edited-lower.png)
- [390-assign-busy-lower.png](390-assign-busy-lower.png)
- [390-assign-failed-lower.png](390-assign-failed-lower.png)
- [390-review-busy-lower.png](390-review-busy-lower.png)
- [390-archive-busy-lower.png](390-archive-busy-lower.png)

## 验证与未覆盖

运行永久脚本：`node scripts/verify-ui-phase2-opportunity-c.mjs`；显式重新生成用同命令加 `--capture`。默认不改文件，会复核源/数据/126张图哈希以及双端交互。浏览器在 finally 关闭，不启动服务；内存 JSON 测试不写临时文件。所有 PNG 为用户审核交付，不清理。

本批未改 Vue、API/OpenAPI、依赖、配置、数据库、旧图、coverage 或审批记录，无部署/重启。六弹窗的 required/取消/归还、三个批量精确 body、两文件结构、ERP 关闭不断言取消、只读/成员失败及范围计数已有隔离验证；完整屏幕阅读器、200%缩放、软键盘、三主题两密度、KeepAlive/跨范围迟到响应、真实 MySQL/Origin/幂等/ERP/生产仍待验。原型不能注销 OP06–OP10 或全站 G0–G5。

下一业务面 P16 创建选品流程；P15 具体审稿、真实 Vue 实现与全 73 页交付继续。
