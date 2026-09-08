# P29 治理概览 · ORG-PROFILE-C-r1

状态：C 方向独立审核稿，具体页面未获审。不是真实 Vue 实现或部署完成报告。

[打开交互原型](index.html)。直接打开，无需启动服务。顶部“审核场景”切换各状态并查看请求意图；正文只有现有六字段内联表单，**零业务弹窗**。

## 设计方案与复核

使用 frontend-design：蓝色页内目录定位组织资料、更新资料、治理摘要；白色内容按“已读取身份 → 分组编辑 → 只读规模”排列，取代旧六卡摘要先行。目录仅本页锚点，不冒充全部组织后台导航或其他页面已设计。

色板：目录蓝 #254a9c、深蓝 #193b80、正文 #202c3d、辅助 #58677b、底色 #edf1f6、分隔 #dbe1e9，内容面纯白。字体 Microsoft YaHei UI / Microsoft YaHei，左对齐，标题 27/25/20，控件至少 16px，辅助至少 13px，44px 热区。桌面编辑说明与表单分栏，手机单列，保存与原因在同一表单，无固定底栏遮盖。

复核后删去手机重复的禁止操作说明和工程措辞，缩短身份状态区，页内目录点击后同步选中与焦点。动效仅按钮短反馈，尊重 reduced-motion。正常、键盘焦点、悬停、按下、忙碌、失败与合成成功分别出图。未把长截图当原生 200% 缩放或手机软键盘验收。

## 字段与操作

| 字段/控件 | 实际边界 |
| --- | --- |
| 名称 | 必填，最多120；服务端trim后非空 |
| Logo HTTPS 地址 | 可空，浏览器URL/pattern与2048上限；服务端空值转null、校验HTTPS，不新增上传或远程图片请求 |
| 时区 | 必填文本、最多64；没有真实IANA枚举验证，不自造固定下拉 |
| 数据保留天数 | 整数30–3650；浏览器数字转换，服务端再次校验 |
| 默认工作区 | 必选，名称展示，UUID只作值；原选项不做active-only过滤，实际保存检查当前组织归属 |
| 变更原因 | 必填、最多500；随本次保存提交，不新增确认或审批流程 |
| 保存并审计 | PATCH /org/admin/profile，六字段加expected_version；无slug/status、组织ID或额外字段 |
| 刷新数据/重新加载 | GET summary/profile/workspaces，成功重新填充表单并清原因；没有自动持久化草稿 |
| 技术详情 | 折叠ID、版本、资料时间、合成请求编号；无凭证 |
| 页内目录 | 仅定位并聚焦本页区域，不请求其他管理页面 |

权限沿既有 organization:manage；工作区选项另要求 workspace:manage。真实客户端的会话、Origin、幂等键、request/trace及12秒超时没有被改写。本稿无API通信，不用按钮可见证明权限。

## 数据与已确认缺口

- summary/profile/workspaces从现有m06-01 E2E变量AST直接提取；摘要8个工作区与选项1项的不一致保留，不补造7项。
- 活动/全部计数与待审批/有效令牌/7日审计分别呈现。合成缺失摘要显示“未取得数据”，不回退成零。真实七日摘要仅audit_logs，不是P37全部审计来源。
- 源load成功会覆盖未提交表单。原型明确提示该事实，合成刷新成功演示覆盖；普通按钮只记意图，不偷偷刷新数据。
- 源submit在写后load消化失败后，仍覆盖为“操作已完成并写入审计”，表单可能只剩reason。永久助手已复现OG-G02，未修生产代码。
- 提案将写入已确认/重读失败、结果未确认分开；保留输入与旧事实，提示先刷新核验并暂禁重复保存。这是待审保护，不声明真实事务成功或已解决全生命周期。
- hold与complete是明确的合成响应控制：保存使用提交快照，失败保留输入，成功显示合成新版本，403替换页面；场景代次隔离仅防审核样例串扰，不等于真实Vue跨组织/KeepAlive保护。

## 全部图片

