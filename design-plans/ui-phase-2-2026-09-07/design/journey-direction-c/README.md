# P16 创建选品 · JOURNEY-C-r1

状态：C 方向已选，本批具体稿待审核。48 场景 × 双端 = 96 张图；零业务弹窗。采纳规则仍待用户确认，本稿不执行或演示采纳成功；因此不宣称P16全分支已完成。独立HTML不是生产Vue。

[交互原型](index.html) · [证据与哈希](evidence.json) · [页面规格](../../page-specs/P16.md) · [真实合同](../../selection-journey-contract-review.md)

## 设计与使用

使用 frontend-design 重组为“输入线索 → 来源处理 → 审阅候选 → 决定记录”四阶段。蓝色阶段目录、白色当前工作区；输入表单与结果页分开，时间轴按需展开，来源链接与候选单选触区分离。手机改为纵向审阅，正文/输入16px、元信息13px、单选真实命中区域44px；不新增业务弹窗。

顶部“审核场景”切换图稿；“推进隔离样例”只是测试控件，模拟下一次GET返回，不属于产品按钮。创建/观察/驳回以350ms内存返回演示；不发送HTTP、不访问真实原文、不启动轮询，也不读取或写入真实localStorage。活动ID只在原型内存中模拟。

## 真实合同、复现与待定项

- 创建仅POST /selection-journeys，body为input_kind/input_value，保留原大小写及空白；后端trim。三类输入仍使用google_news_search，不暗示直接获取ASIN/商品链接价格。永久助手执行真实Vue创建函数及后端输入校验，验证非HTTPS、带账号或片段链接被拒绝。
- 当前route/API能力不完全对齐：创建task:create、读取opportunity:read、决定opportunity:decide；UI不伪造独立capability投影，通过真实错误状态说明权限。未修route/权限。
- results为空才回退first_result；单条自动选择，多条需主动选择。任务available_result_count与最多20条结果列表分别呈现；20条/28总数和缺标题/长文为明确合成样例，不代表真实查询。
- accepted/running即使有证据也不开放决定；blocked但task仍running时，后端会409 selection_result_pending。提案禁用该决定并说明原因，不改变后端。空结果、明确受阻和任务失败不互相替代，不补造评分或ROI。时长仅取服务端elapsed_ms向上取整；无递增动画或180秒营销承诺。
- 观察/驳回的三字段body与真实decide函数深比较，selected_raw_evidence_id为null，没有expected_version。两种决定不会生成机会，但可能返回验证任务；只按返回ID展示任务链接。
- J07采纳冲突已再次核实并向用户提出选择：旅程repository直接写adopted，P18要求五质量门。图稿显示待定提示且不模拟成功，不等于生产已禁用，也不偷换为“只生成pending”。真实adopt请求字段只在隔离助手中核对，不算该分支实现或获审。
- J09两缺口在实际函数中复现：decide成功仍保留原state=error；reset仍保留旧decision.action/reason。本稿成功清错、开始下一次清空决定草稿是待审改进，Vue未修。开始下一次不取消采集、不重放POST，输入类型保留。
- 创建/决定失败保留输入，错误不声称服务器一定未写入。恢复失败重试原ID，恢复中不允许创建或保存；非法/404活动ID图为隔离展示，不证明跨租户或真实storage行为。N04读取生命周期已有测试不在本稿重演为已验收。

## 全图索引

常规工作面均为全页截图，48主场景各有1440和390宽图；长候选列表包含完整20项，没有用首屏代替全文。

