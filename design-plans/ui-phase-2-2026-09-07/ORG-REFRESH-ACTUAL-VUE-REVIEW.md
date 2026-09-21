# 组织概览 · 刷新状态实际 Vue 审核 r1

2026-09-13，待审核。本批不扩大组织概览 r2、P47 空态或其他局部批准。

## 本批交付

[14 张图册](../../output/playwright/org-refresh-vue-c-r1/index.html) / [机器证据](../../output/playwright/org-refresh-vue-c-r1/evidence.json)。原页与新稿各 390/1440 两宽度，共 4 组、96 项页面检查、176 来源 SHA。原页捕获等待/失败各两宽度4张；新稿捕获等待、失败、展开追踪、再次读取等待、恢复各两宽度10张。

使用实际 App / Router / NavigationShell / OrganizationAdminCenter，原 M06-01 组织 guard、summary、profile、workspaces 测试样例。56 次 GET、无请求体、无写入/意外网络/运行异常。只让本地 summary 请求返回一次 HTTP 500（有 request/trace ID，无 error 详情），验证真实客户端回退文案；500 不在原安全重试集合中，单次调用保持一次请求。其他两个组织读取同批等待，释放后使用原样例。

## 实际发现与局部处理

- 原页双端通过键盘刷新后，禁用按钮导致 activeElement 为 BODY。新审核稿在原 load 执行前，仅当触发按钮自身拥有焦点时移到同一标题；标题持续存在，白色可见焦点，防止重复 Enter 再发请求。非焦点按钮触发时保持用户当前位置；不拦截原 load。
- 刷新中保留六项事实和未保存草稿，展示原“正在刷新…”禁用按钮；原时间文字增加 status/polite 语义。
- 失败保留原页面与草稿，原错误文案不改；编号从同行改为原生 details 折叠。浅蓝区域用于可恢复的读取反馈，不声称后台操作成功。
- 点击原刷新入口重新读取，原 load 清除旧提示；成功后仍无“已保存/已审计”声明。
- 使用 frontend-design 统一反馈区域，fixing-accessibility 限定焦点、原生 disclosure、44px 标题点击区；复用项目 Playwright/Vite 驱动，无新增依赖。

## 明确未变与待决定

新增 helper 在既有 r2 变换之后做 5 个唯一锚点替换。逆向后逐字等于 r2，script 删除焦点包装函数后逐字等于当前原始组件；原 load、readView、submit、HTTP 映射、自动重试、原因约束、权限/API/持久化格式不变。生产 Vue 和 r2 驱动/CSS/20 图/manifest 均未改。

重要：实际代码在刷新成功时用服务端 profile 重新填充整个 form，**覆盖未保存草稿**。等待和普通500失败不会覆盖。对照测试已在新旧两模式复现；本批保留此策略，不将它当作用户已同意的新交互。是否改成有草稿先确认，仍需产品决策，不提前实施。

未覆盖：首次读取失败、401/403 后撤下内容、429/网络重试、多个请求乱序、保存、其他组织页、其他主题/角色、真实后端和生产。主题偏好读取仍显式本地500回退，不算同步验证。status 语义与 DOM 验证不等于完整读屏实测。

## 验证与复用

- 定向：唯一锚点逆向、Vue script/template 编译、原 load 一次调用、焦点所属/连接/inert 三轴 8 种组合、审核 CSS 限定通过。
- 双端 smoke 52 检查；新旧对照捕获 96 检查，14 PNG 与176来源指纹完整校验。旧原页 BODY 焦点与新稿 H2 焦点均有机器证据。
- 原组织 r2 的3项来源/图证测试仍通过，证明原审核包未被本批覆盖。
- 最终本批4项、组织r2 3项、平台壳4项、成员/P16 4项、访问状态5项、M02-03 9项，共29/29通过；route-artifacts 73路由、文档153必需文件、runtime-docs、Prettier、定向diff检查通过。
- 运行 `node scripts/verify-ui-phase2-org-refresh-vue-c.mjs --smoke` 做双端无图，无参数做新旧四组无图。`--capture` 只创建独占新目录；已有r1拒绝覆盖。
- 本轮不重跑全库，不推算新全库失败数；上一全库 1499/1352/147 仍是历史快照，全73页/发布门尚未完成。

## 收尾

本轮无一次性临时文件；14图与图册为永久审核交付。Vite/Chromium finally关闭，端口60250、60433、60458收尾监听为0；暂存区为空。无生产修改，不需重启，无部署。

此前清理受阻目录仍保留且不绕过删除限制：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

起点main/af239b08b69f7d97cd0372f9840a70009eeef0c7，528条已有改动。混合工作区与全库失败门未解除，暂不提交部署，不暂存其他改动；commit hash不适用。
