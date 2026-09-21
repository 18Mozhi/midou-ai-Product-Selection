import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  acceptanceCaptureRoot,
  acceptanceCaptureDrivers,
} from "./ui-phase2-acceptance-current-capture.mjs";
import {
  beforeAdapterPaginationFocus,
  paginationFocusRevision,
} from "./ui-phase2-adapter-pagination-focus-baseline.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export const acceptanceReviewSections = [
  ["page", "默认页面", 16, 65],
  ["read-states", "读取与访问", 27, 67],
  ["actions", "范围与提交", 54, 69],
  ["robustness", "主题与适配", 42, 71],
  ["lifecycle", "缓存往返", 4, 188],
];
const manifestHashes = {
  page: "d1b6c2144ee2e69a118cb8fc645474cb6dbb467241432fe14f1dc5b8f7bbf9ab",
  "read-states": "8e6d6a60bc4f8f2de9396533959b03a5590479d6ce18c2d50e7a2ecd8248f5b9",
  actions: "f9ba8e8a65b006ae6bed7342fdb6574d41b803e1164f53babd3c46dad87a4be8",
  robustness: "1d20f76c09ff09651db671a1f1838c7d8ad09744d5a23622b954079b5bd05ae6",
  lifecycle: "3732d3be3bf09a25f2f7ee710bb6cc59297dda907dfe73e5ba47dc339ed97ac9",
};
export function verifyAcceptanceCapturedManifest(stage, raw) {
  assert.ok(Object.hasOwn(manifestHashes, stage), "Unknown capture stage");
  assert.equal(
    hash(raw.replaceAll("\r\n", "\n")),
    manifestHashes[stage],
    `Original ${stage} manifest changed`,
  );
}

// Verify capture-time content, but never label reconstructed content as current source.
export function verifyAcceptanceCapturedSource(file, capturedSha, currentText) {
  const source = currentText.replaceAll("\r\n", "\n");
  const currentSha = hash(source);
  if (currentSha === capturedSha) return null;
  assert.equal(
    file,
    "apps/web/src/components/ProviderAdapterCenter.vue",
    `Unverified source drift: ${file}`,
  );
  assert.equal(capturedSha, paginationFocusRevision.before, "Unknown captured P47 source");
  assert.equal(currentSha, paginationFocusRevision.current, "Unknown current P47 source");
  assert.equal(
    hash(beforeAdapterPaginationFocus(source)),
    capturedSha,
    "Captured P47 source cannot be restored exactly",
  );
  return { file, capturedSha, currentSha, lineage: "P47-pagination-focus" };
}

export function acceptanceReviewImagePath(stage, file) {
  assert.ok(Object.hasOwn(acceptanceCaptureDrivers, stage), "Unknown review section");
  assert.match(file, /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$/, "Invalid review image path");
  return `${stage}/${file}`;
}

