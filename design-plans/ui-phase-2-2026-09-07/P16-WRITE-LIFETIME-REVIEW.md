# P16 · 已销毁实例的迟到写入回执

2026-09-10，main / 63072c5b。本批处理既有J08“旧结果不能覆盖新旅程”的必要前端生命周期边界，不新增业务能力或视觉方向。

## 已复现与实际修复

执行实际SelectionJourney setup的8项永久测试，在原源码上4失败：销毁后创建成功把后来实例的活动ID覆盖为旧ID；保存成功清掉后来ID；两种失败仍修改已销毁实例的错误/忙碌状态。其余普通缓存离开及当前实例成功路径原本通过。

现新增实例内disposed标志，只在onUnmounted设置；create/decide的成功、catch和finally先排除已销毁实例。普通onDeactivated不设置disposed，仍接收当前缓存页已发请求的结果并按原规则保存续办ID，但不继续轮询。已销毁回执不更新journey/requestId/message/state、清原因或写活动ID。

这不是取消请求、撤回数据库事务或自动重试。旧请求可能已由服务端完成；新实例不接管旧回调。请求路径、body、幂等头、三个输入、五项质量门和原全局活动ID键格式都未变。

## 证据与复验

- `node --test tests/unit/ui-phase2-journey-write-lifetime.test.mjs`：8项通过，使用实际setup与Vue ref/reactive；HTTP和生命周期调度由测试边界控制，不声称真实Vue挂载。
- `node scripts/verify-ui-phase2-journey-write-lifetime.mjs`：6场景通过，真实挂载SelectionJourney、Vue KeepAlive和RouterLink；点击测试宿主的销毁/重新挂载/隐藏/显示按钮。新实例读新ID、填写新草稿后释放旧成功/失败，当前ID、草稿和页面不受影响；普通缓存隐藏仍保留结果，超过2秒不轮询，回来一次刷新。请求精确body且每场景一个POST，未登记请求与页面错误0。
- 新宿主仅存在于该验证器本地Vite插件，临时地址 `http://127.0.0.1:5175/__p16_write_lifetime/`，无磁盘测试HTML，无生产路由。strictPort拒绝占用，server/browser在finally关闭。不要把宿主切换说成真实组织或工作区切换验收。
- 原 `verify-ui-phase2-journey-vue.mjs`、`verify-ui-phase2-journey-fields.mjs` 和 `verify-ui-phase2-journey-c.mjs` 的源依赖因组件变更重验/重拍；原型函数隔离仅补disposed=false表示仍存活实例，不跳过实际源检查。8源测试与6挂载场景承担新增销毁边界，不用旧截图证明竞态修复。

## 尚未覆盖与运维

NavigationShell的reset_on_scope使用KeepAlive键；换键不一定销毁原实例，因此本批**不宣称修复所有跨范围或缓存实例之间的全局活动ID竞争**。多标签/账号/组织切换、存储异常、等待期间编辑、reset保留决策草稿和全部异步读写归属仍待专项处理，不能以销毁保护替代它们。没有冻结输入、清理用户未提交草稿或修改范围权限。

不新增环境变量、配置项、依赖、持久化格式、API/OpenAPI、数据库迁移、后端/Worker/Python变更；未连接或部署生产。正常使用不需新操作或调节参数。后续发布仍走既有宝塔部署器及其重启流程，本批未重启服务。

验证器和测试是永久回归资产；本批没有新增一次性文件/截图/日志。原审核图册保留并更新来源证据，既有被拒绝清理的历史文件不动。详细门禁与收尾结果见[实施记录](PROGRESS.md)。
