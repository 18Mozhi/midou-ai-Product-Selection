# P36 一次性明文组合 · 实际 Vue 与 C 审核稿

起点 `main/2e96ee31`，工作树干净。上一批完成复制反馈归属修复，本批继续未审的一次性明文区域。不是生产布局修改，不把手机筛选局部批准扩为明文或创建组合批准。

[48 张状态图册](../../output/playwright/p36-secret-vue-preview/index.html) · [手机默认](../../output/playwright/p36-secret-vue-preview/390-default.png) · [桌面默认](../../output/playwright/p36-secret-vue-preview/1440-default.png) · [全部证据](../../output/playwright/p36-secret-vue-preview/evidence.json)

## 设计与审核范围

`frontend-design` 用于把原单块提示重组为 C 方向的蓝色说明区和白色明文/操作区。桌面蓝色说明在左，手机移到顶部；明文完整换行且可手动选择，不做截断、模糊、默认隐藏或新增下载。主操作是蓝色“复制明文”，确认保存为白色描边按钮；手机纵向排列且保持原 DOM 顺序，两个动作均至少 44px。

标题改为“请保存令牌明文”，上方明确“仅本次响应可见”，保留“离开本页即清除”；补充“确认已保存后，当前页面将清除明文”，解释原 dismiss 行为，不新增清除系统剪贴板、自动保存或安全承诺。成功与失败仍使用原真实文案，并分别着色，颜色不是唯一提示。

只向用户提交 **390px 默认组合** 的局部审核。桌面、按钮 hover/focus/pressed、失败、等待、长文本等图尚未因此获批，之前创建组合也仍待答。所有图使用无效合成值和测试 HTTP，不是有效凭据或生产权限验收。

## 源码与行为边界

`scripts/lib/ui-phase2-token-secret-preview.mjs` 用 Vue AST 定位唯一 `.org-token-secret`，保留完整 scriptSetup、v-if、两个 click、原 `role=status` 表达式及其他全部字段/按钮。只调整该区结构/说明，新增 data-copy-state 供颜色选择。所有生产 Vue/CSS 和旧图保持不变。

`implementation/token-secret-preview.css` 仅审核宿主引入；加载主入口 CSS 与组织管理 CSS，以实际父 `OrganizationAdminCenter` 和子组件渲染，不是复制源码生成静态假交互。没有创建依赖、增加生产服务、修改 OpenAPI、环境、数据库或权限规则。

## 实际浏览器验证

复用本地 Vite/Playwright，390×640、760×1000、761×1000、1440×1000 四档；160 项检查、38 项源码指纹、12 状态 × 4 宽度 = 48 PNG：

- 创建后父级重读期间、默认、复制焦点、保存焦点、两个按钮各 hover/pressed、复制等待、成功、失败、长值替换。
- 实际父 POST 返回测试 secret 后重读；等待期间两个明文按钮继续可用，原行为未额外禁用。复制没有原生 loading 状态，等待图不伪造禁用、超时或成功。
- 实际 Tab 到复制和保存，蓝色 focus-visible；窄视口 hover/pressed 使用鼠标，不宣称手机触屏 hover 或软键盘验证。首次程序 focus 不触发键盘轮廓，验证器改为真实 Shift+Tab/Tab 后通过。
- 两次显式创建保持原路径、name/scopes/ttl_days/reason 和 Idempotency-Key；初始及两次成功后各两 GET，共六 GET。所有请求拦截，不发真实 POST。
- 模拟复制成功/失败保留原文案，手动选择返回完整初始/长值；新一次创建清除旧 secret，旧复制完成不污染新反馈。点击“我已安全保存”走真实父 dismiss，迟到失败不恢复区域。
- 无横向溢出、外部/非预期 API 请求、浏览器错误或 storage；系统剪贴板未触碰。未验证轮换请求、真实密钥长度策略、App 壳层、真实授权/存储、跨组织、主题/密度、原生缩放或生产签收。

## 使用与收尾

```powershell
node scripts/verify-ui-phase2-token-secret-preview.mjs
node --test tests/unit/ui-phase2-token-secret-preview.test.mjs
# 仅明确重建本批图片时添加 --capture，普通复测不写图。
```

48 PNG、index/evidence 是保留的交付物。首轮中断的两个同名截图已由完整成功回放覆盖，没有额外临时文件。宿主/浏览器均 finally 关闭，端口56814/56842结束；无需生产重启或新配置，本批未部署。

最终验证：4 项新增定向单测、683 项相关 UI/归属/组件边界回归全部通过；73 路由与 153 必需文档、样式门和 diff 空白检查通过。102 图包/15069 原 PNG 审计无漂移，本批 48 图另行绑定，不增加已批准页面计数。生产源码/配置/依赖未变，复用上一批有效生产构建结果，不重复构建。

完整全73页 C 实施、逐项审核、实际权限/生命周期及宝塔交付继续；不得用本批检查数或图数代替整页完成。
