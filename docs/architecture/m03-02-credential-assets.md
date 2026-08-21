# M03-02 平台凭证资产

## 范围与安全边界

M03-02 交付平台全局的 `credential_assets` 与 `crawler_profiles`。账号、API Key、Cookie、私钥和浏览器档案属于平台资产，表中不伪造 `organization_id` 或 `workspace_id`；组织使用权与配额仍由后续 `provider_connections` 管理。只有 `key_rotation:manage` 可列出元数据、创建、轮换、撤销或登记浏览器档案，平台运营管理员和普通用户不能读取这些 API。

写入合同只接受 `secret_payload`，API 输出只包含 Provider 引用、名称、类型、状态、非秘密 key_version、16 位指纹、时间和乐观版本。密文、nonce、authentication tag、Cookie、Token、密码和私钥从不出现在响应、页面、审计元数据或结构化日志中。本模块不提供解密 HTTP API、导出或下载。

## 加密、版本和审计

- `@scoutops/credentials` 使用 AES-256-GCM、96 位随机 nonce 和 128 位认证标签；主密钥经域分离的 SHA-256 派生为 256 位数据密钥，AAD 绑定资产 ID、资产类型和 key_version。
- Cookie 写入响应显式使用 `Cache-Control: no-store`；API 在调用 Repository 前只保留密文、nonce、认证标签和不可逆指纹。Python Crawler 的宝塔结构化日志入口对 cookie、credential、token、authorization、secret 与 master key 类字段递归脱敏，即使后续调用方误传嵌套字段也不能输出明文。
- `credential_assets` 保存当前密文；`credential_asset_versions` 保存 create、rotate、revoke 的不可变密文版本、操作人和 request_id/trace_id。
- `credential_asset_operations` 与 `crawler_profile_operations` 以操作人、路由和 Idempotency-Key 唯一；所有写入使用 MySQL 5.7 事务和乐观锁。
- `crawler_profiles` 只能引用同一 Provider 下 active、类型为 `browser_profile` 或 `cookie_bundle` 的凭证资产；版本快照保存于 `crawler_profile_versions`。
- 凭证页面的“账号与来源兼容矩阵”只按 `provider_id` 的真实绑定、凭证未撤销且未过期、运行档案为 active 三项事实判定登录采集可用；不跨来源推断账号兼容性，也不回显任何登录秘密。
- 浏览器凭证轮换在同一事务完成活动续期任务并恢复关联登录作业：仍处于执行期的作业原位回到 `queued`；已经因登录问题终态的采集任务保留全部历史、标记为 `automatically_replayed`，再复制子查询创建新的 `scheduled` 任务。轮换只校验凭证格式、域名绑定和显式有效期，新的重放才验证真实登录；登录仍无效时会再次受阻并重新创建续期任务。
- 撤销不可恢复，历史密文与审计保留；撤销后轮换失败关闭。

常驻运行只读取宝塔受限环境中的 `CREDENTIALS_MASTER_KEY` 与非秘密 `CREDENTIALS_MASTER_KEY_VERSION`。主密钥轮换由宝塔一次性任务运行 `scripts/rotate-credential-master-key.mjs`：逐个 active 资产解密、用新密钥重加密、写新版本并校验，幂等键允许安全续跑。只有全部 active 资产切换成功后，才能更新常驻配置并撤销旧密钥。轮换不会覆写不可变历史版本；旧密钥撤销后，旧版本密文只保留审计证据且不可再解密，运行时只使用已重加密的当前 active 版本。

## 临时解密合同

`withMaterializedCredential` 只供已授权 Worker/Crawler 任务调用：在 `CREDENTIAL_TEMP_ROOT` 下创建随机、受限目录和 `0600` 文件，将回调包在 `try/finally` 中，并在成功或异常后清空内存 Buffer、删除准确的临时目录。M03-02 验证异常注入后的清理；M03-04 才把该合同接入真实 Playwright 采集任务。没有新增面板外生产服务、公开文件、Redis 真相或浏览器端密钥。

## 回滚

先在宝塔停止统一 Node 后端和 Python Crawler，确认没有凭证写入、自动重放或主密钥轮换任务；备份数据库后先执行 `0049_credential_renewal_auto_replay.down.sql`，再执行 `0016b_credential_assets_m03_02.down.sql`。回滚按 profile operations、profile versions、profiles、asset operations、asset versions、assets 顺序删除。随后回滚代码与配置并由宝塔重启。删除表会永久失去密文和版本审计，未验证备份恢复前禁止生产执行。
