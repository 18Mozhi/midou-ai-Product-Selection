# P38 控制区：实际 Vue 逐态组合

2026-09-11，起点 main / e845daca。使用 frontend-design 技能细化已选 C 方向的蓝色控制区，再用现有 Playwright/Vite 依赖验证。仅新增隔离控件样式，不修改生产组件、原 C 布局样式或原 42/16 张图。此次申请审核的是手机控件样式，不是重复申请桌面布局批准。

## 审核图

[全部 18 张图册](../../output/playwright/p38-toolbar-compositions/index.html) · [机器证据](../../output/playwright/p38-toolbar-compositions/evidence.json)

| 组合 | 手机 | 桌面 |
| --- | --- | --- |
| 普通态 | [查看](../../output/playwright/p38-toolbar-compositions/390-normal.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-normal.png) |
| 查看范围悬停 | [查看](../../output/playwright/p38-toolbar-compositions/390-range-hover.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-range-hover.png) |
| 查看范围键盘焦点 | [查看](../../output/playwright/p38-toolbar-compositions/390-range-focus.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-range-focus.png) |
| 刷新悬停 | [查看](../../output/playwright/p38-toolbar-compositions/390-refresh-hover.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-refresh-hover.png) |
| 刷新键盘焦点 | [查看](../../output/playwright/p38-toolbar-compositions/390-refresh-focus.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-refresh-focus.png) |
| 刷新按下并保留焦点 | [查看](../../output/playwright/p38-toolbar-compositions/390-refresh-pressed.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-refresh-pressed.png) |
| 读取中/禁用 | [查看](../../output/playwright/p38-toolbar-compositions/390-refresh-loading.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-refresh-loading.png) |
| 刷新失败/恢复操作 | [查看](../../output/playwright/p38-toolbar-compositions/390-refresh-failed.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-refresh-failed.png) |
| 键盘选为最近 7 天 | [查看](../../output/playwright/p38-toolbar-compositions/390-range-7d.png) | [查看](../../output/playwright/p38-toolbar-compositions/1440-range-7d.png) |

悬停使用浅蓝底；按下使用更深的浅蓝底，不再继承旧全局按钮的下移效果。白色 3px 键盘框保留在蓝色控制区内，截图保留周边 8px，避免截图裁掉焦点框。读取中仍是既有灰色按钮和原“刷新中…”文案，两控件均禁用；没有虚构进度、自动重试或新权限逻辑。按下图包含浏览器保留的键盘焦点，不能把组合态标成纯鼠标态。

## 实际验证

实际挂载 `PlatformDashboard.vue` 及现有 API client，只在随机本机端口拦截其 GET 并提供已有 E2E 样例。390/760/761/1440 四宽度各 5 组，共 20 组：44px 控件与 16px 文字、无横向溢出、原生选择框键盘焦点、悬停/按下计算颜色、按下位置不移、松开前无请求、读取中双控件禁用且不重复发请求、500 后保留数据并恢复操作、键盘选择 7d 后一次读取并保留其他 query。

普通控制区与非目标“平台事实”在打开/关闭新增样式时逐像素一致。禁用控件的全部检查样式属性完全一致，但截图在边缘重绘上存在微小差异：390/760/761/1440 分别 18/31/31/20 像素，最大通道差为 2/2/2/1；证据保留前后哈希，不宣称这四对图片字节相同。最初普通态比较夹入其他区域滚动，改为同位置连续截图后通过；禁用颜色比较增加等待既有过渡结束，未更改产品读取行为。

这不是原生下拉菜单弹出图，不是完整导航壳、MySQL、真实权限、系统剪贴板、生产构建或生产验收；每张图明确标为 vue-isolated、buildSha=null。真正 dashboard GET 会写观测与审计记录，本次替身没有访问真实后端，不混淆两者。

收尾验证：新增定向测试 3/3、UI 第二阶段测试 586/586、文档校验、设计交付审计与格式检查通过。临时对比图两张已删除，最终图册目录为 18 张 PNG 与索引/证据两文件；本轮使用的本机端口均无残留监听。生产代码未变，本轮未重复生产构建，也未部署。

```powershell
node scripts/verify-ui-phase2-platform-toolbar.mjs
node --test tests/unit/ui-phase2-platform-toolbar.test.mjs
```

加 `--capture` 仅重建此目录的 18 张审核图、索引和证据。生产不导入 `implementation/platform-overview-controls-preview.css`，现行 C 布局及既有图册不动。无新增 API/字段、环境变量、依赖或调节项，不需要更新 OpenAPI，也无需部署或重启。浏览器、剪贴板无关上下文和 Vite 在 finally 关闭；调试用两张临时对比图在收尾删除，最终仅保留永久审核材料。

## 待审核与后续

已展示手机焦点、按下和读取中三张组合并请求局部审核，未收到答复前保持 pending。不扩大为顶部布局、桌面构图、整页或全站通过。P38 其他入口/错误反馈、具体页面审核及全站部署签收仍按完整阶段计划推进。
