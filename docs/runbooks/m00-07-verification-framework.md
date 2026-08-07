# M00-07 验收框架 Runbook

## 使用

```powershell
npm run verify:module -- M00-01
npm run verify:phase -- P00
npm run verify:all
```

默认单命令超时 120 秒，报告写入 `.artifacts/verification`。可在本地或宝塔受控发布任务中调整：

```powershell
$env:VERIFY_COMMAND_TIMEOUT_MS='240000'
$env:VERIFY_REPORT_DIR='.artifacts/verification'
```

报告目录必须在项目内。真实凭证不得写入命令、注册表或报告；引擎会对常见密钥键做二次脱敏，但脱敏不能替代源头禁写。

## 状态处理

- `failed`：测试/构建返回非零或超时；先按报告中的首个失败命令修复，再重跑当前模块。
- `blocked`：前置模块/阶段、计划或注册表缺失；完成对应前置，不得改成通过。
- `passed`：本次注册的全部命令均返回 0。旧报告不替代新改动后的重跑。

## 宝塔与重启

执行器是发布/验收命令，不创建生产守护进程。脚本或注册表变化无需重启运行服务；若验收包含运行配置/应用代码变更，按对应模块 Runbook 在宝塔重启相关项目。

## 回滚

1. 回退 `package.json` 的三类命令和 `scripts/verify-*.mjs`/引擎到上一稳定版本。
2. 保留失败报告作为证据，不删除报告来掩盖失败。
3. 如已应用元数据迁移，先导出所需记录，再执行 `0002_m00_07_verification_runs.down.sql`。
4. 回滚后至少执行上一稳定模块门禁，记录版本、操作者、时间、原因和 trace_id。
