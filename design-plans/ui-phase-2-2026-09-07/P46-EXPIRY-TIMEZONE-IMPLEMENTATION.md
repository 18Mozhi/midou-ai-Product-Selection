# P46 条款到期时间本地显示往返修复

## 范围

`ProviderRegistry.vue` 编辑既有来源时，`terms_expires_at` 是 ISO 时间瞬间，表单控件为 `datetime-local`。原实现直接取 ISO 字符串前16位，把UTC墙上时间误当浏览器本地时间；在 Asia/Shanghai 中保存时会将到期瞬间提前8小时。

## 实施

- 编辑时先解析现有 ISO 瞬间，按浏览器当前时区偏移生成 `datetime-local` 的本地年月日/时分值。
- 保存仍使用原有 `new Date(localValue).toISOString()`，请求方法、路径、字段、`expected_version`、准入校验和精度均未改变。
- 空值仍映射为空；不能解析的历史值保持原先字符串切片回退，不推断或替换业务数据。
- 只在 `ProviderRegistry.vue` 增加局部格式化函数；不新增组件、依赖、配置、API或迁移。

## 验证

- 永久实际 Vue E2E 在 `Asia/Shanghai` 时区逐桌面 Chromium 与390px手机运行：服务返回 `2027-08-07T17:00:00.000Z`，编辑窗显示 `2027-08-08T01:00`，不改字段直接保存时 PUT 仍携带 `2027-08-07T17:00:00.000Z` 与原 `expected_version: 1`。
- P46/M03-01 页面 E2E 桌面4/4、手机4/4通过，均只用浏览器本地拦截，不连接真实生产写入。
- 不证明真实服务端保存、RBAC、审计、条款事实或正式 M07-03 验收。
