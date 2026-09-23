# 身份与入驻 C方向 · IDENTITY-C-r1

范围：P01–P09首轮整页与内联状态提案。方向C已选；用户已明确批准剩余页面视觉，实施完成的页面按授权自动登记为已同意。此批准只针对视觉构图，不代表生产Vue、真实账号/邮件/MFA/组织权限验证。不使用旧营销轨道、巨幅口号、账页宋体或零圆角。

[交互图稿](index.html) · [源行为与覆盖边界](CONTRACT.md) · [机器证据](evidence.json)

## 构图与审核方式

白色身份栏；蓝色区域只解释当前身份任务/范围依赖，不展示虚假数据；白色内容区按输入、结果、危险动作分层。根入口使用独立轻量状态面，不套业务侧栏。组织与工作区为目录行，不复制旧卡片墙；引导采用信号/协作/判断的文字关系表，不用装饰轨道。手机侧区变紧凑任务摘要、操作随文滚动，页脚辅助入口两列。

图稿底部可切换所有场景。任何表单提交都是离线演示；只可输入合成内容。导航记录目标而不打开生产页面。不新增手机号/SSO、重发倒计时、重置确认密码、MFA复制/下载/二维码或假账号菜单。当前9页无原生弹窗，因此本包只交内联状态，不凭空添加弹窗。

页面实施时沿用上述用户视觉授权，逐页记录完成与运行验收边界；功能合同与生产接受仍独立验证，不把一次视觉批准提升为9页生产验收。

## 验证与限制

- `node scripts/verify-ui-phase2-identity-source.mjs`：实际Vue setup函数的隔离传输/路由检查。不会操作真实身份、Cookie、SQL或邮件。
- `node scripts/verify-ui-phase2-identity-c.mjs --capture`：复用现有Playwright生成本包正式图和清单；不改旧包。去掉`--capture`只核对指纹并重跑本包DOM检查。
- 1440/390逐场景检查，360/768/1024/1920及200%缩放抽样；四类控件悬停/焦点/按下截图、表单和范围选择键盘交互均以脚本断言为准。不是每个按钮实例的全部六态证明，完整动作分母与三主题/两密度仍待专项补齐。
- MFA/首次设置统一忙碌与原生表单校验、未知读取状态、失败标题、切换后清空演示字段是待审UI提案，不能当作真实组件已修复；真实敏感材料生命周期、读取/写入竞态、会话撤销、权限、软键盘、读屏和生产回归未验证。
- 生产Vue/API/OpenAPI/环境/依赖/数据库均未修改；本包不部署、不发邮件、不创建组织、不停用MFA，无重启要求。
- PNG、HTML/CSS/JS、合同、清单与永久验证器是审核交付物；验证浏览器在finally关闭，不留下常驻服务或一次性临时文件。

## 逐页图册

<!-- GALLERY:START -->
共82场景，188张正式PNG（含四类控件的悬停、焦点、按下态）。

