# P36 组织令牌 · ORG-TOKEN-C-r1

状态：C方向独立审核稿，具体页面尚未获审；不是实际Vue实现、生产验证或部署报告。

[打开交互原型](index.html)。直接打开，无需服务；顶部“审核场景”切换54场景。所有请求只记录意图，所有明文为无效合成字符串，复制走内存演示适配器，不读取或写入系统剪贴板。

## 设计与复核

frontend-design用于把生命周期目录、最小权限创建与一次性明文拆成三个独立阅读区域。蓝色页内目录与白色全宽记录面，先用途/状态/范围，再期限/调用与技术详情；轮换和撤销保留不同危险说明。创建为独立内联分区，不沿用旧ACCESS LEDGER布局，也不虚构创建弹窗。

沿用户C色板：#254a9c蓝、#193b80深蓝、#202c3d正文、#58677b辅助、#edf1f6底色、#dbe1e9分隔及白色；Microsoft YaHei UI / Microsoft YaHei。控件16px/44px、辅助至少13px，短按钮反馈尊重reduced-motion。手机筛选折叠、字段堆叠，明文换行不撑宽，原因窗标题与底部按钮独立于可滚动正文。已目检桌面目录及手机长表单、明文、长原因；补4张局部图便于放大审核，不用缩小的整页图代替细节。

## 逐项控件与真实合同

| 控件 | 范围及行为 |
| --- | --- |
| 生命周期/创建令牌目录 | 仅页内定位；顶部创建按钮聚焦名称，没有创建打开/取消业务接口 |
| 五项计数 | 已返回8条、状态active6、临期1、活动从未调用1、非active历史2，不按当前筛选重算 |
| 搜索 | 名称、前缀、中文状态与scope标签；trim忽略大小写，不扩展技术ID |
| 生命周期 | all/active/expiring/never_used/revoked/rotated/expired，未知状态原值可读，不提供危险动作 |
| 读取范围 | all及四固定scope，不造自定义授权 |
| 排序 | created_desc/expires_asc/last_used_desc/name_asc/status_asc，5种完整ID顺序与源computed结果对照 |
| 重置/清除筛选 | 恢复默认、回第一页；原型展开输入并归还焦点 |
| 上一页/下一页 | 每页6条，夹紧缩页，原始8条分6/2；不是服务端分页 |
| 技术详情 | 原生details展示记录ID/version/updated_at，Enter可开关 |
| 名称 | trim后1–120字符，不默认业务名称 |
| 四范围复选 | task:read/trend:read/opportunity:read/report:read，至少一个，默认全不选 |
| 有效期输入/快捷 | 整数1–365天，默认90；30/90/180/365快捷。浏览器预计到期不是服务器响应 |
| 创建原因 | trim后1–500字符；失败保留草稿，成功清空并恢复90天、无scope |
| 创建提交 | POST /org/admin/tokens，精确name/scopes/ttl_days/reason；处理中防重复，刷新期间也禁用写操作 |
| 轮换密钥 | 仅active；空白原因窗，旧记录失效并成为rotated，新ID/新secret继承名称和scope |
| 撤销访问 | 仅active；空白原因窗，原记录变revoked，不可恢复；不删除成员账号 |
| 原因输入/关闭/取消/确认 | 2–500字符提案；Tab双边界、Escape/关闭/取消零写入并返焦；确认即关窗，失败重开空白，不虚构保留原因 |
| 两动作提交 | POST /org/admin/tokens/:id/actions，精确action/expected_version/reason；轮换期限由后端配置决定，不跟创建表单 |
| 复制明文 | 仅当前合成响应的反馈；复制成功/拒绝分别展示，不写OS剪贴板 |
| 我已安全保存 | 清除当前明文及其异步反馈归属，不提供找回 |
| 刷新/重新加载 | 记录GET /org/admin/summary和/org/admin/tokens意图；不更新原型列表事实 |
| 审核场景 | 非业务工具，可查看不含secret的请求意图，不进入生产 |

需要organization_token:manage；父摘要另需organization:manage。没有编辑scope、恢复已撤销令牌、明文找回、批量下载、删除令牌或新增权限类型。当前前后端、OpenAPI、数据库、权限、配置和依赖均不改。

## 一次性明文与已发现边界

