# P47 · 高级筛选与分页 r1

## 设计范围

起点 `main/a3d0752f`，实际 App / ProviderAdapterCenter 与权威 M03-03 E2E `catalog` 45 条 fixture。frontend-design 用于收紧 C 方向筛选层级和页码操作条；fixing-accessibility 用于原生 details、结果播报、44px、禁用边界和焦点。本批为独立审核预览，**生产组件、六筛选模型、排序、20 条页长、watch、GET/API/权限均未改，未部署**。

- 搜索与重置保持首行；结果数改为冷灰蓝胶囊，并作为 polite/atomic status 播报。
- 「更多筛选与排序」继续使用原生 details，展开后五字段单列（390）或三列（桌面），浅灰内层，不新增筛选项。
- 分页为前一页 / 当前页 / 后一页三段操作条，当前页作为 polite/atomic status；按钮至少 44px，禁用态用灰底+文字而非仅降低透明度。
- 只有 1 页时隐藏冗余分页，因为工具栏已显示结果数；45 条仍严格为 20/20/5 三页。

## 边界焦点

实际 Chromium 基线中，从第 2 页到第 3 页后「下一页」变 disabled，或从第 2 页回第 1 页后「上一页」变 disabled，焦点均落 BODY。预览只把分页事件包一层：原 page 加减、等待 nextTick；仅当原触发按钮已因边界 disabled 时，将焦点移到同一 nav 的持续页码状态，使用 preventScroll。按钮仍可用时焦点不动。

筛选从第 3 页缩至单条时，原 watch 回第 1 页，搜索框保持焦点；因为预览隐藏单页 nav，不再产生残留焦点。空结果「清除筛选」恢复 query、四筛选 all、排序 attention 和第 1 页，无 GET/POST；该空态焦点问题已在独立 [P47 空态审核](P47-EMPTY-REVIEW.md) 中记录，本批不重复扩权修复。

## 实际 Vue 证据

- [36 图总览](../../output/playwright/p47-filter-pagination-review/index.html)：基线/审核 × 390/760/1440，分别覆盖筛选展开、第一页、第二页、末页、回第一页和单结果，共 6 组、156 项检查。
- [证据清单](../../output/playwright/p47-filter-pagination-review/evidence.json)：170 个当前源、PNG SHA-256 与尺寸。
- 权威 fixture 通过 TypeScript AST 直接提取 `navigation/base/items/catalog`，不复制或猜 45 条数据。旧设计桥接因当前生产 probe 已使用 HTMLElement 而不能运行，本批未改历史桥接，也未用其结果充当当前证据。
- 三宽度均验证 20/20/5、按钮焦点、页码文本、五个带标签 select、原生 details 键盘开合、筛选回页、单页隐藏、六控件清除、区域和页面无横向溢出。
- 每组仅初始 1 次 adapters GET，全部筛选/分页/清除均零额外 GET、零 POST、零请求体、零未知网络。

最初 1200px 取证被固定底部导航遮住排序字段，已改用 1600px 审核视口并完整重跑；正式手机筛选图完整显示五字段。该视口调整只是证据生成设置，不是产品 CSS。

复验：`node --test tests/unit/ui-phase2-provider-adapter-filter-pagination.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-adapter-filter-pagination.mjs --capture`。所有 Vite/Chromium 已关闭；最终端口 54902/54955，早期 54777/54804 也已关闭。正式图包保留，无临时日志/草稿/测试数据。

## 待审

390px 展开筛选、第二页与末页三张组合待审；仅确认区域视觉，不代表页码焦点提案、其他宽度、完整列表或生产验收。P47 其他待审状态、跨页检查锁、真实探针和全 73 页目标继续开放。
