# C 方向逐页审核入口

打开 [审核工作台](review.html)，搜索页面编号（如 P16），分别查看「设计图与交互预览」和「真实 Vue 对照」。链接在新标签打开，审核台与未保存的编辑不会被导航替换。各包的范围说明优先于图片数量；共享包、分段稿不等于完整页面。

## 本次变更

审核台使用 C 方向蓝色目录、白色材料区、移动端上下排列；旧纸色、红色和衬线标题不再使用。73 路由按当前设计审计关联图册，显式登记的 P16 布局/代表按钮和字段/密度真实 Vue 图册分别展示。历史 A/B 研究折叠，不再显示已有设计“未交付”。未登记 Vue 对照只表示本入口没有关联，不断言没有实现。

P16 整体布局批准保留原范围：按钮、字段和全页验收并未自动通过。其他页面的批准、覆盖分母、G0–G5 和生产事实均未修改。本次只是本地审核工具，不是全站产品界面替换或部署。

## 使用与意见归档

1. 搜索编号、名称或路由，可叠加工作包、页面类别筛选。
2. 先看范围说明，再打开场景预览、截图图册和真实 Vue 对照，分别核对桌面/手机及具体状态。
3. 用「记录页面意见」填写图册名称、版本、场景、宽度和修改点；历史按钮/弹窗候选可单独批注，但行号和静态上界不代表当前完整业务动作。
4. 「导出审核意见」下载 `review-decisions.json`，交给实施者归档。浏览器草稿不是共享数据库；不要输入任何凭证或客户资料。

草稿继续使用原 `scoutops-phase2-review:<历史清单 fingerprint>` 键；导出仍是 schemaVersion 1 的 sourceFingerprint/exportedAt/notes，未增删持久化字段。旧意见保留，不自动迁移为新图批准。审核工具只有修改/澄清意见入口，正式批准仍需用户对具体范围明确确认。

## 更新与验证

使用已有依赖，在仓库根目录依次运行：

```powershell
node scripts/audit-ui-phase2-design-delivery.mjs --write
node scripts/build-ui-phase2-review-evidence.mjs --write
node scripts/build-ui-phase2-review-evidence.mjs --check
node scripts/verify-ui-phase2-review.mjs --capture
node scripts/verify-ui-phase2-review.mjs
```

先运行完整源/截图审计，再生成入口，不能只刷新索引冒充新源验证。生成器读取审计及显式动作登记表、校验关联路径存在和包清单指纹，拒绝审计已报告的漂移；`--check` 为只读校验。新增的 `review-evidence.js` 是生成的静态关联数据，不改历史 `review-data.js`，也不改批准注册。

验证器只服务五个固定审核文件，随机 localhost 端口，不暴露仓库、凭证或产品 API。验证73页关联、P16双册/P26未登记提示、历史意见保留、筛选、分页、模态焦点/Escape、文本安全、原格式导出和双端无横溢出/44px目标；捕获的两张 `review-proof` PNG 与 manifest 是永久审核工具交付证据，不计作新增业务页图。隔离批注和下载用后删除，浏览器与 HTTP 服务在 finally 关闭。

本次没有生产代码、API/OpenAPI、数据库、环境变量、依赖或权限修改；无需重启。生产发布仍由项目指定宝塔部署器另行执行，不部署本地审核资产。
