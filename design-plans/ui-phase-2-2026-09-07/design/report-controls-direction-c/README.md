# P28 报表与导出 · 逐按钮状态 C r1

REPORT-CONTROLS-C-r1 / 2026-09-10 / 独立待审图稿，未接入真实Vue或生产。

[双端图册](gallery.html) · [交互稿](index.html) · [原页面/弹窗90图](../report-direction-c/README.md) · [状态指纹](evidence.json) · [动作登记](../../action-reviews/P28.json) · [源码语义与边界](../../REPORT-SEMANTIC-REVIEW.md)

## 设计与覆盖

frontend-design技能指导在已选C方向中保留蓝色类型目录、白色报告阅读面及独立导出队列；复用父包controller、数据和布局，仅本包技术summary从辅助文案提升到16px操作字号。审核工具不是生产功能。

10个代表控件＋14个扩展变体，共104场景×1440/390＝208PNG。默认、悬停、真实Tab焦点、按下分别截图，8个支持在途的控件/变体另有禁用图；选中与按下分离。14源位置归10动作＋1模态接线，代表状态48引用、8源码无呈现槽和4导航槽；扩展60引用不增加动作数。唯一详情窗的其他内容状态仍在父包90图中，不重复计为新窗口。

## 合同与未完成

- 创建仍是固定CSV、三报表类型，无日期筛选；空报表可导出。下载为原始文件GET，不计创建事务；重建是无body POST，返回新ID而不覆盖旧记录。
- 详情没有新增下载按钮；不存在/无权只页面提示并清参数。组织成员数与本工作区任务是不同口径，null和0不混淆。
- 忙碌图通过既有场景或hold动作准备，截图时业务数据、URL及意图不变。所有HTTP拦截，未下载真实文件/修改数据库；来源夹具与过期标签/服务时间差异保持明示。
- 下载全局函数早退与仅当前行禁用、重建多ID并发、旧读取/写回执、跨范围缓存、全部角色/主题/密度/200%缩放和状态组合仍待。单busy原型不能证明真实独立忙碌状态的所有组合。
- 本包不是全页批准、真实Vue或生产验收。P28尚待你审核；全站73路由目标不缩小。父包/生产/接口/依赖/.env未改，无需重启。

## 复验与清理

`node scripts/verify-ui-phase2-report-controls-c.mjs --smoke`最小64检查；`--capture`生成永久208图/evidence/gallery；无参数只读校验。每图检查16px/44px、真实焦点/悬停/按下、无溢出及选区为空。浏览器/context在finally关闭，无HTTP/存储/Cookie或临时截图；图证与测试是永久交付。

## 双端逐态图

