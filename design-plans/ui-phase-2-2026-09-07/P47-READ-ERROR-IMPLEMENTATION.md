# P47 首次读取失败 · 生产 Vue 接入

## 范围

将已审核的首次只读 GET 失败区域接入实际 `ProviderAdapterCenter`。页面容器继续持有请求状态与 `load` 重读动作；共享 `UiStatePanel` 只接收现有 `title`、`description` 展示 props；样式仅命中 P47 活跃页面的 `error` 状态。没有新增组件、业务状态或恢复动作。

- 标题为“暂时未能读取采集状态”，说明为“这次读取未完成。你可以重新读取，获取最新状态。”
- 原“重新读取状态”按钮继续触发同一个 `load`，安全过滤后的请求编号保持可见。
- 仅 error 状态采用紧凑白色区域、左对齐说明、13px编号标签及44px键盘焦点按钮；401/403/依赖受阻、加载、空态和成功反馈继续使用各自已有呈现。
- 旧区域图册、审核运行器和机器清单保持原样作为历史证据；关联单测不再把该历史清单描述为当前工作树的全源快照。新单测直接编译当前真实 SFC 并检查生产选择器边界。

## 组件映射

| 组件 | 职责与数据流 |
| --- | --- |
| `ProviderAdapterCenter` | 保持请求和重试单一来源；仅在 `state === 'error'` 下向下传入文案。 |
| `UiStatePanel` | 沿用原类型化展示 props 与 `primary` 事件；重读由父组件处理，不引入共享默认文案变化。 |
| `provider-adapters-c-read-error.css` | 仅装饰 `.adapter-center--c` 下 `data-kind="error"` 面板，不命中其他页面或状态。 |

## 验证与边界

- 新生产与历史证据单测 7/7 通过。
- `m03-03-provider-adapter.spec.ts`：desktop-chromium 9/9、mobile-390 9/9；API 由本地 fixture 拦截，无真实探针请求。
- `npm run typecheck:web` 与 `npm run build:web` 通过。
- 不改 API、OpenAPI、探针 POST、重试、权限、缓存、数据库、依赖、配置或服务拓扑。测试不证明真实来源权限/探针结果；跨页卸载后仍在途的探针锁策略仍待产品确认。

宝塔部署和当前构建 SHA 将在代码提交后追加核验结果。正式 M07-03 与全 73 页目标保持开放。
