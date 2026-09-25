import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
import { scanReviewSurfaces, validateReviewSurfaces } from "./lib/ui-phase2-review-surfaces.mjs";
import {
  validateActionReview,
  reconcileActionCandidates,
} from "./lib/ui-phase2-action-coverage.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
assert.ok(process.argv.slice(2).every((a) => a === "--write"));
const write = process.argv.includes("--write"),
  hashes = {};
const hash = (s) => createHash("sha256").update(s).digest("hex");
function read(file) {
  const s = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  hashes[file] = hash(s);
  return s;
}
const json = (file) => JSON.parse(read(file));
const historical = [
  ...json(base + "/actions.json").candidates,
  ...json(base + "/dialogs.json").candidates,
];
const coverage = json(base + "/coverage.json"),
  catalog = json("config/route-catalog.json");
const sources = {},
  candidates = [];
function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    assert.ok(!e.isSymbolicLink());
    const file = dir + "/" + e.name;
    if (e.isDirectory()) collect(file);
    else if (/\.(vue|ts)$/.test(e.name)) {
      sources[file] = read(file);
      candidates.push(...scanSource(sources[file], file).candidates);
    }
  }
}
collect("apps/web/src");
const contracts = runContractAudit();
assert.equal(contracts.summary.sourceCandidates, candidates.length);
assert.equal(contracts.summary.unreferencedCandidates, 0);
assert.deepEqual(contracts.pages.issues, []);
for (const d of contracts.documents) read(d.file);
const packages = new Map();
for (const e of readdirSync(base + "/design", { withFileTypes: true }).filter(
  (d) => d.isDirectory() && d.name.includes("-direction-c"),
)) {
  packages.set(e.name, json(base + "/design/" + e.name + "/evidence.json"));
}
const reviews = [],
  reviewSummaries = [];
for (const name of readdirSync(base + "/action-reviews")
  .filter((n) => /^P\d{2}\.json$/.test(n))
  .sort()) {
  const review = json(base + "/action-reviews/" + name);
  assert.equal(name, review.pageId + ".json");
  const route = coverage.pages.find((p) => p.id === review.pageId);
  assert.equal(route?.path, review.route);
  const files = new Set();
  for (const file of Object.keys(review.sourceHashes)) read(file);
  for (const a of review.actions)
    for (const ref of a.testReferences) {
      read(ref.file);
      files.add(ref.file);
    }
  for (const bindings of Object.values(review.inputs))
    for (const binding of bindings)
      assert.ok(
        Object.keys(review.sourceHashes).some(
          (file) =>
            file.endsWith(".vue") &&
            scanReviewSurfaces(sources[file], file).inputs.some(
              (input) => input.binding === binding,
            ),
        ),
        "unknown input binding " + binding,
      );
  reviewSummaries.push(
    validateActionReview(review, {
      candidates,
      sourceHashes: hashes,
      contracts: contracts.records,
      packages,
      files,
    }),
  );
  if (review.surfaceReview) {
    for (const file of Object.keys(review.surfaceReview.dependencyHashes)) read(file);
    assert.deepEqual(
      [...review.surfaceReview.files].sort(),
      Object.keys(review.sourceHashes).filter((file) => file.endsWith(".vue")).sort(),
      "surface review must cover the same local callers",
    );
    reviewSummaries.at(-1).surfaces = validateReviewSurfaces(review.surfaceReview, {
      sources,
      sourceHashes: hashes,
      packages,
    });
  }
  reviews.push(review);
}
assert.equal(new Set(reviews.map((r) => r.pageId)).size, reviews.length);
const result = reconcileActionCandidates(candidates, historical, contracts.records);
for (const c of result.candidates)
  c.semanticReviews = reviews.flatMap((r) =>
    r.actions
      .filter((a) => a.sourceCandidateIds.includes(c.candidateId))
      .map((a) => ({ pageId: r.pageId, actionId: a.actionId, kind: a.kind })),
  );
