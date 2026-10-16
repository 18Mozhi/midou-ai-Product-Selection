# 2026-10-16 工作台重构当前动作接续

本表只登记真实源码动作与指纹，不提升任何旧截图或旧审批状态。旧侧栏上下文 disclosure（827ec3c5575d94f5.1）已随布局移除；新上下文切换为既有选择页导航。

| 当前源码候选 | 当前行 | 类型 | 语义 |
| --- | --- | --- | --- |
| apps/web/src/components/SessionLogout.vue#aa629abb6bb8b953.1 | 30 | control | SESSION-LOGOUT / POST /auth/logout，成功或401后整页进入登录；失败保留页面，显式重试沿用幂等键 |

| 当前文件 | 当前 LF SHA-256 |
| --- | --- |
| apps/web/src/components/HomeDashboard.vue | 0161f338f31f909cf116f0e11e116ec2b1e6e74e78d4d201a40364e904773355 |
| apps/web/src/components/NavigationShell.vue | 596cef4389d9ecf77b4eb433d0954031880a962ec0346c9455cc0c4790c5f933 |
| apps/web/src/components/SessionLogout.vue | f1cbe6a7186e657b864f18ae3e71860aa3dd8e0e3d4e5293b37fe1acba1caf7a |
