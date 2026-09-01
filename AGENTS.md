# ScoutOps 项目执行约束

## 先读与定位

- 产品总纲是 `new-product-enterprise-blueprint.md`；实现前先读与当前改动相关的章节。
- `locate_flow_v4` 是定位顺序：先读本文件，再读 `docs/feature-map.json`，最后按功能名、路由、表或事件追到实际实现文件。`node scripts/locate_flow_v4.mjs "关键词"` 是查询地图的辅助命令，不替代对真实代码的追踪。
- 计划文档与 Feature Map 描述的是目标状态；在代码生成前需以实际仓库文件为准，不能把计划当作现有实现。

## 已锁定技术与运行边界

- 前端以 Vue 3 为基础，可按页面需要采用兼容框架或库，但不得新增面板外生产运行服务。后端默认使用 Node.js 和 Python；Go 仅在已有 Node/Python 不适合且工作包明确说明时引入。
- 生产数据库为 MySQL 5.7，数据库名和业务账号均为 `product_scout`。迁移必须兼容 MySQL 5.7、使用 `utf8mb4`，不得使用 MySQL 8 专属语法或 root 账号。
- Redis 仅承担缓存、队列、限流和 SSE 协调。
- 运行时数据库连接使用本机 `DB_HOST=127.0.0.1`、数据库名和业务账号 `product_scout`；密码仅由宝塔受限配置注入。
- AI 只允许后端访问 OpenAI 兼容模型服务；模型地址、模型名、超时和重试均从运行环境读取，不能下发到浏览器。
- AI 只能做摘要、解释、分类和缺失项提示，不能代替原始事实、价格、利润、资质或自动决策。

## 宝塔部署与密钥

- 生产服务必须全部由宝塔面板创建、展示、启动、停止、重启、查看日志和配置：网站、Node API、Node Worker、Python Crawler、MySQL、Redis、计划任务、文件备份均不例外。
- 禁止通过 systemd、独立 PM2、宿主机 crontab、屏外 Docker Compose 或外部托管服务创建生产运行能力。若需要 Docker 服务，必须由宝塔面板的 Docker 管理能力创建和操作。
- 部署凭证、数据库密码、GitHub Deploy Key、Cookie、Token、私钥和 `.env` 均不得提交、打印或写入文档。只在宝塔受限配置或受限环境变量中维护。
- 生产主机房在惠州；按 2026-08-08 当前范围，备份与恢复只使用现有主机内由宝塔管理的独立加密目录和隔离恢复库，不配置备用服务器，也不得宣称整机、磁盘、机房或异地灾备能力。真实客户数据、数据库、主文件存储不得离开中国境内。

## 固定生产目录与重复部署命令

- 本项目唯一生产根目录是 `/www/wwwroot/ai选品`。只允许维护以下固定目录，禁止再创建 `current`、`releases`、Git 工作树或长期 staging 目录：
  - `/www/wwwroot/ai选品/frontend`：Vue 构建后的静态文件，也是宝塔网站 `midouai.medouai.com` 的网站目录。
  - `/www/wwwroot/ai选品/backend`：Node.js 20 后端运行包，也是宝塔 Node 项目 `ai选品` 的项目目录。
  - `/www/wwwroot/ai选品/python`：Python 3.12 采集运行包，也是宝塔 Python 项目 `ai选品-python` 的项目目录。
  - `/www/wwwroot/ai选品/config`：宝塔受限环境文件；不得提交、上传到其他目录或在输出中展示秘密。
  - `/www/wwwroot/ai选品/runtime`：`evidence`、`exports`、`credential-tmp`、`tmp`、`verification` 等运行数据。
  - `/www/wwwroot/ai选品/backups`：仅本项目的数据库和文件恢复材料。
- 服务器不得执行 Git clone、pull、checkout 或 build。代码只在本地构建并用 `python scripts/deploy-baota.py` 上传运行包；该命令会排除 `tests`、截图、文档、计划、源码缓存和本地临时文件，上传完成后删除临时包。
- 宝塔网站对象：`ai选品网站` / 域名 `midouai.medouai.com` / 目录 `/www/wwwroot/ai选品/frontend`。
- 宝塔 Node 对象：`ai选品` / 目录 `/www/wwwroot/ai选品/backend` / Node `v20.19.6` / 启动命令 `node --env-file=/www/wwwroot/ai选品/config/product_scout.env --env-file=/www/wwwroot/ai选品/config/release.env apps/backend/dist/server.js`。这是宝塔面板中的直接 Node 命令，不得配置项目自带 Bash 启动器。
- 宝塔 Python 对象：`ai选品-python` / 目录 `/www/wwwroot/ai选品/python` / Python `3.12.13` / 命令模式 / 启动命令 `python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env`。由 Python 直接解析受限 `KEY=VALUE` 文件，不使用 Bash；Python 项目只允许由宝塔创建、启动、停止、重启和查看日志。
- 创建或首次整理：在本地仓库根目录运行 `python scripts/deploy-baota.py --initialize-layout`。更新最新版：提交并确认工作树干净后运行 `python scripts/deploy-baota.py`。
- 宝塔命令行重启 Node：`/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品`。
- 宝塔命令行重启 Python：`/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py python ai选品-python`。
- 启动和停止必须在宝塔“网站/Node 项目/Python 项目”界面操作；创建服务使用上述本地部署命令调用宝塔项目模型。禁止手工用 `nohup`、`screen`、systemd、独立 PM2、宿主 crontab 或 Docker Compose 代替宝塔。
- 部署脚本只能读取 Windows 凭据管理器条目 `ssh@192.168.1.220:22/root`，只能修改本项目根目录、网站 ID 29、Node 项目 `ai选品` 和 Python 项目 `ai选品-python`。任何对象身份或路径不匹配都必须失败关闭，不得扩大操作范围。

## 变更、验证与提交

- 代码、路由、API、事件、配置或权限变更时，同步更新 OpenAPI、`docs/feature-map.json`、测试和运维说明。
- 先执行最小定向验证，再按风险执行完整验证；临时测试文件、日志和进程必须在结束前清理。
- 当前项目初始化为 Git 仓库后，远程仓库只能使用计划中指定的公开 GitHub 仓库。提交前检查 `git status --short`，仅暂存本次任务文件，禁止 `git add .`。
