# P37 组织审计 · 字段组合 C r1

本目录是独立待审子稿；复用原 C 稿的布局、控制器和测试样例，只增强字段呈现。不是实际 Vue，也不是权限或生产验收。

- 七项服务端条件保留精确匹配；页内搜索仅搜索已加载的操作、对象类型、结果和请求/追踪号。
- 标签16px、就近帮助13px、五项已有长度限制的计数；四文本字段上限128/80/128/128，页内搜索160，不新增上限或必填规则。
- 时间字段 min/max 对应实际 Vue 的另一端点；保留原有开始不能晚于结束的校验，按浏览器本地时间转 ISO。本次截图时区 Asia/Shanghai。
- 底部明确应用会查询服务器，重置会清空七项条件及页内搜索并查询第一页。忙碌时只禁用应用/重置，字段仍可编辑。
- 原104张图和 evidence.json 不改；新38张图包含双端七个字段焦点、四个长度边界、六种筛选组合和两个页内搜索状态。没有宣称覆盖全部字段状态/控件。

永久图册：[全部38图](../../../../output/playwright/p37-fields-review/index.html)。

仓库根目录验证：

```powershell
node scripts/verify-ui-phase2-org-audit-fields.mjs --smoke
node scripts/verify-ui-phase2-org-audit-fields.mjs
node --test tests/unit/ui-phase2-org-audit-fields.test.mjs
```

`--capture` 重采本批38张图及证据；普通验证不写图。浏览器 finally 关闭，无 HTTP 请求、无开发服务和临时文件。原提案包含但实际 Vue 未修复的复制归属/异步读取保护仍是旧提案，不因复用控制器成为本批实现结论。

全部新图待审。P36手机筛选的批准不转移至P37，P36其他待审组合与P35颜色门修复授权均不在本批决定。生产 Vue/API/OpenAPI/环境/数据库/权限/依赖不改；无需重启，未部署。
