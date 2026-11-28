# 管理员配置 Amazon 登录态 Cookie

## 授权与范围

2026-11-26 用户明确允许管理员配置登录态 Cookie 采集。匿名模式仍是原行为，
不会把登录 Cookie 混进匿名日缓存，也不会把本授权扩展为1688操作、AI服务切换、
模型节点运维、绕过验证码或自动恢复来源。本次只本地实现和验证，不发布、不重启、
不连接或修改正式数据库，无数据库迁移。

## 上线后的操作方式

1. 平台管理员打开现有“凭证资产”页面，创建 Amazon 来源的 `cookie_bundle`，
   导入本人有权使用的完整浏览器 Cookie JSON 或原支持的 Netscape 格式，保留域名、
   路径、有效期与安全属性。内容使用既有 AES-GCM 加密，不通过聊天提供 Cookie。
2. 在新增“Amazon 采集会话”区选择该凭证并确认切换。只绑定已有
   `AMAZON_PUBLIC_BROWSER_PROFILE_ID`，不自动寻找其他账号/档案。
   在途租约存在时拒绝切换，等待自然结束；档案、凭证版本不符时先刷新。
3. 新 Cookie 必须属于同一 Amazon Provider，限定美国站原域，包含未过期的
   `at-main`、`sess-at-main` 根路径登录字段。不接受外域、损坏或过期内容。
   元数据“可用”不代表登录或实采已验证。
4. 来源恢复仍须原 Node 浏览器和 Python 传输分别完成搜索、同一商品详情，
   再走既有审计恢复。切换/轮换 Cookie 本身不重放任务、死信或解除熔断。
   登录过期或退出登录进入 `blocked_login/credential_expired`，请在原站处理后
   通过“更新资料”轮换原加密凭证。验证码保持原人工接管，不自动作答。
5. 登录 Cookie 模式不访问每日地区首页、不打开 GLUX、不修改账号地址；导入的
   会话必须已符合 `AMAZON_PUBLIC_DELIVERY_POSTAL_CODE`。邮编不符保持失败，
   由管理员在原站人工处理。匿名模式仍维持每天一次的原地区准备与严格匿名校验。
6. 如需返回匿名模式，明确选择原项目空档案并确认；其他浏览器归档不作为登录态入口。
   不删除旧凭证、不在失败时偷偷回退匿名或切换另一个账号。

## 后端契约、权限与审计

- `GET /api/v1/platform/amazon-session`：仅返回当前档案和凭证的 ID、版本、名称、
  模式、元数据可用性与期限，不返回 Cookie、密文、认证标签或源站账户姓名。
- `POST /api/v1/platform/amazon-session`：只接受 `asset_id`、
  `expected_asset_version`、`expected_profile_version`；`asset_id` 必须是字符串 UUID，
  数组等非字符串类型在开启事务前拒绝为 400；使用原
  `key_rotation:manage`、HttpOnly会话、同源写入与幂等键，不给普通账号加权限。
- 使用已有 `crawler_profiles`、`crawler_profile_versions` 和
  `crawler_profile_operations` 做事务、版本冲突检查和操作留痕；不新建表或改结构。
  留痕包含管理员、资产ID、版本、request/trace，不保存 Cookie 原文。
- Crawler领取时从实际绑定的凭证种类派生内部 `amazon_session_mode` 和
  `plan.amazon_delivery.session_mode`；不信任排队目标传入的模式。
  旧任务缺配送字段时仍由原Runner配置补齐，匿名任务结构保持兼容。
- 健康检查与实际采集都复用同一固定档案；管理员Cookie必须显式标记，
  Cookie与匿名归档不能混用。原Provider启用/条款/归属/租约保护不变。
- Cookie经已有私有stdin交给Python传输，保持原TLS验证、出口、白名单和HTTP状态；
  未新增依赖、服务、代理、配置变量、超时、重试或并发。

## 登录态证据的隐私边界

