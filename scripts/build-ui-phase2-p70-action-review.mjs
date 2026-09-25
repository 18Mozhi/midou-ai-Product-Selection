import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/scheduler-capacity-contract-review.md`;
const target = `${base}/action-reviews/P70.json`;
const testFile = "tests/unit/ui-phase2-p70-action-review.test.mjs";
const sourceFiles = [
  "apps/web/src/components/CrawlerSchedulerCenter.vue",
  "apps/web/src/components/CrawlerSchedulerEvidence.vue",
];

const definitions = [
  [
    "SC70-LOAD",
    "read",
    "读取或刷新采集调度运行事实",
    ["8fbfd1dda992c36b.1"],
    "用户请求刷新当前采集调度/来源运行事实时。",
    "沿用GET、已应用查询参数、15秒前端/14秒API边界、单飞和现有快照归属；GET后有既有观测/审计写入，不称零写入。",
    "读取事实不等于执行任务、查询所有历史或验证真实Linux/Worker/Python运行身份。",
  ],
  [
    "SC70-RETRY",
    "read",
    "在调度事实读取失败后重新核验",
    ["4f73abdd0d99fc21.1", "ae52c30c28ab3a05.1"],
    "已有成功快照刷新失败，或首次读取进入可重试错误分支时。",
    "沿用当前已应用过滤/分页请求及读取所有权；重读不恢复租约或重放任务。",
    "重读不证明当前来源健康、实际Worker并发或回执完整。",
  ],
  [
    "SC70-FILTER",
    "local",
    "按来源代码和运行范围筛选当前来源列表",
    ["0767d27629b787d7.1", "1b581569d5d9e0d4.1"],
    "用户修改来源代码查询或选择 attention/open/queued/all 本地范围时。",
    "代码包含查询不区分大小写；每次输入/选择将本地页码回第一页。当前总量summary不随本地过滤改变，不扩展到租户或数据库过滤。",
    "本地筛选不重新读取、不改变服务端范围或任务状态。",
  ],
  [
    "SC70-PAGE",
    "local",
    "在当前已筛选来源结果中前后分页",
    ["d868a97237e89c1c.1", "3a29e19ec40c7562.1"],
    "当前本地筛选有多页结果，且目标页在边界内时。",
    "每页12项；沿既有熔断→排队数→连续失败→code排序；缩量时由当前逻辑钳制页号。",
    "本地分页不表示数据源总数、队列任务数或跨来源全局去重数。",
  ],
  [
    "SC70-EXPIRED",
    "write",
    "确认回收已过期调度租约",
    ["3c7b3b6045a144ee.1", "a00a70cca22f9831.1", "b107542a89a71d5c.1"],
    "用户打开现有影响预览，确认词通过并明确提交时。",
    "打开不写入，取消只关闭本地窗；确认后POST recover-expired body={}，由事务按提交时 expires_at<=now 重新筛选并只删除过期调度槽位，保留任务历史、租约和任务状态；使用既有同源/Idempotency-Key。",
    "失败/网络未知不证明未执行；操作不等同于删除任务、释放档案租约或重放采集。真实数据库锁、审计和权限仍待验。",
  ],
  [
    "SC70-PROVIDER-RECOVER",
    "write",
    "确认解除指定来源熔断",
    ["c07df29b8de46d08.1", "3c382eda5cb1d9ce.1", "9e9fa4a77b724507.1"],
    "用户对一个open来源打开确认窗，逐项核对实际provider目标并提交确认词时。",
    "取消只关闭本地窗；确认后POST /providers/:providerId/recover body={}，由服务再次检查enabled/open/最新ready健康时间，关闭失败计数与错误码并审计；不自动健康检查、不改变其他来源；复用同源/幂等合同。",
    "recovered=false、409、权限失败或网络未知不代表恢复已完成；对象code/ID在现有弹窗中的核对缺口保持待办，不改后端确认规则。",
  ],
  [
    "SC70-HEALTH",
    "navigation",
    "导航到指定来源适配器健康页",
    ["c198ccff780259e3.1"],
    "来源事实有真实provider ID且渲染既有href时。",
    "导航至 provider-adapters?provider_id=真实ID；目标路由再次授权，不自动运行健康检查。",
    "链接可见不证明健康已执行、来源当前可用或用户有权读取目标。",
  ],
  [
    "SC70-DETAIL",
    "local",
    "展开来源最近失败文本",
    ["dac6cbc2991374ba.1"],
    "来源返回last_failure时。",
    "仅披露本条来源的现有最近失败文本，不自动重试/解除熔断或复制原始凭证。",
    "失败文本不是完整日志，也不保证当前状态仍相同。",
  ],
  [
    "SC70-LEASE-TECH",
    "local",
    "展开当前活动租约技术标识",
    ["1d663944bdde1289.1"],
    "当前活动租约事实已返回且提供技术详情披露时。",
    "只展示当前响应中已存在的任务/进程及可选运行标识，不发请求、不续租、不回收。",
    "标识披露不表示任务仍运行、操作系统进程完整或可安全重放。",
  ],
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

function contractClaim(record) {
  return record.claim
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .at(-1);
}

export function buildP70ActionReview() {
  const sourceText = Object.fromEntries(sourceFiles.map((file) => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(
    Object.entries(sourceText).map(([file, source]) => [
      file,
      createHash("sha256").update(source).digest("hex"),
    ]),
  );
  const candidates = Object.entries(sourceText).flatMap(
    ([file, source]) => scanSource(source, file).candidates,
  );
  const records = runContractAudit().records.filter(
    (record) =>
      sourceFiles.includes(record.sourceFile) &&
      record.document === contract &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) {
    const previous = recordsById.get(record.candidateId);
    if (previous) assert.equal(contractClaim(previous), contractClaim(record));
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(
    recordsById.size,
    candidates.length,
    "P70 current local candidates need contract rows",
  );
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const owner = new Map(
    definitions.flatMap((definition) => definition[3].map((id) => [id, definition[0]])),
  );
  assert.equal(
    owner.size,
    candidates.length,
    "each P70 current candidate must have one semantic owner",
  );
  const groupedIds = new Map(definitions.map(([id]) => [id, []]));
  const groupedClaims = new Map(definitions.map(([id]) => [id, []]));
  for (const record of recordsById.values()) {
    const actionId = owner.get(record.candidateId.split("#")[1]);
    assert.ok(actionId, `unmapped P70 candidate ${record.candidateId}`);
    groupedIds.get(actionId).push(record.candidateId);
    groupedClaims.get(actionId).push(contractClaim(record));
  }

  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map(([actionId, kind, label, , condition, handler, remaining]) => ({
    actionId,
    kind,
    label,
    sourceCandidateIds: groupedIds.get(actionId).sort(),
    sourceContractKeys: [...new Set(groupedClaims.get(actionId))],
    contractAliasReason:
      "依据P70采集调度当前源候选与能力合同逐项归组；不扩大到未存在的任务执行控件。",
    condition,
    handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining,
  }));
  const inputs = {};
  for (const [file, source] of Object.entries(sourceText)) {
    const found = scanReviewSurfaces(source, file).inputs;
    if (found.length) inputs[file] = found.map((item) => item.binding);
  }

  return {
    schemaVersion: 1,
    pageId: "P70",
    route: "/platform-admin/crawler-scheduler",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    pageScopeExclusions: {
      sharedFiles: [
        {
          file: "apps/web/src/components/ConfirmDialog.vue",
          rationale:
            "共享确认词/影响说明/确认取消控件由共享合同归属；本页两处确认调用和事件候选各自保留在SC70动作中，不重复占用共享组件源码候选。",
        },
        {
          file: "apps/web/src/components/TechnicalDetails.vue",
          rationale:
            "请求ID详情/复制由共享组件合同归属；P70本地最近错误/租约details由页面组件直接承载。",
        },
        {
          file: "apps/web/src/components/PlatformManagementCenter.vue",
          rationale:
            "父级平台管理入口持有GET/权限/审计和跨域生命周期；不把父共享刷新重复计为P70页面候选。",
        },
      ],
      remaining:
        "两类确认窗的共享焦点/复制细节沿共享合同交叉引用；P70局部来源候选16项含共享对话事件接线，并非16个去重业务动作。",
    },
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "仅过期租约回收与单一来源熔断解除两个共享确认调用；打开/取消不POST，确认分别使用各自现有body={}端点。没有任务重放、档案租约改动、健康检查启动或历史删除窗。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: sourceFiles,
      dependencyHashes: sourceHashes,
      inputScope: "reviewed-subset-of-shared-source",
      inputs: [],
      containerScope: "reviewed-subset-of-shared-source",
      containers: [],
      sharedRemaining: [
        "筛选/分页/两个确认调用和租约details在P70当前源；ConfirmDialog及TechnicalDetails内部键盘/复制行为由共享合同覆盖。",
      ],
      remaining:
        "静态映射不证明实际队列并发/任务数、两恢复POST的MySQL锁/幂等审计、真实来源健康、RBAC或正式M08-05验收。",
    },
    compositionGaps: [
      "P70当前16个页内源码候选映射至9类语义动作；两个确认调用开窗/取消/提交事件分别归入对应恢复动作。",
      "回收仅处理当前到期调度槽位；来源解除只针对所选provider且不自动发健康检查；不改变任务历史、状态或其他来源。",
      "本地过滤和分页不等同服务端过滤/任务数量；GET可写既有观测/审计，不说成零写入。",
      "来源确认对象的code/ID显示缺口与未知POST结果待办保留；静态图及单测不替代实际数据库/权限验收。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP70ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
