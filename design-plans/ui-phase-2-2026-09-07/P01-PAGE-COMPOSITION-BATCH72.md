# P01 实际 Vue C 组合 · 批次72

P01 原有 IDENTITY-C-r1 是离线稿。本批增加仅审核用的 Vite 转换：保留 `LandingRedirect.vue` 的入口解析脚本、`GET /me/landing`、真实 route 替换、`/home` 最近成员路径、expired 跳转与 blocked 重试；移除旧的通用状态孤岛，改为蓝色入口边界、只读解析说明、加载/失败工作区和关联编号。

`tests/unit/landing-page-preview.test.mjs`通过；实际 Vue 在1440/390与两种动效下共48项检查、24次本地拦截 GET通过，无写请求、额外 API 或页面错误。r1 图册为双端 loading/blocked 4 PNG、44来源指纹，适用于入口解析、失败原因、关联编号和单一重试操作审核，不代表真实会话、目标路由权限、expired、真实HTTP失败、存储异常或生产验收。

批72复核：503是现有安全 GET 策略的可重试状态，一次入口解析和一次“重新检查”各按既有0/150/400ms执行三次 GET；验证按两轮共6次读请求计算，而不是把客户端重试看成重复点击。loading 没有可操作按钮；blocked 只保留“重新检查”。共享 `UiStatePanel` 的 inert “查看影响”在此页无监听方，审核 CSS 隐藏它，原生产组件与事件均未改。

历史审核层记录：双端构图现按用户“剩余页面视觉通过”授权获批；当前实际组件、根路由E2E及后续宝塔只读部署证据见[P01实施记录](P01-PAGE-COMPOSITION-IMPLEMENTATION.md)。原型的局部GET夹具仍不证明真实会话、目标角色权限、完整读屏或正式M07-03验收。
