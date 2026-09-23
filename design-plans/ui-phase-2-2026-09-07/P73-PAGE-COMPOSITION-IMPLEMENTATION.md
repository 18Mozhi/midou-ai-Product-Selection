# P73 页面不存在 C 方向实施与部署

## 结果

依据用户“剩下的全部通过，你无需暂停”的明确授权，将批71审核构图迁入公开 fallback `NotFoundPage.vue`。旧圆轨道、渐变和巨型 404 装饰已移除，改为蓝色恢复说明、当前路径工作区、安全恢复目标与公开兜底边界。桌面宽屏保持阅读区聚焦，手机改为完整单列与纵向可达链接。

保留未知 path 的 96 字符展示限制、`title` 完整路径、query/hash 不展示、导航记忆 `recentDestination.fullPath`、已注销/非法目标回退与 route 变化后 h1 焦点；不改变路由注册、导航存储、会话或权限合同。页内不发起业务 API 请求。点击恢复目标后会由目标页继续自身会话/权限流程。

## 验证

- `node --test tests/unit/not-found-page-preview.test.mjs`：2/2。
- `node --experimental-strip-types --test tests/m02-04/ui-state-contract.test.mjs`：5/5。
- `node scripts/verify-not-found-page-preview.mjs`：1440/390 × reduced/no-preference 共 44 项；核验标题对比、路径截断、query/hash 隐去、焦点与触控高度；零 API 请求、零页面异常、无横向溢出。
- `node scripts/run-playwright-projects.mjs tests/e2e/m02-04-not-found.spec.ts`：桌面 6/6、手机 6/6。
- Web 类型检查、生产构建、格式/文档/计划门与部署器 preflight 均通过；源提交 `5f105e8fbd8beca9627a4f3d5f34c53650981eda` 已部署。
- 实际 Vue 截图与逐项哈希：[桌面 1440](implementation/p73-actual-vue-r2/1440-default.png)、[手机 390](implementation/p73-actual-vue-r2/390-default.png)、[采集清单](implementation/p73-actual-vue-r2/manifest.json)。

## 生产发现与修复

首次线上未知地址检查发现，HTTP 404 正确，但正文是宝塔默认 Nginx 错误页，Vue fallback 未显示。只读检查确认站点 `#ERROR-PAGE-START` 块内的 `error_page 404 /404.html` 优先于应用的 `error_page 404 /index.html`。部署器现仅移除该块中的精确默认映射；匹配重复或偏离预期位置时失败关闭。它沿用原来的站点备份、`nginx -t`、Nginx reload 与失败回滚步骤，不改未知路径 HTTP 状态、白名单 SPA 路由、API 或权限合同。

最终部署 SHA、未知地址 HTTP 状态与 Vue fallback 正文、健康状态和静态资源读取结果在部署后复核完成后补录。

## 边界

此变更重设计的是 SPA 的恢复页面；受控 Nginx 错误页修正只保证未知地址的响应正文交给应用 fallback，仍保留 HTTP 404。它不证明用户目标页会话/权限、真实浏览器 storage 异常或正式 M07-03 签收。部署会自动备份站点配置、测试并 reload Nginx；无需重启 Node/Python 服务。
