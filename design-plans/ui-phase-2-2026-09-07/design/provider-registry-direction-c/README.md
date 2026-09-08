# P46 来源设置 · PROVIDER-REGISTRY-C-r1

2026-09-09，63场景双端126主图＋50长窗中段/底部，共176PNG（含2审核工具图）。C方向具体图稿待审，不是Vue或生产页面。主视口1440×1000、390×844；列表fullPage，弹窗按可见区域连续分段采图，50局部图不计新页面。

[打开交互审核稿](index.html?review=1) · [页面规格](../../page-specs/P46.md) · [证据清单](evidence.json)

## 结构重构与技能选择

frontend-design指导“来源目录→四步配置”：蓝色来源导航配白色定义列表；编辑窗口蓝色步骤/身份与白色当前组字段分开，不沿用旧四张大指标卡。保持C的蓝#254a9c、白#ffffff、灰#edf1f6、正文#202c3d、说明#58677b、异常#8c3c32。系统中文字体左对齐，表单控件16px、元数据至少13px、44px热区，焦点有轮廓。蓝图的烟测/启用流程差异PR-G01不在本稿擅自裁决。

原列表七列保留全部信息，列设置/至少一列/冻结首可见列/两密度仍为内存状态。“操作”是旧空标题第7列的可读名称提案。手机使用摘要→详情→编辑，不新造页面路由；native dialog和明确Tab循环替代源自建遮罩的未证实焦点约束。四步仍为基本信息、范围与字段、执行策略、合规与发布。字段/失败规则长逗号串用多行阅读，仍只按英文逗号分项，换行不另作分隔符。目标/条款/健康地址不会真的访问。

## 原始事实与业务边界

原E2E夹具25条（原定义、待复核定义与原测试的23个扩展），全局25/1已启用/1公开受阻/24未进入调度；每页20，第二页5。原数组不改数，所有合成准入变体和表单草稿单列。审核固定2026-09-09T01:20:00Z，不把合规资料未来有效推成采集成功。

GET /api/v1/platform/providers返回全目录，搜索只含名称、code、负责人、市场、语言，不匹配目标URL；三种排序与五控件按实际computed。定义enabled不是运行成功，公开条款齐备、运行时登录、等待导入/人工、未调度与受阻分开。没有删除、直接启停、烟测、健康检查或解除熔断按钮。

创建POST、版本更新PUT /api/v1/platform/providers/{id}；更新携带expected_version。既有真实客户端的前缀/Origin/幂等/认证不在离线稿重造。源路由GET和写都检查provider:configure，写另查Origin和幂等，不能用导航capability数组代替真实授权。五导航只记录精确路由意图，并明确目标另交，未发真实跳转；当前夹具身份超级管理员，其他身份/允许拒绝待验。

23字段分组5/6/7/5，使用实际源码的formErrors、applyTemplate及buildRequest转换，不额外添加reason。六整数边界、字符串/列表约束、模板五模式都保持。步骤按钮允许直接跳；下一步校验当前组，Enter最终校验全表并定位最早错误，最后保存有错误/busy禁用。关闭不代表撤销在途写入。

## 已复现问题与提案区别

- 源edit展开item、save展开form，因此PUT带只读属性，编辑后新建还可残留id/version/updated_at/terms_reviewed_at。本稿保持精确body，不把23可编辑字段说成请求白名单；字段清理需后续合同确认。
- 源UTC到期值先slice(0,16)，按Asia/Shanghai再转ISO造成8小时差异，单独出图；没有默默改变时区格式。
- 惰性请求复现：旧保存成功关闭新窗口，保存后的load失败仍显示“列表已刷新”；允许abort后resolve的测试请求还可覆盖较新读取。不是证明所有真实网络都这样执行，但证明源成功分支缺少身份检查。
- 原型中窗口代次、读取身份、保存结果与重读分离、未知结果暂停再次提交均为提案保护；不是生产修复。409保留输入、不自动重试；旧结果不覆盖新草稿。成功回执只是合成事件，重读继续用原25夹具，不伪造新记录。
- 刷新401/403仍保留旧数组，稿中明确旧快照不是本次读取成功或访问许可。状态primary按现有load意图改为“重新读取来源”，不谎称登录/返回工作台；无消费者的secondary不在提案显示。源UiStatePanel与其他消费者未改。
- PR-G01启用门、真实权限/事务/幂等/审计、日期修正规则、持久化字段清理、完整生命周期与全主题仍未决，不借UI稿关闭它们。

