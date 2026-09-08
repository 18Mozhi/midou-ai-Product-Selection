# 组织管理 C 方向连贯审核稿

版本：PLATFORM-ORGANIZATIONS-C-r1；日期：2026-09-09；P40 / P41 / P42；具体稿待用户审核，未部署。

[打开交互原型](index.html) · [验证证据](evidence.json)

本批 46 场景 × 1440/390 双视口，另有 10 张长弹窗下部图，共 102 PNG。全部为离线审核材料，不是生产截图。原测试夹具全局组织 3、启用 2，实际返回 1 条；不拼接成全量清单。12 行、长文本、零值、停用、失败和缺失变体明确属于合成布局/状态测试。

## 设计与审核重点

使用 ui-skills-root 路由到 frontend-design，按 C 方向重排管理目录、事实、表单及安全动作，不沿用旧卡片格布局。色彩：目录蓝 #254a9c、白纸 #ffffff、页面灰 #edf1f6、正文 #202c3d、次级 #58677b、风险 #8c3c32。字体使用已安装的 Microsoft YaHei UI / Microsoft YaHei；30/24/18/16/14 层级，主内容左对齐，不安装字体或依赖。

```text
P40  蓝色管理目录 | 白色组织列表
                    ├ 新建组织 → P41 蓝色两步进度 | 白色资料与确认
                    └ 桌面详情 / 手机预览 → P42 蓝色组织身份 | 白色可编辑资料
                                                            └ 保存 / 停用 / 恢复 → 目标与原因确认
```

保留路由驱动原生弹窗，不将创建擅自变成独立页面；手机先预览再进入详情。数量事实与编辑资料分开，停用组织不与保存资料混排。保留新建用户五字段入口、显示列/冻结/密度、查询状态和移动筛选。缺失计数不补成 1；列表找不到目标不直接宣称已删除或无权限。

请重点审核：蓝色身份区与白色工作区的比例、组织列表信息密度、两步创建节奏、详情与停用的分区、原因窗的目标辨识及手机长表单。方向选择 C 不等于本批具体稿获批。

## 真实合同与提案边界

- GET /api/v1/platform/accounts 使用 query/status，最多 200 条；组织查询为名称/slug，不扩成邮箱。全局摘要独立于筛选。原型的本地包含匹配只是展示，不能证明 MySQL LIKE、排序或权限。
- POST /api/v1/platform/accounts/organizations：name、slug，选定时才带 initial_admin_user_id；不新增原因。当前服务默认管理员为操作者；名称 2–120、标识 2–63，尾部连字符允许。初始管理员候选仍受当前概览用户返回范围约束，停用用户不可选。
- 创建同时建立组织/默认工作区/管理员关系/数据范围是仓库源码事实，本次没有执行事务或审计。最小响应不含成员/工作区计数，不显示伪造的 1。
- PATCH /api/v1/platform/accounts/organizations/{id}：name、timezone、data_retention_days、reason。时区仅依据当前非空/64 字符合同，不新增 IANA 验证；天数为 30–3650 整数。
- POST /api/v1/platform/accounts/organizations/{id}/status：status（active/archived）、reason。三类原因 trim 后 2–300，不引入 expected_version。
- 真实父函数惰性执行复现：保存原因确认使用当时 selected.id 与表单，可能偏离打开确认时目标。原型锁定目标/表单快照并保护关闭后迟到结果；仅为待审核提案，非生产修复。
- 创建和详情仍沿用真实 route 意图；本地 file 原型通过 route 查询参数记录它，并非 Vue Router。关闭创建/详情返回裸组织列表。完整浏览器前进后退、KeepAlive、打开窗口跨断点、原生缩放、主题/密度全矩阵及真实权限中断未验证。
- 原型没有实际 API 请求。点击写入后保持处理中，使用浏览器控制台 `ORGANIZATIONS_C.complete()` 或 `ORGANIZATIONS_C.complete("error")` 提供合成结果；底部审核工具也提供模拟入口，但原生模态打开时背景不可操作。不要据此认为真实写入已成功。
- 列表“刷新”是当前夹具的本地重筛选，不模拟完整请求/超时生命周期；loading/error/timeout 场景用于视觉审核。读取成功后的真实表单合并、超过 200 条定位和筛选排除时详情恢复仍待实际 Vue 验证。用户/管理员管理导航明确链接到下一页规格，不计其图稿已完成。

## 验证与交付

```powershell
node scripts/verify-ui-phase2-platform-organizations-c.mjs --capture
node scripts/verify-ui-phase2-platform-organizations-c.mjs
```

capture 为正式图包生成命令；无参数验证源码/数据/PNG 哈希、精确截图清单和实际离线交互。永久 source helper 从原 E2E 抽取夹具，惰性执行服务校验及父组件函数；不是挂载 Vue、接口/数据库/RBAC、邮件、MFA 或 OS 剪贴板实测。检查双端完整基本链、三种写入方法/body、原因裁剪、非法标识/天数、停用管理员、取消草稿、旧结果不关闭新窗、Tab/Escape、标签/ID/横向溢出、760/768/1024 局部断点；HTTP、console error、pageerror 和持久化存储均为 0。

产物均为本次要求的永久设计图包/验证脚本；没有临时测试文件、开发服务或部署进程。所有自有浏览器 context/browser 在 finally 关闭。生产 Vue、API、MySQL、环境变量、权限及依赖未改，无须重启。全 73 页具体稿审核、Vue 实现、BaoTa 部署及签收仍未完成，下一组为 P43 用户管理和 P44 平台管理员管理。

