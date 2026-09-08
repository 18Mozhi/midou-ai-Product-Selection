# P18 十分区连续稿 · C方向

DETAIL-ASSEMBLY-C-r1；2026-09-08；待审核，非生产页面。[打开交互稿](index.html)；24场景，1440×1000与390×844双端，共48张永久PNG。长表单为完整页面，弹窗为视口截图。

## 设计与统一范围

单一HTML工作台、同一个机会，不是四批iframe。蓝色目录＋白色工作面，固定机会身份，手机折叠目录；十区共用草稿和操作状态。ui-skills-root选择frontend-design，先确定令牌和层级，再截图目检；为原因帮助文字增加间距，键盘实测后补焦点循环。

令牌：目录蓝#254a9c、白#ffffff、正文#202c3d、辅助#58677b、边线#dbe1e9、背景#edf1f6。中文系统字体，正文/输入16px，元信息13px，热区44px。不加商品插画、假曲线或装饰指标卡。

事实只取自 `tests/e2e/m04-07-ai-analysis.spec.ts` 的机会701、AI结果702/请求705及同机会profit-analysis。版本1，历史更新时间2026-08-08；非实时数据。能力从同一导航夹具提取，仅task:read、opportunity:read、opportunity:decide。

- 证据汇总1、来源1、明细数组0：保留差异，不造原文或宣称无证据。
- 利润明确无运行、生效输入0项，不算ROI。没有cost:confirm，不提供成本提交/复核/利润排队。
- 没有竞品和供应读取能力，不把不可读当0条。
- lineage、operating_feedback未提供：保持未知。decisions明确空数组，可显示无记录。
- 五门与选择阶段未提供，采纳不可用；观察/驳回保留现有提前人工处理入口。
- 表单是本次内存草稿，默认0不是经营事实。测试ERP输入只用于请求体对照，不变成701的经营记录。固定提交时钟2026-08-23T03:00Z仅用于确定性验证。

本批是同一机会的连续性首轮，不是完整有数据/全权限P18。旧稿仍独立保留，不能相加称一条生产链：

| 旧稿 | 详细范围 |
| --- | --- |
| [核心102图](../opportunity-detail-direction-c/README.md) | 五门、证据20/40/41、决定与补数 |
| [利润100图](../profit-direction-c/README.md) | 九字段成本、双人复核、利润快照 |
| [分析82图](../insights-direction-c/README.md) | 评分、竞品快照、供应关联与风险 |
| [辅助复盘102图](../review-direction-c/README.md) | 多AI记录、11类血缘、历史校准 |

## 连续交互

1. 十区query使用replace，不增加历史项；结论移除tab，保留from和其他query，未知tab回结论。返回只记录意图，沿用现有单斜杠判断，不宣称安全路由白名单。
2. 切区焦点到标题、手机目录关闭。复盘收起/切出/返回保留11字段；刷新或换审稿场景重置，不持久化。
3. 四原因弹窗：观察、驳回、AI通过/驳回。人工请求保留原值，AI trim且至少2字，均最多1000字。取消不提交，Tab/Shift+Tab留在弹窗，关闭回可用触发器或标题。
4. 处理中禁重复写、原因只读；可关闭、切区和编辑另一份复盘草稿。迟到结果不抢分区/焦点、不重绘输入；失败可恢复原原因，失败后补写再关闭也保留。
5. 未知结果全页禁重复写；不能用模拟重读解除，只可换审稿场景重新开始。场景重置后的旧回调按代次丢弃。
6. **提交只记录本地准确请求意图，绝不模拟持久化成功、生成业务记录或改写事实。** 失败/未知不是实际API错误码；关窗不代表服务端取消。

## 审核与验证

顶部选择24场景；手动检查“复盘录入→风险→返回复盘”“AI抽检→取消”“原因失败→关闭→恢复原因”。默认只记意图；测试通过本地控制器注入延迟、失败与未知，不发HTTP。

验证：`node scripts/verify-ui-phase2-detail-assembly-c.mjs`。加`--capture`仅重建本目录48PNG和[证据清单](evidence.json)，不覆盖旧图。源助手执行实际setTab/decide并复用AI/复盘源函数VM；源函数成功后重读不等同原型意图提示。

覆盖：源/数据/图哈希、10tab直达/replace/from、24场景双端、48图、字级/触控/横溢出/唯一ID、四原因body/取消/失败重试/焦点、11字段草稿/校验/body、迟到失败不抢焦点、未知锁写、旧代次忽略、不可变事实、零HTTP/存储。浏览器finally关闭，无临时服务。

未覆盖：完整成本/评分等有数据权限链、采纳成功、全部按钮六态、三主题两密度、中间断点/200%缩放、真实软键盘/读屏、跨机会/组织竞争、主站壳层与Vue、API/DB/RBAC/Worker/生产。OP07–OP10、具体稿审核及全73页实现/部署签收仍待办。无.env/OpenAPI变更，无重启要求。

请审核阅读顺序、手机目录、缺失/失败表达与跨区反馈。C只是方向批准，本稿尚未获审。

## 逐场景图册

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 结论 | [1440](1440-overview.png) | [390](390-overview.png) |
| 证据 | [1440](1440-evidence.png) | [390](390-evidence.png) |
| 利润与成本 | [1440](1440-profit.png) | [390](390-profit.png) |
| 风险 | [1440](1440-risk.png) | [390](390-risk.png) |
| 市场 | [1440](1440-market.png) | [390](390-market.png) |
| 竞争 | [1440](1440-competition.png) | [390](390-competition.png) |
| AI辅助 | [1440](1440-ai.png) | [390](390-ai.png) |
| 业务血缘 | [1440](1440-lineage.png) | [390](390-lineage.png) |
| 经营复盘 | [1440](1440-feedback.png) | [390](390-feedback.png) |
| 决策历史 | [1440](1440-decisions.png) | [390](390-decisions.png) |
| 复盘草稿 | [1440](1440-feedback-draft.png) | [390](390-feedback-draft.png) |
| 观察原因 | [1440](1440-observe-dialog.png) | [390](390-observe-dialog.png) |
| 驳回原因 | [1440](1440-reject-dialog.png) | [390](390-reject-dialog.png) |
| AI通过原因 | [1440](1440-approve-dialog.png) | [390](390-approve-dialog.png) |
| AI驳回原因 | [1440](1440-ai-reject-dialog.png) | [390](390-ai-reject-dialog.png) |
| 失败保留原因 | [1440](1440-decision-failure.png) | [390](390-decision-failure.png) |
| 跨区处理中 | [1440](1440-pending-elsewhere.png) | [390](390-pending-elsewhere.png) |
| 跨区失败恢复 | [1440](1440-failure-elsewhere.png) | [390](390-failure-elsewhere.png) |
| 跨区结果未知 | [1440](1440-unknown-elsewhere.png) | [390](390-unknown-elsewhere.png) |
| AI读取失败 | [1440](1440-ai-read-error.png) | [390](390-ai-read-error.png) |
| 详情读取失败 | [1440](1440-main-read-error.png) | [390](390-main-read-error.png) |
| 无权限 | [1440](1440-forbidden.png) | [390](390-forbidden.png) |
| 只读 | [1440](1440-readonly.png) | [390](390-readonly.png) |
| 十分区目录 | [1440](1440-directory-open.png) | [390](390-directory-open.png) |
