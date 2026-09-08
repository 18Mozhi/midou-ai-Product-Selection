# P50 · 凭证资产 / CREDENTIAL-ASSETS-C-r1

状态：C 方向下的首轮具体设计稿，待用户审核。基线 main/e8ed20f；没有改生产 Vue、API、权限、数据结构或部署。

[打开离线交互原型](index.html) · [证据清单](evidence.json) · [事实规格](../../page-specs/P50.md)

## 设计与审核重点

frontend-design 指导“蓝色关系目录＋白色台账”，将凭证、运行引用、关联条件分成三块页内工作区；不再使用原页面的统计卡与资产卡墙。三工作区是布局提案，不增加后端筛选、分页或查询。移动端使用顶部短导航、单列资产、独立操作面和来源详情。

基础色 `#254a9c / #ffffff / #edf1f6 / #202c3d / #58677b / #8c3c32`，中文系统字体，标题 24–32px、控件至少 16px、说明至少 13px、44px 控件。风险信息靠文字和位置表达，不只依赖颜色。具体稿需确认布局、主次按钮、敏感编辑和部分成功恢复，不能把选择 C 当成这份稿的批准。

原始 E2E 夹具只有一个 active 浏览器资产、一个 disabled 档案与两个登录型来源；其余图为明确标注的独立合成状态。active 统计不排除过期；关联满足仅核对同来源、active 引用及有效期，不能替代真实登录、解析、来源启用。固定“明文回显 0”不作为安全扫描指标。

## 每个操作面与合同

| 面 / 控件 | 原合同与图稿处理 |
| --- | --- |
| 主页面 | 三组 GET 全成才更新；刷新、首次/空/各错误、旧快照保留。蓝色三个按钮仅切页内区域，不写 URL 或服务端 |
| 凭证台账 | 新建、首个资产、网页登录、每个未撤销资产更新/撤销；技术指纹/版本/时间展开；已撤销项禁用，不添加解密/导出/恢复 |
| 运行档案 | 只读清单与关联入口，包含 locale/timezone/status/version/引用；没有修改、删除、停用既有档案按钮 |
| 关联检查 | 四列与原列设置、至少一列、冻结首个可见列、两密度；手机来源详情；“关联条件满足”文案是待审改进，不冒称真实登录有效 |
| 新建 / 轮换窗 | 创建六绑定及五类型、两编码、password、可空时间；轮换只传 secret_payload/expected_version/expires_at。原资产窗实际已有 message，不能误列为缺失 |
| 手动关联窗 | 六可编辑项；provider_id 由资产推导，chromium 固定，disabled/en-US/America/Los_Angeles 原默认不改。无候选、失败、进行中、可提交均出图；窗内错误反馈为提案 |
| 登录导入窗 | 明确来源、三方式、文件选择、外部登录页、助手读取、助手 ZIP；这些原操作有真实副作用，本原型全部为脱敏意图，不打开页面、下载、读文件或扩展 |
| 登录材料限制 | Cookie .json/.txt/.cookies ≤2,000,000 字节；档案 .tar.gz ≤6,000,000 字节、Base64。扩展名/大小通过不等于服务端格式/域校验通过 |
| 两次写入 | 先资产，后 active/zh-CN/Asia/Shanghai 档案。第一步成功、第二步失败不回滚资产；关闭→刷新→关联已有资产，不重新导入。运行档案启用不是来源启用 |
| 撤销 alertdialog | 签认影响＋trim 后输入“确认撤销”；expected_version 与固定 reason。不增加原因编辑、恢复或删除历史；版本冲突、busy、确认未足均出图 |
| 所有弹窗 | 关闭/取消/Escape、原生模态 Tab 约束、返回触发焦点；busy 离开不宣称取消服务端请求。迟到结果与跨来源材料隔离仅是原型提案 |

6 个任务变体：新建、轮换、手动关联、登录导入、撤销、来源详情，对应当前代码 5 个模态定义（创建/轮换共用）。审核工具不是第七个业务弹窗。未知写结果不说“未写入”，不提供盲目重复提交；元数据重读也不能单独证明全部外部副作用。

## 源证据与未实施差异

永久辅助脚本提取真实 E2E 元数据，通过 TypeScript AST 执行实际 Vue 脚本（惰性 ref/computed/生命周期与请求桥），验证精确请求体、10 种三读失败路径、单飞、12 秒 abort 回调、三登录方式两 POST 和部分成功。模拟材料只在测试内存中，不写入图册数据或意图。此验证不是挂载 Vue、真实计时、服务端鉴权、幂等、AES、MySQL 或扩展测试。

已复现：旧失败写入清空新建窗口秘密；迟到内存文件及助手回复回填已关闭窗口；切来源保留旧材料；首次登录资产写失败保留材料；无效深链回退首个来源。原型中的代次保护、来源切换清理、锁定进行中字段、未知结果处理、窗内错误与焦点归还均待具体审图后实施。

