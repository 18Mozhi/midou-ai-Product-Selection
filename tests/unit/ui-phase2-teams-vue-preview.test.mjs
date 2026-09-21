import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { spawnSync } from "node:child_process";
import {
  previewTeamsVue,
  teamsVueChanges,
  teamsVueFile,
  teamsVueCss,
} from "../../scripts/lib/ui-phase2-teams-vue-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const source = read(teamsVueFile),
  reviewed = previewTeamsVue(source);
const hash = (value) => createHash("sha256").update(value).digest("hex");

function bindings(source) {
  const found = [];
  function visit(node) {
    if (node.type === 1)
      for (const p of node.props) {
        if (p.type === 7 && ["model", "on"].includes(p.name))
          found.push([
            node.tag,
            p.name,
            p.arg?.content,
            p.exp?.content,
            p.modifiers.map((m) => m.content),
          ]);
      }
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(source).descriptor.template.content));
  return found;
}

test("P33 C actual Vue preserves the entire script, all events/models and original form", () => {
  const original = parse(source).descriptor,
    next = parse(reviewed).descriptor;
  assert.equal(next.scriptSetup.content, original.scriptSetup.content);
  assert.deepEqual(bindings(reviewed), bindings(source));
  assert.equal(
    reviewed.match(/<form v-if="createOpen"[\s\S]*?<\/form>/)[0],
    source.match(/<form v-if="createOpen"[\s\S]*?<\/form>/)[0],
  );
  compileScript(next, { id: "p33-review" });
  assert.deepEqual(
    compileTemplate({ id: "p33-review", filename: teamsVueFile, source: next.template.content })
      .errors,
    [],
  );
  let reversed = reviewed;
  for (const [before, after] of [...teamsVueChanges].reverse()) {
    assert.equal(reversed.split(after).length, 2);
    reversed = reversed.replace(after, before);
  }
  assert.equal(reversed, source);
});

test("P33 native list and in-page regions are review-only and missing anchors fail closed", () => {
  assert.match(reviewed, /<ul v-if="pageItems.length" class="org-team-list">/);
  assert.match(reviewed, /<li v-for="team in pageItems" :key="team.id"><button/);
  assert.doesNotMatch(reviewed, /role="listitem"/);
  assert.match(reviewed, /href="#p33-directory"/);
  assert.match(reviewed, /id="p33-directory"/);
  assert.match(reviewed, /id="p33-collaboration"/);
  assert.equal(previewTeamsVue(source.replaceAll("\n", "\r\n")), reviewed);
  assert.throws(
    () => previewTeamsVue(source.replace('aria-label="团队治理台"', 'aria-label="未知页面"')),
    /Inspect P33 Vue anchor/,
  );
  assert.doesNotMatch(source, /teams-vue-c|teams-c-index/);
  assert.match(
    read(teamsVueCss),
    /html body\.teams-vue-c #app \.org-admin-center:has\(\.org-team-panel\)/,
  );
});

test("P33 current capture binds every original source and screenshot without claiming production acceptance", () => {
  const folder = "output/playwright/p33-teams-vue-c-r4";
  const e = JSON.parse(read(`${folder}/evidence.json`));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.deepEqual(
    e.runs.map((r) => [r.mode, r.width]),
    [
      ["baseline", 390],
      ["baseline", 1440],
      ["review", 390],
      ["review", 840],
      ["review", 841],
      ["review", 1440],
    ],
  );
  assert.equal(e.screenshots.length, 34);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  for (const shot of e.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
  assert.equal(e.transformedHashes[teamsVueFile], hash(reviewed));
  for (const run of e.runs) {
    assert.ok(run.requests.every((r) => r.key.startsWith("GET ") && r.body === null));
    assert.equal(run.requests.filter((r) => r.key === "GET /api/v1/org/admin/teams").length, 1);
  }
  assert.match(e.boundary, /OG-G02 remains/);
});

test("P33 capture overwrite and unknown arguments fail before browser startup", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const result = spawnSync(process.execPath, ["scripts/verify-ui-phase2-teams-vue-c.mjs", arg], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    if (arg === "--capture") assert.match(result.stderr, /EEXIST/);
  }
});

test("P33 first capture remains intact as a visual-defect record, not current source proof", () => {
  const folder = "output/playwright/p33-teams-vue-c-r1";
  const manifest = read(`${folder}/evidence.json`);
  assert.equal(hash(manifest), "cc30883b917dd8f3fec6d2532971b13cee6da5d9ae666491081ab041e24dbb12");
  const e = JSON.parse(manifest);
  assert.equal(e.screenshots.length, 34);
  for (const shot of e.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});

test("P33 second capture preserves the fixed-bar occlusion evidence", () => {
  const folder = "output/playwright/p33-teams-vue-c-r2";
  const manifest = read(`${folder}/evidence.json`);
  assert.equal(hash(manifest), "63a6c480919ab996d937718e1d0786224d52ca121fc693ab6587f5b6f75d9f46");
  for (const shot of JSON.parse(manifest).screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});

test("P33 r3 capture is preserved before the final formatting-only driver revision", () => {
  const folder = "output/playwright/p33-teams-vue-c-r3";
  const manifest = read(`${folder}/evidence.json`);
  assert.equal(hash(manifest), "54d4c63c4f852a29d4608eb23b48cdc2eea18763aa3d6022f7f6b66ab9547ee0");
  for (const shot of JSON.parse(manifest).screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
