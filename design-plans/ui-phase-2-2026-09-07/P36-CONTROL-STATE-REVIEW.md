# P36 组织令牌 · 控件状态细化

起点main/43417d5d，工作树干净。本批新视觉全部待审；C方向选择、其他页面批准不能转授P36。前批P35的未答问题不阻塞此项，但仍保持待审。

[354张图册](../../output/playwright/p36-controls-review/index.html) · [交互稿](design/org-token-controls/index.html) · [逐控件证据](../../output/playwright/p36-controls-review/evidence.json)

## 改了什么

新建独立org-token-controls，复用原tokens.js/data.js及112张原图，不改原稿或生产组件。frontend-design用于蓝色3px焦点、灰色禁用、红色撤销反馈以及期限/四scope选择标记。权限选择标签提升到16px，辅助仍至少13px；44px命中区与原生焦点检查。ui-skills CLI本地缺失，回退已安装技能；Playwright复用仓库依赖，没有安装工具。

44控件/变体：344双端原生状态截图、4轮换/撤销窗组合及6明文反馈组合，共354PNG。1440/390检查，只有手机折叠按钮不造桌面图。选择与按下分开；禁用/忙碌仅在所列条件下采图。390px悬停/按下是窄视口鼠标态，不是触屏hover或软键盘验证。

| 类别 | 具体覆盖 | 来源/边界 |
| --- | --- | --- |
| 读取 | 刷新默认/悬停/焦点/按下/后台等待，失败重新加载 | 父级关联，不混入12子源码位置 |
| 定位/手机筛选 | 两目录定位、顶部创建定位、筛选展开/收起 | 5个便捷提案，不是新增接口 |
| 筛选/分页/详情 | 重置、空结果清除、上下页及首末禁用、技术详情开合 | 清除是第6个便捷提案，其余有真实子入口 |
| 创建 | 提交四态及busy | form提交与submit按钮分别对应源码位置；不模拟真实创建成功 |
| 期限 | 30/90/180/365各已选/未选四态 | 同一循环入口，重复渲染不增加源码数 |
| 读取scope | 四固定scope各已选/未选四态 | checkbox本体触发，整块label截图与命中区核验 |
| 明文 | 复制未反馈/已复制/失败、主动清除 | 仅无效合成明文和内存复制适配器 |
| 轮换/撤销 | 各默认/悬停/焦点/按下/busy | 仅active记录，父传busy包含refreshing |
| 两原因窗 | 各关闭、取消、确认四态及原因不足禁用 | 共享原因消费者，不算本地新增业务窗 |

12个OrganizationTokenPanel当前源码位置（含form/submit、原生summary）逐一绑定且仅绑定一次。6个便捷变体、2个父读取入口和6个共享窗控件不冒充子入口。本批不等于完成P36父级完整接线登记或全部字段/组合审查。

## 合同与未改项

依据总纲M06-01、真实OrganizationTokenPanel、OrganizationAdminCenter.tokenAction/createOrganizationToken及AuditedReasonDialog。创建意图精确name/scopes/ttl_days/reason；两动作精确action/expected_version/reason。取消或Escape不产生写意图、回到原目标；确认后关窗，不虚构原因保留。四scope及1–365天范围不变，轮换期限仍来自后端配置。

原稿原因最长500、处理中锁草稿、未知结果暂停和旧复制归属保护仍为旧提案，不是实际Vue已有功能或获批业务规则。真实共享原因窗没有maxlength，不能用图上2–500宣称前端上限已统一。此轮只在原提案上调整视觉，不将这些行为部署到产品。实际复制仍有OG-G05待办，不因离线复制测试通过就注销。

列表GET实际可能更新到期状态，不能称真实接口绝无数据库写入；本轮没有发送HTTP。新测试明确阻止navigator.clipboard调用，系统剪贴板访问次数0。样例值以SYNTHETIC标识，不是有效凭据，不进入URL/cookies/localStorage/sessionStorage。没有使用生产账号、Token或客户数据。

未改生产Vue/CSS、API/OpenAPI、权限、后端/Worker/Python、数据库/迁移、env、依赖或部署。无新运行参数，无当前重启需求。旧112图与原清单保持原字节，不用新图替换历史证据。

## 验证与使用

```powershell
node scripts/verify-ui-phase2-org-token-controls.mjs --smoke
node scripts/verify-ui-phase2-org-token-controls.mjs --capture
node scripts/verify-ui-phase2-org-token-controls.mjs
node --test tests/unit/ui-phase2-org-token-controls.test.mjs
```

最小模式手机44原生状态/42点击；完整344原生状态/82点击，另两窗×双端视口容纳和首尾Tab循环。精确意图/局部结果、数据不变、焦点返还及禁用不重复均检查；零HTTP、页面错误、系统剪贴板调用及持久化存储。四单测固定源事件/绑定、状态全组合、源图哈希、精确清单和批准边界。

首次最小检查发现label继承13px，已只在新稿提升16px。首次目检发现复选框区域上沿裁切，验证器改滚动整个label再采图，不改变页面业务。另纠正单测中源码引号的转义，未修改旧合同。最终只保留完整同源交付，不保留失败版本。

直接打开交互稿，用页外工具选控件；原“审核场景”仍可选择原54场景。CSS位于独立controls.css，不需要启动服务器。默认验证核对哈希并重跑，不写图；--capture重新生成当前完整图包。

## 剩余与收尾

本批控件视觉、原因窗组合、字段与整体布局均不自动通过。P36真实C实施、完整父接线、字段/组合、实际剪贴板/权限/幂等/审计、生命周期/历史/主题密度和全73页部署验收继续待办。只向用户索取已展示的具体控件视觉意见，不把小范围确认扩大。

354PNG及index/evidence共356输出文件为永久审核交付。没有新临时下载、脚本、日志、夹具或服务；首版图片在本轮同名位置重采。浏览器/上下文finally关闭，file URL无监听端口；不删除原图或其他任务历史材料。

最终收尾：完整同源复验344状态/82点击通过；4项新单测与全部ui-phase2单测通过；153文档/73路由、运行说明和格式门通过。实际检查复选焦点、期限选择、busy按钮、撤销窗及复制失败整区截图；复选label居中后焦点框完整保留。新图包清单无多余文件，历史进度与旧图片不改。已询问已选scope/撤销确认两项焦点视觉，仅这两项待用户意见，不包含原因长度、权限规则、整窗或整页。
