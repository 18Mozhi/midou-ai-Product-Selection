import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "./lib/ui-phase2-inventory.mjs";
import { runContractAudit } from "./audit-ui-phase2-contracts.mjs";
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
  for (const a of review.actions)
    for (const ref of a.testReferences) {
      read(ref.file);
      files.add(ref.file);
    }
  for (const bindings of Object.values(review.inputs))
    for (const binding of bindings)
      assert.ok(
        Object.keys(review.sourceHashes).some((file) =>
          sources[file]?.includes(`v-model="${binding}"`),
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
  pagesWithoutExplicitSemanticReview: pages.filter((p) => !p.review).map((p) => p.id),
  globalDenominatorFrozen: coverage.denominatorFrozen,
  userApprovedPages: coverage.userApprovedPages,
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
    "Exact source identities are not deduplicated semantic actions. Old-only identities are not deletion candidates.",
    "Historical static import route sets are a superset, not dynamic reachability; new source sites are not guessed onto routes.",
    "Scene/viewport presence and verifier references are not user approval, full button states, mounted Vue, SQL or production proof.",
    "No existing actions/dialogs/coverage, images, historical evidence or approval fields are rewritten.",
  ],
};
let md = `# 全站动作与弹窗覆盖对账\n\n基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。\n\n- 当前源候选${summary.currentSourceCandidates}；旧登记${summary.historicalCandidates}；新身份${summary.newSourceIdentities}，旧表独有身份${summary.oldOnlyIdentities}。签名变化不等于增删业务能力。\n- 已具体语义对应${summary.reviewedPages}页/${summary.explicitlyGroupedSourceSites}源位置/${summary.semanticGroups}组；其中路由动作${summary.routeActions}组，其余明确排除。其余${summary.pagesWithoutExplicitSemanticReview.length}页未完成此级映射，不称没有图或没有测试。\n- 原覆盖门与用户批准保持；静态合同已有引用，不表示六态或全弹窗已验收。\n\n## 逐页缺口\n\n| 页 | 旧静态关联候选（非运行分母） | 语义审阅 | 下一步 |\n| --- | --- | --- | --- |\n`;
for (const p of pages)
  md += `| [${p.id} ${p.title}](page-specs/${p.id}.md) | ${p.oldStaticAssociatedCandidates} | ${p.review ? `[${p.review.semanticGroups}组](action-reviews/${p.id}.json)` : "未逐项映射"} | ${p.review ? `${p.review.unmappedVisualSlots}个适用视觉状态槽未映射；组合/真实Vue待验` : p.compositionGaps.length ? "优先核对分段组合及每个动作/弹窗" : "对齐合同动作、动态变体、场景与测试"} |\n`;
md += [
  "",
  "## P11具体结论",
  "",
  "AccountShell与PersonalCenter的20个源位置对应15组已有合同ID：14组P11可用语义动作，1组旧局部Tab由accountShell=true排除；含4类写入，表单/按钮不重复计数。五个分区链接保留独立变体，不改路由数。两源没有弹窗，不能为填数量增加确认框。",
  "",
  "P11新增personal-composed-direction-c连续五分区提案、资料保存忙碌稿及204张双端图。14组代表控件适用六态均与具体selector/scene绑定；通用样本板不抵扣业务验收。0个未映射代表槽不等于全变体/输入/真实history或写入通过；下一核P18/P54组合及其余逐页语义，未获具体稿批准前不替换生产Vue。",
  "",
  "## 使用与证据",
  "",
  "- `node scripts/audit-ui-phase2-action-coverage.mjs`只读复验；`--write`只生成本报告和[action-coverage-audit.json](action-coverage-audit.json)。",
  "- 输入沿用历史[actions](actions.json)、[dialogs](dialogs.json)及当前合同扫描；人工映射在action-reviews/Pxx.json，沿用合同actionId，不设竞争编号。",
  "- [P11映射](action-reviews/P11.json)逐项列原源ID、条件、handler、变体、双端场景与原型验证器、未覆盖项。存在引用不等于测试已通过；当次运行结果见[PROGRESS](PROGRESS.md)。",
  "- 来源漂移、未知候选、漏项/重复映射、无合同ID、缺图/视口、假批准均失败关闭。全局HTML/图像哈希用既有`audit-ui-phase2-design-delivery.mjs`单独复核，不把此处场景存在检查当图片正确性。",
  "- 不改变API/OpenAPI/配置/依赖/数据库/生产，无重启要求；两个报告和验证器为永久交付物，无一次性临时产物。",
  "",
].join("\n");
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
