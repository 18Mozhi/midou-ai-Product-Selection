# P47 · 桌面列设置、冻结与密度 r1

## 设计范围

以当前实际 App、ProviderAdapterCenter、ResponsiveDataView 和共享 TableViewControls 为准。本批仅在独立审核宿主中增加 P47 专属 CSS，**没有替换或改写生产 SFC**。frontend-design 用于把桌面工具并入 C 方向的冷灰蓝操作轨；fixing-accessibility 用于核对原生 details、checkbox、pressed、select、键盘焦点和 44px 热区。

- 工具轨与表格合成一个白色容器；列设置、冻结和密度保持同一层级，不新增动作。
- 列设置继续从实际表头生成五项；弹层使用白底、细分隔和明确选中状态，最后一列可见时禁止继续隐藏。
- 冻结采用 `aria-pressed`，已冻结为浅蓝选中态；标准/紧凑仍是原生 select。
- 390px 继续只展示移动卡片，共享桌面工具保持隐藏。

## 实际 Vue 证据

- [18 图总览](../../output/playwright/p47-table-tools-review/index.html)：基线/审核 × 390/1024/1440；桌面覆盖默认、列设置展开、隐藏“24 小时实际采集”并切紧凑、关闭首列冻结，手机覆盖原卡片隔离。
- [证据清单](../../output/playwright/p47-table-tools-review/evidence.json)：6 次运行、90 项检查、18 张 PNG、169 个当前源哈希；正式图片的 SHA-256 与尺寸均入清单。
- 五个列名直接来自当前真实表头；每次仅 1 次 adapters GET，列隐藏、冻结、密度和恢复全部在浏览器本地完成，无新增 GET、POST、请求体或未知网络。
- 键盘打开列设置，隐藏列后焦点留在 checkbox；密度 select 和冻结按钮有蓝色 focus-visible。最少保留一列，剩余列继续冻结，随后可恢复五列。
- 390px 基线/审核截图尺寸一致、0 个像素变化；说明本批 P47 桌面样式没有进入移动卡片。

复验：`node --test tests/unit/ui-phase2-provider-adapter-table-tools.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-adapter-table-tools.mjs --capture`。取证端口 57435/57465 均已关闭；正式图包保留，无临时日志、草稿或测试数据。

## 待审与边界

待审范围仅为本次展示的桌面工具轨、列设置弹层、隐藏列+紧凑密度、关闭冻结四种视觉组合。它不代表共享组件所有消费者、手机、完整无障碍、真实 API/权限/探针、生产迁移或部署验收。P47 此前读取失败、加载、刷新失败、访问状态、筛选分页等未答复组合，以及跨页面在途检查锁，继续开放。
