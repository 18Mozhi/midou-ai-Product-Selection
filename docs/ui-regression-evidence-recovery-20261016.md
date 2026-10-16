# 2026-10-16 历史测试图保护与恢复记录

## 当前状态：用户已批准独立新版本接续，原事故记录保留

全量测试执行了旧 `--capture --state=filter-pagination` 负例。旧命令只在识别源码指纹时禁止采集，新界面改变指纹后绕过了该判断，进入采集路径，覆盖了旧图包的三张 390px 基线图；原清单、原哈希及其他33张图没有改动。本次测试执行造成了这一副作用。

已修复：筛选分页旧图包一律只读回放；其他已存在的目标目录在加载浏览器前拒绝采集，不再因源码指纹变化恢复写入资格。原清单未改写，损坏的三张图也未被计为原验收通过。

## 授权前的恢复检查记录（历史）

- 170份浏览器输入逐份校验为原捕获时的完整 SHA-256；历史源码从 Git 或已验证的精确逆变换恢复。
- 6组桌面/窄屏浏览器运行，162项实际功能检查通过，36张输出图逐份校验通过。
- 其中33张与旧清单的原哈希完全相同；下表三张无法按原哈希恢复。
- 全部接口为本地 GET 夹具，无真实采集、写入、审批或生产操作。此回放不是新版产品的视觉批准或生产验收。
- 所有旧图、旧清单和旧审批记录保留；使用独立候选替代此项测试的证据基线，需要用户明确同意。

| 旧图名称 | 原清单 SHA-256（保留） | 独立回放候选 SHA-256（未批准替代） |
| --- | --- | --- |
| baseline-390-filters-open.png | cfedcca262f370e5518dad3339d60b3ad3a9b13a7c7a17dadecb9ec29b5e52a7 | e52d5dee1ed88a7fe53b3e404b3b4096eb28a00eca72cd24eb251b5f0f665dc8 |
| baseline-390-page-1.png | 006c5d0a527ae5da9aac67f9b017445d7f57af94fc90fbb5f48ed1eae8b10af1 | d3bc289d8414f1dfc01db17c1f519004b1543424936160a667ca7306f2ce41d5 |
| baseline-390-page-2.png | 0d8f27f3721363ac23c1a56f1c7e85a616a518e8fe680cb3a72891d66feaf0ac | b354d8eee1130c3c0dc7698c9cda9ce180461adfd9abceb5807d6d6fca38c117 |

## 授权前的临时材料（历史）

候选目录：`C:\Users\23136\AppData\Local\Temp\scoutops-fivefix-capture-restore-01a14380\candidate-replay-r2`。

输入、生成工具、被覆盖图副本均在同一临时根目录 `C:\Users\23136\AppData\Local\Temp\scoutops-fivefix-capture-restore-01a14380`，用于恢复和核对，完成决策及验收后清理。临时生成没有写入旧图包。

## 授权前的处理边界（历史）

如果用户提供包含原始三图的备份，按原哈希恢复后重新执行原测试。否则，仅在用户同意后，保存独立新版本、保留旧清单及损坏记录，并把该项测试接续到新版本；不得把旧损坏图包描述为已恢复或原验收通过。

## 授权前完整复测（历史）

本次包含全部单测文件的整轮结果为2850项：2849通过、1失败、0跳过。唯一失败是本旧图包的原图片完整性；没有跳过该项或修改原期望哈希。另行逐图核验确认旧包33/36原哈希匹配、独立候选36/36自身哈希匹配。提交、发布及整体签收仍未进行。

## 用户批准与长期存档

用户明确回复“允许独立新图包接续测试，保留旧记录。”，本次授权仅用于P47历史测试证据接续，不代替当前UI或生产验收。长期目录为 `design-plans/ui-phase-2-2026-09-07/evidence/p47-historical-recovery-r2`：原候选清单和36图保持原字节，授权另存在 `approval-and-incident.json`；原清单副本为 `original-evidence.json`，三张被覆盖状态的副本在 `incident-overwritten`。这些副本不是原始图片备份，目前没有找到匹配原哈希的原图备份，不能提供不存在的备份位置。

固定170份浏览器输入存入 `browser-inputs.json.gz`，解压后逐份校验原完整SHA；旧目录和原期望哈希不变，测试明确验证旧损坏图没有被假称恢复，并校验完整独立新版本。`node scripts/verify-p47-approved-historical-replay.mjs` 仅运行6组162项本地只读回放，不输出截图，所有参数（包括 `--capture`）均在启动浏览器前拒绝。捕获清单内的原 `pending-user-review` 保持不变，用户接续授权单独登记，不追改旧审批字段。

## 原始三图备份位置答复

目前无可验证的原始备份位置。原路径为 `output/playwright/p47-filter-pagination-current-review/baseline-390-filters-open.png`、`baseline-390-page-1.png`、`baseline-390-page-2.png`，这三处文件已被覆盖，不是备份。独立新图包与 `incident-overwritten` 分别是重建图和事故后副本，均不得标为原图。若以后取得原图，必须逐份匹配本记录保留的原SHA后才能认定恢复。
