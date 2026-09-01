# ai选品宝塔固定目录部署

生产目标固定为惠州 `192.168.1.220`、域名 `midouai.medouai.com`、根目录 `/www/wwwroot/ai选品`。服务器不保存 Git 仓库，也不执行 `git pull` 或源码构建。本地构建完成后，由 `python scripts/deploy-baota.py` 只上传运行包。

## 目录与宝塔对象

| 用途              | 固定目录                       | 宝塔对象                                | 启动方式                                                                                                                                     |
| ----------------- | ------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue 前端          | `/www/wwwroot/ai选品/frontend` | 网站 `midouai.medouai.com`              | 静态文件，无独立进程                                                                                                                         |
| Node 后端         | `/www/wwwroot/ai选品/backend`  | Node 项目 `ai选品`                      | `node --env-file=/www/wwwroot/ai选品/config/product_scout.env --env-file=/www/wwwroot/ai选品/config/release.env apps/backend/dist/server.js` |
| Python 采集运行时 | `/www/wwwroot/ai选品/python`   | Python 项目 `ai选品-python`             | Python 3.12.13 命令模式：`python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env`                                |
| 受限配置          | `/www/wwwroot/ai选品/config`   | `root:www` 目录 `0750`、环境文件 `0640` | `www` 运行进程只读；不提交、不打印                                                                                                           |
| 运行数据          | `/www/wwwroot/ai选品/runtime`  | Node/Python 共用                        | 证据、导出、凭据临时目录与验证数据                                                                                                           |
| 本机备份          | `/www/wwwroot/ai选品/backups`  | 宝塔备份任务                            | 仅本项目恢复材料                                                                                                                             |

Node 项目由统一后端监督 API 与 Worker。Worker 内所有队列由一个优先级调度器控制，生产使用 `/www/wwwroot/ai选品/runtime/worker-scheduler.json` 回写脱敏的并发、背压、延迟和失败率；不得为积压队列另建 Worker 进程绕过配额。Python 项目是宝塔可见、可启停、可查看日志的浏览器采集消费者：通过内部服务令牌领取档案租约，执行 Python-to-Playwright 调用链，持续续租并回写完成结果；不再上报无业务任务的“空闲心跳”。

部署器每次切换运行包时都会把 `config` 目录恢复为 `root:www 0750`，并把 `product_scout.env`、`release.env` 恢复为 `root:www 0640`。这样宝塔以 `www` 启动 Node/Python 时可以读取配置，同时其他宿主机用户仍无读取权限；不得改回 `root:root 0640`，否则两个面板项目都会在读取环境文件阶段失败。

## 创建、更新、启动和重启

首次初始化固定目录并迁移受控的旧 `shared` 内容：

```powershell
python scripts/deploy-baota.py --initialize-layout
```

以后发布最新版：

```powershell
python scripts/deploy-baota.py
```

脚本要求 Git 工作树干净，并在读取 Windows 凭据前校验 `.artifacts/release-change-ownership.json`：从上次发布基线到当前 HEAD 的每个 commit 与变更路径都必须精确归入一个有负责人的工作包，未知、重复、额外或跨包冲突变更会阻断上传。清单格式参考 `verification/release-change-ownership.example.json`。通过后脚本才从 Windows 凭据管理器读取 `ssh@192.168.1.220:22/root`，在本地完成构建，只上传 `frontend/backend/python` 运行包，并通过宝塔模型修改或创建本项目对象。临时上传包和 staging 在成功后删除。`tests`、截图、文档、计划、Git 元数据和本地缓存不会上传。部署器不再识别、迁移或删除 `current`、`releases`；固定根目录出现任何非白名单条目都会在停止服务前失败关闭，应先人工确认归属并移出该根目录。

启动、停止优先在宝塔面板的网站、Node 项目和 Python 项目页面操作。命令行重启也必须调用宝塔脚本：

```bash
/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品
/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py python ai选品-python
```

宝塔内部会生成自己的管理脚本和 PID 文件，这是面板实现细节；项目配置中的 Node/Python 启动命令必须是上表的直接命令，项目目录中不得再保存自定义 Bash 启动器。Python 自己读取受限环境文件，避免宝塔命令模式漏传环境。禁止 systemd、独立 PM2、宿主机 crontab、`nohup`、screen 或屏外 Docker Compose。

## 验证、回滚与维护边界

发布成功必须依次检查公网 `/api/v1/health/live`、`/api/v1/health/ready`、`/api/v1/health/available`、`/api/v1/health/version` 的 Git SHA、宝塔 Node 状态、Python 任务领取/结果回写日志、Worker 调度心跳和网站首页。目录或对象身份不匹配时部署脚本失败关闭，不得搜索或修改其他项目。

代码回滚使用本地目标 Git 提交重新运行同一部署命令；数据库迁移回滚仍需先备份并按对应 runbook 判断数据影响。`config`、`runtime`、`backups` 不随代码覆盖。首次整理只允许脚本迁移受控 `shared` 内容；其他旧目录必须先人工确认归属并移出项目根目录，部署器不会替用户删除。不得把旧发布目录重新引入生产结构。

宝塔官方依据：命令行工具 <https://docs.bt.cn/getting-started/bt-command-line-tool>；资源管理工具 <https://docs.bt.cn/getting-started/btcli-interactive-tool>；API 总览 <https://docs.bt.cn/api/>。
