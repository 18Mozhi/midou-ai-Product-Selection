# Amazon 真实视口取证修复

正式健康检查1798已在相同双路请求中确认：Node搜索48条成功，Python搜索虽发现60个元素，但必需截图的screenshot_wait_phase=font_wait，随后timeout；详情未继续。这与1795/1796详情截图超时同属截图路径，不能把元素数当作采集成功。

安装的Playwright screenshotter在调用Chromium截图前等待document.fonts.ready。远端字体请求未完成会阻塞证据，尽管原商品DOM/地区检查已通过。本地只拦截自有字体的真实Chromium输入重现同样等待。

## 最小修复与不变项

仅Amazon证据改用现有Chromium的Page.captureScreenshot直接读取真实当前视口像素；不修改字体、CSS、DOM、Cookie、资源请求、浏览器指纹或网络策略，不跳过图片证据。不是合成截图，也不声明字体已加载。

仍输出真实JPEG（35质量，超800000字节才以15质量重拍）、非空和800000字节上限、原SHA256、时间与来源元信息；DOM片段250000字节限制不变。创建会话/截图/脱离均受已有actionTimeoutMs约束，不增加超时参数；失败仍拒绝全部部分证据。截图失败不能ready。

匿名、邮编、同商品身份、验证页、搜索/详情、两条传输及审计恢复门禁不改。非Amazon仍执行原page.screenshot，1688不受影响。无API/OpenAPI、环境变量、权限、依赖、数据库、并发或Python输入契约变化。复用[Playwright公开的Chromium CDP会话API](https://playwright.dev/docs/api/class-browsercontext#browser-context-new-cdp-session)，参数同时对照项目安装的playwright-core/types/protocol.d.ts。

测试保留真实字体loading、原页面字体与标题不变，核验真实JPEG与哈希；空图、超限图、CDP失败均拒绝部分事实。假响应只验证失败边界，不替代正式验收。

## 正式发布与恢复

本地干净提交经协调入口，只换packages/playwright-crawler/dist/index.js。完整四次连续全零及最终复核后，仅宝塔重启ai选品 Node；保留Python进程与全部其他模块，不重跑首次加载。精确旧引擎5d16516ed7f8019c15d9cfb81ffe6e1271e49c9e39fcd3d250ffa475ccde64f3：

```powershell
python -B scripts/deploy-account-baota.py --collection-viewport-evidence-only --expected-previous-sha 1b622274a6871d9d1ac3986223359b539a82aa76 --expected-module-sha256 5d16516ed7f8019c15d9cfb81ffe6e1271e49c9e39fcd3d250ffa475ccde64f3
```

恢复旧引擎使用--collection-viewport-evidence-rollback，expected-module-sha256为候选2cf245a14bd71ea04e215f08987eebee9ed5c832b4395022374752beb7ede0ac，从Git4788a8249重建旧模块，不创建正式备份。发布后仍须真实Node/Python两路搜索和同一商品详情全部通过；验证页保持受阻并进入现有人工流程，审计恢复不能提前执行。