const pages = coverage.pages.map((p) => {
  assert.ok(catalog.routes.some((r) => r.path === p.path));
  const spec = read(base + "/page-specs/" + p.id + ".md");
  const proposals = [
    ...new Set([...spec.matchAll(/\]\(\.\.\/design\/([^/)]+)\/README\.md\)/g)].map((m) => m[1])),
  ];
  const review = reviewSummaries.find((r) => r.pageId === p.id);
  return {
    id: p.id,
    path: p.path,
    title: p.title,
    oldStaticAssociatedCandidates: result.candidates.filter((c) => c.staticRouteIds.includes(p.id))
      .length,
    review: review ?? null,
    proposalPackages: proposals,
    userReview: p.userReview,
    fullStateCoverage: "unproven",
    compositionGaps:
      reviews.find((r) => r.pageId === p.id)?.compositionGaps ??
      (["P18", "P54"].includes(p.id)
        ? ["multiple section proposals require explicit composition review"]
        : []),
  };
});
for (const f of [
  "scripts/audit-ui-phase2-action-coverage.mjs",
  "scripts/lib/ui-phase2-action-coverage.mjs",
  "scripts/lib/ui-phase2-review-surfaces.mjs",
  "scripts/lib/ui-phase2-inventory.mjs",
  "scripts/audit-ui-phase2-contracts.mjs",
  "scripts/lib/ui-phase2-contract-audit.mjs",
])
  read(f);
const summary = {
  routes: pages.length,
  currentSourceCandidates: candidates.length,
  historicalCandidates: historical.length,
  newSourceIdentities: result.candidates.filter(
    (c) => c.registration === "not-in-historical-inventory",
  ).length,
  oldOnlyIdentities: result.oldOnly.length,
  reviewedPages: reviews.length,
  explicitlyGroupedSourceSites: new Set(
    result.candidates.filter((c) => c.semanticReviews.length).map((c) => c.candidateId),
  ).size,
  semanticGroups: reviewSummaries.reduce((n, r) => n + r.semanticGroups, 0),
  routeActions: reviewSummaries.reduce((n, r) => n + r.routeActions, 0),
  wiringGroups: reviewSummaries.reduce((n, r) => n + r.wiringGroups, 0),
  pagesWithoutExplicitSemanticReview: pages.filter((p) => !p.review).map((p) => p.id),
  globalDenominatorFrozen: coverage.denominatorFrozen,
  userApprovedPages: coverage.userApprovedPages,
  visualApprovedReviewedPages: reviewSummaries.filter((r) => r.visualApproval).length,
  actionApprovedReviewedPages: reviewSummaries.filter(
    (r) => r.actionApproval !== "pending-user-review",
  ).length,
};
const output = {
  schemaVersion: 1,
  baselineRevision: "8e54f6d829ce5edf1f64dd5ace79afbd22921d90",
  status: "source-and-proposal-references-not-runtime-acceptance",
  inputHashes: hashes,
  summary,
  pages,
  reviews: reviewSummaries,
  ...result,
  limits: [
    "Semantic/route-action groups are summed per reviewed page; shared source repeated across routes is not a unique global business-action denominator.",
    "Exact source identities are not deduplicated semantic actions. Old-only identities are not deletion candidates.",
    "Historical static import route sets are a superset, not dynamic reachability; new source sites are not guessed onto routes.",
    "Visual approval remains distinct from semantic action approval, full button states, mounted Vue, SQL or production proof.",
    "No existing actions/dialogs/coverage, images, historical evidence or approval fields are rewritten.",
  ],
};
let md = `# 全站动作与弹窗覆盖对账\n\n基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。\n\n- 当前源候选${summary.currentSourceCandidates}；旧登记${summary.historicalCandidates}；新身份${summary.newSourceIdentities}，旧表独有身份${summary.oldOnlyIdentities}。签名变化不等于增删业务能力。\n- 已具体语义对应${summary.reviewedPages}页/${summary.explicitlyGroupedSourceSites}源位置/${summary.semanticGroups}组；其中路由动作${summary.routeActions}组，转发/容器关联${summary.wiringGroups}组，其余明确排除。其余${summary.pagesWithoutExplicitSemanticReview.length}页未完成此级映射，不称没有图或没有测试。\n- 原覆盖门与用户批准保持；静态合同已有引用，不表示六态或全弹窗已验收。\n\n## 逐页缺口\n\n| 页 | 旧静态关联候选（非运行分母） | 语义审阅 | 下一步 |\n| --- | --- | --- | --- |\n`;
md = md.replace(
  "## 逐页缺口",
  `已有视觉授权标记${summary.visualApprovedReviewedPages}页；语义动作授权${summary.actionApprovedReviewedPages}页。本清单不把视觉通过提升为动作通过，coverage.json中的正式页面签收保持原值。\n\n组数按审阅页累计；共享源在多页重复引用，不代表同数量的全站独立业务动作。\n\n## 逐页缺口`,
);
for (const p of pages)
  md += `| [${p.id} ${p.title}](page-specs/${p.id}.md) | ${p.oldStaticAssociatedCandidates} | ${p.review ? `[${p.review.semanticGroups}组](action-reviews/${p.id}.json)` : "未逐项映射"} | ${p.review ? `${p.review.unmappedVisualSlots}个视觉状态槽待判断/映射；完整组合/真实Vue待验` : p.compositionGaps.length ? "优先核对分段组合及每个动作/弹窗" : "对齐合同动作、动态变体、场景与测试"} |\n`;
