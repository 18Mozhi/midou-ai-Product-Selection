# P37 组织审计 · 控件与详情 C r1

全部新视觉待审。独立子稿复用原C控制器、夹具和上一轮字段呈现，不改原142张图及两个证据清单，也不是实际Vue实现或生产验收。

[交互原型](index.html) · [172张图册](../../../../output/playwright/p37-controls-review/index.html)

## 本批范围

19个控件/变体，对应152张原生状态图和20张详情/复制反馈组合图。桌面1440px、手机390px；手机专属折叠/返回入口不伪造桌面状态。默认、悬停、键盘焦点、原生按下、适用禁用分别采图，选中与未选中记录分别验证。

| 控件 | 真实来源与边界 |
| --- | --- |
| 应用、重置 | 子组件 submitFilters / resetFilters，查询中禁用；上一轮字段验证覆盖重置清空并首读 |
| 高级条件开/合 | 子组件原生 details，不是模态窗 |
| 系统记录开/合 | systemEventsExpanded，40连接+10业务的独立测试样例 |
| 已选/未选记录 | choose(event)；选中条左侧标记与键盘焦点独立 |
| 加载更多 | loadMore函数prop，合成首50→55及精确cursor；不证明真实追加并发安全 |
| 刷新、重载 | 父级 load({background:true}) / load()，仅记录读取意图 |
| 两个复制按钮 | copy对应request/trace；成功/拒绝用内存适配器，不使用系统剪贴板 |
| 技术详情开/合 | 原生details，事件/对象/操作者/工作区/schema沿现有字段 |
| 清空搜索、手机筛选折叠、返回时间线 | 三项便捷提案，非现有子组件业务入口；折叠分开/合两变体 |

缺失ID时禁用复制是旧提案，实际Vue没有该禁用条件。原C控制器的复制归属、读取代次及已请求条件/已读事实分离也仍是提案，本批未修复生产的已知异步问题。

技能影响：沿C蓝白分区，把焦点框内收防裁切；选中标记仍保留，禁用统一灰色，技术详情维持44px点击区。只改本子稿CSS，不覆写此前待审字段图。

## 验证与使用

```powershell
node scripts/verify-ui-phase2-org-audit-controls.mjs --smoke
node scripts/verify-ui-phase2-org-audit-controls.mjs
node --test tests/unit/ui-phase2-org-audit-controls.test.mjs tests/unit/ui-phase2-org-audit-fields.test.mjs
```

首条手机430检查，完整双端802检查；源模型/函数离线复核加原生浏览器交互，不等于挂载Vue、API、MySQL、鉴权或生产。普通验证只读；`--capture`重采本批172图及清单。审核场景工具可以切换既有50场景，本批没有把它当新增业务控件。

无需环境配置或重启；未部署、没有新依赖/接口/权限/数据库改动。所有浏览器在finally关闭，不启动服务。172PNG+图册+证据为永久交付，无临时文件。P35既有颜色门失败/修复授权未解，未提交；P36和P37已有局部审批不被扩大，全73页实施及签收继续。