到期语义仍需 SC50-04 专项核对：原轮换用 UTC slice 初始化、按本地日期保存，服务端 null 又保留旧到期；本稿明确提示，不擅自改变持久化合同。浏览器资产候选包含过期 active 资产，与关联 ready 的筛选不同。轮换会进入后端登录受阻任务自动重放流程，本次未执行该链。

旧 P50 §7 和合同表错误地称资产/轮换窗没有 message；当前代码已存在，真正缺失的是手动关联窗。本次仅更正文档，没有重复修改产品提示。

## 验证与使用

仓库根运行 `node scripts/verify-ui-phase2-credential-assets-c.mjs --capture` 生成正式图和证据；无参数运行校验派生数据、源/PNG 指纹、精确清单和交互。复用现有 Playwright/TypeScript/Prettier，无依赖变更。直接打开 index.html 可审核；底部工具模拟结果，不请求接口。

图纸验证包含双端场景、六操作面键盘/关闭、各请求意图、材料归属、两步部分成功恢复、列设置/冻结/密度、长内容、额外断点与 CSS zoom2。此处 zoom2 不冒充浏览器原生菜单 200% 或真实辅助技术验收；全主题密度、Vue Router/KeepAlive、六角色、真实扩展/加密/自动重放和生产验收仍待 SC50-02–06。

本包全部 PNG、HTML/CSS/JS、数据、证据、脚本是正式交付；没有临时文件或常驻服务。无需重启或部署。下一页 P51 可继续设计；全 73 页 Vue 实施、宝塔部署及用户签收尚未完成。

## 完整双端图册

主图之外的 part 图从同一长弹窗连续向下滚动，覆盖被视口截断的字段、结果和底部动作；不是额外业务场景。

<!-- GALLERY:START -->

正式 PNG：149 张。