md += [
  "",
  "## P11具体结论",
  "",
  "AccountShell与PersonalCenter的20个源位置对应15组已有合同ID：14组P11可用语义动作，1组旧局部Tab由accountShell=true排除；含4类写入，表单/按钮不重复计数。五个分区链接保留独立变体，不改路由数。两源没有弹窗，不能为填数量增加确认框。",
  "",
  "P11新增personal-composed-direction-c连续五分区提案、资料保存忙碌稿及204张双端图。14组代表控件适用六态均与具体selector/scene绑定；通用样本板不抵扣业务验收。0个未映射代表槽不等于全变体/输入/真实history或写入通过；P18/P54局部源语义见下表，下一核其逐控件/共享消费者、完整采纳成本组合与其余未复核页面（数量见上方动态汇总），未获具体稿批准前不替换生产Vue。",
  "",
  "## 使用与证据",
  "",
  "- `node scripts/audit-ui-phase2-action-coverage.mjs`只读复验；`--write`只生成本报告和[action-coverage-audit.json](action-coverage-audit.json)。",
  "- 输入沿用历史[actions](actions.json)、[dialogs](dialogs.json)及当前合同扫描；人工映射在action-reviews/Pxx.json，沿用业务合同actionId；转发/排除关系键不算新业务动作，qualified旧键通过完整单元格别名核对。",
  "- [P11映射](action-reviews/P11.json)逐项列原源ID、条件、handler、变体、双端场景与原型验证器、未覆盖项。存在引用不等于测试已通过；当次运行结果见[PROGRESS](PROGRESS.md)。",
  "- 来源漂移、未知候选、漏项/重复映射、无合同ID、缺图/视口、假批准均失败关闭。全局HTML/图像哈希用既有`audit-ui-phase2-design-delivery.mjs`单独复核，不把此处场景存在检查当图片正确性。",
  "- 不改变API/OpenAPI/配置/依赖/数据库/生产，无重启要求；两个报告和验证器为永久交付物，无一次性临时产物。",
  "",
].join("\n");
const sceneLink = (ref) =>
  [1440, 390]
    .map((width) => {
      const shot = packages
        .get(ref.package)
        .screenshots.find((s) => s.scene === ref.scene && (s.width ?? s.viewport?.width) === width);
      assert.ok(
        shot?.file && existsSync(`${base}/design/${ref.package}/${shot.file}`),
        "missing linked scene image",
      );
      return `[${ref.scene} · ${width}](design/${ref.package}/${shot.file})`;
    })
    .join(" / ");
