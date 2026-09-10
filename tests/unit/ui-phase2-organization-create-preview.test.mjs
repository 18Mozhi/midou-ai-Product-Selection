import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { organizationCreatePreview } from "../../scripts/lib/ui-phase2-organization-create-preview.mjs";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "../../scripts/lib/ui-phase2-organization-list-preview.mjs";
import { reviewHash } from "../../scripts/lib/ui-phase2-vue-review-host.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const wizard = "apps/web/src/components/OrganizationCreationWizard.vue";
const output = "output/playwright/p41-create-preview";
function directives(source) {
  const result = [];
  function visit(node) {
    if (node.type === 1)
      for (const p of node.props)
        if (p.type === 7)
          result.push(
            JSON.stringify([
              node.tag,
              p.name,
              p.arg?.content,
              p.exp?.content,
              p.modifiers.map((m) => m.content),
            ]),
          );
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(source).descriptor.template.content));
  return result.sort();
}
test("P41 presentation leaves the actual wizard script and every native directive unchanged", () => {
  const original = read(wizard),
    preview = organizationCreatePreview(original);
  assert.equal(parse(preview).errors.length, 0);
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(directives(preview), directives(original));
  assert.throws(() =>
    organizationCreatePreview(original.replace("<h3>新建组织</h3>", "<h3>其他内容</h3>")),
  );
  for (const text of [
    'aria-label="组织名称"',
    'aria-label="组织标识"',
    'aria-describedby="p41-name-help"',
    'aria-describedby="p41-admin-help"',
  ])
    assert.ok(preview.includes(text));
});
test("P41 captured evidence binds current source, exact images and six step breakpoints", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 127);
  assert.equal(e.screenshots.length, 34);
  assert.match(e.scope, /Not full App/);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(reviewHash(read(file)), sha, file);
  for (const [file, transform] of Object.entries({
    [wizard]: organizationCreatePreview,
    "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
    "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
  }))
    assert.equal(e.transformedHashes[file], reviewHash(transform(read(file))));
  for (const step of ["step1", "step2"])
    assert.deepEqual(
      e.screenshots.filter((s) => s.state === step).map((s) => s.viewport.width),
      [390, 699, 700, 701, 1024, 1440],
    );
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${output}/${s.file}`);
    assert.equal(reviewHash(bytes), s.sha256);
    assert.equal(s.sourceSha, reviewHash(JSON.stringify(e.sourceHashes)));
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.routeId, "P41");
  }
  assert.equal(e.observations.length, 6);
});
test("P41 fixture writes use only original optional administrator contract", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  for (const observation of e.observations) {
    assert.ok(
      e.checks.some(
        (c) =>
          c.width === observation.width &&
          c.name === "all traffic intercepted and no browser errors",
      ),
    );
    const posts = observation.requests.filter((r) => r.method === "POST");
    if (![390, 1440].includes(observation.width)) {
      assert.equal(posts.length, 0);
      continue;
    }
    assert.equal(posts.length, 2);
    assert.equal(posts[0].hasIdempotencyKey, true);
    assert.deepEqual(Object.keys(posts[0].body).sort(), ["name", "slug"]);
    assert.deepEqual(Object.keys(posts[1].body).sort(), ["initial_admin_user_id", "name", "slug"]);
    assert.equal(posts[1].hasIdempotencyKey, true);
    assert.deepEqual(
      posts.map((p) => p.status),
      [500, 200],
    );
  }
});
test("P41 changes no production source or earlier P40 preview artifacts", () => {
  for (const file of [
    wizard,
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/use-modal-dialog.ts",
    "scripts/lib/ui-phase2-vue-review-host.mjs",
  ])
    assert.equal(
      read(file),
      execFileSync("git", ["show", `1f909c92:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
    );
  const dir = "output/playwright/p40-list-preview";
  const old = execFileSync("git", ["show", `1f909c92:${dir}/evidence.json`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");
  assert.equal(read(`${dir}/evidence.json`), old);
  for (const s of JSON.parse(old).screenshots)
    assert.equal(reviewHash(readFileSync(`${dir}/${s.file}`)), s.sha256);
});