| 场景 | 桌面 1440 | 移动 390 |
| --- | --- | --- |
| 原始夹具 · 凭证台账 | [主图](1440-default.png) | [主图](390-default.png) |
| 独立合成 · 到期与撤销 | [主图](1440-mixed.png) | [主图](390-mixed.png) |
| 只读运行档案 | [主图](1440-profiles.png) | [主图](390-profiles.png) |
| 关联检查 · 尚缺档案 | [主图](1440-compatibility.png) | [主图](390-compatibility.png) |
| 关联满足 · 不等于登录有效 | [主图](1440-compat-ready.png) | [主图](390-compat-ready.png) |
| 桌面列设置 | [主图](1440-columns.png) | [主图](390-columns.png) |
| 桌面紧凑表格 | [主图](1440-compact.png) | [主图](390-compact.png) |
| 首次空数据 | [主图](1440-empty.png) | [主图](390-empty.png) |
| 仅有档案 | [主图](1440-no-assets.png) | [主图](390-no-assets.png) |
| 仅有资产 | [主图](1440-no-profiles.png) | [主图](390-no-profiles.png) |
| 无来源选项 | [主图](1440-no-providers.png) | [主图](390-no-providers.png) |
| 首次加载 | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次401 | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次依赖受阻 | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次错误 | [主图](1440-error.png) | [主图](390-error.png) |
| 刷新进行中 | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 刷新失败保留整组快照 | [主图](1440-refresh-error.png) | [主图](390-refresh-error.png) |
| 新建凭证 · 必填 | [主图](1440-asset-empty.png) | [主图](390-asset-empty.png) · [连续 1](390-asset-empty-part1.png) |
| 新建凭证 · 可提交 | [主图](1440-asset-filled.png) | [主图](390-asset-filled.png) · [连续 1](390-asset-filled-part1.png) |
| 新建凭证 · 明确拒绝 | [主图](1440-asset-error.png) | [主图](390-asset-error.png) · [连续 1](390-asset-error-part1.png) |
| 新建凭证 · 提交中 | [主图](1440-asset-busy.png) | [主图](390-asset-busy.png) · [连续 1](390-asset-busy-part1.png) |
| 新建凭证 · 结果未知 | [主图](1440-asset-unknown.png) | [主图](390-asset-unknown.png) · [连续 1](390-asset-unknown-part1.png) |
| 轮换 · 指定资产 | [主图](1440-rotate.png) | [主图](390-rotate.png) · [连续 1](390-rotate-part1.png) |
| 轮换 · 版本冲突 | [主图](1440-rotate-conflict.png) | [主图](390-rotate-conflict.png) · [连续 1](390-rotate-conflict-part1.png) |
| 轮换 · 到期语义说明 | [主图](1440-rotate-expiry.png) | [主图](390-rotate-expiry.png) · [连续 1](390-rotate-expiry-part1.png) |
| 已撤销资产 · 禁用维护 | [主图](1440-rotate-revoked.png) | [主图](390-rotate-revoked.png) |
| 关联运行档案 · 默认停用 | [主图](1440-profile.png) | [主图](390-profile.png) · [连续 1](390-profile-part1.png) |
| 关联运行档案 · 可提交 | [主图](1440-profile-filled.png) | [主图](390-profile-filled.png) · [连续 1](390-profile-filled-part1.png) |
| 关联运行档案 · 无候选 | [主图](1440-profile-noasset.png) | [主图](390-profile-noasset.png) · [连续 1](390-profile-noasset-part1.png) |
| 关联运行档案 · 窗内失败 | [主图](1440-profile-error.png) | [主图](390-profile-error.png) · [连续 1](390-profile-error-part1.png) |
| 关联运行档案 · 提交中 | [主图](1440-profile-busy.png) | [主图](390-profile-busy.png) · [连续 1](390-profile-busy-part1.png) |
| 登录导入 · Cookie文件 | [主图](1440-login.png) | [主图](390-login.png) · [连续 1](390-login-part1.png) |
| 登录导入 · 浏览器助手 | [主图](1440-login-browser.png) | [主图](390-login-browser.png) · [连续 1](390-login-browser-part1.png) |
| 登录导入 · tar.gz | [主图](1440-login-archive.png) | [主图](390-login-archive.png) · [连续 1](390-login-archive-part1.png) |
| 登录导入 · 材料待提交 | [主图](1440-login-material.png) | [主图](390-login-material.png) · [连续 1](390-login-material-part1.png) |
| 登录导入 · 格式或大小错误 | [主图](1440-login-fileerror.png) · [连续 1](1440-login-fileerror-part1.png) | [主图](390-login-fileerror.png) · [连续 1](390-login-fileerror-part1.png) |
| 登录导入 · 域校验拒绝 | [主图](1440-login-domainerror.png) · [连续 1](1440-login-domainerror-part1.png) | [主图](390-login-domainerror.png) · [连续 1](390-login-domainerror-part1.png) |
| 登录导入 · 助手读取中 | [主图](1440-login-reading.png) | [主图](390-login-reading.png) · [连续 1](390-login-reading-part1.png) |
| 登录导入 · 助手不可用 | [主图](1440-login-helpererror.png) · [连续 1](1440-login-helpererror-part1.png) | [主图](390-login-helpererror.png) · [连续 1](390-login-helpererror-part1.png) |
| 登录导入 · 保存资产中 | [主图](1440-login-savingasset.png) · [连续 1](1440-login-savingasset-part1.png) | [主图](390-login-savingasset.png) · [连续 1](390-login-savingasset-part1.png) |
| 登录导入 · 资产已存关联中 | [主图](1440-login-savingprofile.png) · [连续 1](1440-login-savingprofile-part1.png) | [主图](390-login-savingprofile.png) · [连续 1](390-login-savingprofile-part1.png) |
| 登录导入 · 部分成功恢复 | [主图](1440-login-partial.png) · [连续 1](1440-login-partial-part1.png) | [主图](390-login-partial.png) · [连续 1](390-login-partial-part1.png) |
| 登录导入 · 结果未知 | [主图](1440-login-unknown.png) · [连续 1](1440-login-unknown-part1.png) | [主图](390-login-unknown.png) · [连续 1](390-login-unknown-part1.png) |
| 登录已保存 · 重读单独失败 | [主图](1440-login-success-refresherror.png) | [主图](390-login-success-refresherror.png) |
| 撤销 · 双重确认 | [主图](1440-revoke.png) | [主图](390-revoke.png) |
| 撤销 · 已签认 | [主图](1440-revoke-ack.png) | [主图](390-revoke-ack.png) |
| 撤销 · 可提交 | [主图](1440-revoke-ready.png) | [主图](390-revoke-ready.png) |
| 撤销 · 提交中 | [主图](1440-revoke-busy.png) | [主图](390-revoke-busy.png) |
| 撤销 · 版本冲突 | [主图](1440-revoke-conflict.png) | [主图](390-revoke-conflict.png) |
| 关联检查 · 移动详情 | [主图](1440-compat-detail.png) | [主图](390-compat-detail.png) |
| 关联检查 · 来源技术详情 | [主图](1440-compat-technical.png) | [主图](390-compat-technical.png) |
| 登录导入 · 无登录型来源 | [主图](1440-login-no-provider.png) | [主图](390-login-no-provider.png) · [连续 1](390-login-no-provider-part1.png) |
| 长名称与技术元数据 | [主图](1440-long.png) | [主图](390-long.png) |
| 键盘焦点 | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核工具面板 | [主图](1440-tools.png) | [主图](390-tools.png) |

<!-- GALLERY:END -->
