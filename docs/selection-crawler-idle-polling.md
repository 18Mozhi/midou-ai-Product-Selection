# Python空领取等待与租约心跳分离

## 已核实瓶颈

2026-10-20 08:36:17北京时间只读检查最近30条成功浏览器作业：只取近2小时创建、已有leased_at/finished_at且父任务attempt_count=1的记录，避免历史重试创建时间混入。多数created_at到leased_at为27–29秒，leased_at到finished_at约14–29秒。实际作业5f221ae2-e37a-405c-9bed-63a065f41842等待28.557秒、执行25.014秒；04203868-2dc4-4c87-8a0f-86382d6dfcbd等待27.161秒、执行16.756秒。不是把整个耗时归因网页慢。

Python main_loop.run_loop原来在一次成功空领取后stopped.wait(config.heartbeat_seconds)，生产心跳默认30秒。上一任务完成后立即空领取，Node再创建下一浏览器作业，容易错过这一轮而空等接近30秒。来源单并发和真实网页访问时间不需要放宽即可移除此等待。

## 实现和合同

新增Python启动配置CRAWLER_IDLE_POLL_SECONDS，默认2，合法整数1–60，纳入原脱敏配置fingerprint；config/env.example同步。只在run_once成功返回False时使用此间隔。发生RuntimeClientError时仍按原CRAWLER_HEARTBEAT_SECONDS退避，原网络请求内部有界重试不变；成功处理工作后仍立即进入下一轮。stopped.wait继续支持停止即时打断，--once不额外等待。

心跳线程、租约时长、全局单机Worker槽、来源并发1、浏览器档案独占1、来源冷却/条款/robots/登录/验证码/429、证据采集及完成回执全部保留。提高的是本机内部空队列领取频率，不是新增浏览器实例或取消网站访问限制。Node/API/前端/Python作业请求与结果字段、数据库、依赖和历史任务不变；配置fingerprint仍为原字符串字段。

## 使用与运维

不设置即使用2秒；需要调节时，在宝塔受限product_scout.env或Python项目环境中设置CRAWLER_IDLE_POLL_SECONDS=1至60。该值启动时读取，需通过宝塔Python项目ai选品-python重启；固定命令为`/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py python ai选品-python`。无需修改CRAWLER_HEARTBEAT_SECONDS/CRAWLER_LEASE_SECONDS，不需要修改数据库或来源配置。真实.env不写入不确定值，不提交凭证。

只要API正常且空闲，每2秒最多一次该循环的领取请求；API错误仍使用原30秒默认心跳退避。没有工作时持续轮询会比原先增加本机API/数据库查询，需以运行状态和实际等待观察验证；不据此保证日100条。

## 验证与验收

先运行5项主循环和3项配置测试，覆盖空领取2秒、API错误30秒、成功后立即再领取、自定义间隔、停止打断及--once、默认/边界/非法配置和fingerprint。完整Python32项回归与运行文档门通过；Feature Map首次因JSON数组格式未规范导致路由生成检查失败，仅重新生成原地图格式后通过，73路由/60保护/6角色没有变化。正式发布与自然任务等待时长随后补充。日完成目标和全站UI总验收仍未完成。

08:38:20独立基线：同条件最近30条平均领取等待25.844秒、平均浏览器阶段19.740秒，等待范围11.366–29.300秒；受限环境只回读两项非秘密配置，心跳30秒、独立空领取项尚未设置。该观察窗不能代表全天或未来SLA，也不包括失败或多次尝试作业。

本轮新增测试是永久回归资料，没有临时脚本、截图或本地服务；只读生产查询没有领取/重放或修改任务。
