# P44 手机角色资料 · 生产源码接入

2026-09-11，基线66ea2f60。接入用户已[局部批准的角色资料组合](P44-MOBILE-ROLE-FACTS-APPROVAL.md)，不是整页批准或部署。UI技能按已批准C方向校对上下排列、标题层级、留白与帮助信息颜色，不引入新业务行为。

## 实际改动

仅生产PlatformAdminComparisonMobile.css追加独立手机资料规则。限定signal-ledger、账号管理容器、当前管理员导航、max-width760px和role-comparison__summaries。白色资料区、16px横向内距、20px纵向内距与组间距，姓名16px加粗、职责说明次级蓝灰、权限数量13px；移除资料卡原米色背景和圆角框。原手机控件与结果media块逐字保持。

PlatformRoleComparison.vue及完整父组件、角色查找、数量计算、选择器、筛选、reset、URL行为和接口没有改动。展示样式复用于选择后的资料，测试证明资料仍随真实选择变化；这不代表其他角色/状态/宽度获得视觉批准。390px与批准图核对，其余宽度属于兼容验证。

## 正式图与验证范围

- [修改前24图](../../output/playwright/p44-mobile-role-facts-implementation/baseline/index.html)
- [当前生产源码24图](../../output/playwright/p44-mobile-role-facts-implementation/current/index.html)
- [390px当前角色资料](../../output/playwright/p44-mobile-role-facts-implementation/current/390-admins-role-facts.png)

两路径admins/permissions、390/760/761/1440四宽度。每组合完整回放默认6差异、同角色0差异、同角色显示全部3项、搜索空、清空恢复3项、同角色平台治理1项、重置6项；采集默认资料、同角色全部及重置后的三张截图，前后共48PNG和四个图册/清单。基线188项、当前352项浏览器检查；每清单37个LF源指纹，包括实际验证脚本。真实Vue和生产CSS，没有审核CSS或模板覆盖，基线只替换为66ea2f60的精确原源。

每个状态检查两侧名称、说明、权限数量与原HTTP样例角色目录逐项相等。P44每宽度2GET且比较不改URL；P45保留7GET及URL持久化。仅拦截既有accounts/roles读取，零意外网络、零页面错误、无真实写入；不据此认定真实权限通过。

原比较控件/键盘焦点和所有结果区的计算样式与基线逐项比较；P45及桌面连资料内容/样式/几何一并保持。手机资料区改变高度，下面结果的纵向位置自然随流式布局变化，不能把“结果样式未改”表述成整屏像素未改。当前图仍可看到未重构的米色不同角色结果，明确不称为整页C。

## 精确历史关联与当前核对

在既有admin-results-baseline辅助器中登记本次CSS的唯一before/after指纹，旧结果清单读取其制图时的66ea2f60源码；更早图片再按原有67cb00f3关联。未知源码修订失败关闭，不放宽任意哈希，不改旧批准PNG。新角色资料测试直接读取当前生产源码，核对37源、48图、七状态内容与限制选择器；当前35源静态合同同步最新CSS指纹。

## 如何复验与上线

```powershell
node --test tests/unit/ui-phase2-admin-mobile-role-facts-implementation.test.mjs
node scripts/verify-ui-phase2-admin-mobile-results-implementation.mjs --role-facts --baseline
node scripts/verify-ui-phase2-admin-mobile-results-implementation.mjs --role-facts
node scripts/verify-ui-phase2-platform-account-contract.mjs
```

默认复验不写文件；有意重制本批正式图时追加--capture。--role-facts是现有验证脚本的本地审核开关，输出到本报告链接目录，不是产品运行配置。已有不带此开关的结果模式保留。无需安装依赖或配置环境变量。

本轮不部署、不重启。线上生效需要前端构建与既定宝塔发布；不能以本地生产构建代替上线验证。后端/OpenAPI/数据库/权限/配置/env/Python/插件均未改，因为未改变其生产或消费契约。完整App、真实RBAC、全按钮/弹窗/状态、剩余审图及全73页宝塔验收仍未完成。

## 收尾

定向测试29项、810项相关UI回归、前端类型检查与Vite生产构建、73路由/153文件文档门禁、格式及diff空白检查均通过。原102包15069PNG审计源与图片漂移均为0，仍不认定整页完成。本轮新建文件均为永久验证或正式交付材料，没有一次性临时文件；浏览器/本地Vite由finally关闭，结束前复核52006、52082、52286端口均无监听。48PNG及图册/清单为用户所需交付保留；未删除既有输出或测试文件。