| 页面/状态 | 桌面 | 手机 |
| --- | --- | --- |
| P01 根入口 / 正在确定入口 | [1440](1440-p01-loading.png) | [390](390-p01-loading.png) |
| P01 根入口 / 无法确定入口 | [1440](1440-p01-blocked.png) | [390](390-p01-blocked.png) |
| P02 登录 / 初始 | [1440](1440-p02-idle.png) | [390](390-p02-idle.png) |
| P02 登录 / 处理中 | [1440](1440-p02-loading.png) | [390](390-p02-loading.png) |
| P02 登录 / 字段错误 | [1440](1440-p02-invalid.png) | [390](390-p02-invalid.png) |
| P02 登录 / 服务端拒绝 | [1440](1440-p02-error.png) | [390](390-p02-error.png) |
| P02 登录 / 请求频繁 | [1440](1440-p02-rate_limited.png) | [390](390-p02-rate_limited.png) |
| P02 登录 / 连接受阻 | [1440](1440-p02-blocked.png) | [390](390-p02-blocked.png) |
| P03 注册 / 初始 | [1440](1440-p03-idle.png) | [390](390-p03-idle.png) |
| P03 注册 / 处理中 | [1440](1440-p03-loading.png) | [390](390-p03-loading.png) |
| P03 注册 / 字段错误 | [1440](1440-p03-invalid.png) | [390](390-p03-invalid.png) |
| P03 注册 / 服务端拒绝 | [1440](1440-p03-error.png) | [390](390-p03-error.png) |
| P03 注册 / 请求频繁 | [1440](1440-p03-rate_limited.png) | [390](390-p03-rate_limited.png) |
| P03 注册 / 连接受阻 | [1440](1440-p03-blocked.png) | [390](390-p03-blocked.png) |
| P04 找回密码 / 初始 | [1440](1440-p04-idle.png) | [390](390-p04-idle.png) |
| P04 找回密码 / 处理中 | [1440](1440-p04-loading.png) | [390](390-p04-loading.png) |
| P04 找回密码 / 字段错误 | [1440](1440-p04-invalid.png) | [390](390-p04-invalid.png) |
| P04 找回密码 / 服务端拒绝 | [1440](1440-p04-error.png) | [390](390-p04-error.png) |
| P04 找回密码 / 请求频繁 | [1440](1440-p04-rate_limited.png) | [390](390-p04-rate_limited.png) |
| P04 找回密码 / 连接受阻 | [1440](1440-p04-blocked.png) | [390](390-p04-blocked.png) |
| P06 重置密码 / 初始 | [1440](1440-p06-idle.png) | [390](390-p06-idle.png) |
| P06 重置密码 / 处理中 | [1440](1440-p06-loading.png) | [390](390-p06-loading.png) |
| P06 重置密码 / 字段错误 | [1440](1440-p06-invalid.png) | [390](390-p06-invalid.png) |
| P06 重置密码 / 服务端拒绝 | [1440](1440-p06-error.png) | [390](390-p06-error.png) |
| P06 重置密码 / 请求频繁 | [1440](1440-p06-rate_limited.png) | [390](390-p06-rate_limited.png) |
| P06 重置密码 / 连接受阻 | [1440](1440-p06-blocked.png) | [390](390-p06-blocked.png) |
| P02 登录 / 挑战失效，重新登录 | [1440](1440-p02-expired.png) | [390](390-p02-expired.png) |
| P02 登录 / 安全入口要求登录 | [1440](1440-p02-required.png) | [390](390-p02-required.png) |
| P02 登录 / 正在确认落点 | [1440](1440-p02-routing.png) | [390](390-p02-routing.png) |
| P02 登录 / 结果未提供落点，保留范围入口 | [1440](1440-p02-success-no-route.png) | [390](390-p02-success-no-route.png) |
| P02 登录 / 验证码或恢复码 | [1440](1440-p02-challenge.png) | [390](390-p02-challenge.png) |
| P02 登录 / 正在验证挑战 | [1440](1440-p02-challenge-loading.png) | [390](390-p02-challenge-loading.png) |
| P02 登录 / 挑战未通过 | [1440](1440-p02-challenge-error.png) | [390](390-p02-challenge-error.png) |
| P02 首次设置 / 修改密码 | [1440](1440-p02-seed.png) | [390](390-p02-seed.png) |
| P02 首次设置 / 改密处理中 | [1440](1440-p02-seed-loading.png) | [390](390-p02-seed-loading.png) |
| P02 首次设置 / 改密失败 | [1440](1440-p02-seed-error.png) | [390](390-p02-seed-error.png) |
| P02 首次设置 / 改密后重新登录 | [1440](1440-p02-seed-relogin.png) | [390](390-p02-seed-relogin.png) |
| P02 首次设置 / 绑定认证器 | [1440](1440-p02-seed-enroll.png) | [390](390-p02-seed-enroll.png) |
| P02 首次设置 / 手动绑定材料 | [1440](1440-p02-seed-secret.png) | [390](390-p02-seed-secret.png) |
| P02 首次设置 / 保存恢复码后重新登录 | [1440](1440-p02-seed-recovery.png) | [390](390-p02-seed-recovery.png) |
| P03 注册 / 两次密码不一致 | [1440](1440-p03-mismatch.png) | [390](390-p03-mismatch.png) |
| P03 注册 / 邮件进入队列，未登录 | [1440](1440-p03-queued.png) | [390](390-p03-queued.png) |
| P04 找回 / 通用受理结果 | [1440](1440-p04-accepted.png) | [390](390-p04-accepted.png) |
| P05 验证邮箱 / 无链接材料 | [1440](1440-p05-missing.png) | [390](390-p05-missing.png) |
| P05 验证邮箱 / 自动确认中 | [1440](1440-p05-loading.png) | [390](390-p05-loading.png) |
| P05 验证邮箱 / 验证完成 | [1440](1440-p05-success.png) | [390](390-p05-success.png) |
| P05 验证邮箱 / 失败或链接无效 | [1440](1440-p05-error.png) | [390](390-p05-error.png) |
| P05 验证邮箱 / 请求频繁 | [1440](1440-p05-limited.png) | [390](390-p05-limited.png) |
| P05 验证邮箱 / 服务受阻 | [1440](1440-p05-blocked.png) | [390](390-p05-blocked.png) |
| P06 重置 / 已更新，尚未登录 | [1440](1440-p06-success.png) | [390](390-p06-success.png) |
| P06 重置 / 缺失或无效链接 | [1440](1440-p06-link-invalid.png) | [390](390-p06-link-invalid.png) |
| P07 MFA / 读取中，状态未知 | [1440](1440-p07-loading.png) | [390](390-p07-loading.png) |
| P07 MFA / 读取失败，不显示未启用 | [1440](1440-p07-read-error.png) | [390](390-p07-read-error.png) |
| P07 MFA / 未启用，验证当前密码 | [1440](1440-p07-enroll.png) | [390](390-p07-enroll.png) |
| P07 MFA / 开始绑定处理中 | [1440](1440-p07-enroll-loading.png) | [390](390-p07-enroll-loading.png) |
| P07 MFA / 开始绑定失败 | [1440](1440-p07-enroll-error.png) | [390](390-p07-enroll-error.png) |
| P07 MFA / 手动密钥与验证码 | [1440](1440-p07-secret.png) | [390](390-p07-secret.png) |
| P07 MFA / 确认启用处理中 | [1440](1440-p07-confirm-loading.png) | [390](390-p07-confirm-loading.png) |
| P07 MFA / 确认启用失败 | [1440](1440-p07-confirm-error.png) | [390](390-p07-confirm-error.png) |
| P07 MFA / 本次恢复码 | [1440](1440-p07-recovery.png) | [390](390-p07-recovery.png) |
| P07 MFA / 已启用与停用区 | [1440](1440-p07-enabled.png) | [390](390-p07-enabled.png) |
| P07 MFA / 停用处理中 | [1440](1440-p07-disable-loading.png) | [390](390-p07-disable-loading.png) |
| P07 MFA / 停用失败 | [1440](1440-p07-disable-error.png) | [390](390-p07-disable-error.png) |
| P07 MFA / 已停用，需重新登录 | [1440](1440-p07-disabled.png) | [390](390-p07-disabled.png) |
| P07 MFA / 会话失效 | [1440](1440-p07-expired.png) | [390](390-p07-expired.png) |
| P08 范围选择 / 读取组织 | [1440](1440-p08-loading.png) | [390](390-p08-loading.png) |
| P08 范围选择 / 组织目录 | [1440](1440-p08-organizations.png) | [390](390-p08-organizations.png) |
| P08 范围选择 / 搜索无匹配 | [1440](1440-p08-search-empty.png) | [390](390-p08-search-empty.png) |
| P08 范围选择 / 没有组织，可创建本人空间 | [1440](1440-p08-empty.png) | [390](390-p08-empty.png) |
| P08 范围选择 / 创建本人空间中 | [1440](1440-p08-provisioning.png) | [390](390-p08-provisioning.png) |
| P08 范围选择 / 读取失败 | [1440](1440-p08-error.png) | [390](390-p08-error.png) |
| P08 范围选择 / 成员资格受限 | [1440](1440-p08-forbidden.png) | [390](390-p08-forbidden.png) |
| P08 范围选择 / 登录过期 | [1440](1440-p08-expired.png) | [390](390-p08-expired.png) |
| P08 范围选择 / 工作区目录 | [1440](1440-p08-workspaces.png) | [390](390-p08-workspaces.png) |
| P08 范围选择 / 读取工作区与团队 | [1440](1440-p08-workspaces-loading.png) | [390](390-p08-workspaces-loading.png) |
| P08 范围选择 / 没有工作区，不显示创建组织 | [1440](1440-p08-workspaces-empty.png) | [390](390-p08-workspaces-empty.png) |
| P08 范围选择 / 正在设置会话范围 | [1440](1440-p08-selecting.png) | [390](390-p08-selecting.png) |
| P08 范围选择 / 范围已就绪，待继续 | [1440](1440-p08-selected.png) | [390](390-p08-selected.png) |
| P08 范围选择 / 范围已就绪，返回原页面 | [1440](1440-p08-return.png) | [390](390-p08-return.png) |
| P09 引导 / 第1步 | [1440](1440-p09-step-1.png) | [390](390-p09-step-1.png) |
| P09 引导 / 第2步 | [1440](1440-p09-step-2.png) | [390](390-p09-step-2.png) |
| P09 引导 / 第3步 | [1440](1440-p09-step-3.png) | [390](390-p09-step-3.png) |

