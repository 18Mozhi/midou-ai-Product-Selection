import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--check"));
const check = process.argv.includes("--check");
const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value.replaceAll("\r\n", "\n") : value)
    .digest("hex");
const json = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const records = [];
const sources = [];
async function source(id, label, inputs) {
  const changes = [];
  for (const [file, hash] of Object.entries(inputs)) {
    if (digest(await readFile(path.join(repo, file), "utf8")) !== hash) changes.push(file);
  }
  sources.push({ id, label, changes, recordedHashes: inputs });
}
async function image(file, sha256) {
  const absolute = path.resolve(root, file);
  assert.ok(absolute.startsWith(root + path.sep) && file.endsWith(".png"), file);
  assert.equal(digest(await readFile(absolute)), sha256, file + " image hash");
}
const tasks = await json("design/directions/evidence.json");
assert.equal(tasks.approval, "pending-user-review");
assert.equal(tasks.screenshots.length, 12);
await source("tasks", "任务 A/B 研究", {
  [`${relative}/${tasks.source}`]: tasks.sourceSha256,
  [`${relative}/${tasks.sharedStyle.source}`]: tasks.sharedStyle.sha256,
  [tasks.fixturePath]: tasks.fixtureSha256,
});
const oldTasks = await json("runtime/tasks/evidence.json");
for (const shot of tasks.screenshots) {
  const state = shot.state;
  const pageId = state === "list" ? "P23" : "P24";
  const old = oldTasks.screenshots.find(
    (item) => item.file === `runtime/tasks/${shot.viewport.width}-${pageId}-${state}.png`,
  );
  assert.ok(old, `${pageId}/${state} baseline`);
  await image(old.file, old.sha256);
  records.push({
    surface: "tasks",
    pageId,
    source: "tasks",
    direction: shot.direction,
    state,
    width: shot.viewport.width,
    file: shot.file,
    sha256: shot.sha256,
    capturedAt: shot.capturedAt,
    baseline: {
      file: old.file,
      width: old.viewport.width,
      capturedAt: old.capturedAt,
      revision: old.sourceRevision,
      sha256: old.sha256,
    },
  });
}
const representatives = await json("design/representative-directions/evidence.json");
assert.equal(representatives.approval, "pending-user-review");
assert.equal(representatives.screenshots.length, 76);
await source("representatives", "规则 / 权限 / 恢复 / 按钮 A/B 研究", {
  ...Object.fromEntries(
    Object.entries(representatives.inputs).map(([file, hash]) => [
      `${relative}/design/${file}`,
      hash,
    ]),
  ),
  ...representatives.fixtures,
});
const ids = { rules: "P17", roles: "P31", status: "P61", controls: "SHARED" };
const oldStates = {
  rules: {
    overview: "versions",
    create: "create-form",
    preview: "preview",
    submit: "submit-reason",
  },
  roles: {
    overview: "role-matrix",
    grants: "resource-grants",
    grant: "grant-create-form",
    revoke: "grant-revoke-reason",
  },
  status: {
    overview: "dependency-degraded",
    "refresh-failed": "refresh-failed-retained",
    "refresh-recovered": "refresh-recovered",
  },
};
for (const shot of representatives.screenshots) {
  const pageId = ids[shot.surface];
  const oldState = oldStates[shot.surface]?.[shot.state];
  let baseline = null;
  if (oldState) {
    const record = await json(
      `runtime/representatives/${pageId}-${shot.viewport.width}-${oldState}.json`,
    );
    assert.equal(record.kind, "vue-existing-e2e-fixture-baseline-not-production");
    assert.equal(record.testStatus, "passed");
    assert.equal(record.pageId, pageId);
    await image(record.file, record.sha256);
    baseline = {
      file: record.file,
      width: shot.viewport.width,
      capturedAt: record.capturedAt,
      revision: record.sourceRevision,
      sha256: record.sha256,
    };
  }
  records.push({
    surface: shot.surface,
    pageId,
    source: "representatives",
    direction: shot.direction,
    state: shot.state,
    width: shot.viewport.width,
    file: "design/representative-directions/" + shot.file,
    sha256: shot.sha256,
    capturedAt: shot.capturedAt,
    baseline,
  });
}
const accounts = await json("design/account-direction-c/evidence.json");
assert.equal(accounts.approval, "pending-user-review");
assert.equal(accounts.production, false);
assert.equal(accounts.screenshots.length, 18);
await source("accounts", "用户管理 C 研究", accounts.sourceHashes);
for (const shot of accounts.screenshots)
  records.push({
    surface: "accounts",
    pageId: "P43",
    source: "accounts",
    direction: "clear",
    state: shot.scene,
    width: shot.viewport.width,
    file: "design/account-direction-c/" + shot.file,
    sha256: shot.sha256,
    capturedAt: accounts.capturedAt,
    baseline: null,
  });
assert.equal(records.length, 106);
assert.equal(
  new Set(records.map((shot) => `${shot.surface}/${shot.direction}/${shot.state}/${shot.width}`))
    .size,
  106,
);
for (const shot of records) await image(shot.file, shot.sha256);
const boardSources = {};
for (const file of ["direction-review.html", "direction-review.css", "direction-review.js"])
  boardSources[file] = digest(await readFile(path.join(root, file), "utf8"));
const data = {
  version: "F00-1.18-r1",
  kind: "direction-review-not-production",
  approval: "pending-user-review",
  sources,
  shots: records,
  boardSources,
};
const result = { ...data, fingerprint: digest(JSON.stringify(data)) };
const output = `window.SCOUTOPS_DIRECTION_REVIEW = ${JSON.stringify(result).replaceAll("<", "\\u003c")};\n`;
const destination = path.join(root, "direction-review-data.js");
if (check) assert.equal((await readFile(destination, "utf8")).replaceAll("\r\n", "\n"), output);
else await writeFile(destination, output);
console.log(
  `ui_phase2_direction_review_${check ? "checked" : "built"} images=106 baselinePairs=${records.filter((shot) => shot.baseline).length} changedSourceGroups=${sources.filter((item) => item.changes.length).length} approval=pending`,
);
