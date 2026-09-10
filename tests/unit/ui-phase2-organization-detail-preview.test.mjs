import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import {
  organizationDetailPreview,
  organizationReasonPreview,
} from "../../scripts/lib/ui-phase2-organization-detail-preview.mjs";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "../../scripts/lib/ui-phase2-organization-list-preview.mjs";
import { reviewHash } from "../../scripts/lib/ui-phase2-vue-review-host.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const detail = "apps/web/src/components/PlatformOrganizationDetailDialog.vue";
const reason = "apps/web/src/components/PlatformAccountDialogs.vue";
const output = "output/playwright/p42-detail-preview";
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
test("P42 preserves complete scripts and directives except explicit status color binding", () => {
  for (const [file, transform] of [
    [detail, organizationDetailPreview],
    [reason, organizationReasonPreview],
  ]) {
    const original = read(file),
      preview = transform(original);
    assert.equal(parse(preview).errors.length, 0);
    assert.equal(
      parse(preview).descriptor.scriptSetup.content,
      parse(original).descriptor.scriptSetup.content,
    );
    const expected = directives(original);
    if (file === detail)
      expected.push(
        JSON.stringify(["button", "bind", "data-danger", "organization.status === 'active'", []]),
      );
    assert.deepEqual(directives(preview), expected.sort());
  }
  const original = read(reason),
    preview = organizationReasonPreview(original);
  assert.equal(
    preview.slice(0, preview.indexOf('<dialog class="p42-reason-dialog"')),
    original.slice(0, original.indexOf('<dialog ref="reasonDialogElement"')),
  );
  assert.throws(() => organizationDetailPreview(read(detail).replace("未找到该组织", "其他标题")));
  assert.throws(() =>
    organizationReasonPreview(original.replace("原因会写入平台审计记录。", "其他说明")),
  );
  const transformed = organizationDetailPreview(read(detail));
  assert.equal((transformed.match(/尚未读取/g) ?? []).length, 2);
  assert.ok(!transformed.includes("count ?? 1"));
  assert.ok(transformed.includes("本次组织列表没有返回这个目标"));
});
test("P42 evidence binds exact source, images and six breakpoints", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 141);
  assert.equal(e.screenshots.length, 42);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(reviewHash(read(file)), sha, file);
  for (const [file, transform] of Object.entries({
    [detail]: organizationDetailPreview,
    [reason]: organizationReasonPreview,
    "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
    "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
  }))
    assert.equal(e.transformedHashes[file], reviewHash(transform(read(file))));
  assert.deepEqual(
    e.screenshots.filter((s) => s.state === "normal").map((s) => s.viewport.width),
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
    assert.equal(s.routeId, "P42");
  }
});
test("P42 intercepted writes retain exact original profile and status contracts", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.observations.length, 6);
  for (const o of e.observations) {
    assert.ok(
      e.checks.some(
        (c) =>
          c.width === o.width &&
          c.name === "no unintended API or external traffic or browser errors",
      ),
    );
    const writes = o.requests.filter((r) => r.method !== "GET");
    if (![390, 1440].includes(o.width)) {
      assert.equal(writes.length, 0);
      continue;
    }
    assert.deepEqual(
      writes.map((r) => r.method),
      ["PATCH", "PATCH", "POST", "POST"],
    );
    assert.deepEqual(
      writes.map((r) => r.status),
      [500, 200, 200, 200],
    );
    assert.deepEqual(
      writes.map((r) => r.body),
      [
        { name: "更新后的组织", timezone: "UTC", data_retention_days: 30, reason: "核对资料" },
        { name: "再次更新的组织", timezone: "UTC", data_retention_days: 30, reason: "保存复核" },
        { status: "archived", reason: "停用复核" },
        { status: "active", reason: "恢复复核" },
      ],
    );
    for (const r of writes) {
      assert.equal(r.hasIdempotencyKey, true);
      assert.equal(
        r.path,
        "/api/v1/platform/accounts/organizations/00000000-0000-4000-8000-000000000622" +
          (r.method === "POST" ? "/status" : ""),
      );
    }
  }
});
test("P42 leaves production files, shared host and earlier P40/P41 evidence unchanged", () => {
  for (const file of [
    detail,
    reason,
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/use-modal-dialog.ts",
    "scripts/lib/ui-phase2-vue-review-host.mjs",
  ])
    assert.equal(
      read(file),
      execFileSync("git", ["show", `73d04832:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
    );
  for (const page of ["p40-list-preview", "p41-create-preview"]) {
    const dir = `output/playwright/${page}`;
    const old = execFileSync("git", ["show", `73d04832:${dir}/evidence.json`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(read(`${dir}/evidence.json`), old);
    for (const s of JSON.parse(old).screenshots)
      assert.equal(reviewHash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  }
});