export async function buildAcceptanceReviewR2(repo) {
  const root = path.join(repo, acceptanceCaptureRoot),
    sections = [];
  for (const [stage, title, count, sources] of acceptanceReviewSections) {
    const folder = path.join(root, stage);
    const raw = (await readFile(path.join(folder, "evidence.json"), "utf8")).replaceAll(
      "\r\n",
      "\n",
    );
    const evidence = JSON.parse(raw);
    verifyAcceptanceCapturedManifest(stage, raw);
    assert.equal(evidence.kind, `P49-ACCEPTANCE-${stage.toUpperCase()}-CURRENT-REVIEW-r2`);
    assert.equal(evidence.captureDriverSha, acceptanceCaptureDrivers[stage]);
    for (const key of ["reviewOnly", "processesClosed"]) assert.equal(evidence[key], true);
    for (const key of ["productionChanged", "deployed"]) assert.equal(evidence[key], false);
    assert.equal(evidence.userReview, "pending");
    assert.equal(evidence.screenshots.length, count);
    assert.equal(Object.keys(evidence.sourceHashes).length, sources);
    const sourceChanges = [];
    for (const [source, sha] of Object.entries(evidence.sourceHashes)) {
      const change = verifyAcceptanceCapturedSource(
        source,
        sha,
        await readFile(path.join(repo, source), "utf8"),
      );
      if (change) sourceChanges.push(change);
    }
    assert.ok(evidence.sourceHashes["scripts/lib/ui-imported-style-sources.mjs"]);
    const images = [];
    for (const shot of evidence.screenshots) {
      const href = acceptanceReviewImagePath(stage, shot.file);
      const bytes = await readFile(path.join(root, href));
      assert.equal(hash(bytes), shot.sha256, href);
      assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, href);
      assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, href);
      images.push({ href, file: shot.file, width: shot.width, sha256: shot.sha256 });
    }
    assert.deepEqual(
      (await readdir(folder)).sort(),
      ["evidence.json", "index.html", ...images.map((image) => image.file)].sort(),
    );
    const runs = evidence.runs ?? [...evidence.baselineRuns, ...evidence.proposedRuns];
    sections.push({
      stage,
      title,
      count,
      sources,
      sourceMatchesCurrent: sourceChanges.length === 0,
      sourceChanges,
      manifestSha: hash(raw),
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      images,
    });
  }
  const summary = {
    schemaVersion: 1,
    kind: "P49-CURRENT-REVIEW-INDEX-r2",
    reviewOnly: true,
    userReview: "pending",
    sourceMatchesCurrent: sections.every((section) => section.sourceMatchesCurrent),
    pictures: sections.reduce((sum, section) => sum + section.count, 0),
    sections,
  };
  const figure = (image, title) =>
    `<figure><a href="${escape(image.href)}"><img loading="lazy" src="${escape(image.href)}" alt="${escape(title)}"></a><figcaption>${escape(title)}<a class="original" href="${escape(image.href)}">查看原尺寸</a></figcaption></figure>`;
  const keyImage = (file) => {
    const image = sections[0].images.find((image) => image.file === file);
    assert.ok(image, "Missing default review image");
    return image;
  };
  const versionNote = summary.sourceMatchesCurrent
    ? "捕获来源与当前源码一致；这仍是待审设计图，不代表生产验收。"
    : "这是捕获时的设计图，当前源码已有后续改动。P47 分页焦点已修复，本图包未重新拍摄；仍可审核图中方案，但不能据此确认当前实现。";
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P49 · 设计图审核 r2</title>
<style>
${[
  ':root{--ink:#142a46;--muted:#536b86;--blue:#185adb;--navy:#102c64;--line:#d9e2ef;--paper:#fff;--canvas:#f2f5fa}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.65 "Microsoft YaHei",sans-serif}a{color:var(--blue);text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:3px solid var(--blue);outline-offset:4px}.cover{background:var(--navy);co',
  'lor:white;padding:36px max(24px,calc((100vw - 1360px)/2))}.eyebrow{font:600 14px/1.4 Bahnschrift,sans-serif;letter-spacing:.12em;color:#bfd1ff}.cover h1{font:600 clamp(30px,4vw,52px)/1.2 "Microsoft YaHei",sans-serif;margin:14px 0}.cover p{max-width:880px;margin:12px 0;color:#dce7ff}.badge{display:inline-block;border:1px solid #6584c4;padding:5px 14px}.rail{display:flex;gap:8px;flex-wrap:wrap;margi',
  "n-top:24px}.rail a{color:white;padding:10px 16px;min-height:44px;border:1px solid #6584c4;text-decoration:none}main{max-width:1360px;margin:0 auto;padding:28px 24px 60px}.boundary{background:white;border-left:5px solid var(--blue);padding:20px 24px;margin-bottom:28px}.boundary h2{margin:0 0 8px;font-size:22px}.boundary p{margin:6px 0}.hero{display:grid;grid-template-columns:minmax(0,3fr) minmax(26",
  "0px,1fr);gap:24px}figure{margin:0;background:var(--paper);border:1px solid var(--line);min-width:0}figure>a{display:block;padding:12px}img{display:block;width:100%;height:560px;object-fit:contain;object-position:top;background:#eef1f6}figcaption{border-top:1px solid var(--line);padding:12px 16px;font-weight:600;overflow-wrap:anywhere}.original{display:block;width:max-content;max-width:100%;min-hei",
  "ght:44px;padding-top:8px;font-weight:400}section{margin-top:36px;border-top:2px solid var(--navy);padding-top:16px}section h2{font-size:26px;margin:0 0 8px}section p{color:var(--muted);margin:8px 0 16px}summary{cursor:pointer;min-height:48px;background:white;border:1px solid var(--line);padding:12px 16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:18px",
  ";margin-top:18px}.grid img{height:420px}.source{font-size:13px;overflow-wrap:anywhere}footer{margin-top:32px;color:var(--muted)}@media(max-width:760px){.hero{grid-template-columns:1fr}main{padding:20px 16px}.cover{padding:28px 20px}img{height:480px}.rail a{flex:1;text-align:center;min-width:120px}.boundary{padding:18px}}@media(forced-colors:active){a:focus-visible,summary:focus-visible{outline-col",
  "or:Highlight}}.version-status{padding:16px;background:var(--canvas);border:1px solid var(--line);overflow-wrap:anywhere}",
].join("")}
</style><header class="cover"><div class="eyebrow">SCOUTOPS / REVIEW FILE 49</div><h1>1688 启用检查</h1><span class="badge">捕获版本 · r2 · 待审核</span><p>先判断还缺哪些启用证据，再选择下一步。默认页、读取、提交、适配和缓存往返共143张实际Vue审核图。</p><nav class="rail" aria-label="审核分组">${sections.map((section) => `<a href="#${section.stage}">${section.title} · ${section.count}</a>`).join("")}</nav></header>
<main><aside class="boundary" aria-labelledby="boundary"><h2 id="boundary">本次审核边界</h2><p>重点核对蓝色结论栏、连续门禁证据、下一步、运行表单和诊断区域的排列。这些是本地测试数据上的提案，未上线。</p><p><strong>现有导航壳尚未重构；长图中的固定导航可能出现在截图中段。</strong>它们不属于本次页内布局确认，不能将这些图签收为整页完成。点击“查看原尺寸”检查完整内容。</p><p>提交双反馈与缓存返回修复仍是提案；143张图不代表143项独立功能，也不代表真实权限、采集或生产验收。</p></aside>
<p class="version-status"><strong>${versionNote}</strong> <a href="review.json">查看版本差异</a></p>
<div class="hero">${figure(keyImage("1440-authoritative-2-of-3.png"), "桌面 · 尚缺字段解析证据（1440px）")}${figure(keyImage("390-authoritative-2-of-3.png"), "手机 · 同一状态（390px）")}</div>
${sections.map((section) => `<section id="${section.stage}"><h2>${section.title}</h2><p>${section.count}张图 · ${section.runs}次运行 · ${section.sources}份捕获来源已核对 · ${section.sourceChanges.length}处后续源码变更。此组仍待审核。</p><details><summary>展开${section.count}张图</summary><div class="grid">${section.images.map((image) => figure(image, image.file.replace(/\.png$/, ""))).join("")}</div></details><p class="source">版本 SHA256：${section.manifestSha} · <a href="${section.stage}/evidence.json">原始检查清单</a></p></section>`).join("\n")}
<footer>仅本地审核资料，不属于生产路由。旧r1图包独立保留；本入口没有自动批准、写入账号或启动采集的操作。</footer></main></html>`;
  return { html, summary };
}
