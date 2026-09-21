import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import {
  userLifecycleReviewCaptureStages,
  userLifecycleReviewHistoricalCapture,
} from "./lib/ui-phase2-user-lifecycle-review-historical-capture.mjs";
import {
  userLifecycleReviewReplayDriver,
  userLifecycleReviewReplayRoot,
} from "./lib/ui-phase2-user-lifecycle-review-current-replay.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length <= 1 && args.every((arg) => ["--capture", "--smoke", "--resume"].includes(arg)),
);
const resume = args.includes("--resume"),
  capture = resume || args.includes("--capture"),
  stages = args.includes("--smoke") ? ["create-current"] : ["create-current", "password-current"];
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
if (capture && (await exists(`${userLifecycleReviewReplayRoot}/evidence.json`)))
  assert.fail("Completed P43 packet is immutable; do not capture or resume");
if (capture && !resume) await mkdir(userLifecycleReviewReplayRoot); // Exclusive permanent packet. Do not overwrite earlier images.
if (resume) assert.ok((await stat(userLifecycleReviewReplayRoot)).isDirectory());
async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
const originalArgv = process.argv,
  summaries = [],
  sources = new Set([
    "scripts/lib/ui-phase2-user-page-current-preview.mjs",
    "scripts/lib/ui-phase2-user-lifecycle-review-historical-capture.mjs",
    "scripts/lib/ui-phase2-user-lifecycle-review-current-replay.mjs",
    "scripts/lib/ui-phase2-provider-historical-capture.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-ui-phase2-user-lifecycle-review-current-replay.mjs",
  ]);
try {
  for (const stage of stages) {
    const entry = userLifecycleReviewCaptureStages[stage],
      historical = userLifecycleReviewHistoricalCapture(stage);
    const original = JSON.parse(historical.manifest);
    process.argv = [originalArgv[0], entry.driver, ...(capture ? ["--capture"] : [])];
    const code = userLifecycleReviewReplayDriver(stage, await read(entry.driver));
    const recorded =
      resume && (await exists(`${userLifecycleReviewReplayRoot}/${stage}/evidence.json`));
    if (!recorded) {
      if (capture)
        assert.equal(
          await exists(`${userLifecycleReviewReplayRoot}/${stage}`),
          false,
          "Do not overwrite an incomplete stage",
        );
      // The original driver owns all Vite/browser cleanup; no scratch module is created.
      await import(
        "data:text/javascript;base64," +
          Buffer.from(code + `\n//# sourceURL=p43-${stage}-current-replay.mjs`).toString("base64")
      );
    } else console.log(`Revalidate completed P43 ${stage} without rerunning its browser`);
    assert.equal(
      await read(`${entry.folder}/evidence.json`),
      historical.manifest,
      "Original packet was not overwritten",
    );
    if (!capture) continue;
    const file = `${userLifecycleReviewReplayRoot}/${stage}/evidence.json`,
      bytes = await readFile(file),
      current = JSON.parse(bytes);
    assert.equal(current.processesClosed, true);
    assert.equal(current.approval, original.approval);
    assert.deepEqual(
      current.checks,
      original.checks,
      `${stage}: all original browser checks retained`,
    );
    assert.deepEqual(
      current.requestsByWidth ?? current.observations,
      original.requestsByWidth ?? original.observations,
      `${stage}: exact original fixture/request observations`,
    );
    assert.equal(current.screenshots.length, original.screenshots.length);
    const images = [];
    for (const shot of current.screenshots) {
      const old = original.screenshots.find((item) => item.file === shot.file);
      assert.ok(old, "No invented historical image match");
      const previousBytes = await readFile(`${entry.folder}/${old.file}`),
        newBytes = await readFile(`${userLifecycleReviewReplayRoot}/${stage}/${shot.file}`);
      assert.equal(hash(previousBytes), old.sha256, "Old image was not overwritten");
      assert.equal(hash(newBytes), shot.sha256);
      images.push({
        file: shot.file,
        previousSha: old.sha256,
        currentSha: shot.sha256,
        byteEqual: old.sha256 === shot.sha256,
        oldDimensions: [previousBytes.readUInt32BE(16), previousBytes.readUInt32BE(20)],
        currentDimensions: [newBytes.readUInt32BE(16), newBytes.readUInt32BE(20)],
      });
    }
    const changedSources = [];
    for (const [file, sha] of Object.entries(current.sourceHashes)) {
      sources.add(file);
      assert.equal(hash(await read(file)), sha, `Current raw source: ${file}`);
      if (original.sourceHashes[file] !== sha)
        changedSources.push({ file, before: original.sourceHashes[file] ?? null, after: sha });
    }
    summaries.push({
      stage,
      manifest: file,
      manifestSha: hash(bytes),
      historicalRevision: historical.revision,
      checks: current.checks.length,
      images,
      changedSources,
    });
  }
} finally {
  process.argv = originalArgv;
}
if (capture) {
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  const evidence = {
    kind: "P43-lifecycle-current-replay-r1",
    approval: "not-user-approved",
    processesClosed: true,
    summaries,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Original pinned drivers and assertions; only static import resolution (including current P43 review helper) and output directory changed. Only current regression mode is replayed. Current Vue/CSS with review-only template composition, not the untransformed App; four historical before/after manifests pin their capture-time parent revisions separately. Original images untouched. Local fixture-only requests, not true account creation/password reset, full App shell/KeepAlive, permission or production acceptance. Byte differences are observations, not approvals or pixel-equivalence claims.",
  };
  await writeFile(
    `${userLifecycleReviewReplayRoot}/evidence.json`,
    JSON.stringify(evidence, null, 2) + "\n",
    { flag: "wx" },
  );
  await writeFile(
    `${userLifecycleReviewReplayRoot}/index.html`,
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 创建与改密归属当前重放</title><h1>P43 创建与改密归属当前 Vue 重放</h1><p>旧图另存，当前测试样例；交互回归证据，不代表视觉批准、真实创建或改密、权限及生产验收。</p>' +
      summaries
        .map(
          (item) =>
            `<p><a href="${item.stage}/index.html">${item.stage} · ${item.images.length} 图 · ${item.checks} 检查</a></p>`,
        )
        .join(""),
  );
}
console.log(
  JSON.stringify({
    stages,
    capture,
    checks: capture ? summaries.reduce((n, item) => n + item.checks, 0) : undefined,
    images: summaries.reduce((n, item) => n + item.images.length, 0),
    byteEqual: summaries.flatMap((item) => item.images).filter((item) => item.byteEqual).length,
    processesClosed: true,
  }),
);
