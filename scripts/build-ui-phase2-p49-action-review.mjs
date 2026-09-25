import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const contract = `${base}/source-channel-credential-contract-review.md`;
const target = `${base}/action-reviews/P49.json`;
const testFile = "tests/unit/ui-phase2-p49-action-map.test.mjs";
const sourceFiles = [
  "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  "apps/web/src/components/ProviderAcceptanceExecution.vue",
  "apps/web/src/components/ProviderAcceptanceOperations.vue",
];

const definitions = [
  {
    actionId: "SC49-NAV",
    candidates: [
      "708367f1d5691c04.1",
      "16f98bc87eeb7bf3.1",
      "b3ddac540b01d0e1.1",
      "1f17b9f55d6b83f1.1",
    ],
    label: "进入既有登录档案或固定样本工作区",
    kind: "navigation",
    condition: "来源检查页提供对应下一步入口时。",
    handler:
      "沿用当前 provider_id 导航到凭证登录模式或 P48 来源样本目录；不在 P49 读取凭证、打开样本审批窗或执行启用。",
    remaining: "客户端目标路由不证明目标页角色授权或其中后续写入已通过。",
  },
  {
    actionId: "SC49-GATE-COPY",
    candidates: ["191135a63725390b.1"],
    label: "展开启用门口径说明",
    kind: "local",
    sourceContractKeys: ["检查门口径说明折叠；不新增业务动作"],
    contractAliasReason: "现有合同明确该 details 只展开静态口径文字，不是新的业务动作或门禁判定。",
    condition: "检查摘要栏可见。",
    handler: "切换原生 details 展开状态；不发请求、不改变服务端结论或来源状态。",
    remaining: "静态合同不替代对读屏器实际播报与窄屏排版的运行验收。",
  },
  {
    actionId: "SC49-LOAD",
    candidates: ["b39d5c4a0f3599f8.1", "a1d4481c811f2e52.1"],
    label: "读取或重读 1688 启用检查",
    kind: "read",
    condition: "页面初次挂载，或当前读取状态显示可用的重读入口时。",
    handler:
      "调用现有启用检查 GET；手动刷新和错误重试复用同一读取流程，不创建验收任务、不启用来源。",
    remaining: "映射不证明真实平台角色、MySQL 数据、请求超时策略或线上响应。",
  },
  {
    actionId: "SC49-DETAILS",
    candidates: [
      "71ad1e14ab5adcdd.1",
      "ff6d5fbc586803ed.1",
      "3454720e54e9d8c8.1",
      "78c1c9ecc2d9214c.1",
      "f617d68579969564.1",
    ],
    label: "按需展开检查、范围或运行追踪",
    kind: "local",
    condition: "页面存在相应读取编号、错误编号、范围请求编号或提交追踪信息时。",
    handler:
      "展开原生 details 展示该结果已有的关联编号；启用检查、范围读取与提交任务编号保持各自来源，不推导运行成功或启用成功。",
    remaining: "编号披露只核对当前 DOM 与映射，不代表服务端追踪系统或任务终态已验证。",
  },
  {
    actionId: "SC49-AUTH",
    candidates: ["5587941412d5210f.1", "441fd57e4a421b3a.1"],
    label: "按读取失败状态进入登录或平台概览",
    kind: "navigation",
    condition: "检查读取分别进入 expired 或 forbidden 状态时。",
    handler:
      "expired 导航到既有登录页，forbidden 导航到平台概览；不将403当作登录过期，也不尝试重放写请求。",
    remaining: "前端状态分流不能证明真实会话签发、角色授权或服务端访问控制。",
  },
  {
    actionId: "SC49-EXECUTION-WIRING",
    candidates: ["9dc337a873726e6c.1", "d7d20d959f3300b0.1"],
    label: "验收表单意图与既有父级处理器接线",
    kind: "wiring",
    sourceContractKeys: ["SC49-SCOPE/RUN / 范围、表单与既有验收提交子组件事件转发"],
    contractAliasReason:
      "原生表单只发出提交意图，宿主将组织变化、范围重读和提交意图接入现有父级处理器，不新增动作或写入通道。",
    condition: "P49 检查结果已读取并展示验收执行表单。",
    handler:
      "阻止原生表单提交；只把既有 submit、organization-change 和 retry-scopes 事件转给 useAlibaba1688Acceptance 所有的处理器。",
    forwardsTo: ["SC49-SCOPE-READ", "SC49-RUN"],
    remaining: "静态事件接线不证明真实 API、组织隔离、角色权限或浏览器任务已执行。",
  },
  {
    actionId: "SC49-ORG-WIRING",
    candidates: ["6b7a113037c90aeb.1"],
    label: "组织选择变化交由父级协调可用范围",
    kind: "wiring",
    sourceContractKeys: ["SC49-SCOPE / 组织选择变化交给父级协调范围"],
    contractAliasReason: "组织变化转交父级现有范围协调器；工作区值更新另行归为本地受控输入。",
    condition: "范围读取完成且对应选择器可用时。",
    handler: "保留 organization-change emit 事件并交给既有父级范围读取协调器，不提交验收任务。",
    forwardsTo: ["SC49-SCOPE-READ"],
    remaining: "隔离样例不证明生产账号实际可见的组织和工作区范围。",
  },
  {
    actionId: "SC49-WORKSPACE-INPUT",
    candidates: ["df6130602862326a.1"],
    label: "更新受控工作区选择值",
    kind: "local",
    sourceContractKeys: ["SC49-SCOPE / 工作区受控选择更新"],
    contractAliasReason: "该 update:workspaceId 只更新现有受控选择，不自行读取范围或创建验收任务。",
    condition: "可用工作区目录已读取，工作区选择器可用时。",
    handler: "向父组件发出既有 v-model 更新值；不把选择动作等同于验收任务提交。",
    remaining: "静态映射不证明真实服务端工作区归属或组织隔离。",
  },
  {
    actionId: "SC49-QUERY",
    candidates: ["e941099000a6691d.1"],
    label: "编辑本次验收关键词",
    kind: "local",
    sourceContractKeys: ["SC49-RUN / 验收关键词受控输入"],
    contractAliasReason: "合同将关键词作为受控表单字段；编辑值本身不调用 API，只有显式提交才安排验收运行。",
    condition: "验收表单可编辑且任务不在提交中。",
    handler: "保留最多 200 字的受控输入，交由父级提交时 trim；编辑不触发检查 GET 或任务 POST。",
    remaining: "源映射不替代真实浏览器输入法、错误提示和服务端字段验证。",
  },
  {
    actionId: "SC49-RUN",
    candidates: ["4d5599c177edbee1.1"],
    label: "发起一次受控 1688 登录验收运行",
    kind: "write",
    sourceContractKeys: ["SC49-RUN / 发起一次既有受控登录验收提交"],
    contractAliasReason: "此按钮只映射既有人工验收 POST；202 仅代表排队，不能合并为来源启用或采集成功。",
    condition: "provider、有效组织/工作区和非空关键词齐备，范围读取结束且不在提交中。",
    handler:
      "调用既有 scheduleAcceptanceRun，保留 organization_id、workspace_id、trim 后 query、acceptance_run:true、Origin 与 Idempotency-Key；仅接受排队/提交结果，不自动启用、轮询或在未知结果时重复 POST。",
    remaining: "此审计不批准真实外部浏览器任务；真实 RBAC、幂等、MySQL、队列终态和生产采集仍未验收。",
  },
  {
    actionId: "SC49-SCOPE-READ",
    candidates: ["91f41f7556925861.1"],
    label: "重读可用组织与工作区范围",
    kind: "read",
    sourceContractKeys: ["SC49-SCOPE / 请求父级重新读取组织与工作区范围"],
    contractAliasReason: "范围重读仅恢复既有组织/工作区读取，不读取来源门禁，也不创建验收任务。",
    condition: "组织/工作区读取失败且现有状态允许安全重试时。",
    handler: "发出既有 retry-scopes 意图，继续使用原范围读取与错误反馈流程。",
    remaining: "本地审计不证明真实组织成员关系过滤、默认工作区策略或范围接口权限。",
  },
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

export function buildP49ActionReview() {
  const sourceText = Object.fromEntries(sourceFiles.map((file) => [file, readSource(file)]));
  const sourceHashes = Object.fromEntries(
    Object.entries(sourceText).map(([file, source]) => [
      file,
      createHash("sha256").update(source).digest("hex"),
    ]),
  );
  const candidates = Object.entries(sourceText).flatMap(([file, source]) =>
    scanSource(source, file).candidates,
  );
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const records = runContractAudit().records.filter(
    (record) =>
      record.document === contract &&
      sourceFiles.includes(record.sourceFile) &&
      record.temporalScope !== "historical" &&
      ["identity-current", "line-moved"].includes(record.status),
  );
  const recordsById = new Map();
  for (const record of records) {
    const previous = recordsById.get(record.candidateId);
    if (previous)
      assert.equal(
        previous.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1),
        record.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1),
        `conflicting current P49 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(recordsById.size, candidates.length, "P49 sources require current contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );

  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      definition.candidates.map((signature) => [signature, definition.actionId]),
    ),
  );
  assert.equal(ownerBySignature.size, candidates.length, "each P49 candidate must have one owner");
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = ownerBySignature.get(signature);
    assert.ok(actionId, `unmapped P49 candidate ${record.candidateId}`);
    groups.get(actionId).push(record.candidateId);
    const claim = record.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1);
    claimsByGroup.get(actionId).push(claim);
  }

  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map((definition) => {
    const action = {
      actionId: definition.actionId,
      label: definition.label,
      kind: definition.kind,
      sourceCandidateIds: groups.get(definition.actionId).sort(),
      sourceContractKeys: [...new Set(claimsByGroup.get(definition.actionId))],
      contractAliasReason:
        definition.contractAliasReason ??
        `按既有SC49合同对${definition.actionId}的精确源码归属合并，不扩展页面动作或外部副作用。`,
      condition: definition.condition,
      handler: definition.handler,
      variants: ["current-route-source-contract"],
      scenes: [],
      visualStates,
      testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
      remaining: definition.remaining,
    };
    if (definition.forwardsTo) {
      action.forwardsTo = definition.forwardsTo;
      action.forwardBindings = action.sourceCandidateIds.flatMap((candidateId) => {
        const candidate = candidateById.get(candidateId);
        return Object.entries(candidate.events ?? {}).map(([event, handler]) => ({
          candidateId,
          event,
          handler,
          targets: action.forwardsTo,
        }));
      });
    }
    return action;
  });

  const inputs = {};
  for (const file of sourceFiles) {
    const surfaces = scanReviewSurfaces(sourceText[file], file);
    if (surfaces.inputs.length) inputs[file] = surfaces.inputs.map((input) => input.binding);
  }
  return {
    schemaVersion: 1,
    pageId: "P49",
    route: "/platform-admin/providers/sources/1688-acceptance",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes,
    inputs,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "P49页内使用门口径和诊断编号原生details展开，不定义业务弹窗；NavigationShell、通用移动详情与全局菜单属于共享消费者合同，不重复并入本页动作。",
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
        "本映射只覆盖P49的检查宿主、执行表单和下一步/技术详情组件；共享导航壳、响应式详情、发现浮层与其他来源目录消费者沿用各自页面合同。",
      ],
      remaining:
        "静态源映射不代表读屏、真实浏览器生命周期、KeepAlive缓存、运行焦点、服务端RBAC/MySQL、外部浏览器任务或M07-03生产验收通过。",
    },
    compositionGaps: [
      "逐项覆盖三个P49页面局部Vue组件的21个当前候选；共享导航及其他通用消费者不计入P49局部候选总数。",
      "仅登记现有检查读取、范围读取、人工验收排队、既有登录/固定样本导航和本地披露；不增加直接启用、任务轮询、停止任务或自动重试POST。",
      "用户视觉自动通过与源码语义映射分开记录；动作审批、真实角色授权、MySQL、队列终态、真实1688登录采集和正式M07-03签收仍未通过。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP49ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
