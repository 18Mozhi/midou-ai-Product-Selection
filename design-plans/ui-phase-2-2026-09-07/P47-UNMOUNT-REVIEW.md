# P47 · 实际卸载与缓存淘汰核对

2026-09-11，起点main / dd24c0b0，工作树干净。本批增加验证与事实记录，没有修改生产组件、共享组件、路由、接口或业务规则。首次读取失败区域仍待用户审核，不能当作已批准接入。

## 1. 真实链路与边界

生产`main.ts → RouterView → App → NavigationShell → KeepAlive(max=12) → ProviderRuntimeSurface → ProviderAdapterCenter`。平台路由采用preserve，以route name作为缓存key（账号中心另有共享key，本批不选它）。

- 壳层卸载：调用实际导出的router进入已登记的`/onboarding`，App切换组件，后台壳层及P47实例真正卸载。
- 缓存淘汰：依次进入12条真实、不同名称的preserve路由，不改max、不替换页面或生命周期。读取原实例的`isUnmounted`及祖先KeepAlive的缓存键，确认第1至11次仍缓存、第12次实际卸载，容量始终不超过12。
- 这是测试调用真实`router.push`，不是所有菜单点击验收。只读观察Vue开发实例，未修改缓存；测试保留旧实例引用以确认卸载，不是垃圾回收/内存泄漏证明。

验证初版在快速切页时遇到子页面onMounted同步URL取消下一次导航。已依据实际调用链等待页面发出首次读取并完成同地址同步，再填充缓存；不修改生产时序，也不把观察超时当作缓存已淘汰。

## 2. 新增证据

[8张手机回放图](../../output/playwright/p47-unmount-review/index.html)，[机器证据](../../output/playwright/p47-unmount-review/evidence.json)。390/1440两宽度 × 壳层卸载/缓存淘汰 × 首次读取/主动刷新/健康检查 × 成功/409失败，共24组636项显式检查；185个当前加载源指纹，不是185页覆盖。

旧请求在新P47实例出现之后才返回。确认：

- 离开时详情移除、背景inert释放、P47专属样式标记不再匹配。
- 返回后确为新实例，并按既有规则重新GET和初始化筛选；不是保留缓存的返回。
- 旧成功/失败没有覆盖新数据、状态提示或新详情，也不抢新按钮焦点。
- 没有自动重放健康POST；刷新场景共3次GET，首次读取/健康检查场景共2次GET。

图中旧版本v9、成功和409均为本地受控样例。非P47数据API全部阻断，其他页面只用来占据真实缓存，不验证其数据功能；无真实探针、数据库或外部网络请求。页面时钟受控，结果在原12秒读取超时之前交付；没有证明超时后未知写结果、旧读取取消或资源GC。

## 3. 未解决：卸载后失去实例内检查锁

在旧检查尚未返回时，新实例的“执行健康检查”已经可用。`probing`属于组件实例，原实例卸载后不会传递给新实例。此处只观察按钮，不点击第二次，不把它误报为已经发生真实重复探针。

补充独立服务层证据：单元测试直接转译当前`ProviderAdapterService`及`ProviderAdapterRegistry`原始TS，使用既有M03合成来源和无外网的可控适配器、内存仓库。相同来源/操作者、不同幂等键的两个调用，在任一结果落库之前均进入实际Registry的healthCheck；这不是实际MySQL或HTTP并发验收。

代码核对：服务先`findReplay`，再执行healthCheck，最后`recordHealth`。MySQL回放按provider/actor/route/idempotency_key匹配已完成版本；`FOR UPDATE`在健康检查之后的记录事务中。浏览器新提交默认生成新幂等键。因此，当前回放和记录锁不能被当作跨页面的在途按钮锁或同一来源的执行互斥证明。

需要用户确认是否先增加“同一标签页内，旧检查请求仍在途时，P47卸载并重新进入仍沿用原有单检查禁用状态，原前端请求结束后按既有规则解锁”。该选择不自动涵盖跨标签页、关闭/刷新浏览器、身份切换以及网络中断后的未知结果策略；这些边界仍需单独确认与验证。本批不擅自新增锁、自动重放或结果查询接口。

## 4. 验证、复现与交付

```powershell
node scripts/verify-ui-phase2-provider-adapter-unmount.mjs --smoke
node scripts/verify-ui-phase2-provider-adapter-unmount.mjs --capture
node --test tests/unit/ui-phase2-provider-adapter-unmount.test.mjs
```

`--smoke`仅跑390px缓存淘汰的首次读取成功/失败，不生成正式图证；与`--capture`不能同时使用。正式图证保存当前原始源及PNG指纹、请求账目、每步缓存键和卸载观察。新增3项单元测试通过，包含上述服务层并发边界与完整24组证据校验；定向格式检查通过。生产源码/依赖未变，复用上一轮有效构建和功能验证，不重复构建或安装。

临时Vite和浏览器已关闭；本批没有独立临时日志/夹具文件，8张图及index/evidence为正式交付保留。失败尝试的局部截图已由完整回放覆盖，图册清单与文件指纹一致。不改OpenAPI、环境变量或数据库，无生产重启要求，也未部署。生产/真实权限探针、未知结果策略、其他设计状态与全73页目标仍未完成。

技能：ui-skills-root用于选择最小UI上下文，fixing-accessibility用于核对详情释放及焦点归属；浏览器验证复用项目现有Playwright工具。没有新增浏览器测试框架或依赖。
