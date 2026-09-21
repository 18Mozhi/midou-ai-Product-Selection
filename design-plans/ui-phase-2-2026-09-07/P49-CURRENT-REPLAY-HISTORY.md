# P49 五组当前重放与历史图证校验

2026-09-13。继续完整C方向实施与状态验证；本轮不改生产SFC，不扩大原待审提案的批准，
不将本地拦截请求、旧图或测试通过当作真实采集/权限/生产验收。

## 当前重放

使用Playwright技能，按仓库约定复用现有驱动/依赖，不安装新CLI。五条既有验证命令均
不带`--capture`：没有覆盖旧图，robustness/lifecycle中仅capture才执行的目录删除分支未运行。

| 当前源码上的运行 | 运行数 | 实际报告检查数 | 新截图 | 已关闭端口 |
| --- | ---: | ---: | ---: | --- |
| 默认布局 | 16 | 240 | 0 | 52653 |
| 读取/访问/保留旧事实 | 24 | 260 | 0 | 52841 |
| 范围/提交/排队/重读失败 | 52 | 636 | 0 | 53050 |
| 三主题/两密度/长内容/组件缩放 | 40 | 699 | 0 | 53510 |
| 缓存返回 | 2基线+2提案 | 驱动只报告运行数，不推算检查数 | 0 | 53866、53889 |

共136次运行；前四组1835检查，生命周期另外报告4次运行，不能把1835写成五组总检查数。
所有驱动保留原场景与断言，实际P49组件和五驱动均与原包来源一致。当前共享壳层/弹窗
等来源变化已由重放重新覆盖，但本轮不形成新的完整来源清单或当前截图。

提交场景的POST只被本地显式白名单路由拦截，校验原body、幂等键及请求次数；没有请求
真实账号/1688/凭证、启停来源、修改权限/数据库或启动采集。其他组GET-only。当前布局、
读取、操作和稳健性仍是实际App中的待审Vue/CSS变体，不是生产实现。生命周期包含未变换
真实App/Router/NavigationShell/KeepAlive基线与提案；基线缓存返回仍不重读，提案才包含
离开失效/返回重读。提交成功与重读失败的双反馈也仍仅在提案，生产缺陷未被本轮修复。

## 原图证校验

首次五文件19项测试14通过、5失败，失败是拿当前共享来源核对旧图SHA。前四包各12处来源
变化，生命周期包31处；没有将它们统一当作无害颜色变化，也没有批量替换预期哈希。

| 原包 | 固定提交 | 原来源数 | 原PNG |
| --- | --- | ---: | ---: |
| page | 5bbd5aaab7c5b32f7974558e7cb766bad67882c8 | 59 | 16 |
| read-states | 4462621e24cd2297f06c94051ef6fe5729e0d233 | 61 | 27 |
| actions | 1579412d1a4d0c59485c6b943f12e90954eaa09b | 63 | 54 |
| robustness | 952e81e0dc9900c90491ca11499253d4a2c06c4d | 65 | 42 |
| lifecycle | 7c92a5d62191399e5a57ce51f798ce82e90f609a | 181 | 4 |

五份完整manifest SHA固定，磁盘清单必须全文等于原版。测试仅在历史来源校验处读对应Git
对象，原143图的哈希/尺寸/文件清单、请求、布局、恢复、主题与基线/提案断言全部保留。
当前模板编译、文案/隐私/权限边界、CSS隔离等测试仍读取当前原文，不通过历史替换。

新增只供测试的`ui-phase2-acceptance-historical-capture.mjs`，用只读Git批量对象读取减少
逐文件进程启动，按字节长度解析中文源码，逐份完整SHA校验，拒绝缺失/截断/额外/篡改对象。
首版批量读取6项失败后查明唯一特殊来源：`packages/config/dist/browser.js`为不入Git的
构建产物。五包当前该文件均与原清单完整SHA相同；仅此明确文件从本地读取并严格验原哈希，
其他缺失对象继续失败，不做泛化fallback，不写构建产物。对应漂移负例、UTF8/CRLF、
批量消息异常、未知阶段/来源与五包完整来源检查纳入永久测试。

修正后22项通过；补构建产物漂移负例并格式化后最终23项全通过（2481.8995ms），0跳过。
新helper不被生产或浏览器驱动引用。本轮完成相关六文件验证及五组浏览器重放，不重复无关
全库、构建或截图。最近全库1451项1296过/155失败仍是前批快照，不减去本轮5项推算结果，
不宣称发布门通过。全73页重构、逐状态/整页审核及真实验收仍继续。

收尾文档153文件/73路由/60受保护/6角色、运行说明、相关格式/diff及审核索引check通过；
旧索引406图与3个历史包的来源差异标记未改。工作区482项变更、暂存为空，未混入提交。

## 使用与收尾

```text
node scripts/verify-ui-phase2-1688-acceptance-page.mjs
node scripts/verify-ui-phase2-1688-acceptance-read-states.mjs
node scripts/verify-ui-phase2-1688-acceptance-actions.mjs
node scripts/verify-ui-phase2-1688-acceptance-robustness.mjs
node scripts/verify-ui-phase2-1688-acceptance-lifecycle.mjs
node --test tests/unit/ui-phase2-acceptance-historical-capture.test.mjs tests/unit/ui-phase2-1688-acceptance-page.test.mjs tests/unit/ui-phase2-1688-acceptance-read-states.test.mjs tests/unit/ui-phase2-1688-acceptance-actions.test.mjs tests/unit/ui-phase2-1688-acceptance-lifecycle.test.mjs tests/unit/ui-phase2-1688-acceptance-robustness.test.mjs
```

需要原Git提交及与原SHA一致的浏览器配置构建产物；缺失或漂移时先查明版本，不更新预期SHA。
原图入口仍在`output/playwright/p49-acceptance-*-review/index.html`各对应目录，是原批次
历史待审图，不是本轮新图。此次不产生新的审核问题或自动批准。

未改生产SFC/CSS、原图/manifest、原驱动、API/OpenAPI、权限、SQL、配置、环境变量或依赖。
无生产重启要求，未提交部署，commit hash不适用。新helper、永久测试与本报告为交付物。
无新临时脚本/截图/日志/下载；所有自建浏览器和服务已结束，上表六端口无监听、无驱动进程。
历史策略阻止清理的两目录仍保留，不绕过重试：
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`；
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。