- 列表不返回secret；仓库只保留hash/prefix，finish会从审计、幂等记录结果与outbox剔除secret。本轮只读代码核对，未执行MySQL、真实幂等或审计写入。
- GET tokens实际先把当前组织到期active记录改为expired、version加一，再读列表；不能宣称该GET对数据库绝无写入，本原型没有调用它。
- 原始8条m06-01夹具不包含已过期状态；过期、未知、长字段和失败状态明确为合成。固定审核时钟2026-08-26 18:00（上海）用于临期验证，不是当前时间或生产快照。
- 源daysUntil使用ceil；过期1小时返回负零，仍进入0–7临期筛选；过期1天不计临期，但源文案同样“今天到期”。本稿保留计数/筛选算法，过去实际时间提示“已到期，等待刷新核验”，不自行更改status；这是待审提示修订。
- OG-G05已用实际copySecret复现：旧明文复制Promise未完成时替换secret并执行watch重置，旧Promise完成仍把新明文标为copied。本稿用展示代次和明文归属保护反馈；迟到复制不会重绘新界面。生产尚未修复。
- 实际父submit/dismiss函数离线执行三场景：成功后离开返回、离开后迟到响应、刷新期间主动清除；保持旧代次明文不再显示。不等于实际Vue KeepAlive、组织切换、卸载及所有异步路径已全面验证。
- 原共享原因窗只有最短2字符；后端要求最长500。本稿maxlength500为待审前端校验提案，不声称源组件已有。创建处理中禁用草稿字段、未知结果暂停重复写、写成功与重读失败分开也只在原型。
- 原型合成成功不补造新记录或改变旧列表；轮换新期限遵从后端配置。服务构造默认90天/20个活动令牌仅为代码默认，实际环境可覆盖，页面不宣称线上上限固定20。
- URL为org_token_query/status/scope/sort/page。初始文本200上限、页码正安全整数、非法选项回默认；默认值移除且保留无关query。源watch只refs到router.replace，无反向route.query恢复，完整浏览器前进/后退尚未证明。
- secret不进入URL、意图日志、cookies、localStorage或sessionStorage。原型和源函数夹具仅使用明显无效合成值，不读取生产密钥。

## 全部图片

