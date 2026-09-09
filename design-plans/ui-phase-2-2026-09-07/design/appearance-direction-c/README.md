# P10外观设置整页 · APPEARANCE-C-r1

使用frontend-design技能按已选C方向重构：白色身份栏、主题化范围侧区、主题选择与服务器记录并排核对、独立效果样例和会话密度分区。不是旧纸张界面换色，也不是主题浮层的重复交付。具体配色/名称/布局/交互仍待用户审核。

[打开交互稿](index.html) · [证据清单](evidence.json) · [P10规格](../../page-specs/P10.md)

## 行为边界

| 动作 | 本稿表现 | 依据与边界 |
| --- | --- | --- |
| TH-PREVIEW | 三主题radio、键盘箭头/Home/End、即时预览 | 保留deep-ocean/aurora-purple/cloud-white；名称与新配色沿共享C提案，不是生产名称已改；当前真实applyTheme也写本地缓存，本稿刻意不写storage |
| TH-DENSITY | 标准/紧凑两radio，当前预览行距变化 | 密度不进入PUT；撤销主题不撤销密度，行政壳层覆盖不当作已保存偏好 |
| TH-SAVE | 明确保存主题，显示当前预览/服务器记录/版本 | 实际PUT只含theme和expected_version；本稿只记录离线模拟请求，不验证后端版本锁/幂等审计 |
| TH-RESTORE | 恢复最近已读主题 | 保存中锁定是待审修正；真实源码未禁用撤销且存在竞态，不能把截图当修复 |
| TH-LOAD | 错误/冲突后刷新最新偏好，再重新选择 | 冲突不自动覆盖；加载失败和未知值不冒充默认保存成功 |
| AC-ROOT/PROFILE/MFA、TH-ROUTE | /、/me、/security/mfa、/settings/theme | 本稿记录真实目标，不访问生产 |
| AC-LOGIN/CONTEXT | 过期去登录；明确preference_scope_required去选择范围 | 实际服务端scope抛409该码；当前Vue把其他conflict/blocked/429一并映射blocked。新稿按真实错误类型区分，不能从网络失败推断无工作区 |

无原生弹窗；所有设置、错误与结果均内联。不新增深色模式、密度持久化、自动保存、主题ID或API字段。样例仅说明三壳层与文字状态，不显示旧87分/18.4%等假业务指标。

## 源码复现与尚未修复

永久源码验证器执行真实ThemeStudio setup及theme.ts，只有传输、DOM/cache使用内存替身：

1. 密度只改变DOM，不触发PUT；撤销主题保留密度；预览通过实际applyTheme写入隔离缓存适配器。
2. 保存使用最近version，密度不入body；无saved时源使用expected_version=0。独立页面保存失败保留预览，与壳层浮层失败回滚不同。
3. 七种错误映射、非法GET主题、保存响应与选择不同导致saved+dirty均复现。
4. 保存中choose/density/save会返回，但restore会改变选择和state；之后成功返回会造成selected=deep-ocean、saved=aurora-purple、state=saved且dirty=true。knownGap明确unfixed，真实页面没有修复。
5. 行政紧凑覆盖保持原会话密度；新模块回到standard。不是实际浏览器持久化或跨壳层运行证明。

本稿提出保存中统一锁定、错误分类、已返回与预览差异分开及radio roving焦点；正式Vue、组件生命周期/并发写入、实际缓存、后端鉴权/审计/MySQL、三主题全站迁移和生产均未验证。三主题/两密度只验证本页，不抵扣全站主题验收。

## 复验和审核

仓库根目录：`node scripts/verify-ui-phase2-appearance-source.mjs`检查源行为；`node scripts/verify-ui-phase2-appearance-c.mjs`核对来源/PNG指纹并重跑DOM验证。仅显式`--capture`更新本目录正式图、清单和图册，不修改旧主题浮层证据。复用已有Playwright，不安装依赖、不启动服务；验证浏览器finally关闭。

请以场景名称注明“通过”或修改意见。PNG与脚本均为永久审核交付物，无一次性临时文件；无生产源码/API/OpenAPI/环境/依赖/数据库改动，不部署、不重启、不写入真实偏好。页面审核、全按钮状态分母、读屏/移动软键盘、全站Vue及部署签收仍待继续。

## 图册

