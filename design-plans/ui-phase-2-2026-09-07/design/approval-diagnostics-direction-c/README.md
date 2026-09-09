# P25 页级诊断详情 · APPROVAL-DIAGNOSTICS-C-r1

具体设计待审核，不等于P25整体获准或真实Vue已实现。[状态图册](gallery.html) · [交互稿](index.html) · [机器证据](evidence.json) · [P25清单](../../action-reviews/P25.json)

新增12张永久图：原生summary默认、悬停、键盘焦点、真实鼠标按下、展开内容、无编号回退，各1440/390两端。AN-TECH-REQUEST四个代表槽明确绑定，不使用资源/节点技术详情的图片顶替。没有新增复制、trace编号、禁用、忙碌或业务按钮。frontend-design技能用于蓝色提示面、主提示/辅助编号层级及键盘轮廓；截图保留页面上下文。

## 真实依据与限制

- 冲突提示和编号来自已有UI2-AN04测试的409响应：`刷新审批详情后再判断。` / `ui2-an-conflict`。不拿成功夹具编号冒充失败请求；这是测试数据审稿，不是生产请求。
- 永久数据检查器从TypeScript AST提取该响应及当前ApprovalWorkspace的api/closeDetail函数，隔离执行失败→关闭。错误实例的解析边界用桩，不宣称HTTP解析器、实际Vue或服务已验。页面仍ready，关闭详情后notice/requestId保留，与此页面场景一致。
- 无编号使用真实函数遇到普通Error时的回退：`稍后重试。`、空requestId；这是隔离错误边界，不编造服务响应。提示保留，技术入口不渲染，不显示假编号。
- 源共享requestId会被后到成功响应覆盖，原notice不会同步清除；检查器保留此问题证据，本轮未修。展开区称“页面保存的请求编号”，明确不能代表独立弹窗归属；不宣称提示与编号始终准确配对。
- 选择其他场景会移除本诊断节点；这是离线审稿切换清理，不证明实际页面/并发读取安全。本包复用原94图底稿，不叠加或重新验收其他表单和导航包。

## 状态适用性复核

另有10组、20个disabled/busy槽按既有校验器登记为`not-applicable-source-unrepresented`，不计图像完成或用户批准：模板入口、发起入口、页级技术详情、读取恢复、详情提示关闭、资源技术详情、草稿发布入口、队列、筛选、队列行打开。逐组完整源位置、属性、handler边界与hash均在P25清单。

这些源控件没有disabled/aria-disabled/aria-busy/busy/loading/inert或动态v-bind。权限不渲染、父区加载替换、选中状态及函数读取，不等于按钮禁用/忙碌。未来仍可提出等待设计，本分类不禁止优化，也不证明在途归属安全。

当前代表槽：100有图映射、20源码无该状态、24待核对；动作数和批准数不增加。剩余24为：两组字段折叠12（新布局直接展示替代，待审、不恢复旧折叠）；四组含原生dialog事件的关闭8（既有保守校验不支持该组合，不绕过）；三个写入disabled3；分页busy1（已有disabled属性，不能用无状态分类排除）。全部变体、主题/密度、真实Vue和服务另行验收，不能把代表槽清零当作全页完成。

## 使用与验证

打开交互稿，选择“查看冲突提示”或“查看无编号回退”；技术详情可用鼠标、Enter、空格展开/收起。顶部场景工具不是产品功能，无新配置或运行参数。

```powershell
node scripts/verify-ui-phase2-approval-diagnostics-c.mjs --smoke
node scripts/verify-ui-phase2-approval-diagnostics-c.mjs --capture
node scripts/verify-ui-phase2-approval-diagnostics-c.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

smoke不写文件；capture写本目录12PNG、图册和证据；无参数复验来源/图片hash及完整交互。检查两端44px/16px、视口/中心命中、真实焦点/按下、释放不误展开、精确编号/提示、键盘切换与焦点保留、无编号入口隐藏、场景清理、事实不改/零HTTP/空存储/控制台零错误。浏览器finally关闭。旧包图和源码不改，不重复测试不受影响的旧包。

本目录全部为永久审核交付，无新临时文件/日志/服务。生产Vue/CSS、API/OpenAPI、数据库/env/配置、权限、后端/Worker/Python、依赖及宝塔未改；无需重启，未部署。历史拒绝清理的三路径保留，见[PROGRESS](../../PROGRESS.md)。全站重构、具体审核和部署签收继续进行。
