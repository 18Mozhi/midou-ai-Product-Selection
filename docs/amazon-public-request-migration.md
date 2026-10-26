# 公开采集请求协议迁入（2026-10-26）

## 真实参考与范围

用户授权恢复本项目采集修改，参考星星及米兜智选；两个原仓库只读，不迁移账号Cookie或凭证、不修改其源码，不取消ScoutOps内部API鉴权。星星python/collectors/amazon_deep_search.py使用curl_cffi线程会话和完整文档请求，清除旧XHR头、统一en-US；python/collectors/amazon_us_delivery.py读取页面data-a-modal、同会话GET模态、动态CSRF、POST地区并重新读取原身份证明。米兜智选亚马逊main/utils/GetAsin.py以curl_cffi请求公开详情、复用站点会话、返回实际HTTP/HTML给解析器，不等于登录账户或保证免验证码。

用户已明确允许新增curl_cffi。现已同时迁入匿名请求会话/地区协议与Python公开文档HTTP传输，固定为本机已验证的curl-cffi==0.7.4，不安装或升级全局共享环境。现有主品、竞品、评分、1688契约和详细证据门不变。

## 实际调用链

原Python execute_lease → PlaywrightBridge → run-playwright-crawler.mjs → PlaywrightCrawlerEngine → prepareAmazonDeliveryContext保持。严格匿名页面及邮编检查后，读取同源页面签发的modal元数据；page.request共享当前BrowserContext会话（没有导入原仓库Cookie）。动态pageType/storeContext和CSRF仅取实际源，POST原观察地址及字段。仅传递已识别CSRF头，不透传来源JSON中的Authorization/Cookie等任意头。

没有modal或token时，在POST之前退回原UI流程；请求失败不在内部重试。429、登录过期、验证码、HTTP503/403保持对应失败，不把HTTP200当商品成功。挑战请求响应只分类阻断，不声称创建了可处理的活跃页面或自动解验证；原页面验证码接管不变。重新读取原URL后仍需匿名、同源、精确当前配置邮编，错误地区不进入提取。

## 配置、兼容与运行

仅新增用户已允许的Python依赖curl-cffi==0.7.4；不新增环境变量、公开API字段、权限、数据库结构或前端控件，OpenAPI与.env示例不涉及。继续使用既有AMAZON_PUBLIC_DELIVERY_POSTAL_CODE、navigationTimeoutMs和代理/会话配置；来源原配置不改，不把星星10001覆盖本项目邮编。请求均有界超时，maxRedirects=0/maxRetries=0；不读取或记录令牌/HTML/账号Cookie。不涉及AI节点、账号/组织或原项目生产运维。

地区协议可被Node健康检查及Python启动的Node子进程使用。Python PlaywrightBridge对amazon_public自行绑定当前解释器和同包public_http.py，经私有stdin字段传入Node；Node只对Amazon主文档用有界子进程curl传输，保留响应状态、挑战正文及多条Set-Cookie，继续在原BrowserContext解析和接管。其他来源/子资源不变，配置代理保持同一出口，无隐式环境代理或失败直连回退。Node API独立健康检查仍是原浏览器检查，不代表curl传输已验收。正式发布需既有官方宝塔运行包，不能用frontend-only/scoring-only伪装。官方部署在停止服务前，仅向当前stage/python/.runtime-deps安装并验证依赖，helper只从该项目目录加载；不写共享解释器。新子进程加载新文件；Node常驻健康检查加载新模块需要宝塔Node重启。不得为此中断仍存活人工会话，部署前核对它和当前生产任务。此文不表示已部署或已完成503/验证码循环验收。

## 验证及已知边界

定向回归覆盖同会话动态token链、跨源拒绝、无登录账户操作、200错误地区拒绝、401/403/429/503和验证码分类；原配送UI保护测试保留。测试合成协议不等于源站成功。

本机干净匿名curl_cffi单次公开详情GET返回HTTP200，但为验证码表单，标题及modal均不存在。未提交验证、未导入Cookie、未重复尝试；不能据此声称免登录HTTP采集成功，也不能外推生产出口。需要真实正常页面的同会话协议读回，才能验收新请求支路。来源恢复与每天100个完整结果仍独立未验收。

本地真实Chromium加合成Python stdio回归证明503挑战正文及两条会话Cookie都能进入原浏览器，未请求真实商品；36项Python基础/新传输测试通过。新版实际curl模块的单次匿名源站探测仍返回验证码页，故没有宣称实采通过、没有自动解验证。该结果不能替代正常页面地区协议和主品/竞品的真实验收。
