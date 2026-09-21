# P58 · 创建窗键盘边界验证

## 本批改动

在 [双结果预览](P58-CREATE-OUTCOME-VUE-REVIEW.md) 上仅增加创建 dialog 的 keydown 和一个局部
函数，没有修改布局、样式、共享 useModalDialog 或生产 CommercialOperationsCenter。
采用 ui-skills-root / fixing-accessibility，修正 Tab 边界与等待状态焦点可见性。

本包 baseline 是上一版 C 预览，不是未经转换的生产页面；review 只多本轮键盘函数。
移除该函数及唯一事件绑定后，整个文件逐字等于前一版预览。

- 普通 Tab 保留原生顺序；首尾边界才进行双向循环。
- 候选每次从当前 DOM 读取，排除负 tabindex、原生 disabled、hidden/inert/aria-hidden、
  不可见及折叠 details 内部内容；打开追踪后复制按钮加入顺序，重新折叠后跳过。
- 没有可操作控件时，Tab/Shift+Tab 留在持续标题，并将标题滚入窗内可见位置。
- Ctrl/Alt/Meta 修饰键、组合输入、非 Tab、已处理事件、非打开的原生模态不拦截。
- 原生初始焦点实测为标题 H3，关闭后回原入口；不强行改成关闭按钮。

## 证据

[键盘验证图册](../../output/playwright/p58-create-focus-review/index.html) /
[机器证据](../../output/playwright/p58-create-focus-review/evidence.json)。

390/760/1440 × baseline/review 共 6 组、597 检查、30 PNG、168 原始源指纹；
P58 四组提案联合 17 项单测通过。默认 10 个、错误追踪折叠 11 个、展开 12 个可顺序访问
控件分别执行两轮正向和两轮反向；使用独立的实际控件定位序列核对，不以被测函数自己的候选列表
作为判定答案。等待时十个表单控件禁用，重复按键仍留在可见标题，Escape 仍受前版等待保护。

基线正向末端经过 BODY，反向经过 DIALOG；等待时 Tab 也会落在 DIALOG。review 首尾直接到
目标按钮，等待时留在 H3。展开/再折叠追踪、原生关闭/重开和取消返焦均单独核对。
每组只有一次 commercial GET 和一次本地 409 POST；不复制编号、不发生真实创建或外网请求。

首轮错误地预期初始焦点为关闭按钮；实际 C 预览标题已带 tabindex=-1，浏览器初焦点为 H3，
修正为保留真实默认。随后图像比较发现“焦点在标题但视口仍在表单底部”，因此增加显式滚入
可见区域及浏览器可见性检查，而不是仅满足 document.activeElement。

初始三宽度图对要求字节一致，证明同状态外观未变；键盘操作后的截图可能因滚动、焦点与栅格化
不同，不能要求所有图片哈希一致或据此宣称所有交互状态无视觉差异。早期目检与逐像素只读检查
还发现个别非等待图有 1–75 个像素、最大通道差 2–8 的细微差异，未用扩大像素容差掩盖等待滚动
缺陷；正式门禁改为同初始状态精确比较，加独立的每步焦点与可见性断言。

## 边界与复验

本轮不重复请求同布局视觉批准；此前创建布局、拒绝反馈及双结果组合仍按各自审核状态处理。
这里只验证 P58 创建窗的上述键盘路径，不等于编辑/确认窗、读屏、软键盘、跨路由/缓存、
未知写入结果、完整无障碍、整页或生产验收。原成功后的表单重置和迟到结果归属仍未重构。

生成：`node scripts/verify-ui-phase2-commercial-create-focus.mjs --capture`。
定向：`node --test tests/unit/ui-phase2-commercial-create-focus-review.test.mjs`。
联合回归包含此前 create-review、create-write-review、create-outcome-review 三份单测。

API、权限、后端、Worker/Python、OpenAPI、env、数据库、依赖和全局配置均未改，无重启要求。
全库既有门禁和全 73 页目标继续开放，本批未提交/未部署，commit hash 不适用。
正式 PNG/JSON/HTML 是交付物保留；未创建临时脚本/日志，失败中间图由完整复跑覆盖。
Vite/Chromium 通过 finally 关闭，5173 不保留服务；以最终 manifest 校验目录没有多余截图。