<!-- GALLERY:START -->
正式图86张，22个整页场景，另含七控件的悬停/焦点/按下状态。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 目录蓝 / 标准 | [1440](1440-deep-ocean-standard.png) | [390](390-deep-ocean-standard.png) |
| 目录蓝 / 紧凑 | [1440](1440-deep-ocean-compact.png) | [390](390-deep-ocean-compact.png) |
| 冷雾蓝 / 标准 | [1440](1440-aurora-purple-standard.png) | [390](390-aurora-purple-standard.png) |
| 冷雾蓝 / 紧凑 | [1440](1440-aurora-purple-compact.png) | [390](390-aurora-purple-compact.png) |
| 净页白 / 标准 | [1440](1440-cloud-white-standard.png) | [390](390-cloud-white-standard.png) |
| 净页白 / 紧凑 | [1440](1440-cloud-white-compact.png) | [390](390-cloud-white-compact.png) |
| 默认偏好，不冒充已保存 | [1440](1440-default.png) | [390](390-default.png) |
| 本地预览，服务器记录未变 | [1440](1440-dirty.png) | [390](390-dirty.png) |
| 仅调整密度，不启用保存 | [1440](1440-density-only.png) | [390](390-density-only.png) |
| 正在保存，锁定选择与撤销 | [1440](1440-saving.png) | [390](390-saving.png) |
| 服务器返回成功 | [1440](1440-saved.png) | [390](390-saved.png) |
| 写入已返回，预览仍有差异 | [1440](1440-saved-different.png) | [390](390-saved-different.png) |
| 读取中，不声称已同步 | [1440](1440-loading.png) | [390](390-loading.png) |
| 读取失败，无可确认的记录 | [1440](1440-read-error.png) | [390](390-read-error.png) |
| 返回主题不可识别 | [1440](1440-read-invalid.png) | [390](390-read-invalid.png) |
| 登录已过期 | [1440](1440-expired.png) | [390](390-expired.png) |
| 当前范围无权限 | [1440](1440-forbidden.png) | [390](390-forbidden.png) |
| 明确返回 preference_scope_required | [1440](1440-scope.png) | [390](390-scope.png) |
| 版本冲突，刷新再选 | [1440](1440-conflict.png) | [390](390-conflict.png) |
| 请求频繁，不推断无工作区 | [1440](1440-rate-limited.png) | [390](390-rate-limited.png) |
| 保存服务受阻，结果未知 | [1440](1440-service-error.png) | [390](390-service-error.png) |
| 保存失败，保留预览 | [1440](1440-save-error.png) | [390](390-save-error.png) |

控件图：

- [1440-theme-blue-hover.png](1440-theme-blue-hover.png)
- [1440-theme-blue-focus.png](1440-theme-blue-focus.png)
- [1440-theme-blue-pressed.png](1440-theme-blue-pressed.png)
- [1440-theme-mist-hover.png](1440-theme-mist-hover.png)
- [1440-theme-mist-focus.png](1440-theme-mist-focus.png)
- [1440-theme-mist-pressed.png](1440-theme-mist-pressed.png)
- [1440-theme-white-hover.png](1440-theme-white-hover.png)
- [1440-theme-white-focus.png](1440-theme-white-focus.png)
- [1440-theme-white-pressed.png](1440-theme-white-pressed.png)
- [1440-density-standard-hover.png](1440-density-standard-hover.png)
- [1440-density-standard-focus.png](1440-density-standard-focus.png)
- [1440-density-standard-pressed.png](1440-density-standard-pressed.png)
- [1440-density-compact-hover.png](1440-density-compact-hover.png)
- [1440-density-compact-focus.png](1440-density-compact-focus.png)
- [1440-density-compact-pressed.png](1440-density-compact-pressed.png)
- [1440-save-hover.png](1440-save-hover.png)
- [1440-save-focus.png](1440-save-focus.png)
- [1440-save-pressed.png](1440-save-pressed.png)
- [1440-restore-hover.png](1440-restore-hover.png)
- [1440-restore-focus.png](1440-restore-focus.png)
- [1440-restore-pressed.png](1440-restore-pressed.png)
- [390-theme-blue-hover.png](390-theme-blue-hover.png)
- [390-theme-blue-focus.png](390-theme-blue-focus.png)
- [390-theme-blue-pressed.png](390-theme-blue-pressed.png)
- [390-theme-mist-hover.png](390-theme-mist-hover.png)
- [390-theme-mist-focus.png](390-theme-mist-focus.png)
- [390-theme-mist-pressed.png](390-theme-mist-pressed.png)
- [390-theme-white-hover.png](390-theme-white-hover.png)
- [390-theme-white-focus.png](390-theme-white-focus.png)
- [390-theme-white-pressed.png](390-theme-white-pressed.png)
- [390-density-standard-hover.png](390-density-standard-hover.png)
- [390-density-standard-focus.png](390-density-standard-focus.png)
- [390-density-standard-pressed.png](390-density-standard-pressed.png)
- [390-density-compact-hover.png](390-density-compact-hover.png)
- [390-density-compact-focus.png](390-density-compact-focus.png)
- [390-density-compact-pressed.png](390-density-compact-pressed.png)
- [390-save-hover.png](390-save-hover.png)
- [390-save-focus.png](390-save-focus.png)
- [390-save-pressed.png](390-save-pressed.png)
- [390-restore-hover.png](390-restore-hover.png)
- [390-restore-focus.png](390-restore-focus.png)
- [390-restore-pressed.png](390-restore-pressed.png)
<!-- GALLERY:END -->
