# P57 C 整合 r2 · 待审

2026-09-15：实际App/Router/P57在仅供审核的C导航宿主运行。16张PNG、191份加载来源指纹；390/1440宽度×两种动效偏好，4环境72项定向检查通过。双端首屏结构已请求用户审核，待答复；不是生产导航已替换，也不是全站设计批准。

## 本次提案

复用已有C蓝色授权侧栏、手机原生菜单、白色身份栏与浅蓝工作面。移除外层旧大编号、SIGNAL LEDGER及无探针依据的固定健康字样；仅P57不重复输出外层页名，将页内标题提升为h1，并把原页内侧栏移动至标题后形成横向分区。通知域局部字体与手机范围边线改为C表达；没有修改业务脚本、权限、菜单名称/href、筛选/分页/保存/发布/取消合同。

## 先看这些图

- [桌面首屏](P57-1440-composition-first-viewport.png)
- [手机首屏](P57-390-composition-first-viewport.png)
- [手机菜单](P57-390-navigation-menu.png)
- [手机菜单无结果](P57-390-navigation-empty.png)

其余12图覆盖两端messages、reader、editor、filter、deliveries、system-facts。首屏/弹层是1000px高视口图；其他长图仍有固定导航截屏位置限制，不能据其推断实际遮挡。桌面下方未展示内容、840/841断点、其他路由、全主题、软键盘、完整无障碍、真实角色/写入/生产均待验收。

## 可复验范围

复用原通知E2E样例，登录合成与偏好503回退沿用上批；仅本地允许GET，禁止意外请求和写操作。本例10个菜单名称/目标与真实authorizedNavigation函数对同一能力样例的输出严格相等，不是全角色服务端鉴权证明。检查唯一h1/首屏位置、C字体与边线、手机模态首尾Tab/搜索无结果/Escape返回、桌面非模态，再运行原56项P57焦点/分页/字段检查。正常非提案App仍56项通过。

3项新源码不变/编译/锚点测试、2项CSS来源测试、既有共享壳层3项源变换测试通过；仅选择该3项当前源测试，旧177来源整包历史哈希测试没有作为当前通过证据。未重新执行全库测试。来源指纹含模块与本地CSS导入，不宣称穷举全部构建输入；工作区包含其他在途UI。

日常：`node scripts/verify-platform-notification-app.mjs --shell-preview`，不出图。
首次捕获：再加`--capture-review`，仅排他创建本r2目录，存在即拒绝覆盖。
无参数继续原实际App验证；原app-review-r3图片/批准保留，但驱动演进后其全部来源哈希不再匹配当前，不覆盖旧manifest。

调整提案只编辑`implementation/platform-notification-shell-preview.css`与`scripts/lib/platform-notification-shell-preview.mjs`；共享C宿主及菜单助手作为直接依赖接管，原有其他审核图/业务文件不改。未改生产源码、API/OpenAPI、环境、权限、数据库或依赖，不部署、不重启。所有测试服务/浏览器关闭；两张失败临时图已删除，本包与r1诊断图是永久交付。
