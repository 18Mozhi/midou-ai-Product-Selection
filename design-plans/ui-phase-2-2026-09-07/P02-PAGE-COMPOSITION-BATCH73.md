# P02 实际 Vue C 组合 · 批次73

P02 原有 IDENTITY-C-r1 是离线稿。本批新增仅审核用的 Vite 转换：保留 `LocalIdentity.vue` 的 script、账号/密码字段、`POST /auth/login`、MFA 挑战转场、种子安全设置转场、redirect/landing 规则与既有限制；移除旧营销侧栏、轨道和装饰，改为蓝色身份核验任务线、白色登录工作区、挑战输入及强制改密区。

`tests/unit/login-page-preview.test.mjs`通过；实际 Vue 在1440/390与两种动效下共68项检查、8个本地拦截登录 POST通过，无额外 API 或页面错误。r1 图册为桌面/手机的登录、MFA 挑战、首次改密共6 PNG/39来源指纹，适用于账户输入、单一主操作、挑战、种子改密和键盘焦点审核，不代表真实凭证、Cookie、MFA 设备、身份服务、目标页权限、真实错误、生产验收或登录成功。

批73复核：两条演示登录请求严格保留 `identifier/password` 字段；第一条只返回 `mfa_required`，第二条只返回既有 `security_setup.required/must_change_password/must_enroll_mfa`，不点击会继续调用真实目标页的“验证并登录”或改密动作。手机不复制桌面的蓝色任务线，直接展示账户或挑战工作区，字段、帮助、错误预留和44px主操作均顺排。

无需重启、部署或配置变更。待用户审核本批三种组合后，再补注册、找回、验证/重置、恢复码、MFA 绑定、请求错误/限流/阻断、expired、短视口、缩放、读屏、真实会话与生产验收。