控件细节：

- [1440-p02-idle-hover.png](1440-p02-idle-hover.png)
- [1440-p02-idle-focus.png](1440-p02-idle-focus.png)
- [1440-p02-idle-pressed.png](1440-p02-idle-pressed.png)
- [1440-p07-enabled-hover.png](1440-p07-enabled-hover.png)
- [1440-p07-enabled-focus.png](1440-p07-enabled-focus.png)
- [1440-p07-enabled-pressed.png](1440-p07-enabled-pressed.png)
- [1440-p08-organizations-hover.png](1440-p08-organizations-hover.png)
- [1440-p08-organizations-focus.png](1440-p08-organizations-focus.png)
- [1440-p08-organizations-pressed.png](1440-p08-organizations-pressed.png)
- [1440-p09-step-1-hover.png](1440-p09-step-1-hover.png)
- [1440-p09-step-1-focus.png](1440-p09-step-1-focus.png)
- [1440-p09-step-1-pressed.png](1440-p09-step-1-pressed.png)
- [390-p02-idle-hover.png](390-p02-idle-hover.png)
- [390-p02-idle-focus.png](390-p02-idle-focus.png)
- [390-p02-idle-pressed.png](390-p02-idle-pressed.png)
- [390-p07-enabled-hover.png](390-p07-enabled-hover.png)
- [390-p07-enabled-focus.png](390-p07-enabled-focus.png)
- [390-p07-enabled-pressed.png](390-p07-enabled-pressed.png)
- [390-p08-organizations-hover.png](390-p08-organizations-hover.png)
- [390-p08-organizations-focus.png](390-p08-organizations-focus.png)
- [390-p08-organizations-pressed.png](390-p08-organizations-pressed.png)
- [390-p09-step-1-hover.png](390-p09-step-1-hover.png)
- [390-p09-step-1-focus.png](390-p09-step-1-focus.png)
- [390-p09-step-1-pressed.png](390-p09-step-1-pressed.png)
<!-- GALLERY:END -->
