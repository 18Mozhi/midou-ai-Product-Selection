# M02-01 宝塔发布与回滚

## 发布

运行 `node --test tests/unit/design-quality-gate.test.mjs tests/unit/theme-and-icon-completion.test.mjs`，确认独立 CSS 与 Vue scoped style 均只引用语义颜色令牌，并确认零圆角、1440px 内容上限、标准/紧凑密度与移动触控下限合同；再在信号纸、档案纸和净页白三个纸张主题抽查平台账号、安全审计、来源中心、商业运营、备份恢复与发布灰度页面。

1. 在宝塔执行 MySQL 备份，依次执行 `0014a`、`0014b`、`0014c` 的 up 迁移；必须使用 `product_scout` 业务账号和 MySQL 5.7。
2. 构建当前提交，在宝塔重启 Node API 以加载偏好路由，再发布 Vue Web 静态资源。Worker 与 Python Crawler 不涉及本模块，无需重启。
3. 登录并选择组织/工作区，打开 `/settings/theme`。验证默认信号纸、三套纸张预览、主题保存后刷新保持，以及标准/紧凑密度切换。持久化 ID 仍为 `deep-ocean`、`aurora-purple`、`cloud-white`；密度仅在当前单页会话生效。
4. 依次进入成员、组织、平台和个人中心，确认主题连续且不会强制切回浅色；后台只切换紧凑密度。所有断点的交互控件仍至少为 44px，元数据计算字号至少为 13px。
5. 在任一桌面表格验证账页表头、列显示、冻结首列和表格密度；隐藏到仅剩一列时最后一列不可继续关闭，刷新页面后恢复默认值，移动端仍显示摘要账页和详情抽屉。
6. 抽查普通卡片、指标、筛选区与弹窗：不得出现旧蓝紫渐变、漂浮圆角卡片墙或胶囊主按钮；每页只突出一个朱砂主动作；确认框必须显示影响范围并在高危操作时要求签认。
7. 本模块没有新增环境变量；不要在宝塔增加主题密钥或前端主题配置。

纯语义令牌或组件 CSS 更新只需重新发布 Vue Web 静态资源，不需要重启 Node API、Node Worker 或 Python Crawler。

## 观测与恢复

- 401：重新登录；403：核对活动成员和当前范围；`preference_scope_required`：先重新选择组织/工作区；`preference_version_conflict`：刷新后再保存。
- 503 或数据库异常：在宝塔检查 Node API 和 MySQL；使用响应的 `request_id` / `trace_id` 关联 Node 日志与 `user_ui_preference_audit_events`。
- 前端读取失败会显示明确恢复入口，不把未确认偏好伪装为已保存。

## 回滚

1. 在宝塔停止新写入并备份三张 M02-01 表；保留审计证据。
2. 回退应用提交并重新发布 Web、重启 Node API。
3. 仅在确认不再需要偏好和审计数据后，按 `0014c`、`0014b`、`0014a` 的 down 文件逆序执行。若只回退页面，可保留兼容表不删除。
