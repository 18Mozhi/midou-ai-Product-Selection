# P44 历史控件阶段与当前累计实施证据分层

2026-09-12。本轮承接后续状态与整合验证，不改已批准的 P47 两种手机空态，
不产生新的视觉批准，也不将历史完整性当作当前页面或生产验收。

## 原因与依据

首次定向9项中2过、7失败。旧控件测试对所有来源套历史结果逆向，导致当前原始来源
与历史来源混用；它还拿累计加入角色资料样式的当前图，比较原控件阶段“不改资料区”
的断言。目录测试则仍把新增的第一条@import当成@media。当前证据真实新增样式依赖，
原测试数量36/37已失效。不是通过重写旧哈希、删除像素断言或修改界面来放行。

只读核对Git后，以下原始捕获全部来源均匹配其原manifest：

| 阶段 | 固定提交 | 来源 | PNG |
| --- | --- | ---: | ---: |
| 控件前 | 67cb00f350037bb7eeee7c6dad76a5334397cdec | 35 | 16 |
| 控件刚实施 | 同上 | 36 | 16 |
| 目录前 | 1b8f9ff09d263a3a8b59ad0455144df000e8c4d3 | 36 | 30 |

新增仅测试使用的`ui-phase2-admin-historical-capture.mjs`：固定上述提交与三份完整manifest
SHA，只读Git对象，不checkout、不写原图、不转换当前源码。来源必须列入对应清单，
历史PNG逐张核对原哈希，未知阶段/文件拒绝；独立对象与Buffer防止污染缓存。
旧基线父组件的既有精确逆向继续保留。历史控件前后样式、焦点几何、默认像素和
仅追加CSS合同仍逐项执行，但明确只证明该历史阶段。

当前目录和控件各40份来源直接核对工作区原文，当前30/16图逐张校验；原请求数、
GET-only、各断点/路由/内容/弹窗/溢出相关既有断言保留。当前控件比原实施包增加目录CSS、
P44颜色、共享浮层颜色和导入追踪助手，目录比原当前包增加后三者；测试显式锁定
新增清单并禁止旧来源丢失。目录CSS分别核对唯一调色板import与唯一手机media。
原baseline文件与原图均未改，当前图证和用户批准也未改。

## 验证

- 最小验证：两原测试文件9项/2过/7失败，退出1；修改后四文件18项全部通过。
- 格式化后完整251文件1447项：1284过/163失败，0取消/跳过，320978.3916ms，退出1。
- 与上一轮完整1444项/1274过/170失败对照，减少7项、无新增。完整失败名称/位置及
  对照保存在[P44-HISTORICAL-GATE-UNIT-RESULT.json](P44-HISTORICAL-GATE-UNIT-RESULT.json)；
  多行错误正文未保留，不宣称这是完整错误堆栈。不推断剩余163项全部属于历史问题。
- 新历史工具仅被三个测试引用，不进入apps/packages或浏览器驱动；当前原始图证测试独立。
- 原产品Vue/CSS、图证、依赖与浏览器驱动均未改，不重复截图、构建或浏览器交互回归。
- 收尾文档153文件/73路由/60受保护/6角色、运行说明一致性、相关格式与diff检查通过；
  审核索引check仍核对406图，保留3个历史包各2处来源差异，没有将旧图重新标为当前。

## 使用、范围与收尾

```text
node --test tests/unit/ui-phase2-admin-historical-capture.test.mjs tests/unit/ui-phase2-admin-mobile-controls-implementation.test.mjs tests/unit/ui-phase2-admin-mobile-directory-implementation.test.mjs tests/unit/ui-current-palette-evidence.test.mjs
node scripts/build-ui-phase2-recent-review-materials.mjs --check
```

历史校验需要本地保留上述Git提交对象；缺少时失败，不下载替代版本、不更换预期SHA。
继续从review.html的P44补充实施图区审查当前图，历史通过不能覆盖未答的视觉审核。
本轮不改API/OpenAPI、权限、数据库、环境变量、配置或依赖，无部署与服务重启要求。
全库仍失败，不提交部署，commit hash不适用；全73页目标及真实验收仍未完成。

未创建新临时脚本、截图、日志、浏览器或开发服务。全库进程39508/10468已退出，
自动临时目录`C:/Users/23136/AppData/Local/Temp/scoutops-code-style-s9FLJS`已确认不存在。
新增解析器、永久测试和本报告/结果JSON为交付物，保留。既有用户改动未暂存。
历史策略阻止清理的目录仍保留，不绕过重试：
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`；
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。
