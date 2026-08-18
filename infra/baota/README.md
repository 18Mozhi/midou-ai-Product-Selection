# ai选品宝塔固定目录部署

生产目标固定为惠州 `192.168.1.220`、域名 `midouai.mozhiz.cn`、根目录 `/www/wwwroot/ai选品`。服务器不保存 Git 仓库，也不执行 `git pull` 或源码构建。本地构建完成后，由 `python scripts/deploy-baota.py` 只上传运行包。

## 目录与宝塔对象

| 用途 | 固定目录 | 宝塔对象 | 启动方式 |
| --- | --- | --- | --- |
| Vue 前端 | `/www/wwwroot/ai选品/frontend` | 网站 `midouai.mozhiz.cn` | 静态文件，无独立进程 |
| Node 后端 | `/www/wwwroot/ai选品/backend` | Node 项目 `ai选品` | `node --env-file=/www/wwwroot/ai选品/config/product_scout.env --env-file=/www/wwwroot/ai选品/config/release.env apps/backend/dist/server.js` |
| Python 采集运行时 | `/www/wwwroot/ai选品/python` | Python 项目 `ai选品-python` | Python 3.12.13 命令模式：`python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env` |
| 受限配置 | `/www/wwwroot/ai选品/config` | 仅宝塔/受限文件权限 | 不提交、不打印 |
| 运行数据 | `/www/wwwroot/ai选品/runtime` | Node/Python 共用 | 证据、导出、凭据临时目录与验证数据 |
| 本机备份 | `/www/wwwroot/ai选品/backups` | 宝塔备份任务 | 仅本项目恢复材料 |

Node 项目仍由统一后端监督 API 与 Worker。Python 项目是宝塔可见、可启停、可查看日志的采集心跳与 Python-to-Playwright 桥接运行时；业务采集任务仍由统一 Worker 领取，不能把 Python 心跳误报为独立任务队列消费者。

## 创建、更新、启动和重启

首次把旧 `current/releases/shared` 结构整理成固定目录：

```powershell
python scripts/deploy-baota.py --initialize-layout
```

以后发布最新版：

```powershell
python scripts/deploy-baota.py
```

脚本要求 Git 工作树干净，从 Windows 凭据管理器读取 `ssh@192.168.1.220:22/root`，在本地完成构建，只上传 `frontend/backend/python` 运行包，并通过宝塔模型修改或创建本项目对象。临时上传包和 staging 在成功后删除。`tests`、截图、文档、计划、Git 元数据和本地缓存不会上传。

启动、停止优先在宝塔面板的网站、Node 项目和 Python 项目页面操作。命令行重启也必须调用宝塔脚本：

```bash
/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品
/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py python ai选品-python
```

宝塔内部会生成自己的管理脚本和 PID 文件，这是面板实现细节；项目配置中的 Node/Python 启动命令必须是上表的直接命令，项目目录中不得再保存自定义 Bash 启动器。Python 自己读取受限环境文件，避免宝塔命令模式漏传环境。禁止 systemd、独立 PM2、宿主机 crontab、`nohup`、screen 或屏外 Docker Compose。

## 验证、回滚与维护边界

发布成功必须检查公网 `/api/v1/health/ready`、`/api/v1/health/version` 的 Git SHA、宝塔 Node 状态、Python 心跳日志、Worker 心跳和网站首页。目录或对象身份不匹配时部署脚本失败关闭，不得搜索或修改其他项目。

代码回滚使用本地目标 Git 提交重新运行同一部署命令；数据库迁移回滚仍需先备份并按对应 runbook 判断数据影响。`config`、`runtime`、`backups` 不随代码覆盖。首次整理只有在新 Node/Python 和公网健康通过后，才删除本项目旧 `current`、`releases`、`shared`；不得把这些名称重新引入生产结构。

宝塔官方依据：命令行工具 <https://docs.bt.cn/getting-started/bt-command-line-tool>；资源管理工具 <https://docs.bt.cn/getting-started/btcli-interactive-tool>；API 总览 <https://docs.bt.cn/api/>。
