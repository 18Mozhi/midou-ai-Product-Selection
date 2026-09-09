# P21 供应链与利润 · C方向整页待审提案

[导航、搜索与恢复审核](../../SOURCING-NAVIGATION-RECOVERY-REVIEW.md)。2026-09-09 P21导航与恢复：新增230PNG（28控件变体双端四态224图＋3场景6图），包现65主场景615PNG、51控件变体464双端状态实例。8导航和2恢复代表组新增40槽，累计124已映射、46待补；额外来源、query和角色/主次恢复不增加动作分母。源恢复实际load与通用标签差异已明示，原型不伪造登录/权限/返回能力，加载/失败隐藏旧记录和删除入口。11组源隔离与完整capture通过，具体批准/真实Vue/部署未完成。

## 导航与恢复图直达

- [1440px · empty-readonly](1440-empty-readonly.png)
- [1440px · search-empty-readonly](1440-search-empty-readonly.png)
- [1440px · blocked](1440-blocked.png)
- [390px · empty-readonly](390-empty-readonly.png)
- [390px · search-empty-readonly](390-search-empty-readonly.png)
- [390px · blocked](390-blocked.png)

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| 供应商找货导航 | [查看](1440-control-nav-self-default.png) | [查看](1440-control-nav-self-hover.png) | [查看](1440-control-nav-self-focus.png) | [查看](1440-control-nav-self-pressed.png) |
| 费用规则导航 | [查看](1440-control-nav-rules-default.png) | [查看](1440-control-nav-rules-hover.png) | [查看](1440-control-nav-rules-focus.png) | [查看](1440-control-nav-rules-pressed.png) |
| 当前记录费用规则 | [查看](1440-control-nav-context-default.png) | [查看](1440-control-nav-context-hover.png) | [查看](1440-control-nav-context-focus.png) | [查看](1440-control-nav-context-pressed.png) |
| 采集任务明细 | [查看](1440-control-nav-collection-default.png) | [查看](1440-control-nav-collection-hover.png) | [查看](1440-control-nav-collection-focus.png) | [查看](1440-control-nav-collection-pressed.png) |
| ERP 外部页面 | [查看](1440-control-nav-erp-default.png) | [查看](1440-control-nav-erp-hover.png) | [查看](1440-control-nav-erp-focus.png) | [查看](1440-control-nav-erp-pressed.png) |
| 首家原始商品页 | [查看](1440-control-nav-source-default.png) | [查看](1440-control-nav-source-hover.png) | [查看](1440-control-nav-source-focus.png) | [查看](1440-control-nav-source-pressed.png) |
| 机会利润详情 | [查看](1440-control-nav-opportunity-default.png) | [查看](1440-control-nav-opportunity-hover.png) | [查看](1440-control-nav-opportunity-focus.png) | [查看](1440-control-nav-opportunity-pressed.png) |
| 利润面板费用规则 | [查看](1440-control-nav-profit-rules-default.png) | [查看](1440-control-nav-profit-rules-hover.png) | [查看](1440-control-nav-profit-rules-focus.png) | [查看](1440-control-nav-profit-rules-pressed.png) |
| 第二家原始商品页 | [查看](1440-control-nav-source-second-default.png) | [查看](1440-control-nav-source-second-hover.png) | [查看](1440-control-nav-source-second-focus.png) | [查看](1440-control-nav-source-second-pressed.png) |
| 未确认候选原始页 | [查看](1440-control-nav-source-unconfirmed-default.png) | [查看](1440-control-nav-source-unconfirmed-hover.png) | [查看](1440-control-nav-source-unconfirmed-focus.png) | [查看](1440-control-nav-source-unconfirmed-pressed.png) |
| 费用规则 / 带搜索条件 | [查看](1440-control-nav-context-query-default.png) | [查看](1440-control-nav-context-query-hover.png) | [查看](1440-control-nav-context-query-focus.png) | [查看](1440-control-nav-context-query-pressed.png) |
| 读取失败 / 主操作 | [查看](1440-control-recovery-error-primary-default.png) | [查看](1440-control-recovery-error-primary-hover.png) | [查看](1440-control-recovery-error-primary-focus.png) | [查看](1440-control-recovery-error-primary-pressed.png) |
| 读取失败 / 次操作 | [查看](1440-control-recovery-error-secondary-default.png) | [查看](1440-control-recovery-error-secondary-hover.png) | [查看](1440-control-recovery-error-secondary-focus.png) | [查看](1440-control-recovery-error-secondary-pressed.png) |
| 会话过期 / 主操作 | [查看](1440-control-recovery-expired-primary-default.png) | [查看](1440-control-recovery-expired-primary-hover.png) | [查看](1440-control-recovery-expired-primary-focus.png) | [查看](1440-control-recovery-expired-primary-pressed.png) |
| 无读取权限 / 主操作 | [查看](1440-control-recovery-forbidden-primary-default.png) | [查看](1440-control-recovery-forbidden-primary-hover.png) | [查看](1440-control-recovery-forbidden-primary-focus.png) | [查看](1440-control-recovery-forbidden-primary-pressed.png) |
| 无读取权限 / 次操作 | [查看](1440-control-recovery-forbidden-secondary-default.png) | [查看](1440-control-recovery-forbidden-secondary-hover.png) | [查看](1440-control-recovery-forbidden-secondary-focus.png) | [查看](1440-control-recovery-forbidden-secondary-pressed.png) |
| 限流 / 主操作 | [查看](1440-control-recovery-rate-limited-primary-default.png) | [查看](1440-control-recovery-rate-limited-primary-hover.png) | [查看](1440-control-recovery-rate-limited-primary-focus.png) | [查看](1440-control-recovery-rate-limited-primary-pressed.png) |
| 限流 / 次操作 | [查看](1440-control-recovery-rate-limited-secondary-default.png) | [查看](1440-control-recovery-rate-limited-secondary-hover.png) | [查看](1440-control-recovery-rate-limited-secondary-focus.png) | [查看](1440-control-recovery-rate-limited-secondary-pressed.png) |
| 依赖受阻 / 主操作 | [查看](1440-control-recovery-blocked-primary-default.png) | [查看](1440-control-recovery-blocked-primary-hover.png) | [查看](1440-control-recovery-blocked-primary-focus.png) | [查看](1440-control-recovery-blocked-primary-pressed.png) |
| 依赖受阻 / 次操作 | [查看](1440-control-recovery-blocked-secondary-default.png) | [查看](1440-control-recovery-blocked-secondary-hover.png) | [查看](1440-control-recovery-blocked-secondary-focus.png) | [查看](1440-control-recovery-blocked-secondary-pressed.png) |
| 空目录 / 管理者 / 主操作 | [查看](1440-control-recovery-empty-primary-default.png) | [查看](1440-control-recovery-empty-primary-hover.png) | [查看](1440-control-recovery-empty-primary-focus.png) | [查看](1440-control-recovery-empty-primary-pressed.png) |
| 空目录 / 管理者 / 次操作 | [查看](1440-control-recovery-empty-secondary-default.png) | [查看](1440-control-recovery-empty-secondary-hover.png) | [查看](1440-control-recovery-empty-secondary-focus.png) | [查看](1440-control-recovery-empty-secondary-pressed.png) |
| 空目录 / 只读 / 主操作 | [查看](1440-control-recovery-empty-readonly-primary-default.png) | [查看](1440-control-recovery-empty-readonly-primary-hover.png) | [查看](1440-control-recovery-empty-readonly-primary-focus.png) | [查看](1440-control-recovery-empty-readonly-primary-pressed.png) |
| 空目录 / 只读 / 次操作 | [查看](1440-control-recovery-empty-readonly-secondary-default.png) | [查看](1440-control-recovery-empty-readonly-secondary-hover.png) | [查看](1440-control-recovery-empty-readonly-secondary-focus.png) | [查看](1440-control-recovery-empty-readonly-secondary-pressed.png) |
| 搜索无结果 / 管理者 / 主操作 | [查看](1440-control-recovery-search-primary-default.png) | [查看](1440-control-recovery-search-primary-hover.png) | [查看](1440-control-recovery-search-primary-focus.png) | [查看](1440-control-recovery-search-primary-pressed.png) |
| 搜索无结果 / 管理者 / 次操作 | [查看](1440-control-recovery-search-secondary-default.png) | [查看](1440-control-recovery-search-secondary-hover.png) | [查看](1440-control-recovery-search-secondary-focus.png) | [查看](1440-control-recovery-search-secondary-pressed.png) |
| 搜索无结果 / 只读 / 主操作 | [查看](1440-control-recovery-search-readonly-primary-default.png) | [查看](1440-control-recovery-search-readonly-primary-hover.png) | [查看](1440-control-recovery-search-readonly-primary-focus.png) | [查看](1440-control-recovery-search-readonly-primary-pressed.png) |
| 搜索无结果 / 只读 / 次操作 | [查看](1440-control-recovery-search-readonly-secondary-default.png) | [查看](1440-control-recovery-search-readonly-secondary-hover.png) | [查看](1440-control-recovery-search-readonly-secondary-focus.png) | [查看](1440-control-recovery-search-readonly-secondary-pressed.png) |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| 供应商找货导航 | [查看](390-control-nav-self-default.png) | [查看](390-control-nav-self-hover.png) | [查看](390-control-nav-self-focus.png) | [查看](390-control-nav-self-pressed.png) |
| 费用规则导航 | [查看](390-control-nav-rules-default.png) | [查看](390-control-nav-rules-hover.png) | [查看](390-control-nav-rules-focus.png) | [查看](390-control-nav-rules-pressed.png) |
| 当前记录费用规则 | [查看](390-control-nav-context-default.png) | [查看](390-control-nav-context-hover.png) | [查看](390-control-nav-context-focus.png) | [查看](390-control-nav-context-pressed.png) |
| 采集任务明细 | [查看](390-control-nav-collection-default.png) | [查看](390-control-nav-collection-hover.png) | [查看](390-control-nav-collection-focus.png) | [查看](390-control-nav-collection-pressed.png) |
| ERP 外部页面 | [查看](390-control-nav-erp-default.png) | [查看](390-control-nav-erp-hover.png) | [查看](390-control-nav-erp-focus.png) | [查看](390-control-nav-erp-pressed.png) |
| 首家原始商品页 | [查看](390-control-nav-source-default.png) | [查看](390-control-nav-source-hover.png) | [查看](390-control-nav-source-focus.png) | [查看](390-control-nav-source-pressed.png) |
| 机会利润详情 | [查看](390-control-nav-opportunity-default.png) | [查看](390-control-nav-opportunity-hover.png) | [查看](390-control-nav-opportunity-focus.png) | [查看](390-control-nav-opportunity-pressed.png) |
| 利润面板费用规则 | [查看](390-control-nav-profit-rules-default.png) | [查看](390-control-nav-profit-rules-hover.png) | [查看](390-control-nav-profit-rules-focus.png) | [查看](390-control-nav-profit-rules-pressed.png) |
| 第二家原始商品页 | [查看](390-control-nav-source-second-default.png) | [查看](390-control-nav-source-second-hover.png) | [查看](390-control-nav-source-second-focus.png) | [查看](390-control-nav-source-second-pressed.png) |
| 未确认候选原始页 | [查看](390-control-nav-source-unconfirmed-default.png) | [查看](390-control-nav-source-unconfirmed-hover.png) | [查看](390-control-nav-source-unconfirmed-focus.png) | [查看](390-control-nav-source-unconfirmed-pressed.png) |
| 费用规则 / 带搜索条件 | [查看](390-control-nav-context-query-default.png) | [查看](390-control-nav-context-query-hover.png) | [查看](390-control-nav-context-query-focus.png) | [查看](390-control-nav-context-query-pressed.png) |
| 读取失败 / 主操作 | [查看](390-control-recovery-error-primary-default.png) | [查看](390-control-recovery-error-primary-hover.png) | [查看](390-control-recovery-error-primary-focus.png) | [查看](390-control-recovery-error-primary-pressed.png) |
| 读取失败 / 次操作 | [查看](390-control-recovery-error-secondary-default.png) | [查看](390-control-recovery-error-secondary-hover.png) | [查看](390-control-recovery-error-secondary-focus.png) | [查看](390-control-recovery-error-secondary-pressed.png) |
| 会话过期 / 主操作 | [查看](390-control-recovery-expired-primary-default.png) | [查看](390-control-recovery-expired-primary-hover.png) | [查看](390-control-recovery-expired-primary-focus.png) | [查看](390-control-recovery-expired-primary-pressed.png) |
| 无读取权限 / 主操作 | [查看](390-control-recovery-forbidden-primary-default.png) | [查看](390-control-recovery-forbidden-primary-hover.png) | [查看](390-control-recovery-forbidden-primary-focus.png) | [查看](390-control-recovery-forbidden-primary-pressed.png) |
| 无读取权限 / 次操作 | [查看](390-control-recovery-forbidden-secondary-default.png) | [查看](390-control-recovery-forbidden-secondary-hover.png) | [查看](390-control-recovery-forbidden-secondary-focus.png) | [查看](390-control-recovery-forbidden-secondary-pressed.png) |
| 限流 / 主操作 | [查看](390-control-recovery-rate-limited-primary-default.png) | [查看](390-control-recovery-rate-limited-primary-hover.png) | [查看](390-control-recovery-rate-limited-primary-focus.png) | [查看](390-control-recovery-rate-limited-primary-pressed.png) |
| 限流 / 次操作 | [查看](390-control-recovery-rate-limited-secondary-default.png) | [查看](390-control-recovery-rate-limited-secondary-hover.png) | [查看](390-control-recovery-rate-limited-secondary-focus.png) | [查看](390-control-recovery-rate-limited-secondary-pressed.png) |
| 依赖受阻 / 主操作 | [查看](390-control-recovery-blocked-primary-default.png) | [查看](390-control-recovery-blocked-primary-hover.png) | [查看](390-control-recovery-blocked-primary-focus.png) | [查看](390-control-recovery-blocked-primary-pressed.png) |
| 依赖受阻 / 次操作 | [查看](390-control-recovery-blocked-secondary-default.png) | [查看](390-control-recovery-blocked-secondary-hover.png) | [查看](390-control-recovery-blocked-secondary-focus.png) | [查看](390-control-recovery-blocked-secondary-pressed.png) |
| 空目录 / 管理者 / 主操作 | [查看](390-control-recovery-empty-primary-default.png) | [查看](390-control-recovery-empty-primary-hover.png) | [查看](390-control-recovery-empty-primary-focus.png) | [查看](390-control-recovery-empty-primary-pressed.png) |
| 空目录 / 管理者 / 次操作 | [查看](390-control-recovery-empty-secondary-default.png) | [查看](390-control-recovery-empty-secondary-hover.png) | [查看](390-control-recovery-empty-secondary-focus.png) | [查看](390-control-recovery-empty-secondary-pressed.png) |
| 空目录 / 只读 / 主操作 | [查看](390-control-recovery-empty-readonly-primary-default.png) | [查看](390-control-recovery-empty-readonly-primary-hover.png) | [查看](390-control-recovery-empty-readonly-primary-focus.png) | [查看](390-control-recovery-empty-readonly-primary-pressed.png) |
| 空目录 / 只读 / 次操作 | [查看](390-control-recovery-empty-readonly-secondary-default.png) | [查看](390-control-recovery-empty-readonly-secondary-hover.png) | [查看](390-control-recovery-empty-readonly-secondary-focus.png) | [查看](390-control-recovery-empty-readonly-secondary-pressed.png) |
| 搜索无结果 / 管理者 / 主操作 | [查看](390-control-recovery-search-primary-default.png) | [查看](390-control-recovery-search-primary-hover.png) | [查看](390-control-recovery-search-primary-focus.png) | [查看](390-control-recovery-search-primary-pressed.png) |
| 搜索无结果 / 管理者 / 次操作 | [查看](390-control-recovery-search-secondary-default.png) | [查看](390-control-recovery-search-secondary-hover.png) | [查看](390-control-recovery-search-secondary-focus.png) | [查看](390-control-recovery-search-secondary-pressed.png) |
| 搜索无结果 / 只读 / 主操作 | [查看](390-control-recovery-search-readonly-primary-default.png) | [查看](390-control-recovery-search-readonly-primary-hover.png) | [查看](390-control-recovery-search-readonly-primary-focus.png) | [查看](390-control-recovery-search-readonly-primary-pressed.png) |
| 搜索无结果 / 只读 / 次操作 | [查看](390-control-recovery-search-readonly-secondary-default.png) | [查看](390-control-recovery-search-readonly-secondary-hover.png) | [查看](390-control-recovery-search-readonly-secondary-focus.png) | [查看](390-control-recovery-search-readonly-secondary-pressed.png) |

