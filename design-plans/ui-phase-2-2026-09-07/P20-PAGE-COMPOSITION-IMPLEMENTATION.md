# P20 竞品监控规则 C 方向生产实施

## 范围

本批将蓝白规则台账迁移到真实 `/competitors/monitoring-rules` 与 `CompetitorMonitor(mode="rules")`：规则就绪、作用范围、触发条件、版本和生效状态。

## 保留运行合同

- 保留先读 `GET /competitors`、再读 `GET /competitor-monitor-rules` 的真实路径。
- `enabled` 与非 `enabled` 状态继续分别显示“已生效”和“已停用”；全局规则明确显示“工作区全部竞品”。
- 只有 `competitor:manage` 可看到创建入口；本批不补造编辑、删除、启停或批量操作。
- 价格规则继续沿用当前选中快照的既有币种显示逻辑，不推断跨对象或全局币种正确性。

## 实施内容

- 启用 `competitor-monitor--review` 作用域，重构准备度提示、规则标题、规则台账、空态与失败态。
- 统一蓝色标题、白色/浅蓝工作区、44px 控件、键盘焦点和手机单列排列。
- 保留真实数据绑定、读取顺序、能力判断和创建窗，不新增 API 或权限规则。

## 验证

- `node --test tests/unit/competitor-rules-page-preview.test.mjs`：2/2 通过。
- `node scripts/verify-competitor-rules-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 共 36 项检查，0 次写入，6 张截图。
- 类型检查、格式检查、生产构建、发布归属校验和宝塔部署在本批提交前完成。

## 未覆盖边界

本批不等同于新建表单、指定竞品/库存变体、真实权限、规则写入、屏幕阅读器/真机验收或正式 M07-03 证据。
