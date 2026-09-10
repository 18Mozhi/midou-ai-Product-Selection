# P31 角色与权限 · 当前语义合同

2026-09-10，main/df6c85c3起点。依据AGENTS、Feature Map、蓝图M06-01和真实父子组件；沿用F04组织治理与共享角色合同的源身份，集中登记P31可达与排除分支。此表是人工核对语义，不是从按钮文字推断业务，也不是运行验收。

## apps/web/src/components/OrganizationAdminCenter.vue

| 源身份 | 真实边界 | 当前语义键 |
| --- | --- | --- |
| b11692c0597885e3.1 | 背景刷新角色/授权复合读取 | OG-REFRESH |
| 97ed4772fb320d6c.1 | 错误页重新加载，不绕过权限 | OG-RETRY |
| d6b520278ab3dd57.1、1cbd108c64b5230c.1、5878e30377f290ae.1 | summary资料三位置排除 | EX-P29-PROFILE |
| 6a563eeaa67fea90.1 | members事件转发排除 | EX-P30-MEMBERS |
| b09d7923228aabe6.1 | 六事件转发八目标；父busy或refreshing均传子busy | WIRE-ROLES |
| 56b1761955b256ef.1、f3515ca45998a840.1、7a51bff83af3db69.1 | 通用原因调用及确认/取消转发；本页仅撤销发起 | D-OG-REASON |
| e828f4ab0fdb0415.1 | 令牌原因调用排除 | EX-P36-TOKEN-REASON |

## apps/web/src/components/OrganizationRolePanel.vue

| 源身份 | 真实边界 | 当前语义键 |
| --- | --- | --- |
| 24237df37bd7b7e4.1 | 三本地分区，切换保留局部状态 | role.section.{section} |
| f7e8f2a9a0457015.1 | 只读模板选择，不分配角色 | role.select.{roleCode} |
| 23a85da051801987.1 | 原生details技术能力 | role.capability.technical.toggle |
| be3f3fa4fcf2fb2c.1 | 清能力query/group，不清角色查询 | role.capability.filter.reset |
| 5235116f7947ac74.1 | 清成员范围query/filter | role.scope.filter.reset |
| 0aac14fac3c56e10.1 | canManage显示/隐藏创建form，不清草稿 | grant.create.form.toggle |
| 27eeda4bb377f413.1、b75d50f1f8f0cc17.1 | form与按钮同一POST；busy或无actions禁按钮 | grant.create.submit |
| f0c0d3b1c8ae684b.1 | 受控type，父重置actions为该类型首项 | grant.create.type.change |
| 8bd3f7b2e5dcb44f.1 | 状态筛选重置page1并重读 | grant.status.select.{status} |
| a162032f86484b89.1 | 当前页本地选择，watch可能重置延期草稿 | grant.select.{grantId} |
| 5f937fb211eb5840.1 | 原生details资源/授权编号 | grant.technical.toggle |
| 64b97b8b5fe9de71.1、8c59567be7cef9a3.1 | form与按钮同一PATCH；active且canManage | grant.expiry.submit |
| 5be3d5846e4138fa.1 | 撤销原因确认后带version POST | grant.revoke.request |
| bf5c2f057a07f3f3.1 | 服务端上一页，busy及页首禁用 | grant.page.previous |
| 085ead5af6973fef.1 | 服务端下一页，busy及页尾禁用 | grant.page.next |
| a6d03f8144116449.1 | 总授权为0时只打开创建form | grant.create.form.open |
| cd26859a239383fd.1 | 当前状态空而其它状态有授权时重读all | grant.status.all |

## 字段、图稿与后续实施

[机器登记](action-reviews/P31.json) · [原48张C稿](design/roles-direction-c/README.md) · [设计入口](design/roles-direction-c/index.html)。20动作（含本地交互）/1接线/3排除，30源位置；120代表视觉槽尚未逐控件绑定，不能用整页图代替hover/focus/pressed/disabled/busy证明。

14个子组件v-model、1个type受控输入、1个共享撤销reason；父组件另6个summary模型在本页排除。创建7字段、延期2字段，另6个查询/筛选输入；共享原因另算。创建与延期是两内联form，撤销是一个共享窗；父summary form另列排除，不是四个弹窗。

四类型白名单保持task两项、opportunity两项、competitor一项、sourcing三项。创建POST去重actions、trim reason、ISO expiry；延期PATCH与撤销POST带expected_version。当前前端共享reason至少2字且无max，三个服务端授权写入reason为1–500；不能宣称501字可成功。服务端还验证同组织活动成员、role:manage、幂等键和资源边界，本批没有真实授权写入或权限测试。

到期时间父函数按提交时当前时刻验证未来且最多30天；子input min/max在setup生成。父函数没有比较旧到期时间，但`packages/resource-grants/src/index.ts`的`ResourceGrantService.extend`已经明确拒绝新时间不晚于原时间（grant_expiry_not_extended）。这是前端校验缺口，不是可缩短授权的新规则；源码隔离测试的submit替身只检查发出的参数，不证明服务器接受。后续设计须体现既有“只能延长”规则。选中授权变更后默认到期值是现在+7天，不是旧值+7天，可能触发服务端该错误。

源码行为需保留为待核对风险：创建在途编辑可被旧成功清除；刷新同ID新对象会清延期原因；无选中对象时watch保留旧草稿；撤销确认后的组织ID和grant.version未固定到开窗时。测试复现这些现状，不代表修复或批准。

资源编号目前要求复制UUID，与总纲避免手填UUID有冲突。2026-09-10用户明确确认“保留从详情页复制 UUID 的方式”，作为本页例外优先于总纲的一般建议；保持现有模式，不新增按名称选择、目录API、权限或数据规则。P16批准仅该页布局，不外推P31。

## 验证与操作

`node scripts/build-ui-phase2-roles-review.mjs --write`更新机器登记，`--check`只读核对。`node --test tests/unit/ui-phase2-roles-review.test.mjs`核对动作/输入/接线与实际源码函数；其中watch为手动调用、ref/computed为隔离替身，不是挂载Vue测试。`node scripts/verify-ui-phase2-roles-c.mjs`只读复验原48PNG及离线交互，不生成业务请求。原稿reviewNow固定为2026-08-28，不作为当前生产时钟。

未改Vue/API/OpenAPI/RBAC/MySQL/env/依赖与原图；没有新运行参数，无需重启，未部署。下一仍需精确控件与字段图、全部组合、真实C实施/异步生命周期、具体用户审核及全站宝塔验收。本批是源核对增量，不是整页或全站完成。
