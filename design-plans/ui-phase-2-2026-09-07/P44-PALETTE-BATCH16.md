# P44 手机局部色板接管 · 批次 16

状态：等值样式整理，保留此前目录、比较控件、结果和角色资料的局部批准；不扩大为整页、完整交互、真实权限或生产验收。全 73 页实现目标继续。

## 范围与依据

依据既有接管授权，接管 `PlatformAdminComparisonMobile.css`、`PlatformAdminDirectoryMobile.css` 的在途颜色提取，以及它们共同导入的 `platform-admin-mobile-tokens.css`。共 11 个局部颜色角色，仍只在 signal-ledger、当前 `/platform-admin/admins` 标签和不超过 760px 的原有边界生效。

本批没有重新设计已批准区域。新增永久回归把两个文件移除导入、展开变量后的完整 LF 文本，与 `bbde542c` 中原 CSS 的 SHA-256 精确比较；不是只抽查颜色，也不以历史截图代替当前源码检查。选择器、间距、布局、字体、焦点、禁用样式和其他声明全部保持原值。反向变异覆盖颜色、断点、路由范围、非变量声明、布局和未知变量，防止检查误放行。

## 验证

- `node --test tests/unit/ui-phase2-admin-mobile-palette-equivalence.test.mjs`：4 项通过，直接依赖现有 PostCSS，无新增依赖。
- 工作区既有 `node scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs`：110 项通过。
- 工作区既有 `node scripts/verify-ui-phase2-admin-mobile-directory-implementation.mjs`：134 项通过，含目录样式、详情入口和回到目录。
- 两个浏览器回归均使用实际 Vue 父组件、本地只读 HTTP 样例、390/760/761/1440 宽度及 admins/permissions 两路由；各自页面错误与意外请求均为零。它们不是完整 App、真机触控、读屏或真实服务验收。未传 capture 参数，两次均为 0 张新图，不修改历史清单与图片。
- `npm run build:web`（含 Vue 类型检查）、253 资源前端预算及本批源码格式检查通过。

两个既有浏览器驱动及其历史捕获辅助仍属于其他在途工作包，本批不整体暂存，也不宣称其历史图包已重新绑定当前版本。可独立提交的新增回归是上面的等值与范围测试。

## 使用与运维边界

使用方式不变。局部颜色维护入口是 `apps/web/src/design/platform-admin-mobile-tokens.css`；本次只是提取既有值，不建议现在调色。以后改值会使等值回归失败，需走明确的设计变更和审核，不能直接刷新指纹。

没有修改 Vue 模板/脚本、业务规则、API/OpenAPI、服务端权限、环境变量、数据库、依赖或部署配置，相关生产者/消费者无需同步。没有部署或重启；正式前端变化需随后续获准的本地构建包发布，本批未证明生产更新。

临时浏览器及 58501/58658 本地服务均由驱动 finally 关闭；未创建新的截图、日志、一次性脚本或导出材料。保留项目常规构建输出，不删除依赖缓存。此前清理受阻的临时目录保持原边界，不重试删除。其他在途改动不纳入本批。
