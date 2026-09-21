# P33 重读成功焦点 · 实际 Vue C 预览 r2

2026-09-13。范围仅为前序创建成功/读取失败反馈的恢复成功焦点，不修改生产源码、
原有布局、创建规则或任何前序审核结论。全73页目标继续，不能据此宣布整页完成。

## 证据与修订

原r2真实父预览中，聚焦“重新读取列表”并按Enter，读取成功后按钮消失，焦点为BODY；
下一次Tab仍到“01 团队目录”。不是导航完全失效，而是成功结果没有明确焦点落点。

新组合只在现有父预览上追加局部ref、Vue nextTick与focusin跟踪：

- 发起恢复时焦点仍在该提示内、读取成功、请求仍属于当前页面，并且提示节点仍有效，
  才聚焦“团队列表已更新。”结果区。`tabindex=-1`不增加常规Tab停靠点，沿用C蓝焦点。
- 等待期间用户聚焦了其他区域，则不抢回焦点；即使那个外部元素随后消失也不抢回。
- 读取失败、页面归属失效、结果节点断开/替换均不执行成功焦点恢复；跟踪监听在finally移除。
- 只增加本地DOM交互。沿用原GET恢复、三个逻辑创建、POST载荷与幂等检查，403读取失败
  期间团队内容仍隐藏。普通创建成功的焦点、成员操作及其他OG-G02不在这次修订范围。

生产`OrganizationAdminCenter.vue`和`OrganizationTeamPanel.vue`未修改；
`scripts/lib/ui-phase2-teams-recovery-focus-preview.mjs`在内存组合前序预览，测试验证可精确逆转。
当前driver绑定上一层验证器归一化SHA256
`6f5526facc1381f51f84873b079a32d492de42d0ca30b95dd0fba74370e50f74`，改变时失败关闭。

## 当前图与测试

三模式 × 500/403 × 四宽390/840/841/1440，共24组、1176项浏览器检查、24张完整视口PNG。
每包188来源哈希，全部图片1000px高，截图前后焦点一致。新图使用完整视口，避免裁掉外侧焦点框。
捕获时为便于展示会将目标滚至视口约100px处；这不是自动恢复原滚动位置的承诺。

| 场景 | 手机500 | 手机403 | 桌面403 |
| --- | --- | --- | --- |
| 原反馈恢复，焦点BODY | [图](../../output/playwright/p33-recovery-focus-baseline-500-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-baseline-403-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-baseline-403-r2/1440-recovery-focus.png) |
| 修订后，结果区焦点 | [图](../../output/playwright/p33-recovery-focus-revised-500-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-revised-403-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-revised-403-r2/1440-recovery-focus.png) |
| 等待时转向品牌入口，不抢焦点 | [图](../../output/playwright/p33-recovery-focus-external-500-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-external-403-r2/390-recovery-focus.png) | [图](../../output/playwright/p33-recovery-focus-external-403-r2/1440-recovery-focus.png) |

六包位于`output/playwright/p33-recovery-focus-{baseline,revised,external}-{500,403}-r2`，各含
4张图与`evidence.json`。基线384项、修订408项、外部焦点384项；共336本地GET、72个明确
拦截POST，零真实后端/数据库写入。单测逐一对比前序r2非截图检查，未删除原请求/状态断言。
目检手机500结果蓝框、桌面403恢复结果蓝框、手机403外部品牌蓝框；不代表全部区域视觉获批。

11项新定向测试通过，包含真实变换后的函数与惰性DOM模型、Vue编译/精确逆转、外部焦点、
页面代次、失效节点、失败/异常、忙碌和nextTick时序，以及六包当前来源/PNG与命令预检。
模型测试中的换范围/节点替换不是实际浏览器跨组织或缓存生命周期验收；浏览器外部聚焦
使用真实品牌入口的focus，不冒充完整键盘路径或品牌导航已测试。

收尾关联验证：十份团队测试69/69通过（约38.43秒），另共享原因合同9/9通过，共11份
78项通过，0跳过/取消。Prettier、文档门禁153文件（73路由/60受保护/6角色）、运行文档
一致性及本次文档diff检查均通过，不代表全库门禁。全部14个本轮监听端口复核已关闭：
63589、63876、64013、64028、64065、64077、64141、64305、64346、64386、64394、64451、
64461、64531。工作区652→656项，新增仅helper/driver/永久测试/本记录，暂存区仍空。

## 使用方式与运行边界

```powershell
node scripts/verify-ui-phase2-teams-recovery-focus.mjs --smoke
node scripts/verify-ui-phase2-teams-recovery-focus.mjs
node scripts/verify-ui-phase2-teams-recovery-focus.mjs --baseline
node scripts/verify-ui-phase2-teams-recovery-focus.mjs --external
# 加 --capture 将先检查对应两个r2目录；已存在即拒绝，不覆盖前序图
node --test tests/unit/ui-phase2-teams-recovery-focus.test.mjs
```

`--smoke`只检查手机500，可与baseline或external组合；capture不能与smoke组合，baseline
与external互斥，未知/重复选项均在浏览器启动前拒绝。默认使用已有依赖、本机随机空闲端口、
API全拦截。浏览器与Vite在finally关闭，不保留常驻服务，无生产重启/配置调整要求。

新增helper/driver/永久测试/本记录，同步当前计划、P33规格、Feature Map和运行说明。
API/OpenAPI、环境变量、数据库、权限规则、依赖、Node/Python/Worker运行合同均未改，
无需相关迁移或部署操作。暂不提交混合阶段工作区，commit hash不适用；未重新测算全库失败数。

本轮裁切试拍的四个r1草稿目录共16PNG/4清单已核对准确路径与内容，但删除命令在执行前
被工具策略拒绝（blocked by policy），因此未删除，也未用其他工具重试或绕过限制。
保留路径如下，均不是正式审核图；如需清除，须由用户在文件管理器核对后删除：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p33-recovery-focus-baseline-500-r1`
- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p33-recovery-focus-baseline-403-r1`
- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p33-recovery-focus-revised-500-r1`
- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p33-recovery-focus-revised-403-r1`

正式六套r2保留交付；不触碰前序P33读取结果r1/r2及历史清理受限目录。
焦点蓝框属于沿用C控件样式，本轮不重复请求整页批准。
前序P33结果分离反馈区域仍待审，全部按钮/弹窗、真实权限、生产与完整73页验收仍未完成。
