# P44 管理员详情：当前预览重放与历史图证

2026-09-13。承接第二阶段详情状态验证；不将预览、旧图或局部批准扩展为整页/真实权限/
生产验收。Playwright技能用于本地浏览器验证，复用仓库现有驱动和依赖，不安装新CLI。

## 实际问题与处理

首次详情测试4项：3通过、1失败。原94图的46份来源有7处变化：比较/目录CSS、两个共享
响应式浮层、signal-ledger、onboarding-navigation、use-modal-dialog。不能只更新颜色SHA
而忽略共享弹窗逻辑变化。当前源上的提案编译与原动作/模板合同仍通过，但不能替代浏览器。

只读核对固定提交42909c61bc24b99f88ec9f8a0872a047fbac98b4：原46份来源逐份匹配原清单，
完整manifest SHA为bdcf8541278ad46e9fc55cf8154f1e6e7a6c0f6b7398a69bbbac9ebb25f86708，
磁盘清单也与该版本完全相同。历史读取器新增单一detail-preview阶段，原七阶段不变。
详情测试明确核对历史来源、四个原提案助手、原变换哈希与94图/尺寸/精确文件清单；
当前模板和动作保护仍读取原始当前组件。保留待审标记、只读请求与全部既有状态断言，
不删除或重写任何原图/清单。未登记文件/图片负例覆盖新详情阶段。

## 当前浏览器验证

复用`node scripts/verify-ui-phase2-admin-detail-preview.mjs`，不传`--capture`，原驱动未改。
它把当前真实Vue脚本保留在待审C组合中，**不是未变换生产App**。本次实际390/760/761/1440
四宽度全部通过，747项检查、0新图，来源计数46；端口51305结束后无监听、无该驱动进程。

覆盖正常、密码/MFA待完成及组合、停用、全角色/无角色、长邮箱，核对当前所选管理员身份、
角色按钮、恢复按钮提案、空组织/会话、读取等待/失败/重试、Escape关闭、键盘关闭焦点，
390×568短屏底部可达与横向溢出。API只在本地被拦截，未知或非GET请求拒绝，未执行真实写入。
仍不包含生产App/NavigationShell/KeepAlive、数据库、真实MFA/RBAC、账号写入或整页验收。

46是原驱动登记的来源计数；该驱动尚未递归登记PostCSS折入的CSS导入，不能把它称为
当前完整依赖清单。此次不覆盖旧图、不生成新来源manifest，也不拿旧94图冒充当前截图。
其他P44当前图包的调色板原文校验继续独立运行。

## 测试、使用与边界

- 最小详情/历史读取器6项通过，11305.3605ms；三文件格式化后，七文件关联35项全通过，
  25127.6315ms，包含此前目录、控件、结果、资料及当前颜色图证，原阶段保持有效。
- 本轮仅测试历史关联修改，原产品/驱动/样式/依赖均未改；以上关联全测与当前浏览器
  重放对应改动风险，不重复无关全库、构建或截图。
- 最近全库仍是上一批1451项1296过/155失败的快照（当时失败清单截断），不重算、不宣称
  现全库通过。全73页目标、其他状态与生产验收仍继续；未提交部署，commit hash不适用。
- 收尾文档153文件/73路由/60受保护/6角色、运行说明、相关格式/diff及审核索引check通过；
  索引406图与原3历史包差异标记不变。工作区473项变更，暂存为空；51305与驱动均已退出。

```text
node scripts/verify-ui-phase2-admin-detail-preview.mjs
node --test tests/unit/ui-phase2-admin-detail-preview.test.mjs tests/unit/ui-phase2-admin-historical-capture.test.mjs tests/unit/ui-phase2-admin-mobile-controls-implementation.test.mjs tests/unit/ui-phase2-admin-mobile-directory-implementation.test.mjs tests/unit/ui-phase2-admin-mobile-results-implementation.test.mjs tests/unit/ui-phase2-admin-mobile-role-facts-implementation.test.mjs tests/unit/ui-current-palette-evidence.test.mjs
```

查看原详情图使用`output/playwright/p44-admin-detail-vue-preview/index.html`；这些是历史待审
预览，本轮不产生新批准问题，也不自动批准已有问题。原Git对象缺失时历史校验必须失败，
不得改SHA或替换图。API/OpenAPI、权限、数据库、配置、环境变量和依赖未改，无生产重启。

无新增临时脚本、截图、日志或下载；只读浏览器驱动已关闭其浏览器/隔离服务，无留用进程。
本报告为正式交付物；既有用户改动不暂存。历史策略阻止清理的两目录仍保留、不绕过：
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`；
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。
