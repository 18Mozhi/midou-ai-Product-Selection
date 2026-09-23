# P72 / P73 状态与恢复 · C方向

RECOVERY-C-r1；2026-09-08；具体图稿待审核，不是生产页面或最终验收。

[P72 状态交互稿](index.html) · [P73 独立404稿](not-found.html) · [源与图片证据](evidence.json)

P72共22场景×双端44图，加390×667短视口确认1图；P73共9场景×双端18图，总计63PNG。桌面1440×1000、手机390×844；长页面整页截图，弹窗只截视口。八个组件状态不是八个新路由，五种签认组合属于一个确认弹窗变体，P73无弹窗。

## 设计决定

使用ui-skills-root选择frontend-design。P72蓝色状态目录与白色预览区，状态文字/符号/动作先呈现，确认演示独立分区；手机八态两行排列。P73不套业务壳层，不保留旧轨道、渐变或巨大404装饰；标题、当前路径和恢复入口组成单一阅读区。目检后移除非交互标题自动聚焦时的巨大轮廓，保留程序焦点与链接键盘焦点。

令牌：蓝#254a9c、白#ffffff、正文#202c3d、辅助#58677b、边线#dbe1e9、背景#edf1f6；危险签认为#9b342e。中文系统字体；正文/输入16px，元信息13px，控件44px。无自动漂浮、旋转轨道或闪烁动画。

## P72 动作合同

| 状态      | 主动作                              | 次动作                           |
| --------- | ----------------------------------- | -------------------------------- |
| loading   | 不显示                              | 不显示                           |
| empty     | 首次操作演示提示                    | 筛选演示提示                     |
| error     | 切恢复示例                          | 切空结果示例，不是history.back   |
| forbidden | 记录/home意图                       | 说明申请须由所属业务页发起       |
| expired   | 记录/login意图                      | 无                               |
| blocked   | 切恢复示例                          | 本地影响说明，不判定真实写入结果 |
| recovery  | 切空结果示例                        | 无                               |
| not_found | 记录最近目标；目标即展示页时切empty | 记录/home意图                    |

八态及原始动作来自实际UiStateShowcase和state-contract。query只接受单个合法state；非法/多值显示empty但不重写原URL。选择新态push并保留其他query，同合法态不增加history；前后退/刷新恢复state并清除旧动作提示。confirmed不随普通切态清空，重建或切审稿预设场景才重置。当前路由未用initialState prop，助手只验证其源函数边界，不增加UI入口。

演示默认最近目标/home；“返回当前展示页”预设使用/ui-states?state=blocked，技术展开中可核对。仅此开发审稿允许显示隔离的最近query，P73不显示。

确认必须同时勾选影响范围且trim后短语等于“确认撤销”；打开重置字段、焦点在取消、双向Tab循环、Escape/按钮/遮罩取消并归还焦点。确认只设置本地完成提示，无真实授权撤销、API、审计、异步提交或服务端失败态。

关联编号从源码固定演示值与sanitizeCorrelationId提取；非法值不渲染，128字符长值可换行。图稿将错误默认“不曾写入成功”、404混同角色、受阻影响断言写入和错误次按钮“返回上一页”四处改成更准确的演示表达；**只是待审文案，未改生产共享组件**。

## P73 返回合同

独立页面，仅品牌、主恢复链接及条件性今日行动次链接；没有状态选择器、确认窗、业务导航、搜索或权限申请。请求路径只显示path，超过96字符按原函数取前93加省略号，title保留完整path；不露query/hash。长路径本身仍需使用隔离值，不能称自动敏感脱敏。

九组案例：无记忆、合法任务目标、/home带query、已注销目标、外部地址、协议相对地址、存储读取异常、长路径、生产目录中的/ui-states不可达。实际导航记忆函数在惰性存储适配器内运行，再以实际Vue Router内存解析器和生产过滤的route-catalog求目标。已注销/内部/非法值回/home；/home?section=review保留完整目标但不重复次链接。没有执行会话守卫，不证明六角色可访问目标。

原型点击只记录导航意图，不离开本页；这不等于真实RouterLink执行，也不证明生产HTTP404。P72开发和P73公开恢复必须分开上线策略；本批没有构建、上传或部署内部页面。

## 验证与使用

P72顶部选择预设或手动操作八态；P73案例可用not-found.html?case=recent、case=long等链接参数选择。`node scripts/verify-ui-phase2-recovery-c.mjs`检查源码、数据、图片哈希与交互；加`--capture`重建本目录63PNG及evidence，不覆盖旧稿。

实施状态更新：P72 C 构图已按用户授权接入开发专用 Vue 组件并部署，见[实施记录](../../P72-PAGE-COMPOSITION-IMPLEMENTATION.md)。此处原始“本批无Vue/未部署”是设计原型完成时的历史边界，不再描述当前 P72；P73 的公开恢复仍是独立页面实施范围。

