# P54–P56 辅助文字可读性复核

后续配色与 important 整理见 [配色复核](P55-P57-PALETTE-REVIEW.md) 和
[样式优先级复核](P54-P57-STYLE-PRIORITY-REVIEW.md)；下文门禁结果保留本增量时点。

2026-09-12：按 baseline-ui 的文字层级检查和项目既有 13px 最小辅助文字标准，
修复真实 Vue 样式中的 27 处 11–12px 声明：P54 数据质量 9 处、P55 治理 14 处、
P56 内容 4 处。包含指标说明、表头、版本和状态、分页、手机步骤及弹窗字段说明。
本次只将这些字号改为 13px；颜色、布局结构、字段、操作、API 与权限不变。

## 当前审核图

- [P54 手机证据完整溯源](design/data-quality-direction-c/vue-implementation/P54-390-quality-lineage.png)
- [P54 桌面证据质量](design/data-quality-direction-c/vue-implementation/P54-1440-quality-default.png)
- [P55 手机治理事实](design/governance-direction-c/vue-implementation/P55-390-governance-default.png)
- [P55 桌面治理事实](design/governance-direction-c/vue-implementation/P55-1440-governance-default.png)
- [P56 桌面内容台账](design/content-direction-c/vue-implementation/P56-1440-content-default.png)
- [P56 手机审核窗口](design/content-direction-c/vue-implementation/P56-390-content-review-stale.png)

图片使用既有测试数据，不是真实生产数据。当前逐图审核仍为 pending；
本次更新不扩大以往用户批准范围。

## 验证

- `node --test tests/unit/design-quality-gate.test.mjs`：3/3 通过，修复了原可读性失败。
- 复用 m03-06 数据质量、m06-02 平台管理和平台通知既有 E2E：双端 72 通过、2 跳过。
  跳过项为两个已由桌面覆盖的旧回执归属用例的手机重复版本。
- 使用 `SCOUTOPS_UI_PHASE2_CAPTURE=1` 重拍当前 Vue 证据：数据质量 14、数据记录 4、
  治理 12、内容 11、通知 40，共 81 张 PNG 及同名 JSON。通知页面样式未改，
  因证据元数据绑定完整 CSS 集合而同步重拍，不能仅改其指纹。
- 81 份证据均通过 testStatus、图片哈希、当前源码与 CSS 哈希、待审标记和页面无
  横向溢出检查。目检手机治理、手机溯源及桌面内容台账，未发现新增截断或重叠。
- `npm run build:web` 与原前端预算通过，252 个构建文件。

全站仍有颜色令牌、important 覆盖、旧源码断言和历史证据等未解决门禁。
上一轮全库结果为 1,108 通过、183 失败；本轮完成上述定向回归，未把修复一项
推算为新的全库统计，也未重复运行没有相关变化的全库历史图稿检查。
未提交、未部署，整体计划仍在实施。

## 使用与运行

更新后的截图保存在各页原 vue-implementation 图册中，可从以上链接审核。
无需新增配置、迁移或依赖；将来随前端构建经既有宝塔流程上传并刷新浏览器。
本项无需 Node、Worker、Python、MySQL 或 Redis 重启。
测试服务已结束，临时测试结果文件清理；截图、同名证据和正常构建产物为交付保留。
