# P29 组织资料 · 源码与图稿逐项对应

2026-09-10；起点main/fcb18ca8。依据AGENTS → Feature Map organizationAdmin → 蓝图M06-01 → 当前OrganizationAdminCenter、F04合同与C稿。使用ui-skills-root/frontend-design保持已选方向和具体批准边界；本批不改变视觉布局或业务代码。

[机器清单](action-reviews/P29.json) · [170张控件图](design/organization-profile-controls-direction-c/gallery.html) · [原74张整页稿](design/organization-profile-direction-c/README.md)。全部仍待具体审核。

## 动作、字段与容器

| 源码范围 | 对应关系 | 实施边界 |
| --- | --- | --- |
| OG-REFRESH | 页首刷新，loading/refreshing禁用 | 三GET；成功重新填充表单并清原因，不能承诺保留草稿 |
| OG-RETRY | 六类错误页面的重新加载 | 原button没有禁用/在途外观；不是自动登录或权限绕过 |
| OG-PROFILE-SAVE | 表单submit和保存button两个入口归一个动作 | 六字段加expected_version，PATCH；busy早退与原生表单校验 |
| OG-PROFILE-LOGO | input的invalid/input | 浏览器有效性提示与清错；不上传、不请求图片、不单独写入 |
| P30/P31父转发 | 两个显式非summary子组件 | 本页排除，不代表成员/授权页已经核对完成 |
| 原因窗调用/转发 | 四源位置合一排除组 | 初始P29没有ask入口，但父模板仍装配原因窗；跨路由已有窗另验 |

共11源位置、7语义组：三个业务动作、一个字段本地回调、三排除组。全站机器统计routeActions=4含字段回调，不应写成四个业务按钮。

六模型按源顺序记录：name、logo_url、timezone、data_retention_days、default_workspace_id、reason。输入边界沿源required/maxLength/number/URL及实际服务，不造时区枚举、active-only工作区筛选或组织状态编辑。一个内联form展开23相关状态引用；一个共享AuditedReasonDialog调用以“初始summary无发起入口”关联，不能仅凭无弹窗截图声称任何进入时序都无窗。24容器引用不是24业务弹窗。

## 控件图绑定

将170图已有controlReferences补为机器可验证的三个actionVisualReferences、八个扩展变体：主控件16状态引用、变体29状态引用。两张pending表现各同时对应busy/disabled，不能当作两次操作。重试与Logo合计四个源码无在途/禁用槽单列；Logo默认/悬停/焦点/按下四槽仍未绑定，不能把相关错误整页图当完整字段状态。

三目录×已选/未选、三处技术详情、两种结果核验禁用，共11个提案控件另列；不进入现有源码业务动作分母。没有把save_timeout或write_read_failed提案保护当作生产规则。

## 验证与尚缺

新增7项注册测试：完整源码集合、字段/容器顺序、主控件和变体selector/双端图、遗漏/借图/虚假批准/源漂移反例，以及实际v-if分支和submit无ask约束。与上一批6项图证/源函数测试合计13项定向检查；父助手继续明确复现OG-G02，不把绿测试当已修缺陷。

运行`node scripts/build-ui-phase2-organization-profile-review.mjs --write`生成登记，`--check`只读核对；图源有变化先执行原控件验证器`--capture`再无参数复验。不得手工改源指纹来通过检查。

仍待：Logo精确四态和六字段完整状态/组合、具体用户批准、真实Vue全C实现、跨组织/缓存/读写回执、原保存重读失败覆盖提示、真实API/MySQL审计/权限和全站宝塔验收。本批不创建生产业务数据，不改apps/packages、API/OpenAPI/env/数据库/依赖或服务；无新增配置、无需重启，未部署。
