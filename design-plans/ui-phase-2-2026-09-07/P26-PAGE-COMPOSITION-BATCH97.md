# P26 实际 Vue C 组合 · 批97

## 审核范围

本批使用实际 `/notifications` 与 `NotificationCenter`，仅在本地审核层套用蓝白收件箱：通知范围标题、摘要、分类/处理状态筛选、消息目录及消息详情。

## 保留的合同

- 保留通知目录、摘要和偏好的既有读取路径。
- 详情仍使用既有 `GET /notifications/{id}`；已读消息打开详情不产生自动已读写入。
- 审核夹具仅用于展示，未改生产组件、接口、权限、数据或部署状态。

## 本地核验

`node --test tests/unit/notification-page-preview.test.mjs` 通过。

`node scripts/verify-notification-page-preview.mjs --capture-review r1` 在 1440/390 通过每组 4 项检查，生成默认和详情双端 4 张永久审核图。夹具为已读记录，因此打开详情验证为零自动写入。

## 未覆盖

未验证真实会话、RBAC、详情未读自动已读、处理动作、偏好保存、SSE、分页/异常、读屏或生产环境；本批不构成生产验收。
