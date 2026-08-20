# M06-04 安全与密钥运营

页面按概念图 65–68 组合安全事件、会话、Token、凭证生命周期与平台审计。API 需要 `platform:secure`；读证据写入 `security_operations_views` 与全局审计。Repository 使用字段白名单，禁止选择任何认证秘密、密文、nonce、auth tag、Token hash、Cookie 或原始网络标识。

本模块不复制已有的会话撤销、Token 管理或凭证轮换写合同。写入继续受既有 capability、同源、幂等、版本和原因约束。没有外部 SIEM/KMS 时只展示真实本地状态，不伪造已接入结论。

页面以 URL 中的 `view=events|sessions|credentials|audit` 拆分事件、会话、访问与凭证、平台审计四个二级视图，默认进入事件视图，浏览器前进/后退可恢复选择。平台安全管理员登录后直接进入 `/platform-admin/security`，不会先落到需要 `platform:operate` 的平台概览；无权访问的一级菜单继续按路由 capability 隐藏。

桌面端以表格呈现登录事件、会话、凭证、组织访问令牌与平台审计；窄屏改为摘要卡片，详细事实在抽屉中查看，避免横向滚动。用户界面统一显示中文业务状态；事件、会话、凭证、用户、令牌、审计对象、请求与追踪标识，以及凭证指纹和令牌前缀，仅在折叠的“技术详情”中展示。该展示分层不改变 API 返回、权限或安全写合同。