[主操作状态审核](../../SOURCING-MAIN-STATE-REVIEW.md)。2026-09-09：主操作新增96张双端图；本包62主场景385PNG、23控件变体240双端状态实例。8语义组增加36代表槽，第二采购来源/其他记录/已勾选为3额外变体，不新增业务动作；累计84代表槽已绑定、86待补。局部/读取控件没有源码禁用或busy条件的，不编造图或减分母。仅离线提案，未提升批准、改生产或部署。

## 主操作状态图直达

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 发起找货 | [查看](1440-control-main-search-open-default.png) | [查看](1440-control-main-search-open-hover.png) | [查看](1440-control-main-search-open-focus.png) | [查看](1440-control-main-search-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 确认报价入口 | [查看](1440-control-main-quote-open-default.png) | [查看](1440-control-main-quote-open-hover.png) | [查看](1440-control-main-quote-open-focus.png) | [查看](1440-control-main-quote-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 采购入口 / 第一来源 | [查看](1440-control-main-purchase-open-default.png) | [查看](1440-control-main-purchase-open-hover.png) | [查看](1440-control-main-purchase-open-focus.png) | [查看](1440-control-main-purchase-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 删除入口 | [查看](1440-control-main-delete-open-default.png) | [查看](1440-control-main-delete-open-hover.png) | [查看](1440-control-main-delete-open-focus.png) | [查看](1440-control-main-delete-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 当前记录 | [查看](1440-control-main-record-current-default.png) | [查看](1440-control-main-record-current-hover.png) | [查看](1440-control-main-record-current-focus.png) | [查看](1440-control-main-record-current-pressed.png) | 源码无此条件 | 源码无此条件 |
| 未选报价 | [查看](1440-control-main-select-default.png) | [查看](1440-control-main-select-hover.png) | [查看](1440-control-main-select-focus.png) | [查看](1440-control-main-select-pressed.png) | 源码无此条件 | 源码无此条件 |
| 保存对比 | [查看](1440-control-main-compare-default.png) | [查看](1440-control-main-compare-hover.png) | [查看](1440-control-main-compare-focus.png) | [查看](1440-control-main-compare-pressed.png) | [查看](1440-control-main-compare-disabled.png) | [查看](1440-control-main-compare-busy.png) |
| 重新采集 | [查看](1440-control-main-refresh-default.png) | [查看](1440-control-main-refresh-hover.png) | [查看](1440-control-main-refresh-focus.png) | [查看](1440-control-main-refresh-pressed.png) | [查看](1440-control-main-refresh-disabled.png) | [查看](1440-control-main-refresh-busy.png) |
| 采购入口 / 第二来源 | [查看](1440-control-main-purchase-second-default.png) | [查看](1440-control-main-purchase-second-hover.png) | [查看](1440-control-main-purchase-second-focus.png) | [查看](1440-control-main-purchase-second-pressed.png) | 源码无此条件 | 源码无此条件 |
| 其他记录 | [查看](1440-control-main-record-other-default.png) | [查看](1440-control-main-record-other-hover.png) | [查看](1440-control-main-record-other-focus.png) | [查看](1440-control-main-record-other-pressed.png) | 源码无此条件 | 源码无此条件 |
| 已选报价 | [查看](1440-control-main-select-checked-default.png) | [查看](1440-control-main-select-checked-hover.png) | [查看](1440-control-main-select-checked-focus.png) | [查看](1440-control-main-select-checked-pressed.png) | 源码无此条件 | 源码无此条件 |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 发起找货 | [查看](390-control-main-search-open-default.png) | [查看](390-control-main-search-open-hover.png) | [查看](390-control-main-search-open-focus.png) | [查看](390-control-main-search-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 确认报价入口 | [查看](390-control-main-quote-open-default.png) | [查看](390-control-main-quote-open-hover.png) | [查看](390-control-main-quote-open-focus.png) | [查看](390-control-main-quote-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 采购入口 / 第一来源 | [查看](390-control-main-purchase-open-default.png) | [查看](390-control-main-purchase-open-hover.png) | [查看](390-control-main-purchase-open-focus.png) | [查看](390-control-main-purchase-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 删除入口 | [查看](390-control-main-delete-open-default.png) | [查看](390-control-main-delete-open-hover.png) | [查看](390-control-main-delete-open-focus.png) | [查看](390-control-main-delete-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 当前记录 | [查看](390-control-main-record-current-default.png) | [查看](390-control-main-record-current-hover.png) | [查看](390-control-main-record-current-focus.png) | [查看](390-control-main-record-current-pressed.png) | 源码无此条件 | 源码无此条件 |
| 未选报价 | [查看](390-control-main-select-default.png) | [查看](390-control-main-select-hover.png) | [查看](390-control-main-select-focus.png) | [查看](390-control-main-select-pressed.png) | 源码无此条件 | 源码无此条件 |
| 保存对比 | [查看](390-control-main-compare-default.png) | [查看](390-control-main-compare-hover.png) | [查看](390-control-main-compare-focus.png) | [查看](390-control-main-compare-pressed.png) | [查看](390-control-main-compare-disabled.png) | [查看](390-control-main-compare-busy.png) |
| 重新采集 | [查看](390-control-main-refresh-default.png) | [查看](390-control-main-refresh-hover.png) | [查看](390-control-main-refresh-focus.png) | [查看](390-control-main-refresh-pressed.png) | [查看](390-control-main-refresh-disabled.png) | [查看](390-control-main-refresh-busy.png) |
| 采购入口 / 第二来源 | [查看](390-control-main-purchase-second-default.png) | [查看](390-control-main-purchase-second-hover.png) | [查看](390-control-main-purchase-second-focus.png) | [查看](390-control-main-purchase-second-pressed.png) | 源码无此条件 | 源码无此条件 |
| 其他记录 | [查看](390-control-main-record-other-default.png) | [查看](390-control-main-record-other-hover.png) | [查看](390-control-main-record-other-focus.png) | [查看](390-control-main-record-other-pressed.png) | 源码无此条件 | 源码无此条件 |
| 已选报价 | [查看](390-control-main-select-checked-default.png) | [查看](390-control-main-select-checked-hover.png) | [查看](390-control-main-select-checked-focus.png) | [查看](390-control-main-select-checked-pressed.png) | 源码无此条件 | 源码无此条件 |

2026-09-09最新：[关闭与取消状态审核](../../SOURCING-SECONDARY-STATE-REVIEW.md)新增96图，现62主场景289PNG、12控件变体144双端状态实例；48代表槽已绑定、122待补。父请求在途关闭锁为待审提案，真实Vue仍允许关闭；取消没有自己的请求或旋转标记。键盘回到实际入口（含第二采购按钮）、搜索/删除保留和报价/采购重开预填通过离线检查；没有提升批准、改生产或部署。以下193图/146槽为前批记录。

## 关闭与取消图直达

| 控件 / 宽度 | 默认 | 悬停 | 焦点 | 按下 | 禁用 | 父请求在途 |
| --- | --- | --- | --- | --- | --- | --- |
| search-close / 1440px | [查看](1440-control-search-close-default.png) | [查看](1440-control-search-close-hover.png) | [查看](1440-control-search-close-focus.png) | [查看](1440-control-search-close-pressed.png) | [查看](1440-control-search-close-disabled.png) | [查看](1440-control-search-close-busy.png) |
| search-cancel / 1440px | [查看](1440-control-search-cancel-default.png) | [查看](1440-control-search-cancel-hover.png) | [查看](1440-control-search-cancel-focus.png) | [查看](1440-control-search-cancel-pressed.png) | [查看](1440-control-search-cancel-disabled.png) | [查看](1440-control-search-cancel-busy.png) |
| quote-close / 1440px | [查看](1440-control-quote-close-default.png) | [查看](1440-control-quote-close-hover.png) | [查看](1440-control-quote-close-focus.png) | [查看](1440-control-quote-close-pressed.png) | [查看](1440-control-quote-close-disabled.png) | [查看](1440-control-quote-close-busy.png) |
| quote-cancel / 1440px | [查看](1440-control-quote-cancel-default.png) | [查看](1440-control-quote-cancel-hover.png) | [查看](1440-control-quote-cancel-focus.png) | [查看](1440-control-quote-cancel-pressed.png) | [查看](1440-control-quote-cancel-disabled.png) | [查看](1440-control-quote-cancel-busy.png) |
| purchase-close / 1440px | [查看](1440-control-purchase-close-default.png) | [查看](1440-control-purchase-close-hover.png) | [查看](1440-control-purchase-close-focus.png) | [查看](1440-control-purchase-close-pressed.png) | [查看](1440-control-purchase-close-disabled.png) | [查看](1440-control-purchase-close-busy.png) |
| purchase-cancel / 1440px | [查看](1440-control-purchase-cancel-default.png) | [查看](1440-control-purchase-cancel-hover.png) | [查看](1440-control-purchase-cancel-focus.png) | [查看](1440-control-purchase-cancel-pressed.png) | [查看](1440-control-purchase-cancel-disabled.png) | [查看](1440-control-purchase-cancel-busy.png) |
| delete-close / 1440px | [查看](1440-control-delete-close-default.png) | [查看](1440-control-delete-close-hover.png) | [查看](1440-control-delete-close-focus.png) | [查看](1440-control-delete-close-pressed.png) | [查看](1440-control-delete-close-disabled.png) | [查看](1440-control-delete-close-busy.png) |
| delete-cancel / 1440px | [查看](1440-control-delete-cancel-default.png) | [查看](1440-control-delete-cancel-hover.png) | [查看](1440-control-delete-cancel-focus.png) | [查看](1440-control-delete-cancel-pressed.png) | [查看](1440-control-delete-cancel-disabled.png) | [查看](1440-control-delete-cancel-busy.png) |
| search-close / 390px | [查看](390-control-search-close-default.png) | [查看](390-control-search-close-hover.png) | [查看](390-control-search-close-focus.png) | [查看](390-control-search-close-pressed.png) | [查看](390-control-search-close-disabled.png) | [查看](390-control-search-close-busy.png) |
| search-cancel / 390px | [查看](390-control-search-cancel-default.png) | [查看](390-control-search-cancel-hover.png) | [查看](390-control-search-cancel-focus.png) | [查看](390-control-search-cancel-pressed.png) | [查看](390-control-search-cancel-disabled.png) | [查看](390-control-search-cancel-busy.png) |
| quote-close / 390px | [查看](390-control-quote-close-default.png) | [查看](390-control-quote-close-hover.png) | [查看](390-control-quote-close-focus.png) | [查看](390-control-quote-close-pressed.png) | [查看](390-control-quote-close-disabled.png) | [查看](390-control-quote-close-busy.png) |
| quote-cancel / 390px | [查看](390-control-quote-cancel-default.png) | [查看](390-control-quote-cancel-hover.png) | [查看](390-control-quote-cancel-focus.png) | [查看](390-control-quote-cancel-pressed.png) | [查看](390-control-quote-cancel-disabled.png) | [查看](390-control-quote-cancel-busy.png) |
| purchase-close / 390px | [查看](390-control-purchase-close-default.png) | [查看](390-control-purchase-close-hover.png) | [查看](390-control-purchase-close-focus.png) | [查看](390-control-purchase-close-pressed.png) | [查看](390-control-purchase-close-disabled.png) | [查看](390-control-purchase-close-busy.png) |
| purchase-cancel / 390px | [查看](390-control-purchase-cancel-default.png) | [查看](390-control-purchase-cancel-hover.png) | [查看](390-control-purchase-cancel-focus.png) | [查看](390-control-purchase-cancel-pressed.png) | [查看](390-control-purchase-cancel-disabled.png) | [查看](390-control-purchase-cancel-busy.png) |
| delete-close / 390px | [查看](390-control-delete-close-default.png) | [查看](390-control-delete-close-hover.png) | [查看](390-control-delete-close-focus.png) | [查看](390-control-delete-close-pressed.png) | [查看](390-control-delete-close-disabled.png) | [查看](390-control-delete-close-busy.png) |
| delete-cancel / 390px | [查看](390-control-delete-cancel-default.png) | [查看](390-control-delete-cancel-hover.png) | [查看](390-control-delete-cancel-focus.png) | [查看](390-control-delete-cancel-pressed.png) | [查看](390-control-delete-cancel-disabled.png) | [查看](390-control-delete-cancel-busy.png) |


## 四提交控件图直达

- [1440px · search · default](1440-control-search-default.png)
- [1440px · search · hover](1440-control-search-hover.png)
- [1440px · search · focus](1440-control-search-focus.png)
- [1440px · search · pressed](1440-control-search-pressed.png)
- [1440px · search · disabled](1440-control-search-disabled.png)
- [1440px · search · busy](1440-control-search-busy.png)
- [1440px · quote · default](1440-control-quote-default.png)
- [1440px · quote · hover](1440-control-quote-hover.png)
- [1440px · quote · focus](1440-control-quote-focus.png)
- [1440px · quote · pressed](1440-control-quote-pressed.png)
- [1440px · quote · disabled](1440-control-quote-disabled.png)
- [1440px · quote · busy](1440-control-quote-busy.png)
- [1440px · purchase · default](1440-control-purchase-default.png)
- [1440px · purchase · hover](1440-control-purchase-hover.png)
- [1440px · purchase · focus](1440-control-purchase-focus.png)
- [1440px · purchase · pressed](1440-control-purchase-pressed.png)
- [1440px · purchase · disabled](1440-control-purchase-disabled.png)
- [1440px · purchase · busy](1440-control-purchase-busy.png)
- [1440px · delete · default](1440-control-delete-default.png)
- [1440px · delete · hover](1440-control-delete-hover.png)
- [1440px · delete · focus](1440-control-delete-focus.png)
- [1440px · delete · pressed](1440-control-delete-pressed.png)
- [1440px · delete · disabled](1440-control-delete-disabled.png)
- [1440px · delete · busy](1440-control-delete-busy.png)
- [390px · search · default](390-control-search-default.png)
- [390px · search · hover](390-control-search-hover.png)
- [390px · search · focus](390-control-search-focus.png)
- [390px · search · pressed](390-control-search-pressed.png)
- [390px · search · disabled](390-control-search-disabled.png)
- [390px · search · busy](390-control-search-busy.png)
- [390px · quote · default](390-control-quote-default.png)
- [390px · quote · hover](390-control-quote-hover.png)
- [390px · quote · focus](390-control-quote-focus.png)
- [390px · quote · pressed](390-control-quote-pressed.png)
- [390px · quote · disabled](390-control-quote-disabled.png)
- [390px · quote · busy](390-control-quote-busy.png)
- [390px · purchase · default](390-control-purchase-default.png)
- [390px · purchase · hover](390-control-purchase-hover.png)
- [390px · purchase · focus](390-control-purchase-focus.png)
- [390px · purchase · pressed](390-control-purchase-pressed.png)
- [390px · purchase · disabled](390-control-purchase-disabled.png)
- [390px · purchase · busy](390-control-purchase-busy.png)
- [390px · delete · default](390-control-delete-default.png)
- [390px · delete · hover](390-control-delete-hover.png)
- [390px · delete · focus](390-control-delete-focus.png)
- [390px · delete · pressed](390-control-delete-pressed.png)
- [390px · delete · disabled](390-control-delete-disabled.png)
- [390px · delete · busy](390-control-delete-busy.png)

## 当前与历史覆盖

2026-09-09最新：[四提交按钮双端六态](../../SOURCING-CONTROL-STATE-REVIEW.md)新增48张，现62主场景193PNG，24代表状态槽已绑定，仍缺146槽。只细化离线提交按钮与修正手机长报价窗底栏；找货/报价/删除disabled与busy同一源条件，采购另有MOQ/原因条件。焦点/关闭锁/在途反馈非真实Vue实施，不提升批准。以下145图/170槽为上一批记录。

复验沿原命令：默认核对来源/图片并跑全部离线检查；新增--smoke只预检、不生成或验收图片；--capture重渲染本包永久图稿与证据。四按钮文字对比、实际hover/focus/pressed、圆角内命中和键盘精确payload均检查；手机端需滚动查看长表单，状态图保留按钮上下文而不冒充全表单。

2026-09-09：[逐动作审核入口](../../SOURCING-SEMANTIC-REVIEW.md)已将54源位置归38组，关联本包145图；仍缺170代表状态槽的逐控件证据。本轮没有改图、提升批准或实施生产，SC-G01–08继续待处理。

SOURCING-C-r1；起始main/b30fb8a2；62场景、145PNG。具体页面未获审，方向C不是逐页批准或部署许可。

[交互原型](index.html) · [全部图片图册](gallery.html) · [来源与验证证据](evidence.json)

## 新构图与使用

按frontend-design的流程导向构图：白身份栏、蓝找货记录范围、白色候选阅读面；报价与对象操作放在同一行的右区，证据和缺项留在事实旁。对比与机会成本是同一记录下的本地可键盘切换内容区，不新增路由/API/存储。手机顺序为范围、记录、来源状态、内容和选择操作栏；对比逐供应商纵排，不把五列压成小字。

直接打开index.html，在顶部选择审核场景。所有报价、供应商、成本、版本和响应都是合成合同样本；外链使用保留示例域名，不对应真实商品。点击只记录内存请求/导航意图，不连接HTTP/SQL/生产，不下单、不付款、不采集或提交真实审批。生产代码/费用算法不变。

## 覆盖与事实边界

- 62主场景双端124张；9张长弹窗下半部图；第六选择拒绝、低于MOQ及主按钮focus/hover双端8张；768/1024代表页4张，共145张。普通页全长、模态图只截实际视口，避免把视口外未遮罩内容误当弹窗效果。
- 货源、来源进度、ERP线索、2–5对比、四种搜索、报价确认、MOQ采购、原因删除与机会成本三种身份（已生效/待复核/计算快照）均有提案。
- 显式0和缺失不同；已有MOQ=1/交期=7/可信度=80只是来源表单默认，图中提示逐项核实，不宣称来自采集。报价不发送原始price/currency修改字段。稳定性variable按现有选项表达为波动，不改后端枚举。
- 已保存对比绑定保存时的报价ID，不说今天仍是现行报价。格式提示仅归一全半角、大小写和空白，不换算单位或判断等价。
- ERP历史参考不是确认报价；到岸价待费用规则计算。仅calculated场景显示明确合成的服务端利润快照；缺输入、待复核、重算排队均不在浏览器计算或制造ROI。
- 成本提交需要另一名活动cost:confirm复核人，expected_version来自机会；复核采用独立review版本3；采购使用quote_id和MOQ。P22费用版本双角色审批不放进P21，也不把不同合同混成同一个版本字段。

## 动作 / 弹窗映射

| 来源语义 | 场景与局部验证 | 未覆盖的运行边界 |
| --- | --- | --- |
| SC-S-OPEN/CLOSE/SUBMIT | keyword/image/opportunity/product_url，required、取消保留、两字段原样POST、错误/忙碌 | 来源条款真实校验、所有并发关闭/重开 |
| SC-SEARCH/DETAIL/NAV | 搜索、记录切换、真实from/机会/采集明细目标、独立平台权限 | 实际history、KeepAlive、范围与迟到结果 |
| SC-QUOTE | 四窗之一；九报价字段及candidate_id、时间本地转UTC、0、原始价格不可编辑 | 当前报价事务、证据归属、datalist越权不能由前端证明 |
| SC-SELECT/COMPARE | 1项禁保存、2–5可保存、第六不勾选、取消已有选择、精确quote IDs | 实际报价is_current/同范围校验、写后持久结果 |
| SC-PURCHASE | 版本/MOQ/证据同屏，99低于100不提交、trim原因、重开默认 | 真实采购任务消费者与执行 |
| SC-DELETE/REFRESH | trim原因、不编revision，历史保留，失败保留输入/取消；刷新只有排队 | 真实软删审计、写成功后GET失败/迟到归属 |
| SC-COST-SUBMIT/RECALCULATE | 九字段、reviewer、机会version7；原始观察时刻；缺输入无ROI | 真实双人/数据库/24h提醒与升级 |
| SC-COST-REVIEW | 按can_review显式显示，两种内联原因，review.version3与trim原因、取消 | 真实后端身份、过期、跨记录并发 |
| SC-SOURCE/ERP/STATE | 新窗口声明、错误/限流/空态、纯重读意图 | 目的地运行、全共享状态主次动作矩阵 |

场景DOM有28个动作标记，包含本地内容切换/复核入口的变体，不是全站去重动作分母或28个完整业务验收。成本提交与成本复核是内联表单，不算第五/第六弹窗。来源四窗的原生dialog焦点循环、Escape/遮罩取消和归还、窗内错误、busy锁是新提案；未应用到实际Vue。

## 源码证据与未修复项

九组真实setup隔离检查执行SourcingWorkspace、SourcingCostConfirmationPanel与SourcingComparisonPanel，Vue reactivity真实、transport/router/checkbox宿主为替身；不是实际DOM组件挂载或SQL验证。

已复现：比较历史GET失败阻断已有找货列表；刷新成功notice被load清空；variable缺中文映射；成本Promise.all在reviewer读取失败时不形成新快照。源报价默认1/7/80与cost时间默认仍保留。图稿的独立降级/准确提示/焦点约束不能当这些源码缺口已修。源代码无计时GET，不把后台投影等同页面轮询。

SC-G01–08保持开放。当前仅9宽度×5代表面、双端主要交互、纽约/上海报价时间抽样；720×500是等效CSS重排，不是真实200%缩放或辅助技术。三主题两密度仅代表主面，不覆盖所有弹窗/内容/错误组合。长文本、完整主题矩阵、真实Vue/RBAC/SQL/Worker/通知/事务/所有竞态及生产签收均待办；此前E2E文件仅来源绑定，本轮未重跑。

## 复验 / 交付

- 源最小检查：`node scripts/verify-ui-phase2-sourcing-source.mjs`。
- 只读复验：`node scripts/verify-ui-phase2-sourcing-c.mjs`，比较来源/图片指纹后跑隔离浏览器。
- 有意重生成本包：`node scripts/verify-ui-phase2-sourcing-c.mjs --capture`；只写本包正式PNG、evidence.json和gallery.html。不得刷新其他包掩盖漂移。
- 项目门禁和清理准确记录见[本轮记录](../../PROGRESS.md)。正式145PNG、图册与两永久验证器保留；无一次性临时文件/服务，验证浏览器finally关闭。
- 不改生产Vue/API/OpenAPI、配置、依赖、数据库、权限、原费用规则或历史证据；无需重启。P22仍待单独整页交稿；所有73页实施、审核、部署和签收没有完成。

审核请注明“P21 / SOURCING-C-r1 / 场景 / 通过或修改意见”。不能由选C自动批准任何一页。

## 逐场景图片

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 完整找货工作台 | [查看](1440-workspace.png) | [查看](390-workspace.png) |
| 关键词记录 / 无机会成本 | [查看](1440-keyword-record.png) | [查看](390-keyword-record.png) |
| 待确认报价字段 | [查看](1440-missing-quote.png) | [查看](390-missing-quote.png) |
| 只读货源 | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| 独立成本权限 | [查看](1440-cost-only.png) | [查看](390-cost-only.png) |
| 受权采集明细 | [查看](1440-platform-inspect.png) | [查看](390-platform-inspect.png) |
| 首次排队 | [查看](1440-queued.png) | [查看](390-queued.png) |
| 来源执行中 | [查看](1440-running.png) | [查看](390-running.png) |
| 部分来源受阻 | [查看](1440-source-blocked.png) | [查看](390-source-blocked.png) |
| 采集失败 | [查看](1440-failed.png) | [查看](390-failed.png) |
| 采集成功无候选 | [查看](1440-empty-result.png) | [查看](390-empty-result.png) |
| 无找货记录 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 正在读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 会话过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权限 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 限流 | [查看](1440-rate-limited.png) | [查看](390-rate-limited.png) |
| 搜索无结果 | [查看](1440-search-empty.png) | [查看](390-search-empty.png) |
| 详情失败 | [查看](1440-detail-error.png) | [查看](390-detail-error.png) |
| 对比历史读取失败 | [查看](1440-comparison-error.png) | [查看](390-comparison-error.png) |
| ERP参考不作为确认报价 | [查看](1440-erp.png) | [查看](390-erp.png) |
| 选择一家 | [查看](1440-select-one.png) | [查看](390-select-one.png) |
| 选择两家 | [查看](1440-select-two.png) | [查看](390-select-two.png) |
| 最多五家 | [查看](1440-select-five.png) | [查看](390-select-five.png) |
| 已保存对比 | [查看](1440-comparison.png) | [查看](390-comparison.png) |
| 规格仅格式差异 | [查看](1440-spec-format.png) | [查看](390-spec-format.png) |
| 规格不一致 | [查看](1440-spec-different.png) | [查看](390-spec-different.png) |
| 找货输入 / keyword | [查看](1440-search-keyword.png) | [查看](390-search-keyword.png) |
| 找货输入 / image | [查看](1440-search-image.png) | [查看](390-search-image.png) |
| 找货输入 / opportunity | [查看](1440-search-opportunity.png) | [查看](390-search-opportunity.png) |
| 找货输入 / product_url | [查看](1440-search-product_url.png) | [查看](390-search-product_url.png) |
| 找货失败保留 | [查看](1440-search-error.png) | [查看](390-search-error.png) |
| 找货提交中 | [查看](1440-search-busy.png) | [查看](390-search-busy.png) |
| 确认新报价版本 | [查看](1440-quote.png) | [查看](390-quote.png) |
| 缺字段预填非事实 | [查看](1440-quote-defaults.png) | [查看](390-quote-defaults.png) |
| 报价失败保留 | [查看](1440-quote-error.png) | [查看](390-quote-error.png) |
| 报价提交中 | [查看](1440-quote-busy.png) | [查看](390-quote-busy.png) |
| 锁定报价与MOQ | [查看](1440-purchase.png) | [查看](390-purchase.png) |
| 采购失败保留 | [查看](1440-purchase-error.png) | [查看](390-purchase-error.png) |
| 采购提交中 | [查看](1440-purchase-busy.png) | [查看](390-purchase-busy.png) |
| 删除保留证据 | [查看](1440-delete.png) | [查看](390-delete.png) |
| 删除失败保留 | [查看](1440-delete-error.png) | [查看](390-delete-error.png) |
| 删除提交中 | [查看](1440-delete-busy.png) | [查看](390-delete-busy.png) |
| 利润输入不足 | [查看](1440-cost-missing.png) | [查看](390-cost-missing.png) |
| 已计算历史快照 | [查看](1440-cost-calculated.png) | [查看](390-cost-calculated.png) |
| 成本待复核 | [查看](1440-cost-pending.png) | [查看](390-cost-pending.png) |
| 复核超时不自动批准 | [查看](1440-cost-overdue.png) | [查看](390-cost-overdue.png) |
| 复核通过记录 | [查看](1440-cost-approved.png) | [查看](390-cost-approved.png) |
| 复核驳回记录 | [查看](1440-cost-rejected.png) | [查看](390-cost-rejected.png) |
| 成本只读 | [查看](1440-cost-readonly.png) | [查看](390-cost-readonly.png) |
| 内联通过原因 | [查看](1440-cost-review-approved.png) | [查看](390-cost-review-approved.png) |
| 内联驳回原因 | [查看](1440-cost-review-rejected.png) | [查看](390-cost-review-rejected.png) |
| 成本读取失败 | [查看](1440-cost-error.png) | [查看](390-cost-error.png) |
| 无可选复核人 | [查看](1440-cost-reviewers-empty.png) | [查看](390-cost-reviewers-empty.png) |
| 成本提交失败保留 | [查看](1440-cost-submit-error.png) | [查看](390-cost-submit-error.png) |
| 利润重算排队 | [查看](1440-cost-recalculating.png) | [查看](390-cost-recalculating.png) |
| deep-ocean / standard | [查看](1440-deep-ocean-standard.png) | [查看](390-deep-ocean-standard.png) |
| deep-ocean / compact | [查看](1440-deep-ocean-compact.png) | [查看](390-deep-ocean-compact.png) |
| cloud-white / standard | [查看](1440-cloud-white-standard.png) | [查看](390-cloud-white-standard.png) |
| cloud-white / compact | [查看](1440-cloud-white-compact.png) | [查看](390-cloud-white-compact.png) |
| aurora-purple / standard | [查看](1440-aurora-purple-standard.png) | [查看](390-aurora-purple-standard.png) |
| aurora-purple / compact | [查看](1440-aurora-purple-compact.png) | [查看](390-aurora-purple-compact.png) |

### 长表单、控件和断点补图

- [quote-lower · 1440px](1440-quote-lower.png)
- [quote-defaults-lower · 1440px](1440-quote-defaults-lower.png)
- [quote-error-lower · 1440px](1440-quote-error-lower.png)
- [quote-busy-lower · 1440px](1440-quote-busy-lower.png)
- [sixth-rejected · 1440px](1440-sixth-rejected.png)
- [purchase-below-moq · 1440px](1440-purchase-below-moq.png)
- [button-focus · 1440px](1440-button-focus.png)
- [button-hover · 1440px](1440-button-hover.png)
- [quote-lower · 390px](390-quote-lower.png)
- [quote-defaults-lower · 390px](390-quote-defaults-lower.png)
- [quote-error-lower · 390px](390-quote-error-lower.png)
- [quote-busy-lower · 390px](390-quote-busy-lower.png)
- [purchase-error-lower · 390px](390-purchase-error-lower.png)
- [sixth-rejected · 390px](390-sixth-rejected.png)
- [purchase-below-moq · 390px](390-purchase-below-moq.png)
- [button-focus · 390px](390-button-focus.png)
- [button-hover · 390px](390-button-hover.png)
- [workspace · 768px](768-workspace.png)
- [cost-calculated · 768px](768-cost-calculated.png)
- [workspace · 1024px](1024-workspace.png)
- [cost-calculated · 1024px](1024-cost-calculated.png)