## 全图索引

- [1440 / list](1440-list.png)
- [1440 / many](1440-many.png)
- [1440 / long](1440-long.png)
- [1440 / zero](1440-zero.png)
- [1440 / empty](1440-empty.png)
- [1440 / filtered_empty](1440-filtered_empty.png)
- [1440 / archived](1440-archived.png)
- [1440 / loading](1440-loading.png)
- [1440 / error](1440-error.png)
- [1440 / timeout](1440-timeout.png)
- [1440 / refreshing](1440-refreshing.png)
- [1440 / refresh_error](1440-refresh_error.png)
- [1440 / filter](1440-filter.png)
- [1440 / columns](1440-columns.png)
- [1440 / compact](1440-compact.png)
- [1440 / preview](1440-preview.png)
- [1440 / preview_technical](1440-preview_technical.png)
- [1440 / create](1440-create.png)
- [1440 / create_filled](1440-create_filled.png)
- [1440 / create_confirm](1440-create_confirm.png)
- [1440 / create_admin](1440-create_admin.png)
- [1440 / create_inactive](1440-create_inactive.png)
- [1440 / create_invalid](1440-create_invalid.png)
- [1440 / create_error](1440-create_error.png)
- [1440 / create_busy](1440-create_busy.png)
- [1440 / create_minimal](1440-create_minimal.png)
- [1440 / detail](1440-detail.png)
- [1440 / detail_archived](1440-detail_archived.png)
- [1440 / detail_unknown](1440-detail_unknown.png)
- [1440 / detail_technical](1440-detail_technical.png)
- [1440 / detail_missing](1440-detail_missing.png)
- [1440 / detail_invalid](1440-detail_invalid.png)
- [1440 / save_reason](1440-save_reason.png)
- [1440 / disable_reason](1440-disable_reason.png)
- [1440 / restore_reason](1440-restore_reason.png)
- [1440 / reason_invalid](1440-reason_invalid.png)
- [1440 / update_busy](1440-update_busy.png)
- [1440 / update_error](1440-update_error.png)
- [1440 / update_success](1440-update_success.png)
- [1440 / user](1440-user.png)
- [1440 / user_org](1440-user_org.png)
- [1440 / user_error](1440-user_error.png)
- [1440 / user_busy](1440-user_busy.png)
- [1440 / focus](1440-focus.png)
- [1440 / hover](1440-hover.png)
- [1440 / pressed](1440-pressed.png)
- [390 / list](390-list.png)
- [390 / many](390-many.png)
- [390 / long](390-long.png)
- [390 / zero](390-zero.png)
- [390 / empty](390-empty.png)
- [390 / filtered_empty](390-filtered_empty.png)
- [390 / archived](390-archived.png)
- [390 / loading](390-loading.png)
- [390 / error](390-error.png)
- [390 / timeout](390-timeout.png)
- [390 / refreshing](390-refreshing.png)
- [390 / refresh_error](390-refresh_error.png)
- [390 / filter](390-filter.png)
- [390 / columns](390-columns.png)
- [390 / compact](390-compact.png)
- [390 / preview](390-preview.png)
- [390 / preview_technical](390-preview_technical.png)
- [390 / create](390-create.png)
- [390 / create_filled](390-create_filled.png)
- [390 / create_confirm](390-create_confirm.png)
- [390 / create_admin](390-create_admin.png)
- [390 / create_inactive](390-create_inactive.png)
- [390 / create_invalid](390-create_invalid.png)
- [390 / create_error](390-create_error.png)
- [390 / create_error / 滚动下部](390-create_error-bottom.png)
- [390 / create_busy](390-create_busy.png)
- [390 / create_minimal](390-create_minimal.png)
- [390 / create_minimal / 滚动下部](390-create_minimal-bottom.png)
- [390 / detail](390-detail.png)
- [390 / detail / 滚动下部](390-detail-bottom.png)
- [390 / detail_archived](390-detail_archived.png)
- [390 / detail_archived / 滚动下部](390-detail_archived-bottom.png)
- [390 / detail_unknown](390-detail_unknown.png)
- [390 / detail_unknown / 滚动下部](390-detail_unknown-bottom.png)
- [390 / detail_technical](390-detail_technical.png)
- [390 / detail_technical / 滚动下部](390-detail_technical-bottom.png)
- [390 / detail_missing](390-detail_missing.png)
- [390 / detail_invalid](390-detail_invalid.png)
- [390 / detail_invalid / 滚动下部](390-detail_invalid-bottom.png)
- [390 / save_reason](390-save_reason.png)
- [390 / disable_reason](390-disable_reason.png)
- [390 / restore_reason](390-restore_reason.png)
- [390 / reason_invalid](390-reason_invalid.png)
- [390 / update_busy](390-update_busy.png)
- [390 / update_busy / 滚动下部](390-update_busy-bottom.png)
- [390 / update_error](390-update_error.png)
- [390 / update_error / 滚动下部](390-update_error-bottom.png)
- [390 / update_success](390-update_success.png)
- [390 / update_success / 滚动下部](390-update_success-bottom.png)
- [390 / user](390-user.png)
- [390 / user_org](390-user_org.png)
- [390 / user_error](390-user_error.png)
- [390 / user_busy](390-user_busy.png)
- [390 / focus](390-focus.png)
- [390 / hover](390-hover.png)
- [390 / pressed](390-pressed.png)
