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
const target = `${base}/action-reviews/P50.json`;
const testFile = "tests/unit/ui-phase2-p50-action-map.test.mjs";
const sourceFile = "apps/web/src/components/CredentialAssetCenter.vue";

const definitions = [
  {
    actionId: "SC50-LOAD",
    candidates: ["4cff98e257b4af2d.1", "466d5492514f7a0e.1"],
    label: "读取或刷新凭证与运行档案元数据",
    kind: "read",
    condition: "页面挂载，或用户显式刷新/在可重试失败面板选择重读时。",
    handler:
      "并行调用既有凭证资产、运行档案和来源选项 GET；仅三者均成功后替换快照。刷新失败保留上次成功读取的数据，超时/失败提示及关联编号仍沿用原流程。",
    remaining: "静态映射不证明真实平台角色、服务端数据完整性、加密存储或生产超时表现。",
  },
  {
    actionId: "SC50-ASSET-OPEN",
    candidates: ["07c8680b127235e2.1", "343034ee456c8020.1"],
    label: "打开凭证资产创建表单",
    kind: "local",
    condition: "资产创建入口可见且无凭证写入正在进行。",
    handler:
      "初始化既有资产表单并打开共享原生编辑窗；空资产提示入口与页头入口进入同一创建路径，不写入数据库。",
    remaining: "映射不证明真实表单有效性、真实密文或服务端授权。",
  },
  {
    actionId: "SC50-PROFILE-OPEN",
    candidates: ["da51ee773f1eb5e2.1"],
    label: "打开运行档案关联表单",
    kind: "local",
    condition: "当前用户可创建运行档案引用且页面没有敏感写入在途。",
    handler:
      "打开既有新建档案表单；使用现有默认值和当前可关联资产候选，不读取秘密或直接启用来源。",
    remaining: "前端入口不证明真实角色可见范围、档案状态或加密资产关联权限。",
  },
  {
    actionId: "SC50-LOGIN-OPEN",
    candidates: ["3216d7209881fb86.1"],
    label: "打开指定来源网页登录材料导入",
    kind: "local",
    condition: "来源存在既有登录材料入口且写入流程空闲时。",
    handler: "按当前来源打开既有登录导入流程并清理旧材料上下文，不读取或展示已有Cookie明文。",
    remaining: "真实来源、扩展通讯和服务端凭证授权仍需独立验证。",
  },
  {
    actionId: "SC50-ROTATE-TARGET",
    candidates: ["99e8924082a7d684.1"],
    label: "选择当前资产作为轮换目标",
    kind: "local",
    condition: "资产行提供轮换入口，且当前无其他写入占用。",
    handler: "将现有资产和版本交给共用轮换表单；此步只选择目标，不提交轮换。",
    remaining: "目标选择不证明后端版本竞争或轮换副作用。",
  },
  {
    actionId: "SC50-EDITOR-DIALOG",
    candidates: ["f9aa4f7cabe04961.1", "efc208b3291dd2c0.1"],
    label: "承载资产、轮换、档案与登录编辑窗",
    kind: "local",
    sourceContractKeys: [
      "SC50-ASSET/ROTATE/PROFILE/LOGIN / 资产、档案和网页登录共用原生模态容器",
      "SC50-CLOSE / 原生取消与遮罩关闭转发到既有 closeEditor",
    ],
    contractAliasReason:
      "dialog定义与原生取消/遮罩接线共享一个既有编辑器容器；关闭守卫由父级closeEditor控制，未增加写路径。",
    condition: "资产创建/轮换、档案关联或网页登录导入之一打开时。",
    handler: "使用当前原生dialog和closeEditor；写入忙碌时沿用现有关闭保护。",
    remaining: "DOM焦点、浏览器遮罩和共享确认窗内部行为不是该源码映射的验收结果。",
  },
  {
    actionId: "SC50-ASSET-FORM",
    candidates: ["fcfad5327d89010f.1"],
    label: "校验并提交凭证创建或轮换表单",
    kind: "write",
    sourceContractKeys: ["SC50-ASSET/ROTATE / 字段无效反馈、Tab循环与既有保存提交"],
    contractAliasReason: "同一原生表单在资产创建和轮换两种既有模式间切换；表单提交仍调用各自原处理器。",
    condition: "表单字段满足现有原生校验，且凭证写协调器未被占用。",
    handler:
      "保留创建/轮换现有字段、expected_version、幂等和写后读取语义；提交拒绝/冲突按当前字段与消息处理，不自动重复写入。",
    remaining: "本映射不执行真实密钥写入，也不证明 MySQL 事务、版本冲突或下游自动重放。",
  },
  {
    actionId: "SC50-ASSET-VALIDATION",
    candidates: [
      "3b5333f821fbebcc.1",
      "f0de1dd230399061.1",
      "db8f358359d81455.1",
    ],
    label: "清除凭证字段的过期原生错误",
    kind: "local",
    condition: "资产/轮换字段发生符合现有事件绑定的值变化时。",
    handler: "仅更新对应字段的原生错误/焦点状态，不清除其他字段错误或触发提交。",
    remaining: "映射不构成浏览器、读屏器及真实密文表单的无障碍认证。",
  },
  {
    actionId: "SC50-ASSET-SAVE",
    candidates: ["584e25b2c7498fe2.1"],
    label: "保存新凭证或轮换已有凭证",
    kind: "write",
    sourceContractKeys: ["SC50-ASSET/ROTATE / 按原资产表单保存或轮换加密资料"],
    contractAliasReason: "按钮按当前编辑模式调用现有资产创建或轮换服务，不替换请求字段和预期版本。",
    condition: "资产表单合法且目标资产/写入版本仍符合现有服务条件时。",
    handler:
      "按现有创建/轮换服务保存密文材料；轮换可能使旧密钥失效并触发合同规定的下游行为，页面不把提交本身报告为采集成功。",
    remaining: "本映射不执行真实秘密写入、外部采集、密钥轮换或生产审计验证。",
  },
  {
    actionId: "SC50-PROFILE-FORM",
    candidates: ["49e83794fc69aec5.1"],
    label: "校验并提交运行档案引用表单",
    kind: "write",
    sourceContractKeys: ["SC50-PROFILE / 字段无效反馈、Tab循环与既有档案关联提交"],
    contractAliasReason: "该表单只创建当前凭证资产的运行档案引用，并保留原字段默认值与既有提交函数。",
    condition: "当前资产引用与档案字段通过原生校验，且无写入占用。",
    handler: "沿用创建档案引用的现有 POST 与幂等/写后读取处理；默认disabled状态不被映射或修改。",
    remaining: "本地映射不证明资产归属校验、真实RBAC或数据库关联约束。",
  },
  {
    actionId: "SC50-PROFILE-VALIDATION",
    candidates: [
      "56cda485ff9a67e1.1",
      "118e781b0120c4b2.1",
      "2ddf54204f452511.1",
      "6bd7eed22ff8851d.1",
      "7550a9de2696128b.1",
    ],
    label: "更新档案字段并同步现有资产来源",
    kind: "local",
    condition: "档案表单中资产引用或字段值发生变化时。",
    handler:
      "按现有事件绑定更新所选资产推导出的provider_id、标识、名称、语言、时区及字段原生错误状态；不增加档案状态或启用规则。",
    remaining: "静态字段归组不验证真实来源/资产一致性或账号权限。",
  },
  {
    actionId: "SC50-PROFILE-SAVE",
    candidates: ["98e4c1aff937289a.1"],
    label: "保存新的运行档案引用",
    kind: "write",
    sourceContractKeys: ["SC50-PROFILE / 按原档案表单保存关联"],
    contractAliasReason: "仅创建现有档案引用；不代表登录凭证已验证或来源可运行。",
    condition: "档案引用字段合法，且当前没有其他敏感写入占用。",
    handler:
      "向现有crawler-profiles服务提交当前档案字段；保留原默认disabled、browser_family和写后读取反馈。",
    remaining: "本映射不执行真实档案创建或验证来源登录状态。",
  },
  {
    actionId: "SC50-LOGIN-CONTEXT",
    candidates: ["d2a64908945092ff.1", "1430f57a236d6ea1.1"],
    label: "切换登录来源或材料导入方式",
    kind: "local",
    condition: "登录材料编辑器打开且未处于保存阶段时。",
    handler: "按当前source/mode变化使旧本地材料作废并清除文件名/载荷，不复用跨来源或跨方式材料。",
    remaining: "真实跨实例竞态和扩展中的秘密清理需要真实浏览器/扩展验证。",
  },
  {
    actionId: "SC50-FILE",
    candidates: ["7443d228a98eebd4.1"],
    label: "选择本地登录材料文件",
    kind: "local",
    sourceContractKeys: ["SC50-FILE / 受控文件选择"],
    contractAliasReason: "文件只进入现有登录导入内存流程并受既有扩展名、大小和来源校验，不上传至新通道。",
    condition: "登录表单允许选取与当前导入方式匹配的文件时。",
    handler:
      "保留Cookie文件与完整浏览器档案各自既有限制，使用原FileReader读取，并在来源/方式/窗体上下文变化时清理载荷。",
    remaining: "不会读取真实用户文件；本映射不是文件内容、Cookie域或密文存储验证。",
  },
  {
    actionId: "SC50-LOGIN-SAVE",
    candidates: ["92da9f015f800722.1", "a6de35af2d13a51e.1"],
    label: "按既有两阶段流程保存登录材料与运行档案",
    kind: "write",
    sourceContractKeys: [
      "SC50-LOGIN / 登录材料窗Tab循环与既有两步保存提交",
      "SC50-LOGIN / 按当前来源、材料与阶段状态提交既有加密导入流程",
    ],
    contractAliasReason:
      "表单提交与显式提交按钮同属既有两阶段导入：先保存加密资产，再创建运行档案；第二步失败不回滚第一步。",
    condition: "当前来源、材料类型及载荷通过既有前端检查，且没有在途凭证写入。",
    handler:
      "保留现有资产POST后再运行档案POST的顺序、幂等和部分成功/未知结果提示；不自动重提、不宣称来源已登录或已启用。",
    remaining: "本映射不调用真实浏览器助手、上传文件、写入加密资产或创建运行档案。",
  },
  {
    actionId: "SC50-CLOSE",
    candidates: [
      "a75910143d18b017.1",
      "2f453887d0cc66db.1",
      "785d60d74b62708a.1",
      "2f453887d0cc66db.2",
      "d86a0656a93bd973.1",
      "148e132f8526cb9d.1",
    ],
    label: "关闭或取消凭证、档案与登录编辑窗",
    kind: "local",
    condition: "相应编辑器已打开且父级现有关闭守卫允许关闭。",
    handler: "调用当前closeEditor或保留既有取消行为，清理材料/字段错误并关闭窗体；写入忙碌时拒绝关闭。",
    remaining: "触发焦点返回、遮罩与Escape的真实浏览器表现需单独验收。",
  },
  {
    actionId: "SC50-REVOKE",
    candidates: [
      "a244801ec79346ec.1",
      "5eca67d4ff8b7b15.1",
      "cb14d6dea1ed210f.1",
    ],
    label: "确认撤销选定凭证资产",
    kind: "write",
    sourceContractKeys: [
      "SC50-REVOKE / 将当前资产设为撤销确认目标",
      "SC50-REVOKE / 取消与确认事件交给父级现有撤销处理函数",
      "SC50-REVOKE / 调用共享危险确认窗；不另计撤销写动作",
    ],
    contractAliasReason:
      "行入口只选定目标，共享ConfirmDialog确认后执行同一既有撤销处理；取消/弹窗调用是该单一撤销动作的UI接线。",
    condition: "目标资产可撤销，用户在既有危险确认窗确认固定影响说明后。",
    handler:
      "保留勾选影响确认、输入‘确认撤销’、expected_version及固定reason的既有POST；取消/Escape不写入，成功只说明资产撤销，不删除历史密文或审计。",
    remaining: "本映射不执行真实撤销，不证明MySQL版本竞争、角色授权、历史保留或下游消费者行为。",
  },
  {
    actionId: "SC50-HELPER-DOWNLOAD",
    candidates: ["889e842f4791c19d.1"],
    label: "下载站点提供的浏览器助手压缩包",
    kind: "local",
    sourceContractKeys: ["SC50-BRIDGE / 下载浏览器助手"],
    contractAliasReason: "锚点下载本站既有助手包；不触发安装、授权或读取Cookie。",
    condition: "登录材料区显示助手下载入口时。",
    handler: "由浏览器下载既有静态ZIP文件，不调用凭证API或更改服务器数据。",
    remaining: "此审阅不下载、安装、运行或验证真实浏览器扩展。",
  },
  {
    actionId: "SC50-HELPER-COOKIE",
    candidates: ["f176fdb4640192de.1"],
    label: "向已安装浏览器助手请求当前来源Cookie",
    kind: "write",
    sourceContractKeys: ["SC50-BRIDGE / 请求助手Cookie"],
    contractAliasReason: "按钮会与真实浏览器助手交互并读取所选来源域材料，不是本地纯展示动作。",
    condition: "用户主动请求且当前来源/模式允许助手读取时。",
    handler:
      "通过现有助手消息/来源域与超时合同请求材料，只写入当前表单内存；来源/模式变化、关闭或卸载时清除材料，不自动保存。",
    remaining: "测试映射不授权真实Cookie读取，也不证明浏览器扩展来源隔离或秘密生命周期。",
  },
  {
    actionId: "SC50-EXTERNAL",
    candidates: ["e22b7ca36f2434d7.1"],
    label: "打开既有来源登录页面",
    kind: "navigation",
    sourceContractKeys: ["SC50-EXTERNAL / 打开来源登录页"],
    contractAliasReason: "该链接仅导航到当前来源已登记页面，不读取或注入Cookie。",
    condition: "登录材料窗存在有效当前来源并显示其登录页入口时。",
    handler: "打开来源已有登录URL；不代替用户登录、不规避验证或站点策略。",
    remaining: "外部页面可用性、站点条款与真实登录流程不在本地源映射验收内。",
  },
  {
    actionId: "SC50-TECH",
    candidates: ["1c008f867673db60.1"],
    label: "展开来源代码技术信息",
    kind: "local",
    sourceContractKeys: ["SC50-TECH / 展开来源代码技术详情"],
    contractAliasReason: "该details仅披露当前来源的技术字段，不调用读取或写入API。",
    condition: "资产来源行提供技术信息展开入口时。",
    handler: "切换原生details内容可见性，不读取明文或改变来源设置。",
    remaining: "静态映射不验证屏幕阅读器输出或用户数据展示范围。",
  },
];

