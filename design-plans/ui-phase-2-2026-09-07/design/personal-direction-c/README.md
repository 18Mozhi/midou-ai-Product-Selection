# 账号壳层与基本资料 · PERSONAL-C-profile-r1

状态：C方向已选，本批具体图稿待审核；独立HTML，不是Vue实现或生产验收。P11仍未全部完成。

[打开交互稿](index.html) · [源与截图证据](evidence.json) · [P11规格](../../page-specs/P11.md)

## 本批实现的设计

AccountShell改为蓝色账号目录与白色表单工作面，移除旧横向账页索引；手机六个文字入口两列三行，导航随页面滚动，不用固定图标底栏遮挡保存。frontend-design用于重组导航与表单层级。

基本资料分为身份、联系与区域、修改说明三组；七个编辑字段和只读邮箱全部来自当前PersonalCenter，固定隔离账号来自UI2-A04。没有新增头像上传、短信验证、语言选项、注销或跨角色切换。

12场景×双端24图。其中permissions/security/notifications/assets各两图只审核当前导航位置，正文明确待实现；这些8张不是四分区业务完成证据。其余16张为基本资料、读写状态及非法section回退；不因图数计作完整P11。

## 每个入口和字段

| 入口/动作 | 真实合同与本稿行为 |
| --- | --- |
| 品牌、面包屑 | 均指向/，不自行推断返回成员或平台页；真正landing由既有路由负责。 |
| 组织与工作区 | /select-context，不读取成员导航，也不假装已有工作区。 |
| 五分区 | /me?section=profile/permissions/security/notifications/assets，链接不是局部Tab；非法、数组、空值回profile，只有一项aria-current。HTML只模拟选区，真实query守卫/浏览器历史待Vue验收。 |
| 外观偏好 | /settings/theme，作为独立页面入口，不内嵌主题保存。 |
| 邮箱 | disabled，不进入PATCH，验证事实来自夹具email_verified_at。 |
| 登录用户名 | 可选，2–32字符，保留autocomplete=username；服务端字符/唯一性校验不由演示冒充。 |
| 显示名称 | required，最大120。 |
| 头像地址 | type=url；HTTPS约束由后端执行，审核稿不增加预览外链请求。 |
| 手机号 | tel输入提示；无已验证时间时明确未验证，不新增短信按钮。 |
| 语言、时区 | 唯一语言zh-CN；时区required，默认Asia/Shanghai。 |
| 修改原因 | required，最大300，真实默认“更新个人资料”。 |
| 保存 | PATCH /me/profile，仅七字段加expected_version；邮箱不提交。演示成功更新返回版本，失败保留输入；不写HTTP/storage，不证明幂等、审计、后端校验或保存竞态。 |
| 刷新/重新加载 | 同一读取动作；刷新按当前行为重填资料，会覆盖未保存草稿；跨分区不刷新，输入仅内存保留。 |
| 租户分区失败 | 用UI2-A04的“三个分区暂不可用”说明，资料仍可保存；其他分区不画虚假空权限/资产或默认偏好。 |

当前PersonalCenter没有独立保存busy/写入归属保护；本稿模拟串行即时成功/失败，不能算重复提交或晚到结果通过。读取计时只是审核演示，不验证12秒超时。没有新增弹窗。

## 全部图

| 场景 | 图 |
| --- | --- |
| profile | [1440](1440-profile.png) · [390](390-profile.png) |
| permissions | [1440](1440-permissions.png) · [390](390-permissions.png) |
| security | [1440](1440-security.png) · [390](390-security.png) |
| notifications | [1440](1440-notifications.png) · [390](390-notifications.png) |
| assets | [1440](1440-assets.png) · [390](390-assets.png) |
| profile-loading | [1440](1440-profile-loading.png) · [390](390-profile-loading.png) |
| profile-error | [1440](1440-profile-error.png) · [390](390-profile-error.png) |
| profile-partial | [1440](1440-profile-partial.png) · [390](390-profile-partial.png) |
| profile-edited | [1440](1440-profile-edited.png) · [390](390-profile-edited.png) |
| profile-save-failed | [1440](1440-profile-save-failed.png) · [390](390-profile-save-failed.png) |
| profile-saved | [1440](1440-profile-saved.png) · [390](390-profile-saved.png) |
| invalid-section | [1440](1440-invalid-section.png) · [390](390-invalid-section.png) |

## 验证与使用

仓库根目录运行 `node scripts/verify-ui-phase2-personal-c.mjs`，只读检查AST推导的五分区/资料夹具/表单默认值、源与PNG哈希，以及双端导航、字段、版本提交、必填拦截、失败保留、刷新回填、非法query回退和无外部请求/存储。加 `--capture` 才生成本目录永久截图和evidence。复用已有Playwright/TypeScript，浏览器finally关闭，不启动服务或安装依赖。

源码、路由守卫、API/OpenAPI、权限、数据库、配置、依赖、coverage、旧图和用户审批均不改，无需生产重启。尚缺P11其余四分区完整业务图、真实Vue、真实会话/后端验证、完整状态、三主题/两密度/读屏/200%缩放及部署；继续按完整73页计划推进，不能将此批称为全部个人中心完成。