| 控件与状态 | 1440 | 390 |
| --- | --- | --- |
| 导出机会CSV · 默认 | [桌面](create-default-1440.png) | [手机](create-default-390.png) |
| 导出机会CSV · 真实悬停 | [桌面](create-hover-1440.png) | [手机](create-hover-390.png) |
| 导出机会CSV · Tab焦点 | [桌面](create-focus-1440.png) | [手机](create-focus-390.png) |
| 导出机会CSV · 按下未释放 | [桌面](create-pressed-1440.png) | [手机](create-pressed-390.png) |
| 导出机会CSV · 在途/禁用 | [桌面](create-pending-1440.png) | [手机](create-pending-390.png) |
| 机会导航（未选） · 默认 | [桌面](type-opportunity-default-1440.png) | [手机](type-opportunity-default-390.png) |
| 机会导航（未选） · 真实悬停 | [桌面](type-opportunity-hover-1440.png) | [手机](type-opportunity-hover-390.png) |
| 机会导航（未选） · Tab焦点 | [桌面](type-opportunity-focus-1440.png) | [手机](type-opportunity-focus-390.png) |
| 机会导航（未选） · 按下未释放 | [桌面](type-opportunity-pressed-1440.png) | [手机](type-opportunity-pressed-390.png) |
| 页面技术详情 · 默认 | [桌面](technical-page-default-1440.png) | [手机](technical-page-default-390.png) |
| 页面技术详情 · 真实悬停 | [桌面](technical-page-hover-1440.png) | [手机](technical-page-hover-390.png) |
| 页面技术详情 · Tab焦点 | [桌面](technical-page-focus-1440.png) | [手机](technical-page-focus-390.png) |
| 页面技术详情 · 按下未释放 | [桌面](technical-page-pressed-1440.png) | [手机](technical-page-pressed-390.png) |
| 服务错误重载 · 默认 | [桌面](reload-default-1440.png) | [手机](reload-default-390.png) |
| 服务错误重载 · 真实悬停 | [桌面](reload-hover-1440.png) | [手机](reload-hover-390.png) |
| 服务错误重载 · Tab焦点 | [桌面](reload-focus-1440.png) | [手机](reload-focus-390.png) |
| 服务错误重载 · 按下未释放 | [桌面](reload-pressed-1440.png) | [手机](reload-pressed-390.png) |
| 刷新状态 · 默认 | [桌面](refresh-default-1440.png) | [手机](refresh-default-390.png) |
| 刷新状态 · 真实悬停 | [桌面](refresh-hover-1440.png) | [手机](refresh-hover-390.png) |
| 刷新状态 · Tab焦点 | [桌面](refresh-focus-1440.png) | [手机](refresh-focus-390.png) |
| 刷新状态 · 按下未释放 | [桌面](refresh-pressed-1440.png) | [手机](refresh-pressed-390.png) |
| 刷新状态 · 在途/禁用 | [桌面](refresh-pending-1440.png) | [手机](refresh-pending-390.png) |
| 任务中心导航 · 默认 | [桌面](tasks-default-1440.png) | [手机](tasks-default-390.png) |
| 任务中心导航 · 真实悬停 | [桌面](tasks-hover-1440.png) | [手机](tasks-hover-390.png) |
| 任务中心导航 · Tab焦点 | [桌面](tasks-focus-1440.png) | [手机](tasks-focus-390.png) |
| 任务中心导航 · 按下未释放 | [桌面](tasks-pressed-1440.png) | [手机](tasks-pressed-390.png) |
| 下载有效文件 · 默认 | [桌面](download-default-1440.png) | [手机](download-default-390.png) |
| 下载有效文件 · 真实悬停 | [桌面](download-hover-1440.png) | [手机](download-hover-390.png) |
| 下载有效文件 · Tab焦点 | [桌面](download-focus-1440.png) | [手机](download-focus-390.png) |
| 下载有效文件 · 按下未释放 | [桌面](download-pressed-1440.png) | [手机](download-pressed-390.png) |
| 下载有效文件 · 在途/禁用 | [桌面](download-pending-1440.png) | [手机](download-pending-390.png) |
| 列表重建过期文件 · 默认 | [桌面](regenerate-list-default-1440.png) | [手机](regenerate-list-default-390.png) |
| 列表重建过期文件 · 真实悬停 | [桌面](regenerate-list-hover-1440.png) | [手机](regenerate-list-hover-390.png) |
| 列表重建过期文件 · Tab焦点 | [桌面](regenerate-list-focus-1440.png) | [手机](regenerate-list-focus-390.png) |
| 列表重建过期文件 · 按下未释放 | [桌面](regenerate-list-pressed-1440.png) | [手机](regenerate-list-pressed-390.png) |
| 列表重建过期文件 · 在途/禁用 | [桌面](regenerate-list-pending-1440.png) | [手机](regenerate-list-pending-390.png) |
| 查看导出详情 · 默认 | [桌面](detail-default-1440.png) | [手机](detail-default-390.png) |
| 查看导出详情 · 真实悬停 | [桌面](detail-hover-1440.png) | [手机](detail-hover-390.png) |
| 查看导出详情 · Tab焦点 | [桌面](detail-focus-1440.png) | [手机](detail-focus-390.png) |
| 查看导出详情 · 按下未释放 | [桌面](detail-pressed-1440.png) | [手机](detail-pressed-390.png) |
| 关闭详情 · 默认 | [桌面](close-default-1440.png) | [手机](close-default-390.png) |
| 关闭详情 · 真实悬停 | [桌面](close-hover-1440.png) | [手机](close-hover-390.png) |
| 关闭详情 · Tab焦点 | [桌面](close-focus-1440.png) | [手机](close-focus-390.png) |
| 关闭详情 · 按下未释放 | [桌面](close-pressed-1440.png) | [手机](close-pressed-390.png) |
| 趋势导航（未选） · 默认 | [桌面](type-trend-default-1440.png) | [手机](type-trend-default-390.png) |
| 趋势导航（未选） · 真实悬停 | [桌面](type-trend-hover-1440.png) | [手机](type-trend-hover-390.png) |
| 趋势导航（未选） · Tab焦点 | [桌面](type-trend-focus-1440.png) | [手机](type-trend-focus-390.png) |
| 趋势导航（未选） · 按下未释放 | [桌面](type-trend-pressed-1440.png) | [手机](type-trend-pressed-390.png) |
| 团队导航（未选） · 默认 | [桌面](type-team-default-1440.png) | [手机](type-team-default-390.png) |
| 团队导航（未选） · 真实悬停 | [桌面](type-team-hover-1440.png) | [手机](type-team-hover-390.png) |
| 团队导航（未选） · Tab焦点 | [桌面](type-team-focus-1440.png) | [手机](type-team-focus-390.png) |
| 团队导航（未选） · 按下未释放 | [桌面](type-team-pressed-1440.png) | [手机](type-team-pressed-390.png) |
| 机会导航（已选） · 默认 | [桌面](type-opportunity-selected-default-1440.png) | [手机](type-opportunity-selected-default-390.png) |
| 机会导航（已选） · 真实悬停 | [桌面](type-opportunity-selected-hover-1440.png) | [手机](type-opportunity-selected-hover-390.png) |
| 机会导航（已选） · Tab焦点 | [桌面](type-opportunity-selected-focus-1440.png) | [手机](type-opportunity-selected-focus-390.png) |
| 机会导航（已选） · 按下未释放 | [桌面](type-opportunity-selected-pressed-1440.png) | [手机](type-opportunity-selected-pressed-390.png) |
| 趋势导航（已选） · 默认 | [桌面](type-trend-selected-default-1440.png) | [手机](type-trend-selected-default-390.png) |
| 趋势导航（已选） · 真实悬停 | [桌面](type-trend-selected-hover-1440.png) | [手机](type-trend-selected-hover-390.png) |
| 趋势导航（已选） · Tab焦点 | [桌面](type-trend-selected-focus-1440.png) | [手机](type-trend-selected-focus-390.png) |
| 趋势导航（已选） · 按下未释放 | [桌面](type-trend-selected-pressed-1440.png) | [手机](type-trend-selected-pressed-390.png) |
| 团队导航（已选） · 默认 | [桌面](type-team-selected-default-1440.png) | [手机](type-team-selected-default-390.png) |
| 团队导航（已选） · 真实悬停 | [桌面](type-team-selected-hover-1440.png) | [手机](type-team-selected-hover-390.png) |
| 团队导航（已选） · Tab焦点 | [桌面](type-team-selected-focus-1440.png) | [手机](type-team-selected-focus-390.png) |
| 团队导航（已选） · 按下未释放 | [桌面](type-team-selected-pressed-1440.png) | [手机](type-team-selected-pressed-390.png) |
| 详情错误码 · 默认 | [桌面](technical-detail-default-1440.png) | [手机](technical-detail-default-390.png) |
| 详情错误码 · 真实悬停 | [桌面](technical-detail-hover-1440.png) | [手机](technical-detail-hover-390.png) |
| 详情错误码 · Tab焦点 | [桌面](technical-detail-focus-1440.png) | [手机](technical-detail-focus-390.png) |
| 详情错误码 · 按下未释放 | [桌面](technical-detail-pressed-1440.png) | [手机](technical-detail-pressed-390.png) |
| 详情重建过期文件 · 默认 | [桌面](regenerate-detail-default-1440.png) | [手机](regenerate-detail-default-390.png) |
| 详情重建过期文件 · 真实悬停 | [桌面](regenerate-detail-hover-1440.png) | [手机](regenerate-detail-hover-390.png) |
| 详情重建过期文件 · Tab焦点 | [桌面](regenerate-detail-focus-1440.png) | [手机](regenerate-detail-focus-390.png) |
| 详情重建过期文件 · 按下未释放 | [桌面](regenerate-detail-pressed-1440.png) | [手机](regenerate-detail-pressed-390.png) |
| 详情重建过期文件 · 在途/禁用 | [桌面](regenerate-detail-busy-1440.png) | [手机](regenerate-detail-busy-390.png) |
| 列表重建最终失败记录 · 默认 | [桌面](regenerate-list-dead-default-1440.png) | [手机](regenerate-list-dead-default-390.png) |
| 列表重建最终失败记录 · 真实悬停 | [桌面](regenerate-list-dead-hover-1440.png) | [手机](regenerate-list-dead-hover-390.png) |
| 列表重建最终失败记录 · Tab焦点 | [桌面](regenerate-list-dead-focus-1440.png) | [手机](regenerate-list-dead-focus-390.png) |
| 列表重建最终失败记录 · 按下未释放 | [桌面](regenerate-list-dead-pressed-1440.png) | [手机](regenerate-list-dead-pressed-390.png) |
| 列表重建最终失败记录 · 在途/禁用 | [桌面](regenerate-list-dead-busy-1440.png) | [手机](regenerate-list-dead-busy-390.png) |
| 登录失效重载 · 默认 | [桌面](reload-expired-default-1440.png) | [手机](reload-expired-default-390.png) |
| 登录失效重载 · 真实悬停 | [桌面](reload-expired-hover-1440.png) | [手机](reload-expired-hover-390.png) |
| 登录失效重载 · Tab焦点 | [桌面](reload-expired-focus-1440.png) | [手机](reload-expired-focus-390.png) |
| 登录失效重载 · 按下未释放 | [桌面](reload-expired-pressed-1440.png) | [手机](reload-expired-pressed-390.png) |
| 无权重载 · 默认 | [桌面](reload-forbidden-default-1440.png) | [手机](reload-forbidden-default-390.png) |
| 无权重载 · 真实悬停 | [桌面](reload-forbidden-hover-1440.png) | [手机](reload-forbidden-hover-390.png) |
| 无权重载 · Tab焦点 | [桌面](reload-forbidden-focus-1440.png) | [手机](reload-forbidden-focus-390.png) |
| 无权重载 · 按下未释放 | [桌面](reload-forbidden-pressed-1440.png) | [手机](reload-forbidden-pressed-390.png) |
| 限流重载 · 默认 | [桌面](reload-rate_limited-default-1440.png) | [手机](reload-rate_limited-default-390.png) |
| 限流重载 · 真实悬停 | [桌面](reload-rate_limited-hover-1440.png) | [手机](reload-rate_limited-hover-390.png) |
| 限流重载 · Tab焦点 | [桌面](reload-rate_limited-focus-1440.png) | [手机](reload-rate_limited-focus-390.png) |
| 限流重载 · 按下未释放 | [桌面](reload-rate_limited-pressed-1440.png) | [手机](reload-rate_limited-pressed-390.png) |
| 依赖不可用重载 · 默认 | [桌面](reload-blocked-default-1440.png) | [手机](reload-blocked-default-390.png) |
| 依赖不可用重载 · 真实悬停 | [桌面](reload-blocked-hover-1440.png) | [手机](reload-blocked-hover-390.png) |
| 依赖不可用重载 · Tab焦点 | [桌面](reload-blocked-focus-1440.png) | [手机](reload-blocked-focus-390.png) |
| 依赖不可用重载 · 按下未释放 | [桌面](reload-blocked-pressed-1440.png) | [手机](reload-blocked-pressed-390.png) |
| 导出趋势CSV · 默认 | [桌面](create-trend-default-1440.png) | [手机](create-trend-default-390.png) |
| 导出趋势CSV · 真实悬停 | [桌面](create-trend-hover-1440.png) | [手机](create-trend-hover-390.png) |
| 导出趋势CSV · Tab焦点 | [桌面](create-trend-focus-1440.png) | [手机](create-trend-focus-390.png) |
| 导出趋势CSV · 按下未释放 | [桌面](create-trend-pressed-1440.png) | [手机](create-trend-pressed-390.png) |
| 导出趋势CSV · 在途/禁用 | [桌面](create-trend-busy-1440.png) | [手机](create-trend-busy-390.png) |
| 导出团队CSV · 默认 | [桌面](create-team-default-1440.png) | [手机](create-team-default-390.png) |
| 导出团队CSV · 真实悬停 | [桌面](create-team-hover-1440.png) | [手机](create-team-hover-390.png) |
| 导出团队CSV · Tab焦点 | [桌面](create-team-focus-1440.png) | [手机](create-team-focus-390.png) |
| 导出团队CSV · 按下未释放 | [桌面](create-team-pressed-1440.png) | [手机](create-team-pressed-390.png) |
| 导出团队CSV · 在途/禁用 | [桌面](create-team-busy-1440.png) | [手机](create-team-busy-390.png) |
