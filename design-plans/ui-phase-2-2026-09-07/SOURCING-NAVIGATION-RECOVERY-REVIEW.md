# P21 导航、搜索与恢复 · C 方向审核

本批待具体审核，不扩大P16布局批准。新增28控件变体的双端四态224PNG，另有只读空目录、只读搜索无结果、依赖受阻三场景6PNG，共230新图。完整capture已验证本包65主场景615PNG、51控件变体464双端状态实例；最低控件文字对比6.328，HTTP/页面错误0；只目检手机只读空目录及桌面来源链接focus两图。

## 设计边界

保留已选C方向：身份栏中加入紧凑模块导航，当前页以底线/浅底和aria-current区分，不把键盘焦点当成选中。导航及恢复操作深蓝3px焦点，按下内阴影；当前导航悬停另加浅蓝底。搜索仍位于蓝色范围区，白色键盘轮廓，未新增业务筛选。

加载、失败、无权限、过期、限流和依赖受阻时不显示旧找货记录、旧详情标题、重新采集或删除入口；数量标“待读取”，不能声称零条。空目录才显示零条，没有候选列表。搜索无结果只反映本地筛选，清空搜索不删除记录。全局创建入口仍按源supplier_quote:manage控制，不因本页状态推断整个账号权限。

源码UiStatePanel部分通用标签与本页handler不一致：错误次按钮并非返回上一页、无权限按钮并非首页/申请权限、过期按钮并非重新登录、受阻次按钮并非查看影响，实际均调用load。本稿命名“重新读取 / 再次检查”如实表达相同重读；没有擅自实现新导航或授权流程。重复主次操作仍列作源变体待审，不包装成两种不同能力。

## 精确恢复关系

| 来源场景 | 主操作 | 次操作 |
| --- | --- | --- |
| 空目录 / 管理者 | 打开发起找货窗口，不POST | 清空query，不GET、不创建记录 |
| 空目录 / 只读 | load | 清空query，不GET |
| 搜索无结果 / 管理者 | 清空query | 打开发起找货窗口，不POST |
| 搜索无结果 / 只读 | 清空query | load |
| 读取失败 / 无权限 / 受阻（含限流） | load | load；不返回/申请权限/查看其他页 |
| 会话过期 | load | 源组件没有次按钮 |
| 加载中 | 无恢复按钮 | 无恢复按钮 |

源load先清选中报价并进入loading，再GET /sourcing/searches，随后对比历史与详情依赖响应。本稿只记录首个GET意图并显示loading，不假装恢复成功；状态操作不是写请求，不加伪造的disabled或busy按钮图。只读身份跨这次加载显示保持。字段筛选按源trim、小写、显示名/input_ref/status，本地输入与清空不发送请求，不扩展到任意ID。

## 导航目标

| 位置 | 目标约束 |
| --- | --- |
| 模块当前页 / 模块费用规则 | /sourcing 与 /sourcing/cost-rules，不强制保留旧record/query |
| 当前记录费用规则 | from引用本页路径；本批验证record及q样本，不宣称全部真实路由参数/浏览器历史通过 |
| 采集明细 | /platform-admin/collection?task=collection_task_id，仅有progress且受权 |
| ERP / 原始商品页 | 当前记录来源URL，新窗口noopener noreferrer；合成example.com仅离线样本，未访问外站 |
| 机会详情 | /opportunities/:id?tab=profit&from=/sourcing，不冒称保留record |
| 利润面板费用规则 | 固定/sourcing/cost-rules，不带from |

补第二家及未确认报价候选的来源链接、带q的费用规则作为额外变体，不新增语义动作。八导航与两恢复代表组新增40状态槽；累计124映射、46待补。没有禁用/busy条件的导航不适用，恢复两组的相关槽仍not-mapped等待统一分母复核，不改审计规则凑完成。

## 三张新增场景 / 双端

- [1440px · 空目录 / 只读](design/sourcing-direction-c/1440-empty-readonly.png)
- [1440px · 搜索无结果 / 只读](design/sourcing-direction-c/1440-search-empty-readonly.png)
- [1440px · 依赖受阻](design/sourcing-direction-c/1440-blocked.png)
- [390px · 空目录 / 只读](design/sourcing-direction-c/390-empty-readonly.png)
- [390px · 搜索无结果 / 只读](design/sourcing-direction-c/390-search-empty-readonly.png)
- [390px · 依赖受阻](design/sourcing-direction-c/390-blocked.png)

