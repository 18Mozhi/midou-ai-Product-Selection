# P03 实际 Vue C 组合 · 批次74

P03 原有 IDENTITY-C-r1 是离线稿。本批新增仅审核用的 Vite 转换：保留 `LocalIdentity.vue` 的注册脚本、email/password/confirmPassword、前端不一致短路、`POST /auth/register`、成功切换verify和返回登录动作；移除旧宣传与双主视觉，改为蓝色注册边界、三字段工作区、就地不一致提示和待验证说明。

`tests/unit/register-page-preview.test.mjs`通过；实际 Vue 在1440/390与两种动效下共64项检查、4个本地拦截注册 POST通过。r1 图册为双端注册、密码不一致、待验证6 PNG/39来源指纹，适用于字段顺序、确认密码边界、错误保留、待验证和返回登录审核，不代表真实邮箱、投递、重复账号口径、Cookie、身份服务、真实错误、权限或生产验收。

批74复核：密码不一致产生原有本地错误、保留已填邮箱且零 POST；修正后单次POST严格只含email/password，不含confirmPassword，201样例只使mode变为verify，URL仍为`/register`。待验证区保留实际`switchMode('login')`返回能力，不把它误画成已登录或自动跳转。

无需重启、部署或配置变更。待用户审核三种组合后，再补邮箱格式、服务端拒绝/限流/阻断、慢请求、验证令牌、真实投递、缩放、读屏与生产验收。
