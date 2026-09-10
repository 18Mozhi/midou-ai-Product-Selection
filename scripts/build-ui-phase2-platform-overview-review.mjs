import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { scanReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";

export const base = "design-plans/ui-phase-2-2026-09-07";
export const sourceFiles = [
  "PlatformDashboard",
  "ResponsiveDataView",
  "TableViewControls",
  "TechnicalDetails",
].map((n) => `apps/web/src/components/${n}.vue`);
export const parentFiles = [
  "apps/web/src/components/NavigationShell.vue",
  "apps/web/src/navigation-shell-route-state.ts",
  "config/route-catalog.json",
];
export const evidenceFile = "output/playwright/p38-entry-links/evidence.json";
export const contractFile = base + "/platform-overview-semantic-contract-review.md";
const pkg = "platform-overview-direction-c";
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
export const hash = (s) => createHash("sha256").update(s).digest("hex");
const ids = (i, ...s) => s.map((v) => sourceFiles[i] + "#" + v);
const remaining =
  "具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。";
// Explicit semantic groups; do not infer action identity from a matching label/signature.
const definitions = [
  [
    "WINDOW",
    "切换查看范围",
    "read",
    ids(0, "41083a84c60ec185.1"),
    "pending禁用；15m/24h/7d/30d",
    "changeWindow：保留其他query后replace，再load；历史同步见独立回归",
    ["window15m", "window7d", "window30d"],
  ],
  [
    "REFRESH",
    "刷新与两类重试",
    "read",
    ids(0, "15e83f4e8898e4d7.1", "17f7411f1727355d.1", "3569d8f0f015857e.1"),
    "页头/旧快照重试pending禁用；首读重试排除loading/expired/forbidden，没有disabled属性",
    "load：同窗单飞和12秒取消；ready失败保留快照，不代替权限验收",
    ["normal", "blocked", "refresh_failed", "refreshing"],
  ],
  [
    "LOGIN",
    "重新登录入口",
    "navigation",
    ids(0, "5587941412d5210f.1"),
    "首次读取expired分支",
    "RouterLink /login；不保证登录后返回",
    ["expired"],
  ],
  [
    "COLLECTION",
    "等待处理与查看任务",
    "navigation",
    ids(0, "65c09ba74ca8870b.1", "348b42f6f4eb388b.1"),
    "ready且data存在",
    "RouterLink /platform-admin/collection，两处独立入口",
    ["normal"],
  ],
  [
    "ROOTCAUSE",
    "需要关注入口",
    "navigation",
    ids(0, "d1c0b626714a7ff9.1"),
    "ready且data存在",
    "RouterLink /platform-admin/collection/overview?root_cause=1",
    ["normal"],
  ],
  [
    "ORGANIZATIONS",
    "查看组织与管理组织和用户",
    "navigation",
    ids(0, "52444eba9c2a98bc.1", "f84b8209be451866.1"),
    "ready且capabilities包含platform:superadmin",
    "RouterLink /platform-admin/organizations；入口显隐不等于后端鉴权",
    ["superadmin"],
  ],
  [
    "USERS",
    "查看用户",
    "navigation",
    ids(0, "c4dfc8f822a18263.1"),
    "ready且capabilities包含platform:superadmin",
    "RouterLink /platform-admin/users",
    ["superadmin"],
  ],
  [
    "SOURCES",
    "来源导航的三处变体",
    "navigation",
    ids(0, "06b4b917d7a90e96.1", "5074531b9e5b8a16.1", "ba487bb14816185a.1"),
    "事实/常用入口在ready；恢复入口额外要求趋势数组为空",
    "RouterLink /platform-admin/providers/sources；不是启停来源",
    ["normal", "trend"],
  ],
  [
    "DATA",
    "查看数据",
    "navigation",
    ids(0, "9ae1b37e258dde35.1"),
    "ready且data存在",
    "RouterLink /platform-admin/data；不是导出",
    ["normal"],
  ],
  [
    "QUEUE",
    "采集进度与无趋势恢复",
    "navigation",
    ids(0, "1ce54f6253c32ad1.1", "2e8c2f831b1b02a5.1"),
    "常用入口在ready；恢复入口额外要求趋势数组为空",
    "RouterLink /platform-admin/collection/overview，无root_cause参数",
    ["normal", "trend"],
  ],
  [
    "TECH",
    "来源与告警原生技术折叠",
    "local",
    ids(0, "1c008f867673db60.1", "1c008f867673db60.2"),
    "来源detail槽/告警循环内",
    "原生details，仅原始ID/code；不是共享请求编号复制，也不处理告警",
    ["technical", "alert_details"],
  ],
  [
    "PROVIDERS",
    "来源展开收起",
    "local",
    ids(0, "d604390773d9cd06.1"),
    "原始provider_health超过8项，aria-expanded绑定展开标记",
    "切换providerHealthExpanded；异常优先显示前8或全部，无额外GET",
    ["many_providers", "all_providers"],
  ],
  [
    "PREVIEW-OPEN",
    "手机记录预览",
    "local",
    ids(1, "6da4dad42cb34c8d.1"),
    "手机逐来源渲染，aria-haspopup=dialog",
    "show(row,event)记录触发器与selectedKey；不是详情路由",
    ["normal", "long_fields"],
  ],
  [
    "PREVIEW-CLOSE",
    "关闭与焦点循环",
    "local",
    ids(1, "c182428cb2c0ed66.1", "988131834dc4bd6f.1", "847801b2ac6e7a17.1"),
    "selected存在；遮罩tabindex=-1",
    "close清selectedKey；Esc关闭、Tab/Shift+Tab循环，关闭返焦；停用时清选择/旧触发器并释放背景，完整P38缓存链见lifecycleEvidence",
    ["normal", "long_fields"],
  ],
  [
    "PREVIEW-DIALOG",
    "共享预览容器关联",
    "wiring",
    ids(1, "a3c9be2acacfd788.1"),
    "selected存在，Teleport body",
    "section role=dialog、aria-modal；标题来自detailTitle(selected)，定义本身无事件",
    ["normal"],
  ],
  [
    "COLUMNS",
    "列设置展开",
    "local",
    ids(2, "e2fd0d02cbd9f684.1"),
    "表头列数大于1，桌面控制区",
    "原生details展开列选择",
    ["columns"],
  ],
  [
    "COLUMN-TOGGLE",
    "切换来源显示列",
    "local",
    ids(2, "921f4be18a3fe814.1"),
    "按列循环；已选且只剩1列时禁用",
    "toggleColumn改变hiddenColumns，不影响数据或服务端列",
    ["columns", "one_column"],
  ],
  [
    "FREEZE",
    "冻结首个可见列",
    "local",
    ids(2, "d09cd5524db7bee5.1"),
    "表头列数大于1，aria-pressed绑定freezeFirst",
    "切换freezeFirst，由watch应用首个可见列样式；不是固定第0列",
    ["normal", "unfrozen"],
  ],
  [
    "REQUEST-DETAILS",
    "共享请求技术详情",
    "local",
    ids(3, "b3ffca8eb967d682.1"),
    "rows非空；P38两处只传requestId",
    "原生details；组件通用trace/items不视为P38已有字段",
    ["technical", "blocked"],
  ],
  [
    "REQUEST-COPY",
    "复制请求编号",
    "local",
    ids(3, "c19091da9e2471f1.1"),
    "共享rows循环；P38只传requestId，无busy/disabled属性",
    "copy(label,value)原值写剪贴板，1500ms成功反馈；拒绝提示手动复制，旧回执隔离",
    ["copy_success", "copy_failed"],
  ],
];
export function readPlatformReviewInputs() {
  return {
    sources: Object.fromEntries([...sourceFiles, ...parentFiles].map((f) => [f, read(f)])),
    evidence: JSON.parse(read(evidenceFile)),
    packages: new Map([[pkg, JSON.parse(read(`${base}/design/${pkg}/evidence.json`))]]),
  };
}
export function buildPlatformReview(inputs) {
  const sourceHashes = Object.fromEntries(sourceFiles.map((f) => [f, hash(inputs.sources[f])]));
  const actions = definitions.map(
    ([id, label, kind, sourceCandidateIds, condition, handler, scenes]) => ({
      actionId: "PA38-" + id,
      label,
      kind,
      sourceCandidateIds,
      condition,
      handler,
      variants: sourceCandidateIds.map((id) => id.split("#")[1]),
      scenes: scenes.map((scene) => ({ package: pkg, scene })),
      visualStates: Object.fromEntries(
        ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [
          s,
          kind === "wiring" ? "not-applicable-wiring" : "not-mapped",
        ]),
      ),
      testReferences: [
        {
          file: "scripts/verify-ui-phase2-platform-overview-c.mjs",
          evidenceType: "offline-proposal-check-not-Vue",
        },
      ],
      remaining,
      ...(kind === "wiring"
        ? { forwardsTo: ["PA38-PREVIEW-OPEN", "PA38-PREVIEW-CLOSE"], forwardBindings: [] }
        : {}),
    }),
  );
  const scanned = sourceFiles.map((f) =>
    scanReviewSurfaces(inputs.sources[f], f, { includeStructuralContainers: true }),
  );
  const fields = scanned
    .flatMap((s) => s.inputs)
    .map((i) => ({
      ...i,
      meaning:
        i.binding === "windowCode"
          ? "现有四时间窗；URL replace保留其他查询；pending时禁用"
          : "表格密度standard/compact，经v-model和watch本地应用；无显式事件签名，不冒充扫描动作候选",
      remaining,
    }));
  const navigationIds = actions
    .filter((a) => a.kind === "navigation")
    .flatMap((a) => a.sourceCandidateIds);
  return structuredClone({
    schemaVersion: 1,
    pageId: "P38",
    route: "/platform-admin",
    status: "source-reviewed-not-runtime-accepted",
    approval: "pending-user-review",
    contract: contractFile,
    sourceHashes,
    actions,
    inputs: Object.fromEntries(
      sourceFiles.map((f) => [
        path.posix.basename(f),
        fields.filter((i) => i.file === f).map((i) => i.binding),
      ]),
    ),
    dialogs: {
      kind: "local-callers-and-listed-shared-only",
      remaining:
        "只有来源手机共享预览，无本页业务写入确认；共享role=dialog定义另列关联组，不能漏计或重复算写入。",
    },
    surfaceReview: {
      status: "source-reviewed-not-runtime-accepted",
      files: sourceFiles,
      includeStructuralContainers: true,
      dependencyHashes: sourceHashes,
      inputs: fields,
      containers: scanned
        .flatMap((s) => s.containers)
        .map((c) => ({
          ...c,
          sourceBehavior:
            "PlatformDashboard的ResponsiveDataView传可见来源行；桌面四列表格、手机summary/detail槽，无额外GET",
          remaining,
          variants: ["normal", "unknown_provider", "long_fields"].map((scene) => ({
            name: scene,
            evidenceScope: "related-scene-only",
            scenes: [{ package: pkg, scene }],
            remaining,
          })),
        })),
      sharedRemaining: [
        "共享组件仅核对本页消费者，不推广为其他页面验收。",
        "密度是独立模型驱动交互，不因动作扫描器不收集纯v-model而省略。",
        "role=dialog定义由候选扫描器登记，不冒充结构容器扫描器的额外结果。",
      ],
    },
    parentWiring: {
      files: parentFiles,
      dependencyHashes: Object.fromEntries(parentFiles.map((f) => [f, hash(inputs.sources[f])])),
      routeName: "platform-overview",
      surface: "platform-dashboard",
      component: "PlatformDashboard",
      props: { apiBaseUrl: "input.apiBaseUrl", capabilities: "input.capabilities" },
      sourcePath:
        "route.meta.surface → surfaceComponents → lazy(PlatformDashboard) → KeepAlive component; selectedSurfaceProps由surfaceProps传递allCapabilities",
      boundary:
        "入口图夹具未挂载完整父壳；独立lifecycleEvidence覆盖实际P38与来源频道缓存往返，不覆盖真实登录/RBAC或所有父壳路径。",
    },
    actualEntryEvidence: {
      file: evidenceFile,
      sha256: hash(read(evidenceFile)),
      sourceCandidateIds: navigationIds,
      sourceSites: 13,
      checks: 20,
      clickedInstances: 52,
      screenshots: 8,
      scope: "related-composition-not-per-control-state-acceptance",
      approval: "pending",
    },
    lifecycleEvidence: {
      file: "output/playwright/p38-shell-lifecycle/current/evidence.json",
      sha256: hash(read("output/playwright/p38-shell-lifecycle/current/evidence.json")),
      report: base + "/P38-SHELL-LIFECYCLE-REVIEW.md",
      scope: "actual-App-NavigationShell-KeepAlive-fixture-P38-to-provider-source-only",
      approval: "not-requested-current-behavior-evidence",
    },
    compositionGaps: [
      "8张入口组合待审，不填充通用六态，也不抵扣其他未审构图。",
      "ready刷新401/403旧快照展示策略已询问、待用户决策；本轮保持现状。",
      "除P38至来源频道缓存往返外，其他父壳/KeepAlive、真实角色与目标页业务、全主题/密度/缩放和生产验收仍待完成。",
    ],
    limits: [
      remaining,
      "0类页面写入动作不等于GET无数据库副作用：真实读取写入平台观测与审计。本轮只mock GET，不接触数据库。",
      "P38页面源/CSS不改；共享详情窗仅修复停用清理，见lifecycleEvidence。API/OpenAPI、环境、依赖或权限不变；本轮无部署/重启。",
    ],
  });
}
export function renderPlatformContract(review, inputs) {
  const candidates = sourceFiles.flatMap((f) => scanSource(inputs.sources[f], f).candidates);
  let md =
    "# P38 当前来源到交互的对应合同\n\n范围：四个实际Vue文件；待用户审核，不代表全部按钮状态、父壳、权限或生产通过。由build-ui-phase2-platform-overview-review.mjs生成；业务含义人工明确，签名仅作来源身份。\n\n## 来源哈希\n\n| 文件 | LF SHA256 |\n| --- | --- |\n";
  for (const [f, sha] of Object.entries(review.sourceHashes)) md += `| ${f} | ${sha} |\n`;
  md +=
    "\n## 逐来源位置\n\n| 来源身份 | 行 | 类别 | 含义 | 合同组 |\n| --- | --- | --- | --- | --- |\n";
  for (const c of candidates) {
    const a = review.actions.find((a) => a.sourceCandidateIds.includes(c.candidateId));
    assert.ok(a, "unmapped candidate");
    md += `| ${c.candidateId} | ${c.line} | ${c.kind} | ${a.label} | ${a.actionId} |\n`;
  }
  md +=
    "\n## 口径\n\n30个源位置归并20组：19组页面交互、1组预览定义关联、0类页面写入。另有windowCode/density两处模型；密度没有显式事件签名，不因此遗漏。共享预览包含打开、关闭、Esc、Tab循环及返焦；不是新增业务确认。P38只传共享requestId，来源和告警原生技术折叠不带复制。\n\n[机器映射](action-reviews/P38.json)保存条件、handler、模型、3个来源容器变体和全部待验项。[本轮实际入口图与验证](P38-SEMANTIC-IMPLEMENTATION-MAP.md)保留独立证据类型，不自动填满六态。\n";
  return md;
}
export function validatePlatformReview(review, inputs) {
  assert.deepEqual(review, buildPlatformReview(inputs), "P38 registry drift");
  const candidates = sourceFiles.flatMap((f) => scanSource(inputs.sources[f], f).candidates);
  assert.equal(candidates.length, 30);
  assert.deepEqual(
    review.actions.flatMap((a) => a.sourceCandidateIds).sort(),
    candidates.map((c) => c.candidateId).sort(),
  );
  const shell = inputs.sources[parentFiles[0]].replace(/\s+/g, " ");
  for (const fragment of [
    '"platform-dashboard": lazy("PlatformDashboard")',
    'const activeSurface = computed(() => String(route.meta.surface ?? ""))',
    "surfaceComponents[activeSurface.value] ?? null",
    "capabilities: allCapabilities.value",
    '<template v-else-if="routeAllowed">',
    '<KeepAlive :max="12">',
    ':is="selectedSurfaceComponent"',
    ':key="surfaceCacheKey"',
    'v-bind="selectedSurfaceProps"',
  ])
    assert.ok(shell.includes(fragment), "parent wiring changed: " + fragment);
  assert.match(
    shell,
    /selectedSurfaceProps = computed<Record<string, unknown>>\(\(\) => surfaceProps\(\{/,
  );
  assert.match(
    inputs.sources[parentFiles[1]],
    /case "platform-dashboard":\s*return \{ \.\.\.common, capabilities: input.capabilities \};/,
  );
  const route = JSON.parse(inputs.sources[parentFiles[2]]).routes.find(
    (r) => r.path === review.route,
  );
  assert.equal(route.name, "platform-overview");
  assert.equal(route.surface, "platform-dashboard");
  assert.equal(route.cachePolicy, "preserve");
  const e = inputs.evidence;
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 20);
  assert.equal(e.navigation.length, 52);
  assert.equal(e.screenshots.length, 8);
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(f)), sha, "evidence source drift: " + f);
  const nav = candidates.filter((c) => c.tag === "RouterLink");
  assert.equal(nav.length, 13);
  for (const width of [390, 760, 761, 1440]) {
    assert.equal(e.checks.filter((c) => c.width === width).length, 5);
    assert.deepEqual(
      e.navigation
        .filter((n) => n.width === width)
        .map((n) => n.href)
        .sort(),
      nav.map((n) => n.attributes.to).sort(),
    );
  }
  for (const width of [390, 1440])
    for (const state of [
      "operate-facts",
      "operate-shortcuts",
      "superadmin-facts",
      "superadmin-shortcuts",
    ]) {
      const shots = e.screenshots.filter((s) => s.viewport.width === width && s.state === state);
      assert.equal(shots.length, 1);
      const s = shots[0],
        bytes = readFileSync(path.posix.dirname(evidenceFile) + "/" + s.file);
      assert.equal(hash(bytes), s.sha256);
      assert.equal(s.kind, "vue-isolated");
      assert.equal(s.approval, "pending");
      assert.equal(s.imageDimensions.width, bytes.readUInt32BE(16));
      assert.equal(s.imageDimensions.height, bytes.readUInt32BE(20));
      assert.ok(s.browser && s.font && s.os && s.capturedAt);
    }
  return {
    sourceSites: 30,
    semanticGroups: 20,
    routeActions: 19,
    wiringGroups: 1,
    writeActions: 0,
    modelBindings: 2,
    entryChecks: 20,
    clickedInstances: 52,
    newImages: 8,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every((a) => ["--write", "--check"].includes(a)));
  const inputs = readPlatformReviewInputs(),
    review = buildPlatformReview(inputs);
  const result = validatePlatformReview(review, inputs);
  for (const [file, value] of [
    [base + "/action-reviews/P38.json", JSON.stringify(review, null, 2) + "\n"],
    [contractFile, renderPlatformContract(review, inputs)],
  ]) {
    if (process.argv.includes("--write")) writeFileSync(file, value);
    else assert.equal(read(file), value, "generated review drift");
  }
  console.log(JSON.stringify({ ...result, approval: review.approval }));
}
