# P28 · 创建导出、下载提示与手动刷新归属

2026-09-10，main/acc0b24f起点。承接已提交的读取修复；本轮补真实操作回执，不表示完整C页面、具体按钮批准或全站目标完成。

## 依据与改动

AGENTS → Feature Map reportsExports → M05-06蓝图 → ReportCenter.vue / api-client / report-routes。原createExport和refresh只有模板禁用，没有函数级早退；创建成功/失败回执不检查后来视图，成功后还会启动一次读取。download只防全局重复读取，其迟到错误可以覆盖新详情诊断；临时object URL在anchor创建或点击异常时没有释放。

新增独立viewSequence及operationViewOwner：完整URL变化、立即关闭详情和销毁会使操作反馈失效，普通详情请求代次变化不会。创建入口在disposed/busy时早退，现有CSV body、202入队解释与幂等客户端不变；只有原视图仍有效才显示成功并启动刷新。已经启动的读取继续遵守前批load的类型/路径/批次归属，不把有效报告读取随详情变化全部丢弃而造成loading停住，也不声称不同有效读写的全局诊断优先级已解决。

下载入口增加销毁保护，保持原同页一次下载规则、GET关联ID/Accept、文件名及实际字节流程。切换页面或销毁实例不会撤销已经发起的下载；只抑制旧视图的失败提示，并避免销毁后继续修改busy标志。object URL用try/finally释放，包含anchor创建/点击失败的情况。手动刷新沿现有refreshing防重入，结束时仅对存活实例清标志；未改变轮询频率和后台加载规则。

模板/CSS、API/OpenAPI字段/地址、身份/权限、SQL、Worker/Python、数据结构、依赖与env未改。没有新增运行设置，也没有新增后台服务。

## 验证

- `tests/unit/ui-phase2-report-operation-ownership.test.mjs`：24项，真实setup/ref/computed和同步watch配受控传输。覆盖旧创建成功/失败、立即关闭且路由未完成、URL往返、销毁、重复调用与恢复、三类精确CSV body、普通详情轮询、已启动后续读取、下载错误归属、继续完成字节/文件名/URL释放及刷新防重入。首轮防重入测试错误地等待未释放的重复promise，修正测试调度后才形成有效复现，不将测试取消计为产品失败。
- `scripts/verify-ui-phase2-report-operation-ownership.mjs`：12场景×1440/390=24，原Vue、真实内存router、真实按钮和原生详情窗，后端请求全部拦截。14个创建POST精确body与幂等头断言，4个浏览器CSV下载校验字节和文件名后删除；当前/换详情的下载完成、旧错误、销毁、重复刷新均验证。不是生产文件、真实数据库或Worker执行证明。
- 前批读取回归、90+208图的源重验、前端构建及全量门禁见PROGRESS。图稿数量/视觉/审核状态不因本次修复增加。

## 尚待用户选择与后续

不同记录可同时重新生成，但自动打开结果的先后规则未明确。已询问用户：只打开最后发起的B（手动切换/关闭则不跳转）、先完成先打开且不覆盖、或始终留在当前页。未收到选择前regenerate函数保持不变，不能擅自改成全局串行或选一种完成顺序。

跨工作区尚存活缓存、不同操作共享notice/requestId的完整仲裁、重建并发/旧finally以及具体C视觉实现、审核与生产验收仍待。P27新建成功后新增草稿政策也保持原待决状态；不以P16布局批准代替其他批准。

## 使用与发布

最小验证：`node --test tests/unit/ui-phase2-report-operation-ownership.test.mjs`。确认5175未占用后运行`node scripts/verify-ui-phase2-report-operation-ownership.mjs`；脚本finally关闭浏览器与临时Vite，每份CSV路径输出后使用下载对象删除，不保留截图或测试日志。原永久图册仍可审核。

没有新的用户调节参数；正常使用仍是导出CSV、刷新、下载及打开/关闭详情。本批未部署，未来使用既有`python scripts/deploy-baota.py`与宝塔受管发布/重启流程，不新增独立进程。测试临时文件和服务的最终清理、完整验证及提交结果见本批交接。
