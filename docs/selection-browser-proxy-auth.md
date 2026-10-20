# 浏览器代理鉴权传递修复

## 已确认现象

2026-10-20生产实际浏览器日志记录图片HTTP407和ERR_TUNNEL_CONNECTION_FAILED。
同一受限配置的代理URL未包含嵌入凭证，独立用户名/密码均存在且没有空白。
21:07对www.amazon.com及m.media-amazon.com做CONNECT诊断：缺失鉴权均407，
使用既有真实凭证提前鉴权均200。没有展示凭证，也没有创建商品事实。
原生导航和同上下文request试验都曾收到503，后者没有解决407，因此生产验收先回到browser模式。
这证明存在鉴权传递问题，不代表所有503均由它造成；剩余问题仍需实际验证。

## 实现边界

已有Node API或Python触发的Node浏览器运行器，在每个Amazon采集run内创建一个短期
HTTP CONNECT转发器，绑定127.0.0.1随机端口（listen端口0），没有固定公开端口或新守护服务。
它属于既有宝塔进程，随浏览器run结束清理，不增添宝塔外服务、依赖或数据库表。

浏览器只取得本次run的随机本机用户名/密码；本机入口逐次鉴权，不能匿名使用。
转发器仅允许443及amazon.com、media-amazon.com、ssl-images-amazon.com、
images-amazon.com、amazon-adsystem.com自身或子域；拒绝IP、其他域及其他端口。
每次CONNECT只向原配置HTTP代理发送一次已有Proxy-Authorization，不猜测或更换账号。
原始凭证不再下发到Chromium启动选项、plan、前端、日志或网页。

上游200后只转发不透明双向字节，不终止TLS、不关闭证书校验、不修改源站请求、Cookie或响应。
上游失败不会变成成功；代理层错误返回本机502/504，并仅记录上游状态数字。
原始来源、匿名、验证码、限流、邮编、解析和完整选品门全部保留。其他来源不使用此入口。

连接数最多64，代理握手复用既有PROVIDER_PROXY_CONNECT_TIMEOUT_MS（默认5000，合法100–10000ms）。
浏览器关闭或启动失败都会关闭监听和所有客户端/上游socket；无临时文件。
节点上线后需在宝塔重启Node与Python；没有新增环境变量。已存在的
AMAZON_PUBLIC_BROWSER_NAVIGATION_TRANSPORT设为browser核验原生路径，request仍只是可选诊断路径。

## 验证

真实TCP夹具验证两跳鉴权、错误本机凭证不会触达上游、域/端口边界、原字节透传、
真实上游407不会放行，以及关闭清理。真实Chromium分别验证browser/request到达自有TLS边界；
夹具主动关闭TLS，不访问外网、不降低证书要求，也不冒充生产页面成功。
启动失败回归确认Chromium只看到本机临时凭证，原代理凭证不在启动选项或plan。
上述测试通过不等于生产407、503或每日100个已验收；以正式run、接管会话及完成事件为准。

## 验证脚本连接诊断

2026-10-20真实业务验证码失败回执仍出现script/ERR_TUNNEL_CONNECTION_FAILED。
连接失败现仅补记HTTPS标准DNS主机名（最多253字符），不含URL路径、查询、用户信息、
头部、cookie或代理凭证；IP、localhost、非HTTPS及无效URL不记主机名。
私有CONNECT代理区分本地target_not_allowed与upstream_response，仍沿用原允许范围，
不得凭错误码猜测或直接放开任意域名。诊断仍最多10条，正常成功连接不输出。
本次不改变代理允许域名、验证码处理、事实解析或完成计数；需要既有宝塔Node/Python重启。

## 实际页面引用的单一CDN资源

2026-10-20 23:00–23:02中国标准时间，以原失败业务执行请求保存的真实Amazon商品URL，
沿用现有HTTPS上游代理、无Cookie和无请求头伪装进行只读GET。真实页面两次为200，
静态script/src引用d2lbyuknrhysf9.cloudfront.net；该具体脚本经同一上游返回200/255619字节。
本地私有浏览器代理对这个确切主机实际返回403/target_not_allowed，确认页面资源通路缺口。
只在独立exactHosts集合加入此确切主机；整个cloudfront.net、其他发行主机、该主机下的
任意子域及相似后缀仍拒绝，端口443和本地/上游鉴权、TLS透明与请求限制不变。
真实Chromium测试只连接自有上游fixture并验证TLS边界，不访问实际CDN或解验证码。
这修复已证实的资源拦截；它尚不足以证明先前未知脚本就是该主机，更不代表验证码循环
和每日100个整链结果已经通过。无新API/配置/数据库/依赖，需正式重启既有Node/Python。
