# P47 首次读取失败 · 当前 Vue 区域复核

2026-09-12。新建当前审核包，保留原 `p47-read-error-review` 的 30 张图、机器证据、
原运行器及原审核 CSS/属性变换器。当前复核不是旧包的源码哈希替换，也不是生产实现。

## 展示内容及范围

标题保持“暂时未能读取采集状态”，说明保持“这次读取未完成。你可以重新读取，
获取最新状态。”沿用现有“重新读取状态”按钮与蓝色焦点、可见关联编号。
这是只读 GET 失败提示，不再使用默认状态组件的写入结果措辞。

新审核 CSS 导入原 CSS，只把该错误区域的 `dt` 标签从 12px 提高到项目辅助文字
下限 13px。选择器限定审核 body、P47 活动页面、error 状态及 dt；其他状态不匹配。
没有改标题、说明、错误分类、重读事件、编号过滤、API 重试或任何生产脚本/样式。
此处依照 baseline-ui 的现有组件与颜色复用原则，不建立新状态组件或新增视觉风格。

## 独立当前图册

- [当前 30 图](../../output/playwright/p47-read-error-current-review/index.html)
- [手机普通失败](../../output/playwright/p47-read-error-current-review/review-390-error.png)
- [手机长编号](../../output/playwright/p47-read-error-current-review/review-390-long-id.png)
- [当前机器证据](../../output/playwright/p47-read-error-current-review/evidence.json)
- [原审核记录](P47-READ-ERROR-REVIEW.md)

新包中的 `baseline` 指当前未变换 App，`review` 指同一当前 App 加两个错误展示属性
及审核 CSS，不指恢复到历史提交。两者都是实际 Vue；仅本地测试接口，不访问真实
生产 API、权限、MySQL 或外部探针。图像直接截取状态区域，不是整页截图或图片编辑。
`userReview=pending`，不继承 P47 默认布局、成功反馈、两空态的局部批准。

## 验证

1. 未截图预检 30 组、348 项通过；发现原标签 12px 后在新审核样式补足 13px。
2. 完整捕获覆盖 390/760/1440、当前原页面/审核页面各 5 种情况：409 普通错误、
   500 无编号、409 长编号、403 权限拒绝、503 依赖受阻。30 组、357 项检查通过。
3. 检查现有错误播报、无虚构指标、编号存在/缺省/长内容、44px 重读热区、键盘焦点、
   Enter 重试、恢复两条原测试记录、无页面/面板横向溢出、无写请求/请求体或意外网络。
   503 仍先经历 3 次既有 GET 尝试，再由用户显式重读加 1 次；其他情况首次 1 次。
4. Date 固定到测试时刻但不停止计时器；不改变生产时间或重试策略。
5. 176 个当前原始源码指纹含 wrapper、原运行器、两个审核 CSS、属性变换器、实际
   App 及递归导入的生产调色板。递归扫描限定生产源码；审核 CSS 的唯一原稿导入
   由单测精确限定，并显式登记两份审核 CSS，不放宽生产导入的路径边界。
6. 六对权限/依赖受阻相邻图尺寸相同；五对像素完全相同，390px 受阻图有 4 个像素
   差异、最大通道差 1。保留原有最多 8 像素/1 色阶阈值，未将该对写为零差异。
7. 相关单测 12/12：当前图包每个源/PNG 指纹、原包与原运行器不变、审核变换及
   唯一 13px 覆盖、生产 P47 原脚本/六模型/样式/缓存焦点合同、导入路径边界均通过。

原来失败的当前源码绑定已由新的实际运行包验证，不再把旧图的捕获源说成当前源。
同时新增原包不可变检查。其余全库失败未在本轮修复或豁免；最近全库结果仍以
`PLATFORM-CONTRACT-TEST-REVIEW.md` 的 1311/1122/189 为上一次完整运行记录，
不能据本批窄检查推算全库已通过或最新失败总数。

## 使用、签收及收尾

```powershell
# 无图最小检查；不修改正式产物
node scripts/verify-ui-phase2-provider-adapter-read-error-current.mjs
# 独立当前图与机器证据；不覆盖原图包
node scripts/verify-ui-phase2-provider-adapter-read-error-current.mjs --capture
node --test tests/unit/ui-phase2-provider-adapter-read-error.test.mjs tests/unit/ui-phase2-provider-adapters-c.test.mjs tests/unit/ui-imported-style-sources.test.mjs
```

只支持原有 `--capture`，没有新增生产配置、环境变量、依赖或接口。新 wrapper 对
原运行器 SHA 精确锁定；若运行器变化必须重新检查，不允许忽略该保护继续生成证据。
正式图册保留，浏览器/临时 Vite 服务由 finally 关闭；无临时脚本或临时截图。
未修改 `.env`、OpenAPI、数据库、权限、后端/Worker/Python 消费方，无需生产重启。
未提交、未部署，commit hash 不适用。等待这两张区域的具体审核，仍不代表其他
状态、完整无障碍、整页或真实生产签收；全 73 页目标继续。