| 场景 | 1440 × 1000 | 390 × 844 |
| --- | --- | --- |
| 关键词输入 | [桌面](1440-keyword.png) | [手机](390-keyword.png) |
| ASIN 输入 | [桌面](1440-asin.png) | [手机](390-asin.png) |
| 商品链接输入 | [桌面](1440-url.png) | [手机](390-url.png) |
| 关键词已填 | [桌面](1440-keyword-edited.png) | [手机](390-keyword-edited.png) |
| ASIN 已填 | [桌面](1440-asin-edited.png) | [手机](390-asin-edited.png) |
| 链接已填 | [桌面](1440-url-edited.png) | [手机](390-url-edited.png) |
| 创建中 | [桌面](1440-create-busy.png) | [手机](390-create-busy.png) |
| 创建未获确认 | [桌面](1440-create-failed.png) | [手机](390-create-failed.png) |
| 非 HTTPS 返回拒绝 | [桌面](1440-url-rejected.png) | [手机](390-url-rejected.png) |
| 正在恢复 | [桌面](1440-restoring.png) | [手机](390-restoring.png) |
| 恢复失败 | [桌面](1440-restore-failed.png) | [手机](390-restore-failed.png) |
| 恢复登录过期 | [桌面](1440-restore-expired.png) | [手机](390-restore-expired.png) |
| 恢复无权访问 | [桌面](1440-restore-forbidden.png) | [手机](390-restore-forbidden.png) |
| 恢复受阻 | [桌面](1440-restore-blocked.png) | [手机](390-restore-blocked.png) |
| 非法活动 ID 已清理 | [桌面](1440-invalid-id.png) | [手机](390-invalid-id.png) |
| 活动 ID 返回 404 | [桌面](1440-missing-id.png) | [手机](390-missing-id.png) |
| 任务已接收 | [桌面](1440-accepted.png) | [手机](390-accepted.png) |
| 来源处理中 | [桌面](1440-running.png) | [手机](390-running.png) |
| 处理中已有证据 | [桌面](1440-running-evidence.png) | [手机](390-running-evidence.png) |
| 进度读取中 | [桌面](1440-read-busy.png) | [手机](390-read-busy.png) |
| 进度读取失败 | [桌面](1440-read-failed.png) | [手机](390-read-failed.png) |
| 读取登录过期 | [桌面](1440-read-expired.png) | [手机](390-read-expired.png) |
| 读取权限拒绝 | [桌面](1440-read-forbidden.png) | [手机](390-read-forbidden.png) |
| 读取受阻 | [桌面](1440-read-blocked.png) | [手机](390-read-blocked.png) |
| 双候选待选择 | [桌面](1440-results.png) | [手机](390-results.png) |
| 候选已选 | [桌面](1440-selected.png) | [手机](390-selected.png) |
| 选择无主题候选 | [桌面](1440-no-topic.png) | [手机](390-no-topic.png) |
| 单条自动选中 | [桌面](1440-single-result.png) | [手机](390-single-result.png) |
| first_result 兼容回退 | [桌面](1440-first-result.png) | [手机](390-first-result.png) |
| 缺标题与发布者 | [桌面](1440-missing-fields.png) | [手机](390-missing-fields.png) |
| 长标题与原文地址 | [桌面](1440-long-result.png) | [手机](390-long-result.png) |
| 20 条展示与总量区分 | [桌面](1440-twenty-results.png) | [手机](390-twenty-results.png) |
| 完整时间轴 | [桌面](1440-timeline.png) | [手机](390-timeline.png) |
| 真实空结果 | [桌面](1440-empty.png) | [手机](390-empty.png) |
| 来源明确受阻 | [桌面](1440-blocked.png) | [手机](390-blocked.png) |
| 任务失败 | [桌面](1440-failed.png) | [手机](390-failed.png) |
| 旅程超时但任务仍运行 | [桌面](1440-deadline-running.png) | [手机](390-deadline-running.png) |
| 采纳规则待业务确认 | [桌面](1440-adoption-pending.png) | [手机](390-adoption-pending.png) |
| 观察原因已填 | [桌面](1440-observe-edited.png) | [手机](390-observe-edited.png) |
| 观察提交中 | [桌面](1440-observe-busy.png) | [手机](390-observe-busy.png) |
| 观察失败保留 | [桌面](1440-observe-failed.png) | [手机](390-observe-failed.png) |
| 观察决定返回 | [桌面](1440-observe-decided.png) | [手机](390-observe-decided.png) |
| 驳回原因已填 | [桌面](1440-reject-edited.png) | [手机](390-reject-edited.png) |
| 驳回提交中 | [桌面](1440-reject-busy.png) | [手机](390-reject-busy.png) |
| 驳回失败保留 | [桌面](1440-reject-failed.png) | [手机](390-reject-failed.png) |
| 驳回决定返回 | [桌面](1440-reject-decided.png) | [手机](390-reject-decided.png) |
| 决定已存但无关联 ID | [桌面](1440-decided-no-links.png) | [手机](390-decided-no-links.png) |
| 开始下一次的空草稿 | [桌面](1440-next-input.png) | [手机](390-next-input.png) |

## 验证与运行交接

运行 `node scripts/verify-ui-phase2-journey-c.mjs`：默认只读复核当前源/数据/PNG哈希及交互；加 `--capture` 才重拍。本批验证实际源函数的三类创建/三类决定字段（采纳仅字段、不执行成功）、输入校验、单条/多条/first_result、链接不误选、准确空candidate body、失败保留/显式重试、恢复ID、busy与reset。全程HTTP=0、真实浏览器存储=0、dialog=0；浏览器finally关闭。

未改Vue/API/OpenAPI、配置、依赖、权限、数据库、旧图、coverage与审批；无需部署或重启，无本批临时文件或服务遗留，96PNG为永久审核交付。真正2秒轮询、KeepAlive/跨范围/多标签、存储异常、在途写入、Origin/幂等/普通成员权限、实际来源/DB、200%缩放/软键盘/屏幕阅读器、三主题两密度及生产验收仍未覆盖。本稿不能注销J07–J10或全站G0–G5。

下一业务面P18机会详情；P16采纳规则决定、具体图审与Vue实现继续待办，全73页目标不缩减。