## 逐控件上下文图

每图通过浏览器真实鼠标/键盘状态生成；视口保留控件上下文，不是同图改名。没有禁用和busy列，因为这些控件没有相应源码条件；loading是一张页面状态，不是“禁用的恢复按钮”。

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| 供应商找货导航 | [查看](design/sourcing-direction-c/1440-control-nav-self-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-self-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-self-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-self-pressed.png) |
| 费用规则导航 | [查看](design/sourcing-direction-c/1440-control-nav-rules-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-rules-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-rules-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-rules-pressed.png) |
| 当前记录费用规则 | [查看](design/sourcing-direction-c/1440-control-nav-context-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-pressed.png) |
| 采集任务明细 | [查看](design/sourcing-direction-c/1440-control-nav-collection-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-collection-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-collection-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-collection-pressed.png) |
| ERP 外部页面 | [查看](design/sourcing-direction-c/1440-control-nav-erp-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-erp-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-erp-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-erp-pressed.png) |
| 首家原始商品页 | [查看](design/sourcing-direction-c/1440-control-nav-source-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-pressed.png) |
| 机会利润详情 | [查看](design/sourcing-direction-c/1440-control-nav-opportunity-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-opportunity-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-opportunity-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-opportunity-pressed.png) |
| 利润面板费用规则 | [查看](design/sourcing-direction-c/1440-control-nav-profit-rules-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-profit-rules-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-profit-rules-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-profit-rules-pressed.png) |
| 第二家原始商品页 | [查看](design/sourcing-direction-c/1440-control-nav-source-second-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-second-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-second-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-second-pressed.png) |
| 未确认候选原始页 | [查看](design/sourcing-direction-c/1440-control-nav-source-unconfirmed-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-unconfirmed-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-unconfirmed-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-source-unconfirmed-pressed.png) |
| 费用规则 / 带搜索条件 | [查看](design/sourcing-direction-c/1440-control-nav-context-query-default.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-query-hover.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-query-focus.png) | [查看](design/sourcing-direction-c/1440-control-nav-context-query-pressed.png) |
| 读取失败 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-error-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-primary-pressed.png) |
| 读取失败 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-error-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-error-secondary-pressed.png) |
| 会话过期 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-expired-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-expired-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-expired-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-expired-primary-pressed.png) |
| 无读取权限 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-primary-pressed.png) |
| 无读取权限 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-forbidden-secondary-pressed.png) |
| 限流 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-primary-pressed.png) |
| 限流 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-rate-limited-secondary-pressed.png) |
| 依赖受阻 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-primary-pressed.png) |
| 依赖受阻 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-blocked-secondary-pressed.png) |
| 空目录 / 管理者 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-empty-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-primary-pressed.png) |
| 空目录 / 管理者 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-empty-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-secondary-pressed.png) |
| 空目录 / 只读 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-primary-pressed.png) |
| 空目录 / 只读 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-empty-readonly-secondary-pressed.png) |
| 搜索无结果 / 管理者 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-search-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-primary-pressed.png) |
| 搜索无结果 / 管理者 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-search-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-secondary-pressed.png) |
| 搜索无结果 / 只读 / 主操作 | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-primary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-primary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-primary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-primary-pressed.png) |
| 搜索无结果 / 只读 / 次操作 | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-secondary-default.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-secondary-hover.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-secondary-focus.png) | [查看](design/sourcing-direction-c/1440-control-recovery-search-readonly-secondary-pressed.png) |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| 供应商找货导航 | [查看](design/sourcing-direction-c/390-control-nav-self-default.png) | [查看](design/sourcing-direction-c/390-control-nav-self-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-self-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-self-pressed.png) |
| 费用规则导航 | [查看](design/sourcing-direction-c/390-control-nav-rules-default.png) | [查看](design/sourcing-direction-c/390-control-nav-rules-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-rules-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-rules-pressed.png) |
| 当前记录费用规则 | [查看](design/sourcing-direction-c/390-control-nav-context-default.png) | [查看](design/sourcing-direction-c/390-control-nav-context-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-context-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-context-pressed.png) |
| 采集任务明细 | [查看](design/sourcing-direction-c/390-control-nav-collection-default.png) | [查看](design/sourcing-direction-c/390-control-nav-collection-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-collection-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-collection-pressed.png) |
| ERP 外部页面 | [查看](design/sourcing-direction-c/390-control-nav-erp-default.png) | [查看](design/sourcing-direction-c/390-control-nav-erp-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-erp-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-erp-pressed.png) |
| 首家原始商品页 | [查看](design/sourcing-direction-c/390-control-nav-source-default.png) | [查看](design/sourcing-direction-c/390-control-nav-source-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-source-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-source-pressed.png) |
| 机会利润详情 | [查看](design/sourcing-direction-c/390-control-nav-opportunity-default.png) | [查看](design/sourcing-direction-c/390-control-nav-opportunity-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-opportunity-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-opportunity-pressed.png) |
| 利润面板费用规则 | [查看](design/sourcing-direction-c/390-control-nav-profit-rules-default.png) | [查看](design/sourcing-direction-c/390-control-nav-profit-rules-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-profit-rules-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-profit-rules-pressed.png) |
| 第二家原始商品页 | [查看](design/sourcing-direction-c/390-control-nav-source-second-default.png) | [查看](design/sourcing-direction-c/390-control-nav-source-second-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-source-second-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-source-second-pressed.png) |
| 未确认候选原始页 | [查看](design/sourcing-direction-c/390-control-nav-source-unconfirmed-default.png) | [查看](design/sourcing-direction-c/390-control-nav-source-unconfirmed-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-source-unconfirmed-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-source-unconfirmed-pressed.png) |
| 费用规则 / 带搜索条件 | [查看](design/sourcing-direction-c/390-control-nav-context-query-default.png) | [查看](design/sourcing-direction-c/390-control-nav-context-query-hover.png) | [查看](design/sourcing-direction-c/390-control-nav-context-query-focus.png) | [查看](design/sourcing-direction-c/390-control-nav-context-query-pressed.png) |
| 读取失败 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-error-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-primary-pressed.png) |
| 读取失败 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-error-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-error-secondary-pressed.png) |
| 会话过期 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-expired-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-expired-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-expired-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-expired-primary-pressed.png) |
| 无读取权限 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-primary-pressed.png) |
| 无读取权限 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-forbidden-secondary-pressed.png) |
| 限流 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-primary-pressed.png) |
| 限流 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-rate-limited-secondary-pressed.png) |
| 依赖受阻 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-blocked-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-primary-pressed.png) |
| 依赖受阻 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-blocked-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-blocked-secondary-pressed.png) |
| 空目录 / 管理者 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-empty-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-primary-pressed.png) |
| 空目录 / 管理者 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-empty-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-secondary-pressed.png) |
| 空目录 / 只读 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-primary-pressed.png) |
| 空目录 / 只读 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-empty-readonly-secondary-pressed.png) |
| 搜索无结果 / 管理者 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-search-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-primary-pressed.png) |
| 搜索无结果 / 管理者 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-search-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-secondary-pressed.png) |
| 搜索无结果 / 只读 / 主操作 | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-primary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-primary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-primary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-primary-pressed.png) |
| 搜索无结果 / 只读 / 次操作 | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-secondary-default.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-secondary-hover.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-secondary-focus.png) | [查看](design/sourcing-direction-c/390-control-recovery-search-readonly-secondary-pressed.png) |

## 验证与未完成

- 新增两组真实setup隔离检查：恢复handler精确分支，以及只读/管理空目录和本地筛选；共11组，不是挂载真实Vue或服务端验收。
- 原有和新增控件跑双端真实hover/focus/pressed、44px目标、16px控件字、文字对比至少4.5、命中/焦点边界。目标/target/rel逐项检查；Enter只记录导航或首GET、零写打开/清空；HTTP和页面错误必须为0。
- 初次smoke误把透明背景当黑色造成ERP对比误报；读取真实祖先背景后修正测量正则。已选导航另补可区分的hover/pressed，不降低检查阈值。
- [交互原型](design/sourcing-direction-c/index.html) / [全部图册](design/sourcing-direction-c/gallery.html)。复验node scripts/verify-ui-phase2-sourcing-c.mjs，--smoke预检，--capture重生成本包永久交付物。实际结果与人工目检范围记录在[本批进展](PROGRESS.md)。
- 成本/复核控件、完整主题/字段/生命周期及SC-G01–08仍待，用户具体批准、真实Vue、API、部署未完成。生产代码/API/OpenAPI/env/数据库/依赖/权限未改，无重启要求。
