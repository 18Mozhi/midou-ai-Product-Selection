# P43 改密两步与十类原因窗当前回放

## 范围与事实

继续全73页C方向重构。起点main / af239b08b69f7d97cd0372f9840a70009eeef0c7，
585项既有变更、暂存为空。P47两种空态批准保持原区域范围，P43详情顶部待审。
依据AGENTS、Feature Map、总纲平台账号管理基线与P43页规格追到当前父子Vue、
platform-account-service和mysql-platform-account-repository，不用图片替代权限验收。
使用UI技能路由与既有Playwright驱动，不安装依赖，不创建静态假页面代替Vue。

两份原定向测试8项6过2失败，均为旧图记录的ResponsiveDataView来源b9e635与当前
8669cbd不一致。分离历史捕获和当前回放后原8项全部通过，不改原图片或旧哈希。

## 实际改动

- 新增独立security历史来源读取器，固定password/reasons两份完整manifest及原Git提交
  01af02620bdbb751cc846e6a02081d4a0b735784，82项来源绑定全部按原blob验证；缺失或未知
  来源拒绝，无当前源码兜底。原368图及全部历史行为断言保留。
- 新增当前回放入口与驱动解析器，固定原驱动完整SHA。只替换输出目录、解析静态导入，
  user-page-preview导入转向上一轮专用current helper。反向核对整个驱动，原交互、
  请求、断言及finally未修改；没有新增CSS或生产组件变更。
- 当前结构检查读取原始Vue，不通过历史转换掩盖漂移。独立保护检查当前模板转换SHA、
  54项聚合来源、当前及旧PNG、原检查/请求/原因枚举；完整图包拒绝capture/resume覆盖。
- 不修改上一轮P43、P44、P39任何辅助文件或图包。新增永久测试供后续变更核对。

## 当前图包

[368张图入口](../../output/playwright/p43-security-current-replay-r1/index.html) /
[来源、检查与图像差异](../../output/playwright/p43-security-current-replay-r1/evidence.json)

| 组合 | 检查 | 图片 | 字节相同 | 字节不同 |
| --- | ---: | ---: | ---: | ---: |
| 改密与原因两步 | 415 | 88 | 67 | 21 |
| 十类非改密原因 | 1244 | 280 | 235 | 45 |
| 合计 | 1659 | 368 | 302 | 66 |

四宽度390/760/761/1440；改密4组、原因40组。全部图片尺寸未变；66处字节不同如实
列入清单，不声称像素一致或自动批准。分包原始来源43/45，聚合54含折入CSS及当前入口。
先无截图预跑，再独立首次捕获，两个阶段全部通过；无失败输出包或临时脚本。

改密12本地GET、8本地拦截POST；十类原因80本地GET、零提交。请求/观察与原记录逐项
一致；首步无写入，原因取消回到密码确认，原生校验阻止非法输入，失败停留密码窗，
成功关闭原详情/两窗。十类真实入口的标题、方向色、取消/Escape原触发器焦点保持。
密码使用已知合成值匹配标记，不记录真实密码。原组织关系样例缺organization_id，
保持并披露，不补造组织授权数据。底层改密的既有恢复active行为没有修改，亦未实测数据库。

这些是当前Vue经审核模板/CSS组合，不是完整未转换App；不覆盖密码明文清理、创建/改密
跨窗口归属的全部回归、服务端权限、自我保护、SQL/审计、MFA或生产验收。原生命周期
历史包的两项来源失败仍待独立修复，不能据此称P43全部完成。

人工查看390改密默认与原因默认，已提交两步排列的窄范围审核；未收到回复前保持待审。
不扩大其他页面或已批准区域的范围。

## 验证与使用

最小验证原8项全过；新驱动逆向、当前标题/绑定、82项历史来源三个定向保护通过。
最终六文件29项全过、零失败/取消/跳过，141141ms；包含此前P43、P44、P39完整图包保护。
文档153项、运行文档一致性、六文件Prettier与定向diff检查通过。相关完整验证命令：

```powershell
node --test tests/unit/ui-phase2-user-password-preview.test.mjs tests/unit/ui-phase2-user-reasons-preview.test.mjs tests/unit/ui-phase2-user-security-review-capture-boundary.test.mjs tests/unit/ui-phase2-user-review-capture-boundary.test.mjs tests/unit/ui-phase2-admin-review-capture-boundary.test.mjs tests/unit/ui-phase2-account-capture-boundary.test.mjs
```

无共享运行代码、配置或依赖改变，不重复生产build和全库长测试。最近全库1539项1407过
132失败仍是此前P44阶段快照，不是本轮结果，不直接减去两项推算新失败数。

日常验证：`node scripts/verify-ui-phase2-user-security-review-current-replay.mjs`只回放，
不截图、不访问生产；`--smoke`只跑改密。`--capture`仅首次创建新包，`--resume`仅续跑
来源仍一致的完整分包。完整r1现已存在，后二者会在启动浏览器前拒绝，不能覆盖批准证据。
查看图包直接打开上方入口，不需部署、调参、重启或迁移。

## 收尾边界

四个本地端口58995、59058、59224、59302已关闭。所有浏览器/服务由原finally收尾。
正式368图、manifest、入口和永久测试属于交付物保留；本轮无临时草稿、日志或失败包。
此前清理被策略拒绝的四目录保持未动，不绕过、不重试：

- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r1`
- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r2`
- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`
- `C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

本轮没有API/OpenAPI、后端/插件/Python消费链、数据库、环境变量、依赖、安全或权限变更；
生产契约同步不适用审核辅助改动。功能地图、页规格和运维入口同步此证据边界，不执行历史
迁移或宝塔操作。工作区混有既有变更、发布门未通过，未暂存/提交/部署，commit hash不适用。
全73页设计、所有控件/状态、真实运行链及用户生产签收仍未完成。
