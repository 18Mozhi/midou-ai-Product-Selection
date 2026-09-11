# P51 · 详情可达性与重放归属实施

日期：2026-09-12。范围仅为 `/platform-admin/collection` 的既有任务读取、详情和人工重放交互；不改变任务状态机、API、权限、数据库、配置或外部采集执行。

## 本批落地

- 任务状态筛选补齐服务端已有的 `automatically_replayed`，仍使用原 `status` URL 参数和原列表 GET。
- 详情 loading/error/loaded 共用始终存在的标题、描述和 44px 关闭按钮；loading 与 error 不再引用缺失的标题节点。
- 自定义 Tab 循环排除 `hidden`、`aria-hidden`、无布局框和 `visibility:hidden` 的控件；翻页滚动遵守 `prefers-reduced-motion`。
- KeepAlive 停用时清理详情、原因草稿、确认态、读取归属与 body 滚动锁，不删除或改写路由合同。
- 人工重放在提交时固定旧任务 ID 和原因。请求不被取消或重放；如果操作员已经关闭或切换详情，迟到成功只刷新列表并显示页面级结果，不重新打开或覆盖详情。
- 网络、超时、限流和网关类结果不再声称“未执行重放”，而是提示先重新读取任务列表核对且不要立即重复提交；明确 HTTP 失败仍沿用服务端 `action_hint`。
- 原因错误反馈与 textarea 建立 `aria-invalid` / `aria-describedby` 关联。

## 空结果与嵌套确认增量

- 服务端返回 0 条时保留任务队列标题、当前范围、文本筛选和状态筛选，不再由通用空状态面板替换整个工作区。
- 全部状态为空时只提供“重新读取”；指定状态为空时提供“查看全部状态”，不补造创建普通采集任务的入口。
- 打开重放确认后，底层任务详情设置原生 `inert`；确认层取得焦点并保持既有短语校验、Tab 循环和 Escape 取消，关闭后焦点返回“人工重放”。
- 该增量只调整既有读取/确认呈现，不改变重放请求、确认短语或状态筛选参数。

## 证据

- 永久 E2E：`tests/e2e/m03-05-collection-tasks.spec.ts`。
- 新增断言覆盖稳定 loading 对话框名称与初焦点、自动重放 URL 筛选、关闭后的迟到成功隔离、未知写入结果措辞。
- `desktop-chromium` 与 `mobile-390` 完整 P51 套件共 28/28 通过；空结果/嵌套焦点增量双端定向 6/6，`npm run build:web` 通过。
- 本批不调用真实 API、MySQL、Redis、Worker 或外部来源；所有新增写入用例均由 Playwright 本地拦截。
- C 方向完整视觉仍由 [63 场景图册](design/collection-tasks-direction-c/README.md)承担；本批不以现有生产 CSS 截图冒充新视觉审批。

## 未关闭范围

- C 方向默认桌面/手机布局及其余场景仍需用户逐组审核后再进入生产视觉。
- page/status 同路由历史恢复、完整主题/密度/200% 缩放、移动记录转完整详情焦点、真实权限/API/MySQL/Worker 和宝塔生产验收仍未完成。
- 未部署，无重启要求。