function readSource(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

export function buildP50ActionReview() {
  const source = readSource(sourceFile);
  const sourceHash = createHash("sha256").update(source).digest("hex");
  const candidates = scanSource(source, sourceFile).candidates;
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const records = runContractAudit().records.filter(
    (record) =>
      record.document === contract &&
      record.sourceFile === sourceFile &&
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
        `conflicting current P50 contract for ${record.candidateId}`,
      );
    else recordsById.set(record.candidateId, record);
  }
  assert.equal(recordsById.size, candidates.length, "P50 source requires current contract rows");
  assert.deepEqual(
    [...recordsById.keys()].sort(),
    candidates.map((candidate) => candidate.candidateId).sort(),
  );
  const ownerBySignature = new Map(
    definitions.flatMap((definition) =>
      definition.candidates.map((signature) => [signature, definition.actionId]),
    ),
  );
  assert.equal(ownerBySignature.size, candidates.length, "each P50 candidate must have one owner");

  const groups = new Map(definitions.map((definition) => [definition.actionId, []]));
  const claimsByGroup = new Map(definitions.map((definition) => [definition.actionId, []]));
  for (const record of recordsById.values()) {
    const signature = record.candidateId.split("#")[1];
    const actionId = ownerBySignature.get(signature);
    assert.ok(actionId, `unmapped P50 candidate ${record.candidateId}`);
    groups.get(actionId).push(record.candidateId);
    claimsByGroup
      .get(actionId)
      .push(record.claim.split("|").map((cell) => cell.trim()).filter(Boolean).at(-1));
  }
  const visualStates = Object.fromEntries(
    ["default", "hover", "focus", "pressed", "disabled", "busy"].map((state) => [
      state,
      "not-mapped",
    ]),
  );
  const actions = definitions.map((definition) => ({
    actionId: definition.actionId,
    label: definition.label,
    kind: definition.kind,
    sourceCandidateIds: groups.get(definition.actionId).sort(),
    sourceContractKeys:
      definition.sourceContractKeys ?? [...new Set(claimsByGroup.get(definition.actionId))],
    contractAliasReason:
      definition.contractAliasReason ??
      `按既有SC50合同对${definition.actionId}的精确源码归属合并，不扩展凭证、档案、登录或撤销行为。`,
    condition: definition.condition,
    handler: definition.handler,
    variants: ["current-route-source-contract"],
    scenes: [],
    visualStates,
    testReferences: [{ file: testFile, evidenceType: "offline-proposal-check-not-Vue" }],
    remaining: definition.remaining,
  }));
  const surfaces = scanReviewSurfaces(source, sourceFile);
  const inputs = surfaces.inputs.length ? { [sourceFile]: surfaces.inputs.map((x) => x.binding) } : {};
  return {
    schemaVersion: 1,
    pageId: "P50",
    route: "/platform-admin/credentials",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    actionApproval: "pending-user-review",
    visualApproval: "user-approved-remaining-pages-auto",
    contract,
    sourceHashes: { [sourceFile]: sourceHash },
    inputs,
    actions,
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "资产创建/轮换共用一个原生dialog，运行档案与登录导入另有两个原生dialog；凭证撤销调用共享ConfirmDialog，兼容矩阵移动详情由ResponsiveDataView承载，后两者内部状态不由本映射冒领。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: [sourceFile],
      dependencyHashes: { [sourceFile]: sourceHash },
      inputScope: "reviewed-subset-of-shared-source",
      inputs: [],
      containerScope: "reviewed-subset-of-shared-source",
      containers: [],
      sharedRemaining: [
        "本映射只覆盖凭证台账页面宿主；共享ConfirmDialog、ResponsiveDataView、ProviderRuntimeSurface和NavigationShell内部交互沿用各自合同。",
      ],
      remaining:
        "源码映射不代表真实扩展/文件材料、Cookie、密文、MySQL、平台RBAC、跨实例写入或生产环境验收通过。",
    },
    compositionGaps: [
      "逐项覆盖CredentialAssetCenter.vue的39个当前扫描候选；既有共享弹窗、移动详情和导航壳内部候选不重复并入页面宿主计数。",
      "资产创建/轮换、运行档案、网页登录导入与撤销保留既有独立写入边界；下载、打开外部登录页和请求助手Cookie均作为不同动作审阅。",
      "用户视觉自动通过与动作映射分开记录；动作审批、全状态真实交互、RBAC/MySQL、外部扩展和M07-03仍未通过。",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = JSON.stringify(buildP50ActionReview(), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync(target, output, "utf8");
  else process.stdout.write(output);
}
