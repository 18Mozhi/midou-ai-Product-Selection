# P58 · 创建成功与目录核对双结果审核

## 范围与原因

承接 [创建窗](P58-CREATE-VUE-REVIEW.md) 和 [等待/拒绝反馈](P58-CREATE-WRITE-VUE-REVIEW.md)，
新增独立实际 Vue 审核层。此前两组具体视觉仍待答复；本批不默认通过，也不修改生产组件。

真实 createPlan 在 POST 成功后 await load；load 内部捕获读取错误而不抛出，随后 createPlan
覆盖成功 notice，并把 requestId 恢复为创建编号。结果是目录仍旧，但读取错误被覆盖。
执行当前源码的定向检查复现了该现象，而非仅从图推测。

提案使用深蓝“创建结果”和白色“目录核对”双区，手机上下、桌面左右：

- 创建已完成、身份、尚未启用与无需重复创建独立保留。
- 目录读取中、完成、失败分开显示；失败保留原 action_hint 并说明下方为上次成功内容。
- “重新读取当前目录”仅调用既有 GET，不重新 POST；等待时禁用并将键盘焦点留在持续标题。
- 创建追踪与本次目录读取追踪分别保存；读取错误不再配上创建编号。原页面 notice 继续存在，
  不隐藏其他全局提示；本批局部图不代表整个页面布局已经整合。

使用 ui-skills-root / fixing-accessibility 处理动态反馈、禁用说明和重读焦点。局部结果区
显式使用与创建窗一致的无衬线字体，不沿用旧标题字体；全局主题及共享导航未改。

## 图与证据

[正式图册](../../output/playwright/p58-create-outcome-review/index.html) /
[证据清单](../../output/playwright/p58-create-outcome-review/evidence.json)。

baseline/review × 390/760/1440 × 正常读取/409/403/503，24 组实际 App 运行，
444 检查、66 PNG、167 原始源指纹。24 次 POST 与 78 次 commercial GET 全为本地模拟；
P58 三组提案联合 13 项单测通过，文档门禁与相关代码格式检查通过。
初始数据与导航提取自现有 M06-06 E2E；POST 返回本地模拟 201，随后目录回复为明确合成的草稿
记录，不能当作真实 MySQL 写入。服务端现有创建返回 id/status/version 的合同未变。

浏览器覆盖创建后尚在读取、读取结果、两类追踪展开、人工重读中及重读完成；保留原版错误被
成功提示覆盖的反例。503 按原 api-client 三次 GET 尝试验证，409/403 不增加安全重试。
所有重读保持原查询参数，所有场景每组仅一次 POST；没有未知外网或真实创建请求。

初次截图暴露真实固定导航遮挡，未隐藏导航或修改页面尺寸。截图器按顶部主导航、桌面第二层
导航与手机底部导航的真实位置滚动；在截图前检查边界及四角 elementFromPoint 归属。
正式截图必须完整可见才写入成功证据；旧遮挡中间图由完整复跑覆盖。

永久检查覆盖 Vue 编译、窗外模板和原样式不变、除 load/createPlan 外的原函数逐字不变、原 POST
调用表达式不变、真实 create/load 执行反例、只读重试 guard、被替换回执不结算、CSS 隔离和全量
源/图片指纹。先前 24 图、42 图及对应测试保持不变，不改原 COMMERCIAL-C-r1 的 192 图。

## 仍未完成

这是独立预览，不是生产修复或本页验收。没有完成未知 POST 结果、并发请求编号归属、缓存
离页/返回、旧成功关闭新窗、旧读取覆盖新范围、创建结束后重置新草稿等生命周期重构。
原成功后的表单重置位置保留，不能据本批双结果宣称旧新窗口隔离已经完成。

仅测试本次目录核对；“目录读取完成”不等于确定找到新草稿、不等于方案已启用或组织已分配。
真实权限拒绝策略、MySQL/事务/幂等/审计、读屏/软键盘、全部按钮、复制和整页设计仍待。
未修改 API/OpenAPI、后端、Worker/Python、SQL、env、依赖或部署配置，无重启要求。
全库既有失败与全 73 页交付继续开放，不能用本批局部通过替代发布门禁。

## 使用与收尾

生成：`node scripts/verify-ui-phase2-commercial-create-outcome.mjs --capture`。
定向：`node --test tests/unit/ui-phase2-commercial-create-outcome-review.test.mjs`。
联合回归另含 `ui-phase2-commercial-create-review.test.mjs` 与
`ui-phase2-commercial-create-write-review.test.mjs`。

图册为正式交付物保留；无临时脚本、测试数据文件或日志。Vite/Chromium 在 finally 关闭，
5173 不保留后台服务。生产未改、未部署；全库门禁尚未通过，本批未提交，commit hash 不适用。
