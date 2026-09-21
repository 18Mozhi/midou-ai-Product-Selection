import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { teamsVueFile } from "../../scripts/lib/ui-phase2-teams-vue-preview.mjs";
import { previewTeamsCreateFocus } from "../../scripts/lib/ui-phase2-teams-create-focus-preview.mjs";
import {
  previewTeamsCreateStates,
  teamsCreateStatesChanges,
} from "../../scripts/lib/ui-phase2-teams-create-states-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const source = read(teamsVueFile),
  focus = previewTeamsCreateFocus(source),
  revised = previewTeamsCreateStates(source);

test("create-state composition preserves all script, models, events and field limits", () => {
  const descriptor = parse(revised).descriptor;
  assert.equal(descriptor.scriptSetup.content, parse(focus).descriptor.scriptSetup.content);
  for (const pattern of [/v-model="[^"]+"/g, /@[^\s=]+="[^"]+"/g, /maxlength="\d+"/g])
    assert.deepEqual(revised.match(pattern), focus.match(pattern));
  compileScript(descriptor, { id: "teams-states" });
  assert.deepEqual(
    compileTemplate({
      id: "teams-states",
      filename: teamsVueFile,
      source: descriptor.template.content,
    }).errors,
    [],
  );
  let reverse = revised;
  for (const [before, after] of [...teamsCreateStatesChanges].reverse()) {
    assert.equal(reverse.split(after).length, 2);
    reverse = reverse.replace(after, before);
  }
  assert.equal(reverse, focus);
});

test("busy live status is outside the busy form and each field has a unique existing help target", () => {
  assert.match(
    revised,
    /<p v-if="createBusy" class="teams-create-progress" role="status">[^<]+<\/p>\n\s*<form/,
  );
  assert.match(revised, /<form v-if="createOpen" :aria-busy="createBusy"/);
  for (const name of ["name", "lead", "workflow", "reason"]) {
    assert.equal(revised.split(`aria-describedby="p33-${name}-help"`).length, 2);
    assert.equal(revised.split(`id="p33-${name}-help"`).length, 2);
  }
  assert.doesNotMatch(source, /teams-create-progress|p33-name-help/);
  assert.throws(
    () => previewTeamsCreateStates(source.replace("负责人创建后会自动成为团队成员", "未知帮助")),
    /Inspect P33 create-state anchor/,
  );
});

test("captured actual creation states bind all current sources and preserve the unresolved refresh defect", () => {
  const folder = "output/playwright/p33-create-states-r2",
    e = JSON.parse(read(`${folder}/evidence.json`));
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.deepEqual(
    e.runs.map((r) => r.width),
    [390, 840, 841, 1440],
  );
  assert.equal(e.screenshots.length, 28);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.equal(e.transformedHashes[teamsVueFile], hash(revised));
  for (const shot of e.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
  for (const run of e.runs) {
    const writes = run.requests.filter((r) => r.key.startsWith("POST "));
    assert.equal(writes.length, 3);
    assert.ok(writes.every((r) => r.key === "POST /api/v1/org/admin/teams" && r.idempotency));
    assert.equal(new Set(writes.map((r) => r.idempotency)).size, 3);
    assert.equal(run.requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length, 3);
    assert.match(run.knownUnresolved, /not fixed or accepted/);
  }
  assert.match(e.boundary, /OG-G02 refresh failure overwrite reproduced, not fixed/);
});

test("creation capture overwrite and unknown args are rejected before service startup", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-ui-phase2-teams-create-states.mjs", arg],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    if (arg === "--capture") assert.match(result.stderr, /EEXIST/);
  }
});

test("r1 remains immutable evidence of the inherited warm error styling, not current source proof", () => {
  const folder = "output/playwright/p33-create-states-r1";
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const manifest = read(`${folder}/evidence.json`);
  assert.equal(hash(manifest), "91111a5cb1181593bc30739be3a660aa7b2fabeb9b311fa82ef253add1bfa41b");
  const e = JSON.parse(manifest);
  assert.equal(e.screenshots.length, 28);
  for (const shot of e.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256);
});