普通采集证据仅投影商品/搜索内容，登录态不回退抓整个body，不保存可能含姓名/地址的
配送头；原邮编保护仍在实际页面上执行。真实截图限定可见的商品/搜索区域，不编辑页面、
不伪造像素、不把账户导航收入普通业务证据。没有安全内容区域时保持失败。
人工接管画面仍仅提供给原有租约范围内、已登录并领取该会话的管理员，权限不变。
登录态Cookie不写入匿名每日缓存，也不由采集进程自动改写管理员凭证资产。

## 验证与部署边界

本地测试覆盖加密解密、显式绑定、版本与幂等、活跃租约拒绝、普通用户/跨源拒绝、
过期/外域/缺登录字段、服务端模式派生、双支路四步健康门禁、真实Chromium
Cookie采集及截图裁剪、真实Vue确认和窄屏布局。都是自有模拟响应，不代表真实账号验收。

相关命令：

```powershell
npm run build:playwright-crawler
npm run build:api
npm run typecheck:web
node --test tests/unit/amazon-cookie-session-service.test.mjs tests/unit/amazon-cookie-transport-binding.test.mjs
node --test tests/integration/amazon-administrator-cookie.test.mjs tests/integration/amazon-cookie-session-ui.test.mjs
```

OpenAPI、功能索引、已有env示例注释同步。AI服务后台切换尚未实现，现有AI环境配置
和AI节点只读限制不变。本次不执行生产写入/健康探测；未来另获正式发布授权后，需同步
Node运行包、Runner脚本和前端静态包并由宝塔重启Node。Python源代码未改，每任务启动的
Node读取新模块，不要求重启Python。未授权前不执行发布，也不直接改正式配置或数据库。

## 2026-11-28 精确正式发布入口

用户已授权本次 Cookie 功能与参数校验发布，只重启 ai选品 Node。
使用 `scripts/deploy-account-baota.py --amazon-cookie-session`，必须提供原正式运行 SHA
和原引擎 SHA256。仅干净、已验证且与 origin/main 一致的源码可运行；当前聊天的其他
未提交诊断、UI 和其他工作树内容不得混入。新增入口复用原发布锁、固定宝塔对象核验、
四次连续全零排空、原子替换及静态资源公开读回。不执行迁移，不更新环境配置，不创建备份，
不操作 Python/1688/AI/并发，也不重放死信。

精确范围为6个既有API模块、1个既有浏览器引擎、1个既有Runner和2个新Cookie模块，
另发布已提交的凭证页静态包。引擎从已证实匹配正式字节的 e670d019 源码，仅施加
Cookie 功能提交；尚未发布的匿名日缓存刷新改动不随本次发布。原日缓存、Python helper、
传输模块与队列文件受保护。两个新模块必须原本不存在，任何漂移均关闭发布。

发布后先用已认证管理员会话确认入口和元数据权限，不把401或页面壳当验收；再执行
既有双支路搜索/同一商品详情四步门禁，全部通过后才能审计恢复。若未配置有效Cookie、
遇登录/验证码/邮编阻断，则保持来源受阻，转管理员操作，不自动切换账号或重试死信。

本次10模块包超过旧argv封装上限时，使用固定宝塔Python的有界SSH stdin（上限2MiB），
仍要求唯一权威回执、零错误退出和原全部门禁；不分散安装、不丢弃排空或文件哈希保护。

## 2026-11-28 Cookie创建类型值修复与免重启静态发布

通用凭证表单的类型选项必须显式绑定内部值；“登录状态”仅是显示标签，提交仍为
`cookie_bundle`，不以中文标签代替接口枚举。新增真实完整凭证页回归，覆盖从新建、
POST内部类型、成功清除输入到显式绑定的闭环；不读取或上传真实Cookie作为测试材料。

仅需静态修复时使用协调器 `--amazon-cookie-session-frontend`，仍提供原运行基线
及原引擎身份参数；它跳过Node安装、领取暂停和重启，只在已安装的10个Cookie模块
哈希完全匹配后发布前端并公开读回。与Node发布动作互斥；后端、配置、Python、数据库、
并发和死信都不操作。完成后刷新浏览器即可，无需重启服务。

旧表单保存被拒绝时不会生成可恢复的Cookie资产，须由管理员重新输入、加密保存，
再在Amazon采集会话显式绑定。未核实真实绑定前不运行匿名检查冒充登录态验收。