54场景×桌面1440/手机390＝108主图，另4张局部详图，共 **112 PNG**（含2非业务工具图）。普通状态整页、原因窗视口截图；hover/pressed/focus由浏览器实际触发。长输入显示原生滚动可见部分，不声称一张图能展示所有500字符。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始生命周期目录 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 第二页 | [查看](1440-page_two.png) | [查看](390-page_two.png) |
| 名称搜索 | [查看](1440-search.png) | [查看](390-search.png) |
| 中文读取范围搜索 | [查看](1440-scope_search.png) | [查看](390-scope_search.png) |
| 读取范围筛选 | [查看](1440-scope_filter.png) | [查看](390-scope_filter.png) |
| 正常使用筛选 | [查看](1440-active.png) | [查看](390-active.png) |
| 七天内到期 | [查看](1440-expiring.png) | [查看](390-expiring.png) |
| 从未调用 | [查看](1440-never_used.png) | [查看](390-never_used.png) |
| 已撤销 | [查看](1440-revoked.png) | [查看](390-revoked.png) |
| 已轮换 | [查看](1440-rotated.png) | [查看](390-rotated.png) |
| 已过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 暂无令牌 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 筛选空 | [查看](1440-filter_empty.png) | [查看](390-filter_empty.png) |
| 未知状态和scope | [查看](1440-unknown.png) | [查看](390-unknown.png) |
| 长名称 | [查看](1440-long_name.png) | [查看](390-long_name.png) |
| 已过期但列表仍active | [查看](1440-past_expiry.png) | [查看](390-past_expiry.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 创建空表单 | [查看](1440-create.png) | [查看](390-create.png) |
| 最小权限草稿 | [查看](1440-create_draft.png) | [查看](390-create_draft.png) |
| 四只读scope | [查看](1440-create_all_scopes.png) | [查看](390-create_all_scopes.png) |
| 必填错误 | [查看](1440-create_required.png) | [查看](390-create_required.png) |
| 未选择scope | [查看](1440-create_scope_error.png) | [查看](390-create_scope_error.png) |
| 期限越界 | [查看](1440-create_ttl_error.png) | [查看](390-create_ttl_error.png) |
| 长度边界 | [查看](1440-create_long.png) | [查看](390-create_long.png) |
| 创建处理中 | [查看](1440-create_busy.png) | [查看](390-create_busy.png) |
| 创建失败留草稿 | [查看](1440-create_failure.png) | [查看](390-create_failure.png) |
| 活动数量上限 | [查看](1440-create_limit.png) | [查看](390-create_limit.png) |
| 创建结果未知 | [查看](1440-create_unknown.png) | [查看](390-create_unknown.png) |
| 一次性合成明文 | [查看](1440-secret.png) | [查看](390-secret.png) |
| 合成复制成功 | [查看](1440-copy_success.png) | [查看](390-copy_success.png) |
| 浏览器拒绝复制 | [查看](1440-copy_failure.png) | [查看](390-copy_failure.png) |
| 主动清除明文 | [查看](1440-secret_dismissed.png) | [查看](390-secret_dismissed.png) |
| 轮换原因窗 | [查看](1440-reason_rotate.png) | [查看](390-reason_rotate.png) |
| 撤销原因窗 | [查看](1440-reason_revoke.png) | [查看](390-reason_revoke.png) |
| 原因过短 | [查看](1440-reason_short.png) | [查看](390-reason_short.png) |
| 长原因 | [查看](1440-reason_long.png) | [查看](390-reason_long.png) |
| 动作处理中 | [查看](1440-action_busy.png) | [查看](390-action_busy.png) |
| 动作失败 | [查看](1440-action_failure.png) | [查看](390-action_failure.png) |
| 版本冲突 | [查看](1440-action_conflict.png) | [查看](390-action_conflict.png) |
| 合成轮换响应 | [查看](1440-rotate_success.png) | [查看](390-rotate_success.png) |
| 合成撤销响应 | [查看](1440-revoke_success.png) | [查看](390-revoke_success.png) |
| 写后重读失败 | [查看](1440-write_read_failed.png) | [查看](390-write_read_failed.png) |
| 离开后迟到响应 | [查看](1440-late_response.png) | [查看](390-late_response.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 登录失效 | [查看](1440-session_expired.png) | [查看](390-session_expired.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 后台刷新 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 创建按钮悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 创建按钮按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 创建按钮焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |
| 创建表单局部 | [查看](1440-create_draft-detail.png) | [查看](390-create_draft-detail.png) |
| 明文区局部 | [查看](1440-secret-detail.png) | [查看](390-secret-detail.png) |

## 如何使用、调整与验证

打开index.html审核。tokens.css调整样式，tokens.js调整原型交互；data.js从原夹具与源函数验证结果生成，不补造生产事实。无需新参数、环境文件、服务或重启。

仓库根目录运行 `node scripts/verify-ui-phase2-org-token-c.mjs`：先核对源/数据/图片hash，再执行双端交互。修改原型后加 `--capture` 重采，再无参数复验。复用现有Playwright，未安装依赖。

覆盖54场景双端、5排序与源ID序列、6/2分页/筛选/URL重载、四scope与创建必填/TTL边界/精确body/成功清空/失败保留/未知阻重复；两个原因变体各三取消与返焦、Tab两边界、空白/最短原因、精确body、冲突后重开；合成复制成功/失败/替换/清除/离开、旧写响应隔离和写后读失败。768/1024补测普通/长名称/长表单/长原因/明文布局。HTTP、浏览器错误和存储均0，browser/context在finally关闭。

112PNG、四原型文件、README/evidence及两验证脚本均为永久审核交付。无本轮临时文件、日志、下载或开发服务；不删除旧轮次材料。生产apps、API/OpenAPI、权限、数据库/迁移、env、依赖及部署配置未改，本轮未部署，无重启要求。

## 待审核与未覆盖

请审核目录密度、创建分区、明文反馈与轮换/撤销提示。C方向选择不等于P36具体稿获批。实际Vue/后端/数据库过期事务、幂等、审计、权限、OS剪贴板、完整主题/密度/角色/原生200%/软键盘/范围和异步生命周期仍待验证；OG-G不注销。下一P37组织审计，全73页实际实现、部署与用户签收继续待办。
