# P35 筛选字段与组合 · C 方向 r1

状态：独立设计提案，全部字段组合待审。本批不扩大手机导出详情、尚未生成或0行的既有局部批准，也不把待答的正在生成/等待重试默认为通过。

## 本批交付

- [可操作原型](design/org-data-fields/index.html)：复用未修改的 org-data-direction-c 渲染器、数据和算法；新适配层仅组织字段、帮助文字、标签关联及底部重置区。
- [140张双端图片图册](../../output/playwright/p35-fields-review/index.html)：1440px、390px各70张。每端62张字段图、8张组合图；组合只截取筛选区，不是整页验收。
- [证据清单](../../output/playwright/p35-fields-review/evidence.json)：源文件与PNG哈希、完整结果ID序列、键盘/重置检查和旧图保留指纹。

## 八字段及真实来源

来源为实际 OrganizationDataPanel.vue 的八个 v-model。选项文字和值与模板逐项比较；工作区选项按实际 computed，从已有导出记录名称去重排序，当前夹具是“全部”加两个名称，不虚构完整组织目录。

| 视图   | 实际绑定        | 新稿帮助说明                                    |
| ------ | --------------- | ----------------------------------------------- |
| 工作区 | workspaceQuery  | 只搜索工作区名称，不搜索记录 ID。               |
| 工作区 | workspaceStatus | 按工作区的当前状态筛选。                        |
| 工作区 | workspaceSort   | 合计用于排序，不代表评分或优先级。              |
| 导出   | exportQuery     | 搜索工作区名称、中文类型或状态，不搜索记录 ID。 |
| 导出   | exportWorkspace | 选项来自已加载的导出记录。                      |
| 导出   | exportType      | 按机会、热点或团队报表筛选。                    |
| 导出   | exportStatus    | 按已返回的生成状态筛选。                        |
| 导出   | exportSort      | 仅调整已加载记录的排列顺序。                    |

字段默认/悬停/键盘焦点、六个下拉的全部已选项均出图；两个搜索框另含有值、空格、220字、无匹配、记录ID不匹配。两个视图各有默认、组合筛选、无结果、重置后的组合图。

桌面三列、手机单列；14px字段名、16px输入、13px帮助、至少44px热区、蓝色3px键盘焦点。重置位于独立底部区域，说明只重置当前视图并返回第1页。帮助通过 aria-describedby 关联，字段名独立 aria-labelledby，避免帮助文字混入名称。适配层移动节点后恢复已有焦点和选区；连续输入、Home插入、Tab顺序及重置焦点有回归检查。

## 不改变的合同

无新增字段、必填、maxlength、错误、禁用或忙碌规则。实际输入可保留220字，初次URL读取仍由已有函数截取200字；本批不改该差异，不声称完整链接往返/历史恢复已验证。所有过滤仅处理已加载数据，原12工作区、23导出及时间/计数差异保留。

原94设计PNG、192控件PNG、24实际VuePNG以及三个证据清单全部字节保留。新图不进入既有包的整页批准统计。未改生产Vue/CSS、父级读取、API/OpenAPI、数据库、权限、环境或依赖；无迁移、部署、重启。后端/Python/插件不存在本批生产者消费者变更，不需要同步其运行合同。

## 验证与使用

在项目根目录运行，复用既有依赖：

```powershell
node scripts/verify-ui-phase2-org-data-fields.mjs --smoke
node scripts/verify-ui-phase2-org-data-fields.mjs --capture
node scripts/verify-ui-phase2-org-data-fields.mjs
node --test tests/unit/ui-phase2-org-data-fields.test.mjs tests/unit/ui-phase2-org-data-controls.test.mjs tests/unit/ui-phase2-org-data-export-detail.test.mjs
```

最小验证16状态检查/4流程；完整140状态检查/8流程/140PNG。每个状态的完整过滤排序ID与当前子组件原始 computed 在隔离脚本中的执行结果比较，而非只核对数量。原生输入、悬停、焦点、选项选择、分页后过滤和重置均通过浏览器执行。

这不是挂载Vue、真实HTTP/SQL/RBAC、父级生命周期或生产证据。系统原生下拉弹层、多主题/密度、完整路由历史、缩放及整页仍待验；图片显示关闭的下拉及选中值，不模拟系统弹层。全73页改造及上线仍未完成。

双击可操作原型或图册即可审阅，无服务端口。所有截图为请求的永久交付物，不是临时测试图；浏览器在finally关闭，未创建测试服务、临时夹具、下载或日志。生产代码不变，本批不重复构建前端。

收尾复验：无参数140检查/8流程通过，13项P35定向单测及全部ui-phase2单测通过；153文档/73路由、运行文档一致性、格式与diff检查通过。已目检手机导出五字段和桌面工作区三字段组合。最终进程检查无本批验证器残留；142个输出文件（140PNG、图册和清单）为永久交付。未生成需要删除的临时文件。手机导出筛选组合已单独询问，回答前保持待审。