for (const review of reviews.filter((r) => r.surfaceReview)) {
  const surface = review.surfaceReview,
    summary = reviewSummaries.find((r) => r.pageId === review.pageId);
  md += `\n## ${review.pageId} 局部动作与共享消费者\n\n[逐项机器清单](action-reviews/${review.pageId}.json)：${summary.sourceSites}个局部源位置 → ${summary.semanticGroups}组；${summary.writeActions}类写入，${summary.routeActions}组路由动作，${summary.wiringGroups}组转发/容器关联不重复计动作。已映射${summary.surfaces.reviewedInputBindings}/${summary.surfaces.localModelBindings}个源码字段位置，${summary.surfaces.callerContainers}/${summary.surfaces.sourceCallerContainers}处调用/内嵌容器，${summary.surfaces.consumerVariants}个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。\n\n`;
  md += `尚有${summary.unmappedVisualSlots}个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。\n\n`;
  if (summary.sourceInapplicableVisualSlots)
    md += `另有${summary.sourceInapplicableVisualSlots}个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。\n\n`;
  md +=
    "| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |\n| --- | --- | --- | --- |\n";
  for (const a of review.actions)
    md += `| ${a.actionId} ${a.label} / ${a.kind} | ${a.sourceCandidateIds.length}处；${a.variants.join("、")} | ${a.scenes.slice(0, 2).map(sceneLink).join("、")}；其余见JSON | ${a.remaining} |\n`;
  if (review.actions.some((a) => a.kind === "wiring")) {
    md +=
      "\n### 事件转发关系（不增加业务动作）\n\n| 关系键 | 源事件 / handler | 目标合同组 |\n| --- | --- | --- |\n";
    for (const a of review.actions.filter((v) => v.kind === "wiring")) {
      for (const edge of a.forwardBindings ?? [])
        md += `| ${a.actionId} | ${edge.event} / ${edge.handler.replaceAll("|", "\\|").replace(/\s+/gu, " ").trim()} | ${edge.targets.join("、")} |\n`;
      if (!a.forwardBindings?.length)
        md += `| ${a.actionId} | 容器定义，无额外事件 | ${a.forwardsTo.join("、")} |\n`;
    }
  }
  md +=
    "\n### 字段绑定（不重复计算为提交动作）\n\n| 本地字段 | 含义 | 未验事项 |\n| --- | --- | --- |\n";
  for (const input of surface.inputs)
    md += `| ${input.file.split("/").at(-1)} / ${input.binding} | ${input.meaning} | ${input.remaining} |\n`;
  md +=
    "\n### 弹窗与详情消费者（有图不自动等价）\n\n| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |\n| --- | --- | --- | --- |\n";
  for (const c of surface.containers)
    for (const v of c.variants)
      md += `| ${c.file.split("/").at(-1)} / ${c.tag}.${c.ordinal} / ${v.name} | ${c.shape} / ${v.evidenceScope} | ${v.scenes.map(sceneLink).join("、")} | ${v.remaining} |\n`;
  if (review.modeReachability) {
    md += "\n### 路径与局部模式\n\n";
    md += `初始mode=${review.modeReachability.initialMode}；局部模式族：${review.modeReachability.reachableModes.join("、")}。排除：${review.modeReachability.excludedModes.join("、")}。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。\n\n`;
    md +=
      "自动动作：" +
      review.modeReachability.automaticActions
        .map((a) => `${a.actionId} / ${a.trigger}`)
        .join("；") +
      "。不登记为按钮。\n";
  }
  md +=
    "\n### 明确保留的边界\n\n" +
    [...review.compositionGaps, ...surface.sharedRemaining].map((s) => `- ${s}`).join("\n") +
    "\n";
}
for (const [file, value] of [
  [base + "/action-coverage-audit.json", JSON.stringify(output, null, 2) + "\n"],
  [base + "/ACTION-COVERAGE-REVIEW.md", md],
]) {
  if (write) writeFileSync(file, value);
  else {
    assert.ok(existsSync(file), "missing report; use --write after review");
    assert.equal(readFileSync(file, "utf8").replaceAll("\r\n", "\n"), value, file + " stale");
  }
}
console.log(JSON.stringify({ mode: write ? "write" : "check", ...summary }));