## 全部截图

| 场景 | 对应图 |
| --- | --- |
| 原始目录第一页 | [桌面](1440-default.png) / [移动](390-default.png) |
| 原始目录第二页 | [桌面](1440-page-two.png) / [移动](390-page-two.png) |
| 名称/编码搜索 | [桌面](1440-search.png) / [移动](390-search.png) |
| 状态筛选 | [桌面](1440-status-filter.png) / [移动](390-status-filter.png) |
| 方式筛选 | [桌面](1440-mode-filter.png) / [移动](390-mode-filter.png) |
| 准入筛选 | [桌面](1440-admission-filter.png) / [移动](390-admission-filter.png) |
| 更新排序 | [桌面](1440-sort-updated.png) / [移动](390-sort-updated.png) |
| 准入排序 | [桌面](1440-sort-admission.png) / [移动](390-sort-admission.png) |
| 过滤零结果 | [桌面](1440-no-match.png) / [移动](390-no-match.png) |
| 七列设置 | [桌面](1440-columns.png) / [移动](390-columns.png) |
| 紧凑表格 | [桌面](1440-compact.png) / [移动](390-compact.png) |
| 取消首列冻结 | [桌面](1440-unfrozen.png) / [移动](390-unfrozen.png) |
| 记录预览 | [桌面](1440-preview.png) / [移动](390-preview.png) |
| 预览技术详情 | [桌面](1440-preview-tech.png) / [桌面 bottom](1440-preview-tech--bottom.png) / [移动](390-preview-tech.png) / [移动 bottom](390-preview-tech--bottom.png) |
| 首次加载 | [桌面](1440-loading.png) / [移动](390-loading.png) |
| 空目录 | [桌面](1440-empty.png) / [移动](390-empty.png) |
| 读取失败 | [桌面](1440-error.png) / [移动](390-error.png) |
| 权限错误 | [桌面](1440-forbidden.png) / [移动](390-forbidden.png) |
| 会话过期 | [桌面](1440-expired.png) / [移动](390-expired.png) |
| 依赖受阻 | [桌面](1440-blocked.png) / [移动](390-blocked.png) |
| 后台读取 | [桌面](1440-refreshing.png) / [移动](390-refreshing.png) |
| 刷新失败 | [桌面](1440-refresh-error.png) / [移动](390-refresh-error.png) |
| 刷新权限错误 | [桌面](1440-refresh-forbidden.png) / [移动](390-refresh-forbidden.png) |
| 刷新会话错误 | [桌面](1440-refresh-expired.png) / [移动](390-refresh-expired.png) |
| 保存中 | [桌面](1440-save-busy.png) / [桌面 bottom](1440-save-busy--bottom.png) / [移动](390-save-busy.png) / [移动 part-1](390-save-busy--part-1.png) / [移动 bottom](390-save-busy--bottom.png) |
| 版本冲突 | [桌面](1440-save-conflict.png) / [桌面 bottom](1440-save-conflict--bottom.png) / [移动](390-save-conflict.png) / [移动 part-1](390-save-conflict--part-1.png) / [移动 bottom](390-save-conflict--bottom.png) |
| 保存失败 | [桌面](1440-save-error.png) / [桌面 bottom](1440-save-error--bottom.png) / [移动](390-save-error.png) / [移动 part-1](390-save-error--part-1.png) / [移动 bottom](390-save-error--bottom.png) |
| 保存及重读成功 | [桌面](1440-save-success.png) / [移动](390-save-success.png) |
| 保存成功重读失败 | [桌面](1440-save-reload-failed.png) / [移动](390-save-reload-failed.png) |
| 保存结果未知 | [桌面](1440-save-unknown.png) / [桌面 bottom](1440-save-unknown--bottom.png) / [移动](390-save-unknown.png) / [移动 part-1](390-save-unknown--part-1.png) / [移动 bottom](390-save-unknown--bottom.png) |
| 迟到结果保护 | [桌面](1440-late-result.png) / [移动](390-late-result.png) / [移动 bottom](390-late-result--bottom.png) |
| 编辑后转创建残留 | [桌面](1440-edit-to-create.png) / [桌面 bottom](1440-edit-to-create--bottom.png) / [移动](390-edit-to-create.png) / [移动 part-1](390-edit-to-create--part-1.png) / [移动 bottom](390-edit-to-create--bottom.png) |
| 日期时区差异 | [桌面](1440-date-roundtrip.png) / [桌面 bottom](1440-date-roundtrip--bottom.png) / [移动](390-date-roundtrip.png) / [移动 part-1](390-date-roundtrip--part-1.png) / [移动 bottom](390-date-roundtrip--bottom.png) |
| 按钮悬停 | [桌面](1440-hover.png) / [移动](390-hover.png) |
| 键盘焦点 | [桌面](1440-focus.png) / [移动](390-focus.png) |
| 按钮按下 | [桌面](1440-pressed.png) / [移动](390-pressed.png) |
| 非业务审核工具 | [桌面](1440-review-tool.png) / [移动](390-review-tool.png) |
| 创建第1 | [桌面](1440-create-1.png) / [移动](390-create-1.png) / [移动 bottom](390-create-1--bottom.png) |
| 创建第2 | [桌面](1440-create-2.png) / [移动](390-create-2.png) / [移动 bottom](390-create-2--bottom.png) |
| 创建第3 | [桌面](1440-create-3.png) / [移动](390-create-3.png) / [移动 part-1](390-create-3--part-1.png) / [移动 bottom](390-create-3--bottom.png) |
| 创建第4 | [桌面](1440-create-4.png) / [移动](390-create-4.png) / [移动 part-1](390-create-4--part-1.png) / [移动 bottom](390-create-4--bottom.png) |
| 编辑第1 | [桌面](1440-edit-1.png) / [移动](390-edit-1.png) / [移动 bottom](390-edit-1--bottom.png) |
| 编辑第2 | [桌面](1440-edit-2.png) / [移动](390-edit-2.png) / [移动 bottom](390-edit-2--bottom.png) |
| 编辑第3 | [桌面](1440-edit-3.png) / [移动](390-edit-3.png) / [移动 part-1](390-edit-3--part-1.png) / [移动 bottom](390-edit-3--bottom.png) |
| 编辑第4 | [桌面](1440-edit-4.png) / [移动](390-edit-4.png) / [移动 part-1](390-edit-4--part-1.png) / [移动 bottom](390-edit-4--bottom.png) |
| 模板 public_page | [桌面](1440-template-public_page.png) / [移动](390-template-public_page.png) / [移动 part-1](390-template-public_page--part-1.png) / [移动 bottom](390-template-public_page--bottom.png) |
| 模板 public_rss | [桌面](1440-template-public_rss.png) / [移动](390-template-public_rss.png) / [移动 part-1](390-template-public_rss--part-1.png) / [移动 bottom](390-template-public_rss--bottom.png) |
| 模板 authenticated_browser | [桌面](1440-template-authenticated_browser.png) / [移动](390-template-authenticated_browser.png) / [移动 part-1](390-template-authenticated_browser--part-1.png) / [移动 bottom](390-template-authenticated_browser--bottom.png) |
| 模板 import | [桌面](1440-template-import.png) / [移动](390-template-import.png) / [移动 part-1](390-template-import--part-1.png) / [移动 bottom](390-template-import--bottom.png) |
| 模板 manual | [桌面](1440-template-manual.png) / [移动](390-template-manual.png) / [移动 part-1](390-template-manual--part-1.png) / [移动 bottom](390-template-manual--bottom.png) |
| 准入 disabled | [桌面](1440-admission-disabled.png) / [移动](390-admission-disabled.png) |
| 准入 pending | [桌面](1440-admission-pending.png) / [移动](390-admission-pending.png) |
| 准入 approved | [桌面](1440-admission-approved.png) / [移动](390-admission-approved.png) |
| 准入 rejected | [桌面](1440-admission-rejected.png) / [移动](390-admission-rejected.png) |
| 准入 missing | [桌面](1440-admission-missing.png) / [移动](390-admission-missing.png) |
| 准入 expired | [桌面](1440-admission-expired.png) / [移动](390-admission-expired.png) |
| 准入 browser | [桌面](1440-admission-browser.png) / [移动](390-admission-browser.png) |
| 准入 import | [桌面](1440-admission-import.png) / [移动](390-admission-import.png) |
| 准入 manual | [桌面](1440-admission-manual.png) / [移动](390-admission-manual.png) |
| 校验第1 | [桌面](1440-errors-1.png) / [移动](390-errors-1.png) / [移动 bottom](390-errors-1--bottom.png) |
| 校验第2 | [桌面](1440-errors-2.png) / [移动](390-errors-2.png) / [移动 part-1](390-errors-2--part-1.png) / [移动 bottom](390-errors-2--bottom.png) |
| 校验第3 | [桌面](1440-errors-3.png) / [移动](390-errors-3.png) / [移动 part-1](390-errors-3--part-1.png) / [移动 bottom](390-errors-3--bottom.png) |
| 校验第4 | [桌面](1440-errors-4.png) / [移动](390-errors-4.png) / [移动 part-1](390-errors-4--part-1.png) / [移动 bottom](390-errors-4--bottom.png) |