源助手执行实际八态动作/query、canConfirm、sanitizeCorrelationId、导航存储与404计算函数；生产route-catalog经原表达式过滤，实际解析/ui-states为fallback。App DEV条件/afterEach不记404是静态证据，不代替实际发布包与线上访问。

浏览器覆盖：双端31场景、63图，八态所有可见动作、query非法/多值/同态/history/刷新、签认五组合/trim/重置/双向焦点/遮罩、标识过滤、404九目标/路径/焦点/链接意图。额外320/768/780/781/1024断点和390×667确认；无横溢出、重复ID、控制台错误、HTTP或存储写入。浏览器finally关闭，不启动服务。

尚未验收：三主题两密度、200%原生缩放、真实读屏/软键盘、所有共享确认调用方/叠加、六角色真实恢复、跨标签记忆、当前生产HTTP与内部bundle剥离。ST05/ST06/NF03/NF04、用户审稿与全73页实现/部署门仍待办。本批无Vue/API/DB/权限/依赖/.env/OpenAPI变更，重启不适用。PNG和脚本为永久交付，无临时产物。

## 图册

| 页面与场景          | 桌面                                      | 手机                                    |
| ------------------- | ----------------------------------------- | --------------------------------------- |
| P72 加载            | [1440](1440-p72-loading.png)              | [390](390-p72-loading.png)              |
| P72 空结果          | [1440](1440-p72-empty.png)                | [390](390-p72-empty.png)                |
| P72 错误            | [1440](1440-p72-error.png)                | [390](390-p72-error.png)                |
| P72 无权限          | [1440](1440-p72-forbidden.png)            | [390](390-p72-forbidden.png)            |
| P72 登录失效        | [1440](1440-p72-expired.png)              | [390](390-p72-expired.png)              |
| P72 受阻            | [1440](1440-p72-blocked.png)              | [390](390-p72-blocked.png)              |
| P72 恢复            | [1440](1440-p72-recovery.png)             | [390](390-p72-recovery.png)             |
| P72 404示例         | [1440](1440-p72-not_found.png)            | [390](390-p72-not_found.png)            |
| P72 首次操作提示    | [1440](1440-p72-first-action.png)         | [390](390-p72-first-action.png)         |
| P72 筛选提示        | [1440](1440-p72-filter-action.png)        | [390](390-p72-filter-action.png)        |
| P72 重试提示        | [1440](1440-p72-retry-action.png)         | [390](390-p72-retry-action.png)         |
| P72 权限申请说明    | [1440](1440-p72-permission-action.png)    | [390](390-p72-permission-action.png)    |
| P72 影响说明        | [1440](1440-p72-impact-action.png)        | [390](390-p72-impact-action.png)        |
| P72 确认未签认      | [1440](1440-p72-confirm-empty.png)        | [390](390-p72-confirm-empty.png)        |
| P72 确认仅勾选      | [1440](1440-p72-confirm-check.png)        | [390](390-p72-confirm-check.png)        |
| P72 确认仅短语      | [1440](1440-p72-confirm-phrase.png)       | [390](390-p72-confirm-phrase.png)       |
| P72 确认错误短语    | [1440](1440-p72-confirm-wrong.png)        | [390](390-p72-confirm-wrong.png)        |
| P72 确认可提交      | [1440](1440-p72-confirm-ready.png)        | [390](390-p72-confirm-ready.png)        |
| P72 本地确认完成    | [1440](1440-p72-confirmed.png)            | [390](390-p72-confirmed.png)            |
| P72 非法标识        | [1440](1440-p72-invalid-ids.png)          | [390](390-p72-invalid-ids.png)          |
| P72 长标识          | [1440](1440-p72-long-ids.png)             | [390](390-p72-long-ids.png)             |
| P72 返回当前展示页  | [1440](1440-p72-self-return.png)          | [390](390-p72-self-return.png)          |
| P73 无最近目标      | [1440](1440-p73-home.png)                 | [390](390-p73-home.png)                 |
| P73 合法最近目标    | [1440](1440-p73-recent.png)               | [390](390-p73-recent.png)               |
| P73 今日行动带query | [1440](1440-p73-home-query.png)           | [390](390-p73-home-query.png)           |
| P73 已注销目标      | [1440](1440-p73-retired.png)              | [390](390-p73-retired.png)              |
| P73 外部值          | [1440](1440-p73-external.png)             | [390](390-p73-external.png)             |
| P73 协议相对值      | [1440](1440-p73-protocol.png)             | [390](390-p73-protocol.png)             |
| P73 存储读取异常    | [1440](1440-p73-storage-error.png)        | [390](390-p73-storage-error.png)        |
| P73 长路径          | [1440](1440-p73-long.png)                 | [390](390-p73-long.png)                 |
| P73 内部目标不可达  | [1440](1440-p73-internal-unavailable.png) | [390](390-p73-internal-unavailable.png) |

[390×667 短视口确认](390-p72-confirm-short-667.png)
