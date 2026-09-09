# IDENTITY-C-r1 · 行为对应及未覆盖项

事实依据：LocalIdentity、LandingRedirect、TenancyChooser、OnboardingGuide与既有[身份规格合同](../../identity-onboarding-contract-review.md)；机器清单绑定本次实际源码指纹。旧合同、覆盖表与旧图均保持。数据全部合成；占位密钥和恢复码刻意不可用，不将真实材料输出。

## 页面及状态

| 页面 | 覆盖的内联状态 | 关键边界 |
| --- | --- | --- |
| P01 | 读取、缺目标/失败受阻 | 加载时无重试；无效“查看影响”不画为按钮；目标与权限仍由实际landing决定 |
| P02 | 普通登录、输入错误/拒绝/限流/受阻、挑战/失效、首次改密/重新登录/绑定/恢复码 | redirect优先分支保留在源证据；不承诺所有成功均先landing；首次改密必须重新登录 |
| P03 | 初始、输入错误/不一致、处理、失败、邮件入队 | 请求不含确认密码；局部verify不代表URL跳转或已登录 |
| P04 | 初始、错误、处理、失败、通用受理 | 不揭露账号是否存在，不声明送达，不新增倒计时 |
| P05 | 缺材料、确认中、成功、拒绝、限流、受阻 | 自动动作，无重新发送接口；失败不再沿用“正在验证”标题 |
| P06 | 一个新密码、错误、处理、拒绝、无效链接、成功 | 缺token的当前源码仍向后端提交；不在图稿伪造前端安全保证；成功不自动登录 |
| P07 | 状态未知/失败、未启用、开始、密钥、确认、恢复码、已启用、停用、过期 | 未读状态不当false；原生无弹窗；无二维码/复制/下载；停用结果不伪造真实撤销证据 |
| P08 | 组织读取/搜索/无匹配/无组织、工作区读取/空/归档/选择/就绪、401/403/失败、个人创建中 | 无组织才能创建本人默认空间；无工作区只能返回目录；普通继续/onboarding与个人成功/home不同 |
| P09 | 三个说明步骤、上一/下一/直达/退出 | 无进度持久化；小数query导致现有undefined的问题只作源复现，不改生产代码 |

## 动作映射（不作为全站冻结分母）

| 既有语义动作 | 图稿入口 / 状态 | 本包验证边界 |
| --- | --- | --- |
| ID-ROOT | 所有页品牌 | 离线导航目标/；不执行landing鉴权 |
| ID-LANDING-CHECK | p01-blocked | 重试切为读取，不画无处理的次动作 |
| ID-FORM-SUBMIT | P02/03/04/06及challenge | 原生输入/一致性、键盘提交、busy及局部结果；不发送真实payload |
| ID-SHOW-FORGOT/REGISTER/LOGIN | 身份表单和辅助入口 | 局部模式切换，不改变URL；图稿清空输入非源码清理证明 |
| ID-EMAIL-CONFIRM | p05-loading/success/error | 自动动作仅图示；源码无材料零请求及有材料响应由隔离脚本断言 |
| ID-SEED-PASSWORD | p02-seed/loading/error/relogin | 改密后重新登录的中断点保留；真实会话撤销未验 |
| ID-MFA-START/CONFIRM | P02首次设置、P07绑定 | 合成材料、内联步骤、忙碌态；代码格式仍以服务端合同为准 |
| ID-MFA-DISABLE | P07已启用/恢复码底部危险区 | 停用前输入与后续登录提示；无真实DELETE，不证明幂等或清理 |
| ID-ACCOUNT-SECURITY/MFA-ROUTE | 身份页脚 | 真实路径记录；匿名准入属于实际router，不模拟已通过 |
| ID-CONTEXT-ROUTE | p02-success-no-route | 保留已有继续选择组织入口；不把缺少落点画成已进入工作台 |
| ID-ORG-RELOAD/CHOOSE/CLEAR | P08目录/搜索/返回 | 搜索名称与slug、不匹配不等同无组织；未验证最近5个ID与迟到响应 |
| ID-WORKSPACE-CHOOSE/CONTEXT-CONTINUE | P08工作区/就绪 | 归档禁用；选择成功才显式继续；actual setup验证准确body |
| ID-PERSONAL-PROVISION | P08无组织 | 演示默认/home；actual setup验证无body、非默认return_to；不创建真实组织 |
| ID-LOGIN-ROUTE/ACCOUNT-ROUTE | P08过期/无组织 | 记录真实导航目标，无假菜单 |
| ID-GUIDE-STEP/PREVIOUS/NEXT/FINISH/SKIP | P09三步 | aria-current、上下步和根出口；不声称已读完或保存 |
| ID-LEGACY-SESSION-REVOKE | 无公开模式入口 | 不作为P01–P09设计新增功能；归属P11待合并 |
| NONACTION-ACCOUNT/LANDING-SECONDARY | 无有效业务处理 | 省略假按钮，不新增接口或影响详情 |

## 待真实实现处理

1. MFA读取失败/加载时现有false；邮箱失败时旧标题；MFA与种子type=button缺少普通form防重复。图稿提出明确未知状态、正确信息和统一忙碌锁，实际Vue未改。
2. mode切换和MFA停用后敏感ref清理、成功后密码保留、query-only变化、读取/写入交叉等必须按真实安全合同建立生命周期验证。本包表单清空只是合成演示机制，不是安全结论。
3. P01角色落点、P08搜索排序/最近组织/跨请求归属、P09query异常完整运行、每个辅助动作六态、全主题/密度与软键盘、读屏均待验。局部source函数不是Vue挂载、鉴权、SQL事务、Cookie、邮件实际投递或生产证据。

本包有80余种状态也不以数量代替覆盖；具体数量由casebook与清单计算，不修改总coverage或用户批准。
