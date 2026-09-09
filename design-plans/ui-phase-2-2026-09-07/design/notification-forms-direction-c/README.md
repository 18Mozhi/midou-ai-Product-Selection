# P26 通知偏好字段与页级诊断 · C 方向待审

打开[交互稿](index.html)或[70张双端图册](gallery.html)。NOTIFICATION-FORMS-C-r1，独立提案，不是生产实现或用户批准。

## 范围与图数

四个可编辑checkbox的默认、键盘焦点、关闭、等待中可编辑，加上邮件禁用：17场景34图。偏好原始值、全关、等待、失败、冲突五个窗口场景10图。五类页级错误的折叠/展开及代表入口真实悬停/焦点/按下：13场景26图。总计35场景，1440×1000与390×844共70PNG。

图册按目标滚动后截取当前视口，偏好长窗的页脚场景不是完整长截图。现有[基础98图](../notification-direction-c/README.md)、[提交60图](../notification-controls-direction-c/README.md)和[导航240图](../notification-navigation-direction-c/README.md)不改。

## 字段与错误设计

继续使用现有C蓝目录/白色阅读区域与原生偏好dialog。每个字段保留标签，增加独立的说明关联和整行键盘焦点；禁用邮件用文字、虚线和原生disabled共同表达，不能仅凭灰色。四个可编辑开关全部关闭合法，不新增必填、至少选一项、系统事件、邮件Provider或免打扰字段。

保存错误/冲突在窗内保留，form通过aria-describedby关联反馈；这是表单级错误，不把每个合法布尔字段标成invalid。等待期间字段仍可编辑、取消仍可关闭，符合当前源行为；已发意图的body保持原快照。取消后重开保留本地草稿。没有伪造保存成功。

页级诊断使用原生details/summary：简短行动提示在前，合成请求编号在折叠区，明确区别通知编号、来源编号和根因键。当前源码只有notice且requestId时才显示这类折叠区；此稿只覆盖有编号的五种失败，不补造无编号的来源事实。

## 来源与验证

`scripts/lib/ui-phase2-notification-forms-data.mjs`以Vue AST核对五个v-model及原生type/disabled/required约束；用真实api-client.ts加NotificationCenter.api隔离执行500/403/401/429/409合成响应。提示取实际fallback，P26-REVIEW编号明确合成，429实际进行三次惰性重试，计时替身立即执行；没有网络或真实等待证明。

运行 `node scripts/verify-ui-phase2-notification-forms-c.mjs --smoke` 做38项双端检查；`--capture`生成70图和指纹；无参数复验。data.js是可独立打开审核稿所需的永久生成数据。检查标签/说明、焦点、原生关闭/勾选、全关提交精确body、草稿保留、事实不变、点击命中及目标完整可见。浏览器HTTP/存储写入/页面错误为0，finally关闭浏览器，不启动服务。

## 限制与后续

[源码审核记录](../../NOTIFICATION-SEMANTIC-REVIEW.md)中的旧meta/error、read/workflow回执和偏好刷新/窗口归属问题仍未修。本批字段图不替代真实Vue、SSE、API、数据库、角色、主题/密度或生产验收，也不证明全部无障碍标准通过。表单没有新增业务规则；无需配置、迁移、部署或重启。
