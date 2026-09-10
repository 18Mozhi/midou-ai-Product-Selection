# P36 字段与表单组合 · 独立待审稿

起点main/4716e210，工作树干净。P36控件问题未答，不扩大为通过；本批[手机四字段/帮助/底部重置组合局部通过](P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md)，其他字段、表单、原因组合仍待审。

[196张图册](../../output/playwright/p36-fields-review/index.html) · [可交互稿](design/org-token-fields/index.html) · [逐项证据](../../output/playwright/p36-fields-review/evidence.json)

## 设计与字段范围

frontend-design用于四字段桌面并列/手机单列、就近帮助、底部重置，以及创建表单的名称/有效期、读取范围、原因和核对预览分区。有效期帮助占完整列，字符计数不拆断；实际DOM顺序与视觉一致。Playwright使用仓库依赖；UI Skills CLI本地缺失，回退已安装技能，没有下载或安装工具。

| 字段 | 真实来源 | 本批状态 |
| --- | --- | --- |
| 搜索令牌 | tokenQuery | 默认/悬停/焦点、中文/空白、220字符、无结果、ID不匹配 |
| 生命周期 | statusFilter | 三种视觉态和all/active/expiring/never_used/revoked/rotated/expired |
| 读取范围筛选 | scopeFilter | 三种视觉态和全部/四固定scope |
| 排序 | tokenSort | 三种视觉态和原五选项 |
| 名称 | createForm.name | 三种视觉态、填写、120字符、空白、原错误、等待 |
| 有效天数 | createForm.ttl_days | 三种视觉态、1/365/0/366/小数/空、原错误、等待 |
| 创建原因 | createForm.reason | 三种视觉态、填写、500字符、空白、原错误、等待 |
| 四scope选择组 | createForm.scopes的checked/change | 空/单选/全选/缺失错误/等待 |
| 轮换及撤销原因 | 共享reason，两上下文 | 三种视觉态、单字/有效/500字，分别出图 |

7个实际子v-model、1个scope组、2个共享原因上下文，共10条字段描述，78代表状态×双端＝156字段图。20组合×双端＝40组合图：4筛选组合、8创建组合、两动作各4原因组合，总计196PNG。双端为1440/390，截图视口高度1000；不以长图等同手机1000以内单屏，也不声称原生缩放/软键盘通过。

## 不混淆真实规则与提案

直接读OrganizationTokenPanel和AuditedReasonDialog，Vue AST提取7模型属性及原select选项；动态scope来自真实scopeOptions。实际组件计算表达式在隔离VM运行，对每张字段图比较完整筛选ID序列，固定时钟和8条样例沿用原稿。搜索不扩展技术ID；本地输入可达220字符，而初始URL读取仍截200，不添加搜索maxlength。

名称required/maxlength120、创建原因required/maxlength500、天数required/min1/max365按当前模板补齐到独立稿属性；原稿form已有novalidate及自有校验，未更改生产或提交机制。仅对原已存在的字段错误增加aria-invalid和关联描述，不凭空增加服务器错误规则。空白trim与原生required不是同一判断，不能仅凭浏览器validity声称服务校验通过。

共享原因窗实际没有maxlength。本稿继续原待审500上限，不把它当实际Vue合同；两动作原因帮助合并到字段下，保留操作者/时间/目标和取消不提交说明。原稿busy草稿锁定、未知结果保护及旧复制归属保护仍只是提案，本批不将其实施到生产。没有新增scope、改变后端期限、鉴权、业务API或数据库结构。

数据读取GET在真实后端可能更新到期状态；本批没有发送它。有效创建演示只记录现有POST意图，body与真实submitCreate隔离执行结果逐项相同，不伪造真实创建成功或追加令牌记录。取消原因窗保持零新增意图。全部样例无效，不使用或生成有效凭据；系统剪贴板被测试拦截，未调用。

## 验证与操作

```powershell
node scripts/verify-ui-phase2-org-token-fields.mjs --smoke
node scripts/verify-ui-phase2-org-token-fields.mjs --capture
node scripts/verify-ui-phase2-org-token-fields.mjs
node --test tests/unit/ui-phase2-org-token-fields.test.mjs tests/unit/ui-phase2-org-token-controls.test.mjs
```

最小模式手机10状态/5流程；完整156状态/10流程，包括双端各3项原生键入/光标定位、完整创建Tab顺序、精确源handler创建body。各图检查帮助关联、实际属性/选项、16px/44px、无溢出；maxlength边界用真实键入复核，0/366/小数/空天数检查原生validity。共享500只验证提案，不宣称源规则一致。没有HTTP、页面错误、系统剪贴板、cookies/localStorage/sessionStorage写入。

五新单测固定字段/源属性、所有状态/组合/流程、源图哈希、旧清单与批准边界。原112张整体稿、354张控件图及两个清单保持不变；新稿只加载旧CSS/JS，不覆写它们。默认验证核对哈希后运行，不重写图；--capture生成完整新图包。直接打开交互稿index.html，用页外字段工具或原场景工具审核；hover由鼠标触发，focus图由浏览器原生聚焦取得。

首轮完整检查发现有效期错误误用了默认90天的空表单场景，已改原366天场景。目检后扩大有效期帮助列、避免计数拆行、同步DOM/键盘顺序，并去除原因帮助重复、恢复共享原因原稿140px最小高度。组合采图先移走鼠标和焦点，避免默认图残留上一次悬停。没有为测试改产品逻辑。

## 未完成与收尾

用户仅批准手机四筛选字段、帮助与底部重置的组合，不包含同图顶部折叠按钮、创建区、真实Vue/权限/整页或生产验收，已用原PNG哈希和单测固定范围。继续呈现手机创建表单组合，仍为离线样例。P36其他组合、完整父接线、实际C实施、OG-G05、真实权限/数据库/幂等/审计、范围切换/历史/生命周期、主题/密度和全73页部署签收继续。

未改生产Vue/CSS、后端/Worker/Python、API/OpenAPI、env、依赖、权限或迁移；不运行部署，无当前重启要求，无新可调生产参数。无需重复不受影响的产品构建或旧控件浏览器检查，旧源和图指纹已核对。

196PNG及图册/清单共198输出文件均为永久审核交付；没有额外临时脚本、下载、日志、夹具或服务。首轮不完整图在本轮同名位置重采，最终清单检查无多余文件。file URL运行，无服务端口；浏览器与上下文finally关闭，其他任务旧材料不清理。

最终验证：当前源指纹及196PNG核对通过，完整156状态/10流程通过；P36定向9项及第二阶段全部UI单测通过；文档153项、73路由/60受保护/6角色、运行文档、格式和diff空白检查通过。生产代码及接口无差异，未重复生产构建、未部署。批准筛选图SHA256与展示对象一致，其他组合继续待审。
