import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Artifact integrity and explicit page-link inventory, NOT design/action/production acceptance.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07",
  root = path.join(repo, relative);
const generate = process.argv.includes("--write");
assert.ok(process.argv.slice(2).every((v) => v === "--write"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const lf = (v) => v.replaceAll("\r\n", "\n");
const portable = (v) => v.split(path.sep).join("/");
function inside(base, file) {
  const p = path.resolve(base, file);
  assert.ok(p.startsWith(base + path.sep), "Outside audit scope: " + file);
  return p;
}
const bytes = (f) => readFile(inside(repo, f));
const text = async (f) => (await bytes(f)).toString("utf8");
const json = async (f) => JSON.parse(await text(f));
const cache = new Map();
async function fileHashes(f) {
  if (!cache.has(f)) {
    const b = await bytes(f);
    cache.set(f, { raw: hash(b), lf: hash(lf(b.toString("utf8"))) });
  }
  return cache.get(f);
}
const coverage = await json(relative + "/coverage.json"),
  routes = (await json("config/route-catalog.json")).routes;
assert.equal(coverage.pages.length, routes.length);
assert.equal(new Set(routes.map((r) => r.path)).size, routes.length);
assert.equal(new Set(coverage.pages.map((p) => p.id)).size, coverage.pages.length);
assert.deepEqual(coverage.pages.map((p) => p.path).sort(), routes.map((r) => r.path).sort());
const inputHashes = {};
for (const file of [
  "config/route-catalog.json",
  relative + "/coverage.json",
  relative + "/DIRECTION-DECISION-C.md",
  relative + "/PAGES.md",
  "scripts/audit-ui-phase2-design-delivery.mjs",
])
  inputHashes[file] = (await fileHashes(file)).lf;
const packages = [];
for (const dir of (await readdir(path.join(root, "design"), { withFileTypes: true }))
  .filter((d) => d.isDirectory() && d.name.includes("-direction-c"))
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const folder = relative + "/design/" + dir.name,
    evidenceFile = folder + "/evidence.json",
    e = await json(evidenceFile);
  const sources = [];
  for (const [file, expected] of Object.entries(e.sourceHashes || {})) {
    assert.match(expected, /^[a-f0-9]{64}$/);
    const actual = await fileHashes(file);
    sources.push({
      file,
      expected,
      actual: actual.lf,
      match: expected === actual.lf || expected === actual.raw,
      encoding: expected === actual.lf ? "LF-normalized" : "raw",
    });
  }
  const screenshots = [];
  for (const s of e.screenshots || []) {
    assert.equal(typeof s.file, "string");
    const p = inside(path.join(repo, folder), s.file),
      b = await readFile(p);
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
    assert.equal(b.subarray(1, 4).toString(), "PNG", s.file);
    screenshots.push({
      file: s.file,
      scene: s.scene ?? null,
      pageId: s.pageId ?? null,
      scope: s.scope ?? null,
      width: s.width ?? s.viewport?.width ?? null,
      sha256: s.sha256,
      match: hash(b) === s.sha256,
    });
  }
  assert.equal(new Set(screenshots.map((s) => s.file)).size, screenshots.length);
  const entries = await readdir(path.join(repo, folder));
  const unmanifestedPng = entries.filter(
    (f) => f.endsWith(".png") && !screenshots.some((s) => s.file === f),
  );
  const readmeFile = folder + "/README.md",
    readme = await text(readmeFile);
  const links = [...readme.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1])
    .filter((v) => !/^https?:|^#/.test(v));
  for (const link of links) {
    const target = path.resolve(repo, folder, decodeURIComponent(link.split(/[?#]/)[0]));
    assert.ok(target.startsWith(repo + path.sep));
    assert.ok((await stat(target)).isFile(), readmeFile + " -> " + link);
  }
  packages.push({
    folder: dir.name,
    readme: readmeFile,
    evidence: evidenceFile,
    manifestHash: (await fileHashes(evidenceFile)).lf,
    readmeHash: (await fileHashes(readmeFile)).lf,
    kind: e.kind ?? null,
    approval: e.approval ?? e.pageApproval ?? "not-stated-pending-concrete-review",
    role:
      dir.name === "account-direction-c"
        ? "direction-selection-research"
        : ["shell-direction-c", "theme-direction-c", "discovery-direction-c"].includes(dir.name)
          ? "shared-surface-only"
          : "page-or-section-proposal",
    sourceCount: sources.length,
    sourceDrift: sources.filter((s) => !s.match),
    sources,
    screenshotCount: screenshots.length,
    screenshotDrift: screenshots.filter((s) => !s.match).map((s) => s.file),
    unmanifestedPng,
    screenshots,
    readmeLinksChecked: links.length,
  });
}
const byFolder = new Map(packages.map((p) => [p.folder, p]));
const pages = [];
for (const p of coverage.pages) {
  const route = routes.find((r) => r.path === p.path);
  assert.ok(route, p.id + " stale route");
  assert.equal(route.title, p.title, p.id + " title");
  const spec = relative + "/page-specs/" + p.id + ".md",
    body = await text(spec);
  inputHashes[spec] = (await fileHashes(spec)).lf;
  const references = [
    ...new Set([...body.matchAll(/\]\(\.\.\/design\/([^/)]+)\/README\.md\)/g)].map((m) => m[1])),
  ];
  for (const f of references) assert.ok(byFolder.has(f), p.id + " unknown package " + f);
  const related = references.filter((f) => byFolder.get(f).role === "page-or-section-proposal");
  pages.push({
    id: p.id,
    path: p.path,
    title: p.title,
    batch: p.batch,
    acceptance: p.acceptance,
    spec,
    references,
    proposalPackages: related,
    artifactAssociation: related.length
      ? "related-proposal-not-complete-proof"
      : "no-page-proposal-linked",
    fullPageCoverage: "unproven",
    buttonStateCoverage: "unproven",
    dialogVariantCoverage: "unproven",
    userReview: p.userReview,
    implementationEvidence: p.implementationEvidence,
    productionEvidence: p.productionEvidence,
    notes:
      p.id === "P10"
        ? "theme-direction-c README explicitly excludes every Pxx business page; it is a shared floating panel, not ThemeStudio."
        : ["P11", "P18", "P54"].includes(p.id)
          ? "Multiple section/assembly proposals; links alone do not prove full page composition or all actions."
          : p.id === "P43"
            ? "account-direction-c is direction-selection research; user-admin-direction-c is the later concrete proposal."
            : "Link association only; read the package boundaries before reviewing.",
  });
}
const linkedFolders = new Set(pages.flatMap((p) => p.proposalPackages));
const unlinkedPagePackages = packages
  .filter((p) => p.role === "page-or-section-proposal" && !linkedFolders.has(p.folder))
  .map((p) => p.folder);
const missing = pages.filter((p) => !p.proposalPackages.length).map((p) => p.id);
const sourceDrift = packages.flatMap((p) =>
  p.sourceDrift.map((s) => ({ package: p.folder, ...s })),
);
const screenshotDrift = packages.flatMap((p) =>
  p.screenshotDrift.map((f) => ({ package: p.folder, file: f })),
);
const unmanifested = packages.flatMap((p) =>
  p.unmanifestedPng.map((f) => ({ package: p.folder, file: f })),
);
const summary = {
  routes: routes.length,
  specifications: pages.length,
  relatedProposalRoutes: pages.length - missing.length,
  noLinkedPageProposalRoutes: missing.length,
  missingPageIds: missing,
  packages: packages.length,
  researchPackages: packages.filter((p) => p.role === "direction-selection-research").length,
  sharedOnlyPackages: packages.filter((p) => p.role === "shared-surface-only").length,
  uniqueBoundFiles: new Set(packages.flatMap((p) => p.sources.map((s) => s.file))).size,
  sourceBindings: packages.reduce((sum, p) => sum + p.sourceCount, 0),
  sourceDrift: sourceDrift.length,
  pngs: packages.reduce((sum, p) => sum + p.screenshotCount, 0),
  pngDrift: screenshotDrift.length,
  unmanifestedPng: unmanifested.length,
  readmeLinksChecked: packages.reduce((sum, p) => sum + p.readmeLinksChecked, 0),
  unlinkedPagePackages,
  fullPageCompletion: "unproven",
  verifiedBusinessActions: coverage.verifiedBusinessActions,
  verifiedDialogVariants: coverage.verifiedDialogVariants,
  userApprovedPages: coverage.userApprovedPages,
  denominatorFrozen: coverage.denominatorFrozen,
  gates: coverage.gates,
};
const audit = {
  schemaVersion: 1,
  audit: "UI2-C-DELIVERY-AUDIT-r1",
  baselineRevision: "caceee799d12334ebb926cc14192f09041686f6a",
  scope:
    "73 canonical routes plus C-direction local artifacts; no product runtime or production access",
  inputHashes,
  summary,
  pages,
  packages: packages.map(({ screenshots, sources, ...entry }) => ({
    ...entry,
    checkedSourceFiles: sources.map((s) => s.file),
    checkedViewportWidths: [...new Set(screenshots.map((s) => s.width))],
  })),
  sourceDrift,
  screenshotDrift,
  unmanifested,
  limits: [
    "Package and link counts are not page/action/dialog completion counts.",
    "Hashes attest unchanged files, not semantic correctness, visual quality, all-state coverage or fresh browser tests.",
    "Shared shell/theme/discovery and historical account direction are not business-page substitutes.",
    "No global semantic action/dialog denominator, individual approval, implementation or production gate is promoted by this report.",
  ],
};
const rel = (file) => path.posix.relative(relative, file);
let report = `# C方向逐页审核索引与交付缺口

基线：caceee79；本报告核对当前路由、页面规格、C稿包及磁盘指纹，不替用户批准，也不是全站技术验收。

## 核对结果

- 真实路由与规格：${summary.routes}/${summary.specifications}。
- 有明确整页或分段稿关联：${summary.relatedProposalRoutes}条；这不是${summary.relatedProposalRoutes}页全部完成。
- 未关联对应整页稿：${summary.noLinkedPageProposalRoutes}条（${missing.join("、")}）。共享主题浮层不抵扣P10。
- C稿包${summary.packages}个：含${summary.researchPackages}个方向研究包、${summary.sharedOnlyPackages}个共享表面包；正式清单内PNG共${summary.pngs}张。
- ${summary.sourceBindings}条来源绑定 / ${summary.uniqueBoundFiles}个唯一文件，漂移${summary.sourceDrift}；PNG指纹漂移${summary.pngDrift}，未列入清单PNG ${summary.unmanifestedPng}；图册内${summary.readmeLinksChecked}个本地链接已核对。
- 用户逐页批准${summary.userApprovedPages}；业务动作已正式验收${summary.verifiedBusinessActions}、弹窗变体已正式验收${summary.verifiedDialogVariants}；分母冻结=${summary.denominatorFrozen}。保留原coverage门禁，不把静态候选算去重业务动作。

## 本轮证据结论与下一步

1. **缺少${missing.length}个路由的整页C稿关联**：P01–P09身份/范围/入驻，P10外观设置，P19/P20竞品，P21/P22供应与成本。C目录扫描、规格链接和共享包README交叉核对；没有把主题浮层或导航装配位计为完整页。下一批先做P01–P09身份入口族，随后P10、P19/P20、P21/P22。
2. **有图不等于每个按钮/弹窗六态已覆盖**：PAGES要求逐actionId/dialogId关联验证；现有总coverage仍为未冻结/0已验。各包局部场景、截图及源隔离检查不能证明全站语义分母。后续逐页补动作与变体的状态映射、适用/不适用理由和实际测试，不先把总门改绿。
3. **审核入口分散，批准与实现仍待办**：旧review.html主要链接历史研究与源码候选；本索引直接列出当前关联图册。P11/P18/P54等多段稿需核对组合，不按包数或PNG数累计成完整页。具体图批准后才能进入相应Vue闭环；此处不修改用户意见或任何生产事实。

## 逐页审核入口

点开规格后，再打开关联图册查看桌面、手机、弹窗和异常态。审阅请注明页面ID、图稿版本、场景、通过或修改及意见；方向C的选择不代替这一步。

| ID | 页面 / 路由 | 规格 | C图稿入口 | 当前证据边界 |
| --- | --- | --- | --- | --- |
`;
for (const p of pages) {
  const links = p.proposalPackages
    .map((f) => `[${f.replace("-direction-c", "")}](design/${f}/README.md)`)
    .join(" · ");
  report += `| ${p.id} | ${p.title} · \`${p.path}\` | [规格](${rel(p.spec)}) | ${links || "待补整页稿"} | ${links ? "相关稿待审；整页/全动作未证明" : "无对应整页稿关联"} |\n`;
}
report += `\n## 共享面与历史研究（不抵扣业务整页）\n\n`;
for (const p of packages.filter((p) => p.role !== "page-or-section-proposal"))
  report += `- [${p.folder}](${rel(p.readme)})：${p.role === "shared-surface-only" ? "共享面提案" : "方向选择研究"}。\n`;
report += `\n## 复验与限制\n\n- 只读复验：\`node scripts/audit-ui-phase2-design-delivery.mjs\`。\n- 有意更新本审计报告：\`node scripts/audit-ui-phase2-design-delivery.mjs --write\`；只更新本索引和[机器报告](design-delivery-audit.json)，不刷新旧图、旧证据或批准状态。\n- 指纹匹配只是来源/图片未漂移；本轮没有重跑${packages.length}个包的浏览器测试，也没有重新人工审核${summary.pngs}张图。按钮全状态、所有弹窗、三主题密度/组合、真实Vue/权限/接口/生产及签收均不得据此宣称通过。\n- 原始规格和源盘点见[PAGES](PAGES.md)、[计划](PLAN.md)、[旧覆盖表](coverage.json)；它们的目标与静态候选不作为完成证明。\n- 无生产代码、API、环境、依赖、数据库、部署或重启变更；没有创建临时图片、浏览器或服务。审计脚本、JSON与本索引是永久交付物。\n`;
const outputs = [
  ["design-delivery-audit.json", JSON.stringify(audit, null, 2) + "\n"],
  ["DESIGN-REVIEW-INDEX.md", report],
];
if (generate) {
  for (const [file, value] of outputs) await writeFile(path.join(root, file), value);
} else {
  for (const [file, value] of outputs)
    assert.equal(
      lf(await readFile(path.join(root, file), "utf8")),
      value,
      file + " stale; inspect differences before --write",
    );
}
assert.deepEqual(sourceDrift, [], "Source drift must be investigated, not rebound silently");
assert.deepEqual(screenshotDrift, [], "PNG content drift");
assert.deepEqual(unmanifested, [], "Unmanifested screenshots");
console.log(JSON.stringify({ mode: generate ? "write" : "check", ...summary }));
