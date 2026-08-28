# M03-02 平台凭证资产运维说明

## 宝塔部署

1. 在宝塔备份 `product_scout`，使用业务账号按顺序执行 `0016b_credential_assets_m03_02.up.sql` 与 `0049_credential_renewal_auto_replay.up.sql`；已存在 M03-02 表时只执行未应用的 0049。
2. 在 API、Worker 与 Crawler 项目的宝塔受限环境中配置同一真实 `CREDENTIALS_MASTER_KEY`，长度至少 32 字符；设置同一非秘密 `CREDENTIALS_MASTER_KEY_VERSION`（初始建议 `v1`）和各自主机的 `CREDENTIAL_TEMP_ROOT`。
3. 不把主密钥写入 `.env`、数据库、Git、镜像、文档、命令参数、日志或截图。生产临时目录应位于宝塔受控的本地路径，不得指向站点公开目录。
4. 由宝塔重启 Node API、Node Worker 和 Python Crawler。静态站点发布 Web 构建产物；不得创建 systemd、独立 PM2、宿主机 crontab或面板外容器。
5. 以具备 `key_rotation:manage` 的平台安全管理员访问 `/platform-admin/credentials`。普通密钥只写入一次，保存后只能看到指纹和版本。需要网页登录的来源可从来源页进入“配置网页登录”，上传已登录专用浏览器的 `.tar.gz` 压缩档案（压缩后不超过 6 兆字节）；系统加密保存并创建可运行采集档案，不要求官方接口。
6. 分别使用桌面与 390 像素视口核对“账号与来源兼容矩阵”：桌面表格可调整列、冻结首列和切换密度；移动端只显示来源与兼容状态摘要卡片，点击“查看详情”后侧边详情必须显示真实绑定资料和运行档案，页面不得出现横向宽表。

轮换活动浏览器凭证后，系统自动完成该档案的续期任务，并恢复因 `credential_expired`、`blocked_login`、`session_expired` 或 `login_required` 受阻的浏览器作业。运行中任务原位重新排队；已终态任务生成新的 scheduled 任务并保留旧任务。轮换成功不代表网页登录已经验证，必须继续观察自动重放结果；若新凭证仍失效，任务会再次进入登录受阻并重新创建续期任务。

修改 `CREDENTIALS_MASTER_KEY`、`CREDENTIALS_MASTER_KEY_VERSION` 或 `CREDENTIAL_TEMP_ROOT` 后必须在宝塔重启 API、Worker 和 Crawler；这些值不是动态读取。

## 主密钥轮换

保持常驻服务使用旧主密钥，在宝塔创建一次性发布任务，并临时注入：

- `CREDENTIALS_ROTATION_NEW_MASTER_KEY`：新主密钥，不得打印。
- `CREDENTIALS_ROTATION_NEW_KEY_VERSION`：新的非秘密版本标签。
- `CREDENTIALS_ROTATION_ACTOR_ID`：发起轮换的平台安全管理员 UUID。

运行：

```powershell
node scripts/rotate-credential-master-key.mjs
```

脚本只处理 active 当前版本，为每个资产写 correlated rotated 版本，按新版本和资产 ID 使用稳定幂等键；失败可在修复后原命令续跑。不可变历史版本不会被覆写，旧密钥撤销后其密文仅作审计保留且不可再解密。仅当输出 `remaining: 0` 后，才把常驻 `CREDENTIALS_MASTER_KEY` 和版本切换为新值，由宝塔依次重启 API、Worker、Crawler 并执行模块健康检查。确认新密钥可用后撤销旧密钥，并立即删除三个一次性变量。任何 active 当前版本仍在旧 key_version 时都不得撤销旧密钥。

## 验证、告警和恢复

```powershell
npm run verify:module -- M03-02
```

门禁覆盖构建、AES-GCM 篡改拒绝、异常任务后的临时明文清理、MySQL 5.7 密文/版本/幂等/撤销实测、桌面与 390px 视觉和文档。实测使用合成密钥和合成秘密，结束后删除数据库记录与临时目录。

页面发布后还必须验证：

1. 用 `provider_id` 深链打开网页登录表单，所选来源必须与 URL 中的真实 UUID 一致；不得退回列表首项。
2. 成功读取后分别注入 503 和超过 12 秒的延迟，页面必须保留原凭证元数据、运行档案和兼容矩阵；刷新按钮应恢复，反馈说明保留了上一次事实。
3. 新建、轮换和撤销分别使用新的 Idempotency-Key；缺失 Origin、缺失幂等键、错误类型和缺少参数必须返回 4xx，不能写库。
4. 在 1440×900、1024×768 和 390×844 打开每个编辑对话框，核对首字段焦点、Escape 关闭、关闭后焦点返回、Tab 焦点约束、原生必填提示和无横向溢出。
5. 浏览器助手资源应直接返回 200、`application/zip` 和非零长度；若浏览器下载被扩展接管，应记录客户端扩展和响应，不把直接资源验证扩写为用户下载通过。
6. 使用无平台权限账号和无会话请求分别确认 403 与 401；本接口为平台全局资产，不接受组织或工作区参数。

- `credential_master_key_unavailable`：在宝塔检查主密钥是否存在并重启 Node API；不要在日志中粘贴值。
- 401/403：重新登录或核对 `key_rotation:manage`，前端可见性不是授权依据。
- 409：刷新资产版本；已撤销资产不能轮换，profile 必须引用同 Provider 的 active browser_profile 资产。
- 轮换后仍为 `blocked_login`：凭证格式和域名校验已通过，但目标站点登录验证失败；检查合法账号状态与档案有效期，不得直接改库跳过或把轮换响应当成登录成功证据。
- `ciphertext_invalid`：停止使用该资产，保留 request_id/trace_id，检查 key_version、认证标签和最近轮换记录，不回退为明文。
- 临时目录残留：立即停止对应宝塔 Worker/Crawler，记录任务 ID，删除经确认位于 `CREDENTIAL_TEMP_ROOT` 下的准确任务目录后再恢复；不得对宽泛目录执行递归删除。

回滚前按架构文档备份并停止统一 Node 后端与 Python Crawler。先执行 0049 down 将 `automatically_replayed` 兼容回旧状态，再执行 M03-02 down；后者会删除全部平台凭证密文、档案引用与审计版本，恢复时必须同时恢复六张表和当时对应的主密钥版本。