37场景×1440/390，共 **74 PNG**，其中2张为非业务审核工具。全部为完整页面图，无弹窗和额外下载产物。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| normal | [查看](1440-normal.png) | [查看](390-normal.png) |
| editing | [查看](1440-editing.png) | [查看](390-editing.png) |
| blank_logo | [查看](1440-blank_logo.png) | [查看](390-blank_logo.png) |
| long_name | [查看](1440-long_name.png) | [查看](390-long_name.png) |
| long_workspace | [查看](1440-long_workspace.png) | [查看](390-long_workspace.png) |
| missing_workspace | [查看](1440-missing_workspace.png) | [查看](390-missing_workspace.png) |
| no_options | [查看](1440-no_options.png) | [查看](390-no_options.png) |
| archived_option | [查看](1440-archived_option.png) | [查看](390-archived_option.png) |
| zero_summary | [查看](1440-zero_summary.png) | [查看](390-zero_summary.png) |
| missing_summary | [查看](1440-missing_summary.png) | [查看](390-missing_summary.png) |
| loading | [查看](1440-loading.png) | [查看](390-loading.png) |
| error | [查看](1440-error.png) | [查看](390-error.png) |
| blocked | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| expired | [查看](1440-expired.png) | [查看](390-expired.png) |
| forbidden | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| rate_limited | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| conflict_page | [查看](1440-conflict_page.png) | [查看](390-conflict_page.png) |
| refreshing | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| refresh_error | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| refresh_success | [查看](1440-refresh_success.png) | [查看](390-refresh_success.png) |
| dirty_refresh | [查看](1440-dirty_refresh.png) | [查看](390-dirty_refresh.png) |
| save_busy | [查看](1440-save_busy.png) | [查看](390-save_busy.png) |
| save_error | [查看](1440-save_error.png) | [查看](390-save_error.png) |
| save_conflict | [查看](1440-save_conflict.png) | [查看](390-save_conflict.png) |
| save_success | [查看](1440-save_success.png) | [查看](390-save_success.png) |
| write_read_failed | [查看](1440-write_read_failed.png) | [查看](390-write_read_failed.png) |
| save_timeout | [查看](1440-save_timeout.png) | [查看](390-save_timeout.png) |
| logo_invalid | [查看](1440-logo_invalid.png) | [查看](390-logo_invalid.png) |
| reason_missing | [查看](1440-reason_missing.png) | [查看](390-reason_missing.png) |
| retention_invalid | [查看](1440-retention_invalid.png) | [查看](390-retention_invalid.png) |
| timezone_invalid | [查看](1440-timezone_invalid.png) | [查看](390-timezone_invalid.png) |
| name_invalid | [查看](1440-name_invalid.png) | [查看](390-name_invalid.png) |
| technical | [查看](1440-technical.png) | [查看](390-technical.png) |
| focus | [查看](1440-focus.png) | [查看](390-focus.png) |
| hover | [查看](1440-hover.png) | [查看](390-hover.png) |
| pressed | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| controls | [查看](1440-controls.png) | [查看](390-controls.png) |

## 如何复验

在仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-organization-profile-c.mjs --capture
node scripts/verify-ui-phase2-organization-profile-c.mjs
```

capture生成永久图与证据；无参数校验源/数据/图片SHA后复跑交互，不重写图。复用已有Playwright与TypeScript，无安装依赖或服务启动。

源函数在惰性ref/api绑定中执行，不挂载Vue：三读取路径、精确PATCH、成功写编号、409保留和403换页、刷新覆盖草稿、OG-G02、Logo有效性回调。实际服务校验边界及空Logo转null、时区非枚举；摘要方法在惰性SQL pool中检查7查询的组织范围、0计数与audit_logs七日口径。未执行SQL事务、版本竞争、幂等或审计写入。

浏览器两端检查6字段关联与原生有效性、空Logo、保留天数小数/上下界、缺失/归档工作区、精确提交、busy/失败/成功/重读失败/未知结果、刷新草稿语义、目录焦点/选中、重新加载不持久化草稿、无模态、无横向溢出及字号热区。768/1024仅正常/长名称/长工作区/冲突四场景，不称全断点覆盖。HTTP/console/pageerror=0，cookies/localStorage/sessionStorage为空，browser/context finally关闭。

## 未完成与交付边界

具体图稿待审；OG-G01–G06中相关真实生命周期、并发/跨组织/缓存、全主题/密度/角色、原生200%缩放和软键盘、真实Vue/API/MySQL/审计/生产验收仍待办。P30–P37不能用本页图代替。下一工作面P30成员与邀请。

未改生产apps、接口/OpenAPI、数据库/迁移、权限、环境配置、依赖或部署；无重启要求。74图、原型、README/evidence和两脚本均为永久交付；无临时测试文件或服务遗留。
