# P50 凭证页 C 方向增量生产接入

日期：2026-10-01

## 实施范围

- 将已审核的 P50 默认页 C 布局差异接入 `CredentialAssetCenter`，生成 `credential-assets-page-c.css`；只保留相对现有生产 C 样式新增或改变的规则，并继续按凭证路由 `body:has(#app .credential-center)` 限定作用域。
- 登录窗将格式说明、来源/方式/文件、来源状态及就地提示收进可滚动内容区；标题和底部取消/提交操作留在滚动区外。错误、读取中和材料就绪通过原有 `role=status` 的 `data-tone` 显示对应反馈色。
- 保留已有接口调用、字段/顺序、加密、权限、材料校验、代次归属与错误恢复；不渲染或持久化 Cookie 内容，不改 API、数据库、环境变量或依赖。

## 验证

- `tests/unit/ui-phase2-credential-assets-page.test.mjs` 与 `tests/unit/ui-phase2-credential-login-material.test.mjs` 检查生产 CSS 路由作用域、页面规则增量、登录滚动结构和状态标记；既有隔离审稿 CSS、证据包不改写。
- `tests/e2e/m03-02-credential-assets.spec.ts` 通过真实 App 路由及本地拦截数据验证蓝色身份区、桌面双列/手机单列登录材料区、警告/就绪色、固定底部操作、材料不回显及取消关闭。
- 本地浏览器拦截测试不代表真实扩展、账号授权、MySQL 加密存储或生产权限验收。

## 发布边界

该批次完成本地 Vue/CSS 实施和验证后才可提交。当前生产 `/api/v1/health/ready` 的既有 503（MySQL/Redis dependency unavailable）仍是完整生产验收阻塞；在 ready 恢复前不声明该批生产验收通过。