## 验证、使用和收尾

在仓库根目录执行 `node scripts/verify-ui-phase2-provider-registry-c.mjs`，核对源码/原型LF SHA-256、提取数据、源逻辑派生文件、176PNG哈希及精确清单，再运行双端交互；不加参数不会改图。原型变化后加 `--capture` 重新采图，再人工检查和无参数复验。source-logic.js是实际ProviderRegistry脚本派生的离线桥接，不手改；data.js由永久helper提取。

源函数离线检查：三种完整排序ID序列、20/5分页、搜索边界、准入九变体、23字段校验/六数值上下限/列表上限/五模板、精确POST/PUT及残留、旧保存/旧读取复现；真实服务惰性验证数组去重、版本和公开启用条款。仓库事务仅源码追踪，未执行SQL。

浏览器检查：七列与最后一列保护、冻结/密度、五筛选、四步23字段、五模式POST意图、PUT版本及日期、保存单次/409/失败/未知/迟到、每端14种读取结果、移动预览→编辑/关闭回焦点、Tab/ShiftTab、320/759/760/761/768/1024与200% CSS zoom列表/编辑。HTTP/console/pageerror/存储为0。首次原型场景命名/步骤渲染错误已修，编辑后新建的残留与全新创建测试隔离，不能把这个源差异当测试噪声删掉。

未验证真实Vue挂载、API、MySQL、RBAC、目标采集、完整缓存/卸载/历史/移动软键盘/辅助技术、全主题密度组合及生产。测试浏览器finally关闭，未启动开发服务，无临时验证文件；176图、原型和永久验证器是交付物。业务源码、API/OpenAPI、数据库、env、依赖和部署未改，无重启要求。

## 审核与后续

请审核PROVIDER-REGISTRY-C-r1的列表密度、四步阅读、移动详情及保存/重读提示；未回复不算通过。启用流程和请求/日期差异在真正实现前仍需确认。下一P47采集程序继续出图；全73页正式稿审批、Vue重构、真实测试、宝塔部署和签收均未完成。
