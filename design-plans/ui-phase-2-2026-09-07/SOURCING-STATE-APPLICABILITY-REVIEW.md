# P21 控件状态适用性核对

本批核对上一轮留下的20个槽位：10个局部／读取动作各自的disabled与busy。结论是当前源控件没有这两种呈现，而非20张缺图，更不是20项已验收。31个路由动作、7个装配关联、54处局部源码位置均保留；原有150个代表状态图映射不变，20项单列源码不适用，未分类代表槽为0。完整字段、所有变体、主题／密度、真实生命周期、具体设计批准与全站实施仍未完成。

## 逐项依据与现有图

权限不满足导致不渲染、函数拒绝第六次勾选、父面板加载替换按钮，都不能画成此按钮的禁用或忙碌。表中链接仅为已生成的键盘焦点代表图；没有新增或修改图片。

| 源动作 | disabled / busy不适用依据 | 既有焦点代表图 |
| --- | --- | --- |
| SC-S-OPEN 发起找货 | 入口按canManage显示，不绑定disabled/aria-busy；openSearch只有权限检查与局部展开。 | [1440px](design/sourcing-direction-c/1440-control-main-search-open-focus.png) / [390px](design/sourcing-direction-c/390-control-main-search-open-focus.png) |
| SC-STATE 整页状态主次操作 | UiStatePanel主次按钮无禁用/忙碌绑定；loading时整个footer不渲染，父section忙碌不是按钮忙碌。空目录按管理者/只读选择展开、清空或load。 | [1440px](design/sourcing-direction-c/1440-control-recovery-error-primary-focus.png) / [390px](design/sourcing-direction-c/390-control-recovery-error-primary-focus.png) |
| SC-SEARCH-RECOVERY 空筛选恢复 | 空筛选UiStatePanel主次按钮无禁用/忙碌绑定；主操作清query，次操作按角色展开或load，重读后进入无footer的loading。 | [1440px](design/sourcing-direction-c/1440-control-recovery-search-primary-focus.png) / [390px](design/sourcing-direction-c/390-control-recovery-search-primary-focus.png) |
| SC-DETAIL 选择找货记录 | 记录按钮有选中class但无disabled/aria-busy；detail发GET，不设置按钮busy。请求未结束的视觉缺口不能伪称已实现忙碌。 | [1440px](design/sourcing-direction-c/1440-control-main-record-current-focus.png) / [390px](design/sourcing-direction-c/390-control-main-record-current-focus.png) |
| SC-DELETE-OPEN 打开删除确认 | 入口按selected/canManage显示，只赋deleting=selected；实际删除提交另有六态，不能把提交busy套到打开入口。 | [1440px](design/sourcing-direction-c/1440-control-main-delete-open-focus.png) / [390px](design/sourcing-direction-c/390-control-main-delete-open-focus.png) |
| SC-SELECT 选择报价对比 | checkbox有checked无disabled/aria-busy；choose最多保留5个ID并回写checked，第六次拒绝选择不是按钮禁用。 | [1440px](design/sourcing-direction-c/1440-control-main-select-focus.png) / [390px](design/sourcing-direction-c/390-control-main-select-focus.png) |
| SC-QUOTE-OPEN 打开报价确认 | 按canManage且无quote显示，只预填并打开；确认报价提交是另一个动作，其busy不等于此入口禁用。 | [1440px](design/sourcing-direction-c/1440-control-main-quote-open-focus.png) / [390px](design/sourcing-direction-c/390-control-main-quote-open-focus.png) |
| SC-PURCHASE-OPEN 打开采购任务 | 按canManage且有quote显示；openPurchase的quote守卫及MOQ预填不是按钮禁用，采购提交另行审核。 | [1440px](design/sourcing-direction-c/1440-control-main-purchase-open-focus.png) / [390px](design/sourcing-direction-c/390-control-main-purchase-open-focus.png) |
| SC-COST-REVIEW-OPEN 通过/驳回内联表单 | 两个入口由item.can_review控制可见，均无disabled/aria-busy；beginReview清原因并切换结论，不立即审批。 | [1440px](design/sourcing-direction-c/1440-control-cost-open-approved-focus.png) / [390px](design/sourcing-direction-c/390-control-cost-open-approved-focus.png) |
| SC-COST-REVIEW-CANCEL 取消内联复核 | 只按review.id显示并清空该ID，无disabled/aria-busy；取消不撤销在途请求。 | [1440px](design/sourcing-direction-c/1440-control-cost-cancel-approved-focus.png) / [390px](design/sourcing-direction-c/390-control-cost-cancel-approved-focus.png) |

读请求仍可能需要更完整的结果归属／迟到保护；本次无源呈现分类不关闭SC-G01–08，也不要求原型或生产保留缺陷。若用户审核提出新增忙碌设计，应另登记提案及对应图，不能把本记录当作禁止优化的业务规则。

## 可复验记录

[action-reviews/P21.json](action-reviews/P21.json)各动作新增sourceStateApplicability：

- scope固定为current-source-presentation-only-not-runtime-or-approval，仅陈述当前源码控件呈现。
- states只能是disabled／busy；只允许read或local，不能用于排除write、默认、悬停、焦点或按下。
- sourceCandidateIds必须覆盖动作全部源位置；renderedControlIds必须完整覆盖实际按钮。UiStatePanel调用必须同时核对其两个子按钮，不能只看父调用没有disabled。
- sourceHashes逐一绑定调用方与实际子组件；不得漏项、增加无关来源或沿用旧指纹。控件若新增disabled、aria-disabled、aria-busy、busy、loading、inert或动态v-bind，校验失败，重新审核适用性。
- reason记录控件呈现，handlerBoundary记录执行逻辑；源码按条件隐藏、父section的aria-busy和函数上限不等同于按钮状态。
- 汇总sourceInapplicableVisualSlots与unmappedVisualSlots分开；不计为图像证据、用户批准或业务验收，语义动作分母不变。其他页不自动套用本批结论。

运行node --test tests/unit/ui-phase2-action-coverage.test.mjs定向验证；node scripts/audit-ui-phase2-action-coverage.mjs只读核对当前清单，--write仅生成动作报告与JSON。图稿／来源整体校验仍由node scripts/audit-ui-phase2-design-delivery.mjs负责，不用新分类放宽旧门禁。

## 交付边界

仅修改审核校验器、永久回归测试、P21清单与相关文档；P21原型和PNG不变。竞品图包引用了公共校验器，来源检查发现本次指纹变化后，需由既有competitor生成器完整复验并重新生成证据，不手改哈希或放宽门禁。生产Vue、两包原型HTML/CSS/JS、API/OpenAPI、数据库、env、依赖、权限和宝塔未改；无部署／重启要求。完整验证和清理结果见[PROGRESS](PROGRESS.md)，未重复不受影响的P21浏览器截图测试。

现有全图入口：[P21成本与复核](SOURCING-COST-CONTROL-REVIEW.md)、[P21导航与恢复](SOURCING-NAVIGATION-RECOVERY-REVIEW.md)、[P21主操作](SOURCING-MAIN-STATE-REVIEW.md)。P16仅整体布局获准，不能扩展为P21或全站批准。
